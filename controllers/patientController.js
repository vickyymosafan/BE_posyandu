const { executeQuery, executeTransaction } = require('../utils/database');
const ValidationUtils = require('../utils/validation');

/**
 * Controller untuk manajemen pasien
 */
class PatientController {
    /**
     * Generate ID pasien unik otomatis
     * Format: PSN + YYYYMMDD + 4 digit counter
     * @returns {Promise<string>} ID pasien unik
     */
    static async generatePatientId() {
        try {
            const today = new Date();
            const dateStr = today.getFullYear().toString() + 
                           (today.getMonth() + 1).toString().padStart(2, '0') + 
                           today.getDate().toString().padStart(2, '0');
            
            const prefix = `PSN${dateStr}`;
            
            // Cari ID terakhir dengan prefix yang sama
            const query = `
                SELECT id_pasien 
                FROM pasien 
                WHERE id_pasien LIKE ? 
                ORDER BY id_pasien DESC 
                LIMIT 1
            `;
            
            const results = await executeQuery(query, [`${prefix}%`]);
            
            let counter = 1;
            if (results.length > 0) {
                const lastId = results[0].id_pasien;
                const lastCounter = parseInt(lastId.slice(-4));
                counter = lastCounter + 1;
            }
            
            return `${prefix}${counter.toString().padStart(4, '0')}`;
        } catch (error) {
            console.error('Error generating patient ID:', error);
            throw new Error('Gagal generate ID pasien');
        }
    }

    /**
     * Pendaftaran pasien baru
     * POST /api/pasien
     */
    static async createPatient(req, res) {
        try {
            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data
            const validation = ValidationUtils.validatePatientData(sanitizedData);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const { nama, nik, nomor_kk, tanggal_lahir, nomor_hp, alamat } = sanitizedData;
            const adminId = req.admin.id;

            // Cek duplikasi NIK
            const existingPatient = await executeQuery(
                'SELECT id FROM pasien WHERE nik = ?',
                [nik]
            );

            if (existingPatient.length > 0) {
                return res.status(409).json({
                    sukses: false,
                    pesan: 'NIK sudah terdaftar'
                });
            }

            // Generate ID pasien unik
            const idPasien = await PatientController.generatePatientId();

            // Insert pasien baru
            const insertQuery = `
                INSERT INTO pasien (
                    id_pasien, nama, nik, nomor_kk, tanggal_lahir, 
                    nomor_hp, alamat, dibuat_oleh
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await executeQuery(insertQuery, [
                idPasien, nama, nik, nomor_kk, tanggal_lahir,
                nomor_hp || null, alamat || null, adminId
            ]);

            // Ambil data pasien yang baru dibuat
            const newPatient = await executeQuery(
                `SELECT p.*, a.nama_lengkap as dibuat_oleh_nama 
                 FROM pasien p 
                 LEFT JOIN admin a ON p.dibuat_oleh = a.id 
                 WHERE p.id = ?`,
                [result.insertId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [adminId, result.insertId, 'CREATE_PATIENT', req.ip]
            );

            res.status(201).json({
                sukses: true,
                pesan: 'Pasien berhasil didaftarkan',
                data: newPatient[0]
            });

        } catch (error) {
            console.error('Error creating patient:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mendaftarkan pasien'
            });
        }
    }

    /**
     * Ambil semua pasien dengan paginasi dan pencarian
     * GET /api/pasien
     */
    static async getAllPatients(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const offset = (page - 1) * limit;

            // Simple query without search first
            if (!search.trim()) {
                // Count query
                const countQuery = 'SELECT COUNT(*) as total FROM pasien p';
                const countResult = await executeQuery(countQuery, []);
                const total = countResult[0].total;

                // Data query
                const dataQuery = `
                    SELECT 
                        p.id,
                        p.id_pasien,
                        p.nama,
                        p.nik,
                        p.nomor_kk,
                        p.tanggal_lahir,
                        p.nomor_hp,
                        p.alamat,
                        p.path_barcode,
                        p.dibuat_pada,
                        p.diperbarui_pada,
                        a.nama_lengkap as dibuat_oleh_nama,
                        TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur
                    FROM pasien p
                    LEFT JOIN admin a ON p.dibuat_oleh = a.id
                    ORDER BY p.dibuat_pada DESC
                    LIMIT ${limit} OFFSET ${offset}
                `;

                const patients = await executeQuery(dataQuery, []);

                // Hitung informasi paginasi
                const totalPages = Math.ceil(total / limit);
                const hasNextPage = page < totalPages;
                const hasPrevPage = page > 1;

                return res.json({
                    sukses: true,
                    data: patients,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalItems: total,
                        itemsPerPage: limit,
                        hasNextPage,
                        hasPrevPage
                    }
                });
            }

            // Search query
            const searchPattern = `%${search.trim()}%`;
            
            // Count query with search
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM pasien p 
                WHERE (
                    p.nama LIKE ? OR 
                    p.nik LIKE ? OR 
                    p.nomor_hp LIKE ? OR
                    p.id_pasien LIKE ?
                )
            `;
            
            const countResult = await executeQuery(countQuery, [searchPattern, searchPattern, searchPattern, searchPattern]);
            const total = countResult[0].total;

            // Data query with search
            const dataQuery = `
                SELECT 
                    p.id,
                    p.id_pasien,
                    p.nama,
                    p.nik,
                    p.nomor_kk,
                    p.tanggal_lahir,
                    p.nomor_hp,
                    p.alamat,
                    p.path_barcode,
                    p.dibuat_pada,
                    p.diperbarui_pada,
                    a.nama_lengkap as dibuat_oleh_nama,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur
                FROM pasien p
                LEFT JOIN admin a ON p.dibuat_oleh = a.id
                WHERE (
                    p.nama LIKE ? OR 
                    p.nik LIKE ? OR 
                    p.nomor_hp LIKE ? OR
                    p.id_pasien LIKE ?
                )
                ORDER BY p.dibuat_pada DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            const patients = await executeQuery(dataQuery, [searchPattern, searchPattern, searchPattern, searchPattern]);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            res.json({
                sukses: true,
                data: patients,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage,
                    hasPrevPage
                }
            });

        } catch (error) {
            console.error('Error getting patients:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data pasien'
            });
        }
    }

    /**
     * Ambil data pasien berdasarkan ID
     * GET /api/pasien/:id
     */
    static async getPatientById(req, res) {
        try {
            const patientId = req.params.id;

            // Validasi ID
            if (!patientId || isNaN(patientId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pasien tidak valid'
                });
            }

            // Query untuk mengambil data pasien lengkap
            const query = `
                SELECT 
                    p.id,
                    p.id_pasien,
                    p.nama,
                    p.nik,
                    p.nomor_kk,
                    p.tanggal_lahir,
                    p.nomor_hp,
                    p.alamat,
                    p.path_barcode,
                    p.dibuat_pada,
                    p.diperbarui_pada,
                    a.nama_lengkap as dibuat_oleh_nama,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur
                FROM pasien p
                LEFT JOIN admin a ON p.dibuat_oleh = a.id
                WHERE p.id = ?
            `;

            const result = await executeQuery(query, [patientId]);

            if (result.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pasien tidak ditemukan'
                });
            }

            const patient = result[0];

            // Ambil riwayat pemeriksaan terbaru (5 terakhir)
            const examQuery = `
                SELECT 
                    pf.id,
                    pf.tinggi_badan,
                    pf.berat_badan,
                    pf.lingkar_perut,
                    pf.tekanan_darah_sistolik,
                    pf.tekanan_darah_diastolik,
                    pf.tanggal_pemeriksaan,
                    pf.catatan,
                    a.nama_lengkap as diperiksa_oleh_nama
                FROM pemeriksaan_fisik pf
                LEFT JOIN admin a ON pf.diperiksa_oleh = a.id
                WHERE pf.id_pasien = ?
                ORDER BY pf.tanggal_pemeriksaan DESC
                LIMIT 5
            `;

            const examinations = await executeQuery(examQuery, [patientId]);

            // Ambil riwayat tes lanjutan terbaru (5 terakhir)
            const testQuery = `
                SELECT 
                    tl.id,
                    tl.gula_darah,
                    tl.tanggal_tes,
                    tl.catatan,
                    a.nama_lengkap as dites_oleh_nama
                FROM tes_lanjutan tl
                LEFT JOIN admin a ON tl.dites_oleh = a.id
                WHERE tl.id_pasien = ?
                ORDER BY tl.tanggal_tes DESC
                LIMIT 5
            `;

            const tests = await executeQuery(testQuery, [patientId]);

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, patientId, 'VIEW_PATIENT', req.ip]
            );

            res.json({
                sukses: true,
                data: {
                    ...patient,
                    riwayat_pemeriksaan: examinations,
                    riwayat_tes: tests
                }
            });

        } catch (error) {
            console.error('Error getting patient by ID:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data pasien'
            });
        }
    }

    /**
     * Update data pasien
     * PUT /api/pasien/:id
     */
    static async updatePatient(req, res) {
        try {
            const patientId = req.params.id;

            // Validasi ID
            if (!patientId || isNaN(patientId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pasien tidak valid'
                });
            }

            // Cek apakah pasien ada
            const existingPatient = await executeQuery(
                'SELECT id, nik FROM pasien WHERE id = ?',
                [patientId]
            );

            if (existingPatient.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pasien tidak ditemukan'
                });
            }

            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data
            const validation = ValidationUtils.validatePatientData(sanitizedData);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const { nama, nik, nomor_kk, tanggal_lahir, nomor_hp, alamat } = sanitizedData;

            // Cek duplikasi NIK (kecuali untuk pasien yang sedang diupdate)
            if (nik !== existingPatient[0].nik) {
                const duplicateNik = await executeQuery(
                    'SELECT id FROM pasien WHERE nik = ? AND id != ?',
                    [nik, patientId]
                );

                if (duplicateNik.length > 0) {
                    return res.status(409).json({
                        sukses: false,
                        pesan: 'NIK sudah terdaftar'
                    });
                }
            }

            // Update data pasien
            const updateQuery = `
                UPDATE pasien 
                SET nama = ?, nik = ?, nomor_kk = ?, tanggal_lahir = ?, 
                    nomor_hp = ?, alamat = ?, diperbarui_pada = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            await executeQuery(updateQuery, [
                nama, nik, nomor_kk, tanggal_lahir,
                nomor_hp || null, alamat || null, patientId
            ]);

            // Ambil data pasien yang sudah diupdate
            const updatedPatient = await executeQuery(
                `SELECT p.*, a.nama_lengkap as dibuat_oleh_nama,
                        TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur
                 FROM pasien p 
                 LEFT JOIN admin a ON p.dibuat_oleh = a.id 
                 WHERE p.id = ?`,
                [patientId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, patientId, 'UPDATE_PATIENT', req.ip]
            );

            res.json({
                sukses: true,
                pesan: 'Data pasien berhasil diperbarui',
                data: updatedPatient[0]
            });

        } catch (error) {
            console.error('Error updating patient:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal memperbarui data pasien'
            });
        }
    }

    /**
     * Hapus pasien (soft delete - tidak diimplementasi untuk keamanan data)
     * DELETE /api/pasien/:id
     */
    static async deletePatient(req, res) {
        try {
            // Untuk keamanan data medis, kita tidak mengizinkan penghapusan pasien
            // Sebagai gantinya, kita bisa menambahkan status "tidak aktif"
            res.status(403).json({
                sukses: false,
                pesan: 'Penghapusan data pasien tidak diizinkan untuk menjaga integritas data medis'
            });

        } catch (error) {
            console.error('Error deleting patient:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal menghapus data pasien'
            });
        }
    }

    /**
     * Pencarian pasien berdasarkan barcode atau ID pasien
     * GET /api/pasien/search/barcode
     */
    static async searchPatientByBarcode(req, res) {
        try {
            const { code } = req.query;

            if (!code) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Kode barcode atau ID pasien wajib diisi'
                });
            }

            // Cari berdasarkan ID pasien
            const query = `
                SELECT 
                    p.id,
                    p.id_pasien,
                    p.nama,
                    p.nik,
                    p.nomor_kk,
                    p.tanggal_lahir,
                    p.nomor_hp,
                    p.alamat,
                    p.path_barcode,
                    p.dibuat_pada,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur
                FROM pasien p
                WHERE p.id_pasien = ?
            `;

            const result = await executeQuery(query, [code]);

            if (result.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pasien tidak ditemukan'
                });
            }

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, result[0].id, 'BARCODE_SCAN', req.ip]
            );

            res.json({
                sukses: true,
                data: result[0]
            });

        } catch (error) {
            console.error('Error searching patient by barcode:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mencari data pasien'
            });
        }
    }

    /**
     * Get patient's recent activities from all modules
     * GET /api/pasien/:id/aktivitas
     */
    static async getPatientActivities(req, res) {
        try {
            const patientId = parseInt(req.params.id);
            const limit = parseInt(req.query.limit) || 10;

            // Validasi ID pasien
            if (!patientId || isNaN(patientId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pasien tidak valid'
                });
            }

            // Cek apakah pasien ada
            const patientExists = await executeQuery(
                'SELECT id, nama FROM pasien WHERE id = ?',
                [patientId]
            );

            if (patientExists.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pasien tidak ditemukan'
                });
            }

            // Get recent activities from different tables using separate queries and combine them
            const queries = [
                // Pemeriksaan fisik
                `SELECT 
                    'pemeriksaan_fisik' as jenis,
                    pf.id,
                    '${patientExists[0].nama}' as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as admin_nama,
                    pf.tanggal_pemeriksaan as waktu,
                    'Pemeriksaan Fisik' as deskripsi
                FROM pemeriksaan_fisik pf
                INNER JOIN pasien p ON pf.id_pasien = p.id
                INNER JOIN admin a ON pf.diperiksa_oleh = a.id
                WHERE pf.id_pasien = ?
                ORDER BY pf.tanggal_pemeriksaan DESC
                LIMIT ${limit}`,
                
                // Tes lanjutan
                `SELECT 
                    'tes_lanjutan' as jenis,
                    tl.id,
                    '${patientExists[0].nama}' as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as admin_nama,
                    tl.tanggal_tes as waktu,
                    'Tes Lanjutan' as deskripsi
                FROM tes_lanjutan tl
                INNER JOIN pasien p ON tl.id_pasien = p.id
                INNER JOIN admin a ON tl.dites_oleh = a.id
                WHERE tl.id_pasien = ?
                ORDER BY tl.tanggal_tes DESC
                LIMIT ${limit}`,
                
                // Penilaian kesehatan
                `SELECT 
                    'penilaian_kesehatan' as jenis,
                    pk.id,
                    '${patientExists[0].nama}' as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as admin_nama,
                    pk.tanggal_penilaian as waktu,
                    CONCAT('Penilaian Kesehatan - ', pk.kategori_penilaian) as deskripsi
                FROM penilaian_kesehatan pk
                INNER JOIN pasien p ON pk.id_pasien = p.id
                INNER JOIN admin a ON pk.dinilai_oleh = a.id
                WHERE pk.id_pasien = ?
                ORDER BY pk.tanggal_penilaian DESC
                LIMIT ${limit}`,
                
                // Pengobatan
                `SELECT 
                    'pengobatan' as jenis,
                    pg.id,
                    '${patientExists[0].nama}' as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as admin_nama,
                    pg.tanggal_resep as waktu,
                    CONCAT('Pengobatan - ', pg.nama_obat) as deskripsi
                FROM pengobatan pg
                INNER JOIN pasien p ON pg.id_pasien = p.id
                INNER JOIN admin a ON pg.diresepkan_oleh = a.id
                WHERE pg.id_pasien = ?
                ORDER BY pg.tanggal_resep DESC
                LIMIT ${limit}`,
                
                // Rujukan
                `SELECT 
                    'rujukan' as jenis,
                    r.id,
                    '${patientExists[0].nama}' as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as admin_nama,
                    r.tanggal_rujukan as waktu,
                    CONCAT('Rujukan ke ', r.nama_fasilitas) as deskripsi
                FROM rujukan r
                INNER JOIN pasien p ON r.id_pasien = p.id
                INNER JOIN admin a ON r.dirujuk_oleh = a.id
                WHERE r.id_pasien = ?
                ORDER BY r.tanggal_rujukan DESC
                LIMIT ${limit}`
            ];

            // Execute all queries and combine results
            const results = await Promise.all(
                queries.map(query => executeQuery(query, [patientId]))
            );

            // Combine all results into one array
            const allActivities = results.flat();

            // Sort by waktu (time) descending and limit to requested amount
            const sortedActivities = allActivities
                .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
                .slice(0, limit);

            res.json({
                sukses: true,
                pesan: 'Aktivitas pasien berhasil diambil',
                data: {
                    pasien: patientExists[0],
                    aktivitas: sortedActivities
                }
            });

        } catch (error) {
            console.error('Error getting patient activities:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil aktivitas pasien',
                error: error.message
            });
        }
    }
}

module.exports = PatientController;