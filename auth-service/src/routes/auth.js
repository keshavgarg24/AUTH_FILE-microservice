const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken, requireTokenType } = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', authController.register);

/**
 * @route POST /login
 * @desc Login user and return JWT token
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route GET /me
 * @desc Get current user profile
 * @access Private (requires JWT token)
 */
router.get('/me', authenticateToken, authController.getProfile);

/**
 * @route POST /refresh
 * @desc Refresh access token using refresh token
 * @access Private (requires refresh token)
 */
router.post('/refresh', 
  authenticateToken, 
  requireTokenType('refresh_token'), 
  authController.refreshToken
);

module.exports = router;