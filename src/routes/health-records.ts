import express, { Request, Response } from 'express';
import Joi from 'joi';
import { getConnection } from '../config/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, requireHealthWorker } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
const physicalExamSchema = Joi.object({
  patientId: Joi.number().integer().positive().required().messages({
    'number.base': 'ID pasien harus berupa angka',
    'number.positive': 'ID pasien harus positif',
    'any.required': 'ID pasien wajib diisi'
  }),
  height: Joi.number().min(100).max(200).optional().messages({
    'number.min': 'Tinggi badan minimal 100 cm',
    'number.max': 'Tinggi badan maksimal 200 cm'
  }),
  weight: Joi.number().min(30).max(150).optional().messages({
    'number.min': 'Berat badan minimal 30 kg',
    'number.max': 'Berat badan maksimal 150 kg'
  }),
  systolicBp: Joi.number().integer().min(70).max(250).optional().messages({
    'number.min': 'Tekanan darah sistolik minimal 70 mmHg',
    'number.max': 'Tekanan darah sistolik maksimal 250 mmHg'
  }),
  diastolicBp: Joi.number().integer().min(40).max(150).optional().messages({
    'number.min': 'Tekanan darah diastolik minimal 40 mmHg',
    'number.max': 'Tekanan darah diastolik maksimal 150 mmHg'
  }),
  notes: Joi.string().max(1000).optional().allow('')
});

const advancedExamSchema = Joi.object({
  patientId: Joi.number().integer().positive().required().messages({
    'number.base': 'ID pasien harus berupa angka',
    'number.positive': 'ID pasien harus positif',
    'any.required': 'ID pasien wajib diisi'
  }),
  uricAcid: Joi.number().min(2.0).max(15.0).optional().messages({
    'number.min': 'Kadar asam urat minimal 2.0 mg/dL',
    'number.max': 'Kadar asam urat maksimal 15.0 mg/dL'
  }),
  bloodSugar: Joi.number().min(50).max(500).optional().messages({
    'number.min': 'Kadar gula darah minimal 50 mg/dL',
    'number.max': 'Kadar gula darah maksimal 500 mg/dL'
  }),
  cholesterol: Joi.number().min(100).max(400).optional().messages({
    'number.min': 'Kadar kolesterol minimal 100 mg/dL',
    'number.max': 'Kadar kolesterol maksimal 400 mg/dL'
  }),
  notes: Joi.string().max(1000).optional().allow('')
});

// POST /api/health-records/physical - Create physical examination record
router.post('/physical',
  authenticateToken,
  requireHealthWorker,
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = physicalExamSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { patientId, height, weight, systolicBp, diastolicBp, notes } = value;
    const db = getConnection();

    // Check if patient exists
    const [patients] = await db.execute(
      'SELECT id FROM patients WHERE id = ?',
      [patientId]
    );

    if ((patients as any[]).length === 0) {
      throw new AppError('Pasien tidak ditemukan', 404);
    }

    // Insert health record
    const [result] = await db.execute(
      `INSERT INTO health_records (patient_id, height, weight, systolic_bp, diastolic_bp, examined_by, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [patientId, height || null, weight || null, systolicBp || null, diastolicBp || null, req.user?.id, notes || null]
    );

    const recordId = (result as any).insertId;

    // Get the created record with calculated BMI
    const [records] = await db.execute(
      `SELECT hr.id, hr.patient_id, hr.examination_date, hr.height, hr.weight, hr.bmi, 
              hr.systolic_bp, hr.diastolic_bp, hr.notes, u.full_name as examined_by_name
       FROM health_records hr
       LEFT JOIN users u ON hr.examined_by = u.id
       WHERE hr.id = ?`,
      [recordId]
    );

    const record = (records as any[])[0];

    // Log examination
    logger.info(`Physical examination recorded for patient ${patientId}`, {
      recordId,
      patientId,
      examinedBy: req.user?.id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Data pemeriksaan fisik berhasil disimpan',
      data: {
        record: {
          id: record.id,
          patientId: record.patient_id,
          examinationDate: record.examination_date,
          height: record.height,
          weight: record.weight,
          bmi: record.bmi,
          systolicBp: record.systolic_bp,
          diastolicBp: record.diastolic_bp,
          notes: record.notes,
          examinedByName: record.examined_by_name
        }
      }
    });
  })
);

// POST /api/health-records/advanced - Create advanced examination record
router.post('/advanced',
  authenticateToken,
  requireHealthWorker,
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = advancedExamSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { patientId, uricAcid, bloodSugar, cholesterol, notes } = value;
    const db = getConnection();

    // Check if patient exists
    const [patients] = await db.execute(
      'SELECT id FROM patients WHERE id = ?',
      [patientId]
    );

    if ((patients as any[]).length === 0) {
      throw new AppError('Pasien tidak ditemukan', 404);
    }

    // Insert health record
    const [result] = await db.execute(
      `INSERT INTO health_records (patient_id, uric_acid, blood_sugar, cholesterol, examined_by, notes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patientId, uricAcid || null, bloodSugar || null, cholesterol || null, req.user?.id, notes || null]
    );

    const recordId = (result as any).insertId;

    // Get the created record
    const [records] = await db.execute(
      `SELECT hr.id, hr.patient_id, hr.examination_date, hr.uric_acid, hr.blood_sugar, 
              hr.cholesterol, hr.notes, u.full_name as examined_by_name
       FROM health_records hr
       LEFT JOIN users u ON hr.examined_by = u.id
       WHERE hr.id = ?`,
      [recordId]
    );

    const record = (records as any[])[0];

    // Check for abnormal values and create warnings
    const warnings = [];
    if (uricAcid) {
      if (uricAcid > 7.0) warnings.push('Kadar asam urat tinggi');
      if (uricAcid < 3.0) warnings.push('Kadar asam urat rendah');
    }
    if (bloodSugar) {
      if (bloodSugar > 200) warnings.push('Kadar gula darah tinggi');
      if (bloodSugar < 70) warnings.push('Kadar gula darah rendah');
    }
    if (cholesterol) {
      if (cholesterol > 240) warnings.push('Kadar kolesterol tinggi');
    }

    // Log examination
    logger.info(`Advanced examination recorded for patient ${patientId}`, {
      recordId,
      patientId,
      examinedBy: req.user?.id,
      warnings: warnings.length > 0 ? warnings : null,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Data pemeriksaan lanjutan berhasil disimpan',
      data: {
        record: {
          id: record.id,
          patientId: record.patient_id,
          examinationDate: record.examination_date,
          uricAcid: record.uric_acid,
          bloodSugar: record.blood_sugar,
          cholesterol: record.cholesterol,
          notes: record.notes,
          examinedByName: record.examined_by_name
        },
        warnings
      }
    });
  })
);

// GET /api/health-records/:patientId - Get patient's health records
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
