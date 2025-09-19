const dbConnection = require('../config/database');

// Mock environment variables for testing
process.env.MONGODB_URI = 'mongodb://localhost:27017/file_service_test';

describe('Database Connection', () => {
  afterAll(async () => {
    await dbConnection.disconnect();
  });

  test('should connect to MongoDB successfully', async () => {
    const connection = await dbConnection.connect();
    expect(connection).toBeDefined();
    expect(dbConnection.isConnected()).toBe(true);
  });

  test('should throw error when MONGODB_URI is missing', async () => {
    const originalUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;

    await expect(dbConnection.connect()).rejects.toThrow('MONGODB_URI environment variable is required');
    
    // Restore original URI
    process.env.MONGODB_URI = originalUri;
  });

  test('should disconnect from MongoDB successfully', async () => {
    await dbConnection.connect();
    await dbConnection.disconnect();
    expect(dbConnection.isConnected()).toBe(false);
  });
});