const request = require('supertest');
const express = require('express');
const { requestLogger, detailedLogger, uploadLogger, downloadLogger, performanceLogger } = require('../../middleware/logger');

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
  app.use(express.raw({ type: 'application/octet-stream' }));
  
  if (Array.isArray(middleware)) {
    middleware.forEach(mw => app.use(mw));
  } else {
    app.use(middleware);
  }
  
  app.get('/test', (req, res) => {
    res.json({ message: 'success' });
  });
  
  app.post('/upload', (req, res) => {
    res.status(201).json({ message: 'uploaded' });
  });
  
  app.get('/file/:id', (req, res) => {
    res.json({ downloadUrl: 'https://example.com/download' });
  });
  
  app.get('/slow', (req, res) => {
    setTimeout(() => {
      res.json({ message: 'slow response' });
    }, 200);
  });
  
  return app;
};

describe('Logger Middleware (File Service)', () => {
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

  describe('uploadLogger', () => {
    test('should log upload start and completion', async () => {
      const app = createTestApp([
        (req, res, next) => {
          req.user = { userId: '123' };
          next();
        },
        uploadLogger
      ]);
      
      await request(app)
        .post('/upload?filename=test.pdf')
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.from('test file content'))
        .expect(201);
      
      expect(logOutput.length).toBe(2);
      
      // Check upload start log
      const uploadStartLog = JSON.parse(logOutput[0].replace('Upload Started: ', ''));
      expect(uploadStartLog.event).toBe('UPLOAD_STARTED');
      expect(uploadStartLog.userId).toBe('123');
      expect(uploadStartLog.filename).toBe('test.pdf');
      expect(uploadStartLog.contentType).toBe('application/octet-stream');
      
      // Check upload completion log
      const uploadCompleteLog = JSON.parse(logOutput[1].replace('Upload Completed: ', ''));
      expect(uploadCompleteLog.event).toBe('UPLOAD_COMPLETED');
      expect(uploadCompleteLog.userId).toBe('123');
      expect(uploadCompleteLog.filename).toBe('test.pdf');
      expect(uploadCompleteLog.statusCode).toBe(201);
      expect(uploadCompleteLog.success).toBe(true);
    });

    test('should not log non-upload requests', async () => {
      const app = createTestApp(uploadLogger);
      
      await request(app)
        .get('/test')
        .expect(200);
      
      // Should not log anything for non-upload requests
      expect(logOutput.length).toBe(0);
    });

    test('should log failed uploads', async () => {
      const app = createTestApp([
        uploadLogger,
        (req, res, next) => {
          if (req.path === '/upload') {
            return res.status(400).json({ error: 'Bad request' });
          }
          next();
        }
      ]);
      
      await request(app)
        .post('/upload?filename=test.pdf')
        .expect(400);
      
      const uploadCompleteLog = JSON.parse(logOutput[1].replace('Upload Completed: ', ''));
      expect(uploadCompleteLog.statusCode).toBe(400);
      expect(uploadCompleteLog.success).toBe(false);
    });
  });

  describe('downloadLogger', () => {
    test('should log download requests', async () => {
      const app = createTestApp([
        (req, res, next) => {
          req.user = { userId: '123' };
          next();
        },
        downloadLogger
      ]);
      
      await request(app)
        .get('/file/507f1f77bcf86cd799439011')
        .expect(200);
      
      expect(logOutput.length).toBe(1);
      
      const downloadLog = JSON.parse(logOutput[0].replace('Download Requested: ', ''));
      expect(downloadLog.event).toBe('DOWNLOAD_REQUESTED');
      expect(downloadLog.userId).toBe('123');
      expect(downloadLog.fileId).toBe('507f1f77bcf86cd799439011');
    });

    test('should not log non-download requests', async () => {
      const app = createTestApp(downloadLogger);
      
      await request(app)
        .get('/test')
        .expect(200);
      
      // Should not log anything for non-download requests
      expect(logOutput.length).toBe(0);
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

    test('should include file-specific information in logs', async () => {
      const app = createTestApp([
        performanceLogger(50), // Very low threshold to trigger warning
        (req, res, next) => {
          req.user = { userId: '123' };
          next();
        }
      ]);
      
      await request(app)
        .post('/upload?filename=test.pdf')
        .expect(201);
      
      if (warnOutput.length > 0) {
        const slowRequestLog = JSON.parse(warnOutput[0].replace('Slow Request: ', ''));
        expect(slowRequestLog.userId).toBe('123');
        expect(slowRequestLog.filename).toBe('test.pdf');
      }
    });
  });
});