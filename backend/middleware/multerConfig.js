const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Using 'fs' for synchronous operations like mkdirSync

// Common file filter for images
const imageFileFilter = (req, file, cb) => {
  console.log(`[Multer Config - ${file.fieldname}] imageFileFilter invoked. File mimetype: ${file.mimetype}`);
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    console.log(`[Multer Config - ${file.fieldname}] imageFileFilter: File is not an image.`);
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

// Common filename generator
const generateFilename = (req, file, cb) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const finalFilename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
  console.log(`[Multer Config - ${file.fieldname}] storage.filename invoked. Original filename: ${file.originalname}, New filename: ${finalFilename}`);
  cb(null, finalFilename);
};

// Storage engine for Product Images (tenant-specific)
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.user || !req.user.tenant_id) {
      console.error('[Multer Config - Product] Error: User or Tenant ID not found in request.');
      return cb(new Error('Tenant ID not found for product image upload. Ensure user is authenticated.'));
    }
    const tenantId = req.user.tenant_id;
    const uploadPath = path.join(__dirname, '..', 'uploads', tenantId, 'products');
    console.log(`[Multer Config - Product] Destination: ${uploadPath}`);
    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
        console.log(`[Multer Config - Product] Created directory: ${uploadPath}`);
      }
      cb(null, uploadPath);
    } catch (error) {
      console.error(`[Multer Config - Product] Error creating/accessing directory ${uploadPath}:`, error);
      cb(error);
    }
  },
  filename: generateFilename
});

// Storage engine for Category Images (tenant-specific)
const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.user || !req.user.tenant_id) {
      console.error('[Multer Config - Category] Error: User or Tenant ID not found in request.');
      return cb(new Error('Tenant ID not found for category image upload. Ensure user is authenticated.'));
    }
    const tenantId = req.user.tenant_id;
    const uploadPath = path.join(__dirname, '..', 'uploads', tenantId, 'categories');
    console.log(`[Multer Config - Category] Destination: ${uploadPath}`);
    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
        console.log(`[Multer Config - Category] Created directory: ${uploadPath}`);
      }
      cb(null, uploadPath);
    } catch (error) {
      console.error(`[Multer Config - Category] Error creating/accessing directory ${uploadPath}:`, error);
      cb(error);
    }
  },
  filename: generateFilename
});

const fiveMB = 5 * 1024 * 1024;

const uploadProductImage = multer({ 
  storage: productStorage, 
  fileFilter: imageFileFilter, 
  limits: { fileSize: fiveMB } 
});

const uploadCategoryImage = multer({ 
  storage: categoryStorage, 
  fileFilter: imageFileFilter, 
  limits: { fileSize: fiveMB } 
});

module.exports = {
  uploadProductImage,
  uploadCategoryImage
};
