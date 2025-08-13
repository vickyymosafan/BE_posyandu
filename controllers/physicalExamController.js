const { executeQuery, executeTransaction } = require('../utils/database');
const ValidationUtils = require('../utils/validation');

/**
 * Controller untuk manajemen pemeriksaan fisik
 */
class PhysicalExamController {
    /**
     * Pencatatan pemeriksaan fisik baru
     * POST /api/pemeriksaan
     */
    static async createPhysicalExam(req, res) {
        try {
            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data
            const validation = ValidationUtils.validatePhysicalExamData(sanitizedData);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const {
                id_pasien,
                tinggi_badan,
                berat_badan,
                lingkar_perut,
                tekanan_darah_sistolik,
                tekanan_darah_diastolik,
                catatan
            } = sanitizedData;

            const adminId = req.admin.id;

            // Cek apakah pasien ada
            const patientExists = await executeQuery(
                'SELECT id FROM pasien WHERE id = ?',
                [id_pasien]
            );

            if (patientExists.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pasien tidak ditemukan'
                });
            }

            // Validasi tambahan untuk tekanan darah
            if (tekanan_darah_sistolik && tekanan_darah_diastolik) {
                if (tekanan_darah_sistolik <= tekanan_darah_diastolik) {
                    return res.status(400).json({
                        sukses: false,
                        pesan: 'Tekanan darah sistolik harus lebih tinggi dari diastolik'
                    });
                }
            }

            // Insert pemeriksaan fisik baru
            const insertQuery = `
                INSERT INTO pemeriksaan_fisik (
                    id_pasien, tinggi_badan, berat_badan, lingkar_perut,
                    tekanan_darah_sistolik, tekanan_darah_diastolik,
                    diperiksa_oleh, catatan
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await executeQuery(insertQuery, [
                id_pasien,
                tinggi_badan || null,
                berat_badan || null,
                lingkar_perut || null,
                tekanan_darah_sistolik || null,
                tekanan_darah_diastolik || null,
                adminId,
                catatan || null
            ]);

            // Ambil data pemeriksaan yang baru dibuat
            const newExam = await executeQuery(
                `SELECT 
                    pf.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as diperiksa_oleh_nama
                 FROM pemeriksaan_fisik pf
                 LEFT JOIN pasien p ON pf.id_pasien = p.id
                 LEFT JOIN admin a ON pf.diperiksa_oleh = a.id
                 WHERE pf.id = ?`,
                [result.insertId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [adminId, id_pasien, 'CREATE_PHYSICAL_EXAM', req.ip]
            );

            res.status(201).json({
                sukses: true,
                pesan: 'Pemeriksaan fisik berhasil dicatat',
                data: newExam[0]
            });

        } catch (error) {
            console.error('Error creating physical exam:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mencatat pemeriksaan fisik'
            });
        }
    }

    /**
     * Ambil riwayat pemeriksaan fisik pasien
     * GET /api/pasien/:id/pemeriksaan
     */
    static async getPatientExaminations(req, res) {
        try {
            const patientId = req.params.id;

            // Validasi ID pasien
            if (!patientId || isNaN(patientId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pasien tidak valid'
                });
            }

            // Cek apakah pasien ada
            const patientExists = await executeQuery(
                'SELECT id, nama, id_pasien FROM pasien WHERE id = ?',
                [patientId]
            );

            if (patientExists.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pasien tidak ditemukan'
                });
            }

            const patient = patientExists[0];

            // Ambil parameter paginasi
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            // Count total pemeriksaan
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM pemeriksaan_fisik 
                WHERE id_pasien = ?
            `;
            const countResult = await executeQuery(countQuery, [patientId]);
            const total = countResult[0].total;

            // Query untuk mengambil riwayat pemeriksaan
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
                    a.nama_lengkap as diperiksa_oleh_nama,
                    -- Hitung BMI jika ada data tinggi dan berat
                    CASE 
                        WHEN pf.tinggi_badan IS NOT NULL AND pf.berat_badan IS NOT NULL 
                        THEN ROUND(pf.berat_badan / POWER(pf.tinggi_badan / 100, 2), 2)
                        ELSE NULL 
                    END as bmi
                FROM pemeriksaan_fisik pf
                LEFT JOIN admin a ON pf.diperiksa_oleh = a.id
                WHERE pf.id_pasien = ?
                ORDER BY pf.tanggal_pemeriksaan DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            const examinations = await executeQuery(examQuery, [patientId]);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, patientId, 'VIEW_PATIENT_EXAMINATIONS', req.ip]
            );

            res.json({
                sukses: true,
                data: {
                    pasien: patient,
                    pemeriksaan: examinations,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalItems: total,
                        itemsPerPage: limit,
                        hasNextPage,
                        hasPrevPage
                    }
                }
            });

        } catch (error) {
            console.error('Error getting patient examinations:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil riwayat pemeriksaan'
            });
        }
    }

    /**
     * Update pemeriksaan fisik
     * PUT /api/pemeriksaan/:id
     */
    static async updatePhysicalExam(req, res) {
        try {
            const examId = req.params.id;

            // Validasi ID pemeriksaan
            if (!examId || isNaN(examId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pemeriksaan tidak valid'
                });
            }

            // Cek apakah pemeriksaan ada
            const existingExam = await executeQuery(
                'SELECT id, id_pasien FROM pemeriksaan_fisik WHERE id = ?',
                [examId]
            );

            if (existingExam.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pemeriksaan tidak ditemukan'
                });
            }

            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data (tanpa validasi id_pasien karena tidak diubah)
            const dataToValidate = { 
                ...sanitizedData, 
                id_pasien: existingExam[0].id_pasien 
            };
            
            const validation = ValidationUtils.validatePhysicalExamData(dataToValidate);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const {
                tinggi_badan,
                berat_badan,
                lingkar_perut,
                tekanan_darah_sistolik,
                tekanan_darah_diastolik,
                catatan
            } = sanitizedData;

            // Validasi tambahan untuk tekanan darah
            if (tekanan_darah_sistolik && tekanan_darah_diastolik) {
                if (tekanan_darah_sistolik <= tekanan_darah_diastolik) {
                    return res.status(400).json({
                        sukses: false,
                        pesan: 'Tekanan darah sistolik harus lebih tinggi dari diastolik'
                    });
                }
            }

            // Update pemeriksaan fisik
            const updateQuery = `
                UPDATE pemeriksaan_fisik 
                SET tinggi_badan = ?, berat_badan = ?, lingkar_perut = ?,
                    tekanan_darah_sistolik = ?, tekanan_darah_diastolik = ?,
                    catatan = ?
                WHERE id = ?
            `;

            await executeQuery(updateQuery, [
                tinggi_badan || null,
                berat_badan || null,
                lingkar_perut || null,
                tekanan_darah_sistolik || null,
                tekanan_darah_diastolik || null,
                catatan || null,
                examId
            ]);

            // Ambil data pemeriksaan yang sudah diupdate
            const updatedExam = await executeQuery(
                `SELECT 
                    pf.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as diperiksa_oleh_nama,
                    CASE 
                        WHEN pf.tinggi_badan IS NOT NULL AND pf.berat_badan IS NOT NULL 
                        THEN ROUND(pf.berat_badan / POWER(pf.tinggi_badan / 100, 2), 2)
                        ELSE NULL 
                    END as bmi
                 FROM pemeriksaan_fisik pf
                 LEFT JOIN pasien p ON pf.id_pasien = p.id
                 LEFT JOIN admin a ON pf.diperiksa_oleh = a.id
                 WHERE pf.id = ?`,
                [examId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, existingExam[0].id_pasien, 'UPDATE_PHYSICAL_EXAM', req.ip]
            );

            res.json({
                sukses: true,
                pesan: 'Pemeriksaan fisik berhasil diperbarui',
                data: updatedExam[0]
            });

        } catch (error) {
            console.error('Error updating physical exam:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal memperbarui pemeriksaan fisik'
            });
        }
    }

    /**
     * Ambil detail pemeriksaan fisik berdasarkan ID
     * GET /api/pemeriksaan/:id
     */
    static async getPhysicalExamById(req, res) {
        try {
            const examId = req.params.id;

            // Validasi ID pemeriksaan
            if (!examId || isNaN(examId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pemeriksaan tidak valid'
                });
            }

            // Query untuk mengambil detail pemeriksaan
            const examQuery = `
                SELECT 
                    pf.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    p.tanggal_lahir,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as diperiksa_oleh_nama,
                    CASE 
                        WHEN pf.tinggi_badan IS NOT NULL AND pf.berat_badan IS NOT NULL 
                        THEN ROUND(pf.berat_badan / POWER(pf.tinggi_badan / 100, 2), 2)
                        ELSE NULL 
                    END as bmi
                FROM pemeriksaan_fisik pf
                LEFT JOIN pasien p ON pf.id_pasien = p.id
                LEFT JOIN admin a ON pf.diperiksa_oleh = a.id
                WHERE pf.id = ?
            `;

            const result = await executeQuery(examQuery, [examId]);

            if (result.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pemeriksaan tidak ditemukan'
                });
            }

            const examination = result[0];

            // Log aktivitas (temporarily disabled for debugging)
            // await executeQuery(
            //     'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
            //     [req.admin.id, examination.id_pasien, 'VIEW_PHYSICAL_EXAM', req.ip]
            // );

            res.json({
                sukses: true,
                data: examination
            });

        } catch (error) {
            console.error('Error getting physical exam by ID:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil detail pemeriksaan'
            });
        }
    }

    /**
     * Ambil semua pemeriksaan fisik dengan paginasi dan filter
     * GET /api/pemeriksaan
     */
    static async getAllPhysicalExams(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const startDate = req.query.start_date;
            const endDate = req.query.end_date;
            const offset = (page - 1) * limit;

            // Build WHERE clause
            let whereClause = '';
            let queryParams = [];

            if (search.trim()) {
                whereClause += ' AND (p.nama LIKE ? OR p.id_pasien LIKE ?)';
                const searchPattern = `%${search.trim()}%`;
                queryParams.push(searchPattern, searchPattern);
            }

            if (startDate) {
                whereClause += ' AND DATE(pf.tanggal_pemeriksaan) >= ?';
                queryParams.push(startDate);
            }

            if (endDate) {
                whereClause += ' AND DATE(pf.tanggal_pemeriksaan) <= ?';
                queryParams.push(endDate);
            }

            // Count query
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM pemeriksaan_fisik pf
                LEFT JOIN pasien p ON pf.id_pasien = p.id
                WHERE 1=1 ${whereClause}
            `;
            
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;

            // Data query
            const dataQuery = `
                SELECT 
                    pf.id,
                    pf.tinggi_badan,
                    pf.berat_badan,
                    pf.lingkar_perut,
                    pf.tekanan_darah_sistolik,
                    pf.tekanan_darah_diastolik,
                    pf.tanggal_pemeriksaan,
                    pf.catatan,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as diperiksa_oleh_nama,
                    CASE 
                        WHEN pf.tinggi_badan IS NOT NULL AND pf.berat_badan IS NOT NULL 
                        THEN ROUND(pf.berat_badan / POWER(pf.tinggi_badan / 100, 2), 2)
                        ELSE NULL 
                    END as bmi
                FROM pemeriksaan_fisik pf
                LEFT JOIN pasien p ON pf.id_pasien = p.id
                LEFT JOIN admin a ON pf.diperiksa_oleh = a.id
                WHERE 1=1 ${whereClause}
                ORDER BY pf.tanggal_pemeriksaan DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            const examinations = await executeQuery(dataQuery, queryParams);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            res.json({
                sukses: true,
                data: examinations,
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
            console.error('Error getting all physical exams:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data pemeriksaan'
            });
        }
    }

    /**
     * Hapus pemeriksaan fisik
     * DELETE /api/pemeriksaan/:id
     */
    static async deletePhysicalExam(req, res) {
        try {
            const examId = req.params.id;

            // Validasi ID pemeriksaan
            if (!examId || isNaN(examId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pemeriksaan tidak valid'
                });
            }

            // Cek apakah pemeriksaan ada
            const existingExam = await executeQuery(
                'SELECT id, id_pasien FROM pemeriksaan_fisik WHERE id = ?',
                [examId]
            );

            if (existingExam.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pemeriksaan tidak ditemukan'
                });
            }

            // Hapus pemeriksaan fisik
            await executeQuery(
                'DELETE FROM pemeriksaan_fisik WHERE id = ?',
                [examId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, existingExam[0].id_pasien, 'DELETE_PHYSICAL_EXAM', req.ip]
            );

            res.json({
                sukses: true,
                pesan: 'Pemeriksaan fisik berhasil dihapus'
            });

        } catch (error) {
            console.error('Error deleting physical exam:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal menghapus pemeriksaan fisik'
            });
        }
    }
}

module.exports = PhysicalExamController;