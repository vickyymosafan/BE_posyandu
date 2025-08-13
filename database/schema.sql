-- Posyandu Management System Database Schema
-- Created for managing elderly patient care at posyandu

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS log_akses;
DROP TABLE IF EXISTS rujukan;
DROP TABLE IF EXISTS pengobatan;
DROP TABLE IF EXISTS penilaian_kesehatan;
DROP TABLE IF EXISTS tes_lanjutan;
DROP TABLE IF EXISTS pemeriksaan_fisik;
DROP TABLE IF EXISTS pasien;
DROP TABLE IF EXISTS admin;

-- 1. Admin table for system administrators
CREATE TABLE admin (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nama_pengguna VARCHAR(50) UNIQUE NOT NULL,
    hash_kata_sandi VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    aktif BOOLEAN DEFAULT TRUE,
    dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    diperbarui_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    login_terakhir TIMESTAMP NULL,
    INDEX idx_nama_pengguna (nama_pengguna),
    INDEX idx_email (email),
    INDEX idx_aktif (aktif)
);

-- 2. Patient table for elderly patients
CREATE TABLE pasien (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pasien VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL,
    nik VARCHAR(16) UNIQUE NOT NULL,
    nomor_kk VARCHAR(16) NOT NULL,
    tanggal_lahir DATE NOT NULL,
    nomor_hp VARCHAR(15),
    alamat TEXT,
    path_barcode VARCHAR(255),
    dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    diperbarui_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    dibuat_oleh INT,
    FOREIGN KEY (dibuat_oleh) REFERENCES admin(id),
    INDEX idx_id_pasien (id_pasien),
    INDEX idx_nik (nik),
    INDEX idx_nama (nama),
    INDEX idx_nomor_hp (nomor_hp),
    INDEX idx_dibuat_pada (dibuat_pada)
);

-- 3. Physical examination table
CREATE TABLE pemeriksaan_fisik (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pasien INT NOT NULL,
    tinggi_badan DECIMAL(5,2),
    berat_badan DECIMAL(5,2),
    lingkar_perut DECIMAL(5,2),
    tekanan_darah_sistolik INT,
    tekanan_darah_diastolik INT,
    tanggal_pemeriksaan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    diperiksa_oleh INT NOT NULL,
    catatan TEXT,
    FOREIGN KEY (id_pasien) REFERENCES pasien(id) ON DELETE CASCADE,
    FOREIGN KEY (diperiksa_oleh) REFERENCES admin(id),
    INDEX idx_id_pasien (id_pasien),
    INDEX idx_tanggal_pemeriksaan (tanggal_pemeriksaan),
    INDEX idx_diperiksa_oleh (diperiksa_oleh)
);

-- 4. Advanced health tests table
CREATE TABLE tes_lanjutan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pasien INT NOT NULL,
    gula_darah DECIMAL(5,2),
    tanggal_tes TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dites_oleh INT NOT NULL,
    catatan TEXT,
    FOREIGN KEY (id_pasien) REFERENCES pasien(id) ON DELETE CASCADE,
    FOREIGN KEY (dites_oleh) REFERENCES admin(id),
    INDEX idx_id_pasien (id_pasien),
    INDEX idx_tanggal_tes (tanggal_tes),
    INDEX idx_dites_oleh (dites_oleh)
);

-- 5. Health assessment table
CREATE TABLE penilaian_kesehatan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pasien INT NOT NULL,
    id_pemeriksaan_fisik INT,
    id_tes_lanjutan INT,
    kategori_penilaian ENUM('normal', 'perlu_perhatian', 'rujukan') NOT NULL,
    temuan TEXT,
    rekomendasi TEXT,
    tanggal_penilaian TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dinilai_oleh INT NOT NULL,
    FOREIGN KEY (id_pasien) REFERENCES pasien(id) ON DELETE CASCADE,
    FOREIGN KEY (id_pemeriksaan_fisik) REFERENCES pemeriksaan_fisik(id),
    FOREIGN KEY (id_tes_lanjutan) REFERENCES tes_lanjutan(id),
    FOREIGN KEY (dinilai_oleh) REFERENCES admin(id),
    INDEX idx_id_pasien (id_pasien),
    INDEX idx_kategori_penilaian (kategori_penilaian),
    INDEX idx_tanggal_penilaian (tanggal_penilaian),
    INDEX idx_dinilai_oleh (dinilai_oleh)
);

-- 6. Treatment/medication table
CREATE TABLE pengobatan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pasien INT NOT NULL,
    id_penilaian INT,
    nama_obat VARCHAR(100),
    dosis VARCHAR(50),
    frekuensi VARCHAR(50),
    durasi VARCHAR(50),
    instruksi TEXT,
    tanggal_resep TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    diresepkan_oleh INT NOT NULL,
    FOREIGN KEY (id_pasien) REFERENCES pasien(id) ON DELETE CASCADE,
    FOREIGN KEY (id_penilaian) REFERENCES penilaian_kesehatan(id),
    FOREIGN KEY (diresepkan_oleh) REFERENCES admin(id),
    INDEX idx_id_pasien (id_pasien),
    INDEX idx_id_penilaian (id_penilaian),
    INDEX idx_tanggal_resep (tanggal_resep),
    INDEX idx_diresepkan_oleh (diresepkan_oleh)
);

-- 7. Referral table
CREATE TABLE rujukan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_pasien INT NOT NULL,
    id_penilaian INT,
    nama_fasilitas VARCHAR(100) NOT NULL,
    alasan TEXT NOT NULL,
    tanggal_rujukan TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dirujuk_oleh INT NOT NULL,
    status ENUM('menunggu', 'selesai', 'dibatalkan') DEFAULT 'menunggu',
    FOREIGN KEY (id_pasien) REFERENCES pasien(id) ON DELETE CASCADE,
    FOREIGN KEY (id_penilaian) REFERENCES penilaian_kesehatan(id),
    FOREIGN KEY (dirujuk_oleh) REFERENCES admin(id),
    INDEX idx_id_pasien (id_pasien),
    INDEX idx_id_penilaian (id_penilaian),
    INDEX idx_status (status),
    INDEX idx_tanggal_rujukan (tanggal_rujukan),
    INDEX idx_dirujuk_oleh (dirujuk_oleh)
);

-- 8. Access log table for audit trail
CREATE TABLE log_akses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_admin INT,
    id_pasien INT,
    aksi VARCHAR(50) NOT NULL,
    alamat_ip VARCHAR(45),
    user_agent TEXT,
    waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_admin) REFERENCES admin(id),
    FOREIGN KEY (id_pasien) REFERENCES pasien(id),
    INDEX idx_id_admin (id_admin),
    INDEX idx_id_pasien (id_pasien),
    INDEX idx_aksi (aksi),
    INDEX idx_waktu (waktu)
);