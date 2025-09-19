const User = require('../models/User');

class UserRepository {
  /**
   * Create a new user
   * @param {Object} userData - User data containing email and passwordHash
   * @returns {Promise<Object>} Created user object
   */
  async create(userData) {
    try {
      const user = new User(userData);
      const savedUser = await user.save();
      return savedUser.toJSON(); // This will exclude passwordHash due to toJSON transform
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error (email already exists)
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findByEmail(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  async findById(userId) {
    try {
      const user = await User.findById(userId);
      return user ? user.toJSON() : null; // Exclude passwordHash
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by ID including password hash (for authentication)
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User object with passwordHash or null if not found
   */
  async findByIdWithPassword(userId) {
    try {
      const user = await User.findById(userId);
      return user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user by ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} Updated user object or null if not found
   */
  async updateById(userId, updateData) {
    try {
      const user = await User.findByIdAndUpdate(
        userId, 
        updateData, 
        { new: true, runValidators: true }
      );
      return user ? user.toJSON() : null;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  /**
   * Delete user by ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteById(userId) {
    try {
      const result = await User.findByIdAndDelete(userId);
      return !!result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Count total users
   * @returns {Promise<number>} Total number of users
   */
  async count() {
    try {
      return await User.countDocuments();
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new UserRepository();