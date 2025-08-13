const request = require('supertest');
const app = require('../server');
const { executeQuery } = require('../utils/database');

describe('Patient API Endpoints', () => {
  let authToken;
  let testPatientId;

  // Setup: Login untuk mendapatkan token
  beforeAll(async () => {
    // Create test admin first
    const { executeQuery } = require('../utils/database');
    const PasswordUtils = require('../utils/password');
    
    try {
      // Check if test admin exists
      const existingAdmin = await executeQuery(
        'SELECT id FROM admin WHERE nama_pengguna = ?',
        ['admin_test']
      );

      if (existingAdmin.length === 0) {
        // Create test admin
        const hashedPassword = await PasswordUtils.hashPassword('password123');
        await executeQuery(
          `INSERT INTO admin (nama_pengguna, hash_kata_sandi, nama_lengkap, email, aktif) 
           VALUES (?, ?, ?, ?, ?)`,
          ['admin_test', hashedPassword, 'Admin Test', 'admin_test@posyandu.com', true]
        );
      }

      // Login to get token
      const adminData = {
        nama_pengguna: 'admin_test',
        kata_sandi: 'password123'
      };

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(adminData);

      if (loginResponse.status === 200) {
        authToken = loginResponse.body.data.tokens.accessToken;
      } else {
        console.error('Login failed:', loginResponse.body);
      }
    } catch (error) {
      console.error('Setup error:', error);
    }
  });

  // Cleanup: Hapus data test setelah selesai
  afterAll(async () => {
    try {
      if (testPatientId) {
        await executeQuery('DELETE FROM pasien WHERE id = ?', [testPatientId]);
      }
      // Clean up test admin
      await executeQuery('DELETE FROM admin WHERE nama_pengguna = ?', ['admin_test']);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('POST /api/pasien', () => {
    test('should create a new patient with valid data', async () => {
      const patientData = {
        nama: 'Pasien Test',
        nik: '1234567890123456',
        nomor_kk: '1234567890123456',
        tanggal_lahir: '1950-01-01',
        nomor_hp: '081234567890',
        alamat: 'Jl. Test No. 123'
      };

      const response = await request(app)
        .post('/api/pasien')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData);

      expect(response.status).toBe(201);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data.nama).toBe(patientData.nama);
      expect(response.body.data.nik).toBe(patientData.nik);
      expect(response.body.data.id_pasien).toMatch(/^PSN\d{8}\d{4}$/);

      testPatientId = response.body.data.id;
    });

    test('should reject duplicate NIK', async () => {
      const duplicatePatientData = {
        nama: 'Pasien Duplikat',
        nik: '1234567890123456', // NIK yang sama
        nomor_kk: '1234567890123457',
        tanggal_lahir: '1951-01-01',
        nomor_hp: '081234567891'
      };

      const response = await request(app)
        .post('/api/pasien')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicatePatientData);

      expect(response.status).toBe(409);
      expect(response.body.sukses).toBe(false);
      expect(response.body.pesan).toBe('NIK sudah terdaftar');
    });

    test('should reject invalid data', async () => {
      const invalidPatientData = {
        nama: '', // nama kosong
        nik: '123', // NIK tidak valid
        nomor_kk: '1234567890123456',
        tanggal_lahir: '1950-01-01'
      };

      const response = await request(app)
        .post('/api/pasien')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPatientData);

      expect(response.status).toBe(400);
      expect(response.body.sukses).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('should reject request without authentication', async () => {
      const patientData = {
        nama: 'Pasien Test',
        nik: '1234567890123457',
        nomor_kk: '1234567890123457',
        tanggal_lahir: '1950-01-01'
      };

      const response = await request(app)
        .post('/api/pasien')
        .send(patientData);

      expect(response.status).toBe(401);
      expect(response.body.sukses).toBe(false);
    });
  });

  describe('GET /api/pasien', () => {
    test('should get all patients with pagination', async () => {
      const response = await request(app)
        .get('/api/pasien')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBe(1);
    });

    test('should search patients by name', async () => {
      const response = await request(app)
        .get('/api/pasien')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'Pasien Test' });

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('should search patients by NIK', async () => {
      const response = await request(app)
        .get('/api/pasien')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: '1234567890123456' });

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/pasien/:id', () => {
    test('should get patient by ID', async () => {
      if (!testPatientId) {
        return; // Skip jika tidak ada test patient
      }

      const response = await request(app)
        .get(`/api/pasien/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data.id).toBe(testPatientId);
      expect(response.body.data.riwayat_pemeriksaan).toBeDefined();
      expect(response.body.data.riwayat_tes).toBeDefined();
    });

    test('should return 404 for non-existent patient', async () => {
      const response = await request(app)
        .get('/api/pasien/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.sukses).toBe(false);
    });

    test('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .get('/api/pasien/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.sukses).toBe(false);
    });
  });

  describe('PUT /api/pasien/:id', () => {
    test('should update patient data', async () => {
      if (!testPatientId) {
        return; // Skip jika tidak ada test patient
      }

      const updateData = {
        nama: 'Pasien Test Updated',
        nik: '1234567890123456',
        nomor_kk: '1234567890123456',
        tanggal_lahir: '1950-01-01',
        nomor_hp: '081234567899',
        alamat: 'Jl. Test Updated No. 456'
      };

      const response = await request(app)
        .put(`/api/pasien/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data.nama).toBe(updateData.nama);
      expect(response.body.data.nomor_hp).toBe(updateData.nomor_hp);
    });

    test('should return 404 for non-existent patient', async () => {
      const updateData = {
        nama: 'Pasien Test',
        nik: '1234567890123458',
        nomor_kk: '1234567890123458',
        tanggal_lahir: '1950-01-01'
      };

      const response = await request(app)
        .put('/api/pasien/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.sukses).toBe(false);
    });
  });

  describe('GET /api/pasien/search/barcode', () => {
    test('should find patient by patient ID', async () => {
      if (!testPatientId) {
        return; // Skip jika tidak ada test patient
      }

      // Ambil ID pasien dari database
      const patientData = await executeQuery(
        'SELECT id_pasien FROM pasien WHERE id = ?',
        [testPatientId]
      );

      if (patientData.length === 0) {
        return;
      }

      const response = await request(app)
        .get('/api/pasien/search/barcode')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ code: patientData[0].id_pasien });

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data.id_pasien).toBe(patientData[0].id_pasien);
    });

    test('should return 404 for non-existent patient ID', async () => {
      const response = await request(app)
        .get('/api/pasien/search/barcode')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ code: 'PSN999999999999' });

      expect(response.status).toBe(404);
      expect(response.body.sukses).toBe(false);
    });

    test('should return 400 for missing code', async () => {
      const response = await request(app)
        .get('/api/pasien/search/barcode')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.sukses).toBe(false);
    });
  });

  describe('DELETE /api/pasien/:id', () => {
    test('should reject delete request for data security', async () => {
      if (!testPatientId) {
        return; // Skip jika tidak ada test patient
      }

      const response = await request(app)
        .delete(`/api/pasien/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.sukses).toBe(false);
      expect(response.body.pesan).toContain('tidak diizinkan');
    });
  });
});