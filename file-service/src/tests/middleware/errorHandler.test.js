const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { errorHandler, notFoundHandler, asyncHandler, timeoutHandler, fileUploadErrorHandler } = require('../../middleware/errorHandler');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Test routes
  app.get('/test-s3-upload-error', (req, res, next) => {
    const error = new Error('S3 upload failed: Network error');
    next(error);
  });

  app.get('/test-presigned-url-error', (req, res, next) => {
    const error = new Error('Failed to generate presigned URL: Access denied');
    next(error);
  });

  app.get('/test-duplicate-file', (req, res, next) => {
    const error = new Error('File with this S3 key already exists');
    next(error);
  });

  app.get('/test-file-not-in-s3', (req, res, next) => {
    const error = new Error('File not found in S3');
    next(error);
  });

  app.get('/test-entity-too-large', (req, res, next) => {
    const error = new Error('Request entity too large');
    error.type = 'entity.too.large';
    next(error);
  });

  app.get('/test-validation-error', (req, res, next) => {
    const error = new mongoose.Error.ValidationError();
    error.addError('filename', new mongoose.Error.ValidatorError({
      message: 'Filename is required',
      path: 'filename',
      value: ''
    }));
    next(error);
  });

  app.get('/test-cast-error', (req, res, next) => {
    const error = new mongoose.Error.CastError('ObjectId', 'invalid-id', '_id');
    next(error);
  });

  app.get('/test-duplicate-error', (req, res, next) => {
    const error = new Error('Duplicate key error');
    error.code = 11000;
    error.keyPattern = { s3Key: 1 };
    next(error);
  });

  app.get('/test-jwt-error', (req, res, next) => {
    const error = new Error('Invalid token');
    error.name = 'JsonWebTokenError';
    next(error);
  });

  app.get('/test-mongo-error', (req, res, next) => {
    const error = new Error('Connection failed');
    error.name = 'MongoServerError';
    next(error);
  });

  app.get('/test-generic-error', (req, res, next) => {
    const error = new Error('Something went wrong');
    next(error);
  });

  app.get('/test-file-limit-size', (req, res, next) => {
    const error = new Error('File too large');
    error.code = 'LIMIT_FILE_SIZE';
    next(error);
  });

  app.get('/test-unexpected-file', (req, res, next) => {
    const error = new Error('Unexpected file');
    error.code = 'LIMIT_UNEXPECTED_FILE';
    next(error);
  });

  app.get('/test-async-handler', asyncHandler(async (req, res) => {
    throw new Error('Async error');
  }));

  // File upload error handler
  app.use(fileUploadErrorHandler);

  // Error handling middleware
  app.use('*', notFoundHandler);
  app.use(errorHandler);

  return app;
};

describe('Error Handler Middleware (File Service)', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('errorHandler', () => {
    test('should handle S3 upload errors', async () => {
      const response = await request(app)
        .get('/test-s3-upload-error')
        .expect(500);

      expect(response.body.error.message).toBe('Failed to upload file to storage');
      expect(response.body.error.code).toBe('STORAGE_ERROR');
    });

    test('should handle presigned URL generation errors', async () => {
      const response = await request(app)
        .get('/test-presigned-url-error')
        .expect(500);

      expect(response.body.error.message).toBe('Failed to generate download URL');
      expect(response.body.error.code).toBe('URL_GENERATION_ERROR');
    });

    test('should handle duplicate file errors', async () => {
      const response = await request(app)
        .get('/test-duplicate-file')
        .expect(409);

      expect(response.body.error.message).toBe('File already exists');
      expect(response.body.error.code).toBe('DUPLICATE_FILE');
    });

    test('should handle file not found in S3 errors', async () => {
      const response = await request(app)
        .get('/test-file-not-in-s3')
        .expect(404);

      expect(response.body.error.message).toBe('File not found in storage');
      expect(response.body.error.code).toBe('FILE_NOT_IN_STORAGE');
    });

    test('should handle entity too large errors', async () => {
      const response = await request(app)
        .get('/test-entity-too-large')
        .expect(413);

      expect(response.body.error.message).toBe('File size exceeds maximum limit');
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });

    test('should handle validation errors', async () => {
      const response = await request(app)
        .get('/test-validation-error')
        .expect(400);

      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details[0].field).toBe('filename');
    });

    test('should handle cast errors', async () => {
      const response = await request(app)
        .get('/test-cast-error')
        .expect(400);

      expect(response.body.error.message).toBe('Invalid data format');
      expect(response.body.error.code).toBe('INVALID_DATA');
      expect(response.body.error.details.field).toBe('_id');
    });

    test('should handle duplicate key errors', async () => {
      const response = await request(app)
        .get('/test-duplicate-error')
        .expect(409);

      expect(response.body.error.message).toBe('Duplicate entry found');
      expect(response.body.error.code).toBe('DUPLICATE_ENTRY');
      expect(response.body.error.details.field).toBe('s3Key');
    });

    test('should handle JWT errors', async () => {
      const response = await request(app)
        .get('/test-jwt-error')
        .expect(401);

      expect(response.body.error.message).toBe('Invalid authentication token');
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should handle MongoDB errors', async () => {
      const response = await request(app)
        .get('/test-mongo-error')
        .expect(503);

      expect(response.body.error.message).toBe('Database service unavailable');
      expect(response.body.error.code).toBe('DATABASE_ERROR');
    });

    test('should handle generic errors', async () => {
      const response = await request(app)
        .get('/test-generic-error')
        .expect(500);

      expect(response.body.error.message).toBe('Internal server error');
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    test('should include request information in error response', async () => {
      const response = await request(app)
        .get('/test-generic-error')
        .expect(500);

      expect(response.body.error.path).toBe('/test-generic-error');
      expect(response.body.error.method).toBe('GET');
      expect(response.body.error.timestamp).toBeDefined();
    });
  });

  describe('fileUploadErrorHandler', () => {
    test('should handle file size limit errors', async () => {
      const response = await request(app)
        .get('/test-file-limit-size')
        .expect(413);

      expect(response.body.error.message).toBe('File size exceeds maximum limit of 50MB');
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });

    test('should handle unexpected file errors', async () => {
      const response = await request(app)
        .get('/test-unexpected-file')
        .expect(400);

      expect(response.body.error.message).toBe('Unexpected file field');
      expect(response.body.error.code).toBe('UNEXPECTED_FILE');
    });
  });

  describe('notFoundHandler', () => {
    test('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body.error.message).toBe('Route GET /non-existent-route not found');
      expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
      expect(response.body.error.path).toBe('/non-existent-route');
      expect(response.body.error.method).toBe('GET');
    });
  });

  describe('asyncHandler', () => {
    test('should catch async errors', async () => {
      const response = await request(app)
        .get('/test-async-handler')
        .expect(500);

      expect(response.body.error.message).toBe('Internal server error');
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});