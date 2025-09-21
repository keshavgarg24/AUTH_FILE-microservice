const express = require('express');
const fileController = require('../controllers/fileController');
const { authenticateToken } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/**
 * @route POST /upload
 * @desc Upload a file to S3 and save metadata
 * @access Private (requires JWT token)
 */
router.post('/upload', authenticateToken, fileController.uploadFile);

/**
 * @route GET /file/:id
 * @desc Get presigned download URL for a file
 * @access Private (requires JWT token)
 */
router.get('/file/:id', authenticateToken, fileController.getFileDownloadUrl);

/**
 * @route GET /files
 * @desc Get list of user's files
 * @access Private (requires JWT token)
 */
router.get('/files', authenticateToken, fileController.getUserFiles);

/**
 * @route DELETE /file/:id
 * @desc Delete a file
 * @access Private (requires JWT token)
 */
router.delete('/file/:id', authenticateToken, fileController.deleteFile);

/**
 * @route GET /local/:userId/:filename
 * @desc Serve local files directly
 * @access Private (requires JWT token)
 */
router.get('/local/:userId/:filename', authenticateToken, (req, res) => {
  try {
    const { userId, filename } = req.params;
    
    // Verify user can access this file
    if (req.user.userId !== userId) {
      return res.status(403).json({
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        }
      });
    }
    
    const filePath = path.join(process.cwd(), 'uploads', userId, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: {
          message: 'File not found',
          code: 'FILE_NOT_FOUND'
        }
      });
    }
    
    // Serve the file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Local file serve error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      }
    });
  }
});

module.exports = router;