#!/usr/bin/env node

/**
 * Railway Deployment Verification Script
 * 
 * Script untuk memverifikasi Railway deployment dan konektivitas services
 * Menguji database connection, health checks, dan service communication
 */

require('dotenv').config();
const axios = require('axios');
const { testConnection, initializeConnection } = require('../utils/database');

class RailwayVerifier {
  constructor() {
    this.isRailway = !!(process.env.RAILWAY_ENVIRONMENT || 
                       process.env.RAILWAY_PROJECT_ID || 
                       process.env.DATABASE_URL);
    
    this.config = {
      projectId: process.env.RAILWAY_PROJECT_ID,
      serviceName: process.env.RAILWAY_SERVICE_NAME,
      environment: process.env.RAILWAY_ENVIRONMENT || 'production',
      backendUrl: process.env.RAILWAY_BACKEND_URL || this.constructBackendUrl(),
      frontendUrl: process.env.RAILWAY_FRONTEND_URL || this.constructFrontendUrl(),
      databaseUrl: process.env.DATABASE_URL || process.env.MYSQL_URL
    };

    this.results = {
      environment: { passed: false, details: [] },
      database: { passed: false, details: [] },
      backend: { passed: false, details: [] },
      frontend: { passed: false, details: [] },
      integration: { passed: false, details: [] }
    };
  }

  constructBackendUrl() {
    if (this.config.projectId) {
      return `https://backend-${this.config.projectId}.up.railway.app`;
    }
    return 'http://localhost:5000';
  }

  constructFrontendUrl() {
    if (this.config.projectId) {
      return `https://frontend-${this.config.projectId}.up.railway.app`;
    }
    return 'http://localhost:3000';
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🔍'
    }[type] || '📋';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async verifyEnvironment() {
    this.log('Memverifikasi Railway environment...', 'info');
    
    try {
      // Check Railway environment variables
      const requiredVars = [
        'RAILWAY_PROJECT_ID',
        'RAILWAY_SERVICE_NAME', 
        'RAILWAY_ENVIRONMENT'
      ];

      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        this.results.environment.details.push(`Missing environment variables: ${missingVars.join(', ')}`);
        this.log(`Missing Railway variables: ${missingVars.join(', ')}`, 'warning');
      }

      // Check if running in Railway
      if (!this.isRailway) {
        this.results.environment.details.push('Not running in Railway environment');
        this.log('Not detected as Railway environment', 'warning');
      } else {
        this.results.environment.details.push('Railway environment detected');
        this.log(`Railway Project: ${this.config.projectId}`, 'success');
        this.log(`Service: ${this.config.serviceName}`, 'success');
        this.log(`Environment: ${this.config.environment}`, 'success');
      }

      // Check database URL
      if (!this.config.databaseUrl) {
        this.results.environment.details.push('DATABASE_URL not configured');
        this.log('DATABASE_URL not found', 'error');
      } else {
        this.results.environment.details.push('DATABASE_URL configured');
        this.log('DATABASE_URL found', 'success');
      }

      this.results.environment.passed = missingVars.length === 0 && this.config.databaseUrl;
      
    } catch (error) {
      this.results.environment.details.push(`Environment check error: ${error.message}`);
      this.log(`Environment verification failed: ${error.message}`, 'error');
    }
  }

  async verifyDatabase() {
    this.log('Memverifikasi koneksi database...', 'info');
    
    try {
      // Test database connection
      const connectionResult = await testConnection(3, 2000);
      
      if (connectionResult) {
        this.results.database.details.push('Database connection successful');
        this.log('Database connection berhasil', 'success');
        
        // Test database initialization
        const initResult = await initializeConnection();
        if (initResult) {
          this.results.database.details.push('Database initialization successful');
          this.log('Database initialization berhasil', 'success');
        } else {
          this.results.database.details.push('Database initialization failed');
          this.log('Database initialization gagal', 'error');
        }
        
        this.results.database.passed = initResult;
      } else {
        this.results.database.details.push('Database connection failed');
        this.log('Database connection gagal', 'error');
        this.results.database.passed = false;
      }
      
    } catch (error) {
      this.results.database.details.push(`Database error: ${error.message}`);
      this.log(`Database verification failed: ${error.message}`, 'error');
      this.results.database.passed = false;
    }
  }

  async verifyBackendHealth() {
    this.log('Memverifikasi backend health check...', 'info');
    
    try {
      const healthUrl = `${this.config.backendUrl}/api/health`;
      this.log(`Testing health endpoint: ${healthUrl}`, 'debug');
      
      const response = await axios.get(healthUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Railway-Verifier/1.0'
        }
      });
      
      if (response.status === 200 && response.data.sukses) {
        this.results.backend.details.push('Health check endpoint responding');
        this.results.backend.details.push(`Response time: ${response.data.responseTime}ms`);
        this.results.backend.details.push(`Database status: ${response.data.database.status}`);
        
        this.log('Backend health check berhasil', 'success');
        this.log(`Response time: ${response.data.responseTime}ms`, 'info');
        
        this.results.backend.passed = true;
      } else {
        this.results.backend.details.push('Health check returned error status');
        this.log('Backend health check gagal - invalid response', 'error');
        this.results.backend.passed = false;
      }
      
    } catch (error) {
      this.results.backend.details.push(`Backend health check error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        this.log('Backend tidak dapat diakses - service mungkin belum running', 'error');
      } else if (error.code === 'ETIMEDOUT') {
        this.log('Backend health check timeout', 'error');
      } else {
        this.log(`Backend health check failed: ${error.message}`, 'error');
      }
      
      this.results.backend.passed = false;
    }
  }

  async verifyFrontendHealth() {
    this.log('Memverifikasi frontend accessibility...', 'info');
    
    try {
      this.log(`Testing frontend URL: ${this.config.frontendUrl}`, 'debug');
      
      const response = await axios.get(this.config.frontendUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Railway-Verifier/1.0'
        },
        maxRedirects: 5
      });
      
      if (response.status === 200) {
        this.results.frontend.details.push('Frontend accessible');
        this.results.frontend.details.push(`Status: ${response.status}`);
        
        // Check if it's a Next.js app
        const isNextJs = response.headers['x-powered-by']?.includes('Next.js') ||
                        response.data.includes('_next/static');
        
        if (isNextJs) {
          this.results.frontend.details.push('Next.js application detected');
          this.log('Frontend Next.js app berhasil diakses', 'success');
        } else {
          this.results.frontend.details.push('Frontend accessible but Next.js not detected');
          this.log('Frontend dapat diakses', 'success');
        }
        
        this.results.frontend.passed = true;
      } else {
        this.results.frontend.details.push(`Frontend returned status: ${response.status}`);
        this.log(`Frontend returned status: ${response.status}`, 'warning');
        this.results.frontend.passed = false;
      }
      
    } catch (error) {
      this.results.frontend.details.push(`Frontend access error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        this.log('Frontend tidak dapat diakses - service mungkin belum running', 'error');
      } else if (error.code === 'ETIMEDOUT') {
        this.log('Frontend access timeout', 'error');
      } else {
        this.log(`Frontend verification failed: ${error.message}`, 'error');
      }
      
      this.results.frontend.passed = false;
    }
  }

  async verifyIntegration() {
    this.log('Memverifikasi integrasi frontend-backend...', 'info');
    
    try {
      // Test API call from frontend perspective
      const apiUrl = `${this.config.backendUrl}/api/health`;
      
      const response = await axios.get(apiUrl, {
        timeout: 10000,
        headers: {
          'Origin': this.config.frontendUrl,
          'User-Agent': 'Railway-Verifier/1.0'
        }
      });
      
      if (response.status === 200) {
        this.results.integration.details.push('Frontend-backend communication successful');
        
        // Check CORS headers
        const corsHeaders = response.headers['access-control-allow-origin'];
        if (corsHeaders) {
          this.results.integration.details.push(`CORS configured: ${corsHeaders}`);
          this.log('CORS headers configured correctly', 'success');
        }
        
        this.log('Frontend-backend integration berhasil', 'success');
        this.results.integration.passed = true;
      } else {
        this.results.integration.details.push('Integration test failed');
        this.log('Integration test gagal', 'error');
        this.results.integration.passed = false;
      }
      
    } catch (error) {
      this.results.integration.details.push(`Integration error: ${error.message}`);
      this.log(`Integration verification failed: ${error.message}`, 'error');
      this.results.integration.passed = false;
    }
  }

  generateReport() {
    this.log('\n' + '='.repeat(60), 'info');
    this.log('RAILWAY DEPLOYMENT VERIFICATION REPORT', 'info');
    this.log('='.repeat(60), 'info');
    
    const sections = [
      { name: 'Environment', key: 'environment' },
      { name: 'Database', key: 'database' },
      { name: 'Backend Health', key: 'backend' },
      { name: 'Frontend Access', key: 'frontend' },
      { name: 'Integration', key: 'integration' }
    ];
    
    let overallPassed = true;
    
    sections.forEach(section => {
      const result = this.results[section.key];
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      
      this.log(`\n${section.name}: ${status}`, result.passed ? 'success' : 'error');
      
      result.details.forEach(detail => {
        this.log(`  • ${detail}`, 'info');
      });
      
      if (!result.passed) {
        overallPassed = false;
      }
    });
    
    this.log('\n' + '='.repeat(60), 'info');
    this.log(`OVERALL STATUS: ${overallPassed ? '✅ DEPLOYMENT READY' : '❌ ISSUES FOUND'}`, 
             overallPassed ? 'success' : 'error');
    this.log('='.repeat(60), 'info');
    
    if (!overallPassed) {
      this.log('\nRekomendasi troubleshooting:', 'warning');
      this.log('1. Periksa environment variables di Railway dashboard', 'info');
      this.log('2. Pastikan semua services sudah running', 'info');
      this.log('3. Cek logs di Railway dashboard untuk error details', 'info');
      this.log('4. Verifikasi database service connection', 'info');
    }
    
    return overallPassed;
  }

  async run() {
    this.log('🚂 Memulai Railway Deployment Verification...', 'info');
    this.log(`Project ID: ${this.config.projectId || 'Unknown'}`, 'info');
    this.log(`Environment: ${this.config.environment}`, 'info');
    
    try {
      await this.verifyEnvironment();
      await this.verifyDatabase();
      await this.verifyBackendHealth();
      await this.verifyFrontendHealth();
      await this.verifyIntegration();
      
      const success = this.generateReport();
      
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      this.log(`Verification failed with error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const verifier = new RailwayVerifier();
  verifier.run();
}

module.exports = RailwayVerifier;