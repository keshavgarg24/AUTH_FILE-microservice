/**
 * Request logging middleware for auth service
 */

/**
 * Basic request logger middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request start
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Request started`);
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log request completion
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Detailed request logger with additional information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const detailedLogger = (req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Extract useful request information
  const logData = {
    timestamp,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    contentLength: req.get('Content-Length') || 0,
    contentType: req.get('Content-Type'),
    userId: req.user ? req.user.userId : null // Available after authentication
  };
  
  // Log request start
  console.log('Request:', JSON.stringify(logData, null, 2));
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log response information
    const responseData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: chunk ? chunk.length : 0,
      userId: req.user ? req.user.userId : null
    };
    
    console.log('Response:', JSON.stringify(responseData, null, 2));
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Error logger middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorLogger = (err, req, res, next) => {
  const errorData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user ? req.user.userId : null
  };
  
  console.error('Error occurred:', JSON.stringify(errorData, null, 2));
  
  next(err);
};

/**
 * Security logger for authentication events
 * @param {string} event - Event type (login, register, token_validation, etc.)
 * @param {Object} req - Express request object
 * @param {Object} data - Additional data to log
 */
const securityLogger = (event, req, data = {}) => {
  const securityData = {
    timestamp: new Date().toISOString(),
    event,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    ...data
  };
  
  console.log('Security Event:', JSON.stringify(securityData, null, 2));
};

/**
 * Performance logger for slow requests
 * @param {number} threshold - Threshold in milliseconds (default: 1000ms)
 * @returns {Function} Middleware function
 */
const performanceLogger = (threshold = 1000) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.end to check duration
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - startTime;
      
      // Log slow requests
      if (duration > threshold) {
        const slowRequestData = {
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          duration: `${duration}ms`,
          threshold: `${threshold}ms`,
          statusCode: res.statusCode,
          userId: req.user ? req.user.userId : null,
          warning: 'SLOW_REQUEST'
        };
        
        console.warn('Slow Request:', JSON.stringify(slowRequestData, null, 2));
      }
      
      // Call original end method
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

/**
 * Access logger for successful authentications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const accessLogger = (req, res, next) => {
  // Only log after successful authentication
  if (req.user && req.user.userId) {
    const accessData = {
      timestamp: new Date().toISOString(),
      event: 'AUTHENTICATED_ACCESS',
      method: req.method,
      path: req.path,
      userId: req.user.userId,
      tokenType: req.user.tokenType,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    console.log('Access:', JSON.stringify(accessData, null, 2));
  }
  
  next();
};

module.exports = {
  requestLogger,
  detailedLogger,
  errorLogger,
  securityLogger,
  performanceLogger,
  accessLogger
};