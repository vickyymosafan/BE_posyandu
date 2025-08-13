const fs = require('fs').promises;
const path = require('path');
const { executeQuery, testConnection, closePool } = require('../utils/database');

/**
 * Migration Runner for Posyandu Management System
 */
class MigrationRunner {
    constructor() {
        this.migrationsPath = __dirname;
        this.migrationsTable = 'migrations';
    }

    /**
     * Initialize migrations table
     */
    async initMigrationsTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        await executeQuery(createTableSQL);
        console.log('Migrations table initialized');
    }

    /**
     * Get list of executed migrations
     */
    async getExecutedMigrations() {
        try {
            const results = await executeQuery(
                `SELECT name FROM ${this.migrationsTable} ORDER BY executed_at`
            );
            return results.map(row => row.name);
        } catch (error) {
            // If table doesn't exist, return empty array
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return [];
            }
            throw error;
        }
    }

    /**
     * Get list of available migration files
     */
    async getAvailableMigrations() {
        const files = await fs.readdir(this.migrationsPath);
        return files
            .filter(file => file.endsWith('.js') && file !== 'migrate.js')
            .sort();
    }

    /**
     * Load migration class from file
     */
    async loadMigration(filename) {
        const migrationPath = path.join(this.migrationsPath, filename);
        const MigrationClass = require(migrationPath);
        return new MigrationClass();
    }

    /**
     * Record migration as executed
     */
    async recordMigration(name) {
        await executeQuery(
            `INSERT INTO ${this.migrationsTable} (name) VALUES (?)`,
            [name]
        );
    }

    /**
     * Remove migration record
     */
    async removeMigrationRecord(name) {
        await executeQuery(
            `DELETE FROM ${this.migrationsTable} WHERE name = ?`,
            [name]
        );
    }

    /**
     * Run pending migrations
     */
    async up() {
        try {
            console.log('Starting database migrations...');
            
            // Test connection
            const isConnected = await testConnection();
            if (!isConnected) {
                throw new Error('Database connection failed');
            }

            // Initialize migrations table
            await this.initMigrationsTable();

            // Get executed and available migrations
            const executedMigrations = await this.getExecutedMigrations();
            const availableMigrations = await this.getAvailableMigrations();

            console.log(`Found ${availableMigrations.length} migration files`);
            console.log(`${executedMigrations.length} migrations already executed`);

            // Find pending migrations
            const pendingMigrations = availableMigrations.filter(
                file => !executedMigrations.includes(path.parse(file).name)
            );

            if (pendingMigrations.length === 0) {
                console.log('No pending migrations');
                return;
            }

            console.log(`Running ${pendingMigrations.length} pending migrations...`);

            // Execute pending migrations
            for (const filename of pendingMigrations) {
                const migration = await this.loadMigration(filename);
                
                console.log(`\nExecuting migration: ${migration.name}`);
                console.log(`Description: ${migration.description}`);
                
                await migration.up();
                await this.recordMigration(migration.name);
                
                console.log(`✓ Migration ${migration.name} completed`);
            }

            console.log('\n✓ All migrations completed successfully');
        } catch (error) {
            console.error('\n✗ Migration failed:', error);
            throw error;
        }
    }

    /**
     * Rollback last migration
     */
    async down() {
        try {
            console.log('Rolling back last migration...');
            
            const executedMigrations = await this.getExecutedMigrations();
            
            if (executedMigrations.length === 0) {
                console.log('No migrations to rollback');
                return;
            }

            const lastMigration = executedMigrations[executedMigrations.length - 1];
            const filename = `${lastMigration}.js`;
            
            const migration = await this.loadMigration(filename);
            
            console.log(`Rolling back migration: ${migration.name}`);
            await migration.down();
            await this.removeMigrationRecord(migration.name);
            
            console.log(`✓ Migration ${migration.name} rolled back successfully`);
        } catch (error) {
            console.error('✗ Rollback failed:', error);
            throw error;
        }
    }

    /**
     * Show migration status
     */
    async status() {
        try {
            await this.initMigrationsTable();
            
            const executedMigrations = await this.getExecutedMigrations();
            const availableMigrations = await this.getAvailableMigrations();

            console.log('\nMigration Status:');
            console.log('================');
            
            for (const filename of availableMigrations) {
                const migrationName = path.parse(filename).name;
                const status = executedMigrations.includes(migrationName) ? '✓' : '✗';
                console.log(`${status} ${migrationName}`);
            }
            
            console.log(`\nTotal: ${availableMigrations.length} migrations`);
            console.log(`Executed: ${executedMigrations.length}`);
            console.log(`Pending: ${availableMigrations.length - executedMigrations.length}`);
        } catch (error) {
            console.error('Failed to get migration status:', error);
            throw error;
        }
    }
}

// CLI interface
async function main() {
    const runner = new MigrationRunner();
    const command = process.argv[2] || 'up';

    try {
        switch (command) {
            case 'up':
                await runner.up();
                break;
            case 'down':
                await runner.down();
                break;
            case 'status':
                await runner.status();
                break;
            default:
                console.log('Usage: node migrate.js [up|down|status]');
                console.log('  up     - Run pending migrations');
                console.log('  down   - Rollback last migration');
                console.log('  status - Show migration status');
        }
    } catch (error) {
        console.error('Migration command failed:', error);
        process.exit(1);
    } finally {
        await closePool();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = MigrationRunner;