const express = require('express');
const { body } = require('express-validator');
const {
  grantPermission,
  revokePermission,
  getEventPermissions,
  getMyGrantedEvents,
  checkEventAccess,
} = require('../controllers/eventPermissionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validateRequest');

const router = express.Router();

// Validation rules
const grantPermissionValidation = [
  body('eventId')
    .notEmpty()
    .withMessage('Event ID is required')
    .isMongoId()
    .withMessage('Invalid event ID'),
  body('grantToAdminId')
    .notEmpty()
    .withMessage('Admin ID is required')
    .isMongoId()
    .withMessage('Invalid admin ID'),
  body('password')
    .notEmpty()
    .withMessage('Password is required for permission granting'),
  body('permissions')
    .optional()
    .isObject()
    .withMessage('Permissions must be an object'),
];

const revokePermissionValidation = [
  body('eventId')
    .notEmpty()
    .withMessage('Event ID is required')
    .isMongoId()
    .withMessage('Invalid event ID'),
  body('revokeFromAdminId')
    .notEmpty()
    .withMessage('Admin ID is required')
    .isMongoId()
    .withMessage('Invalid admin ID'),
  body('password')
    .notEmpty()
    .withMessage('Password is required for permission revocation'),
];

// Routes
router.post(
  '/grant',
  protect,
  authorize('admin', 'superadmin'),
  grantPermissionValidation,
  validate,
  grantPermission
);

router.post(
  '/revoke',
  protect,
  authorize('admin', 'superadmin'),
  revokePermissionValidation,
  validate,
  revokePermission
);

router.get(
  '/event/:eventId',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  getEventPermissions
);

router.get(
  '/my-granted-events',
  protect,
  authorize('admin', 'superadmin'),
  getMyGrantedEvents
);

router.get(
  '/check/:eventId',
  protect,
  validateObjectId('eventId'),
  checkEventAccess
);

module.exports = router;