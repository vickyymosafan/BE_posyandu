#!/usr/bin/env node

/**
 * Quick server status checker
 */

const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

async function checkAllEndpoints() {
  console.log('🔍 Checking all API endpoints...\n');
  
  const endpoints = [
    { method: 'GET', path: '/health', description: 'Health Check', auth: false },
    { method: 'POST', path: '/auth/login', description: 'Authentication Login', auth: false },
    { method: 'GET', path: '/auth/verify', description: 'Token Verification', auth: true },
    { method: 'GET', path: '/pasien', description: 'Get All Patients', auth: true },
    { method: 'POST', path: '/pasien', description: 'Create Patient', auth: true },
    { method: 'GET', path: '/pasien/cari', description: 'Search Patients', auth: true },
    { method: 'POST', path: '/barcode/scan', description: 'Scan Barcode', auth: true },
    { method: 'GET', path: '/pemeriksaan', description: 'Get Examinations', auth: true },
    { method: 'POST', path: '/pemeriksaan', description: 'Create Examination', auth: true },
    { method: 'GET', path: '/tes-lanjutan', description: 'Get Advanced Tests', auth: true },
    { method: 'POST', path: '/tes-lanjutan', description: 'Create Advanced Test', auth: true },
    { method: 'GET', path: '/penilaian', description: 'Get Assessments', auth: true },
    { method: 'POST', path: '/penilaian', description: 'Create Assessment', auth: true },
    { method: 'GET', path: '/pengobatan', description: 'Get Treatments', auth: true },
    { method: 'POST', path: '/pengobatan', description: 'Create Treatment', auth: true },
    { method: 'GET', path: '/rujukan', description: 'Get Referrals', auth: true },
    { method: 'POST', path: '/rujukan', description: 'Create Referral', auth: true },
    { method: 'GET', path: '/dashboard/statistik', description: 'Dashboard Statistics', auth: true },
    { method: 'GET', path: '/dashboard/aktivitas-terbaru', description: 'Recent Activities', auth: true },
    { method: 'GET', path: '/dashboard/tindak-lanjut-tertunda', description: 'Pending Follow-ups', auth: true }
  ];
  
  let available = 0;
  let unavailable = 0;
  
  for (const endpoint of endpoints) {
    try {
      const url = `${BASE_URL}${endpoint.path}`;
      
      // For endpoints that require auth, we expect 401 (unauthorized)
      // For public endpoints, we expect 200 or other valid responses
      const response = await axios({
        method: endpoint.method,
        url: url,
        timeout: 3000,
        validateStatus: () => true // Don't throw on any status code
      });
      
      let status = '❌ UNAVAILABLE';
      let statusCode = response.status;
      
      if (endpoint.auth) {
        // For auth-required endpoints, 401 means the endpoint exists
        if (statusCode === 401) {
          status = '✅ AVAILABLE (Auth Required)';
          available++;
        } else if (statusCode === 200) {
          status = '✅ AVAILABLE';
          available++;
        } else {
          unavailable++;
        }
      } else {
        // For public endpoints, 200 is expected
        if (statusCode === 200) {
          status = '✅ AVAILABLE';
          available++;
        } else {
          unavailable++;
        }
      }
      
      console.log(`${status} - ${endpoint.method} ${endpoint.path} (${statusCode}) - ${endpoint.description}`);
      
    } catch (error) {
      console.log(`❌ UNAVAILABLE - ${endpoint.method} ${endpoint.path} - ${endpoint.description} (${error.code || error.message})`);
      unavailable++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Available: ${available}`);
  console.log(`❌ Unavailable: ${unavailable}`);
  console.log(`📈 Availability: ${((available / endpoints.length) * 100).toFixed(1)}%`);
  
  if (available === endpoints.length) {
    console.log('\n🎉 All endpoints are available!');
    return true;
  } else {
    console.log('\n⚠️  Some endpoints are not available. Check server status.');
    return false;
  }
}

// Run the check
checkAllEndpoints().catch(error => {
  console.error('❌ Endpoint check failed:', error.message);
  process.exit(1);
});