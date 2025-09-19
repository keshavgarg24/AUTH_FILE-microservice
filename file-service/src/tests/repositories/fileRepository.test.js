const mongoose = require('mongoose');
const fileRepository = require('../../repositories/fileRepository');
const File = require('../../models/File');

// Setup test database
beforeAll(async () => {
  const mongoUri = 'mongodb://localhost:27017/file_service_test';
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await File.deleteMany({});
});

describe('FileRepository', () => {
  const userId1 = new mongoose.Types.ObjectId();
  const userId2 = new mongoose.Types.ObjectId();
  
  const validFileData = {
    filename: 'test-file.pdf',
    originalName: 'Original Test File.pdf',
    size: 1024000,
    userId: userId1,
    s3Key: 'files/user123/test-file-uuid.pdf',
    s3Bucket: 'test-bucket',
    mimeType: 'application/pdf'
  };

  describe('create', () => {
    test('should create a new file successfully', async () => {
      const file = await fileRepository.create(validFileData);

      expect(file.fileId).toBeDefined();
      expect(file.filename).toBe(validFileData.filename);
      expect(file.size).toBe(validFileData.size);
      expect(file.userId).toBe(validFileData.userId.toString());
      expect(file.s3Key).toBe(validFileData.s3Key);
      expect(file.uploadedAt).toBeDefined();
    });

    test('should throw error for duplicate S3 key', async () => {
      await fileRepository.create(validFileData);

      const duplicateData = {
        ...validFileData,
        filename: 'different-file.pdf',
        userId: userId2
      };

      await expect(fileRepository.create(duplicateData))
        .rejects.toThrow('File with this S3 key already exists');
    });

    test('should throw error for invalid data', async () => {
      const invalidData = {
        ...validFileData,
        size: -1 // Invalid size
      };

      await expect(fileRepository.create(invalidData))
        .rejects.toThrow();
    });
  });

  describe('findById', () => {
    test('should find file by ID', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      const file = await fileRepository.findById(createdFile.fileId);

      expect(file).toBeDefined();
      expect(file.fileId).toBe(createdFile.fileId);
      expect(file.filename).toBe(validFileData.filename);
    });

    test('should return null for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const file = await fileRepository.findById(fakeId);

      expect(file).toBeNull();
    });

    test('should return null for invalid ID format', async () => {
      const file = await fileRepository.findById('invalid-id');

      expect(file).toBeNull();
    });

    test('should not find inactive files', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      // Mark as deleted
      await fileRepository.markAsDeleted(createdFile.fileId, userId1.toString());
      
      const file = await fileRepository.findById(createdFile.fileId);

      expect(file).toBeNull();
    });
  });

  describe('findByIdIncludingInactive', () => {
    test('should find inactive files', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      // Mark as deleted
      await fileRepository.markAsDeleted(createdFile.fileId, userId1.toString());
      
      const file = await fileRepository.findByIdIncludingInactive(createdFile.fileId);

      expect(file).toBeDefined();
      expect(file.isActive).toBe(false);
    });
  });

  describe('findByS3Key', () => {
    test('should find file by S3 key', async () => {
      await fileRepository.create(validFileData);
      
      const file = await fileRepository.findByS3Key(validFileData.s3Key);

      expect(file).toBeDefined();
      expect(file.s3Key).toBe(validFileData.s3Key);
    });

    test('should return null for non-existent S3 key', async () => {
      const file = await fileRepository.findByS3Key('non-existent-key');

      expect(file).toBeNull();
    });
  });

  describe('findByUserId', () => {
    beforeEach(async () => {
      // Create test files
      await fileRepository.create({ ...validFileData, s3Key: 'key1', filename: 'file1.txt' });
      await fileRepository.create({ ...validFileData, s3Key: 'key2', filename: 'file2.txt' });
      await fileRepository.create({ ...validFileData, userId: userId2, s3Key: 'key3', filename: 'file3.txt' });
    });

    test('should find files by user ID', async () => {
      const files = await fileRepository.findByUserId(userId1.toString());

      expect(files).toHaveLength(2);
      expect(files.every(file => file.userId === userId1.toString())).toBe(true);
    });

    test('should return empty array for invalid user ID', async () => {
      const files = await fileRepository.findByUserId('invalid-id');

      expect(files).toEqual([]);
    });

    test('should respect limit option', async () => {
      const files = await fileRepository.findByUserId(userId1.toString(), { limit: 1 });

      expect(files).toHaveLength(1);
    });

    test('should respect skip option', async () => {
      const allFiles = await fileRepository.findByUserId(userId1.toString());
      const skippedFiles = await fileRepository.findByUserId(userId1.toString(), { skip: 1 });

      expect(skippedFiles).toHaveLength(allFiles.length - 1);
    });
  });

  describe('findByIdAndUserId', () => {
    test('should find file by ID and user ID', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      const file = await fileRepository.findByIdAndUserId(createdFile.fileId, userId1.toString());

      expect(file).toBeDefined();
      expect(file.fileId).toBe(createdFile.fileId);
      expect(file.userId).toBe(userId1.toString());
    });

    test('should return null for wrong user ID', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      const file = await fileRepository.findByIdAndUserId(createdFile.fileId, userId2.toString());

      expect(file).toBeNull();
    });

    test('should return null for invalid IDs', async () => {
      const file = await fileRepository.findByIdAndUserId('invalid-file-id', 'invalid-user-id');

      expect(file).toBeNull();
    });
  });

  describe('updateById', () => {
    test('should update file successfully', async () => {
      const createdFile = await fileRepository.create(validFileData);
      const updateData = { filename: 'updated-file.pdf' };
      
      const updatedFile = await fileRepository.updateById(createdFile.fileId, updateData);

      expect(updatedFile).toBeDefined();
      expect(updatedFile.filename).toBe(updateData.filename);
      expect(updatedFile.lastAccessedAt).toBeDefined();
    });

    test('should return null for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = { filename: 'updated-file.pdf' };
      
      const result = await fileRepository.updateById(fakeId, updateData);

      expect(result).toBeNull();
    });
  });

  describe('incrementDownloadCount', () => {
    test('should increment download count', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      const updatedFile = await fileRepository.incrementDownloadCount(createdFile.fileId);

      expect(updatedFile).toBeDefined();
      expect(updatedFile.downloadCount).toBe(1);
      expect(updatedFile.lastAccessedAt).toBeDefined();
    });

    test('should return null for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const result = await fileRepository.incrementDownloadCount(fakeId);

      expect(result).toBeNull();
    });
  });

  describe('markAsDeleted', () => {
    test('should mark file as deleted', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      const result = await fileRepository.markAsDeleted(createdFile.fileId, userId1.toString());

      expect(result).toBe(true);
      
      // Verify file is marked as inactive
      const file = await fileRepository.findById(createdFile.fileId);
      expect(file).toBeNull();
    });

    test('should return false for wrong user ID', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      const result = await fileRepository.markAsDeleted(createdFile.fileId, userId2.toString());

      expect(result).toBe(false);
    });

    test('should return false for non-existent ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const result = await fileRepository.markAsDeleted(fakeId, userId1.toString());

      expect(result).toBe(false);
    });
  });

  describe('deleteById', () => {
    test('should permanently delete file', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      const result = await fileRepository.deleteById(createdFile.fileId, userId1.toString());

      expect(result).toBe(true);
      
      // Verify file is completely removed
      const file = await fileRepository.findByIdIncludingInactive(createdFile.fileId);
      expect(file).toBeNull();
    });

    test('should return false for wrong user ID', async () => {
      const createdFile = await fileRepository.create(validFileData);
      
      const result = await fileRepository.deleteById(createdFile.fileId, userId2.toString());

      expect(result).toBe(false);
    });
  });

  describe('countByUserId', () => {
    beforeEach(async () => {
      await fileRepository.create({ ...validFileData, s3Key: 'key1' });
      await fileRepository.create({ ...validFileData, s3Key: 'key2' });
      await fileRepository.create({ ...validFileData, userId: userId2, s3Key: 'key3' });
      
      // Create inactive file
      const inactiveFile = await fileRepository.create({ ...validFileData, s3Key: 'key4' });
      await fileRepository.markAsDeleted(inactiveFile.fileId, userId1.toString());
    });

    test('should count active files by user ID', async () => {
      const count = await fileRepository.countByUserId(userId1.toString());

      expect(count).toBe(2); // Only active files
    });

    test('should return 0 for invalid user ID', async () => {
      const count = await fileRepository.countByUserId('invalid-id');

      expect(count).toBe(0);
    });
  });

  describe('getTotalSizeByUserId', () => {
    beforeEach(async () => {
      await fileRepository.create({ ...validFileData, s3Key: 'key1', size: 1000 });
      await fileRepository.create({ ...validFileData, s3Key: 'key2', size: 2000 });
      await fileRepository.create({ ...validFileData, userId: userId2, s3Key: 'key3', size: 3000 });
    });

    test('should calculate total size by user ID', async () => {
      const totalSize = await fileRepository.getTotalSizeByUserId(userId1.toString());

      expect(totalSize).toBe(3000); // 1000 + 2000
    });

    test('should return 0 for user with no files', async () => {
      const totalSize = await fileRepository.getTotalSizeByUserId(new mongoose.Types.ObjectId().toString());

      expect(totalSize).toBe(0);
    });
  });

  describe('searchByFilename', () => {
    beforeEach(async () => {
      await fileRepository.create({ ...validFileData, s3Key: 'key1', filename: 'document.pdf' });
      await fileRepository.create({ ...validFileData, s3Key: 'key2', filename: 'image.jpg' });
      await fileRepository.create({ ...validFileData, s3Key: 'key3', filename: 'another-document.pdf' });
    });

    test('should search files by filename', async () => {
      const files = await fileRepository.searchByFilename(userId1.toString(), 'document');

      expect(files).toHaveLength(2);
      expect(files.every(file => file.filename.includes('document'))).toBe(true);
    });

    test('should return empty array for no matches', async () => {
      const files = await fileRepository.searchByFilename(userId1.toString(), 'nonexistent');

      expect(files).toEqual([]);
    });
  });

  describe('findByDateRange', () => {
    test('should find files by date range', async () => {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      
      await fileRepository.create({ ...validFileData, s3Key: 'key1' });
      
      const files = await fileRepository.findByDateRange(userId1.toString(), startDate, endDate);

      expect(files).toHaveLength(1);
    });

    test('should return empty array for date range with no files', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2020-01-02');
      
      const files = await fileRepository.findByDateRange(userId1.toString(), startDate, endDate);

      expect(files).toEqual([]);
    });
  });
});