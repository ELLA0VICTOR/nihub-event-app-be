const express = require('express');
const { body } = require('express-validator');
const { checkEventAccess } = require('../middleware/checkEventCreator');
const { getDailyAttendance } = require('../controllers/attendanceController');
const { getDownloadableReport } = require('../controllers/attendanceController');
const {
  scanQRCode,
  verifyQRCode, // NEW
  markPresent, // NEW
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
const verifyQRValidation = [
  body('participantId')
    .notEmpty()
    .withMessage('Participant ID is required')
    .isMongoId()
    .withMessage('Invalid participant ID'),
  body('eventId')
    .optional()
    .isMongoId()
    .withMessage('Invalid event ID'),
];

const markPresentValidation = [
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

// NEW: Verify QR code and get participant details (no attendance marking)
router.post(
  '/verify-qr',
  protect,
  authorize('admin', 'superadmin'),
  verifyQRValidation,
  validate,
  verifyQRCode
);

// NEW: Mark attendance after manual verification
router.post(
  '/mark-present',
  protect,
  authorize('admin', 'superadmin'),
  markPresentValidation,
  validate,
  markPresent
);

// OLD: Direct scan (kept for backward compatibility, but consider deprecating)
router.post(
  '/scan',
  protect,
  authorize('admin', 'superadmin'),
  scanValidation,
  validate,
  scanQRCode
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
  '/event/:eventId/download-report',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId('eventId'),
  getDownloadableReport
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