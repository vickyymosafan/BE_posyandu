const express = require('express');
const router = express.Router();
const ReferralController = require('../controllers/referralController');
const { authenticateToken, logAccess } = require('../middleware/auth');

// Middleware untuk semua rute rujukan
router.use(authenticateToken);
router.use(logAccess);

/**
 * @route   POST /api/rujukan
 * @desc    Buat rujukan baru
 * @access  Private (Admin only)
 * @body    {
 *            id_pasien: number,
 *            id_penilaian?: number,
 *            nama_fasilitas: string,
 *            alasan: string,
 *            status?: 'menunggu' | 'selesai' | 'dibatalkan'
 *          }
 */
router.post('/', ReferralController.createReferral);

/**
 * @route   GET /api/rujukan
 * @desc    Ambil semua rujukan dengan paginasi dan pencarian
 * @access  Private (Admin only)
 * @query   {
 *            page?: number,
 *            limit?: number,
 *            search?: string,
 *            status?: 'menunggu' | 'selesai' | 'dibatalkan'
 *          }
 */
router.get('/', ReferralController.getAllReferrals);

/**
 * @route   GET /api/rujukan/check-critical/:patientId
 * @desc    Cek indikator kesehatan kritis untuk pasien
 * @access  Private (Admin only)
 * @params  patientId: number
 */
router.get('/check-critical/:patientId', ReferralController.checkCriticalIndicators);

/**
 * @route   GET /api/rujukan/:id
 * @desc    Ambil rujukan berdasarkan ID
 * @access  Private (Admin only)
 * @params  id: number
 */
router.get('/:id', ReferralController.getReferralById);

/**
 * @route   PUT /api/rujukan/:id
 * @desc    Update rujukan
 * @access  Private (Admin only)
 * @params  id: number
 * @body    {
 *            nama_fasilitas?: string,
 *            alasan?: string,
 *            status?: 'menunggu' | 'selesai' | 'dibatalkan'
 *          }
 */
router.put('/:id', ReferralController.updateReferral);

/**
 * @route   DELETE /api/rujukan/:id
 * @desc    Batalkan rujukan (ubah status menjadi dibatalkan)
 * @access  Private (Admin only)
 * @params  id: number
 */
router.delete('/:id', ReferralController.deleteReferral);

module.exports = router;