const { executeQuery, executeTransaction } = require('../utils/database');
const ValidationUtils = require('../utils/validation');

/**
 * Controller untuk manajemen rujukan
 */
class ReferralController {
    /**
     * Deteksi indikator kesehatan kritis berdasarkan data pemeriksaan
     * @param {number} patientId - ID pasien
     * @returns {Promise<object>} - Hasil deteksi indikator kritis
     */
    static async detectCriticalHealthIndicators(patientId) {
        try {
            const criticalIndicators = [];
            const recommendations = [];

            // Ambil data pemeriksaan fisik terbaru
            const latestPhysicalExam = await executeQuery(
                `SELECT * FROM pemeriksaan_fisik 
                 WHERE id_pasien = ? 
                 ORDER BY tanggal_pemeriksaan DESC 
                 LIMIT 1`,
                [patientId]
            );

            // Ambil data tes lanjutan terbaru
            const latestAdvancedTest = await executeQuery(
                `SELECT * FROM tes_lanjutan 
                 WHERE id_pasien = ? 
                 ORDER BY tanggal_tes DESC 
                 LIMIT 1`,
                [patientId]
            );

            // Cek indikator kritis dari pemeriksaan fisik
            if (latestPhysicalExam.length > 0) {
                const exam = latestPhysicalExam[0];

                // Tekanan darah tinggi (hipertensi)
                if (exam.tekanan_darah_sistolik >= 180 || exam.tekanan_darah_diastolik >= 110) {
                    criticalIndicators.push('Hipertensi Krisis');
                    recommendations.push('Rujukan segera ke Puskesmas untuk penanganan hipertensi krisis');
                } else if (exam.tekanan_darah_sistolik >= 160 || exam.tekanan_darah_diastolik >= 100) {
                    criticalIndicators.push('Hipertensi Stadium 2');
                    recommendations.push('Rujukan ke Puskesmas untuk evaluasi dan pengobatan hipertensi');
                }

                // Tekanan darah rendah (hipotensi)
                if (exam.tekanan_darah_sistolik <= 90 && exam.tekanan_darah_diastolik <= 60) {
                    criticalIndicators.push('Hipotensi');
                    recommendations.push('Evaluasi lebih lanjut untuk penyebab hipotensi');
                }

                // BMI calculation jika ada data tinggi dan berat badan
                if (exam.tinggi_badan && exam.berat_badan) {
                    const tinggiMeter = exam.tinggi_badan / 100;
                    const bmi = exam.berat_badan / (tinggiMeter * tinggiMeter);

                    if (bmi < 18.5) {
                        criticalIndicators.push('Underweight (BMI < 18.5)');
                        recommendations.push('Konsultasi gizi untuk peningkatan berat badan');
                    } else if (bmi >= 30) {
                        criticalIndicators.push('Obesitas (BMI ≥ 30)');
                        recommendations.push('Rujukan untuk program pengelolaan berat badan');
                    }
                }

                // Lingkar perut (risiko metabolik)
                if (exam.lingkar_perut) {
                    // Asumsi untuk lansia (kriteria umum)
                    if (exam.lingkar_perut >= 102) { // untuk pria
                        criticalIndicators.push('Obesitas Abdominal');
                        recommendations.push('Rujukan untuk evaluasi risiko metabolik');
                    } else if (exam.lingkar_perut >= 88) { // untuk wanita
                        criticalIndicators.push('Risiko Metabolik Tinggi');
                        recommendations.push('Konsultasi untuk pengelolaan risiko metabolik');
                    }
                }
            }

            // Cek indikator kritis dari tes lanjutan
            if (latestAdvancedTest.length > 0) {
                const test = latestAdvancedTest[0];

                // Gula darah
                if (test.gula_darah) {
                    if (test.gula_darah >= 400) {
                        criticalIndicators.push('Hiperglikemia Berat');
                        recommendations.push('Rujukan SEGERA ke Puskesmas untuk penanganan darurat diabetes');
                    } else if (test.gula_darah >= 300) {
                        criticalIndicators.push('Hiperglikemia');
                        recommendations.push('Rujukan segera ke Puskesmas untuk evaluasi diabetes');
                    } else if (test.gula_darah >= 200) {
                        criticalIndicators.push('Diabetes Mellitus');
                        recommendations.push('Rujukan ke Puskesmas untuk konfirmasi dan pengelolaan diabetes');
                    } else if (test.gula_darah <= 70) {
                        criticalIndicators.push('Hipoglikemia');
                        recommendations.push('Evaluasi segera untuk penyebab hipoglikemia');
                    }
                }
            }

            return {
                hasCriticalIndicators: criticalIndicators.length > 0,
                indicators: criticalIndicators,
                recommendations: recommendations
            };

        } catch (error) {
            console.error('Error detecting critical health indicators:', error);
            return {
                hasCriticalIndicators: false,
                indicators: [],
                recommendations: [],
                error: 'Gagal mendeteksi indikator kesehatan kritis'
            };
        }
    }

    /**
     * Buat rujukan baru
     * POST /api/rujukan
     */
    static async createReferral(req, res) {
        try {
            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data
            const validation = ValidationUtils.validateReferralData(sanitizedData);
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
                nama_fasilitas, 
                alasan,
                status = 'menunggu'
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

            // Deteksi indikator kesehatan kritis
            const criticalIndicators = await ReferralController.detectCriticalHealthIndicators(id_pasien);

            // Insert rujukan baru
            const insertQuery = `
                INSERT INTO rujukan (
                    id_pasien, id_penilaian, nama_fasilitas, 
                    alasan, status, dirujuk_oleh
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            const result = await executeQuery(insertQuery, [
                id_pasien,
                id_penilaian || null,
                nama_fasilitas,
                alasan,
                status,
                adminId
            ]);

            // Ambil data rujukan yang baru dibuat dengan join
            const newReferral = await executeQuery(
                `SELECT 
                    r.id,
                    r.id_pasien,
                    r.id_penilaian,
                    r.nama_fasilitas,
                    r.alasan,
                    r.status,
                    r.tanggal_rujukan,
                    pas.nama as nama_pasien,
                    pas.id_pasien as kode_pasien,
                    pas.tanggal_lahir,
                    TIMESTAMPDIFF(YEAR, pas.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as dirujuk_oleh_nama
                 FROM rujukan r
                 LEFT JOIN pasien pas ON r.id_pasien = pas.id
                 LEFT JOIN admin a ON r.dirujuk_oleh = a.id
                 WHERE r.id = ?`,
                [result.insertId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [adminId, id_pasien, 'CREATE_REFERRAL', req.ip]
            );

            // Sertakan informasi indikator kritis dalam respons
            const responseData = {
                ...newReferral[0],
                indikator_kritis: criticalIndicators
            };

            res.status(201).json({
                sukses: true,
                pesan: 'Rujukan berhasil dibuat',
                data: responseData
            });

        } catch (error) {
            console.error('Error creating referral:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal membuat rujukan'
            });
        }
    }

    /**
     * Ambil semua rujukan dengan paginasi dan pencarian
     * GET /api/rujukan
     */
    static async getAllReferrals(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const status = req.query.status || '';
            const offset = (page - 1) * limit;

            let countQuery = `
                SELECT COUNT(*) as total 
                FROM rujukan r
                LEFT JOIN pasien pas ON r.id_pasien = pas.id
            `;
            
            let dataQuery = `
                SELECT 
                    r.id,
                    r.id_pasien,
                    r.id_penilaian,
                    r.nama_fasilitas,
                    r.alasan,
                    r.status,
                    r.tanggal_rujukan,
                    pas.nama as nama_pasien,
                    pas.id_pasien as kode_pasien,
                    TIMESTAMPDIFF(YEAR, pas.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as dirujuk_oleh_nama
                FROM rujukan r
                LEFT JOIN pasien pas ON r.id_pasien = pas.id
                LEFT JOIN admin a ON r.dirujuk_oleh = a.id
            `;

            let queryParams = [];
            let conditions = [];

            // Tambahkan kondisi pencarian jika ada
            if (search.trim()) {
                const searchPattern = `%${search.trim()}%`;
                conditions.push(`(
                    pas.nama LIKE ? OR 
                    pas.id_pasien LIKE ? OR 
                    r.nama_fasilitas LIKE ?
                )`);
                queryParams.push(searchPattern, searchPattern, searchPattern);
            }

            // Tambahkan filter status jika ada
            if (status && ['menunggu', 'selesai', 'dibatalkan'].includes(status)) {
                conditions.push('r.status = ?');
                queryParams.push(status);
            }

            // Gabungkan kondisi
            if (conditions.length > 0) {
                const whereClause = ` WHERE ${conditions.join(' AND ')}`;
                countQuery += whereClause;
                dataQuery += whereClause;
            }

            // Tambahkan ordering dan pagination
            dataQuery += ` ORDER BY r.tanggal_rujukan DESC LIMIT ${limit} OFFSET ${offset}`;

            // Execute queries
            const countResult = await executeQuery(countQuery, queryParams);
            const total = countResult[0].total;

            const referrals = await executeQuery(dataQuery, queryParams);

            // Hitung informasi paginasi
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            res.json({
                sukses: true,
                data: referrals,
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
            console.error('Error getting referrals:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data rujukan'
            });
        }
    }

    /**
     * Ambil rujukan berdasarkan ID
     * GET /api/rujukan/:id
     */
    static async getReferralById(req, res) {
        try {
            const referralId = req.params.id;

            // Validasi ID
            if (!referralId || isNaN(referralId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID rujukan tidak valid'
                });
            }

            // Query untuk mengambil data rujukan lengkap
            const query = `
                SELECT 
                    r.id,
                    r.id_pasien,
                    r.id_penilaian,
                    r.nama_fasilitas,
                    r.alasan,
                    r.status,
                    r.tanggal_rujukan,
                    pas.nama as nama_pasien,
                    pas.id_pasien as kode_pasien,
                    pas.tanggal_lahir,
                    pas.nomor_hp,
                    pas.alamat,
                    TIMESTAMPDIFF(YEAR, pas.tanggal_lahir, CURDATE()) as umur_pasien,
                    a.nama_lengkap as dirujuk_oleh_nama,
                    pn.kategori_penilaian,
                    pn.temuan,
                    pn.rekomendasi
                FROM rujukan r
                LEFT JOIN pasien pas ON r.id_pasien = pas.id
                LEFT JOIN admin a ON r.dirujuk_oleh = a.id
                LEFT JOIN penilaian_kesehatan pn ON r.id_penilaian = pn.id
                WHERE r.id = ?
            `;

            const result = await executeQuery(query, [referralId]);

            if (result.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Rujukan tidak ditemukan'
                });
            }

            // Ambil data pemeriksaan terbaru untuk konteks
            const latestExam = await executeQuery(
                `SELECT 
                    pf.tinggi_badan, pf.berat_badan, pf.lingkar_perut,
                    pf.tekanan_darah_sistolik, pf.tekanan_darah_diastolik,
                    pf.tanggal_pemeriksaan,
                    tl.gula_darah, tl.tanggal_tes
                 FROM pemeriksaan_fisik pf
                 LEFT JOIN tes_lanjutan tl ON pf.id_pasien = tl.id_pasien 
                    AND DATE(pf.tanggal_pemeriksaan) = DATE(tl.tanggal_tes)
                 WHERE pf.id_pasien = ?
                 ORDER BY pf.tanggal_pemeriksaan DESC
                 LIMIT 1`,
                [result[0].id_pasien]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, result[0].id_pasien, 'VIEW_REFERRAL', req.ip]
            );

            const responseData = {
                ...result[0],
                pemeriksaan_terbaru: latestExam.length > 0 ? latestExam[0] : null
            };

            res.json({
                sukses: true,
                data: responseData
            });

        } catch (error) {
            console.error('Error getting referral by ID:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil data rujukan'
            });
        }
    }

    /**
     * Update status rujukan
     * PUT /api/rujukan/:id
     */
    static async updateReferral(req, res) {
        try {
            const referralId = req.params.id;

            // Validasi ID
            if (!referralId || isNaN(referralId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID rujukan tidak valid'
                });
            }

            // Cek apakah rujukan ada
            const existingReferral = await executeQuery(
                'SELECT id, id_pasien, status FROM rujukan WHERE id = ?',
                [referralId]
            );

            if (existingReferral.length === 0) {
                return res.status(404).json({
                    sukses: false,
                    pesan: 'Rujukan tidak ditemukan'
                });
            }

            // Sanitasi input
            const sanitizedData = ValidationUtils.sanitizeObject(req.body);
            
            // Validasi data (tanpa validasi id_pasien karena tidak boleh diubah)
            const validationData = { 
                ...sanitizedData, 
                id_pasien: existingReferral[0].id_pasien,
                nama_fasilitas: sanitizedData.nama_fasilitas || 'Existing Facility',
                alasan: sanitizedData.alasan || 'Existing Reason'
            };
            const validation = ValidationUtils.validateReferralData(validationData);
            if (!validation.isValid) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Data tidak valid',
                    errors: validation.errors
                });
            }

            const { 
                nama_fasilitas, 
                alasan, 
                status 
            } = sanitizedData;

            // Validasi status jika disediakan
            if (status && !['menunggu', 'selesai', 'dibatalkan'].includes(status)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'Status rujukan tidak valid'
                });
            }

            // Update rujukan
            const updateQuery = `
                UPDATE rujukan 
                SET nama_fasilitas = COALESCE(?, nama_fasilitas),
                    alasan = COALESCE(?, alasan),
                    status = COALESCE(?, status)
                WHERE id = ?
            `;

            await executeQuery(updateQuery, [
                nama_fasilitas || null,
                alasan || null,
                status || null,
                referralId
            ]);

            // Ambil data rujukan yang sudah diupdate
            const updatedReferral = await executeQuery(
                `SELECT 
                    r.id,
                    r.id_pasien,
                    r.id_penilaian,
                    r.nama_fasilitas,
                    r.alasan,
                    r.status,
                    r.tanggal_rujukan,
                    pas.nama as nama_pasien,
                    pas.id_pasien as kode_pasien,
                    a.nama_lengkap as dirujuk_oleh_nama
                 FROM rujukan r
                 LEFT JOIN pasien pas ON r.id_pasien = pas.id
                 LEFT JOIN admin a ON r.dirujuk_oleh = a.id
                 WHERE r.id = ?`,
                [referralId]
            );

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, existingReferral[0].id_pasien, 'UPDATE_REFERRAL', req.ip]
            );

            res.json({
                sukses: true,
                pesan: 'Rujukan berhasil diperbarui',
                data: updatedReferral[0]
            });

        } catch (error) {
            console.error('Error updating referral:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal memperbarui rujukan'
            });
        }
    }

    /**
     * Ambil riwayat rujukan pasien
     * GET /api/pasien/:id/rujukan
     */
    static async getPatientReferrals(req, res) {
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

            // Query untuk mengambil riwayat rujukan pasien
            const query = `
                SELECT 
                    r.id,
                    r.id_penilaian,
                    r.nama_fasilitas,
                    r.alasan,
                    r.status,
                    r.tanggal_rujukan,
                    a.nama_lengkap as dirujuk_oleh_nama,
                    pn.kategori_penilaian,
                    pn.temuan
                FROM rujukan r
                LEFT JOIN admin a ON r.dirujuk_oleh = a.id
                LEFT JOIN penilaian_kesehatan pn ON r.id_penilaian = pn.id
                WHERE r.id_pasien = ?
                ORDER BY r.tanggal_rujukan DESC
            `;

            const referrals = await executeQuery(query, [patientId]);

            // Deteksi indikator kesehatan kritis terbaru
            const criticalIndicators = await ReferralController.detectCriticalHealthIndicators(patientId);

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, patientId, 'VIEW_PATIENT_REFERRALS', req.ip]
            );

            res.json({
                sukses: true,
                data: {
                    pasien: patientExists[0],
                    riwayat_rujukan: referrals,
                    indikator_kritis_terbaru: criticalIndicators
                }
            });

        } catch (error) {
            console.error('Error getting patient referrals:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal mengambil riwayat rujukan pasien'
            });
        }
    }

    /**
     * Cek indikator kesehatan kritis untuk pasien
     * GET /api/rujukan/check-critical/:patientId
     */
    static async checkCriticalIndicators(req, res) {
        try {
            const patientId = req.params.patientId;

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

            // Deteksi indikator kesehatan kritis
            const criticalIndicators = await ReferralController.detectCriticalHealthIndicators(patientId);

            // Log aktivitas
            await executeQuery(
                'INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip) VALUES (?, ?, ?, ?)',
                [req.admin.id, patientId, 'CHECK_CRITICAL_INDICATORS', req.ip]
            );

            res.json({
                sukses: true,
                data: {
                    pasien: patientExists[0],
                    ...criticalIndicators
                }
            });

        } catch (error) {
            console.error('Error checking critical indicators:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal memeriksa indikator kesehatan kritis'
            });
        }
    }

    /**
     * Hapus rujukan (soft delete - untuk keamanan data medis)
     * DELETE /api/rujukan/:id
     */
    static async deleteReferral(req, res) {
        try {
            // Untuk keamanan data medis, kita tidak mengizinkan penghapusan rujukan
            // Sebagai gantinya, kita bisa mengubah status menjadi 'dibatalkan'
            const referralId = req.params.id;

            // Validasi ID
            if (!referralId || isNaN(referralId)) {
                return res.status(400).json({
                    sukses: false,
                    pesan: 'ID rujukan tidak valid'
                });
            }

            // Update status menjadi dibatalkan
            await executeQuery(
                'UPDATE rujukan SET status = ? WHERE id = ?',
                ['dibatalkan', referralId]
            );

            res.json({
                sukses: true,
                pesan: 'Rujukan berhasil dibatalkan'
            });

        } catch (error) {
            console.error('Error canceling referral:', error);
            res.status(500).json({
                sukses: false,
                pesan: 'Gagal membatalkan rujukan'
            });
        }
    }
}

module.exports = ReferralController;