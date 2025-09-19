const mongoose = require('mongoose');
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

describe('File Model', () => {
  const validFileData = {
    filename: 'test-file.pdf',
    originalName: 'Original Test File.pdf',
    size: 1024000, // 1MB
    userId: new mongoose.Types.ObjectId(),
    s3Key: 'files/user123/test-file-uuid.pdf',
    s3Bucket: 'test-bucket',
    mimeType: 'application/pdf'
  };

  test('should create a file with valid data', async () => {
    const file = new File(validFileData);
    const savedFile = await file.save();

    expect(savedFile._id).toBeDefined();
    expect(savedFile.filename).toBe(validFileData.filename);
    expect(savedFile.size).toBe(validFileData.size);
    expect(savedFile.userId.toString()).toBe(validFileData.userId.toString());
    expect(savedFile.s3Key).toBe(validFileData.s3Key);
    expect(savedFile.uploadedAt).toBeDefined();
    expect(savedFile.isActive).toBe(true);
    expect(savedFile.downloadCount).toBe(0);
  });

  test('should require filename field', async () => {
    const fileData = { ...validFileData };
    delete fileData.filename;
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('Filename is required');
  });

  test('should require originalName field', async () => {
    const fileData = { ...validFileData };
    delete fileData.originalName;
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('Original filename is required');
  });

  test('should require size field', async () => {
    const fileData = { ...validFileData };
    delete fileData.size;
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('File size is required');
  });

  test('should require userId field', async () => {
    const fileData = { ...validFileData };
    delete fileData.userId;
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('User ID is required');
  });

  test('should require s3Key field', async () => {
    const fileData = { ...validFileData };
    delete fileData.s3Key;
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('S3 key is required');
  });

  test('should require s3Bucket field', async () => {
    const fileData = { ...validFileData };
    delete fileData.s3Bucket;
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('S3 bucket is required');
  });

  test('should validate file size minimum', async () => {
    const fileData = {
      ...validFileData,
      size: 0
    };
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('File size must be greater than 0');
  });

  test('should validate file size maximum', async () => {
    const fileData = {
      ...validFileData,
      size: 52428801 // 50MB + 1 byte
    };
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('File size must be less than 50MB');
  });

  test('should validate filename length', async () => {
    const fileData = {
      ...validFileData,
      filename: 'a'.repeat(256) // Too long
    };
    
    const file = new File(fileData);
    
    await expect(file.save()).rejects.toThrow('Filename must be less than 255 characters');
  });

  test('should enforce unique s3Key constraint', async () => {
    // Create first file
    const file1 = new File(validFileData);
    await file1.save();

    // Try to create second file with same s3Key
    const file2Data = {
      ...validFileData,
      filename: 'different-file.pdf',
      userId: new mongoose.Types.ObjectId()
    };
    const file2 = new File(file2Data);
    
    await expect(file2.save()).rejects.toThrow();
  });

  test('should set default values correctly', async () => {
    const minimalFileData = {
      filename: 'test.txt',
      originalName: 'test.txt',
      size: 1000,
      userId: new mongoose.Types.ObjectId(),
      s3Key: 'unique-key-123',
      s3Bucket: 'test-bucket'
    };
    
    const file = new File(minimalFileData);
    const savedFile = await file.save();

    expect(savedFile.mimeType).toBe('application/octet-stream');
    expect(savedFile.isActive).toBe(true);
    expect(savedFile.downloadCount).toBe(0);
    expect(savedFile.uploadedAt).toBeDefined();
    expect(savedFile.lastAccessedAt).toBeDefined();
  });

  test('should transform JSON output correctly', async () => {
    const file = new File(validFileData);
    const savedFile = await file.save();
    
    const fileJson = savedFile.toJSON();
    
    expect(fileJson.fileId).toBeDefined();
    expect(fileJson.userId).toBe(validFileData.userId.toString());
    expect(fileJson._id).toBeUndefined();
    expect(fileJson.__v).toBeUndefined();
  });

  test('should sanitize filename with path separators', async () => {
    const fileData = {
      ...validFileData,
      filename: 'path/to/file.txt'
    };
    
    const file = new File(fileData);
    const savedFile = await file.save();

    expect(savedFile.filename).toBe('path_to_file.txt');
  });

  describe('Instance Methods', () => {
    let savedFile;

    beforeEach(async () => {
      const file = new File(validFileData);
      savedFile = await file.save();
    });

    test('should increment download count', async () => {
      const originalCount = savedFile.downloadCount;
      const originalAccessTime = savedFile.lastAccessedAt;
      
      await savedFile.incrementDownloadCount();
      
      expect(savedFile.downloadCount).toBe(originalCount + 1);
      expect(savedFile.lastAccessedAt.getTime()).toBeGreaterThan(originalAccessTime.getTime());
    });

    test('should mark as deleted', async () => {
      expect(savedFile.isActive).toBe(true);
      
      await savedFile.markAsDeleted();
      
      expect(savedFile.isActive).toBe(false);
    });

    test('should update metadata', async () => {
      const newMetadata = {
        contentType: 'application/pdf',
        tags: ['document', 'important']
      };
      
      await savedFile.updateMetadata(newMetadata);
      
      expect(savedFile.metadata.contentType).toBe(newMetadata.contentType);
      expect(savedFile.metadata.tags).toEqual(newMetadata.tags);
    });
  });

  describe('Static Methods', () => {
    let userId1, userId2;

    beforeEach(async () => {
      userId1 = new mongoose.Types.ObjectId();
      userId2 = new mongoose.Types.ObjectId();

      // Create test files
      await File.create([
        { ...validFileData, userId: userId1, s3Key: 'key1', filename: 'file1.txt' },
        { ...validFileData, userId: userId1, s3Key: 'key2', filename: 'file2.txt' },
        { ...validFileData, userId: userId2, s3Key: 'key3', filename: 'file3.txt' },
        { ...validFileData, userId: userId1, s3Key: 'key4', filename: 'file4.txt', isActive: false }
      ]);
    });

    test('should find files by user', async () => {
      const files = await File.findByUser(userId1);
      
      expect(files).toHaveLength(2); // Only active files
      expect(files.every(file => file.userId.toString() === userId1.toString())).toBe(true);
      expect(files.every(file => file.isActive)).toBe(true);
    });

    test('should find files by user with limit', async () => {
      const files = await File.findByUser(userId1, { limit: 1 });
      
      expect(files).toHaveLength(1);
    });

    test('should find files by filename', async () => {
      const files = await File.findByFilename(userId1, 'file1');
      
      expect(files).toHaveLength(1);
      expect(files[0].filename).toBe('file1.txt');
    });

    test('should calculate total size by user', async () => {
      const result = await File.getTotalSizeByUser(userId1);
      
      expect(result).toHaveLength(1);
      expect(result[0].totalSize).toBe(validFileData.size * 2); // 2 active files
    });
  });
});