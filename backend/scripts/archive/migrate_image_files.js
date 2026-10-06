#!/usr/bin/env node

/**
 * Comprehensive Image File Migration Script
 * 
 * This script:
 * 1. Audits all image files in backend directories
 * 2. Migrates images from /public/uploads/ to /uploads/ with proper tenant structure
 * 3. Updates database image_url references to match new locations
 * 4. Removes orphaned/duplicate files
 * 5. Ensures all images follow: /uploads/{tenant_id}/{resource_type}/{filename}
 */

const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: 'mysql.us.cloudlogin.co',
  user: 'digitpulse_zcloud',
  password: 'MyAntigua!2025',
  database: 'digitpulse_zcloud',
  port: 3306
};

// Paths
const BACKEND_ROOT = path.join(__dirname, '..');
const CORRECT_UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');
const WRONG_UPLOADS_DIR = path.join(BACKEND_ROOT, 'public', 'uploads');

class ImageMigrator {
  constructor() {
    this.connection = null;
    this.migrationLog = [];
    this.errors = [];
  }

  async connect() {
    this.connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ Disconnected from database');
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    console.log(logEntry);
    this.migrationLog.push(logEntry);
  }

  error(message, error = null) {
    const errorEntry = { message, error: error?.message || error, timestamp: new Date().toISOString() };
    this.errors.push(errorEntry);
    this.log(`ERROR: ${message}${error ? ` - ${error.message || error}` : ''}`, 'error');
  }

  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      this.log(`Created directory: ${dirPath}`);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async getImageFilesRecursive(directory) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const files = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getImageFilesRecursive(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (imageExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.error(`Error reading directory ${directory}`, error);
      }
    }

    return files;
  }

  async getAllTenants() {
    const [rows] = await this.connection.execute('SELECT DISTINCT tenant_id FROM products WHERE tenant_id IS NOT NULL UNION SELECT DISTINCT tenant_id FROM categories WHERE tenant_id IS NOT NULL');
    return rows.map(row => row.tenant_id);
  }

  async getDatabaseImageReferences() {
    const [productRows] = await this.connection.execute('SELECT id, tenant_id, name, image_url FROM products WHERE image_url IS NOT NULL');
    const [categoryRows] = await this.connection.execute('SELECT id, tenant_id, name, image_url FROM categories WHERE image_url IS NOT NULL');
    
    return {
      products: productRows,
      categories: categoryRows
    };
  }

  determineCorrectPath(filePath, tenantId, resourceType) {
    const filename = path.basename(filePath);
    return path.join(CORRECT_UPLOADS_DIR, tenantId, resourceType, filename);
  }

  async migrateFile(sourcePath, targetPath) {
    try {
      // Ensure target directory exists
      await this.ensureDirectory(path.dirname(targetPath));
      
      // Check if target already exists
      try {
        await fs.access(targetPath);
        this.log(`Target already exists, skipping: ${targetPath}`);
        return false;
      } catch (error) {
        // Target doesn't exist, proceed with migration
      }
      
      // Copy file to new location
      await fs.copyFile(sourcePath, targetPath);
      this.log(`Migrated: ${sourcePath} -> ${targetPath}`);
      
      return true;
    } catch (error) {
      this.error(`Failed to migrate ${sourcePath} to ${targetPath}`, error);
      return false;
    }
  }

  async updateDatabaseReference(table, id, newImageUrl) {
    try {
      await this.connection.execute(
        `UPDATE ${table} SET image_url = ? WHERE id = ?`,
        [newImageUrl, id]
      );
      this.log(`Updated ${table} ${id}: ${newImageUrl}`);
    } catch (error) {
      this.error(`Failed to update ${table} ${id}`, error);
    }
  }

  async migrateWrongLocationImages() {
    this.log('=== MIGRATING IMAGES FROM WRONG LOCATIONS ===');
    
    const wrongLocationFiles = await this.getImageFilesRecursive(WRONG_UPLOADS_DIR);
    const tenants = await this.getAllTenants();
    const dbRefs = await this.getDatabaseImageReferences();
    
    this.log(`Found ${wrongLocationFiles.length} images in wrong location`);
    this.log(`Found ${tenants.length} tenants in database`);
    
    for (const filePath of wrongLocationFiles) {
      const relativePath = path.relative(WRONG_UPLOADS_DIR, filePath);
      const filename = path.basename(filePath);
      
      this.log(`Processing: ${relativePath}`);
      
      // Determine resource type and tenant
      let resourceType = null;
      let tenantId = null;
      
      if (relativePath.includes('/categories/') || relativePath.startsWith('categories/')) {
        resourceType = 'categories';
      } else if (relativePath.includes('/products/') || relativePath.includes('/')) {
        resourceType = 'products';
      }
      
      // Try to extract tenant ID from path or find matching database record
      const pathParts = relativePath.split('/');
      if (pathParts[0].length === 36 && pathParts[0].includes('-')) {
        // First part looks like a UUID (tenant_id)
        tenantId = pathParts[0];
      } else {
        // Find tenant by matching database records
        const allDbRefs = [...dbRefs.products, ...dbRefs.categories];
        const matchingRef = allDbRefs.find(ref => 
          ref.image_url && ref.image_url.includes(filename)
        );
        
        if (matchingRef) {
          tenantId = matchingRef.tenant_id;
          resourceType = dbRefs.products.includes(matchingRef) ? 'products' : 'categories';
        } else {
          // Default to first tenant if no match found
          tenantId = tenants[0];
          this.log(`No database match for ${filename}, using default tenant: ${tenantId}`);
        }
      }
      
      if (!resourceType) {
        resourceType = 'products'; // Default fallback
        this.log(`Could not determine resource type for ${filename}, defaulting to products`);
      }
      
      // Migrate file
      const targetPath = this.determineCorrectPath(filePath, tenantId, resourceType);
      const migrated = await this.migrateFile(filePath, targetPath);
      
      if (migrated) {
        // Update database references
        const newImageUrl = `/uploads/${tenantId}/${resourceType}/${filename}`;
        
        // Find and update matching database records
        const matchingProducts = dbRefs.products.filter(p => 
          p.image_url && p.image_url.includes(filename)
        );
        const matchingCategories = dbRefs.categories.filter(c => 
          c.image_url && c.image_url.includes(filename)
        );
        
        for (const product of matchingProducts) {
          await this.updateDatabaseReference('products', product.id, newImageUrl);
        }
        
        for (const category of matchingCategories) {
          await this.updateDatabaseReference('categories', category.id, newImageUrl);
        }
      }
    }
  }

  async cleanupOrphanedFiles() {
    this.log('=== CLEANING UP ORPHANED FILES ===');
    
    const dbRefs = await this.getDatabaseImageReferences();
    const allDbImageUrls = [
      ...dbRefs.products.map(p => p.image_url),
      ...dbRefs.categories.map(c => c.image_url)
    ];
    
    // Check files in correct location
    const correctLocationFiles = await this.getImageFilesRecursive(CORRECT_UPLOADS_DIR);
    
    for (const filePath of correctLocationFiles) {
      const relativePath = path.relative(BACKEND_ROOT, filePath);
      const urlPath = '/' + relativePath.replace(/\\/g, '/');
      
      const isReferenced = allDbImageUrls.some(dbUrl => 
        dbUrl && (dbUrl === urlPath || dbUrl.includes(path.basename(filePath)))
      );
      
      if (!isReferenced) {
        this.log(`Orphaned file found: ${filePath}`);
        // Uncomment the next line to actually delete orphaned files
        // await fs.unlink(filePath);
        // this.log(`Deleted orphaned file: ${filePath}`);
      }
    }
  }

  async removeWrongLocationDirectory() {
    this.log('=== REMOVING WRONG LOCATION DIRECTORY ===');
    
    try {
      // Only remove if migration was successful
      const remainingFiles = await this.getImageFilesRecursive(WRONG_UPLOADS_DIR);
      
      if (remainingFiles.length === 0) {
        await fs.rmdir(WRONG_UPLOADS_DIR, { recursive: true });
        this.log(`Removed empty wrong location directory: ${WRONG_UPLOADS_DIR}`);
      } else {
        this.log(`Cannot remove directory, ${remainingFiles.length} files remain`);
      }
    } catch (error) {
      this.error('Failed to remove wrong location directory', error);
    }
  }

  async generateReport() {
    const reportPath = path.join(BACKEND_ROOT, 'scripts', 'image_migration_report.json');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalLogEntries: this.migrationLog.length,
        totalErrors: this.errors.length,
        success: this.errors.length === 0
      },
      log: this.migrationLog,
      errors: this.errors
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    this.log(`Migration report saved: ${reportPath}`);
    
    return report;
  }

  async run() {
    try {
      this.log('🚀 Starting Image Migration Process');
      
      await this.connect();
      
      // Step 1: Migrate images from wrong locations
      await this.migrateWrongLocationImages();
      
      // Step 2: Clean up orphaned files
      await this.cleanupOrphanedFiles();
      
      // Step 3: Remove wrong location directory (if empty)
      await this.removeWrongLocationDirectory();
      
      // Step 4: Generate report
      const report = await this.generateReport();
      
      this.log('✅ Image Migration Process Complete');
      
      if (this.errors.length > 0) {
        this.log(`⚠️  Migration completed with ${this.errors.length} errors`);
      } else {
        this.log('🎉 Migration completed successfully with no errors');
      }
      
      return report;
      
    } catch (error) {
      this.error('Migration process failed', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new ImageMigrator();
  migrator.run()
    .then(report => {
      console.log('\n📊 Migration Summary:');
      console.log(`- Total operations: ${report.summary.totalLogEntries}`);
      console.log(`- Errors: ${report.summary.totalErrors}`);
      console.log(`- Success: ${report.summary.success ? '✅' : '❌'}`);
      
      process.exit(report.summary.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = ImageMigrator;
