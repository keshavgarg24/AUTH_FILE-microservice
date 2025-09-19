const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { errorHandler, notFoundHandler, asyncHandler, timeoutHandler } = require('../../middleware/errorHandler');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Test routes
  app.get('/test-validation-error', (req, res, next) => {
    const error = new mongoose.Error.ValidationError();
    error.addError('email', new mongoose.Error.ValidatorError({
      message: 'Email is required',
      path: 'email',
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
    error.keyPattern = { email: 1 };
    next(error);
  });

  app.get('/test-jwt-error', (req, res, next) => {
    const error = new Error('Invalid token');
    error.name = 'JsonWebTokenError';
    next(error);
  });

  app.get('/test-jwt-expired', (req, res, next) => {
    const error = new Error('Token expired');
    error.name = 'TokenExpiredError';
    next(error);
  });

  app.get('/test-mongo-error', (req, res, next) => {
    const error = new Error('Connection failed');
    error.name = 'MongoError';
    next(error);
  });

  app.get('/test-custom-status', (req, res, next) => {
    const error = new Error('Custom error');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    next(error);
  });

  app.get('/test-email-exists', (req, res, next) => {
    const error = new Error('Email already exists');
    next(error);
  });

  app.get('/test-invalid-credentials', (req, res, next) => {
    const error = new Error('Invalid email or password');
    next(error);
  });

  app.get('/test-user-not-found', (req, res, next) => {
    const error = new Error('User not found');
    next(error);
  });

  app.get('/test-generic-error', (req, res, next) => {
    const error = new Error('Something went wrong');
    next(error);
  });

  app.get('/test-async-handler', asyncHandler(async (req, res) => {
    throw new Error('Async error');
  }));

  app.get('/test-timeout', timeoutHandler(100), (req, res) => {
    // Simulate long operation
    setTimeout(() => {
      res.json({ message: 'Success' });
    }, 200);
  });

  // Error handling middleware
  app.use('*', notFoundHandler);
  app.use(errorHandler);

  return app;
};

describe('Error Handler Middleware', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('errorHandler', () => {
    test('should handle validation errors', async () => {
      const response = await request(app)
        .get('/test-validation-error')
        .expect(400);

      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details[0].field).toBe('email');
      expect(response.body.error.timestamp).toBeDefined();
    });

    test('should handle cast errors', async () => {
      const response = await request(app)
        .get('/test-cast-error')
        .expect(400);

      expect(response.body.error.message).toBe('Invalid data format');
      expect(response.body.error.code).toBe('INVALID_DATA');
      expect(response.body.error.details.field).toBe('_id');
      expect(response.body.error.details.expectedType).toBe('ObjectId');
    });

    test('should handle duplicate key errors', async () => {
      const response = await request(app)
        .get('/test-duplicate-error')
        .expect(409);

      expect(response.body.error.message).toBe('Duplicate entry found');
      expect(response.body.error.code).toBe('DUPLICATE_ENTRY');
      expect(response.body.error.details.field).toBe('email');
    });

    test('should handle JWT errors', async () => {
      const response = await request(app)
        .get('/test-jwt-error')
        .expect(401);

      expect(response.body.error.message).toBe('Invalid authentication token');
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should handle JWT expiration errors', async () => {
      const response = await request(app)
        .get('/test-jwt-expired')
        .expect(401);

      expect(response.body.error.message).toBe('Authentication token has expired');
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    test('should handle MongoDB errors', async () => {
      const response = await request(app)
        .get('/test-mongo-error')
        .expect(503);

      expect(response.body.error.message).toBe('Database service unavailable');
      expect(response.body.error.code).toBe('DATABASE_ERROR');
    });

    test('should handle custom status code errors', async () => {
      const response = await request(app)
        .get('/test-custom-status')
        .expect(403);

      expect(response.body.error.message).toBe('Custom error');
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    test('should handle email exists error', async () => {
      const response = await request(app)
        .get('/test-email-exists')
        .expect(409);

      expect(response.body.error.message).toBe('User with this email already exists');
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('should handle invalid credentials error', async () => {
      const response = await request(app)
        .get('/test-invalid-credentials')
        .expect(401);

      expect(response.body.error.message).toBe('Invalid email or password');
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('should handle user not found error', async () => {
      const response = await request(app)
        .get('/test-user-not-found')
        .expect(404);

      expect(response.body.error.message).toBe('User not found');
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
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

    test('should handle 404 for different HTTP methods', async () => {
      const response = await request(app)
        .post('/non-existent-route')
        .expect(404);

      expect(response.body.error.message).toBe('Route POST /non-existent-route not found');
      expect(response.body.error.method).toBe('POST');
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

  describe('timeoutHandler', () => {
    test('should handle request timeouts', async () => {
      const response = await request(app)
        .get('/test-timeout')
        .expect(408);

      expect(response.body.error.message).toBe('Request timeout');
      expect(response.body.error.code).toBe('REQUEST_TIMEOUT');
    }, 10000); // Increase test timeout
  });
});