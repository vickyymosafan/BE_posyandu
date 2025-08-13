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
                kata_sandi: 'Admin123',
                nama_lengkap: 'Administrator Posyandu',
                email: 'admin@posyandu.local'
            },
            {
                nama_pengguna: 'perawat1',
                kata_sandi: 'perawat123',
                nama_lengkap: 'Perawat Satu',
                email: 'perawat1@posyandu.local'
            }
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
    async seedPatients() {
        console.log('Seeding patient test data...');
        
        const patients = [
            {
                nama: 'Siti Aminah',
                nik: '3201234567890001',
                nomor_kk: '3201234567890001',
                tanggal_lahir: '1950-05-15',
                nomor_hp: '081234567890',
                alamat: 'Jl. Merdeka No. 123, Jakarta'
            },
            {
                nama: 'Budi Santoso',
                nik: '3201234567890002',
                nomor_kk: '3201234567890002',
                tanggal_lahir: '1948-08-20',
                nomor_hp: '081234567891',
                alamat: 'Jl. Sudirman No. 456, Jakarta'
            },
            {
                nama: 'Ratna Sari',
                nik: '3201234567890003',
                nomor_kk: '3201234567890003',
                tanggal_lahir: '1952-12-10',
                nomor_hp: '081234567892',
                alamat: 'Jl. Thamrin No. 789, Jakarta'
            },
            {
                nama: 'Ahmad Wijaya',
                nik: '3201234567890004',
                nomor_kk: '3201234567890004',
                tanggal_lahir: '1949-03-25',
                nomor_hp: '081234567893',
                alamat: 'Jl. Gatot Subroto No. 321, Jakarta'
            },
            {
                nama: 'Sari Dewi',
                nik: '3201234567890005',
                nomor_kk: '3201234567890005',
                tanggal_lahir: '1951-07-18',
                nomor_hp: '081234567894',
                alamat: 'Jl. Kuningan No. 654, Jakarta'
            }
        ];

        // Get admin ID for created_by field
        const adminResult = await executeQuery(
            'SELECT id FROM admin WHERE nama_pengguna = ? LIMIT 1',
            ['admin']
        );
        
        if (adminResult.length === 0) {
            throw new Error('Admin user not found. Please seed admins first.');
        }
        
        const adminId = adminResult[0].id;

        for (const patient of patients) {
            try {
                const patientId = this.generatePatientId();
                
                await executeQuery(
                    `INSERT INTO pasien (id_pasien, nama, nik, nomor_kk, tanggal_lahir, nomor_hp, alamat, dibuat_oleh) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        patientId,
                        patient.nama,
                        patient.nik,
                        patient.nomor_kk,
                        patient.tanggal_lahir,
                        patient.nomor_hp,
                        patient.alamat,
                        adminId
                    ]
                );
                
                console.log(`✓ Created patient: ${patient.nama} (ID: ${patientId})`);
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    console.log(`- Patient ${patient.nama} already exists`);
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Seed sample examination data
     */
    async seedExaminations() {
        console.log('Seeding sample examination data...');
        
        // Get some patients and admin
        const patients = await executeQuery('SELECT id FROM pasien LIMIT 3');
        const admin = await executeQuery('SELECT id FROM admin WHERE nama_pengguna = ?', ['admin']);
        
        if (patients.length === 0 || admin.length === 0) {
            console.log('- Skipping examinations: No patients or admin found');
            return;
        }
        
        const adminId = admin[0].id;
        
        const examinations = [
            {
                id_pasien: patients[0].id,
                tinggi_badan: 155.5,
                berat_badan: 65.2,
                lingkar_perut: 85.0,
                tekanan_darah_sistolik: 130,
                tekanan_darah_diastolik: 85,
                catatan: 'Pemeriksaan rutin, kondisi stabil'
            },
            {
                id_pasien: patients[1].id,
                tinggi_badan: 160.0,
                berat_badan: 70.5,
                lingkar_perut: 90.5,
                tekanan_darah_sistolik: 140,
                tekanan_darah_diastolik: 90,
                catatan: 'Tekanan darah sedikit tinggi, perlu monitoring'
            },
            {
                id_pasien: patients[2].id,
                tinggi_badan: 158.2,
                berat_badan: 68.0,
                lingkar_perut: 88.0,
                tekanan_darah_sistolik: 125,
                tekanan_darah_diastolik: 80,
                catatan: 'Kondisi baik, dalam batas normal'
            }
        ];
        
        for (const exam of examinations) {
            try {
                await executeQuery(
                    `INSERT INTO pemeriksaan_fisik 
                     (id_pasien, tinggi_badan, berat_badan, lingkar_perut, tekanan_darah_sistolik, tekanan_darah_diastolik, diperiksa_oleh, catatan) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        exam.id_pasien,
                        exam.tinggi_badan,
                        exam.berat_badan,
                        exam.lingkar_perut,
                        exam.tekanan_darah_sistolik,
                        exam.tekanan_darah_diastolik,
                        adminId,
                        exam.catatan
                    ]
                );
                
                console.log(`✓ Created examination for patient ID: ${exam.id_pasien}`);
            } catch (error) {
                console.error(`Failed to create examination for patient ${exam.id_pasien}:`, error);
            }
        }
    }

    /**
     * Seed sample advanced test data
     */
    async seedAdvancedTests() {
        console.log('Seeding sample advanced test data...');
        
        const patients = await executeQuery('SELECT id FROM pasien LIMIT 3');
        const admin = await executeQuery('SELECT id FROM admin WHERE nama_pengguna = ?', ['admin']);
        
        if (patients.length === 0 || admin.length === 0) {
            console.log('- Skipping advanced tests: No patients or admin found');
            return;
        }
        
        const adminId = admin[0].id;
        
        const tests = [
            {
                id_pasien: patients[0].id,
                gula_darah: 95.5,
                catatan: 'Kadar gula darah normal'
            },
            {
                id_pasien: patients[1].id,
                gula_darah: 125.0,
                catatan: 'Kadar gula darah sedikit tinggi, perlu diet'
            },
            {
                id_pasien: patients[2].id,
                gula_darah: 88.2,
                catatan: 'Kadar gula darah baik'
            }
        ];
        
        for (const test of tests) {
            try {
                await executeQuery(
                    `INSERT INTO tes_lanjutan (id_pasien, gula_darah, dites_oleh, catatan) 
                     VALUES (?, ?, ?, ?)`,
                    [test.id_pasien, test.gula_darah, adminId, test.catatan]
                );
                
                console.log(`✓ Created advanced test for patient ID: ${test.id_pasien}`);
            } catch (error) {
                console.error(`Failed to create advanced test for patient ${test.id_pasien}:`, error);
            }
        }
    }

    /**
     * Run all seeders
     */
    async seedAll() {
        try {
            console.log('Starting database seeding...');
            
            // Test connection
            const isConnected = await testConnection();
            if (!isConnected) {
                throw new Error('Database connection failed');
            }
            
            await this.seedAdmins();
            await this.seedPatients();
            await this.seedExaminations();
            await this.seedAdvancedTests();
            
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
                'rujukan',
                'pengobatan', 
                'penilaian_kesehatan',
                'tes_lanjutan',
                'pemeriksaan_fisik',
                'pasien',
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
                console.log('Usage: node seeds.js [seed|clear|admins|patients]');
                console.log('  seed     - Run all seeders');
                console.log('  clear    - Clear all data');
                console.log('  admins   - Seed only admin data');
                console.log('  patients - Seed only patient data');
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