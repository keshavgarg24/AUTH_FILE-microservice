const express = require('express');
const axios = require('axios');
const multer = require('multer');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Service URLs
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://localhost:3002';

// Helper function to handle service requests
const makeServiceRequest = async (method, url, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Service request error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || { message: 'Service unavailable' },
      status: error.response?.status || 500
    };
  }
};

// Auth endpoints
router.post('/auth/register', async (req, res) => {
  const result = await makeServiceRequest('POST', `${AUTH_SERVICE_URL}/register`, req.body);
  
  if (result.success) {
    res.json(result.data);
  } else {
    res.status(result.status).json(result.error);
  }
});

router.post('/auth/login', async (req, res) => {
  const result = await makeServiceRequest('POST', `${AUTH_SERVICE_URL}/login`, req.body);
  
  if (result.success) {
    // Set token in httpOnly cookie for security
    res.cookie('authToken', result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({
      message: result.data.message,
      userId: result.data.userId,
      email: result.data.email
    });
  } else {
    res.status(result.status).json(result.error);
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ message: 'Logged out successfully' });
});

router.get('/auth/me', async (req, res) => {
  const token = req.cookies.authToken;
  
  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      }
    });
  }

  const result = await makeServiceRequest('GET', `${AUTH_SERVICE_URL}/me`, null, {
    'Authorization': `Bearer ${token}`
  });
  
  if (result.success) {
    res.json(result.data);
  } else {
    if (result.status === 401) {
      res.clearCookie('authToken');
    }
    res.status(result.status).json(result.error);
  }
});

// File endpoints - Handle raw binary upload
router.post('/files/upload', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  const token = req.cookies.authToken;
  
  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      }
    });
  }

  const filename = req.query.filename;
  if (!filename) {
    return res.status(400).json({
      error: {
        message: 'Filename query parameter is required',
        code: 'MISSING_FILENAME'
      }
    });
  }

  if (!req.body || req.body.length === 0) {
    return res.status(400).json({
      error: {
        message: 'No file data provided',
        code: 'NO_FILE_DATA'
      }
    });
  }

  try {
    const response = await axios({
      method: 'POST',
      url: `${FILE_SERVICE_URL}/upload?filename=${encodeURIComponent(filename)}`,
      data: req.body,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/octet-stream'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    res.json(response.data);
  } catch (error) {
    console.error('File upload error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const errorData = error.response?.data || { message: 'Upload failed' };
    
    if (status === 401) {
      res.clearCookie('authToken');
    }
    
    res.status(status).json(errorData);
  }
});

router.get('/files', async (req, res) => {
  const token = req.cookies.authToken;
  
  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      }
    });
  }

  const queryParams = new URLSearchParams(req.query).toString();
  const url = `${FILE_SERVICE_URL}/files${queryParams ? `?${queryParams}` : ''}`;

  const result = await makeServiceRequest('GET', url, null, {
    'Authorization': `Bearer ${token}`
  });
  
  if (result.success) {
    res.json(result.data);
  } else {
    if (result.status === 401) {
      res.clearCookie('authToken');
    }
    res.status(result.status).json(result.error);
  }
});

router.get('/files/:id/download', async (req, res) => {
  const token = req.cookies.authToken;
  
  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      }
    });
  }

  const result = await makeServiceRequest('GET', `${FILE_SERVICE_URL}/file/${req.params.id}`, null, {
    'Authorization': `Bearer ${token}`
  });
  
  if (result.success) {
    res.json(result.data);
  } else {
    if (result.status === 401) {
      res.clearCookie('authToken');
    }
    res.status(result.status).json(result.error);
  }
});

router.delete('/files/:id', async (req, res) => {
  const token = req.cookies.authToken;
  
  if (!token) {
    return res.status(401).json({
      error: {
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      }
    });
  }

  const result = await makeServiceRequest('DELETE', `${FILE_SERVICE_URL}/file/${req.params.id}`, null, {
    'Authorization': `Bearer ${token}`
  });
  
  if (result.success) {
    res.json(result.data);
  } else {
    if (result.status === 401) {
      res.clearCookie('authToken');
    }
    res.status(result.status).json(result.error);
  }
});

module.exports = router;