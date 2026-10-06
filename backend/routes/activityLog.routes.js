const express = require('express');
const router = express.Router();
const pool = require('../db').pool;
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');

/**
 * @route   GET /api/activity-logs
 * @desc    Fetch user activity logs with filtering and pagination
 * @access  Private (requires activity.read permission)
 */
router.get('/', requirePermission('activity.read'), async (req, res) => {
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
    const { userId, actionType, startDate, endDate, page = 1, limit = 20 } = req.query;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const offset = (pageInt - 1) * limitInt;

    let queryParams = [tenant_id];
    let countQueryParams = [tenant_id];

    let baseQuery = 'SELECT id, user_id, username, action_type, description, details, ip_address, user_agent, timestamp FROM user_activity_logs WHERE tenant_id = ?';
    let countQuery = 'SELECT COUNT(*) as total FROM user_activity_logs WHERE tenant_id = ?';
    
    let conditions = [];

    if (userId) {
        conditions.push('user_id = ?');
        queryParams.push(userId);
        countQueryParams.push(userId);
    }

    if (actionType) {
        conditions.push('action_type = ?');
        queryParams.push(actionType);
        countQueryParams.push(actionType);
    }

    if (startDate) {
        conditions.push('DATE(timestamp) >= ?');
        queryParams.push(startDate);
        countQueryParams.push(startDate);
    }

    if (endDate) {
        conditions.push('DATE(timestamp) <= ?');
        queryParams.push(endDate);
        countQueryParams.push(endDate);
    }

    if (conditions.length > 0) {
        const conditionString = conditions.join(' AND ');
        baseQuery += ` AND ${conditionString}`;
        countQuery += ` AND ${conditionString}`;
    }

    baseQuery += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    queryParams.push(limitInt, offset);

    try {
        const [logs] = await pool.query(baseQuery, queryParams);
        const [countResult] = await pool.query(countQuery, countQueryParams);
        
        const totalLogs = countResult[0].total;
        const totalPages = Math.ceil(totalLogs / limitInt);

        res.status(200).json({
            status: 'success',
            message: 'User activity logs fetched successfully.',
            data: {
                logs,
                pagination: {
                    currentPage: pageInt,
                    totalPages,
                    totalLogs,
                    limit: limitInt
                }
            }
        });
    } catch (error) {
        console.error('[ActivityLog API] Error fetching activity logs:', error);
        res.status(500).json({ 
            status: 'error',
            message: 'Failed to fetch user activity logs.', 
            error: error.message 
        });
    }
});

module.exports = router;
