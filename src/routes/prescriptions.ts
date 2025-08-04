import express, { Request, Response } from 'express';
import Joi from 'joi';
import { getConnection } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireHealthWorker } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
const prescriptionSchema = Joi.object({
  patientId: Joi.number().integer().positive().required().messages({
    'number.base': 'ID pasien harus berupa angka',
    'number.positive': 'ID pasien harus positif',
    'any.required': 'ID pasien wajib diisi'
  }),
  medications: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Nama obat wajib diisi',
        'string.max': 'Nama obat maksimal 255 karakter'
      }),
      dosage: Joi.string().min(1).max(100).required().messages({
        'string.empty': 'Dosis obat wajib diisi',
        'string.max': 'Dosis obat maksimal 100 karakter'
      }),
      frequency: Joi.string().min(1).max(100).required().messages({
        'string.empty': 'Frekuensi obat wajib diisi',
        'string.max': 'Frekuensi obat maksimal 100 karakter'
      }),
      duration: Joi.string().min(1).max(100).required().messages({
        'string.empty': 'Durasi obat wajib diisi',
        'string.max': 'Durasi obat maksimal 100 karakter'
      }),
      instructions: Joi.string().max(500).optional().allow('')
    })
  ).min(1).required().messages({
    'array.min': 'Minimal satu obat harus diisi'
  }),
  diagnosis: Joi.string().min(1).max(500).required().messages({
    'string.empty': 'Diagnosis wajib diisi',
    'string.max': 'Diagnosis maksimal 500 karakter'
  }),
  notes: Joi.string().max(1000).optional().allow('')
});

const referralSchema = Joi.object({
  patientId: Joi.number().integer().positive().required().messages({
    'number.base': 'ID pasien harus berupa angka',
    'number.positive': 'ID pasien harus positif',
    'any.required': 'ID pasien wajib diisi'
  }),
  referralTo: Joi.string().min(1).max(255).required().messages({
    'string.empty': 'Tujuan rujukan wajib diisi',
    'string.max': 'Tujuan rujukan maksimal 255 karakter'
  }),
  specialist: Joi.string().min(1).max(255).required().messages({
    'string.empty': 'Spesialis wajib diisi',
    'string.max': 'Spesialis maksimal 255 karakter'
  }),
  reason: Joi.string().min(1).max(1000).required().messages({
    'string.empty': 'Alasan rujukan wajib diisi',
    'string.max': 'Alasan rujukan maksimal 1000 karakter'
  }),
  urgency: Joi.string().valid('normal', 'urgent', 'emergency').required().messages({
    'any.only': 'Tingkat urgensi harus normal, urgent, atau emergency'
  }),
  notes: Joi.string().max(1000).optional().allow('')
});

// POST /api/prescriptions - Create prescription
router.post('/',
  authenticateToken,
  requireHealthWorker,
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = prescriptionSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { patientId, medications, diagnosis, notes } = value;
    const db = getConnection();

    // Check if patient exists
    const [patients] = await db.execute(
      'SELECT id, full_name FROM patients WHERE id = ?',
      [patientId]
    );

    if ((patients as any[]).length === 0) {
      throw new AppError('Pasien tidak ditemukan', 404);
    }

    const patient = (patients as any[])[0];

    try {
      // Start transaction
      await db.execute('START TRANSACTION');

      // Insert prescription
      const [prescriptionResult] = await db.execute(
        'INSERT INTO prescriptions (patient_id, diagnosis, notes, prescribed_by) VALUES (?, ?, ?, ?)',
        [patientId, diagnosis, notes || null, req.user?.id]
      );

      const prescriptionId = (prescriptionResult as any).insertId;

      // Insert medications
      for (const medication of medications) {
        await db.execute(
          'INSERT INTO prescription_medications (prescription_id, medication_name, dosage, frequency, duration, instructions) VALUES (?, ?, ?, ?, ?, ?)',
          [prescriptionId, medication.name, medication.dosage, medication.frequency, medication.duration, medication.instructions || null]
        );
      }

      // Commit transaction
      await db.execute('COMMIT');

      // Get the created prescription with medications
      const [prescriptions] = await db.execute(
        `SELECT p.id, p.patient_id, p.diagnosis, p.notes, p.created_at, u.full_name as prescribed_by_name
         FROM prescriptions p
         LEFT JOIN users u ON p.prescribed_by = u.id
         WHERE p.id = ?`,
        [prescriptionId]
      );

      const [prescriptionMedications] = await db.execute(
        'SELECT medication_name, dosage, frequency, duration, instructions FROM prescription_medications WHERE prescription_id = ?',
        [prescriptionId]
      );

      const prescription = (prescriptions as any[])[0];

      // Log prescription creation
      logger.info(`Prescription created for patient ${patient.full_name}`, {
        prescriptionId,
        patientId,
        medicationCount: medications.length,
        prescribedBy: req.user?.id,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: 'Resep berhasil dibuat',
        data: {
          prescription: {
            id: prescription.id,
            patientId: prescription.patient_id,
            diagnosis: prescription.diagnosis,
            notes: prescription.notes,
            createdAt: prescription.created_at,
            prescribedByName: prescription.prescribed_by_name,
            medications: prescriptionMedications
          }
        }
      });

    } catch (error) {
      // Rollback transaction on error
      await db.execute('ROLLBACK');
      throw error;
    }
  })
);

// POST /api/prescriptions/referrals - Create referral
router.post('/referrals',
  authenticateToken,
  requireHealthWorker,
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = referralSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { patientId, referralTo, specialist, reason, urgency, notes } = value;
    const db = getConnection();

    // Check if patient exists
    const [patients] = await db.execute(
      'SELECT id, full_name FROM patients WHERE id = ?',
      [patientId]
    );

    if ((patients as any[]).length === 0) {
      throw new AppError('Pasien tidak ditemukan', 404);
    }

    const patient = (patients as any[])[0];

    // Insert referral
    const [result] = await db.execute(
      'INSERT INTO referrals (patient_id, referral_to, specialist, reason, urgency, notes, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [patientId, referralTo, specialist, reason, urgency, notes || null, req.user?.id]
    );

    const referralId = (result as any).insertId;

    // Get the created referral
    const [referrals] = await db.execute(
      `SELECT r.id, r.patient_id, r.referral_to, r.specialist, r.reason, r.urgency, r.notes, r.created_at, u.full_name as referred_by_name
       FROM referrals r
       LEFT JOIN users u ON r.referred_by = u.id
       WHERE r.id = ?`,
      [referralId]
    );

    const referral = (referrals as any[])[0];

    // Log referral creation
    logger.info(`Referral created for patient ${patient.full_name}`, {
      referralId,
      patientId,
      referralTo,
      specialist,
      urgency,
      referredBy: req.user?.id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Rujukan berhasil dibuat',
      data: {
        referral: {
          id: referral.id,
          patientId: referral.patient_id,
          referralTo: referral.referral_to,
          specialist: referral.specialist,
          reason: referral.reason,
          urgency: referral.urgency,
          notes: referral.notes,
          createdAt: referral.created_at,
          referredByName: referral.referred_by_name
        }
      }
    });
  })
);

// GET /api/prescriptions/:patientId - Get patient's prescriptions
router.get('/:patientId',
  authenticateToken,
  requireHealthWorker,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
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
      throw new AppError('Pasien tidak ditemukan', 404);
    }

    // Get prescriptions with pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const [prescriptions] = await db.execute(
      `SELECT p.id, p.diagnosis, p.notes, p.created_at, u.full_name as prescribed_by_name
       FROM prescriptions p
       LEFT JOIN users u ON p.prescribed_by = u.id
       WHERE p.patient_id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [patientId, limit, offset]
    );

    // Get medications for each prescription
    const prescriptionsWithMedications = [];
    for (const prescription of prescriptions as any[]) {
      const [medications] = await db.execute(
        'SELECT medication_name, dosage, frequency, duration, instructions FROM prescription_medications WHERE prescription_id = ?',
        [prescription.id]
      );
      
      prescriptionsWithMedications.push({
        ...prescription,
        medications
      });
    }

    // Get total count
    const [countResult] = await db.execute(
      'SELECT COUNT(*) as total FROM prescriptions WHERE patient_id = ?',
      [patientId]
    );

    const total = (countResult as any[])[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      message: 'Riwayat resep berhasil diambil',
      data: {
        prescriptions: prescriptionsWithMedications,
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
