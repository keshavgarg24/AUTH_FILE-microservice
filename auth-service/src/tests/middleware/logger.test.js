const request = require('supertest');
const express = require('express');
const { requestLogger, detailedLogger, performanceLogger, accessLogger } = require('../../middleware/logger');

// Mock console methods
const originalLog = console.log;
const originalWarn = console.warn;
let logOutput = [];
let warnOutput = [];

beforeEach(() => {
  logOutput = [];
  warnOutput = [];
  
  console.log = (...args) => {
    logOutput.push(args.join(' '));
  };
  
  console.warn = (...args) => {
    warnOutput.push(args.join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
});

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
    res.json({ message: 'success' });
  });
  
  app.get('/slow', (req, res) => {
    setTimeout(() => {
      res.json({ message: 'slow response' });
    }, 150);
  });
  
  app.get('/authenticated', (req, res) => {
    // Simulate authenticated user
    req.user = { userId: '123', tokenType: 'access_token' };
    res.json({ message: 'authenticated' });
  });
  
  return app;
};

describe('Logger Middleware', () => {
  describe('requestLogger', () => {
    test('should log request start and completion', async () => {
      const app = createTestApp(requestLogger);
      
      await request(app)
        .get('/test')
        .expect(200);
      
      expect(logOutput.length).toBe(2);
      expect(logOutput[0]).toContain('GET /test - Request started');
      expect(logOutput[1]).toContain('GET /test - 200');
      expect(logOutput[1]).toMatch(/\d+ms$/);
    });

    test('should log different HTTP methods', async () => {
      const app = createTestApp(requestLogger);
      
      await request(app)
        .post('/test')
        .expect(404); // Route doesn't exist for POST
      
      expect(logOutput[0]).toContain('POST /test - Request started');
      expect(logOutput[1]).toContain('POST /test - 404');
    });
  });

  describe('detailedLogger', () => {
    test('should log detailed request and response information', async () => {
      const app = createTestApp(detailedLogger);
      
      await request(app)
        .get('/test?param=value')
        .set('User-Agent', 'test-agent')
        .expect(200);
      
      expect(logOutput.length).toBe(2);
      
      // Check request log
      const requestLog = JSON.parse(logOutput[0].replace('Request: ', ''));
      expect(requestLog.method).toBe('GET');
      expect(requestLog.path).toBe('/test');
      expect(requestLog.query).toEqual({ param: 'value' });
      expect(requestLog.userAgent).toBe('test-agent');
      expect(requestLog.timestamp).toBeDefined();
      
      // Check response log
      const responseLog = JSON.parse(logOutput[1].replace('Response: ', ''));
      expect(responseLog.method).toBe('GET');
      expect(responseLog.path).toBe('/test');
      expect(responseLog.statusCode).toBe(200);
      expect(responseLog.duration).toMatch(/\d+ms/);
    });

    test('should include user ID when authenticated', async () => {
      const app = createTestApp([
        (req, res, next) => {
          req.user = { userId: '123' };
          next();
        },
        detailedLogger
      ]);
      
      await request(app)
        .get('/test')
        .expect(200);
      
      const requestLog = JSON.parse(logOutput[0].replace('Request: ', ''));
      const responseLog = JSON.parse(logOutput[1].replace('Response: ', ''));
      
      expect(requestLog.userId).toBe('123');
      expect(responseLog.userId).toBe('123');
    });
  });

  describe('performanceLogger', () => {
    test('should log slow requests', async () => {
      const app = createTestApp(performanceLogger(100)); // 100ms threshold
      
      await request(app)
        .get('/slow')
        .expect(200);
      
      // Should have at least one warning for slow request
      expect(warnOutput.length).toBeGreaterThan(0);
      
      const slowRequestLog = JSON.parse(warnOutput[0].replace('Slow Request: ', ''));
      expect(slowRequestLog.method).toBe('GET');
      expect(slowRequestLog.path).toBe('/slow');
      expect(slowRequestLog.warning).toBe('SLOW_REQUEST');
      expect(slowRequestLog.threshold).toBe('100ms');
    });

    test('should not log fast requests', async () => {
      const app = createTestApp(performanceLogger(1000)); // 1 second threshold
      
      await request(app)
        .get('/test')
        .expect(200);
      
      // Should not have any warnings for fast requests
      expect(warnOutput.length).toBe(0);
    });
  });

  describe('accessLogger', () => {
    test('should log authenticated access', async () => {
      const app = createTestApp([
        (req, res, next) => {
          req.user = { userId: '123', tokenType: 'access_token' };
          next();
        },
        accessLogger
      ]);
      
      await request(app)
        .get('/test')
        .expect(200);
      
      expect(logOutput.length).toBeGreaterThan(0);
      
      const accessLog = JSON.parse(logOutput[0].replace('Access: ', ''));
      expect(accessLog.event).toBe('AUTHENTICATED_ACCESS');
      expect(accessLog.method).toBe('GET');
      expect(accessLog.path).toBe('/test');
      expect(accessLog.userId).toBe('123');
      expect(accessLog.tokenType).toBe('access_token');
    });

    test('should not log unauthenticated access', async () => {
      const app = createTestApp(accessLogger);
      
      await request(app)
        .get('/test')
        .expect(200);
      
      // Should not log anything for unauthenticated requests
      expect(logOutput.length).toBe(0);
    });
  });
});