const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

/**
 * Utilitas untuk generasi dan manajemen barcode pasien
 * Optimized untuk Railway ephemeral storage
 */
class BarcodeUtils {
  constructor() {
    // Railway environment detection
    this.isRailway = !!(process.env.RAILWAY_ENVIRONMENT || 
                       process.env.RAILWAY_PROJECT_ID || 
                       process.env.DATABASE_URL);
    
    // Use Railway-appropriate upload path
    const baseUploadPath = process.env.UPLOAD_PATH || 
                          (this.isRailway ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads'));
    
    this.uploadsDir = path.join(baseUploadPath, 'barcodes');
    this.maxFileAge = this.isRailway ? 2 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000; // 2 hours for Railway, 30 days for local
    
    this.ensureDirectoryExists();
    
    // Auto-cleanup for Railway ephemeral storage
    if (this.isRailway) {
      this.startAutoCleanup();
    }
  }

  /**
   * Memastikan direktori barcodes ada
   * Enhanced untuk Railway ephemeral storage
   */
  async ensureDirectoryExists() {
    try {
      await fs.access(this.uploadsDir);
    } catch (error) {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      
      if (this.isRailway) {
        console.log(`Created Railway ephemeral upload directory: ${this.uploadsDir}`);
      }
    }
  }

  /**
   * Start auto-cleanup untuk Railway ephemeral storage
   */
  startAutoCleanup() {
    // Cleanup setiap 30 menit di Railway
    setInterval(() => {
      this.cleanupOldBarcodes().catch(error => {
        console.error('Auto-cleanup failed:', error);
      });
    }, 30 * 60 * 1000);
    
    console.log('Railway auto-cleanup started for barcode files');
  }

  /**
   * Generate barcode untuk pasien
   * Optimized untuk Railway ephemeral storage
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
        timestamp: new Date().toISOString(),
        railway: this.isRailway
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

      // Schedule cleanup untuk file ini jika di Railway
      if (this.isRailway) {
        setTimeout(() => {
          this.deleteBarcodeFile(filename).catch(error => {
            console.warn(`Failed to auto-delete barcode file ${filename}:`, error.message);
          });
        }, this.maxFileAge);
      }

      return {
        success: true,
        filename,
        filepath,
        relativePath: `/uploads/barcodes/${filename}`,
        data: barcodeData,
        ephemeral: this.isRailway,
        expiresAt: this.isRailway ? new Date(Date.now() + this.maxFileAge).toISOString() : null
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
   * Bersihkan file barcode lama
   * Railway: 2 jam, Local: 30 hari
   */
  async cleanupOldBarcodes() {
    try {
      await this.ensureDirectoryExists();
      const files = await fs.readdir(this.uploadsDir);
      const cutoffTime = Date.now() - this.maxFileAge;
      let deletedCount = 0;

      for (const file of files) {
        try {
          const filepath = path.join(this.uploadsDir, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filepath);
            deletedCount++;
            
            if (this.isRailway) {
              console.log(`Railway cleanup: Deleted barcode file: ${file}`);
            }
          }
        } catch (fileError) {
          // File might have been deleted already, continue with next file
          console.warn(`Could not process file ${file}:`, fileError.message);
        }
      }

      const result = { 
        success: true, 
        deletedCount,
        environment: this.isRailway ? 'railway' : 'local',
        maxAge: this.maxFileAge
      };

      if (deletedCount > 0) {
        console.log(`Cleanup completed: ${deletedCount} barcode files deleted`);
      }

      return result;
    } catch (error) {
      console.error('Error cleaning up old barcodes:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get storage information
   */
  getStorageInfo() {
    return {
      uploadsDir: this.uploadsDir,
      isRailway: this.isRailway,
      maxFileAge: this.maxFileAge,
      maxFileAgeHours: Math.round(this.maxFileAge / (60 * 60 * 1000)),
      ephemeral: this.isRailway
    };
  }
}

module.exports = new BarcodeUtils();