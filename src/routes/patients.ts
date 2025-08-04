import express, { Request, Response } from 'express';
import Joi from 'joi';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getConnection } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireHealthWorker } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || 'uploads';
    const patientsPath = path.join(uploadPath, 'patients');

    // Create directory if it doesn't exist
    if (!fs.existsSync(patientsPath)) {
      fs.mkdirSync(patientsPath, { recursive: true });
    }

    cb(null, patientsPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'patient-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
  },
  fileFilter: (_req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation schemas
const patientRegistrationSchema = Joi.object({
  fullName: Joi.string().min(1).max(255).required().messages({
    'string.empty': 'Nama lengkap wajib diisi',
    'string.max': 'Nama lengkap maksimal 255 karakter',
    'any.required': 'Nama lengkap wajib diisi'
  }),
  dateOfBirth: Joi.date().max('now').required().messages({
    'date.base': 'Format tanggal lahir tidak valid',
    'date.max': 'Tanggal lahir tidak boleh di masa depan',
    'any.required': 'Tanggal lahir wajib diisi'
  }),
  address: Joi.string().min(1).required().messages({
    'string.empty': 'Alamat lengkap wajib diisi',
    'any.required': 'Alamat lengkap wajib diisi'
  }),
  phoneNumber: Joi.string().pattern(/^[0-9+\-\s]+$/).max(20).optional().messages({
    'string.pattern.base': 'Format nomor telepon tidak valid'
  })
});

const patientUpdateSchema = Joi.object({
  fullName: Joi.string().min(1).max(255).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  address: Joi.string().min(1).optional(),
  phoneNumber: Joi.string().pattern(/^[0-9+\-\s]+$/).max(20).optional().allow('')
});

// Helper function to generate unique QR code
const generateUniqueQRCode = async (): Promise<string> => {
  const db = getConnection();
  let qrCode: string;
  let isUnique = false;
  
  while (!isUnique) {
    // Generate QR code with format: LANSIA-YYYY-XXXXXXXX
    const year = new Date().getFullYear();
    const randomId = uuidv4().substring(0, 8).toUpperCase();
    qrCode = `LANSIA-${year}-${randomId}`;
    
    // Check if QR code already exists
    const [existing] = await db.execute(
      'SELECT id FROM patients WHERE qr_code = ?',
      [qrCode]
    );
    
    if ((existing as any[]).length === 0) {
      isUnique = true;
    }
  }
  
  return qrCode!;
};

// POST /api/patients - Register new patient
router.post('/', 
  authenticateToken,
  requireHealthWorker,
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = patientRegistrationSchema.validate(req.body);
    if (error) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      throw new AppError(error.details[0].message, 400);
    }

    const { fullName, dateOfBirth, address, phoneNumber } = value;
    const db = getConnection();

    try {
      // Generate unique QR code
      const qrCode = await generateUniqueQRCode();
      
      // Prepare photo URL if file was uploaded
      let photoUrl: string | null = null;
      if (req.file) {
        photoUrl = `/uploads/patients/${req.file.filename}`;
      }

      // Insert patient into database
      const [result] = await db.execute(
        'INSERT INTO patients (qr_code, full_name, date_of_birth, address, phone_number, photo_url) VALUES (?, ?, ?, ?, ?, ?)',
        [qrCode, fullName, dateOfBirth, address, phoneNumber || null, photoUrl]
      );

      const patientId = (result as any).insertId;

      // Get the created patient
      const [patients] = await db.execute(
        'SELECT id, qr_code, full_name, date_of_birth, address, phone_number, photo_url, created_at, updated_at FROM patients WHERE id = ?',
        [patientId]
      );

      const patient = (patients as any[])[0];

      // Generate QR code image data URL
      const qrCodeDataURL = await QRCode.toDataURL(qrCode, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Log patient registration
      logger.info(`New patient registered: ${fullName}`, {
        patientId,
        qrCode,
        registeredBy: req.user?.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Lansia berhasil didaftarkan',
        data: {
          patient: {
            id: patient.id,
            qrCode: patient.qr_code,
            fullName: patient.full_name,
            dateOfBirth: patient.date_of_birth,
            address: patient.address,
            phoneNumber: patient.phone_number,
            photoUrl: patient.photo_url,
            createdAt: patient.created_at,
            updatedAt: patient.updated_at
          },
          qrCodeImage: qrCodeDataURL
        }
      });

    } catch (error) {
      // Clean up uploaded file if database operation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      throw error;
    }
  })
);

// GET /api/patients/:qrCode - Get patient by QR code
router.get('/:qrCode',
  authenticateToken,
  requireHealthWorker,
  asyncHandler(async (req: Request, res: Response) => {
    const { qrCode } = req.params;
    const db = getConnection();

    const [patients] = await db.execute(
      'SELECT id, qr_code, full_name, date_of_birth, address, phone_number, photo_url, created_at, updated_at FROM patients WHERE qr_code = ?',
      [qrCode]
    );

    const patient = (patients as any[])[0];
    if (!patient) {
      throw new AppError('QR Code tidak valid atau lansia tidak terdaftar', 404);
    }

    // Get recent health records (last 5)
    const [healthRecords] = await db.execute(
      `SELECT hr.id, hr.examination_date, hr.height, hr.weight, hr.bmi, hr.systolic_bp, hr.diastolic_bp, 
              hr.uric_acid, hr.blood_sugar, hr.cholesterol, hr.notes, u.full_name as examined_by_name
       FROM health_records hr
       LEFT JOIN users u ON hr.examined_by = u.id
       WHERE hr.patient_id = ?
       ORDER BY hr.examination_date DESC
       LIMIT 5`,
      [patient.id]
    );

    res.json({
      success: true,
      message: 'Data lansia berhasil ditemukan',
      data: {
        patient: {
          id: patient.id,
          qrCode: patient.qr_code,
          fullName: patient.full_name,
          dateOfBirth: patient.date_of_birth,
          address: patient.address,
          phoneNumber: patient.phone_number,
          photoUrl: patient.photo_url,
          createdAt: patient.created_at,
          updatedAt: patient.updated_at
        },
        recentHealthRecords: healthRecords
      }
    });
  })
);

// GET /api/patients/id/:id - Get patient by ID
router.get('/id/:id',
  authenticateToken,
  requireHealthWorker,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.id);
    if (isNaN(patientId)) {
      throw new AppError('ID pasien tidak valid', 400);
    }

    const db = getConnection();

    const [patients] = await db.execute(
      'SELECT id, qr_code, full_name, date_of_birth, address, phone_number, photo_url, created_at, updated_at FROM patients WHERE id = ?',
      [patientId]
    );

    const patient = (patients as any[])[0];
    if (!patient) {
      throw new AppError('Lansia tidak ditemukan', 404);
    }

    res.json({
      success: true,
      message: 'Data lansia berhasil ditemukan',
      data: {
        patient: {
          id: patient.id,
          qrCode: patient.qr_code,
          fullName: patient.full_name,
          dateOfBirth: patient.date_of_birth,
          address: patient.address,
          phoneNumber: patient.phone_number,
          photoUrl: patient.photo_url,
          createdAt: patient.created_at,
          updatedAt: patient.updated_at
        }
      }
    });
  })
);

// PUT /api/patients/:id - Update patient info
router.put('/:id',
  authenticateToken,
  requireHealthWorker,
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.id);
    if (isNaN(patientId)) {
      throw new AppError('ID pasien tidak valid', 400);
    }

    // Validate request body
    const { error, value } = patientUpdateSchema.validate(req.body);
    if (error) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      throw new AppError(error.details[0].message, 400);
    }

    const db = getConnection();

    // Check if patient exists
    const [existingPatients] = await db.execute(
      'SELECT id, photo_url FROM patients WHERE id = ?',
      [patientId]
    );

    const existingPatient = (existingPatients as any[])[0];
    if (!existingPatient) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      throw new AppError('Lansia tidak ditemukan', 404);
    }

    try {
      // Prepare update data
      const updateData: any = { ...value };

      // Handle photo update
      if (req.file) {
        updateData.photoUrl = `/uploads/patients/${req.file.filename}`;

        // Delete old photo if exists
        if (existingPatient.photo_url) {
          const oldPhotoPath = path.join(process.env.UPLOAD_PATH || 'uploads', existingPatient.photo_url.replace('/uploads/', ''));
          if (fs.existsSync(oldPhotoPath)) {
            fs.unlinkSync(oldPhotoPath);
          }
        }
      }

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];

      if (updateData.fullName) {
        updateFields.push('full_name = ?');
        updateValues.push(updateData.fullName);
      }
      if (updateData.dateOfBirth) {
        updateFields.push('date_of_birth = ?');
        updateValues.push(updateData.dateOfBirth);
      }
      if (updateData.address) {
        updateFields.push('address = ?');
        updateValues.push(updateData.address);
      }
      if (updateData.phoneNumber !== undefined) {
        updateFields.push('phone_number = ?');
        updateValues.push(updateData.phoneNumber || null);
      }
      if (updateData.photoUrl) {
        updateFields.push('photo_url = ?');
        updateValues.push(updateData.photoUrl);
      }

      if (updateFields.length === 0) {
        throw new AppError('Tidak ada data yang diupdate', 400);
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(patientId);

      // Execute update
      await db.execute(
        `UPDATE patients SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Get updated patient data
      const [updatedPatients] = await db.execute(
        'SELECT id, qr_code, full_name, date_of_birth, address, phone_number, photo_url, created_at, updated_at FROM patients WHERE id = ?',
        [patientId]
      );

      const updatedPatient = (updatedPatients as any[])[0];

      logger.info(`Patient updated: ${updatedPatient.full_name}`, {
        patientId,
        updatedBy: req.user?.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Data lansia berhasil diperbarui',
        data: {
          patient: {
            id: updatedPatient.id,
            qrCode: updatedPatient.qr_code,
            fullName: updatedPatient.full_name,
            dateOfBirth: updatedPatient.date_of_birth,
            address: updatedPatient.address,
            phoneNumber: updatedPatient.phone_number,
            photoUrl: updatedPatient.photo_url,
            createdAt: updatedPatient.created_at,
            updatedAt: updatedPatient.updated_at
          }
        }
      });

    } catch (error) {
      // Clean up uploaded file if database operation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      throw error;
    }
  })
);

// GET /api/patients/:id/history - Get patient health history
router.get('/:id/history',
  authenticateToken,
  requireHealthWorker,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.id);
    if (isNaN(patientId)) {
      throw new AppError('ID pasien tidak valid', 400);
    }

    const db = getConnection();

    // Check if patient exists
    const [patients] = await db.execute(
      'SELECT id FROM patients WHERE id = ?',
      [patientId]
    );

    if ((patients as any[]).length === 0) {
      throw new AppError('Lansia tidak ditemukan', 404);
    }

    // Get health records with pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const [healthRecords] = await db.execute(
      `SELECT hr.id, hr.examination_date, hr.height, hr.weight, hr.bmi,
              hr.systolic_bp, hr.diastolic_bp, hr.uric_acid, hr.blood_sugar,
              hr.cholesterol, hr.notes, u.full_name as examined_by_name
       FROM health_records hr
       LEFT JOIN users u ON hr.examined_by = u.id
       WHERE hr.patient_id = ?
       ORDER BY hr.examination_date DESC
       LIMIT ? OFFSET ?`,
      [patientId, limit, offset]
    );

    // Get total count
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM health_records WHERE patient_id = ?',
      [patientId]
    );

    const total = (countResult as any[])[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: 'Riwayat kesehatan berhasil diambil',
      data: {
        healthRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  })
);

export default router;
