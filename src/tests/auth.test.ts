import request from 'supertest';
import app from '../index';
import { getConnection, closeConnection } from '../config/database';

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    // Ensure database connection is established
    await getConnection();
  });

  afterAll(async () => {
    // Close database connection
    await closeConnection();
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login berhasil');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user.username).toBe('admin');
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Username atau password salah');
    });

    test('should reject missing username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'admin123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Username wajib diisi');
    });

    test('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password wajib diisi');
    });
  });

  describe('POST /api/auth/register', () => {
    test('should register new health worker', async () => {
      const uniqueUsername = `testuser_${Date.now()}`;
      const uniqueEmail = `test_${Date.now()}@example.com`;

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: uniqueUsername,
          email: uniqueEmail,
          password: 'testpassword123',
          fullName: 'Test Health Worker',
          role: 'health_worker'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Pengguna berhasil didaftarkan');
      expect(response.body.data.user.username).toBe(uniqueUsername);
      expect(response.body.data.user.role).toBe('health_worker');
    });

    test('should reject duplicate username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'admin', // This username already exists
          email: 'newemail@example.com',
          password: 'testpassword123',
          fullName: 'Test User',
          role: 'health_worker'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Username atau email sudah terdaftar');
    });

    test('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser2',
          email: 'invalid-email',
          password: 'testpassword123',
          fullName: 'Test User',
          role: 'health_worker'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Format email tidak valid');
    });

    test('should reject short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser3',
          email: 'test3@example.com',
          password: '123', // Too short
          fullName: 'Test User',
          role: 'health_worker'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password minimal 6 karakter');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      // Get a refresh token by logging in
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    test('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token berhasil diperbarui');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token tidak valid');
    });

    test('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token wajib disediakan');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout berhasil');
    });
  });
});