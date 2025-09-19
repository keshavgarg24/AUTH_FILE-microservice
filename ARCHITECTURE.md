# Architecture Documentation

## System Overview

This microservices architecture consists of two main backend services and an optional web interface, designed for user authentication and file management.

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Web Browser   │   Mobile App    │   API Clients               │
│                 │                 │                             │
│ - User Interface│ - Native Apps   │ - Third-party integrations  │
│ - File Manager  │ - Mobile Upload │ - Automated systems         │
└─────────────────┴─────────────────┴─────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    User Interface (Optional)                   │
│                      Port 3000                                 │
├─────────────────────────────────────────────────────────────────┤
│ - Modern Web UI                                                 │
│ - Authentication Forms                                          │
│ - File Upload/Download Interface                               │
│ - API Proxy to Backend Services                                │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                           │
├─────────────────────────┬───────────────────────────────────────┤
│    Auth Service         │         File Service                  │
│    Port 3001            │         Port 3002                     │
├─────────────────────────┼───────────────────────────────────────┤
│                         │                                       │
│ Endpoints:              │ Endpoints:                            │
│ • POST /register        │ • POST /upload                        │
│ • POST /login           │ • GET /file/:id                       │
│ • GET /me               │ • GET /files                          │
│                         │                                       │
│ Features:               │ Features:                             │
│ • JWT Generation        │ • JWT Validation                      │
│ • Password Hashing      │ • File Upload (50MB max)             │
│ • User Management       │ • S3 Integration                      │
│ • Request Logging       │ • Presigned URLs                      │
└─────────────────────────┴───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                   │
├─────────────────────────┬───────────────────────────────────────┤
│      MongoDB            │         AWS S3                        │
├─────────────────────────┼───────────────────────────────────────┤
│                         │                                       │
│ Collections:            │ Storage:                              │
│                         │                                       │
│ users {                 │ Bucket Structure:                     │
│   _id: ObjectId         │ /files/                               │
│   email: String         │   ├─ userId1/                         │
│   passwordHash: String  │   │   ├─ uuid1-filename.ext           │
│   createdAt: Date       │   │   └─ uuid2-filename.ext           │
│ }                       │   ├─ userId2/                         │
│                         │   │   └─ uuid3-filename.ext           │
│ files {                 │   └─ ...                              │
│   _id: ObjectId         │                                       │
│   filename: String      │ Features:                             │
│   size: Number          │ • Server-side encryption             │
│   userId: ObjectId      │ • Presigned URLs                      │
│   s3Key: String         │ • Access control                      │
│   mimeType: String      │ • Automatic cleanup                   │
│   uploadedAt: Date      │                                       │
│   isActive: Boolean     │                                       │
│ }                       │                                       │
└─────────────────────────┴───────────────────────────────────────┘
```

## Data Flow

### User Registration Flow
```
1. Client → POST /register → Auth Service
2. Auth Service → Hash password with bcrypt
3. Auth Service → Store user in MongoDB
4. Auth Service → Return success response
```

### User Authentication Flow
```
1. Client → POST /login → Auth Service
2. Auth Service → Validate credentials against MongoDB
3. Auth Service → Generate JWT token
4. Auth Service → Return token to client
5. Client → Store token for subsequent requests
```

### File Upload Flow
```
1. Client → POST /upload (with JWT) → File Service
2. File Service → Validate JWT token
3. File Service → Generate unique S3 key
4. File Service → Upload file to S3
5. File Service → Store metadata in MongoDB
6. File Service → Return file information
```

### File Download Flow
```
1. Client → GET /file/:id (with JWT) → File Service
2. File Service → Validate JWT token
3. File Service → Verify file ownership
4. File Service → Generate presigned S3 URL
5. File Service → Return download URL
6. Client → Direct download from S3 using presigned URL
```

## Security Architecture

### Authentication & Authorization
- **JWT Tokens**: HMAC-SHA256 signed tokens containing user ID
- **Token Validation**: Middleware validates tokens on protected routes
- **Password Security**: bcrypt hashing with configurable rounds
- **File Ownership**: Users can only access their own files

### Data Protection
- **Encryption at Rest**: S3 server-side encryption (AES256)
- **Encryption in Transit**: HTTPS for all API communications
- **Presigned URLs**: Time-limited access (15 minutes) to S3 objects
- **Input Validation**: Request validation and sanitization

## Scalability Considerations

### Horizontal Scaling
- **Stateless Services**: Both services are stateless and can be scaled horizontally
- **Load Balancing**: Services can run multiple instances behind load balancers
- **Database Sharding**: MongoDB can be sharded by user ID for large datasets

### Performance Optimization
- **Connection Pooling**: MongoDB connection pooling for efficient database access
- **Caching**: JWT token validation can be cached
- **CDN Integration**: S3 can be fronted by CloudFront for global distribution

## Deployment Architecture

### Development Environment
```
Local Machine:
├─ auth-service (localhost:3001)
├─ file-service (localhost:3002)
├─ user-ui (localhost:3000)
├─ MongoDB (localhost:27017)
└─ AWS S3 (remote)
```

### Production Environment
```
Cloud Infrastructure:
├─ Load Balancer
├─ Auth Service Instances (multiple)
├─ File Service Instances (multiple)
├─ MongoDB Cluster (replica set)
├─ AWS S3 (with CloudFront)
└─ Monitoring & Logging
```

## Technology Stack

### Backend Services
- **Runtime**: Node.js (v14+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with jsonwebtoken library
- **Password Hashing**: bcrypt
- **File Storage**: AWS S3 SDK v2
- **Testing**: Jest

### Frontend (Optional)
- **Technology**: Vanilla JavaScript SPA
- **Styling**: Modern CSS with responsive design
- **API Communication**: Fetch API
- **Authentication**: Cookie-based session management

## Error Handling Strategy

### HTTP Status Codes
- **200**: Successful operations
- **201**: Resource creation (registration, upload)
- **400**: Client errors (validation failures)
- **401**: Authentication required
- **404**: Resource not found
- **409**: Conflict (duplicate email)
- **413**: Payload too large (file size)
- **500**: Server errors

### Error Response Format
```json
{
  "error": {
    "message": "Human readable error message",
    "code": "ERROR_CODE",
    "details": "Additional error details"
  }
}
```

## Monitoring & Logging

### Request Logging
- All HTTP requests logged with method, path, and response time
- Error logging with stack traces for debugging
- User actions tracked for audit purposes

### Health Checks
- Service health endpoints for monitoring
- Database connection status
- S3 connectivity verification

## Configuration Management

### Environment Variables
- Service ports and URLs
- Database connection strings
- AWS credentials and S3 bucket names
- JWT secrets and bcrypt rounds
- File size limits and other constraints

### Security Best Practices
- Secrets stored in environment variables
- Different configurations for development/production
- No hardcoded credentials in source code

This architecture provides a robust, scalable foundation for user authentication and file management while maintaining security and performance standards.