require('dotenv').config();

// Environment variable validation
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_ACCOUNT_ID'
];

const optionalEnvVars = {
  PORT: 3002,
  MAX_FILE_SIZE: 52428800, // 50MB in bytes
  CLOUDFLARE_R2_PUBLIC_ENDPOINT: null, // Optional public URL for downloads
  CLOUDFLARE_R2_BUCKET_REGION: 'auto'
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
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    bucketName: process.env.CLOUDFLARE_R2_BUCKET,
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    region: process.env.CLOUDFLARE_R2_BUCKET_REGION || 'auto',
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_ENDPOINT
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800
  }
};

module.exports = {
  validateEnvironment,
  config
};