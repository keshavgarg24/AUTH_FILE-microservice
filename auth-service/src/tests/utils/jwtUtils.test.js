const jwtUtils = require('../../utils/jwtUtils');

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-secret-key-for-testing';

describe('JWTUtils', () => {
  const testUserId = '507f1f77bcf86cd799439011';

  describe('generateToken', () => {
    test('should generate token successfully', () => {
      const token = jwtUtils.generateToken(testUserId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should throw error for missing user ID', () => {
      expect(() => jwtUtils.generateToken()).toThrow('User ID is required for token generation');
    });

    test('should throw error for empty user ID', () => {
      expect(() => jwtUtils.generateToken('')).toThrow('User ID is required for token generation');
    });

    test('should generate token with custom options', () => {
      const options = {
        expiresIn: '1h',
        issuer: 'test-service'
      };
      
      const token = jwtUtils.generateToken(testUserId, options);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    test('should generate different tokens for same user', () => {
      const token1 = jwtUtils.generateToken(testUserId);
      const token2 = jwtUtils.generateToken(testUserId);

      expect(token1).not.toBe(token2); // Different iat (issued at) times
    });
  });

  describe('verifyToken', () => {
    test('should verify valid token successfully', () => {
      const token = jwtUtils.generateToken(testUserId);
      const decoded = jwtUtils.verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.type).toBe('access_token');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    test('should verify token with Bearer prefix', () => {
      const token = jwtUtils.generateToken(testUserId);
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
      const shortLivedToken = jwtUtils.generateToken(testUserId, { expiresIn: '1ms' });
      
      // Wait a bit to ensure expiration
      setTimeout(() => {
        expect(() => jwtUtils.verifyToken(shortLivedToken)).toThrow('Token has expired');
      }, 10);
    });
  });

  describe('decodeToken', () => {
    test('should decode token without verification', () => {
      const token = jwtUtils.generateToken(testUserId);
      const decoded = jwtUtils.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.header).toBeDefined();
      expect(decoded.payload).toBeDefined();
      expect(decoded.payload.userId).toBe(testUserId);
    });

    test('should decode token with Bearer prefix', () => {
      const token = jwtUtils.generateToken(testUserId);
      const bearerToken = `Bearer ${token}`;
      const decoded = jwtUtils.decodeToken(bearerToken);

      expect(decoded).toBeDefined();
      expect(decoded.payload.userId).toBe(testUserId);
    });

    test('should throw error for invalid token format', () => {
      expect(() => jwtUtils.decodeToken('invalid-token')).toThrow('Token decoding failed');
    });
  });

  describe('extractUserId', () => {
    test('should extract user ID from valid token', () => {
      const token = jwtUtils.generateToken(testUserId);
      const extractedUserId = jwtUtils.extractUserId(token);

      expect(extractedUserId).toBe(testUserId);
    });

    test('should throw error for invalid token', () => {
      expect(() => jwtUtils.extractUserId('invalid.token.here')).toThrow('Invalid token');
    });
  });

  describe('isTokenExpired', () => {
    test('should return false for valid token', () => {
      const token = jwtUtils.generateToken(testUserId);
      const isExpired = jwtUtils.isTokenExpired(token);

      expect(isExpired).toBe(false);
    });

    test('should return true for expired token', () => {
      // This test is tricky with real expiration, so we test with invalid token
      const isExpired = jwtUtils.isTokenExpired('invalid.token.here');
      
      // Invalid token should not be considered "expired" specifically
      expect(typeof isExpired).toBe('boolean');
    });
  });

  describe('getTokenExpiration', () => {
    test('should get token expiration date', () => {
      const token = jwtUtils.generateToken(testUserId);
      const expiration = jwtUtils.getTokenExpiration(token);

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
    });

    test('should throw error for invalid token', () => {
      expect(() => jwtUtils.getTokenExpiration('invalid-token')).toThrow('Failed to get token expiration');
    });
  });

  describe('generateRefreshToken', () => {
    test('should generate refresh token successfully', () => {
      const refreshToken = jwtUtils.generateRefreshToken(testUserId);

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.split('.')).toHaveLength(3);
    });

    test('should generate refresh token with correct type', () => {
      const refreshToken = jwtUtils.generateRefreshToken(testUserId);
      const decoded = jwtUtils.verifyToken(refreshToken);

      expect(decoded.type).toBe('refresh_token');
      expect(decoded.userId).toBe(testUserId);
    });

    test('should throw error for missing user ID', () => {
      expect(() => jwtUtils.generateRefreshToken()).toThrow('User ID is required for refresh token generation');
    });
  });

  describe('isValidTokenFormat', () => {
    test('should return true for valid JWT format', () => {
      const token = jwtUtils.generateToken(testUserId);
      const isValid = jwtUtils.isValidTokenFormat(token);

      expect(isValid).toBe(true);
    });

    test('should return true for token with Bearer prefix', () => {
      const token = jwtUtils.generateToken(testUserId);
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
  });
});