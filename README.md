# Simple Auth & File Upload Microservices

A Node.js microservices solution with user authentication and file upload capabilities.

## Project Structure

```
auth-file-microservices/
├── auth-service/           # User authentication service
├── file-service/          # File upload and management service
├── user-ui/              # Web interface (bonus)
├── docker-compose.yml    # Docker configuration
├── README.md            # This file
└── ARCHITECTURE.md      # System architecture
```

## Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User UI       │    │  Auth Service   │    │  File Service   │
│  (Port 3000)    │    │  (Port 3001)    │    │  (Port 3002)    │
│                 │    │                 │    │                 │
│ - Registration  │◄──►│ - POST /register│    │ - POST /upload  │
│ - Login         │    │ - POST /login   │    │ - GET /file/:id │
│ - File Upload   │    │ - GET /me       │◄──►│ - GET /files    │
│ - File Download │    │ - JWT tokens    │    │ - JWT auth      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │    MongoDB      │    │     AWS S3      │
│                 │    │                 │    │                 │
│ - Modern UI     │    │ - Users         │    │ - File Storage  │
│ - File Manager  │    │ - File Metadata │    │ - Presigned URLs│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Requirements Met

### Core Features
- User registration with email and password
- User login with JWT token generation
- Password hashing with bcrypt (never store plain text)
- File upload (max 50MB, non-multipart)
- Files saved to AWS S3 using AWS SDK
- File metadata stored in MongoDB
- JWT authentication required for file operations
- Presigned download URLs for secure file access

### Bonus Features
- GET /me endpoint for user profile
- Request logging (console.log method & path)
- Modern web UI for complete user experience

### Tech Stack
- Node.js & Express.js
- MongoDB with Mongoose
- AWS S3 SDK
- JWT with HMAC signing
- bcrypt for password hashing

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (running locally or connection string)
- AWS Account with S3 bucket

### 1. Installation

```bash
# Install dependencies for all services
cd auth-service && npm install
cd ../file-service && npm install
cd ../user-ui && npm install
cd ..
```

### 2. Environment Configuration

Create `.env` files for each service:

**auth-service/.env:**
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/auth_service
JWT_SECRET=your-super-secret-jwt-key
BCRYPT_ROUNDS=12
```

**file-service/.env:**
```env
PORT=3002
MONGODB_URI=mongodb://localhost:27017/file_service
JWT_SECRET=your-super-secret-jwt-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
MAX_FILE_SIZE=52428800
```

**user-ui/.env:**
```env
PORT=3000
AUTH_SERVICE_URL=http://localhost:3001
FILE_SERVICE_URL=http://localhost:3002
```

### 3. Start Services

**Option A: Individual Services (3 terminals)**
```bash
# Terminal 1 - Auth Service
cd auth-service
npm start

# Terminal 2 - File Service
cd file-service
npm start

# Terminal 3 - User UI (optional)
cd user-ui
npm start
```

**Option B: Docker**
```bash
docker-compose up
```

### 4. Access the Application
- Web Interface: http://localhost:3000
- Auth Service API: http://localhost:3001
- File Service API: http://localhost:3002

## API Documentation

### Auth Service (localhost:3001)

#### POST /register
Register a new user.

**Request:**
```bash
curl -X POST http://localhost:3001/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

**Response:**
```json
{
  "message": "User registered successfully",
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "createdAt": "2023-10-01T12:00:00.000Z"
}
```

#### POST /login
Authenticate user and get JWT token.

**Request:**
```bash
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com"
}
```

#### GET /me (Bonus)
Get current user profile.

**Request:**
```bash
curl -X GET http://localhost:3001/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "createdAt": "2023-10-01T12:00:00.000Z"
}
```

### File Service (localhost:3002)

#### POST /upload
Upload a file (requires JWT authentication).

**Request:**
```bash
curl -X POST "http://localhost:3002/upload?filename=document.pdf" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @/path/to/your/file.pdf
```

**Response:**
```json
{
  "message": "File uploaded successfully",
  "fileId": "507f1f77bcf86cd799439012",
  "filename": "document.pdf",
  "size": 1024000,
  "s3Key": "files/507f1f77bcf86cd799439011/uuid-filename.pdf",
  "mimeType": "application/pdf",
  "uploadedAt": "2023-10-01T12:00:00.000Z"
}
```

#### GET /file/:id
Get presigned download URL for a file.

**Request:**
```bash
curl -X GET http://localhost:3002/file/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "downloadUrl": "https://your-bucket.s3.amazonaws.com/presigned-url",
  "filename": "document.pdf",
  "size": 1024000,
  "mimeType": "application/pdf",
  "expiresIn": 900,
  "expiresAt": "2023-10-01T12:15:00.000Z"
}
```

#### GET /files
Get list of user's files.

**Request:**
```bash
curl -X GET "http://localhost:3002/files?limit=10&skip=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "files": [
    {
      "fileId": "507f1f77bcf86cd799439012",
      "filename": "document.pdf",
      "size": 1024000,
      "mimeType": "application/pdf",
      "uploadedAt": "2023-10-01T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "skip": 0,
    "hasMore": false
  }
}
```

## Data Models

### Users Collection (MongoDB)
```javascript
{
  _id: ObjectId,
  email: String (unique, lowercase),
  passwordHash: String,  // bcrypt hashed
  createdAt: Date,
  updatedAt: Date
}
```

### Files Collection (MongoDB)
```javascript
{
  _id: ObjectId,
  filename: String,
  size: Number,
  userId: ObjectId,      // Reference to user
  s3Key: String,         // AWS S3 object key
  mimeType: String,
  uploadedAt: Date,
  isActive: Boolean
}
```

## Error Handling

The APIs return appropriate HTTP status codes:

- **200**: Success
- **201**: Created (registration, upload)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (missing/invalid JWT)
- **404**: Not Found (file/user not found)
- **409**: Conflict (duplicate email)
- **413**: Payload Too Large (file > 50MB)
- **500**: Internal Server Error

## Testing

Run tests for each service:

```bash
# Test auth service
cd auth-service
npm test

# Test file service
cd file-service
npm test

# Test user interface
cd user-ui
npm test
```

## Security Features

- Password hashing with bcrypt (configurable rounds)
- JWT tokens with HMAC-SHA256 signing
- File ownership verification
- Presigned URLs for secure downloads (15-minute expiry)
- Input validation and sanitization
- Environment variable configuration

## Logging (Bonus Feature)

All services include request logging:
```
[2023-10-01T12:00:00.000Z] POST /register - Request started
[2023-10-01T12:00:00.123Z] POST /register - 201 - 123ms
```

## Deployment

### Development
```bash
# Start all services individually
cd auth-service && npm start
cd file-service && npm start
cd user-ui && npm start
```

### Production with Docker
```bash
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env files

2. **AWS S3 Errors**
   - Verify AWS credentials in file-service/.env
   - Ensure S3 bucket exists and is accessible
   - Check IAM permissions for S3 operations

3. **JWT Token Issues**
   - Ensure JWT_SECRET is identical in both services
   - Check token expiration (default: 24 hours)

4. **File Upload Failures**
   - Verify file size is under 50MB
   - Check Content-Type: application/octet-stream header
   - Ensure valid JWT token in Authorization header

## Assignment Compliance

### Core Requirements
- Auth Service with registration, login, JWT tokens
- File Service with upload (max 50MB), S3 storage, metadata in MongoDB
- Tech Stack: Node.js/Express, MongoDB, AWS SDK
- Authentication: JWT with HMAC, bcrypt password hashing
- API Endpoints: POST /register, POST /login, POST /upload, GET /file/:id
- Error Handling: 401, 400, 413 status codes
- Code Quality: Clear structure, comments, src/ directories

### Bonus Features
- GET /me endpoint for user profile
- Request logging with console.log
- Modern web UI for complete user experience

### File Structure
```
auth-service/
├── src/
│   ├── config/         # Database and environment config
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Auth, logging, error handling
│   ├── models/         # MongoDB models
│   ├── repositories/   # Data access layer
│   ├── routes/         # Express routes
│   ├── utils/          # JWT and password utilities
│   └── server.js       # Main server file
├── package.json
└── .env

file-service/
├── src/
│   ├── config/         # Database and environment config
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Auth, logging, error handling
│   ├── models/         # MongoDB models
│   ├── repositories/   # Data access layer
│   ├── routes/         # Express routes
│   ├── services/       # AWS S3 integration
│   ├── utils/          # JWT utilities
│   └── server.js       # Main server file
├── package.json
└── .env
```

This implementation provides a complete, working microservices solution that meets all assignment requirements with additional bonus features and a modern web interface.