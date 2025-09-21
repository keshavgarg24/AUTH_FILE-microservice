const fileRepository = require('../repositories/fileRepository');
const s3Service = require('../services/s3Service');
const { config } = require('../config/env');

class FileController {
  /**
   * Upload file to S3 and save metadata
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async uploadFile(req, res) {
    try {
      // Get user ID from authentication middleware
      const userId = req.user.userId;
      
      // Get filename from query parameter
      const filename = req.query.filename;
      if (!filename) {
        return res.status(400).json({
          error: {
            message: 'Filename query parameter is required',
            code: 'MISSING_FILENAME'
          }
        });
      }

      // Validate filename
      if (filename.length > 255) {
        return res.status(400).json({
          error: {
            message: 'Filename must be less than 255 characters',
            code: 'FILENAME_TOO_LONG'
          }
        });
      }

      // Get file buffer from request body
      const fileBuffer = req.body;
      
      // Debug logging
      console.log('Upload Debug Info:');
      console.log('- Content-Type:', req.get('Content-Type'));
      console.log('- Body type:', typeof fileBuffer);
      console.log('- Is Buffer:', Buffer.isBuffer(fileBuffer));
      console.log('- Body length:', fileBuffer ? fileBuffer.length : 'undefined');
      console.log('- Filename:', filename);
      
      if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        return res.status(400).json({
          error: {
            message: 'File data is required in request body',
            code: 'MISSING_FILE_DATA',
            debug: {
              bodyType: typeof fileBuffer,
              isBuffer: Buffer.isBuffer(fileBuffer),
              bodyLength: fileBuffer ? fileBuffer.length : null,
              contentType: req.get('Content-Type')
            }
          }
        });
      }

      // Validate file size
      if (fileBuffer.length > config.upload.maxFileSize) {
        return res.status(413).json({
          error: {
            message: `File size exceeds maximum limit of ${config.upload.maxFileSize} bytes (50MB)`,
            code: 'FILE_TOO_LARGE'
          }
        });
      }

      if (fileBuffer.length === 0) {
        return res.status(400).json({
          error: {
            message: 'File cannot be empty',
            code: 'EMPTY_FILE'
          }
        });
      }

      // Determine content type
      const contentType = s3Service.getMimeType(filename);

      // Upload to S3
      const s3Result = await s3Service.uploadToS3(fileBuffer, filename, userId, {
        contentType: contentType
      });

      // Save file metadata to database
      const fileMetadata = {
        filename: filename,
        originalName: filename,
        size: fileBuffer.length,
        userId: userId,
        s3Key: s3Result.s3Key,
        s3Bucket: s3Result.bucket,
        mimeType: contentType
      };

      const savedFile = await fileRepository.create(fileMetadata);

      // Return success response
      res.status(201).json({
        message: 'File uploaded successfully',
        fileId: savedFile.fileId,
        filename: savedFile.filename,
        size: savedFile.size,
        s3Key: savedFile.s3Key,
        mimeType: savedFile.mimeType,
        uploadedAt: savedFile.uploadedAt
      });

    } catch (error) {
      console.error('File upload error:', error);

      // Handle specific S3 errors
      if (error.message.includes('S3 upload failed')) {
        return res.status(500).json({
          error: {
            message: 'Failed to upload file to storage',
            code: 'STORAGE_ERROR'
          }
        });
      }

      // Handle database errors
      if (error.message.includes('File with this S3 key already exists')) {
        return res.status(409).json({
          error: {
            message: 'File already exists',
            code: 'DUPLICATE_FILE'
          }
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: {
            message: 'File metadata validation failed',
            code: 'VALIDATION_ERROR',
            details: Object.values(error.errors).map(err => err.message)
          }
        });
      }

      // Generic server error
      res.status(500).json({
        error: {
          message: 'Internal server error during file upload',
          code: 'UPLOAD_ERROR'
        }
      });
    }
  }  /**

   * Get file download URL
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getFileDownloadUrl(req, res) {
    try {
      // Get user ID from authentication middleware
      const userId = req.user.userId;
      
      // Get file ID from URL parameter
      const fileId = req.params.id;
      if (!fileId) {
        return res.status(400).json({
          error: {
            message: 'File ID is required',
            code: 'MISSING_FILE_ID'
          }
        });
      }

      // Find file and verify ownership
      const file = await fileRepository.findByIdAndUserId(fileId, userId);
      if (!file) {
        return res.status(404).json({
          error: {
            message: 'File not found or access denied',
            code: 'FILE_NOT_FOUND'
          }
        });
      }

      // Check if file exists in S3
      const fileExists = await s3Service.fileExists(file.s3Key);
      if (!fileExists) {
        return res.status(404).json({
          error: {
            message: 'File not found in storage',
            code: 'FILE_NOT_IN_STORAGE'
          }
        });
      }

      // Generate presigned URL
      const urlResult = await s3Service.generatePresignedUrl(file.s3Key, {
        expiresIn: 900, // 15 minutes
        filename: file.filename,
        forceDownload: req.query.download === 'true'
      });

      // Increment download count
      await fileRepository.incrementDownloadCount(fileId);

      // Return download URL
      res.json({
        downloadUrl: urlResult.downloadUrl,
        filename: file.filename,
        size: file.size,
        mimeType: file.mimeType,
        expiresIn: urlResult.expiresIn,
        expiresAt: urlResult.expiresAt
      });

    } catch (error) {
      console.error('Get download URL error:', error);

      // Handle S3 errors
      if (error.message.includes('Failed to generate presigned URL')) {
        return res.status(500).json({
          error: {
            message: 'Failed to generate download URL',
            code: 'URL_GENERATION_ERROR'
          }
        });
      }

      // Generic server error
      res.status(500).json({
        error: {
          message: 'Internal server error while generating download URL',
          code: 'DOWNLOAD_ERROR'
        }
      });
    }
  }

  /**
   * Get user's files list
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserFiles(req, res) {
    try {
      const userId = req.user.userId;
      
      // Parse query parameters
      const limit = parseInt(req.query.limit) || 50;
      const skip = parseInt(req.query.skip) || 0;
      const sortBy = req.query.sortBy || 'uploadedAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

      // Validate limit
      if (limit > 100) {
        return res.status(400).json({
          error: {
            message: 'Limit cannot exceed 100',
            code: 'LIMIT_TOO_HIGH'
          }
        });
      }

      // Get files
      const files = await fileRepository.findByUserId(userId, {
        limit,
        skip,
        sort: { [sortBy]: sortOrder }
      });

      // Get total count
      const totalCount = await fileRepository.countByUserId(userId);
      const totalSize = await fileRepository.getTotalSizeByUserId(userId);

      res.json({
        files,
        pagination: {
          total: totalCount,
          limit,
          skip,
          hasMore: skip + files.length < totalCount
        },
        summary: {
          totalFiles: totalCount,
          totalSize: totalSize
        }
      });

    } catch (error) {
      console.error('Get user files error:', error);

      res.status(500).json({
        error: {
          message: 'Internal server error while fetching files',
          code: 'FETCH_FILES_ERROR'
        }
      });
    }
  }

  /**
   * Delete file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteFile(req, res) {
    try {
      const userId = req.user.userId;
      const fileId = req.params.id;

      if (!fileId) {
        return res.status(400).json({
          error: {
            message: 'File ID is required',
            code: 'MISSING_FILE_ID'
          }
        });
      }

      // Find file and verify ownership
      const file = await fileRepository.findByIdAndUserId(fileId, userId);
      if (!file) {
        return res.status(404).json({
          error: {
            message: 'File not found or access denied',
            code: 'FILE_NOT_FOUND'
          }
        });
      }

      // Delete from S3 (optional - you might want to keep files for recovery)
      try {
        await s3Service.deleteFile(file.s3Key);
      } catch (s3Error) {
        console.error('S3 deletion error:', s3Error);
        // Continue with database deletion even if S3 deletion fails
      }

      // Mark as deleted in database (soft delete)
      const deleted = await fileRepository.markAsDeleted(fileId, userId);
      if (!deleted) {
        return res.status(404).json({
          error: {
            message: 'File not found or already deleted',
            code: 'FILE_NOT_FOUND'
          }
        });
      }

      res.json({
        message: 'File deleted successfully',
        fileId: fileId
      });

    } catch (error) {
      console.error('Delete file error:', error);

      res.status(500).json({
        error: {
          message: 'Internal server error while deleting file',
          code: 'DELETE_ERROR'
        }
      });
    }
  }
}

module.exports = new FileController();