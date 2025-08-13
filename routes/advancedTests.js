const express = require('express');
const router = express.Router();
const AdvancedTestController = require('../controllers/advancedTestController');
const authMiddleware = require('../middleware/auth');

// Middleware autentikasi untuk semua rute tes lanjutan
router.use(authMiddleware.authenticateToken);

/**
 * @route   GET /api/tes-lanjutan
 * @desc    Ambil semua tes lanjutan dengan paginasi dan filter
 * @access  Private (Admin only)
 * @query   page, limit, search, start_date, end_date, kategori
 */
router.get('/', AdvancedTestController.getAllAdvancedTests);

/**
 * @route   POST /api/tes-lanjutan
 * @desc    Pencatatan tes lanjutan baru (gula darah)
 * @access  Private (Admin only)
 * @body    id_pasien, gula_darah, catatan
 */
router.post('/', AdvancedTestController.createAdvancedTest);

/**
 * @route   GET /api/tes-lanjutan/:id
 * @desc    Ambil detail tes lanjutan berdasarkan ID
 * @access  Private (Admin only)
 * @param   id - ID tes lanjutan
 */
router.get('/:id', AdvancedTestController.getAdvancedTestById);

/**
 * @route   PUT /api/tes-lanjutan/:id
 * @desc    Update tes lanjutan
 * @access  Private (Admin only)
 * @param   id - ID tes lanjutan
 * @body    gula_darah, catatan
 */
router.put('/:id', AdvancedTestController.updateAdvancedTest);

module.exports = router;