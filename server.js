require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Railway environment detection
const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || 
                   process.env.RAILWAY_PROJECT_ID || 
                   process.env.DATABASE_URL);

// Auto-migration for Railway deployment
if (isRailway && process.env.NODE_ENV === 'production') {
  const DatabaseSetup = require('./database/setup');
  const setup = new DatabaseSetup();
  
  // Run auto-migration on startup (non-blocking)
  setup.autoMigrate().then(success => {
    if (success) {
      console.log('✓ Railway auto-migration completed successfully');
    } else {
      console.warn('⚠ Railway auto-migration failed - manual intervention may be needed');
    }
  }).catch(error => {
    console.error('✗ Railway auto-migration error:', error.message);
  });
}

// Middleware keamanan
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration with Railway domain support
const getAllowedOrigins = () => {
  const origins = [];
  
  // Development origin
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Railway frontend domains (multiple formats)
  if (process.env.RAILWAY_FRONTEND_URL) {
    origins.push(process.env.RAILWAY_FRONTEND_URL);
  }
  
  // Auto-detect Railway frontend domain from environment
  if (isRailway) {
    // Railway typically provides these patterns
    const projectId = process.env.RAILWAY_PROJECT_ID;
    const serviceName = process.env.RAILWAY_SERVICE_NAME || 'frontend';
    
    if (projectId) {
      origins.push(`https://${serviceName}-${projectId}.up.railway.app`);
      origins.push(`https://${projectId}.up.railway.app`);
    }
    
    // Also allow any Railway subdomain for flexibility
    origins.push(/^https:\/\/.*\.up\.railway\.app$/);
  }
  
  // Default development origins
  origins.push('http://localhost:3000');
  origins.push('http://127.0.0.1:3000');
  
  return origins;
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: isRailway ? 86400 : 0 // Cache preflight for 24h in production
}));

// Rate limiting with Railway production optimizations
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 menit default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isRailway ? 200 : 100), // Higher limit for Railway
  message: {
    sukses: false,
    pesan: 'Terlalu banyak permintaan, coba lagi nanti',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health checks and login
  skip: (req) => {
    const originalUrl = req.originalUrl || '';
    const path = req.path || '';
    
    // Skip health check
    if (originalUrl === '/api/health' || path === '/health') {
      return true;
    }
    
    // Skip login endpoint (but still apply to other auth endpoints)
    return originalUrl.startsWith('/api/auth/login') || path === '/auth/login';
  },
  // Custom key generator for Railway (handle proxy headers)
  keyGenerator: (req) => {
    // Railway may use proxy headers
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
  }
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static file serving for uploads with Railway ephemeral storage handling
const uploadPath = process.env.UPLOAD_PATH || (isRailway ? '/tmp/uploads' : './uploads');
const fs = require('fs');
const path = require('path');

// Ensure upload directory exists (important for Railway ephemeral storage)
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log(`Created upload directory: ${uploadPath}`);
}

app.use('/uploads', express.static(uploadPath, {
  maxAge: isRailway ? '1d' : '1h', // Longer cache in production
  etag: true,
  lastModified: true
}));

// Routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const barcodeRoutes = require('./routes/barcode');
const examinationRoutes = require('./routes/examinations');
const advancedTestRoutes = require('./routes/advancedTests');
const healthAssessmentRoutes = require('./routes/healthAssessments');
const treatmentRoutes = require('./routes/treatments');
const referralRoutes = require('./routes/referrals');
const dashboardRoutes = require('./routes/dashboard');

// Enhanced health check endpoint for Railway monitoring
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version || '1.0.0',
    services: {},
    system: {},
    railway: {}
  };

  try {
    // Test database connection
    const { testConnection, getPoolStats } = require('./utils/database');
    
    try {
      const dbConnected = await testConnection(1, 5000); // Quick test with 5s timeout
      if (dbConnected) {
        healthCheck.services.database = {
          status: 'connected',
          pool: getPoolStats()
        };
      } else {
        throw new Error('Database connection test failed');
      }
    } catch (dbError) {
      healthCheck.services.database = {
        status: 'disconnected',
        error: dbError.message
      };
      healthCheck.status = 'degraded';
    }

    // System information
    healthCheck.system = {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    };

    // File upload information
    try {
      const fileUploadUtils = require('./utils/fileUpload');
      const barcodeUtils = require('./utils/barcode');
      
      healthCheck.services.fileUpload = {
        status: 'available',
        config: fileUploadUtils.getUploadInfo(),
        barcode: barcodeUtils.getStorageInfo()
      };
    } catch (uploadError) {
      healthCheck.services.fileUpload = {
        status: 'error',
        error: uploadError.message
      };
    }

    // Railway-specific information
    if (isRailway) {
      healthCheck.railway = {
        projectId: process.env.RAILWAY_PROJECT_ID || 'unknown',
        serviceName: process.env.RAILWAY_SERVICE_NAME || 'unknown',
        environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
        region: process.env.RAILWAY_REGION || 'unknown'
      };
    }

    // Response time
    healthCheck.responseTime = Date.now() - startTime;

    // Set appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthCheck);

  } catch (error) {
    // Critical error - service is unhealthy
    healthCheck.status = 'unhealthy';
    healthCheck.error = error.message;
    healthCheck.responseTime = Date.now() - startTime;

    console.error('Health check failed:', error);
    res.status(503).json(healthCheck);
  }
});

// Lightweight health check for load balancers (Railway internal)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Readiness probe for Railway
app.get('/api/ready', async (req, res) => {
  try {
    const { testConnection } = require('./utils/database');
    const dbReady = await testConnection(1, 3000);
    
    if (dbReady) {
      res.status(200).json({ 
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'not ready',
        reason: 'database not available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      reason: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pasien', patientRoutes);
app.use('/api/barcode', barcodeRoutes);
app.use('/api/pemeriksaan', examinationRoutes);
app.use('/api/tes-lanjutan', advancedTestRoutes);
app.use('/api/penilaian', healthAssessmentRoutes);
app.use('/api/pengobatan', treatmentRoutes);
app.use('/api/rujukan', referralRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Error validasi
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      sukses: false,
      pesan: 'Data tidak valid',
      errors: err.errors
    });
  }

  // Error database
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      sukses: false,
      pesan: 'Data sudah ada'
    });
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      sukses: false,
      pesan: 'Token tidak valid'
    });
  }

  // Error default
  res.status(500).json({
    sukses: false,
    pesan: 'Terjadi kesalahan server'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    sukses: false,
    pesan: 'Endpoint tidak ditemukan'
  });
});

// Graceful shutdown handling for Railway
const { closePool } = require('./utils/database');

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  try {
    // Close database connections
    await closePool();
    console.log('✓ Database connections closed');
    
    // Close server
    if (server) {
      server.close(() => {
        console.log('✓ HTTP server closed');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.log('⚠ Forcing server shutdown');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('✗ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('🚀 POSYANDU MANAGEMENT SYSTEM API');
    console.log('='.repeat(50));
    console.log(`📍 Server: http://0.0.0.0:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚂 Railway: ${isRailway ? 'Yes' : 'No'}`);
    if (isRailway) {
      console.log(`📦 Project ID: ${process.env.RAILWAY_PROJECT_ID || 'Unknown'}`);
      console.log(`🔧 Service: ${process.env.RAILWAY_SERVICE_NAME || 'Unknown'}`);
    }
    console.log(`📊 Health Check: http://0.0.0.0:${PORT}/api/health`);
    console.log('='.repeat(50));
  });
  
  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
      process.exit(1);
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });
}

module.exports = app;