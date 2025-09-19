const AWS = require('aws-sdk');
const { config } = require('../config/env');
const crypto = require('crypto');

// Generate UUID v4 using crypto
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class S3Service {
  constructor() {
    // Configure AWS SDK
    this.s3 = new AWS.S3({
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
      region: config.aws.region,
      signatureVersion: 'v4'
    });
    
    this.bucketName = config.aws.s3BucketName;
  }

  /**
   * Upload file buffer to S3
   * @param {Buffer} fileBuffer - File data as buffer
   * @param {string} filename - Original filename
   * @param {string} userId - User ID for organizing files
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Upload result with S3 key and metadata
   */
  async uploadToS3(fileBuffer, filename, userId, options = {}) {
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

      // Generate unique S3 key
      const fileExtension = this.getFileExtension(filename);
      const uniqueId = uuidv4();
      const s3Key = `files/${userId}/${uniqueId}${fileExtension}`;

      // Prepare upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: options.contentType || 'application/octet-stream',
        ContentLength: fileBuffer.length,
        ServerSideEncryption: 'AES256', // Enable server-side encryption
        Metadata: {
          originalFilename: filename,
          userId: userId,
          uploadedAt: new Date().toISOString(),
          ...(options.metadata || {})
        }
      };

      // Upload to S3
      const result = await this.s3.upload(uploadParams).promise();

      return {
        s3Key: s3Key,
        location: result.Location,
        etag: result.ETag,
        bucket: this.bucketName,
        size: fileBuffer.length,
        contentType: uploadParams.ContentType
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  } 
 /**
   * Generate presigned URL for file download
   * @param {string} s3Key - S3 key of the file
   * @param {Object} options - Options for presigned URL
   * @returns {Promise<string>} Presigned download URL
   */
  async generatePresignedUrl(s3Key, options = {}) {
    try {
      if (!s3Key || typeof s3Key !== 'string') {
        throw new Error('S3 key is required and must be a string');
      }

      // Check if file exists in S3
      const exists = await this.fileExists(s3Key);
      if (!exists) {
        throw new Error('File not found in S3');
      }

      const params = {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: options.expiresIn || 900, // Default 15 minutes
        ResponseContentDisposition: options.forceDownload 
          ? `attachment; filename="${options.filename || 'download'}"` 
          : undefined
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      
      return {
        downloadUrl: url,
        expiresIn: params.Expires,
        expiresAt: new Date(Date.now() + (params.Expires * 1000))
      };
    } catch (error) {
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Check if file exists in S3
   * @param {string} s3Key - S3 key of the file
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(s3Key) {
    try {
      await this.s3.headObject({
        Bucket: this.bucketName,
        Key: s3Key
      }).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata from S3
   * @param {string} s3Key - S3 key of the file
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(s3Key) {
    try {
      const result = await this.s3.headObject({
        Bucket: this.bucketName,
        Key: s3Key
      }).promise();

      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata
      };
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  } 
 /**
   * Delete file from S3
   * @param {string} s3Key - S3 key of the file
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteFile(s3Key) {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: s3Key
      }).promise();
      return true;
    } catch (error) {
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from S3
   * @param {Array<string>} s3Keys - Array of S3 keys
   * @returns {Promise<Object>} Deletion results
   */
  async deleteMultipleFiles(s3Keys) {
    try {
      if (!Array.isArray(s3Keys) || s3Keys.length === 0) {
        throw new Error('S3 keys array is required and must not be empty');
      }

      const deleteParams = {
        Bucket: this.bucketName,
        Delete: {
          Objects: s3Keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const result = await this.s3.deleteObjects(deleteParams).promise();
      
      return {
        deleted: result.Deleted || [],
        errors: result.Errors || []
      };
    } catch (error) {
      throw new Error(`Failed to delete multiple files: ${error.message}`);
    }
  }

  /**
   * Copy file within S3
   * @param {string} sourceKey - Source S3 key
   * @param {string} destinationKey - Destination S3 key
   * @returns {Promise<Object>} Copy result
   */
  async copyFile(sourceKey, destinationKey) {
    try {
      const copyParams = {
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey
      };

      const result = await this.s3.copyObject(copyParams).promise();
      
      return {
        etag: result.ETag,
        copySourceVersionId: result.CopySourceVersionId
      };
    } catch (error) {
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  }

  /**
   * List files in S3 bucket with prefix
   * @param {string} prefix - S3 key prefix (e.g., 'files/userId/')
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} Array of file objects
   */
  async listFiles(prefix, options = {}) {
    try {
      const listParams = {
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: options.maxKeys || 1000
      };

      if (options.continuationToken) {
        listParams.ContinuationToken = options.continuationToken;
      }

      const result = await this.s3.listObjectsV2(listParams).promise();
      
      return {
        files: result.Contents || [],
        isTruncated: result.IsTruncated,
        nextContinuationToken: result.NextContinuationToken
      };
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
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
   * Validate file size
   * @param {number} fileSize - File size in bytes
   * @returns {boolean} True if valid
   */
  validateFileSize(fileSize) {
    return fileSize > 0 && fileSize <= config.upload.maxFileSize;
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
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }
}

module.exports = new S3Service();