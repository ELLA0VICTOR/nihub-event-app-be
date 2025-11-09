const express = require('express');
const { body } = require('express-validator');
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
const upload = require('../utils/fileUpload'); 

const router = express.Router();

// Validation rules
const eventValidation = [
  body('name').optional(),
  body('eventname')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Event name must be between 3 and 200 characters'),
  body('date').optional(),
  body('eventdate').optional().isISO8601().withMessage('Invalid date format'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
  body('location').optional(),
  body('eventlocation')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
  body('description').optional(),
  body('eventdescription')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('maxParticipants').optional(),
  body('eventcapacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum participants must be at least 1'),
  body('status')
    .optional()
    .isIn(['upcoming', 'ongoing', 'completed', 'cancelled', 'terminated'])
    .withMessage('Invalid status'),
  body('selectedTrack')
    .optional()
    .isIn(['Web and App', 'Networking', 'Cloud Computing', 'PCB'])
    .withMessage('Invalid track selection'),
];

// Routes
router.route('/')
  .get(getAllEvents) // Public
  .post(
    protect,
    authorize('admin', 'superadmin'), // Both can create
    upload.single('image'),
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
    upload.single('image'),
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