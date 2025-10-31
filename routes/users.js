const express = require('express');
const { body } = require('express-validator');
const {
  getAllUsers,
  getUser,
  createAdmin,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, validateObjectId } = require('../middleware/validateRequest');

const router = express.Router();

// Validation rules
const createAdminValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'superadmin'])
    .withMessage('Role must be either admin or superadmin'),
];

const updateUserValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['admin', 'superadmin'])
    .withMessage('Role must be either admin or superadmin'),
];

// All routes require superadmin access
router.use(protect, authorize('superadmin'));

// Routes
router.route('/')
  .get(getAllUsers)
  .post(createAdminValidation, validate, createAdmin);

router.route('/:id')
  .get(validateObjectId(), getUser)
  .put(validateObjectId(), updateUserValidation, validate, updateUser)
  .delete(validateObjectId(), deleteUser);

module.exports = router;