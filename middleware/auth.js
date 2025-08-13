const JWTUtils = require('../utils/jwt');
const { executeQuery } = require('../utils/database');

/**
 * Middleware untuk autentikasi token JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Ambil token dari header Authorization atau cookie
    let token = null;
    
    // Cek header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Jika tidak ada di header, cek cookie
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }
    
    if (!token) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Token akses tidak ditemukan'
      });
    }

    // Verifikasi token
    const decoded = JWTUtils.verifyAccessToken(token);
    
    // Cek apakah admin masih ada di database
    const adminRows = await executeQuery(
      'SELECT id, nama_pengguna, nama_lengkap, email FROM admin WHERE id = ? AND aktif = 1',
      [decoded.adminId]
    );
    
    if (adminRows.length === 0) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Admin tidak ditemukan atau tidak aktif'
      });
    }
    
    // Simpan data admin ke request object
    req.admin = {
      id: adminRows[0].id,
      nama_pengguna: adminRows[0].nama_pengguna,
      nama_lengkap: adminRows[0].nama_lengkap,
      email: adminRows[0].email
    };
    
    next();
  } catch (error) {
    console.error('Error dalam autentikasi token:', error);
    
    if (error.message.includes('kadaluarsa')) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Token telah kadaluarsa',
        kode: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      sukses: false,
      pesan: 'Token tidak valid'
    });
  }
};

/**
 * Middleware untuk verifikasi refresh token
 */
const authenticateRefreshToken = async (req, res, next) => {
  try {
    // Ambil refresh token dari cookie atau body
    let refreshToken = null;
    
    if (req.cookies && req.cookies.refreshToken) {
      refreshToken = req.cookies.refreshToken;
    } else if (req.body.refreshToken) {
      refreshToken = req.body.refreshToken;
    }
    
    if (!refreshToken) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Refresh token tidak ditemukan'
      });
    }

    // Verifikasi refresh token
    const decoded = JWTUtils.verifyRefreshToken(refreshToken);
    
    // Cek apakah admin masih ada di database
    const adminRows = await executeQuery(
      'SELECT id, nama_pengguna, nama_lengkap, email FROM admin WHERE id = ? AND aktif = 1',
      [decoded.adminId]
    );
    
    if (adminRows.length === 0) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Admin tidak ditemukan atau tidak aktif'
      });
    }
    
    // Simpan data admin dan refresh token ke request object
    req.admin = {
      id: adminRows[0].id,
      nama_pengguna: adminRows[0].nama_pengguna,
      nama_lengkap: adminRows[0].nama_lengkap,
      email: adminRows[0].email
    };
    req.refreshToken = refreshToken;
    
    next();
  } catch (error) {
    console.error('Error dalam verifikasi refresh token:', error);
    
    if (error.message.includes('kadaluarsa')) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Refresh token telah kadaluarsa',
        kode: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      sukses: false,
      pesan: 'Refresh token tidak valid'
    });
  }
};

/**
 * Middleware untuk logging akses admin
 */
const logAccess = async (req, res, next) => {
  try {
    if (req.admin) {
      // Log akses admin
      await executeQuery(
        `INSERT INTO log_akses (id_admin, aksi, alamat_ip, user_agent, waktu) 
         VALUES (?, ?, ?, ?, NOW())`,
        [
          req.admin.id,
          `${req.method} ${req.originalUrl}`,
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent') || 'Unknown'
        ]
      );
    }
    next();
  } catch (error) {
    console.error('Error dalam logging akses:', error);
    // Jangan blokir request jika logging gagal
    next();
  }
};

/**
 * Middleware untuk validasi role admin (untuk future use)
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        sukses: false,
        pesan: 'Autentikasi diperlukan'
      });
    }
    
    // Untuk saat ini, semua admin memiliki akses penuh
    // Bisa dikembangkan untuk role-based access control
    next();
  };
};

/**
 * Wrapper untuk menangani error async dalam middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  authenticateToken: asyncHandler(authenticateToken),
  authenticateRefreshToken: asyncHandler(authenticateRefreshToken),
  logAccess: asyncHandler(logAccess),
  requireRole,
  asyncHandler
};