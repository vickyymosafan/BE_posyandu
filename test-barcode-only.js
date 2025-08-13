const { testAuthentication, testPatientManagement, testBarcodeSystem } = require('./test-all-apis');

async function runBarcodeTest() {
  try {
    console.log('Running barcode test only...\n');
    
    // First authenticate
    const authResult = await testAuthentication();
    console.log('Auth result:', authResult);
    
    if (authResult) {
      console.log('\nRunning patient management test...');
      const patientResult = await testPatientManagement();
      console.log('Patient result:', patientResult);
      
      if (patientResult) {
        console.log('\nRunning barcode test...');
        const barcodeResult = await testBarcodeSystem();
        console.log('Barcode result:', barcodeResult);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runBarcodeTest();