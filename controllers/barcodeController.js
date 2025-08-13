const barcodeUtils = require('../utils/barcode');
const { executeQuery } = require('../utils/database');
const path = require('path');
const fs = require('fs').promises;

/**
 * Controller untuk manajemen barcode pasien
 */
class BarcodeController {
  /**
   * Generate barcode untuk pasien
   * GET /api/pasien/:id/barcode
   */
  async generatePatientBarcode(req, res) {
    try {
      const { id } = req.params;
      const { format = 'png', download = false } = req.query;

      // Validasi pasien exists
      const patients = await executeQuery(
        'SELECT id, id_pasien, nama FROM pasien WHERE id = ?',
        [id]
      );

      if (patients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pasien tidak ditemukan'
        });
      }

      const patient = patients[0];

      if (format === 'png' && download) {
        // Generate barcode sebagai PNG untuk download
        const result = await barcodeUtils.generateBarcodeBuffer(patient.id_pasien);

        if (!result.success) {
          return res.status(500).json({
            sukses: false,
            pesan: 'Gagal membuat barcode'
          });
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="barcode_${patient.nama}_${patient.id_pasien}.png"`);
        return res.send(result.buffer);
      }

      // Default: return barcode info
      const barcodeResult = await barcodeUtils.generatePatientBarcode(patient.id_pasien);

      if (!barcodeResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Gagal membuat barcode'
        });
      }

      // Update path barcode di database
      await executeQuery(
        'UPDATE pasien SET path_barcode = ? WHERE id = ?',
        [barcodeResult.relativePath, id]
      );

      res.json({
        sukses: true,
        pesan: 'Barcode berhasil dibuat',
        data: {
          patient: {
            id: patient.id,
            id_pasien: patient.id_pasien,
            nama: patient.nama
          },
          barcode_path: barcodeResult.relativePath,
          download_url: `/api/pasien/${id}/barcode?format=png&download=true`
        }
      });

    } catch (error) {
      console.error('Error generating patient barcode:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Download barcode dalam format PDF
   * GET /api/pasien/:id/barcode/pdf
   */
  async downloadBarcodePDF(req, res) {
    try {
      const { id } = req.params;

      // Validasi pasien exists
      const patients = await executeQuery(
        'SELECT id, id_pasien, nama, nik, nomor_hp FROM pasien WHERE id = ?',
        [id]
      );

      if (patients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pasien tidak ditemukan'
        });
      }

      const patient = patients[0];

      // Generate barcode buffer
      const barcodeResult = await barcodeUtils.generateBarcodeBuffer(patient.id_pasien, { width: 200 });

      if (!barcodeResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Gagal membuat barcode'
        });
      }

      // Create simple PDF-like response (for now, we'll return PNG with PDF headers)
      // In a real implementation, you'd use a PDF library like PDFKit
      const pdfContent = this.createSimplePDFContent(patient, barcodeResult.buffer);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="barcode_${patient.nama}_${patient.id_pasien}.pdf"`);

      // For now, return the barcode as PNG (in real implementation, embed in PDF)
      res.setHeader('Content-Type', 'image/png');
      res.send(barcodeResult.buffer);

    } catch (error) {
      console.error('Error downloading barcode PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Scan dan validasi barcode
   * POST /api/barcode/scan
   */
  async scanBarcode(req, res) {
    try {
      const { barcodeData } = req.body;

      if (!barcodeData) {
        return res.status(400).json({
          success: false,
          message: 'Data barcode diperlukan'
        });
      }

      // Parse barcode data
      const parseResult = barcodeUtils.parseBarcodeData(barcodeData);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Barcode tidak valid: ' + parseResult.error
        });
      }

      const { patientId } = parseResult;

      // Cari pasien berdasarkan ID dari barcode
      const patients = await executeQuery(`
        SELECT 
          p.id, p.id_pasien, p.nama, p.nik, p.nomor_kk, 
          p.tanggal_lahir, p.nomor_hp, p.alamat, p.dibuat_pada,
          a.nama_lengkap as dibuat_oleh_nama
        FROM pasien p
        LEFT JOIN admin a ON p.dibuat_oleh = a.id
        WHERE p.id_pasien = ?
      `, [patientId]);

      if (patients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pasien tidak ditemukan untuk barcode ini'
        });
      }

      const patient = patients[0];

      // Ambil riwayat pemeriksaan terbaru
      const examinations = await executeQuery(`
        SELECT 
          pf.id, pf.tinggi_badan, pf.berat_badan, pf.lingkar_perut,
          pf.tekanan_darah_sistolik, pf.tekanan_darah_diastolik,
          pf.tanggal_pemeriksaan, pf.catatan,
          a.nama_lengkap as diperiksa_oleh_nama
        FROM pemeriksaan_fisik pf
        LEFT JOIN admin a ON pf.diperiksa_oleh = a.id
        WHERE pf.id_pasien = ?
        ORDER BY pf.tanggal_pemeriksaan DESC
        LIMIT 5
      `, [patient.id]);

      // Ambil tes lanjutan terbaru
      const advancedTests = await executeQuery(`
        SELECT 
          tl.id, tl.gula_darah, tl.tanggal_tes, tl.catatan,
          a.nama_lengkap as dites_oleh_nama
        FROM tes_lanjutan tl
        LEFT JOIN admin a ON tl.dites_oleh = a.id
        WHERE tl.id_pasien = ?
        ORDER BY tl.tanggal_tes DESC
        LIMIT 5
      `, [patient.id]);

      // Log akses barcode scan
      await executeQuery(`
        INSERT INTO log_akses (id_admin, id_pasien, aksi, alamat_ip, user_agent)
        VALUES (?, ?, 'barcode_scan', ?, ?)
      `, [
        req.admin?.id || null,
        patient.id,
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent') || ''
      ]);

      res.json({
        sukses: true,
        pesan: 'Barcode berhasil dipindai',
        data: {
          ...patient,
          tanggal_lahir: patient.tanggal_lahir ? patient.tanggal_lahir.toISOString().split('T')[0] : null
        }
      });

    } catch (error) {
      console.error('Error scanning barcode:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Validasi barcode tanpa mengambil data lengkap
   * POST /api/barcode/validate
   */
  async validateBarcode(req, res) {
    try {
      const { barcodeData } = req.body;

      if (!barcodeData) {
        return res.status(400).json({
          success: false,
          message: 'Data barcode diperlukan'
        });
      }

      // Parse barcode data
      const parseResult = barcodeUtils.parseBarcodeData(barcodeData);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Barcode tidak valid: ' + parseResult.error
        });
      }

      const { patientId } = parseResult;

      // Cek apakah pasien exists
      const patients = await executeQuery(
        'SELECT id, id_pasien, nama FROM pasien WHERE id_pasien = ?',
        [patientId]
      );

      if (patients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Pasien tidak ditemukan untuk barcode ini'
        });
      }

      res.json({
        success: true,
        message: 'Barcode valid',
        data: {
          valid: true,
          patientId: parseResult.patientId,
          patientName: patients[0].nama,
          timestamp: parseResult.timestamp
        }
      });

    } catch (error) {
      console.error('Error validating barcode:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Helper method untuk membuat konten PDF sederhana
   * (Dalam implementasi nyata, gunakan library PDF seperti PDFKit)
   */
  createSimplePDFContent(patient, barcodeBuffer) {
    // Placeholder untuk implementasi PDF
    // Dalam implementasi nyata, ini akan menggunakan library PDF
    return barcodeBuffer;
  }
}

module.exports = new BarcodeController();