/**
 * Request logging middleware for file service
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
 * File operation logger
 * @param {string} operation - Operation type (upload, download, delete, etc.)
 * @param {Object} req - Express request object
 * @param {Object} data - Additional data to log
 */
const fileOperationLogger = (operation, req, data = {}) => {
  const operationData = {
    timestamp: new Date().toISOString(),
    operation,
    method: req.method,
    path: req.path,
    userId: req.user ? req.user.userId : null,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    ...data
  };
  
  console.log('File Operation:', JSON.stringify(operationData, null, 2));
};

/**
 * Upload logger middleware specifically for file uploads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const uploadLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log upload start
  if (req.method === 'POST' && req.path === '/upload') {
    const uploadData = {
      timestamp: new Date().toISOString(),
      event: 'UPLOAD_STARTED',
      userId: req.user ? req.user.userId : null,
      filename: req.query.filename,
      contentLength: req.get('Content-Length') || 0,
      contentType: req.get('Content-Type'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    console.log('Upload Started:', JSON.stringify(uploadData, null, 2));
  }
  
  // Override res.end to log upload completion
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log upload completion
    if (req.method === 'POST' && req.path === '/upload') {
      const uploadCompleteData = {
        timestamp: new Date().toISOString(),
        event: 'UPLOAD_COMPLETED',
        userId: req.user ? req.user.userId : null,
        filename: req.query.filename,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        success: res.statusCode >= 200 && res.statusCode < 300
      };
      
      console.log('Upload Completed:', JSON.stringify(uploadCompleteData, null, 2));
    }
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Download logger middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const downloadLogger = (req, res, next) => {
  // Log download requests
  if (req.method === 'GET' && req.path.startsWith('/file/')) {
    const downloadData = {
      timestamp: new Date().toISOString(),
      event: 'DOWNLOAD_REQUESTED',
      userId: req.user ? req.user.userId : null,
      fileId: req.params.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
    
    console.log('Download Requested:', JSON.stringify(downloadData, null, 2));
  }
  
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
    userId: req.user ? req.user.userId : null,
    filename: req.query ? req.query.filename : null,
    fileId: req.params ? req.params.id : null
  };
  
  console.error('Error occurred:', JSON.stringify(errorData, null, 2));
  
  next(err);
};

/**
 * Performance logger for slow requests
 * @param {number} threshold - Threshold in milliseconds (default: 5000ms for file operations)
 * @returns {Function} Middleware function
 */
const performanceLogger = (threshold = 5000) => {
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
          filename: req.query ? req.query.filename : null,
          fileId: req.params ? req.params.id : null,
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
 * Storage operation logger for S3 operations
 * @param {string} operation - S3 operation (upload, download, delete, etc.)
 * @param {Object} data - Operation data
 */
const storageLogger = (operation, data = {}) => {
  const storageData = {
    timestamp: new Date().toISOString(),
    service: 'S3',
    operation,
    ...data
  };
  
  console.log('Storage Operation:', JSON.stringify(storageData, null, 2));
};

module.exports = {
  requestLogger,
  detailedLogger,
  fileOperationLogger,
  uploadLogger,
  downloadLogger,
  errorLogger,
  performanceLogger,
  storageLogger
};