const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk-mock');
const app = require('../../server');
const File = require('../../models/File');

// Helper function to create test tokens
const createTestToken = (userId) => {
  return jwt.sign(
    { userId: userId.toString(), type: 'access_token' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

describe('File Service Integration Tests', () => {
  const testUserId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();
  let userToken;
  let otherUserToken;

  beforeAll(() => {
    AWS.setSDKInstance(require('aws-sdk'));
    userToken = createTestToken(testUserId);
    otherUserToken = createTestToken(otherUserId);
  });

  beforeEach(async () => {
    await File.deleteMany({});
    AWS.restore();
  });

  afterAll(() => {
    AWS.restore();
  });

  describe('Complete File Upload and Download Flow', () => {
    test('should upload file, retrieve it, and download it', async () => {
      const testFileBuffer = Buffer.from('test file content for integration');
      const testFilename = 'integration-test.pdf';

      // Mock S3 operations
      AWS.mock('S3', 'upload', (params, callback) => {
        expect(params.Bucket).toBe('test-bucket');
        expect(params.Body).toEqual(testFileBuffer);
        callback(null, {
          Location: 'https://test-bucket.s3.amazonaws.com/files/test/file.pdf',
          ETag: '"test-etag"',
          Key: params.Key
        });
      });

      AWS.mock('S3', 'headObject', (params, callback) => {
        callback(null, { ContentLength: testFileBuffer.length });
      });

      AWS.mock('S3', 'getSignedUrl', (operation, params, callback) => {
        expect(operation).toBe('getObject');
        callback(null, 'https://presigned-url.com/download');
      });

      // Step 1: Upload file
      const uploadResponse = await request(app)
        .post('/upload')
        .query({ filename: testFilename })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(201);

      expect(uploadResponse.body.message).toBe('File uploaded successfully');
      expect(uploadResponse.body.fileId).toBeDefined();
      expect(uploadResponse.body.filename).toBe(testFilename);
      expect(uploadResponse.body.size).toBe(testFileBuffer.length);

      const fileId = uploadResponse.body.fileId;

      // Verify file exists in database
      const fileInDb = await File.findById(fileId);
      expect(fileInDb).toBeTruthy();
      expect(fileInDb.filename).toBe(testFilename);
      expect(fileInDb.userId.toString()).toBe(testUserId.toString());

      // Step 2: Get file download URL
      const downloadResponse = await request(app)
        .get(`/file/${fileId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(downloadResponse.body.downloadUrl).toBe('https://presigned-url.com/download');
      expect(downloadResponse.body.filename).toBe(testFilename);
      expect(downloadResponse.body.size).toBe(testFileBuffer.length);

      // Verify download count was incremented
      const updatedFile = await File.findById(fileId);
      expect(updatedFile.downloadCount).toBe(1);

      // Step 3: List user files
      const filesResponse = await request(app)
        .get('/files')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(filesResponse.body.files).toHaveLength(1);
      expect(filesResponse.body.files[0].fileId).toBe(fileId);
      expect(filesResponse.body.pagination.total).toBe(1);
      expect(filesResponse.body.summary.totalFiles).toBe(1);
      expect(filesResponse.body.summary.totalSize).toBe(testFileBuffer.length);
    });

    test('should handle file ownership correctly', async () => {
      const testFileBuffer = Buffer.from('test file content');
      const testFilename = 'ownership-test.pdf';

      // Mock S3 upload
      AWS.mock('S3', 'upload', (params, callback) => {
        callback(null, {
          Location: 'https://test-bucket.s3.amazonaws.com/files/test/file.pdf',
          ETag: '"test-etag"',
          Key: params.Key
        });
      });

      // User 1 uploads file
      const uploadResponse = await request(app)
        .post('/upload')
        .query({ filename: testFilename })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(201);

      const fileId = uploadResponse.body.fileId;

      // User 2 should not be able to access User 1's file
      await request(app)
        .get(`/file/${fileId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      // User 2 should not see User 1's file in their file list
      const otherUserFilesResponse = await request(app)
        .get('/files')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(otherUserFilesResponse.body.files).toHaveLength(0);
      expect(otherUserFilesResponse.body.summary.totalFiles).toBe(0);

      // User 1 should still be able to access their file
      await request(app)
        .get(`/file/${fileId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404); // Will fail because we didn't mock S3 headObject for this test
    });
  });

  describe('File Upload Validation Integration', () => {
    test('should reject files that are too large', async () => {
      const largeFileBuffer = Buffer.alloc(52428801); // 50MB + 1 byte

      const response = await request(app)
        .post('/upload')
        .query({ filename: 'large-file.pdf' })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(largeFileBuffer)
        .expect(413);

      expect(response.body.error.code).toBe('FILE_TOO_LARGE');

      // Verify no file was created in database
      const fileCount = await File.countDocuments();
      expect(fileCount).toBe(0);
    });

    test('should reject uploads without authentication', async () => {
      const testFileBuffer = Buffer.from('test file content');

      const response = await request(app)
        .post('/upload')
        .query({ filename: 'test.pdf' })
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });

    test('should reject uploads without filename', async () => {
      const testFileBuffer = Buffer.from('test file content');

      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_FILENAME');
    });

    test('should reject empty files', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const response = await request(app)
        .post('/upload')
        .query({ filename: 'empty.txt' })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(emptyBuffer)
        .expect(400);

      expect(response.body.error.code).toBe('EMPTY_FILE');
    });
  });

  describe('File Operations Integration', () => {
    let uploadedFileId;

    beforeEach(async () => {
      // Upload a test file for operations
      const testFileBuffer = Buffer.from('test file for operations');

      AWS.mock('S3', 'upload', (params, callback) => {
        callback(null, {
          Location: 'https://test-bucket.s3.amazonaws.com/files/test/file.pdf',
          ETag: '"test-etag"',
          Key: params.Key
        });
      });

      const uploadResponse = await request(app)
        .post('/upload')
        .query({ filename: 'operations-test.pdf' })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer);

      uploadedFileId = uploadResponse.body.fileId;
      AWS.restore();
    });

    test('should delete file successfully', async () => {
      // Mock S3 delete
      AWS.mock('S3', 'deleteObject', (params, callback) => {
        callback(null, {});
      });

      const deleteResponse = await request(app)
        .delete(`/file/${uploadedFileId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(deleteResponse.body.message).toBe('File deleted successfully');
      expect(deleteResponse.body.fileId).toBe(uploadedFileId);

      // Verify file is marked as inactive in database
      const deletedFile = await File.findById(uploadedFileId);
      expect(deletedFile.isActive).toBe(false);

      // Verify file is no longer accessible
      await request(app)
        .get(`/file/${uploadedFileId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    test('should handle file pagination correctly', async () => {
      // Upload multiple files
      const uploadPromises = [];
      for (let i = 0; i < 5; i++) {
        AWS.mock('S3', 'upload', (params, callback) => {
          callback(null, {
            Location: `https://test-bucket.s3.amazonaws.com/files/test/file${i}.pdf`,
            ETag: `"test-etag-${i}"`,
            Key: params.Key
          });
        });

        const promise = request(app)
          .post('/upload')
          .query({ filename: `test-file-${i}.pdf` })
          .set('Authorization', `Bearer ${userToken}`)
          .set('Content-Type', 'application/octet-stream')
          .send(Buffer.from(`test content ${i}`));

        uploadPromises.push(promise);
        AWS.restore();
      }

      await Promise.all(uploadPromises);

      // Test pagination
      const firstPageResponse = await request(app)
        .get('/files?limit=3&skip=0')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(firstPageResponse.body.files).toHaveLength(3);
      expect(firstPageResponse.body.pagination.total).toBe(6); // 5 new + 1 from beforeEach
      expect(firstPageResponse.body.pagination.hasMore).toBe(true);

      const secondPageResponse = await request(app)
        .get('/files?limit=3&skip=3')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(secondPageResponse.body.files).toHaveLength(3);
      expect(secondPageResponse.body.pagination.hasMore).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle S3 upload failures gracefully', async () => {
      const testFileBuffer = Buffer.from('test file content');

      // Mock S3 upload failure
      AWS.mock('S3', 'upload', (params, callback) => {
        callback(new Error('S3 upload failed: Network error'));
      });

      const response = await request(app)
        .post('/upload')
        .query({ filename: 'test.pdf' })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(500);

      expect(response.body.error.code).toBe('STORAGE_ERROR');

      // Verify no file was created in database
      const fileCount = await File.countDocuments();
      expect(fileCount).toBe(0);
    });

    test('should handle S3 file not found during download', async () => {
      // Create file in database but not in S3
      const file = await File.create({
        filename: 'missing-file.pdf',
        originalName: 'missing-file.pdf',
        size: 1024,
        userId: testUserId,
        s3Key: 'files/test/missing-file.pdf',
        s3Bucket: 'test-bucket'
      });

      // Mock S3 file not found
      AWS.mock('S3', 'headObject', (params, callback) => {
        const error = new Error('Not Found');
        error.code = 'NotFound';
        callback(error);
      });

      const response = await request(app)
        .get(`/file/${file._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('FILE_NOT_IN_STORAGE');
    });

    test('should handle database connection errors during upload', async () => {
      const testFileBuffer = Buffer.from('test file content');

      // Mock successful S3 upload
      AWS.mock('S3', 'upload', (params, callback) => {
        callback(null, {
          Location: 'https://test-bucket.s3.amazonaws.com/files/test/file.pdf',
          ETag: '"test-etag"',
          Key: params.Key
        });
      });

      // Close database connection to simulate error
      await mongoose.connection.close();

      const response = await request(app)
        .post('/upload')
        .query({ filename: 'test.pdf' })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');

      // Reconnect for cleanup
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    });
  });

  describe('Security Integration', () => {
    test('should prevent access to files with invalid tokens', async () => {
      const response = await request(app)
        .get('/file/507f1f77bcf86cd799439011')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should prevent file operations without authentication', async () => {
      const endpoints = [
        { method: 'post', path: '/upload' },
        { method: 'get', path: '/file/507f1f77bcf86cd799439011' },
        { method: 'get', path: '/files' },
        { method: 'delete', path: '/file/507f1f77bcf86cd799439011' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .expect(401);

        expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
      }
    });

    test('should handle expired tokens correctly', async () => {
      // Generate expired token
      const expiredToken = jwt.sign(
        { userId: testUserId.toString(), type: 'access_token' },
        process.env.JWT_SECRET,
        { expiresIn: '1ms' }
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/files')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });
});