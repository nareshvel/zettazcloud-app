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
  .get(requirePermission('grn.read'), getGrns);

router.route('/:id')
  .get(requirePermission('grn.read'), getGrnById)
  .put(requirePermission('grn.update'), updateGrn)
  .delete(requirePermission('grn.delete'), deleteGrn);

// Route for updating just the status of a GRN
router.route('/:id/status')
  .patch(requirePermission('grn.update_status'), updateGrnStatus);

// Route for completing a GRN (DRAFT -> COMPLETED with inventory commitment)
router.route('/:id/complete')
  .patch(requirePermission('grn.update'), (req, res) => {
    // Set the status to COMPLETED and delegate to updateGrnStatus
    req.body.new_status = 'COMPLETED';
    updateGrnStatus(req, res);
  });

module.exports = router;
