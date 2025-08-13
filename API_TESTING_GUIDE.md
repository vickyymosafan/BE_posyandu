# API Testing Guide - Posyandu Management System

## Overview

This guide provides comprehensive instructions for testing all API endpoints in the Posyandu Management System backend.

## Prerequisites

1. **Backend Server Running**: Make sure the backend server is running on port 5000
2. **Database Setup**: Ensure MySQL database is configured and running
3. **Admin Account**: Default admin account should be available (username: admin, password: Admin123)

## Quick Start

### 1. Check Server Status
```bash
cd backend
node check-server.js
```

### 2. Run All API Tests
```bash
cd backend
node run-api-tests.js
```

### 3. Run Individual Test Script
```bash
cd backend
node test-all-apis.js
```

## API Endpoints Overview

### Authentication Endpoints
- `POST /api/auth/login` - Admin login
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Admin logout
- `POST /api/auth/refresh` - Refresh JWT token

### Patient Management Endpoints
- `GET /api/pasien` - Get all patients (with pagination)
- `POST /api/pasien` - Create new patient
- `GET /api/pasien/:id` - Get patient by ID
- `PUT /api/pasien/:id` - Update patient
- `DELETE /api/pasien/:id` - Delete patient
- `GET /api/pasien/cari?q=search` - Search patients

### Barcode System Endpoints
- `GET /api/pasien/:id/barcode` - Generate patient barcode
- `POST /api/barcode/scan` - Scan barcode to find patient

### Physical Examination Endpoints
- `GET /api/pemeriksaan` - Get all examinations
- `POST /api/pemeriksaan` - Create new examination
- `GET /api/pemeriksaan/:id` - Get examination by ID
- `PUT /api/pemeriksaan/:id` - Update examination
- `GET /api/pasien/:id/pemeriksaan` - Get patient examinations

### Advanced Tests Endpoints
- `GET /api/tes-lanjutan` - Get all advanced tests
- `POST /api/tes-lanjutan` - Create new advanced test
- `GET /api/tes-lanjutan/:id` - Get advanced test by ID
- `PUT /api/tes-lanjutan/:id` - Update advanced test
- `GET /api/pasien/:id/tes-lanjutan` - Get patient advanced tests

### Health Assessment Endpoints
- `GET /api/penilaian` - Get all assessments
- `POST /api/penilaian` - Create new assessment
- `GET /api/penilaian/:id` - Get assessment by ID
- `PUT /api/penilaian/:id` - Update assessment
- `GET /api/pasien/:id/penilaian` - Get patient assessments

### Treatment Management Endpoints
- `GET /api/pengobatan` - Get all treatments
- `POST /api/pengobatan` - Create new treatment
- `GET /api/pengobatan/:id` - Get treatment by ID
- `PUT /api/pengobatan/:id` - Update treatment
- `GET /api/pasien/:id/pengobatan` - Get patient treatments

### Referral Management Endpoints
- `GET /api/rujukan` - Get all referrals
- `POST /api/rujukan` - Create new referral
- `GET /api/rujukan/:id` - Get referral by ID
- `PUT /api/rujukan/:id` - Update referral
- `GET /api/pasien/:id/rujukan` - Get patient referrals

### Dashboard Endpoints
- `GET /api/dashboard/statistik` - Get dashboard statistics
- `GET /api/dashboard/aktivitas-terbaru` - Get recent activities
- `GET /api/dashboard/tindak-lanjut-tertunda` - Get pending follow-ups

## Test Scenarios Covered

### 1. Authentication Flow
- ✅ Valid login with correct credentials
- ✅ Invalid login with wrong credentials
- ✅ Token verification
- ✅ Protected route access
- ✅ Logout functionality

### 2. Patient Management
- ✅ Create patient with valid data
- ✅ Prevent duplicate NIK registration
- ✅ Search patients by name, NIK, phone
- ✅ Update patient information
- ✅ Get patient by ID
- ✅ List all patients with pagination

### 3. Barcode System
- ✅ Generate unique barcode for patient
- ✅ Scan barcode to retrieve patient
- ✅ Handle invalid barcode scans
- ✅ Download barcode in different formats

### 4. Physical Examinations
- ✅ Record physical measurements
- ✅ Validate measurement ranges
- ✅ Update examination records
- ✅ Get patient examination history
- ✅ Calculate BMI automatically

### 5. Advanced Health Tests
- ✅ Record blood sugar levels
- ✅ Validate test value ranges
- ✅ Track test history
- ✅ Compare previous results

### 6. Health Assessments
- ✅ Create comprehensive assessments
- ✅ Categorize health status (normal, attention, referral)
- ✅ Link to examination and test results
- ✅ Update assessment recommendations

### 7. Treatment Management
- ✅ Prescribe medications with dosage
- ✅ Track treatment history
- ✅ Update treatment instructions
- ✅ Link treatments to assessments

### 8. Referral System
- ✅ Create referrals to healthcare facilities
- ✅ Track referral status
- ✅ Update referral outcomes
- ✅ Generate referral reports

### 9. Dashboard Analytics
- ✅ Generate system statistics
- ✅ Track recent activities
- ✅ Identify pending follow-ups
- ✅ Monitor system usage

## Sample API Calls

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nama_pengguna":"admin","kata_sandi":"Admin123"}'
```

### Create Patient
```bash
curl -X POST http://localhost:5000/api/pasien \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "nama": "John Doe",
    "nik": "1234567890123456",
    "nomor_kk": "1234567890123456",
    "tanggal_lahir": "1950-01-01",
    "nomor_hp": "081234567890"
  }'
```

### Create Physical Examination
```bash
curl -X POST http://localhost:5000/api/pemeriksaan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "id_pasien": 1,
    "tinggi_badan": 165.5,
    "berat_badan": 70.2,
    "lingkar_perut": 85.0,
    "tekanan_darah_sistolik": 120,
    "tekanan_darah_diastolik": 80
  }'
```

### Get Dashboard Statistics
```bash
curl -X GET http://localhost:5000/api/dashboard/statistik \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Environment Variables

Make sure these environment variables are set in your `.env` file:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=posyandu_db
DB_PORT=3306

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# Test Configuration (optional)
TEST_ADMIN_USERNAME=admin
TEST_ADMIN_PASSWORD=Admin123
API_BASE_URL=http://localhost:5000/api
```

## Troubleshooting

### Server Not Responding
1. Check if the server is running: `npm start` in backend directory
2. Verify the port is not in use: `netstat -an | grep 5000`
3. Check database connection in logs

### Authentication Failures
1. Verify admin account exists in database
2. Check JWT_SECRET is set in environment
3. Ensure password is correct (default: Admin123)

### Database Errors
1. Verify MySQL is running
2. Check database credentials in .env
3. Run database migrations: `node migrations/migrate.js`
4. Seed initial data: `node database/seeds.js`

### Test Failures
1. Check server logs for detailed error messages
2. Verify all required fields are provided in test data
3. Ensure database has proper permissions
4. Check network connectivity to database

## Test Reports

Test results are automatically saved to `backend/test-results/` directory with timestamps. Each report includes:

- Test execution summary
- Individual test results
- Error details for failed tests
- Performance metrics
- System information

## Manual Testing with Postman

A Postman collection is available for manual testing. Import the collection and:

1. Set environment variables (base_url, token)
2. Run the authentication request first
3. Use the returned token for subsequent requests
4. Test each endpoint systematically

## Continuous Integration

For CI/CD pipelines, use:

```bash
# Install dependencies
npm install

# Run database setup
npm run db:setup

# Run all tests
npm run test:api

# Generate coverage report
npm run test:coverage
```

## Security Testing

The test suite includes security validations:

- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ Authentication bypass attempts
- ✅ Rate limiting verification
- ✅ Input validation testing
- ✅ Authorization checks

## Performance Testing

Basic performance metrics are collected:

- Response times for each endpoint
- Database query performance
- Memory usage during tests
- Concurrent request handling

## Support

For issues or questions:

1. Check the test logs in `test-results/` directory
2. Review server logs for detailed error information
3. Verify environment configuration
4. Ensure all dependencies are installed

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Compatibility**: Node.js 16+, MySQL 8.0+