const { testAuthentication, testPatientManagement, testPhysicalExamination, testHealthAssessment } = require('./test-all-apis');

async function runExamAssessmentTest() {
  try {
    console.log('Running examination and assessment test...\n');
    
    // First authenticate
    const authResult = await testAuthentication();
    console.log('Auth result:', authResult);
    
    if (authResult) {
      console.log('\nRunning patient management test...');
      const patientResult = await testPatientManagement();
      console.log('Patient result:', patientResult);
      
      if (patientResult) {
        console.log('\nRunning physical examination test...');
        const examResult = await testPhysicalExamination();
        console.log('Examination result:', examResult);
        
        console.log('\nRunning health assessment test...');
        const assessmentResult = await testHealthAssessment();
        console.log('Assessment result:', assessmentResult);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runExamAssessmentTest();