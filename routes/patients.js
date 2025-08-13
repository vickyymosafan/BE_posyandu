const express = require('express');
const router = express.Router();
const PatientController = require('../controllers/patientController');
const PhysicalExamController = require('../controllers/physicalExamController');
const AdvancedTestController = require('../controllers/advancedTestController');
const HealthAssessmentController = require('../controllers/healthAssessmentController');
const TreatmentController = require('../controllers/treatmentController');
const ReferralController = require('../controllers/referralController');
const barcodeController = require('../controllers/barcodeController');
const authMiddleware = require('../middleware/auth');

// Middleware autentikasi untuk semua rute pasien
router.use(authMiddleware.authenticateToken);

/**
 * @route   GET /api/pasien
 * @desc    Ambil semua pasien dengan paginasi dan pencarian
 * @access  Private (Admin only)
 * @query   page, limit, search
 */
router.get('/', PatientController.getAllPatients);

/**
 * @route   POST /api/pasien
 * @desc    Daftarkan pasien baru
 * @access  Private (Admin only)
 * @body    nama, nik, nomor_kk, tanggal_lahir, nomor_hp, alamat
 */
router.post('/', PatientController.createPatient);

/**
 * @route   GET /api/pasien/search/barcode
 * @desc    Cari pasien berdasarkan barcode atau ID pasien
 * @access  Private (Admin only)
 * @query   code
 */
router.get('/search/barcode', PatientController.searchPatientByBarcode);

/**
 * @route   GET /api/pasien/:id
 * @desc    Ambil data pasien berdasarkan ID
 * @access  Private (Admin only)
 * @param   id - ID pasien
 */
router.get('/:id', PatientController.getPatientById);

/**
 * @route   PUT /api/pasien/:id
 * @desc    Update data pasien
 * @access  Private (Admin only)
 * @param   id - ID pasien
 * @body    nama, nik, nomor_kk, tanggal_lahir, nomor_hp, alamat
 */
router.put('/:id', PatientController.updatePatient);

/**
 * @route   DELETE /api/pasien/:id
 * @desc    Hapus pasien (tidak diizinkan untuk keamanan data)
 * @access  Private (Admin only)
 * @param   id - ID pasien
 */
router.delete('/:id', PatientController.deletePatient);

/**
 * @route   GET /api/pasien/:id/barcode
 * @desc    Generate dan download barcode pasien
 * @access  Private (Admin only)
 * @param   id - ID pasien
 * @query   format (png), download (true/false)
 */
router.get('/:id/barcode', barcodeController.generatePatientBarcode);

/**
 * @route   GET /api/pasien/:id/barcode/pdf
 * @desc    Download barcode dalam format PDF
 * @access  Private (Admin only)
 * @param   id - ID pasien
 */
router.get('/:id/barcode/pdf', barcodeController.downloadBarcodePDF);

/**
 * @route   GET /api/pasien/:id/pemeriksaan
 * @desc    Ambil riwayat pemeriksaan fisik pasien
 * @access  Private (Admin only)
 * @param   id - ID pasien
 * @query   page, limit
 */
router.get('/:id/pemeriksaan', PhysicalExamController.getPatientExaminations);

/**
 * @route   GET /api/pasien/:id/tes-lanjutan
 * @desc    Ambil riwayat tes lanjutan pasien dengan analisis tren
 * @access  Private (Admin only)
 * @param   id - ID pasien
 * @query   page, limit
 */
router.get('/:id/tes-lanjutan', AdvancedTestController.getPatientAdvancedTests);

/**
 * @route   GET /api/pasien/:id/penilaian
 * @desc    Ambil riwayat penilaian kesehatan pasien
 * @access  Private (Admin only)
 * @param   id - ID pasien
 * @query   page, limit
 */
router.get('/:id/penilaian', HealthAssessmentController.getPatientHealthAssessments);

/**
 * @route   GET /api/pasien/:id/pengobatan
 * @desc    Ambil riwayat pengobatan pasien
 * @access  Private (Admin only)
 * @param   id - ID pasien
 * @query   page, limit
 */
router.get('/:id/pengobatan', TreatmentController.getPatientTreatments);

/**
 * @route   GET /api/pasien/:id/rujukan
 * @desc    Ambil riwayat rujukan pasien
 * @access  Private (Admin only)
 * @param   id - ID pasien
 * @query   page, limit
 */
router.get('/:id/rujukan', ReferralController.getPatientReferrals);

module.exports = router;