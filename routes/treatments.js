const express = require('express');
const router = express.Router();
const TreatmentController = require('../controllers/treatmentController');
const { authenticateToken, logAccess } = require('../middleware/auth');

// Middleware untuk semua rute pengobatan
router.use(authenticateToken);
router.use(logAccess);

/**
 * @route   POST /api/pengobatan
 * @desc    Buat resep pengobatan baru
 * @access  Private (Admin only)
 * @body    {
 *            id_pasien: number,
 *            id_penilaian?: number,
 *            nama_obat?: string,
 *            dosis?: string,
 *            frekuensi?: string,
 *            durasi?: string,
 *            instruksi?: string
 *          }
 */
router.post('/', TreatmentController.createTreatment);

/**
 * @route   GET /api/pengobatan
 * @desc    Ambil semua pengobatan dengan paginasi dan pencarian
 * @access  Private (Admin only)
 * @query   {
 *            page?: number,
 *            limit?: number,
 *            search?: string
 *          }
 */
router.get('/', TreatmentController.getAllTreatments);

/**
 * @route   GET /api/pengobatan/:id
 * @desc    Ambil pengobatan berdasarkan ID
 * @access  Private (Admin only)
 * @params  id: number
 */
router.get('/:id', TreatmentController.getTreatmentById);

/**
 * @route   PUT /api/pengobatan/:id
 * @desc    Update pengobatan
 * @access  Private (Admin only)
 * @params  id: number
 * @body    {
 *            id_penilaian?: number,
 *            nama_obat?: string,
 *            dosis?: string,
 *            frekuensi?: string,
 *            durasi?: string,
 *            instruksi?: string
 *          }
 */
router.put('/:id', TreatmentController.updateTreatment);

/**
 * @route   DELETE /api/pengobatan/:id
 * @desc    Hapus pengobatan (tidak diizinkan untuk keamanan data medis)
 * @access  Private (Admin only)
 * @params  id: number
 */
router.delete('/:id', TreatmentController.deleteTreatment);

module.exports = router;