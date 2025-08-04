# Posyandu Lansia Backend API 🏥⚡

**Backend API untuk Aplikasi Mobile Posyandu Lansia** - RESTful API server yang menyediakan layanan backend untuk sistem informasi kesehatan lansia dengan keamanan tinggi dan performa optimal.

## 📋 Deskripsi Proyek

Backend API ini dibangun menggunakan Node.js dengan Express.js framework untuk melayani aplikasi mobile Posyandu Lansia. Server ini menyediakan endpoint lengkap untuk manajemen data lansia, pemeriksaan kesehatan, autentikasi pengguna, dan sistem keamanan berlapis.

### 🎯 Fitur Utama
- **RESTful API** dengan dokumentasi lengkap
- **JWT Authentication** dengan refresh token
- **Role-based Authorization** (Admin & Health Worker)
- **File Upload** untuk foto profil pasien
- **QR Code Generation** untuk identifikasi unik
- **Data Encryption** untuk keamanan informasi sensitif
- **Comprehensive Logging** dengan Winston
- **Rate Limiting** untuk mencegah abuse
- **Input Validation** dengan Joi schema
- **Error Handling** yang konsisten

## 🛠 Teknologi yang Digunakan

### Core Framework
- **Node.js** `>=18.0.0` - Runtime environment
- **Express.js** `^4.18.2` - Web framework
- **TypeScript** `^5.3.3` - Type safety

### Database & ORM
- **MySQL2** `^3.6.5` - Database driver
- **Connection Pooling** - Optimasi koneksi database

### Authentication & Security
- **JSON Web Token** `^9.0.2` - JWT authentication
- **bcryptjs** `^2.4.3` - Password hashing
- **Helmet** `^7.1.0` - Security headers
- **CORS** `^2.8.5` - Cross-origin resource sharing
- **Rate Limiter Flexible** `^4.0.1` - Rate limiting

### File Handling
- **Multer** `^1.4.5-lts.1` - File upload middleware
- **QRCode** `^1.5.4` - QR code generation
- **UUID** `^11.1.0` - Unique identifier generation

### Validation & Logging
- **Joi** `^17.11.0` - Schema validation
- **Winston** `^3.11.0` - Logging system

### Development & Testing
- **Jest** `^29.7.0` - Testing framework
- **Supertest** `^7.1.4` - HTTP testing
- **Nodemon** `^3.0.2` - Development server
- **ESLint** `^8.56.0` - Code linting

### Performance & Utilities
- **Compression** `^1.7.4` - Response compression
- **dotenv** `^16.3.1` - Environment variables

## 🚀 Instalasi dan Setup

### Prasyarat
- Node.js (versi 18 atau lebih baru)
- MySQL Server (versi 8.0 atau lebih baru)
- npm atau yarn

### 1. Clone Repository
```bash
git clone <repository-url>
cd lansia-mobile/server
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
```bash
# Copy environment template
cp .env.example .env

# Edit .env file dengan konfigurasi Anda
nano .env
```

### 4. Konfigurasi Environment (.env)
```env
# Server Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=posyandu_lansia
DB_CONNECTION_LIMIT=10

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here
JWT_REFRESH_EXPIRES_IN=7d

# File Upload Configuration
UPLOAD_PATH=uploads
MAX_FILE_SIZE=5242880

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key_here

# CORS Configuration
CORS_ORIGIN=http://localhost:8081
```

### 5. Setup Database
```bash
# Login ke MySQL
mysql -u root -p

# Jalankan setup script
source database/setup.sql

# Atau manual:
CREATE DATABASE posyandu_lansia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE posyandu_lansia;
SOURCE database/migrations/001_initial_schema.sql;
```

### 6. Build dan Start Server
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## 📁 Struktur Proyek

```
server/
├── src/
│   ├── config/
│   │   └── database.ts              # Konfigurasi database MySQL
│   ├── middleware/
│   │   ├── auth.ts                  # Authentication & authorization
│   │   └── errorHandler.ts          # Global error handling
│   ├── routes/
│   │   ├── auth.ts                  # Authentication endpoints
│   │   ├── patients.ts              # Patient management
│   │   ├── health-records.ts        # Health examination records
│   │   └── prescriptions.ts         # Prescription & referral
│   ├── utils/
│   │   └── logger.ts                # Winston logging configuration
│   ├── tests/
│   │   ├── setup.ts                 # Test configuration
│   │   ├── auth.test.ts             # Authentication tests
│   │   └── server.test.ts           # Server integration tests
│   └── index.ts                     # Main server entry point
├── logs/                            # Log files directory
├── uploads/                         # File upload directory
│   └── patients/                    # Patient photos
├── database/
│   ├── setup.sql                    # Database setup script
│   └── migrations/
│       └── 001_initial_schema.sql   # Initial database schema
├── .env.example                     # Environment template
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── jest.config.js                   # Jest testing configuration
└── README.md                        # This file
```

## 🔌 API Endpoints

### 🔐 Authentication (`/api/auth`)

#### POST `/api/auth/login`
Login pengguna dengan username/email dan password.

**Request Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@posyandu.com",
      "fullName": "Administrator",
      "role": "admin"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresAt": 1640995200000
    }
  }
}
```

#### POST `/api/auth/register`
Registrasi pengguna baru (hanya untuk admin).

#### POST `/api/auth/refresh`
Refresh access token menggunakan refresh token.

#### POST `/api/auth/logout`
Logout pengguna.

### 👥 Patient Management (`/api/patients`)

#### POST `/api/patients`
Registrasi lansia baru dengan upload foto.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Form Data:**
```
fullName: "Siti Aminah"
dateOfBirth: "1950-05-15"
address: "Jl. Merdeka No. 123, Jakarta"
phoneNumber: "081234567890"
photo: [file]
```

**Response:**
```json
{
  "success": true,
  "message": "Lansia berhasil didaftarkan",
  "data": {
    "patient": {
      "id": 1,
      "qrCode": "LANSIA-2024-A1B2C3D4",
      "fullName": "Siti Aminah",
      "dateOfBirth": "1950-05-15",
      "address": "Jl. Merdeka No. 123, Jakarta",
      "phoneNumber": "081234567890",
      "photoUrl": "/uploads/patients/patient-1640995200000-123456789.jpg"
    },
    "qrCodeImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

#### GET `/api/patients/:qrCode`
Ambil data lansia berdasarkan QR Code.

#### GET `/api/patients/id/:id`
Ambil data lansia berdasarkan ID.

#### PUT `/api/patients/:id`
Update data lansia.

#### GET `/api/patients/:id/history`
Ambil riwayat kesehatan lansia dengan pagination.

### 🏥 Health Records (`/api/health-records`)

#### POST `/api/health-records`
Buat record pemeriksaan kesehatan baru.

**Request Body:**
```json
{
  "patientId": 1,
  "height": 160,
  "weight": 65,
  "systolicBp": 120,
  "diastolicBp": 80,
  "uricAcid": 5.5,
  "bloodSugar": 95,
  "cholesterol": 180,
  "notes": "Kondisi kesehatan baik"
}
```

#### GET `/api/health-records/:patientId`
Ambil riwayat pemeriksaan kesehatan pasien.

#### GET `/api/health-records/:patientId/trends`
Ambil data tren kesehatan untuk grafik.

### 💊 Prescriptions (`/api/prescriptions`)

#### POST `/api/prescriptions`
Buat resep digital.

**Request Body:**
```json
{
  "patientId": 1,
  "healthRecordId": 1,
  "items": [
    {
      "medicineName": "Paracetamol",
      "dosage": "500mg",
      "frequency": "3x sehari",
      "specialInstructions": "Diminum setelah makan"
    }
  ],
  "notes": "Kontrol kembali dalam 1 minggu"
}
```

#### POST `/api/prescriptions/:id/pdf`
Generate PDF resep.

#### POST `/api/referrals`
Buat surat rujukan.

## 🔒 Keamanan

### Authentication & Authorization
- **JWT Tokens** dengan expiry time
- **Refresh Token** untuk perpanjangan sesi
- **Role-based Access Control** (RBAC)
- **Password Hashing** dengan bcrypt (12 rounds)

### Data Protection
- **Input Validation** dengan Joi schemas
- **SQL Injection Prevention** dengan prepared statements
- **File Upload Security** dengan type validation
- **Rate Limiting** untuk mencegah brute force
- **CORS Configuration** untuk cross-origin security

### Headers Security
```javascript
// Helmet.js security headers
app.use(helmet({
  contentSecurityPolicy: false, // Configured separately
  crossOriginEmbedderPolicy: false
}));
```

### Rate Limiting
```javascript
// Auth endpoints rate limiting
const authRateLimit = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000 // 15 minutes
};
```

## 📊 Logging & Monitoring

### Winston Logger Configuration
```javascript
// Log levels: error, warn, info, debug
logger.info('Server started', { port: 3000 });
logger.error('Database connection failed', { error });
logger.warn('Unauthorized access attempt', { userId, ip });
```

### Log Files
- **`logs/error.log`** - Error level logs
- **`logs/combined.log`** - All logs
- **Console output** - Development mode

### Log Rotation
- Maximum file size: 5MB
- Maximum files: 5
- Automatic rotation and cleanup

## 🧪 Testing

### Test Configuration
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure
```
src/tests/
├── setup.ts           # Test environment setup
├── auth.test.ts       # Authentication tests
├── patients.test.ts   # Patient management tests
├── health-records.test.ts # Health records tests
└── server.test.ts     # Integration tests
```

### Test Database
- Separate test database: `posyandu_lansia_test`
- Automatic cleanup after tests
- Mock data generation

## 📈 Performance

### Database Optimization
- **Connection Pooling** dengan MySQL2
- **Prepared Statements** untuk query optimization
- **Indexing** pada kolom yang sering diquery
- **Query Optimization** dengan EXPLAIN

### Response Optimization
- **Compression** middleware untuk response
- **JSON parsing** dengan size limits
- **File upload** dengan size restrictions
- **Pagination** untuk large datasets

### Memory Management
- **Connection pool limits**
- **File cleanup** after processing
- **Log rotation** untuk mencegah disk full

## 🔧 Development

### Scripts Available
```bash
npm run dev          # Start development server with nodemon
npm run build        # Build TypeScript to JavaScript
npm start           # Start production server
npm test            # Run tests
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
```

### Development Workflow
1. **Code Changes** - Edit TypeScript files
2. **Auto Reload** - Nodemon restarts server
3. **Type Checking** - TypeScript compilation
4. **Linting** - ESLint validation
5. **Testing** - Jest test execution

### Code Quality
- **TypeScript** untuk type safety
- **ESLint** dengan TypeScript rules
- **Prettier** untuk code formatting
- **Husky** untuk pre-commit hooks (optional)

## 🚀 Deployment

### Production Build
```bash
# Build aplikasi
npm run build

# Start production server
NODE_ENV=production npm start
```

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn

# Database production config
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-secure-password

# Strong JWT secrets
JWT_SECRET=your-very-secure-jwt-secret-key
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-key
```

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

### Process Management
```bash
# Using PM2 for production
npm install -g pm2
pm2 start dist/index.js --name "posyandu-api"
pm2 startup
pm2 save
```

## 📋 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'health_worker') DEFAULT 'health_worker',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Patients Table
```sql
CREATE TABLE patients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  qr_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT NOT NULL,
  phone_number VARCHAR(20),
  photo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Health Records Table
```sql
CREATE TABLE health_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  examination_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  bmi DECIMAL(4,2),
  systolic_bp INT,
  diastolic_bp INT,
  uric_acid DECIMAL(4,2),
  blood_sugar DECIMAL(5,2),
  cholesterol DECIMAL(5,2),
  examined_by INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (examined_by) REFERENCES users(id)
);
```

## 🔍 Troubleshooting

### Common Issues

#### Database Connection Error
```bash
# Check MySQL service
sudo systemctl status mysql

# Check connection parameters
mysql -h localhost -u root -p

# Verify database exists
SHOW DATABASES;
```

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### File Upload Issues
```bash
# Check upload directory permissions
ls -la uploads/
chmod 755 uploads/
chown -R node:node uploads/
```

#### JWT Token Issues
```bash
# Verify JWT secret is set
echo $JWT_SECRET

# Check token expiry
# Use jwt.io to decode and verify tokens
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check logs
tail -f logs/combined.log
```

## 📞 API Documentation

### Health Check
```bash
GET /health
```

### API Info
```bash
GET /api
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error message in Indonesian",
  "error": "Technical error details"
}
```

### Success Response Format
```json
{
  "success": true,
  "message": "Success message in Indonesian",
  "data": {
    // Response data
  }
}
```

## 🤝 Contributing

### Development Guidelines
1. **Fork** repository
2. **Create feature branch** dari main
3. **Write tests** untuk fitur baru
4. **Follow coding standards** (ESLint + TypeScript)
5. **Update documentation** jika diperlukan
6. **Submit pull request** dengan deskripsi lengkap

### Code Standards
- **TypeScript** untuk semua kode baru
- **Camel case** untuk variabel dan fungsi
- **Pascal case** untuk classes dan interfaces
- **Kebab case** untuk file names
- **JSDoc comments** untuk public functions

## 📄 License

Proyek ini dikembangkan untuk keperluan Posyandu Lansia dengan fokus pada pelayanan kesehatan masyarakat.

---

**Dikembangkan dengan ❤️ untuk kesehatan lansia Indonesia**

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [JWT.io](https://jwt.io/) - JWT token debugger
- [Winston Logging](https://github.com/winstonjs/winston)
- [Joi Validation](https://joi.dev/api/)