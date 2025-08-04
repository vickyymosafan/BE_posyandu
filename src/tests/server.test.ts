import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler } from '../middleware/errorHandler';

// Create a test app without database connection
const createTestApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'OK',
      message: 'Posyandu Lansia API is running',
      timestamp: new Date().toISOString()
    });
  });

  // API routes
  app.get('/api', (req, res) => {
    res.json({
      message: 'Posyandu Lansia API v1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        patients: '/api/patients',
        healthRecords: '/api/health-records',
        prescriptions: '/api/prescriptions',
        referrals: '/api/referrals'
      }
    });
  });

  app.use(errorHandler);

  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint not found'
    });
  });

  return app;
};

describe('Server Health Check', () => {
  const request = require('supertest');
  const app = createTestApp();

  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('message', 'Posyandu Lansia API is running');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('GET /api should return API information', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);

    expect(response.body).toHaveProperty('message', 'Posyandu Lansia API v1.0.0');
    expect(response.body).toHaveProperty('endpoints');
  });

  test('GET /nonexistent should return 404', async () => {
    const response = await request(app)
      .get('/nonexistent')
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Endpoint not found');
  });
});