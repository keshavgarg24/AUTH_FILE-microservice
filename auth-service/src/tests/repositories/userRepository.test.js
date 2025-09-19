const mongoose = require('mongoose');
const userRepository = require('../../repositories/userRepository');
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

describe('UserRepository', () => {
  const validUserData = {
    email: 'test@example.com',
    passwordHash: 'hashedpassword123'
  };

  describe('create', () => {
    test('should create a new user successfully', async () => {
      const user = await userRepository.create(validUserData);

      expect(user._id).toBeDefined();
      expect(user.email).toBe(validUserData.email);
      expect(user.passwordHash).toBeUndefined(); // Should be excluded from JSON
      expect(user.createdAt).toBeDefined();
    });

    test('should throw error for duplicate email', async () => {
      await userRepository.create(validUserData);

      await expect(userRepository.create(validUserData))
        .rejects.toThrow('Email already exists');
    });

    test('should throw error for invalid email', async () => {
      const invalidUserData = {
        ...validUserData,
        email: 'invalid-email'
      };

      await expect(userRepository.create(invalidUserData))
        .rejects.toThrow('Please provide a valid email address');
    });
  });

  describe('findByEmail', () => {
    test('should find user by email', async () => {
      await userRepository.create(validUserData);
      
      const user = await userRepository.findByEmail(validUserData.email);

      expect(user).toBeDefined();
      expect(user.email).toBe(validUserData.email);
      expect(user.passwordHash).toBe(validUserData.passwordHash); // Should include password for auth
    });

    test('should return null for non-existent email', async () => {
      const user = await userRepository.findByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });

    test('should find user with case-insensitive email', async () => {
      await userRepository.create(validUserData);
      
      const user = await userRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(user).toBeDefined();
      expect(user.email).toBe(validUserData.email);
    });
  });

  describe('findById', () => {
    test('should find user by ID', async () => {
      const createdUser = await userRepository.create(validUserData);
      
      const user = await userRepository.findById(createdUser._id);

      expect(user).toBeDefined();
      expect(user._id.toString()).toBe(createdUser._id.toString());
      expect(user.email).toBe(validUserData.email);
      expect(user.passwordHash).toBeUndefined(); // Should be excluded
    });

    test('should return null for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const user = await userRepository.findById(fakeId);

      expect(user).toBeNull();
    });
  });

  describe('findByIdWithPassword', () => {
    test('should find user by ID with password hash', async () => {
      const createdUser = await userRepository.create(validUserData);
      
      const user = await userRepository.findByIdWithPassword(createdUser._id);

      expect(user).toBeDefined();
      expect(user._id.toString()).toBe(createdUser._id.toString());
      expect(user.email).toBe(validUserData.email);
      expect(user.passwordHash).toBe(validUserData.passwordHash); // Should include password
    });
  });

  describe('updateById', () => {
    test('should update user successfully', async () => {
      const createdUser = await userRepository.create(validUserData);
      const updateData = { email: 'updated@example.com' };
      
      const updatedUser = await userRepository.updateById(createdUser._id, updateData);

      expect(updatedUser).toBeDefined();
      expect(updatedUser.email).toBe(updateData.email);
      expect(updatedUser.passwordHash).toBeUndefined(); // Should be excluded
    });

    test('should return null for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = { email: 'updated@example.com' };
      
      const result = await userRepository.updateById(fakeId, updateData);

      expect(result).toBeNull();
    });

    test('should throw error for duplicate email on update', async () => {
      const user1 = await userRepository.create(validUserData);
      const user2Data = { email: 'user2@example.com', passwordHash: 'hash123' };
      const user2 = await userRepository.create(user2Data);

      await expect(userRepository.updateById(user2._id, { email: validUserData.email }))
        .rejects.toThrow('Email already exists');
    });
  });

  describe('deleteById', () => {
    test('should delete user successfully', async () => {
      const createdUser = await userRepository.create(validUserData);
      
      const result = await userRepository.deleteById(createdUser._id);

      expect(result).toBe(true);
      
      // Verify user is deleted
      const deletedUser = await userRepository.findById(createdUser._id);
      expect(deletedUser).toBeNull();
    });

    test('should return false for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const result = await userRepository.deleteById(fakeId);

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    test('should return correct user count', async () => {
      expect(await userRepository.count()).toBe(0);

      await userRepository.create(validUserData);
      expect(await userRepository.count()).toBe(1);

      await userRepository.create({ email: 'user2@example.com', passwordHash: 'hash123' });
      expect(await userRepository.count()).toBe(2);
    });
  });
});