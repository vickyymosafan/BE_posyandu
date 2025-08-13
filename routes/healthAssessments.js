const express = require('express');
const router = express.Router();
const HealthAssessmentController = require('../controllers/healthAssessmentController');
const authMiddleware = require('../middleware/auth');

// Middleware autentikasi untuk semua rute penilaian kesehatan
router.use(authMiddleware.authenticateToken);

/**
 * @route   GET /api/penilaian
 * @desc    Ambil semua penilaian kesehatan dengan paginasi dan filter
 * @access  Private (Admin only)
 * @query   page, limit, search, category, start_date, end_date
 */
router.get('/', HealthAssessmentController.getAllHealthAssessments);

/**
 * @route   POST /api/penilaian
 * @desc    Pencatatan penilaian kesehatan baru dengan kategorisasi otomatis
 * @access  Private (Admin only)
 * @body    id_pasien, id_pemeriksaan_fisik, id_tes_lanjutan, kategori_penilaian, temuan, rekomendasi
 */
router.post('/', HealthAssessmentController.createHealthAssessment);

/**
 * @route   GET /api/penilaian/:id
 * @desc    Ambil detail penilaian kesehatan berdasarkan ID
 * @access  Private (Admin only)
 * @param   id - ID penilaian kesehatan
 */
router.get('/:id', HealthAssessmentController.getHealthAssessmentById);

/**
 * @route   PUT /api/penilaian/:id
 * @desc    Update penilaian kesehatan
 * @access  Private (Admin only)
 * @param   id - ID penilaian kesehatan
 * @body    kategori_penilaian, temuan, rekomendasi
 */
router.put('/:id', HealthAssessmentController.updateHealthAssessment);

module.exports = router;