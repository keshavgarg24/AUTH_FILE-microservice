const express = require('express');
const cors = require('cors');
const { validateEnvironment } = require('./config/env');
const dbConnection = require('./config/database');
const authRoutes = require('./routes/auth');

// Validate environment variables
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (optional feature)
const { requestLogger, performanceLogger } = require('./middleware/logger');
app.use(requestLogger);
app.use(performanceLogger(1000)); // Log requests taking more than 1 second

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    database: dbConnection.isConnected() ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/', authRoutes);

// Error handling middleware
const { errorHandler, notFoundHandler, timeoutHandler } = require('./middleware/errorHandler');

// Request timeout middleware
app.use(timeoutHandler(30000)); // 30 seconds timeout

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
      console.log(`Auth service running on port ${PORT}`);
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