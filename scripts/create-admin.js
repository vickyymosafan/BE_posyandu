require('dotenv').config();
const { executeQuery } = require('../utils/database');
const PasswordUtils = require('../utils/password');

/**
 * Script untuk membuat admin default
 */
async function createDefaultAdmin() {
  try {
    console.log('Membuat admin default...');

    // Data admin default
    const adminData = {
      nama_pengguna: 'admin',
      kata_sandi: 'admin123',
      nama_lengkap: 'Administrator Posyandu',
      email: 'admin@posyandu.com'
    };

    // Cek apakah admin sudah ada
    const existingAdmin = await executeQuery(
      'SELECT id FROM admin WHERE nama_pengguna = ?',
      [adminData.nama_pengguna]
    );

    if (existingAdmin.length > 0) {
      console.log('Admin dengan nama pengguna "admin" sudah ada.');
      return;
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hashPassword(adminData.kata_sandi);

    // Insert admin ke database
    const result = await executeQuery(
      `INSERT INTO admin (nama_pengguna, hash_kata_sandi, nama_lengkap, email, aktif) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        adminData.nama_pengguna,
        hashedPassword,
        adminData.nama_lengkap,
        adminData.email,
        true
      ]
    );

    console.log('Admin default berhasil dibuat:');
    console.log(`ID: ${result.insertId}`);
    console.log(`Nama Pengguna: ${adminData.nama_pengguna}`);
    console.log(`Kata Sandi: ${adminData.kata_sandi}`);
    console.log(`Nama Lengkap: ${adminData.nama_lengkap}`);
    console.log(`Email: ${adminData.email}`);
    console.log('\nSilakan login menggunakan kredensial di atas.');

  } catch (error) {
    console.error('Error membuat admin default:', error);
  } finally {
    process.exit(0);
  }
}

// Jalankan script jika dipanggil langsung
if (require.main === module) {
  createDefaultAdmin();
}

module.exports = createDefaultAdmin;