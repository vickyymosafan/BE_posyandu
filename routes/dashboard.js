const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
    getStatistik, 
    getAktivitasTerbaru, 
    getTindakLanjutTertunda 
} = require('../controllers/dashboardController');

// Apply authentication middleware to all dashboard routes
router.use(authenticateToken);

/**
 * @route GET /api/dashboard/statistik
 * @desc Get dashboard statistics including total patients, recent examinations, and key metrics
 * @access Private (Admin only)
 * @requirements 7.1, 7.2
 */
router.get('/statistik', getStatistik);

/**
 * @route GET /api/dashboard/aktivitas-terbaru
 * @desc Get recent activities across all modules (examinations, tests, assessments, treatments, referrals)
 * @access Private (Admin only)
 * @query limit - Number of activities to return (default: 10)
 * @requirements 7.2
 */
router.get('/aktivitas-terbaru', getAktivitasTerbaru);

/**
 * @route GET /api/dashboard/tindak-lanjut-tertunda
 * @desc Get pending follow-ups including patients needing attention and overdue examinations
 * @access Private (Admin only)
 * @requirements 7.2, 7.4
 */
router.get('/tindak-lanjut-tertunda', getTindakLanjutTertunda);

module.exports = router;