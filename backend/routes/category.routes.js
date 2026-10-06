const express = require('express');
const router = express.Router();
const pool = require('../db').pool;
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { uploadCategoryImage } = require('../middleware/multerConfig');
const { enforceStorageLimitAfterUpload } = require('../middleware/subscriptionMiddleware'); // Plan `limits.storage` enforcement
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises; // Using promises API for async operations
const ImageService = require('../services/imageService'); // Import unified image service

/**
 * @route   GET /api/categories
 * @desc    Get all categories for the authenticated user's tenant
 * @access  Private (requires categories.read permission)
 */
router.get('/', requirePermission('categories.view'), async (req, res) => {
    // Safe access to req.user.tenant_id with fallbacks, ensuring null (not undefined) for SQL queries
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'] || null;
    const { status } = req.query; // 'all', 'inactive', or undefined (defaults to active)
    
    if (!tenant_id) {
        console.error('[Categories API] No tenant_id found in request');
        return res.status(400).json({ message: 'Tenant ID is required' });
    }

    try {
        let baseQuery = `
            SELECT c.id, c.name, c.description, c.image_url, c.is_active, c.created_at, c.updated_at,
                   COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.tenant_id = c.tenant_id AND p.is_active = true
            WHERE c.tenant_id = ?
        `; 
        const queryParams = [tenant_id];

        if (status === 'all') {
            // No additional filter for is_active, get all for the tenant
        } else if (status === 'inactive') {
            baseQuery += ' AND c.is_active = ?';
            queryParams.push(false);
        } else { // Default: only active categories or if status is explicitly 'active'
            baseQuery += ' AND c.is_active = ?';
            queryParams.push(true);
        }

        baseQuery += `
            GROUP BY c.id, c.name, c.description, c.image_url, c.is_active, c.created_at, c.updated_at
            ORDER BY c.name ASC
        `;
        
        const [categories] = await pool.execute(baseQuery, queryParams);
        
        // Transform image URLs to full URLs for frontend consumption
        const transformedCategories = ImageService.transformRecordsImageUrls(categories);
        
        res.json(transformedCategories);
    } catch (error) {
        console.error('[Categories API] Error fetching categories:', error);
        res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
    }
});

// POST a new category
/**
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Private (requires categories.create permission)
 */
router.post('/', requirePermission('categories.create'), uploadCategoryImage.single('image'), enforceStorageLimitAfterUpload((req) => req.file?.path), async (req, res) => {
    const { name, description } = req.body;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
    const user_id = req.user?.id || "system"; 

    let imageUrl = null;
    if (req.file) {
        // New path: /uploads/tenant_id/categories/filename.ext
        imageUrl = '/uploads/' + path.join(tenant_id, 'categories', req.file.filename).replace(/\\/g, '/');
    }

    if (!name || name.trim() === '') {
        // If validation fails and a file was uploaded, attempt to clean it up.
        if (req.file) {
            const tempFilePath = path.join(__dirname, '..', 'uploads', tenant_id, 'categories', req.file.filename);
            try {
                await fs.unlink(tempFilePath);
                console.log(`[Categories API] Cleaned up uploaded file due to validation error: ${tempFilePath}`);
            } catch (unlinkError) {
                console.error(`[Categories API] Error cleaning up file ${tempFilePath} after validation error:`, unlinkError);
            }
        }
        return res.status(400).json({ status: 'error', message: 'Category name is required.' });
    }
    
    const newCategoryId = uuidv4();
    const isActive = true; // Default new categories to active

    try {
        const [result] = await pool.execute(
            'INSERT INTO categories (id, tenant_id, name, description, image_url, is_active, created_at, updated_at, created_by_user_id, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?)',
            [newCategoryId, tenant_id, name, description || null, imageUrl, isActive, user_id, user_id]
        );

        if (result.affectedRows === 1) {
            const [newCategoryData] = await pool.execute('SELECT * FROM categories WHERE id = ? AND tenant_id = ?', [newCategoryId, tenant_id]);
            res.status(201).json({ status: 'success', message: 'Category created successfully.', data: newCategoryData[0] });
        } else {
            if (req.file) {
                const filePathToDelete = path.join(__dirname, '..', 'uploads', imageUrl);
                 try { await fs.unlink(filePathToDelete); } catch (e) { console.error('Error deleting category image after failed DB insert:', e);}
            }
            res.status(500).json({ status: 'error', message: 'Failed to create category due to an unexpected database issue.' });
        }
    } catch (error) {
        console.error('[Categories API] Error creating category:', error);
        if (req.file) {
            const filePathToDelete = path.join(__dirname, '..', 'uploads', imageUrl); // imageUrl is tenant_id/categories/filename
            try { await fs.unlink(filePathToDelete); } catch (e) { console.error('Error deleting category image after DB error:', e);}
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'error', message: 'A category with this name already exists.' });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error while creating category.', details: error.message });
    }
});

// PUT update a category
/**
 * @route   PUT /api/categories/:id
 * @desc    Update an existing category
 * @access  Private (requires categories.update permission)
 */
router.put('/:id', requirePermission('categories.edit'), uploadCategoryImage.single('image'), enforceStorageLimitAfterUpload((req) => req.file?.path), async (req, res) => {
    const { id: categoryId } = req.params;
    const { name, description, is_active } = req.body;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
    const user_id = req.user?.id || "system";

    if (!categoryId) {
        return res.status(400).json({ status: 'error', message: 'Category ID is required.' });
    }

    try {
        const [existingCategories] = await pool.execute(
            'SELECT * FROM categories WHERE id = ? AND tenant_id = ?',
            [categoryId, tenant_id]
        );

        if (existingCategories.length === 0) {
            if (req.file) { // If a file was uploaded for a non-existent category, clean it up
                const tempFilePath = path.join(__dirname, '..', 'uploads', tenant_id, 'categories', req.file.filename);
                try { await fs.unlink(tempFilePath); } catch (e) { console.error('Error deleting uploaded image for non-existent category:', e);}
            }
            return res.status(404).json({ status: 'error', message: 'Category not found or access denied.' });
        }
        const existingCategory = existingCategories[0];
        let newImageUrl = existingCategory.image_url;
        let oldImageUrlToDelete = null;

        if (req.file) {
            newImageUrl = '/uploads/' + path.join(tenant_id, 'categories', req.file.filename).replace(/\\/g, '/');
            if (existingCategory.image_url && existingCategory.image_url !== newImageUrl) {
                oldImageUrlToDelete = existingCategory.image_url;
            }
        }

        const updateFields = [];
        const updateValues = [];

        if (name !== undefined) { updateFields.push('name = ?'); updateValues.push(name.trim()); }
        if (description !== undefined) { updateFields.push('description = ?'); updateValues.push(description || null); }
        if (newImageUrl !== existingCategory.image_url) { updateFields.push('image_url = ?'); updateValues.push(newImageUrl); }
        if (is_active !== undefined) { updateFields.push('is_active = ?'); updateValues.push(Boolean(is_active === 'true' || is_active === true)); }
        
        if (updateFields.length === 0 && !req.file) {
             return res.status(200).json({ status: 'success', message: 'No changes detected.', data: existingCategory });
        }

        updateFields.push('updated_at = NOW()');
        updateFields.push('updated_by_user_id = ?');
        updateValues.push(user_id);
        updateValues.push(categoryId);
        updateValues.push(tenant_id);

        const updateQuery = `UPDATE categories SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`;

        const [result] = await pool.execute(updateQuery, updateValues);

        if (result.affectedRows === 1) {
            if (oldImageUrlToDelete) {
                const filePathToDelete = path.join(__dirname, '..', 'uploads', oldImageUrlToDelete);
                try { await fs.unlink(filePathToDelete); } catch (e) { console.error('Error deleting old category image:', e);}
            }
            const [updatedCategoryData] = await pool.execute('SELECT * FROM categories WHERE id = ? AND tenant_id = ?', [categoryId, tenant_id]);
            res.status(200).json({ status: 'success', message: 'Category updated successfully.', data: updatedCategoryData[0] });
        } else {
             // If update failed but a new file was uploaded, try to clean it up
            if (req.file && newImageUrl !== existingCategory.image_url) {
                const tempFilePath = path.join(__dirname, '..', 'uploads', newImageUrl);
                try { await fs.unlink(tempFilePath); } catch (e) { console.error('Error deleting newly uploaded image after failed category update:', e);}
            }
            res.status(404).json({ status: 'error', message: 'Category not found or update failed.' });
        }
    } catch (error) {
        console.error('[Categories API] Error updating category:', error);
        // If an error occurs and a new file was uploaded, try to clean it up
        if (req.file) {
            const tempFilePath = path.join(__dirname, '..', 'uploads', tenant_id, 'categories', req.file.filename);
            try { await fs.unlink(tempFilePath); } catch (e) { console.error('Error deleting uploaded image after category update error:', e);}
        }
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 'error', message: 'A category with this name already exists.' });
        }
        res.status(500).json({ status: 'error', message: 'Internal server error while updating category.', details: error.message });
    }
});

// DELETE a category
/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete a category
 * @access  Private (requires categories.delete permission)
 */
router.delete('/:id', requirePermission('categories.delete'), async (req, res) => {
    const { id: categoryId } = req.params;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];

    if (!categoryId) {
        return res.status(400).json({ status: 'error', message: 'Category ID is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Fetch the category and its product count
        const [categories] = await connection.execute(
            `SELECT c.id, c.name, c.is_active, c.image_url, COUNT(p.id) as product_count
             FROM categories c
             LEFT JOIN products p ON c.id = p.category_id AND p.tenant_id = c.tenant_id
             WHERE c.id = ? AND c.tenant_id = ?
             GROUP BY c.id, c.name, c.is_active, c.image_url`,
            [categoryId, tenant_id]
        );

        if (categories.length === 0) {
            await connection.rollback();
            return res.status(404).json({ status: 'error', message: 'Category not found or access denied.' });
        }
        const categoryToDelete = categories[0];

        // Condition 1: Check if category is inactive
        if (categoryToDelete.is_active) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: 'Category must be inactive to be deleted.' });
        }

        // Condition 2: Check if category has associated products
        if (categoryToDelete.product_count > 0) {
            await connection.rollback();
            return res.status(400).json({ status: 'error', message: `Category cannot be deleted as it is associated with ${categoryToDelete.product_count} product(s).` });
        }

        // Delete the category image file if it exists
        if (categoryToDelete.image_url) {
            const imagePath = path.join(__dirname, '..', 'uploads', categoryToDelete.image_url);
            try {
                await fs.unlink(imagePath);
                console.log(`[Categories API] Deleted image file: ${imagePath}`);
            } catch (unlinkError) {
                // Log error but don't necessarily fail the whole operation if image deletion fails
                console.error(`[Categories API] Error deleting image file ${imagePath}:`, unlinkError);
            }
        }

        // Delete the category from the database
        const [deleteResult] = await connection.execute(
            'DELETE FROM categories WHERE id = ? AND tenant_id = ?',
            [categoryId, tenant_id]
        );

        if (deleteResult.affectedRows === 1) {
            await connection.commit();
            res.status(200).json({ status: 'success', message: 'Category deleted successfully.' });
        } else {
            await connection.rollback();
            res.status(500).json({ status: 'error', message: 'Failed to delete category due to an unexpected database issue.' });
        }

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[Categories API] Error deleting category:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error while deleting category.', details: error.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
