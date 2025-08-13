const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

/**
 * Utilitas untuk generasi dan manajemen barcode pasien
 */
class BarcodeUtils {
  constructor() {
    this.uploadsDir = path.join(__dirname, '..', 'uploads', 'barcodes');
    this.ensureDirectoryExists();
  }

  /**
   * Memastikan direktori barcodes ada
   */
  async ensureDirectoryExists() {
    try {
      await fs.access(this.uploadsDir);
    } catch (error) {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Generate barcode untuk pasien
   * @param {string} patientId - ID pasien
   * @param {Object} options - Opsi untuk barcode
   * @returns {Promise<Object>} - Path file dan data barcode
   */
  async generatePatientBarcode(patientId, options = {}) {
    try {
      await this.ensureDirectoryExists();

      const barcodeData = {
        type: 'patient',
        id: patientId,
        timestamp: new Date().toISOString()
      };

      const barcodeString = JSON.stringify(barcodeData);
      const filename = `patient_${patientId}_${Date.now()}.png`;
      const filepath = path.join(this.uploadsDir, filename);

      // Konfigurasi QR Code
      const qrOptions = {
        type: 'png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: options.width || 256,
        ...options
      };

      // Generate QR Code dan simpan ke file
      await QRCode.toFile(filepath, barcodeString, qrOptions);

      return {
        success: true,
        filename,
        filepath,
        relativePath: `/uploads/barcodes/${filename}`,
        data: barcodeData
      };
    } catch (error) {
      console.error('Error generating barcode:', error);
      throw new Error('Gagal membuat barcode: ' + error.message);
    }
  }

  /**
   * Generate barcode sebagai buffer untuk response langsung
   * @param {string} patientId - ID pasien
   * @param {Object} options - Opsi untuk barcode
   * @returns {Promise<Buffer>} - Buffer barcode
   */
  async generateBarcodeBuffer(patientId, options = {}) {
    try {
      const barcodeData = {
        type: 'patient',
        id: patientId,
        timestamp: new Date().toISOString()
      };

      const barcodeString = JSON.stringify(barcodeData);

      // Konfigurasi QR Code
      const qrOptions = {
        type: 'png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: options.width || 256,
        ...options
      };

      // Generate QR Code sebagai buffer
      const buffer = await QRCode.toBuffer(barcodeString, qrOptions);
      
      return {
        success: true,
        buffer,
        data: barcodeData
      };
    } catch (error) {
      console.error('Error generating barcode buffer:', error);
      throw new Error('Gagal membuat barcode: ' + error.message);
    }
  }

  /**
   * Parse dan validasi barcode data
   * @param {string} barcodeString - String dari barcode yang dipindai
   * @returns {Object} - Data yang diparsing
   */
  parseBarcodeData(barcodeString) {
    try {
      const data = JSON.parse(barcodeString);
      
      // Validasi struktur data
      if (!data.type || !data.id) {
        throw new Error('Format barcode tidak valid');
      }

      if (data.type !== 'patient') {
        throw new Error('Tipe barcode tidak didukung');
      }

      return {
        success: true,
        patientId: data.id,
        timestamp: data.timestamp,
        data
      };
    } catch (error) {
      console.error('Error parsing barcode:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Hapus file barcode lama
   * @param {string} filename - Nama file barcode
   */
  async deleteBarcodeFile(filename) {
    try {
      const filepath = path.join(this.uploadsDir, filename);
      await fs.unlink(filepath);
      return { success: true };
    } catch (error) {
      console.error('Error deleting barcode file:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bersihkan file barcode lama (lebih dari 30 hari)
   */
  async cleanupOldBarcodes() {
    try {
      await this.ensureDirectoryExists();
      const files = await fs.readdir(this.uploadsDir);
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filepath = path.join(this.uploadsDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime.getTime() < thirtyDaysAgo) {
          await fs.unlink(filepath);
          console.log(`Deleted old barcode file: ${file}`);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error cleaning up old barcodes:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BarcodeUtils();