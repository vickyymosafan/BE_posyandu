const express = require('express');
const router = express.Router();
const barcodeController = require('../controllers/barcodeController');
const authMiddleware = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

/**
 * Middleware untuk validasi input
 */
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Data tidak valid',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route POST /api/barcode/scan
 * @desc Scan dan validasi barcode pasien
 * @access Private
 */
router.post('/scan', 
  authMiddleware.authenticateToken,
  [
    body('barcodeData')
      .notEmpty()
      .withMessage('Data barcode diperlukan')
      .isLength({ min: 10 })
      .withMessage('Data barcode tidak valid')
  ],
  validateInput,
  barcodeController.scanBarcode
);

/**
 * @route POST /api/barcode/validate
 * @desc Validasi barcode tanpa mengambil data lengkap
 * @access Private
 */
router.post('/validate',
  authMiddleware.authenticateToken,
  [
    body('barcodeData')
      .notEmpty()
      .withMessage('Data barcode diperlukan')
      .isLength({ min: 10 })
      .withMessage('Data barcode tidak valid')
  ],
  validateInput,
  barcodeController.validateBarcode
);

module.exports = router;