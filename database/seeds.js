const bcrypt = require('bcrypt');
const { executeQuery, executeTransaction, testConnection } = require('../utils/database');

/**
 * Database Seeder for Posyandu Management System
 */
class DatabaseSeeder {
    constructor() {
        this.saltRounds = 12;
    }

    /**
     * Hash password using bcrypt
     */
    async hashPassword(password) {
        return await bcrypt.hash(password, this.saltRounds);
    }

    /**
     * Generate unique patient ID
     */
    generatePatientId() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `PSN${timestamp}${random}`;
    }

    /**
     * Seed admin data
     */
    async seedAdmins() {
        console.log('Seeding admin data...');
        
        const admins = [
            {
                nama_pengguna: 'admin',
                kata_sandi: 'admin123',
                nama_lengkap: 'Administrator Posyandu',
                email: 'admin@posyandu.local'
            },

        ];

        for (const admin of admins) {
            try {
                const hashedPassword = await this.hashPassword(admin.kata_sandi);
                
                await executeQuery(
                    `INSERT INTO admin (nama_pengguna, hash_kata_sandi, nama_lengkap, email) 
                     VALUES (?, ?, ?, ?)`,
                    [admin.nama_pengguna, hashedPassword, admin.nama_lengkap, admin.email]
                );
                
                console.log(`✓ Created admin: ${admin.nama_pengguna}`);
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    console.log(`- Admin ${admin.nama_pengguna} already exists`);
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Seed patient test data
     */
    async seedPatients() { /* disabled as requested */ }

    /**
     * Seed sample examination data
     */
    async seedExaminations() { /* disabled as requested */ }

    /**
     * Seed sample advanced test data
     */
    async seedAdvancedTests() { /* disabled as requested */ }

    /**
     * Run all seeders
     */
    async seedAll() {
        try {
            console.log('Starting database seeding (admins only)...');
            
            // Test connection
            const isConnected = await testConnection();
            if (!isConnected) {
                throw new Error('Database connection failed');
            }
            
            await this.seedAdmins();
            
            console.log('\n✓ Database seeding completed successfully');
        } catch (error) {
            console.error('\n✗ Database seeding failed:', error);
            throw error;
        }
    }

    /**
     * Clear all data (for testing)
     */
    async clearAll() {
        try {
            console.log('Clearing all data...');
            
            const tables = [
                'log_akses',
                'admin'
            ];
            
            for (const table of tables) {
                await executeQuery(`DELETE FROM ${table}`);
                console.log(`✓ Cleared table: ${table}`);
            }
            
            console.log('\n✓ All data cleared successfully');
        } catch (error) {
            console.error('\n✗ Failed to clear data:', error);
            throw error;
        }
    }
}

// CLI interface
async function main() {
    const seeder = new DatabaseSeeder();
    const command = process.argv[2] || 'seed';
    
    const { closePool } = require('../utils/database');
    
    try {
        switch (command) {
            case 'seed':
                await seeder.seedAll();
                break;
            case 'clear':
                await seeder.clearAll();
                break;
            case 'admins':
                await seeder.seedAdmins();
                break;
            case 'patients':
                await seeder.seedPatients();
                break;
            default:
                console.log('Usage: node seeds.js [seed|clear|admins]');
                console.log('  seed     - Seed admin data');
                console.log('  clear    - Clear admin and access logs');
                console.log('  admins   - Seed only admin data');
        }
    } catch (error) {
        console.error('Seeding command failed:', error);
        process.exit(1);
    } finally {
        await closePool();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = DatabaseSeeder;