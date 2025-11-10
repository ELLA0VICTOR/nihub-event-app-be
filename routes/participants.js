const express = require('express');
const { body } = require('express-validator');
const { checkTrackEligibility } = require('../controllers/participantController');
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

// Validation rules for participant registration
const participantRegistrationValidation = [
  // Handle both 'name' and 'fullname' (mapped by fieldMapper)
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('fullname')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  // Email is REQUIRED
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  // Event ID is REQUIRED
  body('eventId')
    .notEmpty()
    .withMessage('Event ID is required')
    .isMongoId()
    .withMessage('Invalid event ID'),
  
  // Gender is REQUIRED
  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
    .withMessage('Invalid gender value'),
  
  // Phone number is REQUIRED
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .trim()
    .matches(/^(\+?\d{1,4}[\s-]?)?(\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4,}$/)
    .withMessage('Please provide a valid phone number (e.g., +2348012345678 or 08012345678)'),
  
  // Department is OPTIONAL (for non-students)
  body('department')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department cannot exceed 100 characters'),
  
  // Matric number is OPTIONAL (handle both 'matricNo' and 'matricnumber')
  body('matricNo')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Matric number cannot exceed 50 characters'),
  body('matricnumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Matric number cannot exceed 50 characters'),
  
  // Track is OPTIONAL and comes from event
  body('track')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Track cannot exceed 100 characters'),
];

// Routes
router.post(
  '/register',
  upload.single('photo'),  // Handle file upload
  mapParticipantFields,    // Map field names (fullname -> name, matricnumber -> matricNo)
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
  .delete(
    protect,
    authorize('admin', 'superadmin'),
    validateObjectId(),
    deleteParticipant
  );
  
router.post(
  '/:id/resend-qr',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId(),
  resendQRCode
);

router.post(
  '/check-track',
  body('email').notEmpty().isEmail(),
  body('eventId').notEmpty().isMongoId(),
  validate,
  checkTrackEligibility
);

module.exports = router;