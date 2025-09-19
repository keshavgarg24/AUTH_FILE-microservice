const jwt = require('jsonwebtoken');
const { config } = require('../config/env');

class JWTUtils {
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