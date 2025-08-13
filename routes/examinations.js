const express = require('express');
const router = express.Router();
const PhysicalExamController = require('../controllers/physicalExamController');
const authMiddleware = require('../middleware/auth');

// Middleware autentikasi untuk semua rute pemeriksaan
router.use(authMiddleware.authenticateToken);

/**
 * @route   GET /api/pemeriksaan
 * @desc    Ambil semua pemeriksaan fisik dengan paginasi dan filter
 * @access  Private (Admin only)
 * @query   page, limit, search, start_date, end_date
 */
router.get('/', PhysicalExamController.getAllPhysicalExams);

/**
 * @route   POST /api/pemeriksaan
 * @desc    Pencatatan pemeriksaan fisik baru
 * @access  Private (Admin only)
 * @body    id_pasien, tinggi_badan, berat_badan, lingkar_perut, tekanan_darah_sistolik, tekanan_darah_diastolik, catatan
 */
router.post('/', PhysicalExamController.createPhysicalExam);

/**
 * @route   GET /api/pemeriksaan/:id
 * @desc    Ambil detail pemeriksaan fisik berdasarkan ID
 * @access  Private (Admin only)
 * @param   id - ID pemeriksaan fisik
 */
router.get('/:id', PhysicalExamController.getPhysicalExamById);

/**
 * @route   PUT /api/pemeriksaan/:id
 * @desc    Update pemeriksaan fisik
 * @access  Private (Admin only)
 * @param   id - ID pemeriksaan fisik
 * @body    tinggi_badan, berat_badan, lingkar_perut, tekanan_darah_sistolik, tekanan_darah_diastolik, catatan
 */
router.put('/:id', PhysicalExamController.updatePhysicalExam);

/**
 * @route   DELETE /api/pemeriksaan/:id
 * @desc    Hapus pemeriksaan fisik
 * @access  Private (Admin only)
 * @param   id - ID pemeriksaan fisik
 */
router.delete('/:id', PhysicalExamController.deletePhysicalExam);

module.exports = router;