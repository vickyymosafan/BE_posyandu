const MigrationRunner = require('../migrations/migrate');
const DatabaseSeeder = require('./seeds');
const { testConnection, closePool } = require('../utils/database');

/**
 * Database Setup Script
 * Runs migrations and seeds data for initial setup
 */
class DatabaseSetup {
    constructor() {
        this.migrationRunner = new MigrationRunner();
        this.seeder = new DatabaseSeeder();
    }

    /**
     * Full database setup
     */
    async setup() {
        try {
            console.log('='.repeat(50));
            console.log('POSYANDU DATABASE SETUP');
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

            // Seed data
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
            case 'reset':
                await setup.reset();
                break;
            case 'status':
                await setup.status();
                break;
            default:
                console.log('Usage: node setup.js [setup|reset|status]');
                console.log('  setup  - Run initial database setup (migrations + seeds)');
                console.log('  reset  - Reset database (clear + fresh setup)');
                console.log('  status - Show database and migration status');
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