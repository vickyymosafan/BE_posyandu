require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 5000;

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

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100, // batasi setiap IP ke 100 permintaan per windowMs
  message: 'Terlalu banyak permintaan, coba lagi nanti'
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

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

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Posyandu Management System API is running',
    timestamp: new Date().toISOString()
  });
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

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;