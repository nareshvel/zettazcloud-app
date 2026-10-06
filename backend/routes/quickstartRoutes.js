const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate } = require('../middleware/unifiedAuthMiddleware');

/**
 * @route   GET /api/quickstart/progress/:storeId
 * @desc    Get QuickStart progress for a specific store
 * @access  Private
 */
router.get('/progress/:storeId', authenticate, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { tenant_id } = req.user;

    // Validate store belongs to tenant
    const [stores] = await pool.execute(
      'SELECT quickstart_progress FROM stores WHERE id = ? AND tenant_id = ?',
      [storeId, tenant_id]
    );

    if (stores.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not accessible'
      });
    }

    let quickstartProgress = null;
    if (stores[0].quickstart_progress) {
      try {
        quickstartProgress = typeof stores[0].quickstart_progress === 'string' 
          ? JSON.parse(stores[0].quickstart_progress) 
          : stores[0].quickstart_progress;
      } catch (e) {
        console.error('Error parsing quickstart_progress:', e);
        quickstartProgress = null;
      }
    }

    return res.json({
      success: true,
      data: {
        storeId,
        progress: quickstartProgress || {
          step1: false,
          step2: false,
          step3: false,
          step4: false,
          step5: false,
          step6: false
        }
      }
    });
  } catch (error) {
    console.error('[GET /api/quickstart/progress/:storeId] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch QuickStart progress'
    });
  }
});

/**
 * @route   PUT /api/quickstart/progress/:storeId
 * @desc    Update QuickStart progress for a specific store
 * @access  Private
 */
router.put('/progress/:storeId', authenticate, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { tenant_id } = req.user;
    const { progress } = req.body;

    if (!progress || typeof progress !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Progress object is required'
      });
    }

    // Validate store belongs to tenant
    const [stores] = await pool.execute(
      'SELECT id FROM stores WHERE id = ? AND tenant_id = ?',
      [storeId, tenant_id]
    );

    if (stores.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not accessible'
      });
    }

    // Add metadata to progress
    const updatedProgress = {
      ...progress,
      last_updated: new Date().toISOString(),
      updated_by: req.user.id
    };

    // Update the quickstart_progress field
    await pool.execute(
      'UPDATE stores SET quickstart_progress = ? WHERE id = ? AND tenant_id = ?',
      [JSON.stringify(updatedProgress), storeId, tenant_id]
    );

    return res.json({
      success: true,
      message: 'QuickStart progress updated successfully',
      data: {
        storeId,
        progress: updatedProgress
      }
    });
  } catch (error) {
    console.error('[PUT /api/quickstart/progress/:storeId] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update QuickStart progress'
    });
  }
});

/**
 * @route   PATCH /api/quickstart/step/:storeId/:stepId
 * @desc    Toggle a specific QuickStart step for a store
 * @access  Private
 */
router.patch('/step/:storeId/:stepId', authenticate, async (req, res) => {
  try {
    const { storeId, stepId } = req.params;
    const { tenant_id } = req.user;
    const { completed } = req.body;

    if (typeof completed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'completed field must be a boolean'
      });
    }

    // Validate store belongs to tenant
    const [stores] = await pool.execute(
      'SELECT quickstart_progress FROM stores WHERE id = ? AND tenant_id = ?',
      [storeId, tenant_id]
    );

    if (stores.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not accessible'
      });
    }

    // Parse existing progress
    let currentProgress = {
      step1: false,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
      step6: false
    };

    if (stores[0].quickstart_progress) {
      try {
        currentProgress = typeof stores[0].quickstart_progress === 'string' 
          ? JSON.parse(stores[0].quickstart_progress) 
          : stores[0].quickstart_progress;
      } catch (e) {
        console.error('Error parsing existing quickstart_progress:', e);
      }
    }

    // Update the specific step
    currentProgress[stepId] = completed;
    currentProgress.last_updated = new Date().toISOString();
    currentProgress.updated_by = req.user.id;

    // If all steps are completed, mark completion timestamp
    const allSteps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
    const allCompleted = allSteps.every(step => currentProgress[step] === true);
    
    if (allCompleted && !currentProgress.completed_at) {
      currentProgress.completed_at = new Date().toISOString();
    } else if (!allCompleted && currentProgress.completed_at) {
      delete currentProgress.completed_at;
    }

    // Update the database
    await pool.execute(
      'UPDATE stores SET quickstart_progress = ? WHERE id = ? AND tenant_id = ?',
      [JSON.stringify(currentProgress), storeId, tenant_id]
    );

    return res.json({
      success: true,
      message: `Step ${stepId} ${completed ? 'completed' : 'uncompleted'} successfully`,
      data: {
        storeId,
        stepId,
        completed,
        progress: currentProgress,
        allCompleted
      }
    });
  } catch (error) {
    console.error('[PATCH /api/quickstart/step/:storeId/:stepId] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update QuickStart step'
    });
  }
});

/**
 * @route   DELETE /api/quickstart/progress/:storeId
 * @desc    Reset QuickStart progress for a store
 * @access  Private
 */
router.delete('/progress/:storeId', authenticate, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { tenant_id } = req.user;

    // Validate store belongs to tenant
    const [stores] = await pool.execute(
      'SELECT id FROM stores WHERE id = ? AND tenant_id = ?',
      [storeId, tenant_id]
    );

    if (stores.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not accessible'
      });
    }

    // Reset progress to null
    await pool.execute(
      'UPDATE stores SET quickstart_progress = NULL WHERE id = ? AND tenant_id = ?',
      [storeId, tenant_id]
    );

    return res.json({
      success: true,
      message: 'QuickStart progress reset successfully',
      data: {
        storeId,
        progress: null
      }
    });
  } catch (error) {
    console.error('[DELETE /api/quickstart/progress/:storeId] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset QuickStart progress'
    });
  }
});

module.exports = router;
