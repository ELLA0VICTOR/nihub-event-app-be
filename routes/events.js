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

const router = express.Router();

// Validation rules
const eventValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Event name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Event name must be between 3 and 200 characters'),
  body('date')
    .notEmpty()
    .withMessage('Event date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Event location is required')
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
    .isIn(['upcoming', 'ongoing', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
];

// Routes
router.route('/')
  .get(protect, getAllEvents)
  .post(protect, authorize('superadmin'), eventValidation, validate, createEvent);

router.route('/:id')
  .get(protect, validateObjectId(), getEvent)
  .put(protect, authorize('superadmin'), validateObjectId(), eventValidation, validate, updateEvent)
  .delete(protect, authorize('superadmin'), validateObjectId(), deleteEvent);

router.get('/:id/stats', protect, validateObjectId(), getEventStats);

module.exports = router;
