const express = require('express');
const { body } = require('express-validator');
const { checkEventAccess } = require('../middleware/checkEventCreator');
const { getDailyAttendance, getComprehensiveReport } = require('../controllers/attendanceController');
const {
  scanQRCode,
  getEventAttendance,
  getAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceReport,
  getParticipantAttendance,
  markAllPresent,
  downloadEventData,
  
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validateRequest');

const router = express.Router();

// Validation rules
const scanValidation = [
  body('participantId')
    .notEmpty()
    .withMessage('Participant ID is required')
    .isMongoId()
    .withMessage('Invalid participant ID'),
  body('eventId')
    .optional()
    .isMongoId()
    .withMessage('Invalid event ID'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
];

const updateAttendanceValidation = [
  body('status')
    .optional()
    .isIn(['present', 'late', 'excused', 'absent'])
    .withMessage('Invalid status'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
];

// Routes
router.post(
  '/scan',
  protect,
  authorize('admin', 'superadmin'),
  scanValidation,
  validate,
  scanQRCode // Already has permission check inside
);

router.get(
  '/event/:eventId',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  getEventAttendance
);

router.get(
  '/event/:eventId/report',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  getAttendanceReport
);

router.get(
  '/participant/:participantId',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('participantId'),
  getParticipantAttendance
);

router.route('/:id')
  .get(protect, authorize('admin', 'superadmin'), validateObjectId(), getAttendance)
  .put(
    protect,
    authorize('admin', 'superadmin'),
    validateObjectId(),
    updateAttendanceValidation,
    validate,
    updateAttendance
  )
  .delete(protect, authorize('admin', 'superadmin'), validateObjectId(), deleteAttendance);

 

// Mark all participants as present (Superadmin only)
router.post(
  '/mark-all-present/:eventId',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  markAllPresent
);

router.get(
  '/event/:eventId/comprehensive-report',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  getComprehensiveReport
);

// Download event data
router.get(
  '/download/:eventId',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  downloadEventData
);



router.get(
  '/event/:eventId/daily',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  getDailyAttendance
);

module.exports = router;
