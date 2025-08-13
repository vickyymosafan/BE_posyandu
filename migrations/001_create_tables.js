const fs = require('fs').promises;
const path = require('path');
const { executeQuery, testConnection } = require('../utils/database');

/**
 * Migration: Create all database tables
 */
class CreateTablesMigration {
    constructor() {
        this.name = '001_create_tables';
        this.description = 'Create all database tables for Posyandu Management System';
    }

    /**
     * Run the migration
     */
    async up() {
        try {
            console.log(`Running migration: ${this.name}`);
            
            // Test database connection first
            const isConnected = await testConnection();
            if (!isConnected) {
                throw new Error('Database connection failed');
            }

            // Read and execute schema file
            const schemaPath = path.join(__dirname, '../database/schema.sql');
            const schemaSQL = await fs.readFile(schemaPath, 'utf8');
            
            // Split SQL statements and execute them
            const statements = schemaSQL
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            for (const statement of statements) {
                if (statement.trim()) {
                    await executeQuery(statement);
                    console.log(`Executed: ${statement.substring(0, 50)}...`);
                }
            }

            console.log(`Migration ${this.name} completed successfully`);
            return true;
        } catch (error) {
            console.error(`Migration ${this.name} failed:`, error);
            throw error;
        }
    }

    /**
     * Rollback the migration
     */
    async down() {
        try {
            console.log(`Rolling back migration: ${this.name}`);
            
            const tables = [
                'log_akses',
                'rujukan', 
                'pengobatan',
                'penilaian_kesehatan',
                'tes_lanjutan',
                'pemeriksaan_fisik',
                'pasien',
                'admin'
            ];

            for (const table of tables) {
                await executeQuery(`DROP TABLE IF EXISTS ${table}`);
                console.log(`Dropped table: ${table}`);
            }

            console.log(`Migration ${this.name} rolled back successfully`);
            return true;
        } catch (error) {
            console.error(`Rollback of ${this.name} failed:`, error);
            throw error;
        }
    }
}

module.exports = CreateTablesMigration;