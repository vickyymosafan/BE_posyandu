const validator = require('validator');
const xss = require('xss');

/**
 * Utilitas validasi data untuk sistem posyandu
 */
class ValidationUtils {
    /**
     * Sanitasi input string untuk mencegah XSS
     * @param {string} input - Input yang akan disanitasi
     * @returns {string} - Input yang telah disanitasi
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Sanitasi XSS dan escape HTML
        return xss(validator.escape(input));
    }

    /**
     * Sanitasi objek secara rekursif
     * @param {object} obj - Objek yang akan disanitasi
     * @returns {object} - Objek yang telah disanitasi
     */
    static sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (typeof obj[key] === 'string') {
                    sanitized[key] = this.sanitizeInput(obj[key]);
                } else if (typeof obj[key] === 'object') {
                    sanitized[key] = this.sanitizeObject(obj[key]);
                } else {
                    sanitized[key] = obj[key];
                }
            }
        }
        return sanitized;
    }

    /**
     * Validasi data pasien
     * @param {object} data - Data pasien
     * @returns {object} - Hasil validasi
     */
    static validatePatientData(data) {
        const errors = [];

        // Validasi nama
        if (!data.nama || typeof data.nama !== 'string' || data.nama.trim().length === 0) {
            errors.push('Nama wajib diisi');
        } else if (data.nama.trim().length < 2) {
            errors.push('Nama minimal 2 karakter');
        } else if (data.nama.trim().length > 100) {
            errors.push('Nama maksimal 100 karakter');
        }

        // Validasi NIK
        if (!data.nik || typeof data.nik !== 'string') {
            errors.push('NIK wajib diisi');
        } else if (!validator.isLength(data.nik, { min: 16, max: 16 })) {
            errors.push('NIK harus 16 digit');
        } else if (!validator.isNumeric(data.nik)) {
            errors.push('NIK hanya boleh berisi angka');
        }

        // Validasi nomor KK
        if (!data.nomor_kk || typeof data.nomor_kk !== 'string') {
            errors.push('Nomor KK wajib diisi');
        } else if (!validator.isLength(data.nomor_kk, { min: 16, max: 16 })) {
            errors.push('Nomor KK harus 16 digit');
        } else if (!validator.isNumeric(data.nomor_kk)) {
            errors.push('Nomor KK hanya boleh berisi angka');
        }

        // Validasi tanggal lahir
        if (!data.tanggal_lahir) {
            errors.push('Tanggal lahir wajib diisi');
        } else if (!validator.isDate(data.tanggal_lahir)) {
            errors.push('Format tanggal lahir tidak valid');
        } else {
            const birthDate = new Date(data.tanggal_lahir);
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();

            if (age < 0 || age > 150) {
                errors.push('Tanggal lahir tidak valid');
            }
        }

        // Validasi nomor HP (opsional)
        if (data.nomor_hp && typeof data.nomor_hp === 'string') {
            if (!validator.isMobilePhone(data.nomor_hp, 'id-ID')) {
                errors.push('Format nomor HP tidak valid');
            }
        }

        // Validasi alamat (opsional)
        if (data.alamat && typeof data.alamat === 'string') {
            if (data.alamat.length > 500) {
                errors.push('Alamat maksimal 500 karakter');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validasi data pemeriksaan fisik
     * @param {object} data - Data pemeriksaan fisik
     * @returns {object} - Hasil validasi
     */
    static validatePhysicalExamData(data) {
        const errors = [];

        // Validasi ID pasien
        if (!data.id_pasien || !validator.isInt(data.id_pasien.toString())) {
            errors.push('ID pasien tidak valid');
        }

        // Validasi tinggi badan
        if (data.tinggi_badan !== undefined) {
            const tinggi = parseFloat(data.tinggi_badan);
            if (isNaN(tinggi) || tinggi < 50 || tinggi > 250) {
                errors.push('Tinggi badan harus antara 50-250 cm');
            }
        }

        // Validasi berat badan
        if (data.berat_badan !== undefined) {
            const berat = parseFloat(data.berat_badan);
            if (isNaN(berat) || berat < 10 || berat > 300) {
                errors.push('Berat badan harus antara 10-300 kg');
            }
        }

        // Validasi lingkar perut
        if (data.lingkar_perut !== undefined) {
            const lingkar = parseFloat(data.lingkar_perut);
            if (isNaN(lingkar) || lingkar < 30 || lingkar > 200) {
                errors.push('Lingkar perut harus antara 30-200 cm');
            }
        }

        // Validasi tekanan darah sistolik
        if (data.tekanan_darah_sistolik !== undefined) {
            const sistolik = parseInt(data.tekanan_darah_sistolik);
            if (isNaN(sistolik) || sistolik < 50 || sistolik > 300) {
                errors.push('Tekanan darah sistolik harus antara 50-300 mmHg');
            }
        }

        // Validasi tekanan darah diastolik
        if (data.tekanan_darah_diastolik !== undefined) {
            const diastolik = parseInt(data.tekanan_darah_diastolik);
            if (isNaN(diastolik) || diastolik < 30 || diastolik > 200) {
                errors.push('Tekanan darah diastolik harus antara 30-200 mmHg');
            }
        }

        // Validasi catatan (opsional)
        if (data.catatan && typeof data.catatan === 'string') {
            if (data.catatan.length > 1000) {
                errors.push('Catatan maksimal 1000 karakter');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validasi data tes lanjutan
     * @param {object} data - Data tes lanjutan
     * @returns {object} - Hasil validasi
     */
    static validateAdvancedTestData(data) {
        const errors = [];

        // Validasi ID pasien
        if (!data.id_pasien || !validator.isInt(data.id_pasien.toString())) {
            errors.push('ID pasien tidak valid');
        }

        // Validasi gula darah
        if (data.gula_darah !== undefined) {
            const gulaDarah = parseFloat(data.gula_darah);
            if (isNaN(gulaDarah) || gulaDarah < 0 || gulaDarah > 1000) {
                errors.push('Kadar gula darah harus antara 0-1000 mg/dL');
            }
        }

        // Validasi catatan (opsional)
        if (data.catatan && typeof data.catatan === 'string') {
            if (data.catatan.length > 1000) {
                errors.push('Catatan maksimal 1000 karakter');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validasi data penilaian kesehatan
     * @param {object} data - Data penilaian kesehatan
     * @returns {object} - Hasil validasi
     */
    static validateHealthAssessmentData(data) {
        const errors = [];

        // Validasi ID pasien
        if (!data.id_pasien || !validator.isInt(data.id_pasien.toString())) {
            errors.push('ID pasien tidak valid');
        }

        // Validasi kategori penilaian
        const validCategories = ['normal', 'perlu_perhatian', 'rujukan'];
        if (!data.kategori_penilaian || !validCategories.includes(data.kategori_penilaian)) {
            errors.push('Kategori penilaian tidak valid');
        }

        // Validasi temuan (opsional)
        if (data.temuan && typeof data.temuan === 'string') {
            if (data.temuan.length > 2000) {
                errors.push('Temuan maksimal 2000 karakter');
            }
        }

        // Validasi rekomendasi (opsional)
        if (data.rekomendasi && typeof data.rekomendasi === 'string') {
            if (data.rekomendasi.length > 2000) {
                errors.push('Rekomendasi maksimal 2000 karakter');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validasi data pengobatan
     * @param {object} data - Data pengobatan
     * @returns {object} - Hasil validasi
     */
    static validateTreatmentData(data) {
        const errors = [];

        // Validasi ID pasien
        if (!data.id_pasien || !validator.isInt(data.id_pasien.toString())) {
            errors.push('ID pasien tidak valid');
        }

        // Validasi nama obat (opsional)
        if (data.nama_obat && typeof data.nama_obat === 'string') {
            if (data.nama_obat.length > 100) {
                errors.push('Nama obat maksimal 100 karakter');
            }
        }

        // Validasi dosis (opsional)
        if (data.dosis && typeof data.dosis === 'string') {
            if (data.dosis.length > 50) {
                errors.push('Dosis maksimal 50 karakter');
            }
        }

        // Validasi frekuensi (opsional)
        if (data.frekuensi && typeof data.frekuensi === 'string') {
            if (data.frekuensi.length > 50) {
                errors.push('Frekuensi maksimal 50 karakter');
            }
        }

        // Validasi durasi (opsional)
        if (data.durasi && typeof data.durasi === 'string') {
            if (data.durasi.length > 50) {
                errors.push('Durasi maksimal 50 karakter');
            }
        }

        // Validasi instruksi (opsional)
        if (data.instruksi && typeof data.instruksi === 'string') {
            if (data.instruksi.length > 1000) {
                errors.push('Instruksi maksimal 1000 karakter');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validasi data rujukan
     * @param {object} data - Data rujukan
     * @returns {object} - Hasil validasi
     */
    static validateReferralData(data) {
        const errors = [];

        // Validasi ID pasien
        if (!data.id_pasien || !validator.isInt(data.id_pasien.toString())) {
            errors.push('ID pasien tidak valid');
        }

        // Validasi nama fasilitas
        if (!data.nama_fasilitas || typeof data.nama_fasilitas !== 'string' || data.nama_fasilitas.trim().length === 0) {
            errors.push('Nama fasilitas wajib diisi');
        } else if (data.nama_fasilitas.length > 100) {
            errors.push('Nama fasilitas maksimal 100 karakter');
        }

        // Validasi alasan
        if (!data.alasan || typeof data.alasan !== 'string' || data.alasan.trim().length === 0) {
            errors.push('Alasan rujukan wajib diisi');
        } else if (data.alasan.length > 2000) {
            errors.push('Alasan rujukan maksimal 2000 karakter');
        }

        // Validasi status (opsional)
        if (data.status) {
            const validStatuses = ['menunggu', 'selesai', 'dibatalkan'];
            if (!validStatuses.includes(data.status)) {
                errors.push('Status rujukan tidak valid');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validasi kredensial login
     * @param {object} data - Data login
     * @returns {object} - Hasil validasi
     */
    static validateLoginCredentials(data) {
        const errors = [];

        // Validasi nama pengguna
        if (!data.nama_pengguna || typeof data.nama_pengguna !== 'string' || data.nama_pengguna.trim().length === 0) {
            errors.push('Nama pengguna wajib diisi');
        } else if (data.nama_pengguna.length < 3 || data.nama_pengguna.length > 50) {
            errors.push('Nama pengguna harus antara 3-50 karakter');
        }

        // Validasi kata sandi
        if (!data.kata_sandi || typeof data.kata_sandi !== 'string' || data.kata_sandi.length === 0) {
            errors.push('Kata sandi wajib diisi');
        } else if (data.kata_sandi.length < 6) {
            errors.push('Kata sandi minimal 6 karakter');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = ValidationUtils;