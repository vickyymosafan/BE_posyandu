const { testAuthentication } = require('./test-all-apis');

async function runAuthTest() {
  try {
    console.log('Running authentication test only...\n');
    const result = await testAuthentication();
    console.log('\nResult:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runAuthTest();