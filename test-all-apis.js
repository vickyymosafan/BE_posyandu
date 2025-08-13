#!/usr/bin/env node

/**
 * Comprehensive API Testing Script for Posyandu Management System
 * Tests all backend API endpoints with proper authentication flow
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const TEST_ADMIN = {
  nama_pengguna: process.env.TEST_ADMIN_USERNAME || 'admin',
  kata_sandi: process.env.TEST_ADMIN_PASSWORD || 'admin123'
};

// Global variables for testing
let authToken = '';
let testPatientId = '';
let testExaminationId = '';
let testAdvancedTestId = '';
let testAssessmentId = '';
let testTreatmentId = '';
let testReferralId = '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Utility functions
const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logSuccess = (message) => log(`✅ ${message}`, 'green');
const logError = (message) => log(`❌ ${message}`, 'red');
const logInfo = (message) => log(`ℹ️  ${message}`, 'blue');
const logWarning = (message) => log(`⚠️  ${message}`, 'yellow');
const logHeader = (message) => log(`\n🔥 ${message}`, 'cyan');

// HTTP client with error handling
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Test functions
async function testHealthCheck() {
  logHeader('Testing Health Check');
  try {
    const response = await apiClient.get('/health');
    if (response.status === 200) {
      logSuccess('Health check passed');
      logInfo(`Server status: ${response.data.status}`);
      logInfo(`Message: ${response.data.message}`);
      return true;
    }
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    return false;
  }
}

async function testAuthentication() {
  logHeader('Testing Authentication System');
  
  try {
    // Test login
    logInfo('Testing login...');
    logInfo(`Login URL: ${BASE_URL}/auth/login`);
    logInfo(`Login data: ${JSON.stringify(TEST_ADMIN)}`);
    
    const loginResponse = await apiClient.post('/auth/login', TEST_ADMIN);
    
    logInfo(`Login response status: ${loginResponse.status}`);
    logInfo(`Login response data: ${JSON.stringify(loginResponse.data)}`);
    
    if (loginResponse.status === 200 && loginResponse.data.sukses) {
      authToken = loginResponse.data.data.tokens.accessToken;
      logSuccess('Login successful');
      logInfo(`Token received: ${authToken.substring(0, 20)}...`);
    } else {
      logError('Login failed - invalid response');
      return false;
    }

    // Test token verification
    logInfo('Testing token verification...');
    const verifyResponse = await apiClient.get('/auth/verify');
    
    if (verifyResponse.status === 200 && verifyResponse.data.sukses) {
      logSuccess('Token verification successful');
      logInfo(`Admin ID: ${verifyResponse.data.data.admin.id}`);
    } else {
      logError('Token verification failed');
      return false;
    }

    // Test invalid login
    logInfo('Testing invalid login...');
    try {
      await apiClient.post('/auth/login', {
        nama_pengguna: 'invalid',
        kata_sandi: 'invalid'
      });
      logError('Invalid login should have failed');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logSuccess('Invalid login properly rejected');
      } else {
        logError(`Unexpected error: ${error.message}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logError(`Authentication test failed: ${error.message}`);
    return false;
  }
}

async function testPatientManagement() {
  logHeader('Testing Patient Management System');
  
  try {
    // Test create patient
    logInfo('Testing patient creation...');
    const patientData = {
      nama: 'Test Patient ' + Date.now(),
      nik: '1234567890123' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
      nomor_kk: '1234567890123' + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
      tanggal_lahir: '1950-01-01',
      nomor_hp: '081234567890',
      alamat: 'Jl. Test No. 123'
    };

    logInfo(`Patient data: ${JSON.stringify(patientData)}`);
    
    const createResponse = await apiClient.post('/pasien', patientData);
    
    logInfo(`Create response status: ${createResponse.status}`);
    logInfo(`Create response data: ${JSON.stringify(createResponse.data)}`);
    
    if (createResponse.status === 201 && createResponse.data.sukses) {
      testPatientId = createResponse.data.data.id;
      logSuccess('Patient created successfully');
      logInfo(`Patient ID: ${testPatientId}`);
      logInfo(`Patient ID Code: ${createResponse.data.data.id_pasien}`);
    } else {
      logError('Patient creation failed');
      return false;
    }

    // Test get all patients
    logInfo('Testing get all patients...');
    const getAllResponse = await apiClient.get('/pasien');
    
    if (getAllResponse.status === 200 && getAllResponse.data.sukses) {
      logSuccess(`Retrieved ${getAllResponse.data.data.length} patients`);
    } else {
      logError('Get all patients failed');
      return false;
    }

    // Test get patient by ID
    logInfo('Testing get patient by ID...');
    const getByIdResponse = await apiClient.get(`/pasien/${testPatientId}`);
    
    if (getByIdResponse.status === 200 && getByIdResponse.data.sukses) {
      logSuccess('Get patient by ID successful');
      logInfo(`Patient name: ${getByIdResponse.data.data.nama}`);
    } else {
      logError('Get patient by ID failed');
      return false;
    }

    // Test search patients
    logInfo('Testing patient search...');
    const searchResponse = await apiClient.get(`/pasien?search=${patientData.nama.split(' ')[0]}`);
    
    if (searchResponse.status === 200 && searchResponse.data.sukses) {
      logSuccess(`Search found ${searchResponse.data.data.length} patients`);
    } else {
      logError('Patient search failed');
      return false;
    }

    // Test update patient
    logInfo('Testing patient update...');
    const updateData = {
      nama: patientData.nama,
      nik: patientData.nik,
      nomor_kk: patientData.nomor_kk,
      tanggal_lahir: patientData.tanggal_lahir,
      nomor_hp: patientData.nomor_hp,
      alamat: 'Jl. Updated Address No. 456'
    };
    
    const updateResponse = await apiClient.put(`/pasien/${testPatientId}`, updateData);
    
    if (updateResponse.status === 200 && updateResponse.data.sukses) {
      logSuccess('Patient updated successfully');
    } else {
      logError('Patient update failed');
      return false;
    }

    // Test duplicate NIK prevention
    logInfo('Testing duplicate NIK prevention...');
    try {
      await apiClient.post('/pasien', patientData);
      logError('Duplicate NIK should have been prevented');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 409) {
        logSuccess('Duplicate NIK properly prevented');
      } else {
        logError(`Unexpected error: ${error.message}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logError(`Patient management test failed: ${error.message}`);
    if (error.response) {
      logError(`Error status: ${error.response.status}`);
      logError(`Error data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function testBarcodeSystem() {
  logHeader('Testing Barcode System');
  
  try {
    if (!testPatientId) {
      logError('No test patient available for barcode testing');
      return false;
    }

    // Test barcode generation
    logInfo('Testing barcode generation...');
    logInfo(`Barcode URL: /pasien/${testPatientId}/barcode`);
    
    const barcodeResponse = await apiClient.get(`/pasien/${testPatientId}/barcode`);
    
    logInfo(`Barcode response status: ${barcodeResponse.status}`);
    logInfo(`Barcode response data: ${JSON.stringify(barcodeResponse.data)}`);
    
    if (barcodeResponse.status === 200 && barcodeResponse.data.sukses) {
      logSuccess('Barcode generated successfully');
      logInfo(`Barcode path: ${barcodeResponse.data.data.barcode_path}`);
    } else {
      logError('Barcode generation failed');
      return false;
    }

    // Test barcode scan (simulate)
    logInfo('Testing barcode scan...');
    const patientResponse = await apiClient.get(`/pasien/${testPatientId}`);
    const patientIdCode = patientResponse.data.data.id_pasien;
    
    const scanResponse = await apiClient.post('/barcode/scan', {
      barcodeData: JSON.stringify({
        type: 'patient',
        id: patientIdCode,
        timestamp: new Date().toISOString()
      })
    });
    
    if (scanResponse.status === 200 && scanResponse.data.sukses) {
      logSuccess('Barcode scan successful');
      logInfo(`Found patient: ${scanResponse.data.data.nama}`);
    } else {
      logError('Barcode scan failed');
      return false;
    }

    // Test invalid barcode scan
    logInfo('Testing invalid barcode scan...');
    try {
      await apiClient.post('/barcode/scan', {
        barcodeData: 'INVALID_BARCODE_123'
      });
      logError('Invalid barcode should have failed');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        logSuccess('Invalid barcode properly rejected');
      } else {
        logError(`Unexpected error: ${error.message}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logError(`Barcode system test failed: ${error.message}`);
    if (error.response) {
      logError(`Error status: ${error.response.status}`);
      logError(`Error data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function testPhysicalExamination() {
  logHeader('Testing Physical Examination System');
  
  try {
    if (!testPatientId) {
      logError('No test patient available for examination testing');
      return false;
    }

    // Test create physical examination
    logInfo('Testing physical examination creation...');
    const examData = {
      id_pasien: testPatientId,
      tinggi_badan: 165.5,
      berat_badan: 70.2,
      lingkar_perut: 85.0,
      tekanan_darah_sistolik: 120,
      tekanan_darah_diastolik: 80,
      catatan: 'Pemeriksaan rutin, kondisi baik'
    };

    const createResponse = await apiClient.post('/pemeriksaan', examData);
    
    if (createResponse.status === 201 && createResponse.data.sukses) {
      testExaminationId = createResponse.data.data.id;
      logSuccess('Physical examination created successfully');
      logInfo(`Examination ID: ${testExaminationId}`);
    } else {
      logError('Physical examination creation failed');
      return false;
    }

    // Test get patient examinations
    logInfo('Testing get patient examinations...');
    const getExamsResponse = await apiClient.get(`/pasien/${testPatientId}/pemeriksaan`);
    
    if (getExamsResponse.status === 200 && getExamsResponse.data.sukses) {
      logSuccess(`Retrieved ${getExamsResponse.data.data.length} examinations`);
    } else {
      logError('Get patient examinations failed');
      return false;
    }

    // Test get examination by ID
    logInfo('Testing get examination by ID...');
    logInfo(`Examination ID: ${testExaminationId}`);
    
    const getByIdResponse = await apiClient.get(`/pemeriksaan/${testExaminationId}`);
    
    logInfo(`Get examination response status: ${getByIdResponse.status}`);
    logInfo(`Get examination response data: ${JSON.stringify(getByIdResponse.data)}`);
    
    if (getByIdResponse.status === 200 && getByIdResponse.data.sukses) {
      logSuccess('Get examination by ID successful');
      logInfo(`BMI calculated: ${getByIdResponse.data.data.bmi || 'N/A'}`);
    } else {
      logError('Get examination by ID failed');
      return false;
    }

    // Test update examination
    logInfo('Testing examination update...');
    const updateData = {
      catatan: 'Updated examination notes'
    };
    
    const updateResponse = await apiClient.put(`/pemeriksaan/${testExaminationId}`, updateData);
    
    if (updateResponse.status === 200 && updateResponse.data.sukses) {
      logSuccess('Examination updated successfully');
    } else {
      logError('Examination update failed');
      return false;
    }

    // Test invalid measurement values
    logInfo('Testing invalid measurement validation...');
    try {
      await apiClient.post('/pemeriksaan', {
        id_pasien: testPatientId,
        tinggi_badan: -10, // Invalid negative height
        berat_badan: 70.2,
        tekanan_darah_sistolik: 120,
        tekanan_darah_diastolik: 80
      });
      logError('Invalid measurements should have been rejected');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        logSuccess('Invalid measurements properly rejected');
      } else {
        logError(`Unexpected error: ${error.message}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logError(`Physical examination test failed: ${error.message}`);
    if (error.response) {
      logError(`Error status: ${error.response.status}`);
      logError(`Error data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function testAdvancedTests() {
  logHeader('Testing Advanced Health Tests System');
  
  try {
    if (!testPatientId) {
      logError('No test patient available for advanced tests');
      return false;
    }

    // Test create advanced test
    logInfo('Testing advanced test creation...');
    const testData = {
      id_pasien: testPatientId,
      gula_darah: 95.5,
      catatan: 'Tes gula darah puasa'
    };

    const createResponse = await apiClient.post('/tes-lanjutan', testData);
    
    if (createResponse.status === 201 && createResponse.data.sukses) {
      testAdvancedTestId = createResponse.data.data.id;
      logSuccess('Advanced test created successfully');
      logInfo(`Test ID: ${testAdvancedTestId}`);
    } else {
      logError('Advanced test creation failed');
      return false;
    }

    // Test get patient advanced tests
    logInfo('Testing get patient advanced tests...');
    const getTestsResponse = await apiClient.get(`/pasien/${testPatientId}/tes-lanjutan`);
    
    if (getTestsResponse.status === 200 && getTestsResponse.data.sukses) {
      logSuccess(`Retrieved ${getTestsResponse.data.data.length} advanced tests`);
    } else {
      logError('Get patient advanced tests failed');
      return false;
    }

    // Test get test by ID
    logInfo('Testing get advanced test by ID...');
    const getByIdResponse = await apiClient.get(`/tes-lanjutan/${testAdvancedTestId}`);
    
    if (getByIdResponse.status === 200 && getByIdResponse.data.sukses) {
      logSuccess('Get advanced test by ID successful');
      logInfo(`Blood sugar level: ${getByIdResponse.data.data.gula_darah} mg/dL`);
    } else {
      logError('Get advanced test by ID failed');
      return false;
    }

    // Test update advanced test
    logInfo('Testing advanced test update...');
    const updateData = {
      catatan: 'Updated test notes - follow up required'
    };
    
    const updateResponse = await apiClient.put(`/tes-lanjutan/${testAdvancedTestId}`, updateData);
    
    if (updateResponse.status === 200 && updateResponse.data.sukses) {
      logSuccess('Advanced test updated successfully');
    } else {
      logError('Advanced test update failed');
      return false;
    }

    // Test invalid blood sugar values
    logInfo('Testing invalid blood sugar validation...');
    try {
      await apiClient.post('/tes-lanjutan', {
        id_pasien: testPatientId,
        gula_darah: -50 // Invalid negative value
      });
      logError('Invalid blood sugar should have been rejected');
      return false;
    } catch (error) {
      if (error.response && error.response.status === 400) {
        logSuccess('Invalid blood sugar properly rejected');
      } else {
        logError(`Unexpected error: ${error.message}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logError(`Advanced tests system test failed: ${error.message}`);
    return false;
  }
}

async function testHealthAssessment() {
  logHeader('Testing Health Assessment System');
  
  try {
    if (!testPatientId || !testExaminationId) {
      logError('No test patient or examination available for assessment testing');
      return false;
    }

    // Test create health assessment
    logInfo('Testing health assessment creation...');
    const assessmentData = {
      id_pasien: testPatientId,
      id_pemeriksaan_fisik: testExaminationId,
      id_tes_lanjutan: testAdvancedTestId,
      kategori_penilaian: 'normal',
      temuan: 'Kondisi kesehatan dalam batas normal',
      rekomendasi: 'Lanjutkan pola hidup sehat, kontrol rutin 6 bulan'
    };

    const createResponse = await apiClient.post('/penilaian', assessmentData);
    
    if (createResponse.status === 201 && createResponse.data.sukses) {
      testAssessmentId = createResponse.data.data.id;
      logSuccess('Health assessment created successfully');
      logInfo(`Assessment ID: ${testAssessmentId}`);
    } else {
      logError('Health assessment creation failed');
      return false;
    }

    // Test get patient assessments
    logInfo('Testing get patient assessments...');
    const getAssessmentsResponse = await apiClient.get(`/pasien/${testPatientId}/penilaian`);
    
    if (getAssessmentsResponse.status === 200 && getAssessmentsResponse.data.sukses) {
      logSuccess(`Retrieved ${getAssessmentsResponse.data.data.length} assessments`);
    } else {
      logError('Get patient assessments failed');
      return false;
    }

    // Test get assessment by ID
    logInfo('Testing get assessment by ID...');
    logInfo(`Assessment ID: ${testAssessmentId}`);
    
    const getByIdResponse = await apiClient.get(`/penilaian/${testAssessmentId}`);
    
    logInfo(`Get assessment response status: ${getByIdResponse.status}`);
    logInfo(`Get assessment response data: ${JSON.stringify(getByIdResponse.data)}`);
    
    if (getByIdResponse.status === 200 && getByIdResponse.data.sukses) {
      logSuccess('Get assessment by ID successful');
      logInfo(`Assessment category: ${getByIdResponse.data.data.kategori_penilaian}`);
    } else {
      logError('Get assessment by ID failed');
      return false;
    }

    // Test update assessment
    logInfo('Testing assessment update...');
    const updateData = {
      kategori_penilaian: 'normal',
      temuan: 'Kondisi kesehatan dalam batas normal',
      rekomendasi: 'Updated recommendation - monitor blood pressure'
    };
    
    const updateResponse = await apiClient.put(`/penilaian/${testAssessmentId}`, updateData);
    
    if (updateResponse.status === 200 && updateResponse.data.sukses) {
      logSuccess('Assessment updated successfully');
    } else {
      logError('Assessment update failed');
      return false;
    }

    // Test different assessment categories
    logInfo('Testing different assessment categories...');
    const categories = ['normal', 'perlu_perhatian', 'rujukan'];
    
    for (const category of categories) {
      const categoryData = {
        id_pasien: testPatientId,
        kategori_penilaian: category,
        temuan: `Test finding for ${category}`,
        rekomendasi: `Test recommendation for ${category}`
      };
      
      const categoryResponse = await apiClient.post('/penilaian', categoryData);
      
      if (categoryResponse.status === 201 && categoryResponse.data.sukses) {
        logSuccess(`Assessment category '${category}' created successfully`);
      } else {
        logError(`Assessment category '${category}' creation failed`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logError(`Health assessment test failed: ${error.message}`);
    if (error.response) {
      logError(`Error status: ${error.response.status}`);
      logError(`Error data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function testTreatmentManagement() {
  logHeader('Testing Treatment Management System');
  
  try {
    if (!testPatientId || !testAssessmentId) {
      logError('No test patient or assessment available for treatment testing');
      return false;
    }

    // Test create treatment
    logInfo('Testing treatment creation...');
    const treatmentData = {
      id_pasien: testPatientId,
      id_penilaian: testAssessmentId,
      nama_obat: 'Paracetamol',
      dosis: '500mg',
      frekuensi: '3x sehari',
      durasi: '7 hari',
      instruksi: 'Diminum setelah makan'
    };

    const createResponse = await apiClient.post('/pengobatan', treatmentData);
    
    if (createResponse.status === 201 && createResponse.data.sukses) {
      testTreatmentId = createResponse.data.data.id;
      logSuccess('Treatment created successfully');
      logInfo(`Treatment ID: ${testTreatmentId}`);
    } else {
      logError('Treatment creation failed');
      return false;
    }

    // Test get all treatments
    logInfo('Testing get all treatments...');
    const getAllResponse = await apiClient.get('/pengobatan');
    
    if (getAllResponse.status === 200 && getAllResponse.data.sukses) {
      logSuccess(`Retrieved ${getAllResponse.data.data.length} treatments`);
    } else {
      logError('Get all treatments failed');
      return false;
    }

    // Test get patient treatments
    logInfo('Testing get patient treatments...');
    const getTreatmentsResponse = await apiClient.get(`/pasien/${testPatientId}/pengobatan`);
    
    if (getTreatmentsResponse.status === 200 && getTreatmentsResponse.data.sukses) {
      logSuccess(`Retrieved ${getTreatmentsResponse.data.data.length} patient treatments`);
    } else {
      logError('Get patient treatments failed');
      return false;
    }

    // Test get treatment by ID
    logInfo('Testing get treatment by ID...');
    const getByIdResponse = await apiClient.get(`/pengobatan/${testTreatmentId}`);
    
    if (getByIdResponse.status === 200 && getByIdResponse.data.sukses) {
      logSuccess('Get treatment by ID successful');
      logInfo(`Medicine: ${getByIdResponse.data.data.nama_obat}`);
    } else {
      logError('Get treatment by ID failed');
      return false;
    }

    // Test update treatment
    logInfo('Testing treatment update...');
    const updateData = {
      instruksi: 'Updated instructions - take with plenty of water'
    };
    
    const updateResponse = await apiClient.put(`/pengobatan/${testTreatmentId}`, updateData);
    
    if (updateResponse.status === 200 && updateResponse.data.sukses) {
      logSuccess('Treatment updated successfully');
    } else {
      logError('Treatment update failed');
      return false;
    }

    return true;
  } catch (error) {
    logError(`Treatment management test failed: ${error.message}`);
    return false;
  }
}

async function testReferralManagement() {
  logHeader('Testing Referral Management System');
  
  try {
    if (!testPatientId || !testAssessmentId) {
      logError('No test patient or assessment available for referral testing');
      return false;
    }

    // Test create referral
    logInfo('Testing referral creation...');
    const referralData = {
      id_pasien: testPatientId,
      id_penilaian: testAssessmentId,
      nama_fasilitas: 'Puskesmas Kecamatan',
      alasan: 'Perlu pemeriksaan lebih lanjut untuk tekanan darah tinggi',
      status: 'menunggu'
    };

    const createResponse = await apiClient.post('/rujukan', referralData);
    
    if (createResponse.status === 201 && createResponse.data.sukses) {
      testReferralId = createResponse.data.data.id;
      logSuccess('Referral created successfully');
      logInfo(`Referral ID: ${testReferralId}`);
    } else {
      logError('Referral creation failed');
      return false;
    }

    // Test get all referrals
    logInfo('Testing get all referrals...');
    const getAllResponse = await apiClient.get('/rujukan');
    
    if (getAllResponse.status === 200 && getAllResponse.data.sukses) {
      logSuccess(`Retrieved ${getAllResponse.data.data.length} referrals`);
    } else {
      logError('Get all referrals failed');
      return false;
    }

    // Test get patient referrals
    logInfo('Testing get patient referrals...');
    const getReferralsResponse = await apiClient.get(`/pasien/${testPatientId}/rujukan`);
    
    if (getReferralsResponse.status === 200 && getReferralsResponse.data.sukses) {
      logSuccess(`Retrieved ${getReferralsResponse.data.data.length} patient referrals`);
    } else {
      logError('Get patient referrals failed');
      return false;
    }

    // Test get referral by ID
    logInfo('Testing get referral by ID...');
    const getByIdResponse = await apiClient.get(`/rujukan/${testReferralId}`);
    
    if (getByIdResponse.status === 200 && getByIdResponse.data.sukses) {
      logSuccess('Get referral by ID successful');
      logInfo(`Facility: ${getByIdResponse.data.data.nama_fasilitas}`);
    } else {
      logError('Get referral by ID failed');
      return false;
    }

    // Test update referral status
    logInfo('Testing referral status update...');
    const updateData = {
      status: 'selesai'
    };
    
    const updateResponse = await apiClient.put(`/rujukan/${testReferralId}`, updateData);
    
    if (updateResponse.status === 200 && updateResponse.data.sukses) {
      logSuccess('Referral status updated successfully');
    } else {
      logError('Referral status update failed');
      return false;
    }

    // Test different referral statuses
    logInfo('Testing different referral statuses...');
    const statuses = ['menunggu', 'selesai', 'dibatalkan'];
    
    for (const status of statuses) {
      const statusData = {
        id_pasien: testPatientId,
        nama_fasilitas: `Test Facility for ${status}`,
        alasan: `Test reason for ${status}`,
        status: status
      };
      
      const statusResponse = await apiClient.post('/rujukan', statusData);
      
      if (statusResponse.status === 201 && statusResponse.data.sukses) {
        logSuccess(`Referral with status '${status}' created successfully`);
      } else {
        logError(`Referral with status '${status}' creation failed`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logError(`Referral management test failed: ${error.message}`);
    return false;
  }
}

async function testDashboard() {
  logHeader('Testing Dashboard System');
  
  try {
    // Test dashboard statistics
    logInfo('Testing dashboard statistics...');
    const statsResponse = await apiClient.get('/dashboard/statistik');
    
    if (statsResponse.status === 200 && statsResponse.data.sukses) {
      logSuccess('Dashboard statistics retrieved successfully');
      const stats = statsResponse.data.data;
      logInfo(`Total patients: ${stats.total_pasien}`);
      logInfo(`Total examinations: ${stats.total_pemeriksaan}`);
      logInfo(`Total assessments: ${stats.total_penilaian}`);
      logInfo(`Total treatments: ${stats.total_pengobatan}`);
      logInfo(`Total referrals: ${stats.total_rujukan}`);
    } else {
      logError('Dashboard statistics failed');
      return false;
    }

    // Test recent activities
    logInfo('Testing recent activities...');
    const activitiesResponse = await apiClient.get('/dashboard/aktivitas-terbaru');
    
    if (activitiesResponse.status === 200 && activitiesResponse.data.sukses) {
      logSuccess(`Retrieved ${activitiesResponse.data.data.length} recent activities`);
    } else {
      logError('Recent activities failed');
      return false;
    }

    // Test pending follow-ups
    logInfo('Testing pending follow-ups...');
    const followUpsResponse = await apiClient.get('/dashboard/tindak-lanjut-tertunda');
    
    if (followUpsResponse.status === 200 && followUpsResponse.data.sukses) {
      logSuccess(`Retrieved ${followUpsResponse.data.data.length} pending follow-ups`);
    } else {
      logError('Pending follow-ups failed');
      return false;
    }

    return true;
  } catch (error) {
    logError(`Dashboard test failed: ${error.message}`);
    return false;
  }
}

async function testLogout() {
  logHeader('Testing Logout');
  
  try {
    const logoutResponse = await apiClient.post('/auth/logout');
    
    if (logoutResponse.status === 200 && logoutResponse.data.sukses) {
      logSuccess('Logout successful');
      authToken = ''; // Clear token
      return true;
    } else {
      logError('Logout failed');
      return false;
    }
  } catch (error) {
    logError(`Logout test failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  logHeader('🚀 Starting Comprehensive API Testing for Posyandu Management System');
  logInfo(`Base URL: ${BASE_URL}`);
  logInfo(`Test Admin: ${TEST_ADMIN.nama_pengguna}`);
  
  const testResults = [];
  
  // Define test suite
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Authentication', fn: testAuthentication },
    { name: 'Patient Management', fn: testPatientManagement },
    { name: 'Barcode System', fn: testBarcodeSystem },
    { name: 'Physical Examination', fn: testPhysicalExamination },
    { name: 'Advanced Tests', fn: testAdvancedTests },
    { name: 'Health Assessment', fn: testHealthAssessment },
    { name: 'Treatment Management', fn: testTreatmentManagement },
    { name: 'Referral Management', fn: testReferralManagement },
    { name: 'Dashboard', fn: testDashboard },
    { name: 'Logout', fn: testLogout }
  ];

  // Run tests
  for (const test of tests) {
    try {
      const result = await test.fn();
      testResults.push({ name: test.name, passed: result });
      
      if (result) {
        logSuccess(`${test.name} - PASSED`);
      } else {
        logError(`${test.name} - FAILED`);
      }
    } catch (error) {
      logError(`${test.name} - ERROR: ${error.message}`);
      testResults.push({ name: test.name, passed: false, error: error.message });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  logHeader('📊 Test Results Summary');
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  
  logInfo(`Total Tests: ${testResults.length}`);
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  }
  
  logInfo(`Success Rate: ${((passed / testResults.length) * 100).toFixed(1)}%`);
  
  // Failed tests details
  if (failed > 0) {
    logHeader('❌ Failed Tests:');
    testResults.filter(r => !r.passed).forEach(test => {
      logError(`- ${test.name}${test.error ? ': ' + test.error : ''}`);
    });
  }
  
  // Save results to file
  const reportPath = path.join(__dirname, 'test-results', `api-test-report-${Date.now()}.json`);
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    testAdmin: TEST_ADMIN.nama_pengguna,
    summary: {
      total: testResults.length,
      passed,
      failed,
      successRate: ((passed / testResults.length) * 100).toFixed(1) + '%'
    },
    results: testResults
  }, null, 2));
  
  logInfo(`Test report saved to: ${reportPath}`);
  
  if (passed === testResults.length) {
    logHeader('🎉 All tests passed! API is fully functional.');
    process.exit(0);
  } else {
    logHeader('⚠️  Some tests failed. Please check the issues above.');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    logError(`Test runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testHealthCheck,
  testAuthentication,
  testPatientManagement,
  testBarcodeSystem,
  testPhysicalExamination,
  testAdvancedTests,
  testHealthAssessment,
  testTreatmentManagement,
  testReferralManagement,
  testDashboard
};