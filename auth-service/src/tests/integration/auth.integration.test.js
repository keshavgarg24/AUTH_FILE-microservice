const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const User = require('../../models/User');
const jwtUtils = require('../../utils/jwtUtils');

describe('Auth Integration Tests', () => {
  const testUser = {
    email: 'integration@test.com',
    password: 'testPassword123'
  };

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('Complete User Registration Flow', () => {
    test('should register user, login, and access profile', async () => {
      // Step 1: Register user
      const registerResponse = await request(app)
        .post('/register')
        .send(testUser)
        .expect(201);

      expect(registerResponse.body.message).toBe('User registered successfully');
      expect(registerResponse.body.userId).toBeDefined();
      expect(registerResponse.body.email).toBe(testUser.email);

      // Verify user exists in database
      const userInDb = await User.findById(registerResponse.body.userId);
      expect(userInDb).toBeTruthy();
      expect(userInDb.email).toBe(testUser.email);

      // Step 2: Login with registered user
      const loginResponse = await request(app)
        .post('/login')
        .send(testUser)
        .expect(200);

      expect(loginResponse.body.message).toBe('Login successful');
      expect(loginResponse.body.token).toBeDefined();
      expect(loginResponse.body.userId).toBe(registerResponse.body.userId);

      // Verify token is valid
      const decodedToken = jwtUtils.verifyToken(loginResponse.body.token);
      expect(decodedToken.userId).toBe(registerResponse.body.userId);

      // Step 3: Access profile with token
      const profileResponse = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      expect(profileResponse.body.userId).toBe(registerResponse.body.userId);
      expect(profileResponse.body.email).toBe(testUser.email);
      expect(profileResponse.body.createdAt).toBeDefined();
    });

    test('should handle duplicate registration', async () => {
      // Register user first time
      await request(app)
        .post('/register')
        .send(testUser)
        .expect(201);

      // Try to register same user again
      const duplicateResponse = await request(app)
        .post('/register')
        .send(testUser)
        .expect(409);

      expect(duplicateResponse.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('should handle invalid login after registration', async () => {
      // Register user
      await request(app)
        .post('/register')
        .send(testUser)
        .expect(201);

      // Try to login with wrong password
      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: testUser.email,
          password: 'wrongPassword'
        })
        .expect(401);

      expect(loginResponse.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Token Validation Flow', () => {
    let userToken;
    let userId;

    beforeEach(async () => {
      // Register and login user
      const registerResponse = await request(app)
        .post('/register')
        .send(testUser);

      userId = registerResponse.body.userId;

      const loginResponse = await request(app)
        .post('/login')
        .send(testUser);

      userToken = loginResponse.body.token;
    });

    test('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.userId).toBe(userId);
    });

    test('should reject access with invalid token', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject access without token', async () => {
      const response = await request(app)
        .get('/me')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_AUTH_HEADER');
    });

    test('should handle expired token', async () => {
      // Generate token with very short expiration
      const expiredToken = jwtUtils.generateToken(userId, { expiresIn: '1ms' });
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle validation errors consistently', async () => {
      const invalidRequests = [
        { email: '', password: 'test123' }, // Empty email
        { email: 'invalid-email', password: 'test123' }, // Invalid email format
        { email: 'test@example.com', password: '123' }, // Weak password
        { email: 'test@example.com' }, // Missing password
        { password: 'test123' } // Missing email
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await request(app)
          .post('/register')
          .send(invalidRequest)
          .expect(400);

        expect(response.body.error).toBeDefined();
        expect(response.body.error.timestamp).toBeDefined();
        expect(response.body.error.path).toBe('/register');
      }
    });

    test('should handle database connection errors gracefully', async () => {
      // Close database connection to simulate error
      await mongoose.connection.close();

      const response = await request(app)
        .post('/register')
        .send(testUser)
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');

      // Reconnect for cleanup
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    });
  });

  describe('Security Integration', () => {
    test('should not expose sensitive information in responses', async () => {
      const registerResponse = await request(app)
        .post('/register')
        .send(testUser)
        .expect(201);

      // Registration response should not contain password hash
      expect(registerResponse.body.passwordHash).toBeUndefined();
      expect(registerResponse.body.password).toBeUndefined();

      const loginResponse = await request(app)
        .post('/login')
        .send(testUser)
        .expect(200);

      const profileResponse = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      // Profile response should not contain password hash
      expect(profileResponse.body.passwordHash).toBeUndefined();
      expect(profileResponse.body.password).toBeUndefined();
    });

    test('should handle case-insensitive email consistently', async () => {
      // Register with lowercase email
      await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: 'testPassword123'
        })
        .expect(201);

      // Login with uppercase email should work
      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'testPassword123'
        })
        .expect(200);

      expect(loginResponse.body.token).toBeDefined();

      // Try to register with different case should fail
      await request(app)
        .post('/register')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'testPassword123'
        })
        .expect(409);
    });
  });

  describe('Performance Integration', () => {
    test('should handle multiple concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/register')
          .send({
            email: `user${i}@test.com`,
            password: 'testPassword123'
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.email).toBe(`user${index}@test.com`);
      });

      // Verify all users were created
      const userCount = await User.countDocuments();
      expect(userCount).toBe(10);
    });

    test('should handle rapid login attempts', async () => {
      // Register user first
      await request(app)
        .post('/register')
        .send(testUser)
        .expect(201);

      // Make multiple rapid login requests
      const loginRequests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/login')
          .send(testUser)
      );

      const responses = await Promise.all(loginRequests);

      // All login attempts should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
      });
    });
  });
});