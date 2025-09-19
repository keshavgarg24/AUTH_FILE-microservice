const mongoose = require('mongoose');

// User schema definition
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(email) {
        // Basic email validation regex
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Please provide a valid email address'
    }
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
    minlength: [6, 'Password hash must be at least 6 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  // Add timestamps for updatedAt
  timestamps: true,
  // Remove password hash from JSON output
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      delete ret.__v;
      return ret;
    }
  }
});

// Create indexes for better performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: 1 });

// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;