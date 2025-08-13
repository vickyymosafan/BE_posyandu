const jwt = require('jsonwebtoken');

/**
 * Utilitas untuk generasi dan verifikasi token JWT
 */
class JWTUtils {
  /**
   * Generate access token
   * @param {Object} payload - Data yang akan disimpan dalam token
   * @returns {string} JWT access token
   */
  static generateAccessToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'posyandu-system',
        audience: 'posyandu-admin'
      }
    );
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Data yang akan disimpan dalam token
   * @returns {string} JWT refresh token
   */
  static generateRefreshToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: 'posyandu-system',
        audience: 'posyandu-admin'
      }
    );
  }

  /**
   * Verify access token
   * @param {string} token - JWT token untuk diverifikasi
   * @returns {Object} Decoded token payload
   * @throws {Error} Jika token tidak valid
   */
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'posyandu-system',
        audience: 'posyandu-admin'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token telah kadaluarsa');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Token tidak valid');
      } else {
        throw new Error('Gagal memverifikasi token');
      }
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token untuk diverifikasi
   * @returns {Object} Decoded token payload
   * @throws {Error} Jika token tidak valid
   */
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: 'posyandu-system',
        audience: 'posyandu-admin'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token telah kadaluarsa');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Refresh token tidak valid');
      } else {
        throw new Error('Gagal memverifikasi refresh token');
      }
    }
  }

  /**
   * Decode token tanpa verifikasi (untuk debugging)
   * @param {string} token - JWT token untuk didecode
   * @returns {Object} Decoded token
   */
  static decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} payload - Data yang akan disimpan dalam token
   * @returns {Object} Object berisi access token dan refresh token
   */
  static generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    };
  }
}

module.exports = JWTUtils;