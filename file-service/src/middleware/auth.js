const jwtUtils = require('../utils/jwtUtils');

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: {
          message: 'Authorization header is required',
          code: 'MISSING_AUTH_HEADER'
        }
      });
    }

    // Extract token (handle both "Bearer token" and "token" formats)
    let token;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      token = authHeader;
    }

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Token is required',
          code: 'MISSING_TOKEN'
        }
      });
    }

    // Verify token
    const decoded = jwtUtils.verifyToken(token);
    
    // Add user information to request object
    req.user = {
      userId: decoded.userId,
      tokenType: decoded.type,
      iat: decoded.iat,
      exp: decoded.exp
    };

    next();
  } catch (error) {
    // Handle different types of token errors
    let statusCode = 401;
    let errorCode = 'INVALID_TOKEN';
    let message = 'Invalid or expired token';

    if (error.message === 'Token has expired') {
      errorCode = 'TOKEN_EXPIRED';
      message = 'Token has expired';
    } else if (error.message === 'Invalid token') {
      errorCode = 'INVALID_TOKEN';
      message = 'Invalid token format';
    } else if (error.message === 'Token not active yet') {
      errorCode = 'TOKEN_NOT_ACTIVE';
      message = 'Token is not active yet';
    }

    return res.status(statusCode).json({
      error: {
        message,
        code: errorCode
      }
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // No token provided, continue without authentication
      req.user = null;
      return next();
    }

    // Extract token
    let token;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      token = authHeader;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    // Try to verify token
    const decoded = jwtUtils.verifyToken(token);
    
    req.user = {
      userId: decoded.userId,
      tokenType: decoded.type,
      iat: decoded.iat,
      exp: decoded.exp
    };

    next();
  } catch (error) {
    // If token verification fails, continue without authentication
    req.user = null;
    next();
  }
};

/**
 * Middleware to check if user is authenticated (after authenticateToken)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAuth
};