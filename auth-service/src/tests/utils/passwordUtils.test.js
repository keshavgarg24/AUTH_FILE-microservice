const passwordUtils = require('../../utils/passwordUtils');

describe('PasswordUtils', () => {
  const validPassword = 'testPassword123';
  const weakPassword = '123';

  describe('hashPassword', () => {
    test('should hash password successfully', async () => {
      const hashedPassword = await passwordUtils.hashPassword(validPassword);

      expect(hashedPassword).toBeDefined();
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).not.toBe(validPassword);
      expect(hashedPassword.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    test('should throw error for empty password', async () => {
      await expect(passwordUtils.hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    });

    test('should throw error for null password', async () => {
      await expect(passwordUtils.hashPassword(null)).rejects.toThrow('Password must be a non-empty string');
    });

    test('should throw error for non-string password', async () => {
      await expect(passwordUtils.hashPassword(123)).rejects.toThrow('Password must be a non-empty string');
    });

    test('should throw error for password shorter than 6 characters', async () => {
      await expect(passwordUtils.hashPassword('12345')).rejects.toThrow('Password must be at least 6 characters long');
    });

    test('should generate different hashes for same password', async () => {
      const hash1 = await passwordUtils.hashPassword(validPassword);
      const hash2 = await passwordUtils.hashPassword(validPassword);

      expect(hash1).not.toBe(hash2); // bcrypt uses random salt
    });
  });

  describe('comparePassword', () => {
    test('should return true for matching password', async () => {
      const hashedPassword = await passwordUtils.hashPassword(validPassword);
      const isMatch = await passwordUtils.comparePassword(validPassword, hashedPassword);

      expect(isMatch).toBe(true);
    });

    test('should return false for non-matching password', async () => {
      const hashedPassword = await passwordUtils.hashPassword(validPassword);
      const isMatch = await passwordUtils.comparePassword('wrongPassword', hashedPassword);

      expect(isMatch).toBe(false);
    });

    test('should throw error for empty password', async () => {
      const hashedPassword = await passwordUtils.hashPassword(validPassword);
      
      await expect(passwordUtils.comparePassword('', hashedPassword))
        .rejects.toThrow('Password must be a non-empty string');
    });

    test('should throw error for empty hashed password', async () => {
      await expect(passwordUtils.comparePassword(validPassword, ''))
        .rejects.toThrow('Hashed password must be a non-empty string');
    });

    test('should throw error for null password', async () => {
      const hashedPassword = await passwordUtils.hashPassword(validPassword);
      
      await expect(passwordUtils.comparePassword(null, hashedPassword))
        .rejects.toThrow('Password must be a non-empty string');
    });

    test('should throw error for null hashed password', async () => {
      await expect(passwordUtils.comparePassword(validPassword, null))
        .rejects.toThrow('Hashed password must be a non-empty string');
    });
  });

  describe('validatePasswordStrength', () => {
    test('should validate strong password', () => {
      const result = passwordUtils.validatePasswordStrength('StrongPass123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject password without letters', () => {
      const result = passwordUtils.validatePasswordStrength('123456');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one letter');
    });

    test('should reject password without numbers', () => {
      const result = passwordUtils.validatePasswordStrength('password');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    test('should reject password shorter than 6 characters', () => {
      const result = passwordUtils.validatePasswordStrength('abc12');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 6 characters long');
    });

    test('should reject password longer than 128 characters', () => {
      const longPassword = 'a'.repeat(120) + '12345678';
      const result = passwordUtils.validatePasswordStrength(longPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be less than 128 characters long');
    });

    test('should reject null password', () => {
      const result = passwordUtils.validatePasswordStrength(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be a string');
    });

    test('should reject non-string password', () => {
      const result = passwordUtils.validatePasswordStrength(123456);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be a string');
    });

    test('should return multiple errors for weak password', () => {
      const result = passwordUtils.validatePasswordStrength('abc');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 6 characters long');
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });

  describe('generateSalt', () => {
    test('should generate salt successfully', async () => {
      const salt = await passwordUtils.generateSalt();

      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBeGreaterThan(20); // bcrypt salts are typically 29 chars
    });

    test('should generate different salts', async () => {
      const salt1 = await passwordUtils.generateSalt();
      const salt2 = await passwordUtils.generateSalt();

      expect(salt1).not.toBe(salt2);
    });

    test('should generate salt with custom rounds', async () => {
      const salt = await passwordUtils.generateSalt(10);

      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
    });
  });

  describe('hashPasswordWithSalt', () => {
    test('should hash password with custom salt', async () => {
      const salt = await passwordUtils.generateSalt();
      const hashedPassword = await passwordUtils.hashPasswordWithSalt(validPassword, salt);

      expect(hashedPassword).toBeDefined();
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).not.toBe(validPassword);
    });

    test('should throw error for empty password', async () => {
      const salt = await passwordUtils.generateSalt();
      
      await expect(passwordUtils.hashPasswordWithSalt('', salt))
        .rejects.toThrow('Password must be a non-empty string');
    });

    test('should throw error for empty salt', async () => {
      await expect(passwordUtils.hashPasswordWithSalt(validPassword, ''))
        .rejects.toThrow('Salt must be a non-empty string');
    });
  });
});