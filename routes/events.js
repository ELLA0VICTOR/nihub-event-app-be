const express = require('express');
const { body } = require('express-validator');
const multer = require('multer'); // <--- 1. IMPORTED MULTER
const {
  createEvent,
  getAllEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  terminateEvent,
  getEventStats,
  getMyEvents,
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validateRequest');
const { mapEventFields } = require('../middleware/fieldMapper');

// REMOVED: const upload = require('../utils/fileUpload');

// --- 2. ADDED MULTER MEMORY STORAGE CONFIG ---
// Configure multer for memory storage (stores file in req.file.buffer)
const storage = multer.memoryStorage();

// Set file size limit (e.g., 10MB)
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } 
});
// ---------------------------------------------

const router = express.Router();

// --- 3. FIXED VALIDATION RULES ---
// These now check the fields *after* mapEventFields runs (e.g., 'name' not 'eventname')
const eventValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Event name must be between 3 and 200 characters'),
  body('date').optional().isISO8601().withMessage('Invalid date format'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('maxParticipants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum participants must be at least 1'),
  body('status')
    .optional()
    .isIn(['upcoming', 'ongoing', 'completed', 'cancelled', 'terminated'])
    .withMessage('Invalid status'),
  body('selectedTrack')
    .optional()
    .isIn(['Web and App', 'Networking', 'Cloud Computing', 'PCB', null]) // Added null
    .withMessage('Invalid track selection'),
];

// Routes
router.route('/')
  .get(getAllEvents) // Public
  .post(
    protect,
    authorize('admin', 'superadmin'), // Both can create
    upload.single('image'), // This now uses the in-memory 'upload'
    mapEventFields,
    eventValidation,
    validate,
    createEvent
  );

// Get my created events
router.get('/my-events', protect, authorize('admin', 'superadmin'), getMyEvents);

router.route('/:id')
  .get(getEvent) // Public
  .put(
    protect,
    authorize('admin', 'superadmin'), // Creator check happens in controller
    validateObjectId(),
    upload.single('image'), // This now uses the in-memory 'upload'
    mapEventFields,
    eventValidation,
    validate,
    updateEvent
  )
  .delete(
    protect,
    authorize('admin', 'superadmin'), // Creator check happens in controller
    validateObjectId(),
    deleteEvent
  );

// Terminate event manually
router.post(
  '/:id/terminate',
  protect,
  authorize('admin', 'superadmin'),
  validateObjectId(),
  terminateEvent
);

router.get('/:id/stats', protect, validateObjectId(), getEventStats);

module.exports = router;