const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const fileController = require('../../controllers/fileController');
const { authenticateToken } = require('../../middleware/auth');
const File = require('../../models/File');

// Mock S3 service
jest.mock('../../services/s3Service', () => ({
  uploadToS3: jest.fn(),
  generatePresignedUrl: jest.fn(),
  fileExists: jest.fn(),
  deleteFile: jest.fn(),
  getMimeType: jest.fn().mockReturnValue('application/octet-stream')
}));

const s3Service = require('../../services/s3Service');

// Mock environment variables
process.env.MONGODB_URI = 'mongodb://localhost:27017/file_service_test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.MAX_FILE_SIZE = '52428800';

// Helper function to create test tokens
const createTestToken = (userId) => {
  return jwt.sign(
    { userId: userId.toString(), type: 'access_token' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));
  app.use(express.json());
  
  // File routes
  app.post('/upload', authenticateToken, fileController.uploadFile);
  app.get('/file/:id', authenticateToken, fileController.getFileDownloadUrl);
  app.get('/files', authenticateToken, fileController.getUserFiles);
  app.delete('/file/:id', authenticateToken, fileController.deleteFile);
  
  return app;
};

describe('FileController', () => {
  let app;
  const testUserId = new mongoose.Types.ObjectId();
  let userToken;

  beforeAll(async () => {
    const mongoUri = 'mongodb://localhost:27017/file_service_test';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    app = createTestApp();
    userToken = createTestToken(testUserId);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await File.deleteMany({});
    jest.clearAllMocks();
  });

  describe('POST /upload', () => {
    const testFileBuffer = Buffer.from('test file content');
    const testFilename = 'test-file.pdf';

    test('should upload file successfully', async () => {
      // Mock S3 service
      s3Service.uploadToS3.mockResolvedValue({
        s3Key: 'files/user123/test-file-uuid.pdf',
        location: 'https://bucket.s3.amazonaws.com/files/user123/test-file-uuid.pdf',
        etag: '"test-etag"',
        bucket: 'test-bucket',
        size: testFileBuffer.length,
        contentType: 'application/octet-stream'
      });

      const response = await request(app)
        .post('/upload')
        .query({ filename: testFilename })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(201);

      expect(response.body.message).toBe('File uploaded successfully');
      expect(response.body.fileId).toBeDefined();
      expect(response.body.filename).toBe(testFilename);
      expect(response.body.size).toBe(testFileBuffer.length);
      expect(response.body.s3Key).toBeDefined();
      expect(response.body.uploadedAt).toBeDefined();

      expect(s3Service.uploadToS3).toHaveBeenCalledWith(
        testFileBuffer,
        testFilename,
        testUserId.toString(),
        { contentType: 'application/octet-stream' }
      );
    });

    test('should reject upload without filename', async () => {
      const response = await request(app)
        .post('/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(400);

      expect(response.body.error.message).toBe('Filename query parameter is required');
      expect(response.body.error.code).toBe('MISSING_FILENAME');
    });

    test('should reject upload without authentication', async () => {
      const response = await request(app)
        .post('/upload')
        .query({ filename: testFilename })
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(401);

      expect(response.body.error.message).toBe('Authorization header is required');
    });

    test('should reject upload with empty file', async () => {
      const response = await request(app)
        .post('/upload')
        .query({ filename: testFilename })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.alloc(0))
        .expect(400);

      expect(response.body.error.message).toBe('File cannot be empty');
      expect(response.body.error.code).toBe('EMPTY_FILE');
    });

    test('should reject upload with file too large', async () => {
      const largeBuffer = Buffer.alloc(52428801); // 50MB + 1 byte
      
      const response = await request(app)
        .post('/upload')
        .query({ filename: testFilename })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(largeBuffer)
        .expect(413);

      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });

    test('should reject upload with filename too long', async () => {
      const longFilename = 'a'.repeat(256) + '.txt';
      
      const response = await request(app)
        .post('/upload')
        .query({ filename: longFilename })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(400);

      expect(response.body.error.message).toBe('Filename must be less than 255 characters');
      expect(response.body.error.code).toBe('FILENAME_TOO_LONG');
    });

    test('should handle S3 upload error', async () => {
      s3Service.uploadToS3.mockRejectedValue(new Error('S3 upload failed: Network error'));

      const response = await request(app)
        .post('/upload')
        .query({ filename: testFilename })
        .set('Authorization', `Bearer ${userToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(testFileBuffer)
        .expect(500);

      expect(response.body.error.message).toBe('Failed to upload file to storage');
      expect(response.body.error.code).toBe('STORAGE_ERROR');
    });
  });

  describe('GET /file/:id', () => {
    let testFile;

    beforeEach(async () => {
      // Create test file in database
      testFile = await File.create({
        filename: 'test-file.pdf',
        originalName: 'test-file.pdf',
        size: 1024,
        userId: testUserId,
        s3Key: 'files/user123/test-file-uuid.pdf',
        s3Bucket: 'test-bucket',
        mimeType: 'application/pdf'
      });
    });

    test('should get download URL successfully', async () => {
      // Mock S3 service
      s3Service.fileExists.mockResolvedValue(true);
      s3Service.generatePresignedUrl.mockResolvedValue({
        downloadUrl: 'https://presigned-url.com',
        expiresIn: 900,
        expiresAt: new Date(Date.now() + 900000)
      });

      const response = await request(app)
        .get(`/file/${testFile._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.downloadUrl).toBe('https://presigned-url.com');
      expect(response.body.filename).toBe(testFile.filename);
      expect(response.body.size).toBe(testFile.size);
      expect(response.body.expiresIn).toBe(900);

      expect(s3Service.fileExists).toHaveBeenCalledWith(testFile.s3Key);
      expect(s3Service.generatePresignedUrl).toHaveBeenCalledWith(
        testFile.s3Key,
        expect.objectContaining({
          expiresIn: 900,
          filename: testFile.filename
        })
      );
    });

    test('should reject request for non-existent file', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/file/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('File not found or access denied');
      expect(response.body.error.code).toBe('FILE_NOT_FOUND');
    });

    test('should reject request for file not owned by user', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherUserToken = createTestToken(otherUserId);
      
      const response = await request(app)
        .get(`/file/${testFile._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('File not found or access denied');
    });

    test('should handle file not found in S3', async () => {
      s3Service.fileExists.mockResolvedValue(false);

      const response = await request(app)
        .get(`/file/${testFile._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('File not found in storage');
      expect(response.body.error.code).toBe('FILE_NOT_IN_STORAGE');
    });

    test('should handle S3 error', async () => {
      s3Service.fileExists.mockResolvedValue(true);
      s3Service.generatePresignedUrl.mockRejectedValue(new Error('Failed to generate presigned URL: S3 error'));

      const response = await request(app)
        .get(`/file/${testFile._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(500);

      expect(response.body.error.message).toBe('Failed to generate download URL');
      expect(response.body.error.code).toBe('URL_GENERATION_ERROR');
    });
  });

  describe('GET /files', () => {
    beforeEach(async () => {
      // Create test files
      await File.create([
        {
          filename: 'file1.pdf',
          originalName: 'file1.pdf',
          size: 1024,
          userId: testUserId,
          s3Key: 'files/user123/file1.pdf',
          s3Bucket: 'test-bucket'
        },
        {
          filename: 'file2.txt',
          originalName: 'file2.txt',
          size: 2048,
          userId: testUserId,
          s3Key: 'files/user123/file2.txt',
          s3Bucket: 'test-bucket'
        }
      ]);
    });

    test('should get user files successfully', async () => {
      const response = await request(app)
        .get('/files')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.files).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.summary.totalFiles).toBe(2);
      expect(response.body.summary.totalSize).toBe(3072); // 1024 + 2048
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/files?limit=1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.files).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.hasMore).toBe(true);
    });

    test('should reject limit too high', async () => {
      const response = await request(app)
        .get('/files?limit=101')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.error.message).toBe('Limit cannot exceed 100');
    });
  });

  describe('DELETE /file/:id', () => {
    let testFile;

    beforeEach(async () => {
      testFile = await File.create({
        filename: 'test-file.pdf',
        originalName: 'test-file.pdf',
        size: 1024,
        userId: testUserId,
        s3Key: 'files/user123/test-file-uuid.pdf',
        s3Bucket: 'test-bucket'
      });
    });

    test('should delete file successfully', async () => {
      s3Service.deleteFile.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/file/${testFile._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.message).toBe('File deleted successfully');
      expect(response.body.fileId).toBe(testFile._id.toString());

      expect(s3Service.deleteFile).toHaveBeenCalledWith(testFile.s3Key);

      // Verify file is marked as inactive
      const deletedFile = await File.findById(testFile._id);
      expect(deletedFile.isActive).toBe(false);
    });

    test('should reject delete for non-existent file', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/file/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.error.message).toBe('File not found or access denied');
    });

    test('should continue deletion even if S3 deletion fails', async () => {
      s3Service.deleteFile.mockRejectedValue(new Error('S3 deletion failed'));

      const response = await request(app)
        .delete(`/file/${testFile._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.message).toBe('File deleted successfully');

      // Verify file is still marked as inactive despite S3 error
      const deletedFile = await File.findById(testFile._id);
      expect(deletedFile.isActive).toBe(false);
    });
  });
});