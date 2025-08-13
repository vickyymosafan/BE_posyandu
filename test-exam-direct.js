const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
const TEST_ADMIN = {
  nama_pengguna: 'admin',
  kata_sandi: 'admin123'
};

async function testExamDirect() {
  try {
    console.log('🔍 Testing examination endpoint directly...\n');
    
    // Step 1: Login
    console.log('Step 1: Login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, TEST_ADMIN);
    const token = loginResponse.data.data.tokens.accessToken;
    console.log('✅ Login successful');
    
    // Step 2: Create a patient
    console.log('\nStep 2: Create patient...');
    const patientData = {
      nama: 'Test Patient Direct',
      nik: '1234567890123' + Date.now().toString().slice(-3),
      nomor_kk: '1234567890123' + Date.now().toString().slice(-3),
      tanggal_lahir: '1950-01-01',
      nomor_hp: '081234567890',
      alamat: 'Jl. Test Direct'
    };
    
    const patientResponse = await axios.post(`${BASE_URL}/pasien`, patientData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const patientId = patientResponse.data.data.id;
    console.log('✅ Patient created, ID:', patientId);
    
    // Step 3: Create examination
    console.log('\nStep 3: Create examination...');
    const examData = {
      id_pasien: patientId,
      tinggi_badan: 165.5,
      berat_badan: 70.2,
      lingkar_perut: 85.0,
      tekanan_darah_sistolik: 120,
      tekanan_darah_diastolik: 80,
      catatan: 'Test examination'
    };
    
    const examResponse = await axios.post(`${BASE_URL}/pemeriksaan`, examData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const examId = examResponse.data.data.id;
    console.log('✅ Examination created, ID:', examId);
    
    // Step 4: Get examination by ID
    console.log('\nStep 4: Get examination by ID...');
    console.log('URL:', `${BASE_URL}/pemeriksaan/${examId}`);
    
    const getExamResponse = await axios.get(`${BASE_URL}/pemeriksaan/${examId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('✅ Get examination successful');
    console.log('Response:', JSON.stringify(getExamResponse.data, null, 2));
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
  }
}

testExamDirect();