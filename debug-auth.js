const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
const TEST_ADMIN = {
  nama_pengguna: 'admin',
  kata_sandi: 'admin123'
};

async function debugAuth() {
  try {
    console.log('🔍 Debugging authentication flow...\n');
    
    // Step 1: Test login
    console.log('Step 1: Testing login...');
    console.log('URL:', `${BASE_URL}/auth/login`);
    console.log('Payload:', JSON.stringify(TEST_ADMIN, null, 2));
    
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, TEST_ADMIN, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Login Response:');
    console.log('Status:', loginResponse.status);
    console.log('Data:', JSON.stringify(loginResponse.data, null, 2));
    
    // Extract token
    let token = null;
    if (loginResponse.data.data && loginResponse.data.data.tokens) {
      token = loginResponse.data.data.tokens.accessToken;
      console.log('\n🔑 Token extracted:', token.substring(0, 50) + '...');
    } else {
      console.log('❌ No token found in response');
      return;
    }
    
    // Step 2: Test token verification
    console.log('\nStep 2: Testing token verification...');
    console.log('URL:', `${BASE_URL}/auth/verify`);
    console.log('Authorization header:', `Bearer ${token.substring(0, 20)}...`);
    
    const verifyResponse = await axios.get(`${BASE_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Verify Response:');
    console.log('Status:', verifyResponse.status);
    console.log('Data:', JSON.stringify(verifyResponse.data, null, 2));
    
    // Step 3: Test protected endpoint
    console.log('\nStep 3: Testing protected endpoint (patients)...');
    console.log('URL:', `${BASE_URL}/pasien`);
    
    const patientsResponse = await axios.get(`${BASE_URL}/pasien`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Patients Response:');
    console.log('Status:', patientsResponse.status);
    console.log('Data:', JSON.stringify(patientsResponse.data, null, 2));
    
    console.log('\n🎉 All authentication tests passed!');
    
  } catch (error) {
    console.error('\n❌ Authentication debug failed:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Data:', error.response?.data);
    console.error('Headers:', error.response?.headers);
    console.error('Message:', error.message);
    
    if (error.config) {
      console.error('\nRequest Config:');
      console.error('URL:', error.config.url);
      console.error('Method:', error.config.method);
      console.error('Headers:', error.config.headers);
      console.error('Data:', error.config.data);
    }
  }
}

debugAuth();