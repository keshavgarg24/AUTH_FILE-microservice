const express = require('express');
const cors = require('cors');
const { validateEnvironment } = require('./config/env');
const dbConnection = require('./config/database');
const fileRoutes = require('./routes/files');

// Validate environment variables
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));
app.use(express.json());

// Request logging middleware (optional feature)
const { requestLogger, performanceLogger, uploadLogger, downloadLogger } = require('./middleware/logger');
app.use(requestLogger);
app.use(performanceLogger(5000)); // Log requests taking more than 5 seconds
app.use(uploadLogger);
app.use(downloadLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'file-service',
    timestamp: new Date().toISOString(),
    database: dbConnection.isConnected() ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/', fileRoutes);

// Error handling middleware
const { errorHandler, notFoundHandler, timeoutHandler, fileUploadErrorHandler } = require('./middleware/errorHandler');

// Request timeout middleware
app.use(timeoutHandler(60000)); // 60 seconds timeout for file uploads

// File upload specific error handler
app.use(fileUploadErrorHandler);

// 404 handler (must be after all routes)
app.use('*', notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await dbConnection.connect();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`File service running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await dbConnection.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await dbConnection.disconnect();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;