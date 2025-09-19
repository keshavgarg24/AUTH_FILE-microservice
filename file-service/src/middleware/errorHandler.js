/**
 * Centralized error handling middleware for file service
 */

/**
 * Error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message,
      value: error.value
    }));
  } else if (err.name === 'CastError') {
    // Mongoose cast errors (invalid ObjectId, etc.)
    statusCode = 400;
    errorCode = 'INVALID_DATA';
    message = 'Invalid data format';
    details = {
      field: err.path,
      value: err.value,
      expectedType: err.kind
    };
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'Duplicate entry found';
    
    // Extract field name from error
    const field = Object.keys(err.keyPattern)[0];
    details = {
      field: field,
      message: `${field} already exists`
    };
  } else if (err.name === 'JsonWebTokenError') {
    // JWT errors
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT expiration errors
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    // MongoDB connection/server errors
    statusCode = 503;
    errorCode = 'DATABASE_ERROR';
    message = 'Database service unavailable';
  } else if (err.statusCode || err.status) {
    // Errors with predefined status codes
    statusCode = err.statusCode || err.status;
    errorCode = err.code || 'HTTP_ERROR';
    message = err.message || 'HTTP error occurred';
  }

  // Handle file service specific errors
  if (err.message && err.message.includes('S3 upload failed')) {
    statusCode = 500;
    errorCode = 'STORAGE_ERROR';
    message = 'Failed to upload file to storage';
  } else if (err.message && err.message.includes('Failed to generate presigned URL')) {
    statusCode = 500;
    errorCode = 'URL_GENERATION_ERROR';
    message = 'Failed to generate download URL';
  } else if (err.message === 'File with this S3 key already exists') {
    statusCode = 409;
    errorCode = 'DUPLICATE_FILE';
    message = 'File already exists';
  } else if (err.message === 'File not found in S3') {
    statusCode = 404;
    errorCode = 'FILE_NOT_IN_STORAGE';
    message = 'File not found in storage';
  }

  // Handle request size errors
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'File size exceeds maximum limit';
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    details = null;
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      code: errorCode,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  });
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  });
};

/**
 * Async error wrapper to catch async errors in route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request timeout handler
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Function} Middleware function
 */
const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    res.setTimeout(timeout, () => {
      const err = new Error('Request timeout');
      err.statusCode = 408;
      err.code = 'REQUEST_TIMEOUT';
      next(err);
    });
    next();
  };
};

/**
 * File upload error handler
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const fileUploadErrorHandler = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        message: 'File size exceeds maximum limit of 50MB',
        code: 'FILE_TOO_LARGE',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: {
        message: 'Unexpected file field',
        code: 'UNEXPECTED_FILE',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      }
    });
  }

  next(err);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  timeoutHandler,
  fileUploadErrorHandler
};