const express = require('express');
const router = express.Router();
const {
  createGrn,
  getGrns,
  getGrnById,
  updateGrnStatus,
  deleteGrn,
  updateGrn
} = require('../controllers/grnController');

// Import RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');

// Define routes with permissions
router.route('/')
  .post(requirePermission('grn.create'), createGrn)
  .get(requirePermission('grn.view'), getGrns);

router.route('/:id')
  .get(requirePermission('grn.view'), getGrnById)
  .put(requirePermission('grn.edit'), updateGrn)
  .delete(requirePermission('grn.delete'), deleteGrn);

// Route for updating just the status of a GRN
router.route('/:id/status')
  .patch(requirePermission('grn.edit'), updateGrnStatus);

// Route for completing a GRN (DRAFT -> COMPLETED with inventory commitment)
router.route('/:id/complete')
  .patch(requirePermission('grn.edit'), (req, res) => {
    // Set the status to COMPLETED and delegate to updateGrnStatus
    req.body.new_status = 'COMPLETED';
    updateGrnStatus(req, res);
  });

module.exports = router;
