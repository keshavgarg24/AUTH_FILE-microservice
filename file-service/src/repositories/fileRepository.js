const File = require('../models/File');
const mongoose = require('mongoose');

class FileRepository {
  /**
   * Create a new file record
   * @param {Object} fileData - File metadata
   * @returns {Promise<Object>} Created file object
   */
  async create(fileData) {
    try {
      const file = new File(fileData);
      const savedFile = await file.save();
      return savedFile.toJSON();
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error (S3 key already exists)
        throw new Error('File with this S3 key already exists');
      }
      throw error;
    }
  }

  /**
   * Find file by ID
   * @param {string} fileId - File ID
   * @returns {Promise<Object|null>} File object or null if not found
   */
  async findById(fileId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return null;
      }
      
      const file = await File.findOne({ _id: fileId, isActive: true });
      return file ? file.toJSON() : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find file by ID including inactive files
   * @param {string} fileId - File ID
   * @returns {Promise<Object|null>} File object or null if not found
   */
  async findByIdIncludingInactive(fileId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return null;
      }
      
      const file = await File.findById(fileId);
      return file ? file.toJSON() : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find file by S3 key
   * @param {string} s3Key - S3 key
   * @returns {Promise<Object|null>} File object or null if not found
   */
  async findByS3Key(s3Key) {
    try {
      const file = await File.findOne({ s3Key, isActive: true });
      return file ? file.toJSON() : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find files by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options (limit, skip, sort)
   * @returns {Promise<Array>} Array of file objects
   */
  async findByUserId(userId, options = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return [];
      }
      
      const files = await File.findByUser(userId, options);
      return files.map(file => file.toJSON());
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find file by ID and user ID (for ownership verification)
   * @param {string} fileId - File ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} File object or null if not found/not owned
   */
  async findByIdAndUserId(fileId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return null;
      }
      
      const file = await File.findOne({ 
        _id: fileId, 
        userId: userId, 
        isActive: true 
      });
      return file ? file.toJSON() : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update file by ID
   * @param {string} fileId - File ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} Updated file object or null if not found
   */
  async updateById(fileId, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return null;
      }
      
      const file = await File.findByIdAndUpdate(
        fileId,
        { ...updateData, lastAccessedAt: new Date() },
        { new: true, runValidators: true }
      );
      return file ? file.toJSON() : null;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('File with this S3 key already exists');
      }
      throw error;
    }
  }

  /**
   * Increment download count for a file
   * @param {string} fileId - File ID
   * @returns {Promise<Object|null>} Updated file object or null if not found
   */
  async incrementDownloadCount(fileId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return null;
      }
      
      const file = await File.findByIdAndUpdate(
        fileId,
        { 
          $inc: { downloadCount: 1 },
          lastAccessedAt: new Date()
        },
        { new: true }
      );
      return file ? file.toJSON() : null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark file as deleted (soft delete)
   * @param {string} fileId - File ID
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<boolean>} True if deleted, false if not found/not owned
   */
  async markAsDeleted(fileId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return false;
      }
      
      const result = await File.findOneAndUpdate(
        { _id: fileId, userId: userId, isActive: true },
        { isActive: false, lastAccessedAt: new Date() },
        { new: true }
      );
      return !!result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Permanently delete file record
   * @param {string} fileId - File ID
   * @param {string} userId - User ID (for ownership verification)
   * @returns {Promise<boolean>} True if deleted, false if not found/not owned
   */
  async deleteById(fileId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return false;
      }
      
      const result = await File.findOneAndDelete({ _id: fileId, userId: userId });
      return !!result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get total file count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total number of active files
   */
  async countByUserId(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return 0;
      }
      
      return await File.countDocuments({ userId, isActive: true });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get total storage used by a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total size in bytes
   */
  async getTotalSizeByUserId(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return 0;
      }
      
      const result = await File.getTotalSizeByUser(userId);
      return result.length > 0 ? result[0].totalSize : 0;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search files by filename
   * @param {string} userId - User ID
   * @param {string} filename - Filename to search for
   * @returns {Promise<Array>} Array of matching file objects
   */
  async searchByFilename(userId, filename) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return [];
      }
      
      const files = await File.findByFilename(userId, filename);
      return files.map(file => file.toJSON());
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get files uploaded in a date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of file objects
   */
  async findByDateRange(userId, startDate, endDate) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return [];
      }
      
      const files = await File.find({
        userId,
        isActive: true,
        uploadedAt: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ uploadedAt: -1 });
      
      return files.map(file => file.toJSON());
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new FileRepository();