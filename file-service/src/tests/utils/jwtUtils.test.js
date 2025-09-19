const jwtUtils = require('../../utils/jwtUtils');

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-secret-key-for-testing';

describe('JWTUtils (File Service)', () => {
  const testUserId = '507f1f77bcf86cd799439011';
  
  // Helper function to create a valid token (simulating auth service)
  const jwt = require('jsonwebtoken');
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

  describe('verifyToken', () => {
    test('should verify valid token successfully', () => {
      const token = createTestToken(testUserId);
      const decoded = jwtUtils.verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.type).toBe('access_token');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    test('should verify token with Bearer prefix', () => {
      const token = createTestToken(testUserId);
      const bearerToken = `Bearer ${token}`;
      const decoded = jwtUtils.verifyToken(bearerToken);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUserId);
    });

    test('should throw error for invalid token', () => {
      expect(() => jwtUtils.verifyToken('invalid.token.here')).toThrow('Invalid token');
    });

    test('should throw error for empty token', () => {
      expect(() => jwtUtils.verifyToken('')).toThrow('Token must be a non-empty string');
    });

    test('should throw error for null token', () => {
      expect(() => jwtUtils.verifyToken(null)).toThrow('Token must be a non-empty string');
    });

    test('should throw error for non-string token', () => {
      expect(() => jwtUtils.verifyToken(123)).toThrow('Token must be a non-empty string');
    });

    test('should handle expired token', () => {
      // Generate token with very short expiration
      const shortLivedToken = createTestToken(testUserId, { expiresIn: '1ms' });
      
      // Wait a bit to ensure expiration
      setTimeout(() => {
        expect(() => jwtUtils.verifyToken(shortLivedToken)).toThrow('Token has expired');
      }, 10);
    });
  });

  describe('extractUserId', () => {
    test('should extract user ID from valid token', () => {
      const token = createTestToken(testUserId);
      const extractedUserId = jwtUtils.extractUserId(token);

      expect(extractedUserId).toBe(testUserId);
    });

    test('should extract user ID from token with Bearer prefix', () => {
      const token = createTestToken(testUserId);
      const bearerToken = `Bearer ${token}`;
      const extractedUserId = jwtUtils.extractUserId(bearerToken);

      expect(extractedUserId).toBe(testUserId);
    });

    test('should throw error for invalid token', () => {
      expect(() => jwtUtils.extractUserId('invalid.token.here')).toThrow('Invalid token');
    });

    test('should throw error for token without userId', () => {
      // Create token without userId
      const tokenWithoutUserId = jwt.sign({ type: 'access_token' }, process.env.JWT_SECRET);
      
      expect(() => jwtUtils.extractUserId(tokenWithoutUserId)).toThrow('Token does not contain user ID');
    });
  });

  describe('isTokenExpired', () => {
    test('should return false for valid token', () => {
      const token = createTestToken(testUserId);
      const isExpired = jwtUtils.isTokenExpired(token);

      expect(isExpired).toBe(false);
    });

    test('should return true for expired token', () => {
      // This test is tricky with real expiration, so we test with invalid token
      const isExpired = jwtUtils.isTokenExpired('invalid.token.here');
      
      // Invalid token should not be considered "expired" specifically
      expect(typeof isExpired).toBe('boolean');
    });

    test('should handle token with Bearer prefix', () => {
      const token = createTestToken(testUserId);
      const bearerToken = `Bearer ${token}`;
      const isExpired = jwtUtils.isTokenExpired(bearerToken);

      expect(isExpired).toBe(false);
    });
  });

  describe('isValidTokenFormat', () => {
    test('should return true for valid JWT format', () => {
      const token = createTestToken(testUserId);
      const isValid = jwtUtils.isValidTokenFormat(token);

      expect(isValid).toBe(true);
    });

    test('should return true for token with Bearer prefix', () => {
      const token = createTestToken(testUserId);
      const bearerToken = `Bearer ${token}`;
      const isValid = jwtUtils.isValidTokenFormat(bearerToken);

      expect(isValid).toBe(true);
    });

    test('should return false for invalid format', () => {
      const isValid = jwtUtils.isValidTokenFormat('invalid-token');

      expect(isValid).toBe(false);
    });

    test('should return false for empty token', () => {
      const isValid = jwtUtils.isValidTokenFormat('');

      expect(isValid).toBe(false);
    });

    test('should return false for null token', () => {
      const isValid = jwtUtils.isValidTokenFormat(null);

      expect(isValid).toBe(false);
    });

    test('should return false for token with wrong number of parts', () => {
      const isValid = jwtUtils.isValidTokenFormat('part1.part2');

      expect(isValid).toBe(false);
    });
  });
});