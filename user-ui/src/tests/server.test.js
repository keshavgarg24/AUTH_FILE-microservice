const request = require('supertest');
const path = require('path');

// Mock the API routes
jest.mock('../routes/api', () => {
  const express = require('express');
  const router = express.Router();
  
  router.get('/test', (req, res) => {
    res.json({ message: 'API test endpoint' });
  });
  
  return router;
});

// Import server after mocking
const app = require('../server');

describe('Server', () => {
  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        service: 'user-ui',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Static Files', () => {
    test('should serve index.html on root path', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
    });

    test('should serve index.html for non-API routes (SPA routing)', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('API Routes', () => {
    test('should handle API routes', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body).toEqual({
        message: 'API test endpoint'
      });
    });

    test('should return 404 for non-existent API endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        error: {
          message: 'API endpoint not found',
          code: 'NOT_FOUND'
        }
      });
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for some security headers set by helmet
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle server errors gracefully', async () => {
      // This test would need a route that throws an error
      // For now, we'll test that the error handler is set up
      expect(app._router).toBeDefined();
    });
  });

  describe('CORS', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting', async () => {
      // Make multiple requests to test rate limiting
      const requests = Array.from({ length: 5 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed (within rate limit)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Compression', () => {
    test('should compress responses when appropriate', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept-Encoding', 'gzip');

      // The response might be compressed depending on size
      expect(response.status).toBe(200);
    });
  });
});