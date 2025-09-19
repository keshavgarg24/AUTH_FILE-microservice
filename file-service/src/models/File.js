const mongoose = require('mongoose');

// File metadata schema definition
const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true,
    maxlength: [255, 'Filename must be less than 255 characters']
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true,
    maxlength: [255, 'Original filename must be less than 255 characters']
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be greater than 0'],
    max: [52428800, 'File size must be less than 50MB'] // 50MB in bytes
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'User ID is required'],
    ref: 'User',
    index: true // Index for efficient queries by user
  },
  s3Key: {
    type: String,
    required: [true, 'S3 key is required'],
    unique: true,
    trim: true
  },
  s3Bucket: {
    type: String,
    required: [true, 'S3 bucket is required'],
    trim: true
  },
  mimeType: {
    type: String,
    trim: true,
    default: 'application/octet-stream'
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true // Index for sorting by upload date
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  downloadCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Index for filtering active files
  },
  metadata: {
    // Additional metadata can be stored here
    contentType: String,
    encoding: String,
    checksum: String,
    tags: [String]
  }
}, {
  // Add timestamps for updatedAt
  timestamps: true,
  // Optimize JSON output
  toJSON: {
    transform: function(doc, ret) {
      // Convert ObjectId to string for cleaner API responses
      ret.fileId = ret._id.toString();
      ret.userId = ret.userId.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Create indexes for better performance
fileSchema.index({ userId: 1, uploadedAt: -1 }); // Compound index for user files sorted by date
fileSchema.index({ s3Key: 1 }, { unique: true }); // Unique index on S3 key
fileSchema.index({ filename: 1, userId: 1 }); // Index for filename searches by user
fileSchema.index({ isActive: 1, uploadedAt: -1 }); // Index for active files
fileSchema.index({ 'metadata.tags': 1 }); // Index for tag searches

// Virtual for file URL (if needed)
fileSchema.virtual('fileUrl').get(function() {
  return `/file/${this._id}`;
});

// Instance methods
fileSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  this.lastAccessedAt = new Date();
  return this.save();
};

fileSchema.methods.markAsDeleted = function() {
  this.isActive = false;
  return this.save();
};

fileSchema.methods.updateMetadata = function(metadata) {
  this.metadata = { ...this.metadata, ...metadata };
  return this.save();
};

// Static methods
fileSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId, isActive: true };
  
  let mongoQuery = this.find(query);
  
  if (options.limit) {
    mongoQuery = mongoQuery.limit(options.limit);
  }
  
  if (options.skip) {
    mongoQuery = mongoQuery.skip(options.skip);
  }
  
  // Default sort by upload date (newest first)
  mongoQuery = mongoQuery.sort(options.sort || { uploadedAt: -1 });
  
  return mongoQuery;
};

fileSchema.statics.findByFilename = function(userId, filename) {
  return this.find({ 
    userId, 
    filename: new RegExp(filename, 'i'), // Case-insensitive search
    isActive: true 
  });
};

fileSchema.statics.getTotalSizeByUser = function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isActive: true } },
    { $group: { _id: null, totalSize: { $sum: '$size' } } }
  ]);
};

// Pre-save middleware
fileSchema.pre('save', function(next) {
  // Ensure filename doesn't contain path separators
  if (this.filename && (this.filename.includes('/') || this.filename.includes('\\'))) {
    this.filename = this.filename.replace(/[/\\]/g, '_');
  }
  
  // Update lastAccessedAt on save
  if (this.isModified() && !this.isModified('lastAccessedAt')) {
    this.lastAccessedAt = new Date();
  }
  
  next();
});

// Create the File model
const File = mongoose.model('File', fileSchema);

module.exports = File;