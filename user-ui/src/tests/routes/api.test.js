const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const apiRoutes = require('../../routes/api');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRoutes);
  return app;
};

describe('API Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    test('should register user successfully', async () => {
      const mockResponse = {
        data: {
          message: 'User registered successfully',
          userId: '123',
          email: 'test@example.com'
        }
      };

      mockedAxios.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        })
        .expect(200);

      expect(response.body).toEqual(mockResponse.data);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'POST',
        url: 'http://localhost:3001/register',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          email: 'test@example.com',
          password: 'testPassword123'
        }
      });
    });

    test('should handle registration error', async () => {
      const mockError = {
        response: {
          status: 409,
          data: {
            error: {
              message: 'Email already exists',
              code: 'EMAIL_EXISTS'
            }
          }
        }
      };

      mockedAxios.mockRejectedValue(mockError);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        })
        .expect(409);

      expect(response.body).toEqual(mockError.response.data);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login user successfully and set cookie', async () => {
      const mockResponse = {
        data: {
          message: 'Login successful',
          token: 'jwt-token-123',
          userId: '123',
          email: 'test@example.com'
        }
      };

      mockedAxios.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Login successful',
        userId: '123',
        email: 'test@example.com'
      });

      // Check if cookie is set
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('authToken=jwt-token-123');
    });

    test('should handle login error', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid credentials',
              code: 'INVALID_CREDENTIALS'
            }
          }
        }
      };

      mockedAxios.mockRejectedValue(mockError);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongPassword'
        })
        .expect(401);

      expect(response.body).toEqual(mockError.response.data);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout user and clear cookie', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Logged out successfully'
      });

      // Check if cookie is cleared
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('authToken=;');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should get user profile with valid token', async () => {
      const mockResponse = {
        data: {
          userId: '123',
          email: 'test@example.com',
          createdAt: '2023-01-01T00:00:00.000Z'
        }
      };

      mockedAxios.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'authToken=valid-jwt-token')
        .expect(200);

      expect(response.body).toEqual(mockResponse.data);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:3001/me',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token'
        }
      });
    });

    test('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toEqual({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        }
      });
    });

    test('should clear cookie on 401 response', async () => {
      const mockError = {
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

      mockedAxios.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'authToken=expired-token')
        .expect(401);

      expect(response.body).toEqual(mockError.response.data);
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('authToken=;');
    });
  });

  describe('GET /api/files', () => {
    test('should get files with valid token', async () => {
      const mockResponse = {
        data: {
          files: [
            {
              fileId: '1',
              filename: 'test.pdf',
              size: 1024,
              uploadedAt: '2023-01-01T00:00:00.000Z'
            }
          ],
          pagination: {
            total: 1,
            limit: 12,
            skip: 0,
            hasMore: false
          }
        }
      };

      mockedAxios.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/files?page=1&limit=12')
        .set('Cookie', 'authToken=valid-jwt-token')
        .expect(200);

      expect(response.body).toEqual(mockResponse.data);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:3002/files?page=1&limit=12',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token'
        }
      });
    });

    test('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(401);

      expect(response.body).toEqual({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        }
      });
    });
  });

  describe('GET /api/files/:id/download', () => {
    test('should get download URL with valid token', async () => {
      const mockResponse = {
        data: {
          downloadUrl: 'https://presigned-url.com',
          filename: 'test.pdf',
          expiresIn: 900
        }
      };

      mockedAxios.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/files/123/download')
        .set('Cookie', 'authToken=valid-jwt-token')
        .expect(200);

      expect(response.body).toEqual(mockResponse.data);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:3002/file/123',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token'
        }
      });
    });
  });

  describe('DELETE /api/files/:id', () => {
    test('should delete file with valid token', async () => {
      const mockResponse = {
        data: {
          message: 'File deleted successfully',
          fileId: '123'
        }
      };

      mockedAxios.mockResolvedValue(mockResponse);

      const response = await request(app)
        .delete('/api/files/123')
        .set('Cookie', 'authToken=valid-jwt-token')
        .expect(200);

      expect(response.body).toEqual(mockResponse.data);
      expect(mockedAxios).toHaveBeenCalledWith({
        method: 'DELETE',
        url: 'http://localhost:3002/file/123',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token'
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle service unavailable error', async () => {
      const mockError = new Error('Network Error');
      mockedAxios.mockRejectedValue(mockError);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        })
        .expect(500);

      expect(response.body).toEqual({
        message: 'Service unavailable'
      });
    });

    test('should handle axios error without response', async () => {
      const mockError = new Error('Request failed');
      mockedAxios.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'authToken=valid-jwt-token')
        .expect(500);

      expect(response.body).toEqual({
        message: 'Service unavailable'
      });
    });
  });
});