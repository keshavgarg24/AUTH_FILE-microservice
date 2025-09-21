const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Generate UUID v4 using crypto
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class LocalStorageService {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log('✓ Local storage directory ready:', this.uploadDir);
    } catch (error) {
      console.error('✗ Failed to create upload directory:', error.message);
    }
  }

  /**
   * Upload file buffer to local storage
   * @param {Buffer} fileBuffer - File data as buffer
   * @param {string} filename - Original filename
   * @param {string} userId - User ID for organizing files
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Upload result with local path and metadata
   */
  async uploadToLocal(fileBuffer, filename, userId, options = {}) {
    try {
      if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
        throw new Error('File buffer is required and must be a Buffer');
      }

      if (!filename || typeof filename !== 'string') {
        throw new Error('Filename is required and must be a string');
      }

      if (!userId || typeof userId !== 'string') {
        throw new Error('User ID is required and must be a string');
      }

      // Generate unique file path
      const fileExtension = this.getFileExtension(filename);
      const uniqueId = uuidv4();
      const fileName = `${uniqueId}${fileExtension}`;
      
      // Create user directory
      const userDir = path.join(this.uploadDir, userId);
      await fs.mkdir(userDir, { recursive: true });
      
      const filePath = path.join(userDir, fileName);
      const relativePath = path.join('uploads', userId, fileName);

      // Write file to disk
      await fs.writeFile(filePath, fileBuffer);

      // Create metadata file
      const metadata = {
        originalFilename: filename,
        userId: userId,
        uploadedAt: new Date().toISOString(),
        size: fileBuffer.length,
        contentType: options.contentType || 'application/octet-stream',
        ...(options.metadata || {})
      };

      const metadataPath = filePath + '.meta';
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return {
        localPath: relativePath,
        fullPath: filePath,
        fileName: fileName,
        size: fileBuffer.length,
        contentType: metadata.contentType,
        metadata: metadata
      };
    } catch (error) {
      throw new Error(`Local storage upload failed: ${error.message}`);
    }
  }

  /**
   * Check if file exists locally
   * @param {string} localPath - Local file path
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(localPath) {
    try {
      const fullPath = path.join(process.cwd(), localPath);
      await fs.access(fullPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file metadata from local storage
   * @param {string} localPath - Local file path
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(localPath) {
    try {
      const fullPath = path.join(process.cwd(), localPath);
      const metadataPath = fullPath + '.meta';
      
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      const stats = await fs.stat(fullPath);
      
      return {
        ...metadata,
        lastModified: stats.mtime,
        actualSize: stats.size
      };
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Delete file from local storage
   * @param {string} localPath - Local file path
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteFile(localPath) {
    try {
      const fullPath = path.join(process.cwd(), localPath);
      const metadataPath = fullPath + '.meta';
      
      // Delete both file and metadata
      await fs.unlink(fullPath);
      try {
        await fs.unlink(metadataPath);
      } catch (error) {
        // Metadata file might not exist, ignore error
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to delete file from local storage: ${error.message}`);
    }
  }

  /**
   * Get file extension from filename
   * @param {string} filename - Filename
   * @returns {string} File extension with dot (e.g., '.pdf')
   */
  getFileExtension(filename) {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }

  /**
   * Get MIME type from filename
   * @param {string} filename - Filename
   * @returns {string} MIME type
   */
  getMimeType(filename) {
    const extension = this.getFileExtension(filename).toLowerCase();
    
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.zip': 'application/zip'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }
}

module.exports = new LocalStorageService();