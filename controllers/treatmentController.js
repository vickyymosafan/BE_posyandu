const { executeQuery, executeTransaction } = require('../utils/database');
const ValidationUtils = require('../utils/validation');

/**
 * Controller untuk manajemen pengobatan
 */
class TreatmentController {
    /**
     * Buat resep pengobatan baru
     * POST /api/pengobatan
     */
    static async createTreatment(req, res) {
        try {
            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data
            const validation = ValidationUtils.validateTreatmentData(sanitizedData);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const { 
                id_pasien, 
                id_penilaian, 
                nama_obat, 
                dosis, 
                frekuensi, 
                durasi, 
                instruksi 
            } = sanitizedData;
            const adminId = req.admin.id;

            // Cek apakah pasien ada
            const patientExists = await executeQuery(
                'SELECT id, nama FROM pasien WHERE id = ?',
                [id_pasien]
            );

            if (patientExists.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pasien tidak ditemukan'
                });
            }

            // Cek apakah penilaian ada (jika disediakan)
            if (id_penilaian) {
                const assessmentExists = await executeQuery(
                    'SELECT id FROM penilaian_kesehatan WHERE id = ? AND id_pasien = ?',
                    [id_penilaian, id_pasien]
                );

                if (assessmentExists.length === 0) {
                    return res.status(404).json({
                        sukses: false,
                        pesan: 'Penilaian kesehatan tidak ditemukan untuk pasien ini'
                    });
                }
            }

            // Insert pengobatan baru
            const insertQuery = `
                INSERT INTO pengobatan (
                    id_pasien, id_penilaian, nama_obat, dosis, 
                    frekuensi, durasi, instruksi, diresepkan_oleh
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await executeQuery(insertQuery, [
                id_pasien,
                id_penilaian || null,
                nama_obat || null,
                dosis || null,
                frekuensi || null,
                durasi || null,
                instruksi || null,
                adminId
            ]);

            // Ambil data pengobatan yang baru dibuat dengan join
            const newTreatment = await executeQuery(
                `SELECT 
                    p.id,
                    p.id_pasien,
                    p.id_penilaian,
                    p.nama_obat,
                    p.dosis,
                    p.frekuensi,
                    p.durasi,
                    p.instruksi,
                    p.tanggal_resep,
                    pas.nama as nama_pasien,
                    pas.id_pasien as kode_pasien,
                    a.nama_lengkap as diresepkan_oleh_nama
                 FROM pengobatan p
                 LEFT JOIN pasien pas ON p.id_pasien = pas.id
                 LEFT JOIN admin a ON p.diresepkan_oleh = a.id
                 WHERE p.id = ?`,
                [result.insertId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [adminId, id_pasien, 'CREATE_TREATMENT', req.ip]
            );

            res.status(201).json({
                sukses: true,
                pesan: 'Pengobatan berhasil dibuat',
                data: newTreatment[0]
            });

        } catch (error) {
            console.error('Error creating treatment:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal membuat pengobatan'
            });
        }
    }

    /**
     * Ambil semua pengobatan dengan paginasi dan pencarian
     * GET /api/pengobatan
     */
    static async getAllTreatments(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const offset = (page - 1) * limit;

            let countQuery = `
                SELECT COUNT(*) as total 
                FROM pengobatan p
                LEFT JOIN pasien pas ON p.id_pasien = pas.id
            `;
            
            let dataQuery = `
                SELECT 
                    p.id,
                    p.id_pasien,
                    p.id_penilaian,
                    p.nama_obat,
                    p.dosis,
                    p.frekuensi,
                    p.durasi,
                    p.instruksi,
                    p.tanggal_resep,
                    pas.nama as nama_pasien,
                    pas.id_pasien as kode_pasien,
                    a.nama_lengkap as diresepkan_oleh_nama
                FROM pengobatan p
                LEFT JOIN pasien pas ON p.id_pasien = pas.id
                LEFT JOIN admin a ON p.diresepkan_oleh = a.id
            `;

            let queryParams = [];

            // Tambahkan kondisi pencarian jika ada
            if (search.trim()) {
                const searchPattern = `%${search.trim()}%`;
                const searchCondition = `
                    WHERE (
                        pas.nama LIKE ? OR 
                        pas.id_pasien LIKE ? OR 
                        p.nama_obat LIKE ?
                    )
                `;
                
                countQuery += searchCondition;
                dataQuery += searchCondition;
                queryParams = [searchPattern, searchPattern, searchPattern];
            }

            // Tambahkan ordering dan pagination
            dataQuery += ` ORDER BY p.tanggal_resep DESC LIMIT ${limit} OFFSET ${offset}`;

            // Execute queries
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;

            const treatments = await executeQuery(dataQuery, queryParams);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            res.json({
                sukses: true,
                data: treatments,
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
            console.error('Error getting treatments:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data pengobatan'
            });
        }
    }

    /**
     * Ambil pengobatan berdasarkan ID
     * GET /api/pengobatan/:id
     */
    static async getTreatmentById(req, res) {
        try {
            const treatmentId = req.params.id;

            // Validasi ID
            if (!treatmentId || isNaN(treatmentId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pengobatan tidak valid'
                });
            }

            // Query untuk mengambil data pengobatan lengkap
            const query = `
                SELECT 
                    p.id,
                    p.id_pasien,
                    p.id_penilaian,
                    p.nama_obat,
                    p.dosis,
                    p.frekuensi,
                    p.durasi,
                    p.instruksi,
                    p.tanggal_resep,
                    pas.nama as nama_pasien,
                    pas.id_pasien as kode_pasien,
                    pas.tanggal_lahir,
                    TIMESTAMPDIFF(YEAR, pas.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as diresepkan_oleh_nama,
                    pn.kategori_penilaian,
                    pn.temuan,
                    pn.rekomendasi
                FROM pengobatan p
                LEFT JOIN pasien pas ON p.id_pasien = pas.id
                LEFT JOIN admin a ON p.diresepkan_oleh = a.id
                LEFT JOIN penilaian_kesehatan pn ON p.id_penilaian = pn.id
                WHERE p.id = ?
            `;

            const result = await executeQuery(query, [treatmentId]);

            if (result.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pengobatan tidak ditemukan'
                });
            }

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, result[0].id_pasien, 'VIEW_TREATMENT', req.ip]
            );

            res.json({
                sukses: true,
                data: result[0]
            });

        } catch (error) {
            console.error('Error getting treatment by ID:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data pengobatan'
            });
        }
    }

    /**
     * Update pengobatan
     * PUT /api/pengobatan/:id
     */
    static async updateTreatment(req, res) {
        try {
            const treatmentId = req.params.id;

            // Validasi ID
            if (!treatmentId || isNaN(treatmentId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID pengobatan tidak valid'
                });
            }

            // Cek apakah pengobatan ada
            const existingTreatment = await executeQuery(
                'SELECT id, id_pasien FROM pengobatan WHERE id = ?',
                [treatmentId]
            );

            if (existingTreatment.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pengobatan tidak ditemukan'
                });
            }

            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data (tanpa validasi id_pasien karena tidak boleh diubah)
            const validationData = { ...sanitizedData, id_pasien: existingTreatment[0].id_pasien };
            const validation = ValidationUtils.validateTreatmentData(validationData);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const { 
                id_penilaian, 
                nama_obat, 
                dosis, 
                frekuensi, 
                durasi, 
                instruksi 
            } = sanitizedData;

            // Cek apakah penilaian ada (jika disediakan)
            if (id_penilaian) {
                const assessmentExists = await executeQuery(
                    'SELECT id FROM penilaian_kesehatan WHERE id = ? AND id_pasien = ?',
                    [id_penilaian, existingTreatment[0].id_pasien]
                );

                if (assessmentExists.length === 0) {
                    return res.status(404).json({
                        sukses: false,
                        pesan: 'Penilaian kesehatan tidak ditemukan untuk pasien ini'
                    });
                }
            }

            // Update pengobatan
            const updateQuery = `
                UPDATE pengobatan 
                SET id_penilaian = ?, nama_obat = ?, dosis = ?, 
                    frekuensi = ?, durasi = ?, instruksi = ?
                WHERE id = ?
            `;

            await executeQuery(updateQuery, [
                id_penilaian || null,
                nama_obat || null,
                dosis || null,
                frekuensi || null,
                durasi || null,
                instruksi || null,
                treatmentId
            ]);

            // Ambil data pengobatan yang sudah diupdate
            const updatedTreatment = await executeQuery(
                `SELECT 
                    p.id,
                    p.id_pasien,
                    p.id_penilaian,
                    p.nama_obat,
                    p.dosis,
                    p.frekuensi,
                    p.durasi,
                    p.instruksi,
                    p.tanggal_resep,
                    pas.nama as nama_pasien,
                    pas.id_pasien as kode_pasien,
                    a.nama_lengkap as diresepkan_oleh_nama
                 FROM pengobatan p
                 LEFT JOIN pasien pas ON p.id_pasien = pas.id
                 LEFT JOIN admin a ON p.diresepkan_oleh = a.id
                 WHERE p.id = ?`,
                [treatmentId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, existingTreatment[0].id_pasien, 'UPDATE_TREATMENT', req.ip]
            );

            res.json({
                sukses: true,
                pesan: 'Pengobatan berhasil diperbarui',
                data: updatedTreatment[0]
            });

        } catch (error) {
            console.error('Error updating treatment:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal memperbarui pengobatan'
            });
        }
    }

    /**
     * Ambil riwayat pengobatan pasien
     * GET /api/pasien/:id/pengobatan
     */
    static async getPatientTreatments(req, res) {
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
                'SELECT id, nama FROM pasien WHERE id = ?',
                [patientId]
            );

            if (patientExists.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Pasien tidak ditemukan'
                });
            }

            // Query untuk mengambil riwayat pengobatan pasien
            const query = `
                SELECT 
                    p.id,
                    p.id_penilaian,
                    p.nama_obat,
                    p.dosis,
                    p.frekuensi,
                    p.durasi,
                    p.instruksi,
                    p.tanggal_resep,
                    a.nama_lengkap as diresepkan_oleh_nama,
                    pn.kategori_penilaian,
                    pn.temuan
                FROM pengobatan p
                LEFT JOIN admin a ON p.diresepkan_oleh = a.id
                LEFT JOIN penilaian_kesehatan pn ON p.id_penilaian = pn.id
                WHERE p.id_pasien = ?
                ORDER BY p.tanggal_resep DESC
            `;

            const treatments = await executeQuery(query, [patientId]);

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, patientId, 'VIEW_PATIENT_TREATMENTS', req.ip]
            );

            res.json({
                sukses: true,
                data: {
                    pasien: patientExists[0],
                    riwayat_pengobatan: treatments
                }
            });

        } catch (error) {
            console.error('Error getting patient treatments:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil riwayat pengobatan pasien'
            });
        }
    }

    /**
     * Hapus pengobatan (soft delete - untuk keamanan data medis)
     * DELETE /api/pengobatan/:id
     */
    static async deleteTreatment(req, res) {
        try {
            // Untuk keamanan data medis, kita tidak mengizinkan penghapusan pengobatan
            res.status(403).json({
                sukses: false,
                pesan: 'Penghapusan data pengobatan tidak diizinkan untuk menjaga integritas data medis'
            });

        } catch (error) {
            console.error('Error deleting treatment:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal menghapus data pengobatan'
            });
        }
    }
}

module.exports = TreatmentController;