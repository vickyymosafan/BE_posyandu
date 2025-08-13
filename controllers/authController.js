const { executeQuery } = require('../utils/database');
const PasswordUtils = require('../utils/password');
const JWTUtils = require('../utils/jwt');
const validator = require('validator');

/**
 * Controller untuk autentikasi admin
 */
class AuthController {
  /**
   * Login admin
   */
  static async login(req, res) {
    try {
      const { nama_pengguna, kata_sandi } = req.body;

      // Validasi input
      if (!nama_pengguna || !kata_sandi) {
        return res.status(400).json({
          sukses: false,
          pesan: 'Nama pengguna dan kata sandi wajib diisi'
        });
      }

      // Sanitasi input
      const sanitizedUsername = validator.escape(nama_pengguna.trim());

      // Cari admin di database
      const adminRows = await executeQuery(
        `SELECT id, nama_pengguna, hash_kata_sandi, nama_lengkap, email, aktif 
         FROM admin WHERE nama_pengguna = ?`,
        [sanitizedUsername]
      );

      if (adminRows.length === 0) {
        return res.status(401).json({
          sukses: false,
          pesan: 'Nama pengguna atau kata sandi tidak valid'
        });
      }

      const admin = adminRows[0];

      // Cek apakah admin aktif
      if (!admin.aktif) {
        return res.status(401).json({
          sukses: false,
          pesan: 'Akun admin tidak aktif'
        });
      }

      // Verifikasi password
      const isPasswordValid = await PasswordUtils.verifyPassword(
        kata_sandi,
        admin.hash_kata_sandi
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          sukses: false,
          pesan: 'Nama pengguna atau kata sandi tidak valid'
        });
      }

      // Generate token pair
      const tokenPayload = {
        adminId: admin.id,
        nama_pengguna: admin.nama_pengguna,
        nama_lengkap: admin.nama_lengkap
      };

      const tokens = JWTUtils.generateTokenPair(tokenPayload);

      // Update login terakhir
      await executeQuery(
        'UPDATE admin SET login_terakhir = NOW() WHERE id = ?',
        [admin.id]
      );

      // Log aktivitas login
      await executeQuery(
        `INSERT INTO log_akses (id_admin, aksi, alamat_ip, user_agent, waktu) 
         VALUES (?, ?, ?, ?, NOW())`,
        [
          admin.id,
          'LOGIN',
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent') || 'Unknown'
        ]
      );

      // Set cookies untuk token (optional, bisa juga menggunakan localStorage di frontend)
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      };

      res.cookie('accessToken', tokens.accessToken, {
        ...cookieOptions,
        maxAge: 24 * 60 * 60 * 1000 // 24 jam
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 hari
      });

      // Response sukses
      res.status(200).json({
        sukses: true,
        pesan: 'Login berhasil',
        data: {
          admin: {
            id: admin.id,
            nama_pengguna: admin.nama_pengguna,
            nama_lengkap: admin.nama_lengkap,
            email: admin.email
          },
          tokens: tokens
        }
      });

    } catch (error) {
      console.error('Error dalam login:', error);
      res.status(500).json({
        sukses: false,
        pesan: 'Terjadi kesalahan server'
      });
    }
  }

  /**
   * Logout admin
   */
  static async logout(req, res) {
    try {
      // Log aktivitas logout jika admin terautentikasi
      if (req.admin) {
        await executeQuery(
          `INSERT INTO log_akses (id_admin, aksi, alamat_ip, user_agent, waktu) 
           VALUES (?, ?, ?, ?, NOW())`,
          [
            req.admin.id,
            'LOGOUT',
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent') || 'Unknown'
          ]
        );
      }

      // Clear cookies
      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      });

      res.status(200).json({
        sukses: true,
        pesan: 'Logout berhasil'
      });

    } catch (error) {
      console.error('Error dalam logout:', error);
      res.status(500).json({
        sukses: false,
        pesan: 'Terjadi kesalahan server'
      });
    }
  }

  /**
   * Verifikasi token
   */
  static async verifyToken(req, res) {
    try {
      // Jika sampai di sini, berarti token valid (sudah diverifikasi di middleware)
      res.status(200).json({
        sukses: true,
        pesan: 'Token valid',
        data: {
          admin: req.admin
        }
      });

    } catch (error) {
      console.error('Error dalam verifikasi token:', error);
      res.status(500).json({
        sukses: false,
        pesan: 'Terjadi kesalahan server'
      });
    }
  }

  /**
   * Refresh token
   */
  static async refreshToken(req, res) {
    try {
      // Generate token baru
      const tokenPayload = {
        adminId: req.admin.id,
        nama_pengguna: req.admin.nama_pengguna,
        nama_lengkap: req.admin.nama_lengkap
      };

      const tokens = JWTUtils.generateTokenPair(tokenPayload);

      // Set cookies baru
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      };

      res.cookie('accessToken', tokens.accessToken, {
        ...cookieOptions,
        maxAge: 24 * 60 * 60 * 1000 // 24 jam
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 hari
      });

      // Log aktivitas refresh token
      await executeQuery(
        `INSERT INTO log_akses (id_admin, aksi, alamat_ip, user_agent, waktu) 
         VALUES (?, ?, ?, ?, NOW())`,
        [
          req.admin.id,
          'REFRESH_TOKEN',
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent') || 'Unknown'
        ]
      );

      res.status(200).json({
        sukses: true,
        pesan: 'Token berhasil diperbarui',
        data: {
          admin: req.admin,
          tokens: tokens
        }
      });

    } catch (error) {
      console.error('Error dalam refresh token:', error);
      res.status(500).json({
        sukses: false,
        pesan: 'Terjadi kesalahan server'
      });
    }
  }

  /**
   * Ganti password admin
   */
  static async changePassword(req, res) {
    try {
      const { kata_sandi_lama, kata_sandi_baru, konfirmasi_kata_sandi } = req.body;

      // Validasi input
      if (!kata_sandi_lama || !kata_sandi_baru || !konfirmasi_kata_sandi) {
        return res.status(400).json({
          sukses: false,
          pesan: 'Semua field kata sandi wajib diisi'
        });
      }

      if (kata_sandi_baru !== konfirmasi_kata_sandi) {
        return res.status(400).json({
          sukses: false,
          pesan: 'Konfirmasi kata sandi tidak cocok'
        });
      }

      // Validasi kekuatan password baru
      const passwordValidation = PasswordUtils.validatePasswordStrength(kata_sandi_baru);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          sukses: false,
          pesan: 'Kata sandi baru tidak memenuhi kriteria',
          errors: passwordValidation.errors
        });
      }

      // Ambil data admin dari database
      const adminRows = await executeQuery(
        'SELECT hash_kata_sandi FROM admin WHERE id = ?',
        [req.admin.id]
      );

      if (adminRows.length === 0) {
        return res.status(404).json({
          sukses: false,
          pesan: 'Admin tidak ditemukan'
        });
      }

      // Verifikasi password lama
      const isOldPasswordValid = await PasswordUtils.verifyPassword(
        kata_sandi_lama,
        adminRows[0].hash_kata_sandi
      );

      if (!isOldPasswordValid) {
        return res.status(400).json({
          sukses: false,
          pesan: 'Kata sandi lama tidak valid'
        });
      }

      // Hash password baru
      const hashedNewPassword = await PasswordUtils.hashPassword(kata_sandi_baru);

      // Update password di database
      await executeQuery(
        'UPDATE admin SET hash_kata_sandi = ?, diperbarui_pada = NOW() WHERE id = ?',
        [hashedNewPassword, req.admin.id]
      );

      // Log aktivitas ganti password
      await executeQuery(
        `INSERT INTO log_akses (id_admin, aksi, alamat_ip, user_agent, waktu) 
         VALUES (?, ?, ?, ?, NOW())`,
        [
          req.admin.id,
          'CHANGE_PASSWORD',
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent') || 'Unknown'
        ]
      );

      res.status(200).json({
        sukses: true,
        pesan: 'Kata sandi berhasil diubah'
      });

    } catch (error) {
      console.error('Error dalam ganti password:', error);
      res.status(500).json({
        sukses: false,
        pesan: 'Terjadi kesalahan server'
      });
    }
  }

  /**
   * Get profile admin yang sedang login
   */
  static async getProfile(req, res) {
    try {
      // Ambil data lengkap admin dari database
      const adminRows = await executeQuery(
        `SELECT id, nama_pengguna, nama_lengkap, email, dibuat_pada, 
                diperbarui_pada, login_terakhir 
         FROM admin WHERE id = ?`,
        [req.admin.id]
      );

      if (adminRows.length === 0) {
        return res.status(404).json({
          sukses: false,
          pesan: 'Admin tidak ditemukan'
        });
      }

      const admin = adminRows[0];

      res.status(200).json({
        sukses: true,
        pesan: 'Data profil berhasil diambil',
        data: {
          admin: {
            id: admin.id,
            nama_pengguna: admin.nama_pengguna,
            nama_lengkap: admin.nama_lengkap,
            email: admin.email,
            dibuat_pada: admin.dibuat_pada,
            diperbarui_pada: admin.diperbarui_pada,
            login_terakhir: admin.login_terakhir
          }
        }
      });

    } catch (error) {
      console.error('Error dalam get profile:', error);
      res.status(500).json({
        sukses: false,
        pesan: 'Terjadi kesalahan server'
      });
    }
  }
}

module.exports = AuthController;