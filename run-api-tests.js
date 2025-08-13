#!/usr/bin/env node

/**
 * Simple script to run API tests with server status check
 */

const { spawn } = require('child_process');
const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

async function checkServerStatus() {
  console.log('🔍 Checking server status...');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    
    if (response.status === 200) {
      console.log('✅ Server is running and healthy');
      console.log(`📍 Server URL: ${BASE_URL}`);
      console.log(`📊 Status: ${response.data.status}`);
      console.log(`💬 Message: ${response.data.message}`);
      return true;
    } else {
      console.log('❌ Server responded but not healthy');
      return false;
    }
  } catch (error) {
    console.log('❌ Server is not responding');
    console.log(`Error: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Suggestions:');
      console.log('1. Make sure the backend server is running');
      console.log('2. Check if the server is running on the correct port (5000)');
      console.log('3. Run: cd backend && npm start');
    }
    
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting API Test Runner\n');
  
  // Check server status first
  const serverRunning = await checkServerStatus();
  
  if (!serverRunning) {
    console.log('\n❌ Cannot run tests - server is not available');
    process.exit(1);
  }
  
  console.log('\n🧪 Running comprehensive API tests...\n');
  
  // Run the test script
  const testProcess = spawn('node', ['test-all-apis.js'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  testProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n🎉 All tests completed successfully!');
    } else {
      console.log('\n⚠️  Some tests failed. Check the output above for details.');
    }
    process.exit(code);
  });
  
  testProcess.on('error', (error) => {
    console.error('❌ Failed to run tests:', error.message);
    process.exit(1);
  });
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test runner interrupted by user');
  process.exit(0);
});

// Run the test runner
runTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});