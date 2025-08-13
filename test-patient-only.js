const { testAuthentication, testPatientManagement } = require('./test-all-apis');

async function runPatientTest() {
  try {
    console.log('Running patient test only...\n');
    
    // First authenticate
    const authResult = await testAuthentication();
    console.log('Auth result:', authResult);
    
    if (authResult) {
      console.log('\nRunning patient management test...');
      const patientResult = await testPatientManagement();
      console.log('Patient result:', patientResult);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runPatientTest();