const bcrypt = require('bcrypt');

/**
 * Utilitas untuk hashing dan verifikasi password menggunakan bcrypt
 */
class PasswordUtils {
  /**
   * Hash password menggunakan bcrypt
   * @param {string} password - Password plain text
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    try {
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      return hashedPassword;
    } catch (error) {
      throw new Error('Gagal melakukan hash password: ' + error.message);
    }
  }

  /**
   * Verifikasi password dengan hash
   * @param {string} password - Password plain text
   * @param {string} hashedPassword - Hashed password dari database
   * @returns {Promise<boolean>} True jika password cocok
   */
  static async verifyPassword(password, hashedPassword) {
    try {
      const isMatch = await bcrypt.compare(password, hashedPassword);
      return isMatch;
    } catch (error) {
      throw new Error('Gagal memverifikasi password: ' + error.message);
    }
  }

  /**
   * Validasi kekuatan password
   * @param {string} password - Password untuk divalidasi
   * @returns {Object} Object berisi status validasi dan pesan error
   */
  static validatePasswordStrength(password) {
    const errors = [];
    
    // Minimal 8 karakter
    if (password.length < 8) {
      errors.push('Password minimal 8 karakter');
    }
    
    // Maksimal 128 karakter
    if (password.length > 128) {
      errors.push('Password maksimal 128 karakter');
    }
    
    // Harus mengandung huruf besar
    if (!/[A-Z]/.test(password)) {
      errors.push('Password harus mengandung minimal 1 huruf besar');
    }
    
    // Harus mengandung huruf kecil
    if (!/[a-z]/.test(password)) {
      errors.push('Password harus mengandung minimal 1 huruf kecil');
    }
    
    // Harus mengandung angka
    if (!/\d/.test(password)) {
      errors.push('Password harus mengandung minimal 1 angka');
    }
    
    // Harus mengandung karakter khusus
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password harus mengandung minimal 1 karakter khusus');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Generate random password
   * @param {number} length - Panjang password (default: 12)
   * @returns {string} Random password
   */
  static generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // Pastikan password mengandung minimal 1 dari setiap kategori
    const categories = [
      'abcdefghijklmnopqrstuvwxyz', // huruf kecil
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ', // huruf besar
      '0123456789', // angka
      '!@#$%^&*()_+-=[]{}|;:,.<>?' // karakter khusus
    ];
    
    // Tambahkan 1 karakter dari setiap kategori
    categories.forEach(category => {
      password += category.charAt(Math.floor(Math.random() * category.length));
    });
    
    // Tambahkan karakter random untuk mencapai panjang yang diinginkan
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

module.exports = PasswordUtils;