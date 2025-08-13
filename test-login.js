const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login with admin credentials...');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      nama_pengguna: 'admin',
      kata_sandi: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Login successful!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.data && response.data.data.tokens) {
      console.log('Access Token:', response.data.data.tokens.accessToken.substring(0, 50) + '...');
    }
    
  } catch (error) {
    console.error('Login failed!');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\nTroubleshooting:');
      console.log('1. Check if admin user exists and is active');
      console.log('2. Verify password is correct');
      console.log('3. Check database connection');
    }
  }
}

testLogin();