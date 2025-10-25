const express = require('express');
const { body } = require('express-validator');
const {
  registerParticipant,
  getEventParticipants,
  getParticipant,
  updateParticipant,
  deleteParticipant,
  resendQRCode,
} = require('../controllers/participantController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validateRequest');
const { mapParticipantFields } = require('../middleware/fieldMapper');
const upload = require('../utils/fileUpload');

const router = express.Router();

// Validation rules
const participantRegistrationValidation = [
  body('name').optional(),  
  body('fullname')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('eventId')
    .notEmpty()
    .withMessage('Event ID is required')
    .isMongoId()
    .withMessage('Invalid event ID'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
    .withMessage('Invalid gender value'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department cannot exceed 100 characters'),
  body('matricNo').optional(),
  body('matricnumber')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Matric number cannot exceed 50 characters'),
  body('track')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Track cannot exceed 100 characters'),
];

// Routes
router.post(
  '/register',
  upload.single('photo'),  // Handle file upload
  mapParticipantFields,    // Map field names
  participantRegistrationValidation,
  validate,
  registerParticipant
);

router.get(
  '/event/:eventId',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  getEventParticipants
);

router.route('/:id')
  .get(protect, authorize('admin', 'superadmin'), validateObjectId(), getParticipant)
  .put(protect, authorize('admin', 'superadmin'), validateObjectId(), updateParticipant)
  .delete(protect, authorize('superadmin'), validateObjectId(), deleteParticipant);

router.post(
  '/:id/resend-qr',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId(),
  resendQRCode
);

module.exports = router;