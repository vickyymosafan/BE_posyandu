const request = require('supertest');
const app = require('../server');
const { executeQuery } = require('../utils/database');
const PasswordUtils = require('../utils/password');

describe('Authentication System', () => {
  let testAdminId;
  
  beforeAll(async () => {
    // Setup test admin
    const hashedPassword = await PasswordUtils.hashPassword('TestPassword123!');
    const result = await executeQuery(
      `INSERT INTO admin (nama_pengguna, hash_kata_sandi, nama_lengkap, email, aktif) 
       VALUES (?, ?, ?, ?, ?)`,
      ['testadmin', hashedPassword, 'Test Admin', 'test@posyandu.com', true]
    );
    testAdminId = result.insertId;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAdminId) {
      await executeQuery('DELETE FROM log_akses WHERE id_admin = ?', [testAdminId]);
      await executeQuery('DELETE FROM admin WHERE id = ?', [testAdminId]);
    }
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          nama_pengguna: 'testadmin',
          kata_sandi: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data.admin.nama_pengguna).toBe('testadmin');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          nama_pengguna: 'testadmin',
          kata_sandi: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.sukses).toBe(false);
      expect(response.body.pesan).toContain('tidak valid');
    });

    test('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          nama_pengguna: 'testadmin'
        });

      expect(response.status).toBe(400);
      expect(response.body.sukses).toBe(false);
      expect(response.body.pesan).toContain('wajib diisi');
    });
  });

  describe('GET /api/auth/verify', () => {
    let accessToken;

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          nama_pengguna: 'testadmin',
          kata_sandi: 'TestPassword123!'
        });
      
      accessToken = loginResponse.body.data.tokens.accessToken;
    });

    test('should verify valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.data.admin.nama_pengguna).toBe('testadmin');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.sukses).toBe(false);
    });

    test('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body.sukses).toBe(false);
      expect(response.body.pesan).toContain('tidak ditemukan');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.sukses).toBe(true);
      expect(response.body.pesan).toContain('berhasil');
    });
  });
});

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    test('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });
  });

  describe('verifyPassword', () => {
    test('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      const isValid = await PasswordUtils.verifyPassword(password, hashedPassword);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await PasswordUtils.hashPassword(password);
      const isValid = await PasswordUtils.verifyPassword(wrongPassword, hashedPassword);
      
      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    test('should validate strong password', () => {
      const result = PasswordUtils.validatePasswordStrength('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject weak password', () => {
      const result = PasswordUtils.validatePasswordStrength('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});