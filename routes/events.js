const express = require('express');
const { body } = require('express-validator');
const {
  createEvent,
  getAllEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getEventStats,
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validateRequest');
const { mapEventFields } = require('../middleware/fieldMapper');

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
  body('eventdate')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
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
    .isIn(['upcoming', 'ongoing', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
];

// Routes
router.route('/')
  .get(getAllEvents)  // Public
  .post(
    protect,
    authorize('admin', 'superadmin'),  // BOTH can create events
    mapEventFields,
    eventValidation,
    validate,
    createEvent
  );

router.route('/:id')
  .get(getEvent)  // Public
  .put(
    protect,
    authorize('admin', 'superadmin'),  // BOTH can update events
    validateObjectId(),
    mapEventFields,
    eventValidation,
    validate,
    updateEvent
  )
  .delete(
    protect, 
    authorize('admin', 'superadmin'),  // BOTH can delete events
    validateObjectId(), 
    deleteEvent
  );

router.get('/:id/stats', protect, validateObjectId(), getEventStats);

module.exports = router;