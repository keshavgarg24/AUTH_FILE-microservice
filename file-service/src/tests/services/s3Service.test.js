const AWS = require('aws-sdk-mock');
const s3Service = require('../../services/s3Service');

// Mock environment variables
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.MAX_FILE_SIZE = '52428800';

describe('S3Service', () => {
  const testUserId = '507f1f77bcf86cd799439011';
  const testFilename = 'test-file.pdf';
  const testFileBuffer = Buffer.from('test file content');

  beforeEach(() => {
    AWS.setSDKInstance(require('aws-sdk'));
  });

  afterEach(() => {
    AWS.restore();
  });

  describe('uploadToS3', () => {
    test('should upload file successfully', async () => {
      const mockUploadResult = {
        Location: 'https://test-bucket.s3.amazonaws.com/files/user123/test-file.pdf',
        ETag: '"test-etag"',
        Bucket: 'test-bucket',
        Key: 'files/user123/test-file.pdf'
      };

      AWS.mock('S3', 'upload', (params, callback) => {
        expect(params.Bucket).toBe('test-bucket');
        expect(params.Body).toBe(testFileBuffer);
        expect(params.Key).toMatch(/^files\/.*\/.*\.pdf$/);
        expect(params.ContentType).toBe('application/octet-stream');
        expect(params.ServerSideEncryption).toBe('AES256');
        callback(null, mockUploadResult);
      });

      const result = await s3Service.uploadToS3(testFileBuffer, testFilename, testUserId);

      expect(result.s3Key).toMatch(/^files\/.*\/.*\.pdf$/);
      expect(result.location).toBe(mockUploadResult.Location);
      expect(result.etag).toBe(mockUploadResult.ETag);
      expect(result.bucket).toBe('test-bucket');
      expect(result.size).toBe(testFileBuffer.length);
    });

    test('should throw error for invalid file buffer', async () => {
      await expect(s3Service.uploadToS3(null, testFilename, testUserId))
        .rejects.toThrow('File buffer is required and must be a Buffer');
    });

    test('should throw error for missing filename', async () => {
      await expect(s3Service.uploadToS3(testFileBuffer, '', testUserId))
        .rejects.toThrow('Filename is required and must be a string');
    });

    test('should throw error for missing user ID', async () => {
      await expect(s3Service.uploadToS3(testFileBuffer, testFilename, ''))
        .rejects.toThrow('User ID is required and must be a string');
    });

    test('should handle S3 upload error', async () => {
      AWS.mock('S3', 'upload', (params, callback) => {
        callback(new Error('S3 upload failed'));
      });

      await expect(s3Service.uploadToS3(testFileBuffer, testFilename, testUserId))
        .rejects.toThrow('S3 upload failed: S3 upload failed');
    });

    test('should upload with custom content type', async () => {
      AWS.mock('S3', 'upload', (params, callback) => {
        expect(params.ContentType).toBe('application/pdf');
        callback(null, { Location: 'test', ETag: 'test', Key: 'test' });
      });

      await s3Service.uploadToS3(testFileBuffer, testFilename, testUserId, {
        contentType: 'application/pdf'
      });
    });
  });

  describe('generatePresignedUrl', () => {
    const testS3Key = 'files/user123/test-file.pdf';

    test('should generate presigned URL successfully', async () => {
      const mockPresignedUrl = 'https://test-bucket.s3.amazonaws.com/presigned-url';

      AWS.mock('S3', 'headObject', (params, callback) => {
        expect(params.Bucket).toBe('test-bucket');
        expect(params.Key).toBe(testS3Key);
        callback(null, { ContentLength: 1024 });
      });

      AWS.mock('S3', 'getSignedUrl', (operation, params, callback) => {
        expect(operation).toBe('getObject');
        expect(params.Bucket).toBe('test-bucket');
        expect(params.Key).toBe(testS3Key);
        expect(params.Expires).toBe(900); // Default 15 minutes
        callback(null, mockPresignedUrl);
      });

      const result = await s3Service.generatePresignedUrl(testS3Key);

      expect(result.downloadUrl).toBe(mockPresignedUrl);
      expect(result.expiresIn).toBe(900);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    test('should throw error for non-existent file', async () => {
      AWS.mock('S3', 'headObject', (params, callback) => {
        const error = new Error('Not Found');
        error.code = 'NotFound';
        callback(error);
      });

      await expect(s3Service.generatePresignedUrl(testS3Key))
        .rejects.toThrow('Failed to generate presigned URL: File not found in S3');
    });

    test('should throw error for missing S3 key', async () => {
      await expect(s3Service.generatePresignedUrl(''))
        .rejects.toThrow('S3 key is required and must be a string');
    });

    test('should generate URL with custom expiration', async () => {
      AWS.mock('S3', 'headObject', (params, callback) => {
        callback(null, { ContentLength: 1024 });
      });

      AWS.mock('S3', 'getSignedUrl', (operation, params, callback) => {
        expect(params.Expires).toBe(3600); // 1 hour
        callback(null, 'test-url');
      });

      const result = await s3Service.generatePresignedUrl(testS3Key, { expiresIn: 3600 });
      expect(result.expiresIn).toBe(3600);
    });
  });

  describe('fileExists', () => {
    const testS3Key = 'files/user123/test-file.pdf';

    test('should return true for existing file', async () => {
      AWS.mock('S3', 'headObject', (params, callback) => {
        callback(null, { ContentLength: 1024 });
      });

      const exists = await s3Service.fileExists(testS3Key);
      expect(exists).toBe(true);
    });

    test('should return false for non-existent file', async () => {
      AWS.mock('S3', 'headObject', (params, callback) => {
        const error = new Error('Not Found');
        error.code = 'NotFound';
        callback(error);
      });

      const exists = await s3Service.fileExists(testS3Key);
      expect(exists).toBe(false);
    });

    test('should throw error for other S3 errors', async () => {
      AWS.mock('S3', 'headObject', (params, callback) => {
        callback(new Error('Access Denied'));
      });

      await expect(s3Service.fileExists(testS3Key))
        .rejects.toThrow('Access Denied');
    });
  });

  describe('getFileMetadata', () => {
    const testS3Key = 'files/user123/test-file.pdf';

    test('should get file metadata successfully', async () => {
      const mockMetadata = {
        ContentType: 'application/pdf',
        ContentLength: 1024,
        LastModified: new Date(),
        ETag: '"test-etag"',
        Metadata: { originalFilename: 'test.pdf' }
      };

      AWS.mock('S3', 'headObject', (params, callback) => {
        callback(null, mockMetadata);
      });

      const result = await s3Service.getFileMetadata(testS3Key);

      expect(result.contentType).toBe(mockMetadata.ContentType);
      expect(result.contentLength).toBe(mockMetadata.ContentLength);
      expect(result.etag).toBe(mockMetadata.ETag);
      expect(result.metadata).toBe(mockMetadata.Metadata);
    });

    test('should throw error for non-existent file', async () => {
      AWS.mock('S3', 'headObject', (params, callback) => {
        callback(new Error('Not Found'));
      });

      await expect(s3Service.getFileMetadata(testS3Key))
        .rejects.toThrow('Failed to get file metadata: Not Found');
    });
  });

  describe('deleteFile', () => {
    const testS3Key = 'files/user123/test-file.pdf';

    test('should delete file successfully', async () => {
      AWS.mock('S3', 'deleteObject', (params, callback) => {
        expect(params.Bucket).toBe('test-bucket');
        expect(params.Key).toBe(testS3Key);
        callback(null, {});
      });

      const result = await s3Service.deleteFile(testS3Key);
      expect(result).toBe(true);
    });

    test('should throw error on delete failure', async () => {
      AWS.mock('S3', 'deleteObject', (params, callback) => {
        callback(new Error('Delete failed'));
      });

      await expect(s3Service.deleteFile(testS3Key))
        .rejects.toThrow('Failed to delete file from S3: Delete failed');
    });
  });

  describe('Utility Methods', () => {
    test('should get file extension correctly', () => {
      expect(s3Service.getFileExtension('test.pdf')).toBe('.pdf');
      expect(s3Service.getFileExtension('file.name.txt')).toBe('.txt');
      expect(s3Service.getFileExtension('noextension')).toBe('');
    });

    test('should validate file size correctly', () => {
      expect(s3Service.validateFileSize(1000)).toBe(true);
      expect(s3Service.validateFileSize(52428800)).toBe(true); // Exactly 50MB
      expect(s3Service.validateFileSize(52428801)).toBe(false); // Over 50MB
      expect(s3Service.validateFileSize(0)).toBe(false);
      expect(s3Service.validateFileSize(-1)).toBe(false);
    });

    test('should get MIME type correctly', () => {
      expect(s3Service.getMimeType('test.pdf')).toBe('application/pdf');
      expect(s3Service.getMimeType('image.jpg')).toBe('image/jpeg');
      expect(s3Service.getMimeType('document.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(s3Service.getMimeType('unknown.xyz')).toBe('application/octet-stream');
    });
  });
});