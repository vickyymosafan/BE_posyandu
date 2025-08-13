const { executeQuery } = require('../utils/database');

/**
 * Get dashboard statistics
 * Requirement 7.1: KETIKA admin masuk MAKA sistem HARUS menampilkan dashboard dengan metrik kunci
 * Requirement 7.2: KETIKA melihat dashboard MAKA sistem HARUS menunjukkan total pasien, pemeriksaan terbaru, dan tindak lanjut yang tertunda
 */
const getStatistik = async (req, res) => {
    try {
        // Get total patients
        const totalPasienQuery = 'SELECT COUNT(*) as total FROM pasien';
        const totalPasienResult = await executeQuery(totalPasienQuery);
        const totalPasien = totalPasienResult[0].total;

        // Get total examinations today
        const pemeriksaanHariIniQuery = `
            SELECT COUNT(*) as total 
            FROM pemeriksaan_fisik 
            WHERE DATE(tanggal_pemeriksaan) = CURDATE()
        `;
        const pemeriksaanHariIniResult = await executeQuery(pemeriksaanHariIniQuery);
        const pemeriksaanHariIni = pemeriksaanHariIniResult[0].total;

        // Get total advanced tests today
        const tesHariIniQuery = `
            SELECT COUNT(*) as total 
            FROM tes_lanjutan 
            WHERE DATE(tanggal_tes) = CURDATE()
        `;
        const tesHariIniResult = await executeQuery(tesHariIniQuery);
        const tesHariIni = tesHariIniResult[0].total;

        // Get total health assessments today
        const penilaianHariIniQuery = `
            SELECT COUNT(*) as total 
            FROM penilaian_kesehatan 
            WHERE DATE(tanggal_penilaian) = CURDATE()
        `;
        const penilaianHariIniResult = await executeQuery(penilaianHariIniQuery);
        const penilaianHariIni = penilaianHariIniResult[0].total;

        // Get pending referrals count
        const rujukanTertundaQuery = `
            SELECT COUNT(*) as total 
            FROM rujukan 
            WHERE status = 'menunggu'
        `;
        const rujukanTertundaResult = await executeQuery(rujukanTertundaQuery);
        const rujukanTertunda = rujukanTertundaResult[0].total;

        // Get patients needing attention (category: perlu_perhatian or rujukan)
        const pasienPerluPerhatianQuery = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM pasien p
            INNER JOIN penilaian_kesehatan pk ON p.id = pk.id_pasien
            WHERE pk.kategori_penilaian IN ('perlu_perhatian', 'rujukan')
            AND pk.tanggal_penilaian >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `;
        const pasienPerluPerhatianResult = await executeQuery(pasienPerluPerhatianQuery);
        const pasienPerluPerhatian = pasienPerluPerhatianResult[0].total;

        // Get monthly statistics for trend analysis
        const trendBulananQuery = `
            SELECT 
                MONTH(tanggal_pemeriksaan) as bulan,
                YEAR(tanggal_pemeriksaan) as tahun,
                COUNT(*) as jumlah_pemeriksaan
            FROM pemeriksaan_fisik 
            WHERE tanggal_pemeriksaan >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY YEAR(tanggal_pemeriksaan), MONTH(tanggal_pemeriksaan)
            ORDER BY tahun DESC, bulan DESC
            LIMIT 6
        `;
        const trendBulananResult = await executeQuery(trendBulananQuery);

        const statistik = {
            totalPasien,
            pemeriksaanHariIni,
            tesHariIni,
            penilaianHariIni,
            rujukanTertunda,
            pasienPerluPerhatian,
            trendBulanan: trendBulananResult
        };

        res.json({
            sukses: true,
            pesan: 'Statistik dashboard berhasil diambil',
            data: statistik
        });

    } catch (error) {
        console.error('Error getting dashboard statistics:', error);
        res.status(500).json({
            sukses: false,
            pesan: 'Gagal mengambil statistik dashboard',
            error: error.message
        });
    }
};

/**
 * Get recent activities
 * Requirement 7.2: KETIKA melihat dashboard MAKA sistem HARUS menunjukkan aktivitas terbaru
 */
const getAktivitasTerbaru = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        // Get recent activities from different tables using separate queries and combine them
        const queries = [
            // Pemeriksaan fisik
            `SELECT 
                'pemeriksaan_fisik' as jenis,
                pf.id,
                p.nama as nama_pasien,
                p.id_pasien,
                a.nama_lengkap as admin_nama,
                pf.tanggal_pemeriksaan as waktu,
                'Pemeriksaan Fisik' as deskripsi
            FROM pemeriksaan_fisik pf
            INNER JOIN pasien p ON pf.id_pasien = p.id
            INNER JOIN admin a ON pf.diperiksa_oleh = a.id
            ORDER BY pf.tanggal_pemeriksaan DESC
            LIMIT ${limit}`,
            
            // Tes lanjutan
            `SELECT 
                'tes_lanjutan' as jenis,
                tl.id,
                p.nama as nama_pasien,
                p.id_pasien,
                a.nama_lengkap as admin_nama,
                tl.tanggal_tes as waktu,
                'Tes Lanjutan' as deskripsi
            FROM tes_lanjutan tl
            INNER JOIN pasien p ON tl.id_pasien = p.id
            INNER JOIN admin a ON tl.dites_oleh = a.id
            ORDER BY tl.tanggal_tes DESC
            LIMIT ${limit}`,
            
            // Penilaian kesehatan
            `SELECT 
                'penilaian_kesehatan' as jenis,
                pk.id,
                p.nama as nama_pasien,
                p.id_pasien,
                a.nama_lengkap as admin_nama,
                pk.tanggal_penilaian as waktu,
                CONCAT('Penilaian Kesehatan - ', pk.kategori_penilaian) as deskripsi
            FROM penilaian_kesehatan pk
            INNER JOIN pasien p ON pk.id_pasien = p.id
            INNER JOIN admin a ON pk.dinilai_oleh = a.id
            ORDER BY pk.tanggal_penilaian DESC
            LIMIT ${limit}`,
            
            // Pengobatan
            `SELECT 
                'pengobatan' as jenis,
                pg.id,
                p.nama as nama_pasien,
                p.id_pasien,
                a.nama_lengkap as admin_nama,
                pg.tanggal_resep as waktu,
                CONCAT('Pengobatan - ', pg.nama_obat) as deskripsi
            FROM pengobatan pg
            INNER JOIN pasien p ON pg.id_pasien = p.id
            INNER JOIN admin a ON pg.diresepkan_oleh = a.id
            ORDER BY pg.tanggal_resep DESC
            LIMIT ${limit}`,
            
            // Rujukan
            `SELECT 
                'rujukan' as jenis,
                r.id,
                p.nama as nama_pasien,
                p.id_pasien,
                a.nama_lengkap as admin_nama,
                r.tanggal_rujukan as waktu,
                CONCAT('Rujukan ke ', r.nama_fasilitas) as deskripsi
            FROM rujukan r
            INNER JOIN pasien p ON r.id_pasien = p.id
            INNER JOIN admin a ON r.dirujuk_oleh = a.id
            ORDER BY r.tanggal_rujukan DESC
            LIMIT ${limit}`
        ];

        // Execute all queries and combine results
        const results = await Promise.all(
            queries.map(query => executeQuery(query))
        );

        // Combine all results into one array
        const allActivities = results.flat();

        // Sort by waktu (time) descending and limit to requested amount
        const sortedActivities = allActivities
            .sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
            .slice(0, limit);

        res.json({
            sukses: true,
            pesan: 'Aktivitas terbaru berhasil diambil',
            data: sortedActivities
        });

    } catch (error) {
        console.error('Error getting recent activities:', error);
        res.status(500).json({
            sukses: false,
            pesan: 'Gagal mengambil aktivitas terbaru',
            error: error.message
        });
    }
};

/**
 * Get pending follow-ups
 * Requirement 7.2: KETIKA melihat dashboard MAKA sistem HARUS menunjukkan tindak lanjut yang tertunda
 * Requirement 7.4: KETIKA mengakses daftar pasien MAKA sistem HARUS menampilkan pasien dengan tanggal pemeriksaan terakhir mereka
 */
const getTindakLanjutTertunda = async (req, res) => {
    try {
        // Get patients who need follow-up based on their last assessment
        const tindakLanjutQuery = `
            SELECT 
                p.id,
                p.id_pasien,
                p.nama,
                p.nomor_hp,
                pk.kategori_penilaian,
                pk.temuan,
                pk.rekomendasi,
                pk.tanggal_penilaian,
                DATEDIFF(NOW(), pk.tanggal_penilaian) as hari_sejak_penilaian,
                CASE 
                    WHEN pk.kategori_penilaian = 'rujukan' THEN 'Tinggi'
                    WHEN pk.kategori_penilaian = 'perlu_perhatian' THEN 'Sedang'
                    ELSE 'Rendah'
                END as prioritas,
                r.status as status_rujukan,
                r.nama_fasilitas as fasilitas_rujukan
            FROM pasien p
            INNER JOIN (
                SELECT 
                    id_pasien,
                    MAX(tanggal_penilaian) as tanggal_penilaian_terakhir
                FROM penilaian_kesehatan
                GROUP BY id_pasien
            ) latest_assessment ON p.id = latest_assessment.id_pasien
            INNER JOIN penilaian_kesehatan pk ON p.id = pk.id_pasien 
                AND pk.tanggal_penilaian = latest_assessment.tanggal_penilaian_terakhir
            LEFT JOIN rujukan r ON pk.id = r.id_penilaian AND r.status = 'menunggu'
            WHERE pk.kategori_penilaian IN ('perlu_perhatian', 'rujukan')
            AND (
                (pk.kategori_penilaian = 'rujukan' AND DATEDIFF(NOW(), pk.tanggal_penilaian) >= 3)
                OR (pk.kategori_penilaian = 'perlu_perhatian' AND DATEDIFF(NOW(), pk.tanggal_penilaian) >= 7)
            )
            ORDER BY 
                CASE pk.kategori_penilaian 
                    WHEN 'rujukan' THEN 1 
                    WHEN 'perlu_perhatian' THEN 2 
                    ELSE 3 
                END,
                pk.tanggal_penilaian ASC
        `;

        const tindakLanjutResult = await executeQuery(tindakLanjutQuery);

        // Get patients who haven't had examination in the last 30 days
        const pemeriksaanTertundaQuery = `
            SELECT 
                p.id,
                p.id_pasien,
                p.nama,
                p.nomor_hp,
                MAX(pf.tanggal_pemeriksaan) as pemeriksaan_terakhir,
                DATEDIFF(NOW(), MAX(pf.tanggal_pemeriksaan)) as hari_sejak_pemeriksaan,
                'Pemeriksaan Rutin' as jenis_tindak_lanjut,
                'Rendah' as prioritas
            FROM pasien p
            LEFT JOIN pemeriksaan_fisik pf ON p.id = pf.id_pasien
            GROUP BY p.id, p.id_pasien, p.nama, p.nomor_hp
            HAVING 
                MAX(pf.tanggal_pemeriksaan) IS NULL 
                OR DATEDIFF(NOW(), MAX(pf.tanggal_pemeriksaan)) >= 30
            ORDER BY hari_sejak_pemeriksaan DESC
        `;

        const pemeriksaanTertundaResult = await executeQuery(pemeriksaanTertundaQuery);

        res.json({
            sukses: true,
            pesan: 'Tindak lanjut tertunda berhasil diambil',
            data: {
                penilaian_tertunda: tindakLanjutResult,
                pemeriksaan_tertunda: pemeriksaanTertundaResult
            }
        });

    } catch (error) {
        console.error('Error getting pending follow-ups:', error);
        res.status(500).json({
            sukses: false,
            pesan: 'Gagal mengambil tindak lanjut tertunda',
            error: error.message
        });
    }
};

module.exports = {
    getStatistik,
    getAktivitasTerbaru,
    getTindakLanjutTertunda
};