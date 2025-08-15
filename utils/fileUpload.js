const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

/**
 * File Upload Utility optimized untuk Railway ephemeral storage
 */
class FileUploadUtils {
  constructor() {
    this.isRailway = !!(process.env.RAILWAY_ENVIRONMENT || 
                       process.env.RAILWAY_PROJECT_ID || 
                       process.env.DATABASE_URL);
    
    this.baseUploadPath = process.env.UPLOAD_PATH || 
                         (this.isRailway ? '/tmp/uploads' : './uploads');
    
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB default
    this.maxFileAge = this.isRailway ? 2 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 2 hours Railway, 7 days local
    
    this.ensureBaseDirectory();
    
    if (this.isRailway) {
      this.startAutoCleanup();
    }
  }

  /**
   * Ensure base upload directory exists
   */
  async ensureBaseDirectory() {
    try {
      await fs.access(this.baseUploadPath);
    } catch (error) {
      await fs.mkdir(this.baseUploadPath, { recursive: true });
      console.log(`Created upload directory: ${this.baseUploadPath}`);
    }
  }

  /**
   * Ensure specific subdirectory exists
   */
  async ensureSubDirectory(subDir) {
    const fullPath = path.join(this.baseUploadPath, subDir);
    try {
      await fs.access(fullPath);
    } catch (error) {
      await fs.mkdir(fullPath, { recursive: true });
    }
    return fullPath;
  }

  /**
   * Create multer storage configuration
   */
  createStorage(subDirectory = 'general') {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const uploadPath = await this.ensureSubDirectory(subDirectory);
          cb(null, uploadPath);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
        
        cb(null, `${sanitizedName}_${uniqueSuffix}${ext}`);
      }
    });
  }

  /**
   * Create file filter for allowed file types
   */
  createFileFilter(allowedTypes = ['image/jpeg', 'image/png', 'image/gif']) {
    return (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
      }
    };
  }

  /**
   * Create multer upload middleware
   */
  createUploadMiddleware(options = {}) {
    const {
      subDirectory = 'general',
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
      maxFiles = 1,
      fieldName = 'file'
    } = options;

    const upload = multer({
      storage: this.createStorage(subDirectory),
      fileFilter: this.createFileFilter(allowedTypes),
      limits: {
        fileSize: this.maxFileSize,
        files: maxFiles
      }
    });

    return maxFiles === 1 ? upload.single(fieldName) : upload.array(fieldName, maxFiles);
  }

  /**
   * Delete file with error handling
   */
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.warn(`Failed to delete file ${filePath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule file deletion for Railway ephemeral storage
   */
  scheduleFileDeletion(filePath, delay = this.maxFileAge) {
    if (this.isRailway) {
      setTimeout(() => {
        this.deleteFile(filePath).catch(error => {
          console.warn(`Scheduled deletion failed for ${filePath}:`, error.message);
        });
      }, delay);
    }
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(subDirectory = null) {
    try {
      const targetDir = subDirectory ? 
        path.join(this.baseUploadPath, subDirectory) : 
        this.baseUploadPath;

      const files = await fs.readdir(targetDir, { withFileTypes: true });
      const cutoffTime = Date.now() - this.maxFileAge;
      let deletedCount = 0;

      for (const file of files) {
        if (file.isFile()) {
          try {
            const filePath = path.join(targetDir, file.name);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
              await fs.unlink(filePath);
              deletedCount++;
            }
          } catch (fileError) {
            console.warn(`Could not process file ${file.name}:`, fileError.message);
          }
        }
      }

      return { 
        success: true, 
        deletedCount,
        directory: targetDir,
        environment: this.isRailway ? 'railway' : 'local'
      };
    } catch (error) {
      console.error('Error cleaning up old files:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start auto-cleanup for Railway
   */
  startAutoCleanup() {
    // Cleanup every 30 minutes
    setInterval(() => {
      this.cleanupOldFiles().catch(error => {
        console.error('Auto-cleanup failed:', error);
      });
    }, 30 * 60 * 1000);
    
    console.log('Railway auto-cleanup started for uploaded files');
  }

  /**
   * Get upload configuration info
   */
  getUploadInfo() {
    return {
      baseUploadPath: this.baseUploadPath,
      isRailway: this.isRailway,
      maxFileSize: this.maxFileSize,
      maxFileSizeMB: Math.round(this.maxFileSize / (1024 * 1024)),
      maxFileAge: this.maxFileAge,
      maxFileAgeHours: Math.round(this.maxFileAge / (60 * 60 * 1000)),
      ephemeral: this.isRailway
    };
  }
}

module.exports = new FileUploadUtils();