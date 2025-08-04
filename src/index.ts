import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST before any other imports
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createConnection } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import patientRoutes from './routes/patients';
import healthRecordRoutes from './routes/health-records';
import prescriptionRoutes from './routes/prescriptions';


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (_, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Posyandu Lansia API is running',
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/health-records', healthRecordRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

app.get('/api', (_, res) => {
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

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (_, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await createConnection();
        logger.info('Database connection established');

        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
            logger.info(`Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;