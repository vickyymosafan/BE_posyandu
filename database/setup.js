const MigrationRunner = require('../migrations/migrate');
const DatabaseSeeder = require('./seeds');
const { testConnection, initializeConnection, closePool } = require('../utils/database');

/**
 * Database Setup Script
 * Runs migrations and seeds data for initial setup
 * Enhanced with Railway deployment support
 */
class DatabaseSetup {
    constructor() {
        this.migrationRunner = new MigrationRunner();
        this.seeder = new DatabaseSeeder();
        this.isRailway = this.detectRailwayEnvironment();
    }

    /**
     * Detect if running in Railway environment
     * @returns {boolean} True if Railway environment detected
     */
    detectRailwayEnvironment() {
        return !!(process.env.DATABASE_URL || 
                 process.env.MYSQL_URL || 
                 process.env.RAILWAY_ENVIRONMENT ||
                 process.env.RAILWAY_PROJECT_ID);
    }

    /**
     * Railway-specific setup with auto-migration
     */
    async railwaySetup() {
        try {
            console.log('='.repeat(50));
            console.log('RAILWAY POSYANDU DATABASE SETUP');
            console.log('='.repeat(50));
            
            // Initialize Railway connection
            console.log('\n1. Initializing Railway database connection...');
            const isConnected = await initializeConnection();
            if (!isConnected) {
                throw new Error('Railway database connection failed. Check Railway MySQL service.');
            }
            console.log('✓ Railway MySQL connection successful');

            // Run migrations only (no seeding in production)
            console.log('\n2. Running database migrations...');
            await this.migrationRunner.up();

            // Check if we need to seed initial admin data
            const needsSeeding = await this.checkIfSeedingNeeded();
            if (needsSeeding) {
                console.log('\n3. Seeding essential data (admin users only)...');
                await this.seeder.seedAdmins();
            } else {
                console.log('\n3. Database already contains data, skipping seeding');
            }

            console.log('\n' + '='.repeat(50));
            console.log('RAILWAY DATABASE SETUP COMPLETED!');
            console.log('='.repeat(50));
            console.log('\nRailway MySQL database is ready for production use.');
            console.log('='.repeat(50));

        } catch (error) {
            console.error('\n' + '='.repeat(50));
            console.error('RAILWAY DATABASE SETUP FAILED!');
            console.error('='.repeat(50));
            console.error('Error:', error.message);
            console.error('\nRailway troubleshooting:');
            console.error('1. Verify MySQL service is running in Railway project');
            console.error('2. Check DATABASE_URL environment variable is set');
            console.error('3. Ensure Railway MySQL service is linked to this service');
            console.error('='.repeat(50));
            throw error;
        }
    }

    /**
     * Check if database needs initial seeding
     * @returns {Promise<boolean>} True if seeding is needed
     */
    async checkIfSeedingNeeded() {
        try {
            const { executeQuery } = require('../utils/database');
            
            // Check if admin table exists and has data
            const adminCount = await executeQuery('SELECT COUNT(*) as count FROM admin');
            return adminCount[0].count === 0;
        } catch (error) {
            // If table doesn't exist or query fails, we need seeding
            console.log('Admin table check failed, assuming seeding is needed');
            return true;
        }
    }

    /**
     * Full database setup with Railway detection
     */
    async setup() {
        // Use Railway-specific setup if in Railway environment
        if (this.isRailway) {
            return await this.railwaySetup();
        }

        // Standard local development setup
        try {
            console.log('='.repeat(50));
            console.log('POSYANDU DATABASE SETUP (LOCAL)');
            console.log('='.repeat(50));
            
            // Test database connection
            console.log('\n1. Testing database connection...');
            const isConnected = await testConnection();
            if (!isConnected) {
                throw new Error('Database connection failed. Please check your configuration.');
            }
            console.log('✓ Database connection successful');

            // Run migrations
            console.log('\n2. Running database migrations...');
            await this.migrationRunner.up();

            // Seed data (full seeding for development)
            console.log('\n3. Seeding initial data...');
            await this.seeder.seedAll();

            console.log('\n' + '='.repeat(50));
            console.log('DATABASE SETUP COMPLETED SUCCESSFULLY!');
            console.log('='.repeat(50));
            console.log('\nDefault admin credentials:');
            console.log('Username: admin');
            console.log('Password: admin123');
            console.log('\nAdditional admin:');
            console.log('Username: perawat1');
            console.log('Password: perawat123');
            console.log('\nSample patients have been created for testing.');
            console.log('='.repeat(50));

        } catch (error) {
            console.error('\n' + '='.repeat(50));
            console.error('DATABASE SETUP FAILED!');
            console.error('='.repeat(50));
            console.error('Error:', error.message);
            console.error('\nPlease check:');
            console.error('1. Database server is running');
            console.error('2. Database credentials in .env file');
            console.error('3. Database exists or user has permission to create it');
            console.error('='.repeat(50));
            throw error;
        }
    }

    /**
     * Reset database (drop and recreate)
     */
    async reset() {
        try {
            console.log('='.repeat(50));
            console.log('RESETTING DATABASE');
            console.log('='.repeat(50));
            
            console.log('\n1. Clearing existing data...');
            await this.seeder.clearAll();
            
            console.log('\n2. Rolling back migrations...');
            // Roll back all migrations
            try {
                while (true) {
                    await this.migrationRunner.down();
                }
            } catch (error) {
                // Expected when no more migrations to rollback
                if (!error.message.includes('No migrations to rollback')) {
                    throw error;
                }
            }
            
            console.log('\n3. Running fresh setup...');
            await this.setup();
            
        } catch (error) {
            console.error('Database reset failed:', error);
            throw error;
        }
    }

    /**
     * Auto-migration for Railway startup
     * Runs migrations automatically when server starts in Railway
     */
    async autoMigrate() {
        try {
            console.log('Starting auto-migration for Railway...');
            
            // Initialize connection
            const isConnected = await initializeConnection();
            if (!isConnected) {
                throw new Error('Cannot connect to Railway database for auto-migration');
            }

            // Run migrations
            console.log('Running database migrations...');
            await this.migrationRunner.up();
            
            // Check and seed if needed
            const needsSeeding = await this.checkIfSeedingNeeded();
            if (needsSeeding) {
                console.log('Seeding essential admin data...');
                await this.seeder.seedAdmins();
            }

            console.log('✓ Auto-migration completed successfully');
            return true;
        } catch (error) {
            console.error('Auto-migration failed:', error.message);
            // Don't throw error to prevent server startup failure
            // Log error and continue - manual intervention may be needed
            return false;
        }
    }

    /**
     * Show database status
     */
    async status() {
        try {
            console.log('='.repeat(50));
            console.log('DATABASE STATUS');
            console.log('='.repeat(50));
            
            // Connection status
            console.log('\nConnection Status:');
            const isConnected = await testConnection();
            console.log(`Database: ${isConnected ? '✓ Connected' : '✗ Disconnected'}`);
            
            // Migration status
            await this.migrationRunner.status();
            
            // Data status
            console.log('\nData Status:');
            try {
                const adminCount = await require('../utils/database').executeQuery('SELECT COUNT(*) as count FROM admin');
                const patientCount = await require('../utils/database').executeQuery('SELECT COUNT(*) as count FROM pasien');
                const examCount = await require('../utils/database').executeQuery('SELECT COUNT(*) as count FROM pemeriksaan_fisik');
                
                console.log(`Admins: ${adminCount[0].count}`);
                console.log(`Patients: ${patientCount[0].count}`);
                console.log(`Examinations: ${examCount[0].count}`);
            } catch (error) {
                console.log('Unable to fetch data counts (tables may not exist)');
            }
            
            console.log('='.repeat(50));
            
        } catch (error) {
            console.error('Failed to get database status:', error);
            throw error;
        }
    }
}

// CLI interface
async function main() {
    const setup = new DatabaseSetup();
    const command = process.argv[2] || 'setup';

    try {
        switch (command) {
            case 'setup':
                await setup.setup();
                break;
            case 'railway':
                await setup.railwaySetup();
                break;
            case 'auto-migrate':
                await setup.autoMigrate();
                break;
            case 'reset':
                await setup.reset();
                break;
            case 'status':
                await setup.status();
                break;
            default:
                console.log('Usage: node setup.js [setup|railway|auto-migrate|reset|status]');
                console.log('  setup       - Run initial database setup (auto-detects Railway)');
                console.log('  railway     - Force Railway-specific setup');
                console.log('  auto-migrate - Run auto-migration for Railway startup');
                console.log('  reset       - Reset database (clear + fresh setup)');
                console.log('  status      - Show database and migration status');
        }
    } catch (error) {
        console.error('Setup command failed:', error);
        process.exit(1);
    } finally {
        await closePool();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = DatabaseSetup;