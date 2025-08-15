#!/usr/bin/env node

/**
 * Railway Connectivity Test Script
 * 
 * Script untuk menguji konektivitas Railway services dan network
 */

require('dotenv').config();
const axios = require('axios');
const { testConnection } = require('../utils/database');

class ConnectivityTester {
  constructor() {
    this.isRailway = !!(process.env.RAILWAY_ENVIRONMENT || 
                       process.env.RAILWAY_PROJECT_ID);
    
    this.endpoints = {
      health: '/api/health',
      ready: '/api/ready',
      auth: '/api/auth/status',
      patients: '/api/pasien',
      database: '/api/database/status'
    };
    
    this.baseUrl = this.getBaseUrl();
  }

  getBaseUrl() {
    if (process.env.RAILWAY_BACKEND_URL) {
      return process.env.RAILWAY_BACKEND_URL;
    }
    
    if (this.isRailway && process.env.RAILWAY_PROJECT_ID) {
      return `https://backend-${process.env.RAILWAY_PROJECT_ID}.up.railway.app`;
    }
    
    return 'http://localhost:5000';
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔗',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      test: '🧪'
    }[type] || '🔗';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async testEndpoint(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();
    
    try {
      this.log(`Testing: ${url}`, 'test');
      
      const response = await axios({
        method: options.method || 'GET',
        url,
        timeout: options.timeout || 10000,
        headers: {
          'User-Agent': 'Railway-Connectivity-Tester/1.0',
          ...options.headers
        },
        data: options.data,
        validateStatus: () => true // Don't throw on HTTP error status
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: response.status >= 200 && response.status < 400,
        status: response.status,
        responseTime,
        data: response.data,
        headers: response.headers,
        url
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error.message,
        code: error.code,
        responseTime,
        url
      };
    }
  }

  async testDatabaseConnectivity() {
    this.log('Testing database connectivity...', 'test');
    
    try {
      const result = await testConnection(3, 2000);
      
      if (result) {
        this.log('Database connection successful', 'success');
        return { success: true, message: 'Database connection OK' };
      } else {
        this.log('Database connection failed', 'error');
        return { success: false, message: 'Database connection failed' };
      }
    } catch (error) {
      this.log(`Database test error: ${error.message}`, 'error');
      return { success: false, message: error.message };
    }
  }

  async testAllEndpoints() {
    this.log(`\n🚂 Testing Railway connectivity for: ${this.baseUrl}`, 'info');
    
    const results = {};
    
    // Test database first
    results.database = await this.testDatabaseConnectivity();
    
    // Test each endpoint
    for (const [name, path] of Object.entries(this.endpoints)) {
      this.log(`\nTesting ${name} endpoint...`, 'info');
      
      const result = await this.testEndpoint(path);
      results[name] = result;
      
      if (result.success) {
        this.log(`✓ ${name}: ${result.status} (${result.responseTime}ms)`, 'success');
        
        // Log additional info for health endpoint
        if (name === 'health' && result.data) {
          if (result.data.sukses) {
            this.log(`  Service: ${result.data.service || 'Unknown'}`, 'info');
            this.log(`  Database: ${result.data.database?.status || 'Unknown'}`, 'info');
            this.log(`  Uptime: ${result.data.uptime || 'Unknown'}`, 'info');
          }
        }
      } else {
        this.log(`✗ ${name}: ${result.error || result.status} (${result.responseTime}ms)`, 'error');
        
        if (result.code) {
          this.log(`  Error code: ${result.code}`, 'error');
        }
      }
    }
    
    return results;
  }

  async testCORSConfiguration() {
    this.log('\nTesting CORS configuration...', 'test');
    
    const frontendUrl = process.env.RAILWAY_FRONTEND_URL || 
                       (this.isRailway && process.env.RAILWAY_PROJECT_ID ? 
                        `https://frontend-${process.env.RAILWAY_PROJECT_ID}.up.railway.app` : 
                        'http://localhost:3000');
    
    const result = await this.testEndpoint('/api/health', {
      headers: {
        'Origin': frontendUrl,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    if (result.success) {
      const corsHeaders = {
        'access-control-allow-origin': result.headers['access-control-allow-origin'],
        'access-control-allow-credentials': result.headers['access-control-allow-credentials'],
        'access-control-allow-methods': result.headers['access-control-allow-methods']
      };
      
      this.log('CORS headers found:', 'success');
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (value) {
          this.log(`  ${key}: ${value}`, 'info');
        }
      });
      
      return { success: true, headers: corsHeaders };
    } else {
      this.log('CORS test failed', 'error');
      return { success: false, error: result.error };
    }
  }

  async testNetworkLatency() {
    this.log('\nTesting network latency...', 'test');
    
    const tests = [];
    const testCount = 5;
    
    for (let i = 0; i < testCount; i++) {
      const result = await this.testEndpoint('/api/health');
      if (result.success) {
        tests.push(result.responseTime);
      }
    }
    
    if (tests.length > 0) {
      const avg = tests.reduce((a, b) => a + b, 0) / tests.length;
      const min = Math.min(...tests);
      const max = Math.max(...tests);
      
      this.log(`Latency - Avg: ${avg.toFixed(2)}ms, Min: ${min}ms, Max: ${max}ms`, 'success');
      
      return { success: true, average: avg, min, max, tests };
    } else {
      this.log('Latency test failed - no successful requests', 'error');
      return { success: false };
    }
  }

  generateConnectivityReport(results) {
    this.log('\n' + '='.repeat(60), 'info');
    this.log('RAILWAY CONNECTIVITY TEST REPORT', 'info');
    this.log('='.repeat(60), 'info');
    
    this.log(`\nBase URL: ${this.baseUrl}`, 'info');
    this.log(`Railway Environment: ${this.isRailway ? 'Yes' : 'No'}`, 'info');
    this.log(`Project ID: ${process.env.RAILWAY_PROJECT_ID || 'Unknown'}`, 'info');
    
    let overallSuccess = true;
    
    // Database connectivity
    this.log(`\nDatabase: ${results.database.success ? '✅ Connected' : '❌ Failed'}`, 
             results.database.success ? 'success' : 'error');
    if (!results.database.success) {
      this.log(`  Error: ${results.database.message}`, 'error');
      overallSuccess = false;
    }
    
    // Endpoint tests
    this.log('\nEndpoint Tests:', 'info');
    Object.entries(results).forEach(([name, result]) => {
      if (name === 'database') return; // Already handled above
      
      if (result.success) {
        this.log(`  ${name}: ✅ ${result.status} (${result.responseTime}ms)`, 'success');
      } else {
        this.log(`  ${name}: ❌ ${result.error || result.status}`, 'error');
        overallSuccess = false;
      }
    });
    
    this.log('\n' + '='.repeat(60), 'info');
    this.log(`CONNECTIVITY STATUS: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`, 
             overallSuccess ? 'success' : 'error');
    this.log('='.repeat(60), 'info');
    
    return overallSuccess;
  }

  async run() {
    try {
      this.log('🔗 Starting Railway connectivity tests...', 'info');
      
      const results = await this.testAllEndpoints();
      
      // Additional tests
      const corsResult = await this.testCORSConfiguration();
      results.cors = corsResult;
      
      const latencyResult = await this.testNetworkLatency();
      results.latency = latencyResult;
      
      const success = this.generateConnectivityReport(results);
      
      if (!success) {
        this.log('\nTroubleshooting tips:', 'warning');
        this.log('1. Check if Railway services are running', 'info');
        this.log('2. Verify environment variables in Railway dashboard', 'info');
        this.log('3. Check Railway service logs for errors', 'info');
        this.log('4. Ensure database service is connected', 'info');
      }
      
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      this.log(`Connectivity test failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const tester = new ConnectivityTester();
  tester.run();
}

module.exports = ConnectivityTester;