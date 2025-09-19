const userRepository = require('../repositories/userRepository');
const passwordUtils = require('../utils/passwordUtils');
const jwtUtils = require('../utils/jwtUtils');

class AuthController {
  /**
   * Register a new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async register(req, res) {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          error: {
            message: 'Email and password are required',
            code: 'MISSING_FIELDS'
          }
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: {
            message: 'Please provide a valid email address',
            code: 'INVALID_EMAIL'
          }
        });
      }

      // Validate password strength
      const passwordValidation = passwordUtils.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: {
            message: 'Password does not meet requirements',
            code: 'WEAK_PASSWORD',
            details: passwordValidation.errors
          }
        });
      }

      // Check if user already exists
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: {
            message: 'User with this email already exists',
            code: 'EMAIL_EXISTS'
          }
        });
      }

      // Hash password
      const passwordHash = await passwordUtils.hashPassword(password);

      // Create user
      const userData = {
        email: email.toLowerCase().trim(),
        passwordHash
      };

      const newUser = await userRepository.create(userData);

      // Return success response (excluding password hash)
      res.status(201).json({
        message: 'User registered successfully',
        userId: newUser._id,
        email: newUser.email,
        createdAt: newUser.createdAt
      });

    } catch (error) {
      console.error('Registration error:', error);

      // Handle specific database errors
      if (error.message === 'Email already exists') {
        return res.status(409).json({
          error: {
            message: 'User with this email already exists',
            code: 'EMAIL_EXISTS'
          }
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: Object.values(error.errors).map(err => err.message)
          }
        });
      }

      // Generic server error
      res.status(500).json({
        error: {
          message: 'Internal server error during registration',
          code: 'REGISTRATION_ERROR'
        }
      });
    }
  }

  /**
   * Login user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          error: {
            message: 'Email and password are required',
            code: 'MISSING_FIELDS'
          }
        });
      }

      // Find user by email
      const user = await userRepository.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          error: {
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
          }
        });
      }

      // Verify password
      const isPasswordValid = await passwordUtils.comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: {
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
          }
        });
      }

      // Generate JWT token
      const token = jwtUtils.generateToken(user._id);

      // Return success response with token
      res.json({
        message: 'Login successful',
        token,
        userId: user._id.toString(),
        email: user.email
      });

    } catch (error) {
      console.error('Login error:', error);

      // Generic server error
      res.status(500).json({
        error: {
          message: 'Internal server error during login',
          code: 'LOGIN_ERROR'
        }
      });
    }
  }

  /**
   * Get user profile (requires authentication)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProfile(req, res) {
    try {
      // User ID is available from authentication middleware
      const userId = req.user.userId;

      // Get user from database
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Return user profile (password hash is already excluded by toJSON)
      res.json({
        userId: user._id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });

    } catch (error) {
      console.error('Get profile error:', error);

      res.status(500).json({
        error: {
          message: 'Internal server error while fetching profile',
          code: 'PROFILE_ERROR'
        }
      });
    }
  }

  /**
   * Refresh token (optional feature for future use)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async refreshToken(req, res) {
    try {
      // User ID is available from authentication middleware (refresh token)
      const userId = req.user.userId;

      // Verify user still exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
      }

      // Generate new access token
      const newToken = jwtUtils.generateToken(user._id);

      res.json({
        message: 'Token refreshed successfully',
        token: newToken,
        userId: user._id.toString()
      });

    } catch (error) {
      console.error('Refresh token error:', error);

      res.status(500).json({
        error: {
          message: 'Internal server error during token refresh',
          code: 'REFRESH_ERROR'
        }
      });
    }
  }
}

module.exports = new AuthController();