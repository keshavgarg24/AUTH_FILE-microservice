const bcrypt = require('bcrypt');
const { config } = require('../config/env');

class PasswordUtils {
  /**
   * Hash a plain text password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const saltRounds = config.bcrypt.rounds;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      return hashedPassword;
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Compare a plain text password with a hashed password
   * @param {string} password - Plain text password
   * @param {string} hashedPassword - Hashed password from database
   * @returns {Promise<boolean>} True if passwords match, false otherwise
   */
  async comparePassword(password, hashedPassword) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }

      if (!hashedPassword || typeof hashedPassword !== 'string') {
        throw new Error('Hashed password must be a non-empty string');
      }

      const isMatch = await bcrypt.compare(password, hashedPassword);
      return isMatch;
    } catch (error) {
      throw new Error(`Password comparison failed: ${error.message}`);
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Plain text password to validate
   * @returns {Object} Validation result with isValid boolean and errors array
   */
  validatePasswordStrength(password) {
    const errors = [];
    
    if (!password || typeof password !== 'string') {
      errors.push('Password must be a string');
      return { isValid: false, errors };
    }

    if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters long');
    }

    // Check for at least one letter
    if (!/[a-zA-Z]/.test(password)) {
      errors.push('Password must contain at least one letter');
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a random salt (for advanced use cases)
   * @param {number} rounds - Number of salt rounds (default from config)
   * @returns {Promise<string>} Generated salt
   */
  async generateSalt(rounds = config.bcrypt.rounds) {
    try {
      const salt = await bcrypt.genSalt(rounds);
      return salt;
    } catch (error) {
      throw new Error(`Salt generation failed: ${error.message}`);
    }
  }

  /**
   * Hash password with custom salt (for advanced use cases)
   * @param {string} password - Plain text password
   * @param {string} salt - Custom salt
   * @returns {Promise<string>} Hashed password
   */
  async hashPasswordWithSalt(password, salt) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }

      if (!salt || typeof salt !== 'string') {
        throw new Error('Salt must be a non-empty string');
      }

      const hashedPassword = await bcrypt.hash(password, salt);
      return hashedPassword;
    } catch (error) {
      throw new Error(`Password hashing with salt failed: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new PasswordUtils();