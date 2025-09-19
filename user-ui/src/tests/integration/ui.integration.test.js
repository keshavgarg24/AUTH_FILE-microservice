const request = require('supertest');
const axios = require('axios');
const app = require('../../server');

// Mock axios for external service calls
jest.mock('axios');
const mockedAxios = axios;

describe('UI Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Flow', () => {
    test('should handle complete user registration and login flow', async () => {
      // Step 1: Register user
      const registerMockResponse = {
        data: {
          message: 'User registered successfully',
          userId: '123',
          email: 'integration@test.com'
        }
      };

      mockedAxios.mockResolvedValueOnce(registerMockResponse);

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'integration@test.com',
          password: 'testPassword123'
        })
        .expect(200);

      expect(registerResponse.body).toEqual(registerMockResponse.data);

      // Step 2: Login user
      const loginMockResponse = {
        data: {
          message: 'Login successful',
          token: 'jwt-token-123',
          userId: '123',
          email: 'integration@test.com'
        }
      };

      mockedAxios.mockResolvedValueOnce(loginMockResponse);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'integration@test.com',
          password: 'testPassword123'
        })
        .expect(200);

      expect(loginResponse.body.message).toBe('Login successful');
      expect(loginResponse.headers['set-cookie']).toBeDefined();

      // Extract cookie for subsequent requests
      const cookies = loginResponse.headers['set-cookie'];

      // Step 3: Get user profile
      const profileMockResponse = {
        data: {
          userId: '123',
          email: 'integration@test.com',
          createdAt: '2023-01-01T00:00:00.000Z'
        }
      };

      mockedAxios.mockResolvedValueOnce(profileMockResponse);

      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(profileResponse.body).toEqual(profileMockResponse.data);

      // Step 4: Get files list
      const filesMockResponse = {
        data: {
          files: [],
          pagination: {
            total: 0,
            limit: 12,
            skip: 0,
            hasMore: false
          },
          summary: {
            totalFiles: 0,
            totalSize: 0
          }
        }
      };

      mockedAxios.mockResolvedValueOnce(filesMockResponse);

      const filesResponse = await request(app)
        .get('/api/files')
        .set('Cookie', cookies)
        .expect(200);

      expect(filesResponse.body).toEqual(filesMockResponse.data);

      // Step 5: Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      expect(logoutResponse.body.message).toBe('Logged out successfully');
      expect(logoutResponse.headers['set-cookie'][0]).toContain('authToken=;');
    });

    test('should handle file upload and download flow', async () => {
      // Mock login first
      const loginMockResponse = {
        data: {
          message: 'Login successful',
          token: 'jwt-token-123',
          userId: '123',
          email: 'test@example.com'
        }
      };

      mockedAxios.mockResolvedValueOnce(loginMockResponse);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Mock file upload
      const uploadMockResponse = {
        data: {
          message: 'File uploaded successfully',
          fileId: 'file123',
          filename: 'test.txt',
          size: 1024,
          uploadedAt: '2023-01-01T00:00:00.000Z'
        }
      };

      mockedAxios.mockResolvedValueOnce(uploadMockResponse);

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Cookie', cookies)
        .attach('file', Buffer.from('test file content'), 'test.txt')
        .expect(200);

      expect(uploadResponse.body).toEqual(uploadMockResponse.data);

      // Mock file download
      const downloadMockResponse = {
        data: {
          downloadUrl: 'https://presigned-url.com/download',
          filename: 'test.txt',
          expiresIn: 900
        }
      };

      mockedAxios.mockResolvedValueOnce(downloadMockResponse);

      const downloadResponse = await request(app)
        .get('/api/files/file123/download')
        .set('Cookie', cookies)
        .expect(200);

      expect(downloadResponse.body).toEqual(downloadMockResponse.data);

      // Mock file deletion
      const deleteMockResponse = {
        data: {
          message: 'File deleted successfully',
          fileId: 'file123'
        }
      };

      mockedAxios.mockResolvedValueOnce(deleteMockResponse);

      const deleteResponse = await request(app)
        .delete('/api/files/file123')
        .set('Cookie', cookies)
        .expect(200);

      expect(deleteResponse.body).toEqual(deleteMockResponse.data);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle authentication errors consistently', async () => {
      // Test expired token scenario
      const expiredTokenError = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Token expired',
              code: 'TOKEN_EXPIRED'
            }
          }
        }
      };

      mockedAxios.mockRejectedValueOnce(expiredTokenError);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'authToken=expired-token')
        .expect(401);

      expect(response.body).toEqual(expiredTokenError.response.data);
      expect(response.headers['set-cookie'][0]).toContain('authToken=;');
    });

    test('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service unavailable');
      mockedAxios.mockRejectedValueOnce(serviceError);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        })
        .expect(500);

      expect(response.body.message).toBe('Service unavailable');
    });

    test('should handle file upload errors', async () => {
      // Mock login first
      const loginMockResponse = {
        data: {
          message: 'Login successful',
          token: 'jwt-token-123',
          userId: '123',
          email: 'test@example.com'
        }
      };

      mockedAxios.mockResolvedValueOnce(loginMockResponse);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Test upload without file
      const noFileResponse = await request(app)
        .post('/api/files/upload')
        .set('Cookie', cookies)
        .expect(400);

      expect(noFileResponse.body).toEqual({
        error: {
          message: 'No file provided',
          code: 'NO_FILE'
        }
      });

      // Test upload without authentication
      const noAuthResponse = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(401);

      expect(noAuthResponse.body).toEqual({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        }
      });
    });
  });

  describe('Security Integration', () => {
    test('should protect all file endpoints with authentication', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/files' },
        { method: 'get', path: '/api/files/123/download' },
        { method: 'delete', path: '/api/files/123' },
        { method: 'post', path: '/api/files/upload' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path)
          .expect(401);

        expect(response.body).toEqual({
          error: {
            message: 'Not authenticated',
            code: 'NOT_AUTHENTICATED'
          }
        });
      }
    });

    test('should handle cookie-based authentication correctly', async () => {
      // Test with valid cookie
      const profileMockResponse = {
        data: {
          userId: '123',
          email: 'test@example.com'
        }
      };

      mockedAxios.mockResolvedValueOnce(profileMockResponse);

      const validResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'authToken=valid-token')
        .expect(200);

      expect(validResponse.body).toEqual(profileMockResponse.data);

      // Test with invalid cookie
      const invalidTokenError = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid token',
              code: 'INVALID_TOKEN'
            }
          }
        }
      };

      mockedAxios.mockRejectedValueOnce(invalidTokenError);

      const invalidResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'authToken=invalid-token')
        .expect(401);

      expect(invalidResponse.body).toEqual(invalidTokenError.response.data);
    });
  });

  describe('Static File Serving', () => {
    test('should serve static files correctly', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
    });

    test('should handle SPA routing correctly', async () => {
      const spaRoutes = ['/dashboard', '/files', '/upload', '/profile'];

      for (const route of spaRoutes) {
        const response = await request(app)
          .get(route)
          .expect(200);

        expect(response.headers['content-type']).toContain('text/html');
      }
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle multiple concurrent requests', async () => {
      const mockResponse = {
        data: { status: 'OK' }
      };

      // Mock multiple successful responses
      for (let i = 0; i < 10; i++) {
        mockedAxios.mockResolvedValueOnce(mockResponse);
      }

      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/auth/register')
          .send({
            email: `user${i}@test.com`,
            password: 'testPassword123'
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should handle service timeouts gracefully', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ECONNABORTED';
      
      mockedAxios.mockRejectedValueOnce(timeoutError);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        })
        .expect(500);

      expect(response.body.message).toBe('Service unavailable');
    });
  });
});