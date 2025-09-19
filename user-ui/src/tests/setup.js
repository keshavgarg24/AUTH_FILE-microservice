// Test setup file for user-ui service

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.AUTH_SERVICE_URL = 'http://localhost:3001';
process.env.FILE_SERVICE_URL = 'http://localhost:3002';
process.env.SESSION_SECRET = 'test-session-secret';

// Suppress console output during tests (optional)
if (process.env.SUPPRESS_TEST_LOGS === 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}