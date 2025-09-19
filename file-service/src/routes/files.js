const express = require('express');
const fileController = require('../controllers/fileController');
const { authenticateToken } = require('../middleware/auth');

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

module.exports = router;