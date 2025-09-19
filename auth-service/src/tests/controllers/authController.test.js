const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const authController = require('../../controllers/authController');
const userRepository = require('../../repositories/userRepository');
const User = require('../../models/User');
const { authenticateToken } = require('../../middleware/auth');

// Mock environment variables
process.env.MONGODB_URI = 'mongodb://localhost:27017/auth_service_test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Auth routes
  app.post('/register', authController.register);
  app.post('/login', authController.login);
  app.get('/me', authenticateToken, authController.getProfile);
  
  return app;
};

describe('AuthController', () => {
  let app;

  beforeAll(async () => {
    const mongoUri = 'mongodb://localhost:27017/auth_service_test';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    app = createTestApp();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'testPassword123'
    };

    test('should register user successfully', async () => {
      const response = await request(app)
        .post('/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.userId).toBeDefined();
      expect(response.body.email).toBe(validUserData.email);
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.passwordHash).toBeUndefined();
    });

    test('should reject registration with missing email', async () => {
      const response = await request(app)
        .post('/register')
        .send({ password: 'testPassword123' })
        .expect(400);

      expect(response.body.error.message).toBe('Email and password are required');
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    test('should reject registration with missing password', async () => {
      const response = await request(app)
        .post('/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.error.message).toBe('Email and password are required');
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    test('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'invalid-email',
          password: 'testPassword123'
        })
        .expect(400);

      expect(response.body.error.message).toBe('Please provide a valid email address');
      expect(response.body.error.code).toBe('INVALID_EMAIL');
    });

    test('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: '123'
        })
        .expect(400);

      expect(response.body.error.message).toBe('Password does not meet requirements');
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
      expect(response.body.error.details).toBeDefined();
    });

    test('should reject registration with duplicate email', async () => {
      // Register first user
      await request(app)
        .post('/register')
        .send(validUserData)
        .expect(201);

      // Try to register second user with same email
      const response = await request(app)
        .post('/register')
        .send(validUserData)
        .expect(409);

      expect(response.body.error.message).toBe('User with this email already exists');
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('should normalize email to lowercase', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'testPassword123'
        })
        .expect(201);

      expect(response.body.email).toBe('test@example.com');
    });
  });

  describe('POST /login', () => {
    const userData = {
      email: 'test@example.com',
      password: 'testPassword123'
    };

    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/register')
        .send(userData);
    });

    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send(userData)
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.userId).toBeDefined();
      expect(response.body.email).toBe(userData.email);
    });

    test('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/login')
        .send({ password: userData.password })
        .expect(400);

      expect(response.body.error.message).toBe('Email and password are required');
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    test('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: userData.email })
        .expect(400);

      expect(response.body.error.message).toBe('Email and password are required');
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    test('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'nonexistent@example.com',
          password: userData.password
        })
        .expect(401);

      expect(response.body.error.message).toBe('Invalid email or password');
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: userData.email,
          password: 'wrongPassword'
        })
        .expect(401);

      expect(response.body.error.message).toBe('Invalid email or password');
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('should handle case-insensitive email login', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: userData.password
        })
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
    });
  });

  describe('GET /me', () => {
    let userToken;
    let userId;

    beforeEach(async () => {
      // Register and login a user
      const registerResponse = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        });

      userId = registerResponse.body.userId;

      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        });

      userToken = loginResponse.body.token;
    });

    test('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.userId).toBe(userId);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.passwordHash).toBeUndefined();
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/me')
        .expect(401);

      expect(response.body.error.message).toBe('Authorization header is required');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});