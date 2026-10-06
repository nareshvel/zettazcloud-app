# File Uploads with Multer (`backend/middleware/multerConfig.js`)

This document outlines the configuration and usage of Multer for handling file uploads in the backend, specifically for product and category images. The primary configuration file is `backend/middleware/multerConfig.js`.

## Overview

The `multerConfig.js` file centralizes the logic for processing multipart/form-data, which is primarily used for uploading files. It ensures that images are stored in a structured, tenant-specific manner and that only valid image files are accepted.

## Key Components

### 1. `imageFileFilter`

```javascript
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};
```

*   **Purpose**: This function is used by Multer to filter incoming files. It checks the `mimetype` of the uploaded file.
*   **Logic**: If the `mimetype` starts with `image` (e.g., `image/jpeg`, `image/png`), the file is accepted (`cb(null, true)`).
*   Otherwise, an error is passed to the callback (`cb(new Error(...), false)`), rejecting the file.

### 2. `generateFilename`

```javascript
const generateFilename = (req, file, cb) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const finalFilename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
  cb(null, finalFilename);
};
```

*   **Purpose**: This function generates a unique filename for each uploaded file to prevent naming conflicts.
*   **Logic**: It combines the field name (e.g., `image`), a unique suffix (timestamp + random number), and the original file's extension.

### 3. Storage Engines

Multer uses storage engines to determine where and how files should be saved. We have two similar storage engines, one for product images and one for category images, both utilizing `multer.diskStorage`.

#### `productStorage`

*   **Destination Logic**:
    *   Ensures that the authenticated user (`req.user`) has a `tenant_id`.
    *   Constructs a dynamic path: `backend/uploads/<tenant_id>/products/`.
    *   Creates the directory (including parent directories) if it doesn't exist using `fs.mkdirSync(uploadPath, { recursive: true })`.
*   **Filename Logic**: Uses the common `generateFilename` function.

#### `categoryStorage`

*   **Destination Logic**:
    *   Similar to `productStorage`, ensures `req.user.tenant_id` exists.
    *   Constructs a dynamic path: `backend/uploads/<tenant_id>/categories/`.
    *   Creates the directory if it doesn't exist.
*   **Filename Logic**: Uses the common `generateFilename` function.

**Tenant Isolation**: The key aspect of both storage engines is the use of `req.user.tenant_id` in the destination path. This ensures that files uploaded by users of one tenant are stored separately from files of other tenants.

### 4. Multer Instances

Based on the storage engines and file filter, two Multer instances are configured and exported:

```javascript
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
```

*   `uploadProductImage`: Configured to use `productStorage`, `imageFileFilter`, and a file size limit of 5MB.
*   `uploadCategoryImage`: Configured to use `categoryStorage`, `imageFileFilter`, and a file size limit of 5MB.

### 5. Exports

The module exports the configured Multer instances:

```javascript
module.exports = {
  uploadProductImage,
  uploadCategoryImage
};
```

## Usage in Routes

These exported Multer instances are used as middleware in the route definitions (e.g., in `product.routes.js` or `category.routes.js`).

**Example (`product.routes.js`):**

```javascript
const { uploadProductImage } = require('../middleware/multerConfig');

// For creating a new product with an image
router.post('/', authenticate, uploadProductImage.single('image'), productController.createProduct);

// For updating an existing product's image
router.put('/:id', authenticate, uploadProductImage.single('image'), productController.updateProduct);
```

*   `uploadProductImage.single('image')`: This tells Multer to expect a single file associated with the form field named `image`.
*   If a file is uploaded, Multer processes it using the configured storage engine and filter. Information about the uploaded file (e.g., path, filename) becomes available in `req.file` for subsequent route handlers (like `productController.createProduct`).
*   If the file filter rejects the file, or if another Multer-related error occurs (e.g., file size limit exceeded), Multer will pass an error, which should be handled by the application's error handling middleware.

## File Structure for Uploads

Uploaded files will be stored in the `backend/uploads/` directory, organized as follows:

```
backend/
└── uploads/
    └── <tenant_id_1>/
        ├── products/
        │   └── image-xxxxxxxxxx-xxxx.webp
        │   └── ... (other product images)
        └── categories/
            └── image-yyyyyyyyyy-yyyy.webp
            └── ... (other category images)
    └── <tenant_id_2>/
        ├── products/
        │   └── ...
        └── categories/
            └── ...
```

This structure ensures clear separation of uploaded assets per tenant and per entity type. The `image_url` stored in the database for products and categories typically references the path relative to the `uploads` directory (e.g., `<tenant_id>/products/image-xxxxxxxxxx-xxxx.webp`).
