const { executeQuery, executeTransaction } = require('../utils/database');
const ValidationUtils = require('../utils/validation');

/**
 * Controller untuk manajemen penilaian kesehatan
 */
class HealthAssessmentController {
    /**
     * Logika kategorisasi otomatis berdasarkan hasil pemeriksaan
     * @param {object} physicalExam - Data pemeriksaan fisik
     * @param {object} advancedTest - Data tes lanjutan
     * @returns {string} - Kategori penilaian (normal, perlu_perhatian, rujukan)
     */
    static categorizeHealthStatus(physicalExam, advancedTest) {
        let riskFactors = 0;
        let criticalFactors = 0;

        // Evaluasi BMI jika ada data tinggi dan berat badan
        if (physicalExam && physicalExam.tinggi_badan && physicalExam.berat_badan) {
            const bmi = physicalExam.berat_badan / Math.pow(physicalExam.tinggi_badan / 100, 2);
            
            if (bmi < 18.5 || bmi > 30) {
                riskFactors++;
            }
            if (bmi < 16 || bmi > 35) {
                criticalFactors++;
            }
        }

        // Evaluasi tekanan darah
        if (physicalExam && physicalExam.tekanan_darah_sistolik && physicalExam.tekanan_darah_diastolik) {
            const sistolik = physicalExam.tekanan_darah_sistolik;
            const diastolik = physicalExam.tekanan_darah_diastolik;

            // Hipertensi stage 1
            if (sistolik >= 140 || diastolik >= 90) {
                riskFactors++;
            }
            // Hipertensi stage 2 atau krisis hipertensi
            if (sistolik >= 160 || diastolik >= 100) {
                criticalFactors++;
            }
            // Hipotensi
            if (sistolik < 90 || diastolik < 60) {
                riskFactors++;
            }
            // Hipotensi berat
            if (sistolik < 70 || diastolik < 40) {
                criticalFactors++;
            }
        }

        // Evaluasi gula darah
        if (advancedTest && advancedTest.gula_darah) {
            const gulaDarah = advancedTest.gula_darah;

            // Diabetes atau prediabetes
            if (gulaDarah >= 126) {
                riskFactors++;
            }
            // Diabetes tidak terkontrol
            if (gulaDarah >= 200) {
                criticalFactors++;
            }
            // Hipoglikemia
            if (gulaDarah < 70) {
                riskFactors++;
            }
            // Hipoglikemia berat
            if (gulaDarah < 50) {
                criticalFactors++;
            }
        }

        // Tentukan kategori berdasarkan faktor risiko
        if (criticalFactors > 0) {
            return 'rujukan';
        } else if (riskFactors >= 2) {
            return 'perlu_perhatian';
        } else if (riskFactors === 1) {
            return 'perlu_perhatian';
        } else {
            return 'normal';
        }
    }

    /**
     * Generate rekomendasi otomatis berdasarkan hasil pemeriksaan
     * @param {object} physicalExam - Data pemeriksaan fisik
     * @param {object} advancedTest - Data tes lanjutan
     * @param {string} category - Kategori penilaian
     * @returns {string} - Rekomendasi
     */
    static generateRecommendations(physicalExam, advancedTest, category) {
        const recommendations = [];

        // Rekomendasi berdasarkan BMI
        if (physicalExam && physicalExam.tinggi_badan && physicalExam.berat_badan) {
            const bmi = physicalExam.berat_badan / Math.pow(physicalExam.tinggi_badan / 100, 2);
            
            if (bmi < 18.5) {
                recommendations.push('Perlu peningkatan berat badan dengan pola makan bergizi');
            } else if (bmi > 25) {
                recommendations.push('Perlu penurunan berat badan dengan diet seimbang dan olahraga ringan');
            }
        }

        // Rekomendasi berdasarkan tekanan darah
        if (physicalExam && physicalExam.tekanan_darah_sistolik && physicalExam.tekanan_darah_diastolik) {
            const sistolik = physicalExam.tekanan_darah_sistolik;
            const diastolik = physicalExam.tekanan_darah_diastolik;

            if (sistolik >= 140 || diastolik >= 90) {
                recommendations.push('Kontrol tekanan darah secara rutin, kurangi konsumsi garam');
                if (sistolik >= 160 || diastolik >= 100) {
                    recommendations.push('Segera konsultasi ke dokter untuk penanganan hipertensi');
                }
            }

            if (sistolik < 90 || diastolik < 60) {
                recommendations.push('Pantau tekanan darah, perbanyak konsumsi cairan');
            }
        }

        // Rekomendasi berdasarkan gula darah
        if (advancedTest && advancedTest.gula_darah) {
            const gulaDarah = advancedTest.gula_darah;

            if (gulaDarah >= 126) {
                recommendations.push('Kontrol gula darah secara rutin, atur pola makan');
                if (gulaDarah >= 200) {
                    recommendations.push('Segera konsultasi ke dokter untuk penanganan diabetes');
                }
            }

            if (gulaDarah < 70) {
                recommendations.push('Pantau gula darah, konsumsi makanan secara teratur');
            }
        }

        // Rekomendasi umum berdasarkan kategori
        if (category === 'rujukan') {
            recommendations.push('Segera rujuk ke fasilitas kesehatan yang lebih lengkap');
        } else if (category === 'perlu_perhatian') {
            recommendations.push('Pemantauan kesehatan lebih intensif diperlukan');
            recommendations.push('Kontrol rutin setiap 2-4 minggu');
        } else {
            recommendations.push('Pertahankan pola hidup sehat');
            recommendations.push('Kontrol rutin setiap 3 bulan');
        }

        return recommendations.join('. ');
    }

    /**
     * Pencatatan penilaian kesehatan baru dengan kategorisasi otomatis
     * POST /api/penilaian
     */
    static async createHealthAssessment(req, res) {
        try {
            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data
            const validation = ValidationUtils.validateHealthAssessmentData(sanitizedData);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const {
                id_pasien,
                id_pemeriksaan_fisik,
                id_tes_lanjutan,
                kategori_penilaian,
                temuan,
                rekomendasi
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

            // Ambil data pemeriksaan fisik jika ada
            let physicalExam = null;
            if (id_pemeriksaan_fisik) {
                const physicalExamResult = await executeQuery(
                    'SELECT * FROM pemeriksaan_fisik WHERE id = ? AND id_pasien = ?',
                    [id_pemeriksaan_fisik, id_pasien]
                );
                
                if (physicalExamResult.length === 0) {
                    return res.status(400).json({
                        sukses: false,
                        pesan: 'Pemeriksaan fisik tidak ditemukan atau tidak sesuai dengan pasien'
                    });
                }
                physicalExam = physicalExamResult[0];
            }

            // Ambil data tes lanjutan jika ada
            let advancedTest = null;
            if (id_tes_lanjutan) {
                const advancedTestResult = await executeQuery(
                    'SELECT * FROM tes_lanjutan WHERE id = ? AND id_pasien = ?',
                    [id_tes_lanjutan, id_pasien]
                );
                
                if (advancedTestResult.length === 0) {
                    return res.status(400).json({
                        sukses: false,
                        pesan: 'Tes lanjutan tidak ditemukan atau tidak sesuai dengan pasien'
                    });
                }
                advancedTest = advancedTestResult[0];
            }

            // Jika tidak ada kategori yang diberikan, lakukan kategorisasi otomatis
            let finalCategory = kategori_penilaian;
            let finalRecommendation = rekomendasi;

            if (!kategori_penilaian && (physicalExam || advancedTest)) {
                finalCategory = this.categorizeHealthStatus(physicalExam, advancedTest);
            }

            // Jika tidak ada rekomendasi yang diberikan, generate otomatis
            if (!rekomendasi && (physicalExam || advancedTest)) {
                finalRecommendation = this.generateRecommendations(physicalExam, advancedTest, finalCategory);
            }

            // Validasi kategori final
            if (!finalCategory) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Kategori penilaian harus diisi atau sertakan data pemeriksaan untuk kategorisasi otomatis'
                });
            }

            // Insert penilaian kesehatan baru
            const insertQuery = `
                INSERT INTO penilaian_kesehatan (
                    id_pasien, id_pemeriksaan_fisik, id_tes_lanjutan,
                    kategori_penilaian, temuan, rekomendasi, dinilai_oleh
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await executeQuery(insertQuery, [
                id_pasien,
                id_pemeriksaan_fisik || null,
                id_tes_lanjutan || null,
                finalCategory,
                temuan || null,
                finalRecommendation || null,
                adminId
            ]);

            // Ambil data penilaian yang baru dibuat
            const newAssessment = await executeQuery(
                `SELECT 
                    pk.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as dinilai_oleh_nama,
                    pf.tanggal_pemeriksaan as tanggal_pemeriksaan_fisik,
                    tl.tanggal_tes as tanggal_tes_lanjutan
                 FROM penilaian_kesehatan pk
                 LEFT JOIN pasien p ON pk.id_pasien = p.id
                 LEFT JOIN admin a ON pk.dinilai_oleh = a.id
                 LEFT JOIN pemeriksaan_fisik pf ON pk.id_pemeriksaan_fisik = pf.id
                 LEFT JOIN tes_lanjutan tl ON pk.id_tes_lanjutan = tl.id
                 WHERE pk.id = ?`,
                [result.insertId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [adminId, id_pasien, 'CREATE_HEALTH_ASSESSMENT', req.ip]
            );

            res.status(201).json({
                sukses: true,
                pesan: 'Penilaian kesehatan berhasil dicatat',
                data: newAssessment[0]
            });

        } catch (error) {
            console.error('Error creating health assessment:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mencatat penilaian kesehatan'
            });
        }
    }

    /**
     * Ambil riwayat penilaian kesehatan pasien
     * GET /api/pasien/:id/penilaian
     */
    static async getPatientHealthAssessments(req, res) {
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

            // Count total penilaian
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM penilaian_kesehatan 
                WHERE id_pasien = ?
            `;
            const countResult = await executeQuery(countQuery, [patientId]);
            const total = countResult[0].total;

            // Query untuk mengambil riwayat penilaian
            const assessmentQuery = `
                SELECT 
                    pk.id,
                    pk.kategori_penilaian,
                    pk.temuan,
                    pk.rekomendasi,
                    pk.tanggal_penilaian,
                    a.nama_lengkap as dinilai_oleh_nama,
                    -- Data pemeriksaan fisik terkait
                    pf.id as id_pemeriksaan_fisik,
                    pf.tinggi_badan,
                    pf.berat_badan,
                    pf.lingkar_perut,
                    pf.tekanan_darah_sistolik,
                    pf.tekanan_darah_diastolik,
                    pf.tanggal_pemeriksaan as tanggal_pemeriksaan_fisik,
                    -- Data tes lanjutan terkait
                    tl.id as id_tes_lanjutan,
                    tl.gula_darah,
                    tl.tanggal_tes as tanggal_tes_lanjutan,
                    -- Hitung BMI jika ada data
                    CASE 
                        WHEN pf.tinggi_badan IS NOT NULL AND pf.berat_badan IS NOT NULL 
                        THEN ROUND(pf.berat_badan / POWER(pf.tinggi_badan / 100, 2), 2)
                        ELSE NULL 
                    END as bmi
                FROM penilaian_kesehatan pk
                LEFT JOIN admin a ON pk.dinilai_oleh = a.id
                LEFT JOIN pemeriksaan_fisik pf ON pk.id_pemeriksaan_fisik = pf.id
                LEFT JOIN tes_lanjutan tl ON pk.id_tes_lanjutan = tl.id
                WHERE pk.id_pasien = ?
                ORDER BY pk.tanggal_penilaian DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            const assessments = await executeQuery(assessmentQuery, [patientId]);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, patientId, 'VIEW_PATIENT_HEALTH_ASSESSMENTS', req.ip]
            );

            res.json({
                sukses: true,
                data: {
                    pasien: patient,
                    penilaian: assessments,
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
            console.error('Error getting patient health assessments:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil riwayat penilaian kesehatan'
            });
        }
    }

    /**
     * Update penilaian kesehatan
     * PUT /api/penilaian/:id
     */
    static async updateHealthAssessment(req, res) {
        try {
            const assessmentId = req.params.id;

            // Validasi ID penilaian
            if (!assessmentId || isNaN(assessmentId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID penilaian tidak valid'
                });
            }

            // Cek apakah penilaian ada
            const existingAssessment = await executeQuery(
                'SELECT id, id_pasien FROM penilaian_kesehatan WHERE id = ?',
                [assessmentId]
            );

            if (existingAssessment.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Penilaian kesehatan tidak ditemukan'
                });
            }

            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data (tanpa validasi id_pasien karena tidak diubah)
            const dataToValidate = { 
                ...sanitizedData, 
                id_pasien: existingAssessment[0].id_pasien 
            };
            
            const validation = ValidationUtils.validateHealthAssessmentData(dataToValidate);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const {
                kategori_penilaian,
                temuan,
                rekomendasi
            } = sanitizedData;

            // Update penilaian kesehatan
            const updateQuery = `
                UPDATE penilaian_kesehatan 
                SET kategori_penilaian = ?, temuan = ?, rekomendasi = ?
                WHERE id = ?
            `;

            await executeQuery(updateQuery, [
                kategori_penilaian,
                temuan || null,
                rekomendasi || null,
                assessmentId
            ]);

            // Ambil data penilaian yang sudah diupdate
            const updatedAssessment = await executeQuery(
                `SELECT 
                    pk.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    a.nama_lengkap as dinilai_oleh_nama,
                    pf.tanggal_pemeriksaan as tanggal_pemeriksaan_fisik,
                    tl.tanggal_tes as tanggal_tes_lanjutan
                 FROM penilaian_kesehatan pk
                 LEFT JOIN pasien p ON pk.id_pasien = p.id
                 LEFT JOIN admin a ON pk.dinilai_oleh = a.id
                 LEFT JOIN pemeriksaan_fisik pf ON pk.id_pemeriksaan_fisik = pf.id
                 LEFT JOIN tes_lanjutan tl ON pk.id_tes_lanjutan = tl.id
                 WHERE pk.id = ?`,
                [assessmentId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, existingAssessment[0].id_pasien, 'UPDATE_HEALTH_ASSESSMENT', req.ip]
            );

            res.json({
                sukses: true,
                pesan: 'Penilaian kesehatan berhasil diperbarui',
                data: updatedAssessment[0]
            });

        } catch (error) {
            console.error('Error updating health assessment:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal memperbarui penilaian kesehatan'
            });
        }
    }

    /**
     * Ambil detail penilaian kesehatan berdasarkan ID
     * GET /api/penilaian/:id
     */
    static async getHealthAssessmentById(req, res) {
        try {
            const assessmentId = req.params.id;

            // Validasi ID penilaian
            if (!assessmentId || isNaN(assessmentId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID penilaian tidak valid'
                });
            }

            // Query untuk mengambil detail penilaian
            const assessmentQuery = `
                SELECT 
                    pk.*,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    p.tanggal_lahir,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as dinilai_oleh_nama,
                    -- Data pemeriksaan fisik terkait
                    pf.tinggi_badan,
                    pf.berat_badan,
                    pf.lingkar_perut,
                    pf.tekanan_darah_sistolik,
                    pf.tekanan_darah_diastolik,
                    pf.tanggal_pemeriksaan as tanggal_pemeriksaan_fisik,
                    pf.catatan as catatan_pemeriksaan_fisik,
                    -- Data tes lanjutan terkait
                    tl.gula_darah,
                    tl.tanggal_tes as tanggal_tes_lanjutan,
                    tl.catatan as catatan_tes_lanjutan,
                    -- Hitung BMI jika ada data
                    CASE 
                        WHEN pf.tinggi_badan IS NOT NULL AND pf.berat_badan IS NOT NULL 
                        THEN ROUND(pf.berat_badan / POWER(pf.tinggi_badan / 100, 2), 2)
                        ELSE NULL 
                    END as bmi
                FROM penilaian_kesehatan pk
                LEFT JOIN pasien p ON pk.id_pasien = p.id
                LEFT JOIN admin a ON pk.dinilai_oleh = a.id
                LEFT JOIN pemeriksaan_fisik pf ON pk.id_pemeriksaan_fisik = pf.id
                LEFT JOIN tes_lanjutan tl ON pk.id_tes_lanjutan = tl.id
                WHERE pk.id = ?
            `;

            const result = await executeQuery(assessmentQuery, [assessmentId]);

            if (result.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Penilaian kesehatan tidak ditemukan'
                });
            }

            const assessment = result[0];

            // Log aktivitas (temporarily disabled for debugging)
            // await executeQuery(
            //     'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
            //     [req.admin.id, assessment.id_pasien, 'VIEW_HEALTH_ASSESSMENT', req.ip]
            // );

            res.json({
                sukses: true,
                data: assessment
            });

        } catch (error) {
            console.error('Error getting health assessment by ID:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil detail penilaian kesehatan'
            });
        }
    }

    /**
     * Ambil semua penilaian kesehatan dengan paginasi dan filter
     * GET /api/penilaian
     */
    static async getAllHealthAssessments(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const category = req.query.category || '';
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

            if (category) {
                whereClause += ' AND pk.kategori_penilaian = ?';
                queryParams.push(category);
            }

            if (startDate) {
                whereClause += ' AND DATE(pk.tanggal_penilaian) >= ?';
                queryParams.push(startDate);
            }

            if (endDate) {
                whereClause += ' AND DATE(pk.tanggal_penilaian) <= ?';
                queryParams.push(endDate);
            }

            // Count query
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM penilaian_kesehatan pk
                LEFT JOIN pasien p ON pk.id_pasien = p.id
                WHERE 1=1 ${whereClause}
            `;
            
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;

            // Data query
            const dataQuery = `
                SELECT 
                    pk.id,
                    pk.kategori_penilaian,
                    pk.temuan,
                    pk.rekomendasi,
                    pk.tanggal_penilaian,
                    p.nama as nama_pasien,
                    p.id_pasien,
                    TIMESTAMPDIFF(YEAR, p.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as dinilai_oleh_nama
                FROM penilaian_kesehatan pk
                LEFT JOIN pasien p ON pk.id_pasien = p.id
                LEFT JOIN admin a ON pk.dinilai_oleh = a.id
                WHERE 1=1 ${whereClause}
                ORDER BY pk.tanggal_penilaian DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            const assessments = await executeQuery(dataQuery, queryParams);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            res.json({
                sukses: true,
                data: assessments,
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
            console.error('Error getting all health assessments:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data penilaian kesehatan'
            });
        }
    }
}

module.exports = HealthAssessmentController;