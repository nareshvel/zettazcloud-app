const path = require('path');
const fs = require('fs').promises;

/**
 * Unified Image Service for Multi-Tenant Image Management
 * 
 * Provides standardized image URL generation, normalization, and management
 * across all resources (products, categories, users, etc.) with proper tenant isolation.
 */
class ImageService {
  
  /**
   * Generate standardized image URL path for storage
   * @param {string} tenantId - Tenant UUID
   * @param {string} resourceType - Resource type (products, categories, users, etc.)
   * @param {string} filename - Image filename
   * @returns {string} Standardized relative path
   */
  static generateImageUrl(tenantId, resourceType, filename) {
    if (!tenantId || !resourceType || !filename) {
      throw new Error('ImageService.generateImageUrl: tenantId, resourceType, and filename are required');
    }
    
    return `/uploads/${tenantId}/${resourceType}/${filename}`;
  }

  /**
   * Convert relative image path to full URL for frontend consumption
   * @param {string|null} imagePath - Relative image path from database
   * @param {string} baseUrl - Backend base URL (e.g., http://localhost:5172)
   * @returns {string|null} Full URL or null if no image
   */
  static toFullUrl(imagePath, baseUrl = process.env.BACKEND_URL || 'http://localhost:5172') {
    if (!imagePath) return null;
    
    // Already a full URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Ensure path starts with /
    const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    
    return `${baseUrl}${normalizedPath}`;
  }

  /**
   * Normalize legacy/malformed image paths to standard format
   * @param {string|null} imagePath - Current image path (potentially malformed)
   * @param {string} tenantId - Tenant UUID
   * @param {string} resourceType - Resource type (products, categories, etc.)
   * @returns {string|null} Normalized path or null if invalid
   */
  static normalizePath(imagePath, tenantId, resourceType) {
    if (!imagePath || !tenantId || !resourceType) return null;
    
    // Already in correct format
    const expectedPrefix = `/uploads/${tenantId}/${resourceType}/`;
    if (imagePath.startsWith(expectedPrefix)) {
      return imagePath;
    }
    
    // Extract filename from various legacy patterns
    let filename = null;
    
    // Pattern 1: /uploads/categories/image-123.png (missing tenant_id)
    if (imagePath.startsWith(`/uploads/${resourceType}/`)) {
      filename = imagePath.replace(`/uploads/${resourceType}/`, '');
    }
    // Pattern 2: tenant_id/categories/image-123.jpg (missing /uploads/ prefix)
    else if (imagePath.startsWith(`${tenantId}/${resourceType}/`)) {
      filename = imagePath.replace(`${tenantId}/${resourceType}/`, '');
    }
    // Pattern 3: /uploads/tenant_id/store_id/timestamp_filename.webp (products with store_id)
    else if (imagePath.includes(`/uploads/${tenantId}/`) && imagePath.includes('/')) {
      const parts = imagePath.split('/');
      filename = parts[parts.length - 1]; // Get last part as filename
    }
    // Pattern 4: /images/products/product-uuid-timestamp.webp (old format)
    else if (imagePath.startsWith('/images/')) {
      const parts = imagePath.split('/');
      filename = parts[parts.length - 1];
    }
    // Pattern 5: Just extract filename from any path
    else {
      const parts = imagePath.split('/');
      filename = parts[parts.length - 1];
    }
    
    if (!filename) return null;
    
    // Generate standardized path
    return this.generateImageUrl(tenantId, resourceType, filename);
  }

  /**
   * Validate if image path belongs to the specified tenant (security check)
   * @param {string} imagePath - Image path to validate
   * @param {string} tenantId - Expected tenant UUID
   * @returns {boolean} True if path belongs to tenant
   */
  static validateTenantOwnership(imagePath, tenantId) {
    if (!imagePath || !tenantId) return false;
    
    return imagePath.includes(`/uploads/${tenantId}/`);
  }

  /**
   * Get physical file path for image operations
   * @param {string} imagePath - Relative image path
   * @returns {string} Absolute file system path
   */
  static getPhysicalPath(imagePath) {
    if (!imagePath) return null;
    
    // Remove leading slash for path.join
    const relativePath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    
    return path.join(__dirname, '..', relativePath);
  }

  /**
   * Delete image file from filesystem
   * @param {string} imagePath - Relative image path
   * @returns {Promise<boolean>} True if deleted successfully
   */
  static async deleteImage(imagePath) {
    if (!imagePath) return false;
    
    try {
      const physicalPath = this.getPhysicalPath(imagePath);
      await fs.unlink(physicalPath);
      console.log(`[ImageService] Successfully deleted image: ${imagePath}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`[ImageService] Image file not found (already deleted): ${imagePath}`);
        return true; // Consider it successful if file doesn't exist
      }
      console.error(`[ImageService] Error deleting image ${imagePath}:`, error.message);
      return false;
    }
  }

  /**
   * Check if image file exists on filesystem
   * @param {string} imagePath - Relative image path
   * @returns {Promise<boolean>} True if file exists
   */
  static async imageExists(imagePath) {
    if (!imagePath) return false;
    
    try {
      const physicalPath = this.getPhysicalPath(imagePath);
      await fs.access(physicalPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create directory structure for tenant/resource if it doesn't exist
   * @param {string} tenantId - Tenant UUID
   * @param {string} resourceType - Resource type (products, categories, etc.)
   * @returns {Promise<string>} Created directory path
   */
  static async ensureUploadDirectory(tenantId, resourceType) {
    const uploadPath = path.join(__dirname, '..', 'uploads', tenantId, resourceType);
    
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      console.log(`[ImageService] Ensured directory exists: ${uploadPath}`);
      return uploadPath;
    } catch (error) {
      console.error(`[ImageService] Error creating directory ${uploadPath}:`, error);
      throw error;
    }
  }

  /**
   * Transform database record to include full image URLs
   * @param {Object} record - Database record with image_url field
   * @param {string} baseUrl - Backend base URL
   * @returns {Object} Record with transformed imageUrl field
   */
  static transformRecordImageUrl(record, baseUrl = process.env.BACKEND_URL || 'http://localhost:5172') {
    if (!record) return record;
    
    // Create a copy to avoid mutating original
    const transformed = { ...record };
    
    // Transform image_url to imageUrl with full URL
    if (record.image_url) {
      transformed.imageUrl = this.toFullUrl(record.image_url, baseUrl);
    } else {
      transformed.imageUrl = null;
    }
    
    return transformed;
  }

  /**
   * Batch transform multiple records
   * @param {Array} records - Array of database records
   * @param {string} baseUrl - Backend base URL
   * @returns {Array} Transformed records
   */
  static transformRecordsImageUrls(records, baseUrl = process.env.BACKEND_URL || 'http://localhost:5172') {
    if (!Array.isArray(records)) return records;
    
    return records.map(record => this.transformRecordImageUrl(record, baseUrl));
  }
}

module.exports = ImageService;
