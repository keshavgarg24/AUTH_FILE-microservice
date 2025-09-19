const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

class JWTUtils {
  /**
   * Generate a JWT token for a user
   * @param {string} userId - User ID to include in token payload
   * @param {Object} options - Additional options for token generation
   * @returns {string} Generated JWT token
   */
  generateToken(userId, options = {}) {
    try {
      if (!userId) {
        throw new Error('User ID is required for token generation');
      }

      const payload = {
        userId: userId.toString(),
        type: 'access_token'
      };

      const tokenOptions = {
        expiresIn: options.expiresIn || config.jwt.expiresIn,
        issuer: options.issuer || 'auth-service',
        audience: options.audience || 'microservices'
      };

      const token = jwt.sign(payload, config.jwt.secret, tokenOptions);
      return token;
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Token must be a non-empty string');
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      const decoded = jwt.verify(cleanToken, config.jwt.secret);
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Decode a JWT token without verification (for debugging)
   * @param {string} token - JWT token to decode
   * @returns {Object} Decoded token payload (unverified)
   */
  decodeToken(token) {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Token must be a non-empty string');
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      const decoded = jwt.decode(cleanToken, { complete: true });
      return decoded;
    } catch (error) {
      throw new Error(`Token decoding failed: ${error.message}`);
    }
  }

  /**
   * Extract user ID from a verified token
   * @param {string} token - JWT token
   * @returns {string} User ID from token payload
   */
  extractUserId(token) {
    try {
      const decoded = this.verifyToken(token);
      
      if (!decoded.userId) {
        throw new Error('Token does not contain user ID');
      }

      return decoded.userId;
    } catch (error) {
      throw error; // Re-throw verification errors
    }
  }

  /**
   * Check if a token is expired without throwing an error
   * @param {string} token - JWT token to check
   * @returns {boolean} True if token is expired, false otherwise
   */
  isTokenExpired(token) {
    try {
      this.verifyToken(token);
      return false; // Token is valid, not expired
    } catch (error) {
      return error.message === 'Token has expired';
    }
  }

  /**
   * Get token expiration time
   * @param {string} token - JWT token
   * @returns {Date|null} Expiration date or null if no expiration
   */
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      
      if (decoded.payload && decoded.payload.exp) {
        return new Date(decoded.payload.exp * 1000); // Convert from seconds to milliseconds
      }
      
      return null;
    } catch (error) {
      throw new Error(`Failed to get token expiration: ${error.message}`);
    }
  }

  /**
   * Generate a refresh token (longer expiration)
   * @param {string} userId - User ID to include in token payload
   * @returns {string} Generated refresh token
   */
  generateRefreshToken(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required for refresh token generation');
      }

      const payload = {
        userId: userId.toString(),
        type: 'refresh_token'
      };

      const tokenOptions = {
        expiresIn: '7d', // Refresh tokens last longer
        issuer: 'auth-service',
        audience: 'microservices'
      };

      const token = jwt.sign(payload, config.jwt.secret, tokenOptions);
      return token;
    } catch (error) {
      throw new Error(`Refresh token generation failed: ${error.message}`);
    }
  }

  /**
   * Validate token format without verification
   * @param {string} token - Token to validate format
   * @returns {boolean} True if token has valid JWT format
   */
  isValidTokenFormat(token) {
    try {
      if (!token || typeof token !== 'string') {
        return false;
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      // JWT tokens have 3 parts separated by dots
      const parts = cleanToken.split('.');
      return parts.length === 3;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new JWTUtils();