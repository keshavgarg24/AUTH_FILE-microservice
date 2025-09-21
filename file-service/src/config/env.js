require('dotenv').config();

// Environment variable validation
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLOUDFLARE_ACCESS_KEY_ID',
  'CLOUDFLARE_SECRET_ACCESS_KEY',
  'CLOUDFLARE_ENDPOINT',
  'R2_BUCKET_NAME'
];

const optionalEnvVars = {
  PORT: 3002,
  MAX_FILE_SIZE: 52428800 // 50MB in bytes
};

function validateEnvironment() {
  const missing = [];
  
  // Check required variables
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Set defaults for optional variables
  Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
    if (!process.env[key]) {
      process.env[key] = defaultValue.toString();
    }
  });

  console.log('Environment variables validated successfully');
}

// Configuration object
const config = {
  port: parseInt(process.env.PORT) || 3002,
  mongodb: {
    uri: process.env.MONGODB_URI
  },
  jwt: {
    secret: process.env.JWT_SECRET
  },
  cloudflare: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    endpoint: process.env.CLOUDFLARE_ENDPOINT,
    bucketName: process.env.R2_BUCKET_NAME
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800
  }
};

module.exports = {
  validateEnvironment,
  config
};