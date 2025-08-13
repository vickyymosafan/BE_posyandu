const { executeQuery, executeTransaction } = require('../utils/database');
const ValidationUtils = require('../utils/validation');

/**
 * Controller untuk manajemen tes kesehatan lanjutan
 */
class AdvancedTestController {
    /**
     * Pencatatan tes lanjutan baru (gula darah)
     * POST /api/tes-lanjutan
     */
    static async createAdvancedTest(req, res) {
        try {
            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data
            const validation = ValidationUtils.validateAdvancedTestData(sanitizedData);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const {
                id_pasien,
                gula_darah,
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

            // Validasi tambahan untuk kadar gula darah dalam rentang medis
            if (gula_darah !== undefined) {
                const gulaDarah = parseFloat(gula_darah);
                
                // Rentang medis yang dapat diterima: 0-1000 mg/dL
                // Namun untuk peringatan klinis:
                // - Normal puasa: 70-100 mg/dL
                // - Normal 2 jam setelah makan: < 140 mg/dL
                // - Diabetes: >= 126 mg/dL (puasa) atau >= 200 mg/dL (sewaktu)
                
                if (gulaDarah < 30 || gulaDarah > 800) {
                    return res.status(400).json({
                        sukses: false,
                        pesan: 'Kadar gula darah di luar rentang medis yang wajar (30-800 mg/dL)'
                    });
                }
            }

            // Insert tes lanjutan baru
            const insertQuery = `
                INSERT INTO tes_lanjutan (
                    id_pasien, gula_darah, dites_oleh, catatan
                ) VALUES (?, ?, ?, ?)
            `;

            const result = await executeQuery(insertQuery, [
                id_pasien,
                gula_darah || null,
                adminId,
                catatan || null
            ]);

            // Ambil data tes yang baru dibuat
            const newTest = await executeQuery(
                `SELECT 
                    tl.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as dites_oleh_nama
                 FROM tes_lanjutan tl
                 LEFT JOIN pasien p ON tl.id_pasien = p.id
                 LEFT JOIN admin a ON tl.dites_oleh = a.id
                 WHERE tl.id = ?`,
                [result.insertId]
            );

            // Log aktivitas (defensive logging)
            try {
                await executeQuery(
                    'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                    [adminId, id_pasien, 'CREATE_ADVANCED_TEST', req.ip]
                );
            } catch (logError) {
                console.warn('Failed to log access:', logError.message);
            }

            res.status(201).json({
                sukses: true,
                pesan: 'Tes lanjutan berhasil dicatat',
                data: newTest[0]
            });

        } catch (error) {
            console.error('Error creating advanced test:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mencatat tes lanjutan'
            });
        }
    }

    /**
     * Ambil riwayat tes lanjutan pasien dengan analisis tren
     * GET /api/pasien/:id/tes-lanjutan
     */
    static async getPatientAdvancedTests(req, res) {
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

            // Count total tes lanjutan
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM tes_lanjutan 
                WHERE id_pasien = ?
            `;
            const countResult = await executeQuery(countQuery, [patientId]);
            const total = countResult[0].total;

            // Query untuk mengambil riwayat tes lanjutan
            const testQuery = `
                SELECT 
                    tl.id,
                    tl.gula_darah,
                    tl.tanggal_tes,
                    tl.catatan,
                    a.nama_lengkap as dites_oleh_nama,
                    -- Kategorisasi gula darah
                    CASE 
                        WHEN tl.gula_darah IS NULL THEN 'tidak_diukur'
                        WHEN tl.gula_darah < 70 THEN 'rendah'
                        WHEN tl.gula_darah <= 100 THEN 'normal_puasa'
                        WHEN tl.gula_darah <= 125 THEN 'prediabetes'
                        WHEN tl.gula_darah <= 199 THEN 'diabetes_ringan'
                        WHEN tl.gula_darah <= 300 THEN 'diabetes_sedang'
                        ELSE 'diabetes_berat'
                    END as kategori_gula_darah
                FROM tes_lanjutan tl
                LEFT JOIN admin a ON tl.dites_oleh = a.id
                WHERE tl.id_pasien = ?
                ORDER BY tl.tanggal_tes DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            const tests = await executeQuery(testQuery, [patientId]);

            // Analisis tren untuk semua data (tidak terbatas paginasi)
            const trendAnalysis = await AdvancedTestController.analyzeTrend(patientId);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            // Log aktivitas (defensive logging)
            try {
                await executeQuery(
                    'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                    [req.admin.id, patientId, 'VIEW_PATIENT_ADVANCED_TESTS', req.ip]
                );
            } catch (logError) {
                console.warn('Failed to log access:', logError.message);
            }

            res.json({
                sukses: true,
                data: {
                    pasien: patient,
                    tes_lanjutan: tests,
                    analisis_tren: trendAnalysis,
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
            console.error('Error getting patient advanced tests:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil riwayat tes lanjutan'
            });
        }
    }

    /**
     * Fungsi analisis tren untuk perbandingan riwayat tes
     * @param {number} patientId - ID pasien
     * @returns {object} - Hasil analisis tren
     */
    static async analyzeTrend(patientId) {
        try {
            // Ambil semua data tes lanjutan pasien untuk analisis
            const allTestsQuery = `
                SELECT 
                    gula_darah,
                    tanggal_tes,
                    DATE(tanggal_tes) as tanggal_saja
                FROM tes_lanjutan 
                WHERE id_pasien = ? AND gula_darah IS NOT NULL
                ORDER BY tanggal_tes ASC
            `;

            const allTests = await executeQuery(allTestsQuery, [patientId]);

            if (allTests.length === 0) {
                return {
                    jumlah_tes: 0,
                    tren: 'tidak_ada_data',
                    rata_rata: null,
                    nilai_tertinggi: null,
                    nilai_terendah: null,
                    tes_terakhir: null,
                    perubahan_terakhir: null,
                    rekomendasi: 'Belum ada data tes lanjutan'
                };
            }

            // Hitung statistik dasar
            const gulaDarahValues = allTests.map(test => parseFloat(test.gula_darah));
            const rataRata = gulaDarahValues.reduce((sum, val) => sum + val, 0) / gulaDarahValues.length;
            const nilaiTertinggi = Math.max(...gulaDarahValues);
            const nilaiTerendah = Math.min(...gulaDarahValues);

            // Analisis tren (naik/turun/stabil)
            let tren = 'stabil';
            let perubahanTerakhir = null;

            if (allTests.length >= 2) {
                const tesSebelumnya = parseFloat(allTests[allTests.length - 2].gula_darah);
                const tesTerakhir = parseFloat(allTests[allTests.length - 1].gula_darah);
                perubahanTerakhir = tesTerakhir - tesSebelumnya;

                // Analisis tren berdasarkan 3 tes terakhir jika ada
                if (allTests.length >= 3) {
                    const last3Tests = allTests.slice(-3).map(test => parseFloat(test.gula_darah));
                    const trend1 = last3Tests[1] - last3Tests[0];
                    const trend2 = last3Tests[2] - last3Tests[1];

                    if (trend1 > 5 && trend2 > 5) {
                        tren = 'naik';
                    } else if (trend1 < -5 && trend2 < -5) {
                        tren = 'turun';
                    } else if (Math.abs(perubahanTerakhir) > 20) {
                        tren = perubahanTerakhir > 0 ? 'naik_signifikan' : 'turun_signifikan';
                    }
                } else {
                    // Hanya 2 tes, analisis sederhana
                    if (Math.abs(perubahanTerakhir) > 20) {
                        tren = perubahanTerakhir > 0 ? 'naik_signifikan' : 'turun_signifikan';
                    } else if (perubahanTerakhir > 5) {
                        tren = 'naik';
                    } else if (perubahanTerakhir < -5) {
                        tren = 'turun';
                    }
                }
            }

            // Generate rekomendasi berdasarkan analisis
            const rekomendasi = AdvancedTestController.generateRecommendation(rataRata, nilaiTertinggi, tren, allTests[allTests.length - 1]);

            return {
                jumlah_tes: allTests.length,
                tren: tren,
                rata_rata: Math.round(rataRata * 100) / 100,
                nilai_tertinggi: nilaiTertinggi,
                nilai_terendah: nilaiTerendah,
                tes_terakhir: allTests[allTests.length - 1],
                perubahan_terakhir: perubahanTerakhir ? Math.round(perubahanTerakhir * 100) / 100 : null,
                rekomendasi: rekomendasi
            };

        } catch (error) {
            console.error('Error analyzing trend:', error);
            return {
                jumlah_tes: 0,
                tren: 'error',
                rata_rata: null,
                nilai_tertinggi: null,
                nilai_terendah: null,
                tes_terakhir: null,
                perubahan_terakhir: null,
                rekomendasi: 'Gagal menganalisis tren'
            };
        }
    }

    /**
     * Generate rekomendasi berdasarkan hasil analisis
     * @param {number} rataRata - Rata-rata gula darah
     * @param {number} nilaiTertinggi - Nilai tertinggi
     * @param {string} tren - Tren perubahan
     * @param {object} tesTerakhir - Data tes terakhir
     * @returns {string} - Rekomendasi
     */
    static generateRecommendation(rataRata, nilaiTertinggi, tren, tesTerakhir) {
        const gulaTerakhir = parseFloat(tesTerakhir.gula_darah);
        let rekomendasi = [];

        // Rekomendasi berdasarkan nilai terakhir
        if (gulaTerakhir < 70) {
            rekomendasi.push('Gula darah rendah - segera konsumsi makanan/minuman manis dan konsultasi dokter');
        } else if (gulaTerakhir <= 100) {
            rekomendasi.push('Gula darah normal - pertahankan pola hidup sehat');
        } else if (gulaTerakhir <= 125) {
            rekomendasi.push('Prediabetes - perlu perubahan gaya hidup dan monitoring rutin');
        } else if (gulaTerakhir <= 199) {
            rekomendasi.push('Diabetes ringan - konsultasi dokter untuk pengelolaan diabetes');
        } else if (gulaTerakhir <= 300) {
            rekomendasi.push('Diabetes sedang - perlu pengelolaan medis intensif');
        } else {
            rekomendasi.push('Diabetes berat - segera rujuk ke dokter spesialis');
        }

        // Rekomendasi berdasarkan tren
        if (tren === 'naik_signifikan') {
            rekomendasi.push('Tren naik signifikan - evaluasi pola makan dan aktivitas fisik');
        } else if (tren === 'naik') {
            rekomendasi.push('Tren naik - perhatikan asupan karbohidrat dan tingkatkan aktivitas');
        } else if (tren === 'turun_signifikan') {
            rekomendasi.push('Tren turun signifikan - pantau kemungkinan hipoglikemia');
        } else if (tren === 'turun') {
            rekomendasi.push('Tren turun - pertahankan pola hidup yang sudah baik');
        }

        // Rekomendasi berdasarkan rata-rata
        if (rataRata > 140) {
            rekomendasi.push('Rata-rata gula darah tinggi - perlu konsultasi rutin dengan dokter');
        }

        return rekomendasi.join('. ');
    }

    /**
     * Update tes lanjutan
     * PUT /api/tes-lanjutan/:id
     */
    static async updateAdvancedTest(req, res) {
        try {
            const testId = req.params.id;

            // Validasi ID tes
            if (!testId || isNaN(testId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID tes tidak valid'
                });
            }

            // Cek apakah tes ada
            const existingTest = await executeQuery(
                'SELECT id, id_pasien FROM tes_lanjutan WHERE id = ?',
                [testId]
            );

            if (existingTest.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Tes lanjutan tidak ditemukan'
                });
            }

            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data (tanpa validasi id_pasien karena tidak diubah)
            const dataToValidate = { 
                ...sanitizedData, 
                id_pasien: existingTest[0].id_pasien 
            };
            
            const validation = ValidationUtils.validateAdvancedTestData(dataToValidate);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const { gula_darah, catatan } = sanitizedData;

            // Validasi tambahan untuk kadar gula darah
            if (gula_darah !== undefined) {
                const gulaDarah = parseFloat(gula_darah);
                if (gulaDarah < 30 || gulaDarah > 800) {
                    return res.status(400).json({
                        sukses: false,
                        pesan: 'Kadar gula darah di luar rentang medis yang wajar (30-800 mg/dL)'
                    });
                }
            }

            // Update tes lanjutan
            const updateQuery = `
                UPDATE tes_lanjutan 
                SET gula_darah = ?, catatan = ?
                WHERE id = ?
            `;

            await executeQuery(updateQuery, [
                gula_darah || null,
                catatan || null,
                testId
            ]);

            // Ambil data tes yang sudah diupdate
            const updatedTest = await executeQuery(
                `SELECT 
                    tl.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as dites_oleh_nama,
                    CASE 
                        WHEN tl.gula_darah IS NULL THEN 'tidak_diukur'
                        WHEN tl.gula_darah < 70 THEN 'rendah'
                        WHEN tl.gula_darah <= 100 THEN 'normal_puasa'
                        WHEN tl.gula_darah <= 125 THEN 'prediabetes'
                        WHEN tl.gula_darah <= 199 THEN 'diabetes_ringan'
                        WHEN tl.gula_darah <= 300 THEN 'diabetes_sedang'
                        ELSE 'diabetes_berat'
                    END as kategori_gula_darah
                 FROM tes_lanjutan tl
                 LEFT JOIN pasien p ON tl.id_pasien = p.id
                 LEFT JOIN admin a ON tl.dites_oleh = a.id
                 WHERE tl.id = ?`,
                [testId]
            );

            // Log aktivitas (defensive logging)
            try {
                await executeQuery(
                    'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                    [req.admin.id, existingTest[0].id_pasien, 'UPDATE_ADVANCED_TEST', req.ip]
                );
            } catch (logError) {
                console.warn('Failed to log access:', logError.message);
            }

            res.json({
                sukses: true,
                pesan: 'Tes lanjutan berhasil diperbarui',
                data: updatedTest[0]
            });

        } catch (error) {
            console.error('Error updating advanced test:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal memperbarui tes lanjutan'
            });
        }
    }

    /**
     * Ambil detail tes lanjutan berdasarkan ID
     * GET /api/tes-lanjutan/:id
     */
    static async getAdvancedTestById(req, res) {
        try {
            const testId = req.params.id;

            // Validasi ID tes
            if (!testId || isNaN(testId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID tes tidak valid'
                });
            }

            // Query untuk mengambil detail tes lanjutan
            const testQuery = `
                SELECT 
                    tl.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    p.tanggal_lahir,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as dites_oleh_nama,
                    CASE 
                        WHEN tl.gula_darah IS NULL THEN 'tidak_diukur'
                        WHEN tl.gula_darah < 70 THEN 'rendah'
                        WHEN tl.gula_darah <= 100 THEN 'normal_puasa'
                        WHEN tl.gula_darah <= 125 THEN 'prediabetes'
                        WHEN tl.gula_darah <= 199 THEN 'diabetes_ringan'
                        WHEN tl.gula_darah <= 300 THEN 'diabetes_sedang'
                        ELSE 'diabetes_berat'
                    END as kategori_gula_darah
                FROM tes_lanjutan tl
                LEFT JOIN pasien p ON tl.id_pasien = p.id
                LEFT JOIN admin a ON tl.dites_oleh = a.id
                WHERE tl.id = ?
            `;

            const result = await executeQuery(testQuery, [testId]);

            if (result.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Tes lanjutan tidak ditemukan'
                });
            }

            const test = result[0];

            // Log aktivitas (defensive logging)
            try {
                await executeQuery(
                    'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                    [req.admin.id, test.id_pasien, 'VIEW_ADVANCED_TEST', req.ip]
                );
            } catch (logError) {
                console.warn('Failed to log access:', logError.message);
            }

            res.json({
                sukses: true,
                data: test
            });

        } catch (error) {
            console.error('Error getting advanced test by ID:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil detail tes lanjutan'
            });
        }
    }

    /**
     * Ambil semua tes lanjutan dengan paginasi dan filter
     * GET /api/tes-lanjutan
     */
    static async getAllAdvancedTests(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const startDate = req.query.start_date;
            const endDate = req.query.end_date;
            const kategori = req.query.kategori; // Filter berdasarkan kategori gula darah
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
                whereClause += ' AND DATE(tl.tanggal_tes) >= ?';
                queryParams.push(startDate);
            }

            if (endDate) {
                whereClause += ' AND DATE(tl.tanggal_tes) <= ?';
                queryParams.push(endDate);
            }

            // Filter berdasarkan kategori gula darah
            if (kategori) {
                switch (kategori) {
                    case 'rendah':
                        whereClause += ' AND tl.gula_darah < 70';
                        break;
                    case 'normal':
                        whereClause += ' AND tl.gula_darah >= 70 AND tl.gula_darah <= 100';
                        break;
                    case 'prediabetes':
                        whereClause += ' AND tl.gula_darah > 100 AND tl.gula_darah <= 125';
                        break;
                    case 'diabetes':
                        whereClause += ' AND tl.gula_darah > 125';
                        break;
                }
            }

            // Count query
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM tes_lanjutan tl
                LEFT JOIN pasien p ON tl.id_pasien = p.id
                WHERE 1=1 ${whereClause}
            `;
            
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;

            // Data query
            const dataQuery = `
                SELECT 
                    tl.id,
                    tl.gula_darah,
                    tl.tanggal_tes,
                    tl.catatan,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as dites_oleh_nama,
                    CASE 
                        WHEN tl.gula_darah IS NULL THEN 'tidak_diukur'
                        WHEN tl.gula_darah < 70 THEN 'rendah'
                        WHEN tl.gula_darah <= 100 THEN 'normal_puasa'
                        WHEN tl.gula_darah <= 125 THEN 'prediabetes'
                        WHEN tl.gula_darah <= 199 THEN 'diabetes_ringan'
                        WHEN tl.gula_darah <= 300 THEN 'diabetes_sedang'
                        ELSE 'diabetes_berat'
                    END as kategori_gula_darah
                FROM tes_lanjutan tl
                LEFT JOIN pasien p ON tl.id_pasien = p.id
                LEFT JOIN admin a ON tl.dites_oleh = a.id
                WHERE 1=1 ${whereClause}
                ORDER BY tl.tanggal_tes DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            const tests = await executeQuery(dataQuery, queryParams);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            res.json({
                sukses: true,
                data: tests,
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
            console.error('Error getting all advanced tests:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data tes lanjutan'
            });
        }
    }
}

module.exports = AdvancedTestController;