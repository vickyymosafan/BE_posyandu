#!/usr/bin/env node

/**
 * Railway Database Migration Verification
 * 
 * Script untuk memverifikasi status migrasi database di Railway environment
 */

require('dotenv').config();
const { executeQuery, testConnection } = require('../utils/database');

class MigrationVerifier {
  constructor() {
    this.requiredTables = [
      'users',
      'patients', 
      'examinations',
      'treatments',
      'medications',
      'referrals'
    ];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️', 
      error: '❌'
    }[type] || '📋';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async checkTableExists(tableName) {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?
      `;
      
      const result = await executeQuery(query, [tableName]);
      return result[0].count > 0;
    } catch (error) {
      this.log(`Error checking table ${tableName}: ${error.message}`, 'error');
      return false;
    }
  }

  async getTableInfo(tableName) {
    try {
      const query = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_KEY,
          COLUMN_DEFAULT
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
        AND table_name = ?
        ORDER BY ORDINAL_POSITION
      `;
      
      const columns = await executeQuery(query, [tableName]);
      
      const countQuery = `SELECT COUNT(*) as row_count FROM ??`;
      const countResult = await executeQuery(countQuery, [tableName]);
      
      return {
        columns: columns.length,
        rows: countResult[0].row_count,
        structure: columns
      };
    } catch (error) {
      this.log(`Error getting table info for ${tableName}: ${error.message}`, 'error');
      return null;
    }
  }

  async verifyMigrations() {
    this.log('🔍 Memverifikasi status migrasi database...', 'info');
    
    // Test database connection first
    const connectionOk = await testConnection();
    if (!connectionOk) {
      this.log('Database connection failed', 'error');
      return false;
    }

    this.log('Database connection berhasil', 'success');
    
    let allTablesExist = true;
    const tableStatus = {};

    // Check each required table
    for (const tableName of this.requiredTables) {
      this.log(`Checking table: ${tableName}`, 'info');
      
      const exists = await this.checkTableExists(tableName);
      tableStatus[tableName] = { exists };
      
      if (exists) {
        this.log(`✓ Table ${tableName} exists`, 'success');
        
        const info = await this.getTableInfo(tableName);
        if (info) {
          tableStatus[tableName].info = info;
          this.log(`  Columns: ${info.columns}, Rows: ${info.rows}`, 'info');
        }
      } else {
        this.log(`✗ Table ${tableName} missing`, 'error');
        allTablesExist = false;
      }
    }

    // Check for admin user
    if (tableStatus.users?.exists) {
      try {
        const adminQuery = `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`;
        const adminResult = await executeQuery(adminQuery);
        const adminCount = adminResult[0].count;
        
        if (adminCount > 0) {
          this.log(`✓ Admin user exists (${adminCount} admin users)`, 'success');
        } else {
          this.log('⚠ No admin users found', 'warning');
        }
      } catch (error) {
        this.log(`Error checking admin users: ${error.message}`, 'warning');
      }
    }

    return allTablesExist;
  }

  async generateMigrationReport() {
    this.log('\n' + '='.repeat(50), 'info');
    this.log('DATABASE MIGRATION STATUS REPORT', 'info');
    this.log('='.repeat(50), 'info');
    
    const success = await this.verifyMigrations();
    
    this.log('\n' + '='.repeat(50), 'info');
    this.log(`MIGRATION STATUS: ${success ? '✅ COMPLETE' : '❌ INCOMPLETE'}`, 
             success ? 'success' : 'error');
    this.log('='.repeat(50), 'info');
    
    if (!success) {
      this.log('\nRekomendasi:', 'warning');
      this.log('1. Jalankan: npm run db:setup', 'info');
      this.log('2. Atau jalankan: npm run db:migrate', 'info');
      this.log('3. Untuk Railway: pastikan auto-migration berjalan saat startup', 'info');
    }
    
    return success;
  }

  async run() {
    try {
      const success = await this.generateMigrationReport();
      process.exit(success ? 0 : 1);
    } catch (error) {
      this.log(`Migration verification failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const verifier = new MigrationVerifier();
  verifier.run();
}

module.exports = MigrationVerifier;