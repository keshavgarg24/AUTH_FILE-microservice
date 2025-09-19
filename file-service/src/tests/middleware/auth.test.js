const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken, optionalAuth, requireAuth } = require('../../middleware/auth');

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing';

// Helper function to create test tokens
const createTestToken = (userId, options = {}) => {
  const payload = {
    userId: userId.toString(),
    type: 'access_token'
  };
  
  const tokenOptions = {
    expiresIn: options.expiresIn || '24h',
    issuer: 'auth-service',
    audience: 'microservices'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, tokenOptions);
};

// Create test app
const createTestApp = (middleware) => {
  const app = express();
  app.use(express.json());
  
  if (Array.isArray(middleware)) {
    middleware.forEach(mw => app.use(mw));
  } else {
    app.use(middleware);
  }
  
  app.get('/test', (req, res) => {
    res.json({ 
      success: true, 
      user: req.user 
    });
  });
  
  return app;
};

describe('Authentication Middleware (File Service)', () => {
  const testUserId = '507f1f77bcf86cd799439011';
  let validToken;

  beforeAll(() => {
    validToken = createTestToken(testUserId);
  });

  describe('authenticateToken', () => {
    const app = createTestApp(authenticateToken);

    test('should authenticate with valid Bearer token', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.userId).toBe(testUserId);
      expect(response.body.user.tokenType).toBe('access_token');
    });

    test('should authenticate with valid token without Bearer prefix', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', validToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.userId).toBe(testUserId);
    });

    test('should reject request without Authorization header', async () => {
      const response = await request(app)
        .get('/test')
        .expect(401);

      expect(response.body.error.message).toBe('Authorization header is required');
      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });

    test('should reject request with empty Authorization header', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', '')
        .expect(401);

      expect(response.body.error.message).toBe('Token is required');
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should reject request with Bearer but no token', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer ')
        .expect(401);

      expect(response.body.error.message).toBe('Token is required');
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.error.message).toBe('Invalid token format');
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject request with expired token', async () => {
      const expiredToken = createTestToken(testUserId, { expiresIn: '1ms' });
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    test('should reject token with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { userId: testUserId, type: 'access_token' },
        'wrong-secret'
      );
      
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${wrongSecretToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('optionalAuth', () => {
    const app = createTestApp(optionalAuth);

    test('should authenticate with valid token', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.userId).toBe(testUserId);
    });

    test('should continue without token', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeNull();
    });

    test('should continue with invalid token', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeNull();
    });

    test('should continue with empty Authorization header', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', '')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeNull();
    });

    test('should continue with expired token', async () => {
      const expiredToken = createTestToken(testUserId, { expiresIn: '1ms' });
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeNull();
    });
  });

  describe('requireAuth', () => {
    const app = createTestApp([authenticateToken, requireAuth]);

    test('should pass with authenticated user', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.userId).toBe(testUserId);
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .get('/test')
        .expect(401);

      expect(response.body.error.message).toBe('Authorization header is required');
    });
  });

  describe('requireAuth with optionalAuth', () => {
    const app = createTestApp([optionalAuth, requireAuth]);

    test('should pass with authenticated user', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.userId).toBe(testUserId);
    });

    test('should fail without token', async () => {
      const response = await request(app)
        .get('/test')
        .expect(401);

      expect(response.body.error.message).toBe('Authentication required');
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    test('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.error.message).toBe('Authentication required');
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    test('should fail with expired token', async () => {
      const expiredToken = createTestToken(testUserId, { expiresIn: '1ms' });
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error.message).toBe('Authentication required');
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });
  });
});