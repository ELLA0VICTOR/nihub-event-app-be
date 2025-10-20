const express = require('express');
const { body } = require('express-validator');
const {
  getAllRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  deleteRequest,
  getRequestStats,
} = require('../controllers/adminRequestController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validateRequest');

const router = express.Router();

// Validation rules
const reviewValidation = [
  body('reviewNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Review notes cannot exceed 500 characters'),
];

// All routes require superadmin access
router.use(protect, authorize('superadmin'));

// Routes
router.get('/', getAllRequests);
router.get('/stats', getRequestStats);

router.route('/:id')
  .get(validateObjectId(), getRequest)
  .delete(validateObjectId(), deleteRequest);

router.put(
  '/:id/approve',
  validateObjectId(),
  reviewValidation,
  validate,
  approveRequest
);

router.put(
  '/:id/reject',
  validateObjectId(),
  reviewValidation,
  validate,
  rejectRequest
);

module.exports = router;
