const mongoose = require('mongoose');
const User = require('../../models/User');

// Setup test database
beforeAll(async () => {
  const mongoUri = 'mongodb://localhost:27017/auth_service_test';
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('User Model', () => {
  const validUserData = {
    email: 'test@example.com',
    passwordHash: 'hashedpassword123'
  };

  test('should create a user with valid data', async () => {
    const user = new User(validUserData);
    const savedUser = await user.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.email).toBe(validUserData.email);
    expect(savedUser.passwordHash).toBe(validUserData.passwordHash);
    expect(savedUser.createdAt).toBeDefined();
  });

  test('should convert email to lowercase', async () => {
    const userData = {
      ...validUserData,
      email: 'TEST@EXAMPLE.COM'
    };
    
    const user = new User(userData);
    const savedUser = await user.save();

    expect(savedUser.email).toBe('test@example.com');
  });

  test('should trim email whitespace', async () => {
    const userData = {
      ...validUserData,
      email: '  test@example.com  '
    };
    
    const user = new User(userData);
    const savedUser = await user.save();

    expect(savedUser.email).toBe('test@example.com');
  });

  test('should require email field', async () => {
    const userData = {
      passwordHash: 'hashedpassword123'
    };
    
    const user = new User(userData);
    
    await expect(user.save()).rejects.toThrow('Email is required');
  });

  test('should require passwordHash field', async () => {
    const userData = {
      email: 'test@example.com'
    };
    
    const user = new User(userData);
    
    await expect(user.save()).rejects.toThrow('Password hash is required');
  });

  test('should validate email format', async () => {
    const userData = {
      ...validUserData,
      email: 'invalid-email'
    };
    
    const user = new User(userData);
    
    await expect(user.save()).rejects.toThrow('Please provide a valid email address');
  });

  test('should enforce unique email constraint', async () => {
    // Create first user
    const user1 = new User(validUserData);
    await user1.save();

    // Try to create second user with same email
    const user2 = new User(validUserData);
    
    await expect(user2.save()).rejects.toThrow();
  });

  test('should exclude passwordHash from JSON output', async () => {
    const user = new User(validUserData);
    const savedUser = await user.save();
    
    const userJson = savedUser.toJSON();
    
    expect(userJson.passwordHash).toBeUndefined();
    expect(userJson.email).toBe(validUserData.email);
    expect(userJson._id).toBeDefined();
  });

  test('should validate minimum password hash length', async () => {
    const userData = {
      ...validUserData,
      passwordHash: '12345' // Too short
    };
    
    const user = new User(userData);
    
    await expect(user.save()).rejects.toThrow('Password hash must be at least 6 characters');
  });
});