const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken, authenticateRefreshToken, logAccess } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login admin
 * @access  Public
 */
router.post('/login', AuthController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout admin
 * @access  Private (optional - bisa dipanggil tanpa token untuk clear cookies)
 */
router.post('/logout', (req, res, next) => {
  // Middleware opsional - jika ada token, gunakan untuk logging
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : req.cookies?.accessToken;
  
  if (token) {
    // Jika ada token, gunakan middleware auth untuk logging
    authenticateToken(req, res, (err) => {
      if (err) {
        // Jika token tidak valid, tetap lanjutkan logout
        return AuthController.logout(req, res);
      }
      next();
    });
  } else {
    // Jika tidak ada token, langsung logout
    next();
  }
}, AuthController.logout);

/**
 * @route   GET /api/auth/verify
 * @desc    Verifikasi token
 * @access  Private
 */
router.get('/verify', authenticateToken, logAccess, AuthController.verifyToken);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Private (memerlukan refresh token)
 */
router.post('/refresh', authenticateRefreshToken, AuthController.refreshToken);

/**
 * @route   POST /api/auth/change-password
 * @desc    Ganti password admin
 * @access  Private
 */
router.post('/change-password', authenticateToken, logAccess, AuthController.changePassword);

/**
 * @route   GET /api/auth/profile
 * @desc    Get profile admin yang sedang login
 * @access  Private
 */
router.get('/profile', authenticateToken, logAccess, AuthController.getProfile);

module.exports = router;