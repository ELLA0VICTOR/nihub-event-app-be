const express = require('express');
const { body } = require('express-validator');
const {
  registerSuperadmin,
  verifyEmail,
  resendVerification,
  login,
  getMe,
  updatePassword,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateRequest');

const router = express.Router();

// Validation rules
const registerSuperadminValidation = [
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
];

const verifyEmailValidation = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const resendVerificationValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const loginValidation = [
  body('email').optional(),
  body('Email').optional(), // Support capitalized
  body('password').optional(),
  body('Password').optional(), // Support capitalized
];

const updatePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
];

// Routes
router.post('/register-superadmin', registerSuperadminValidation, validate, registerSuperadmin);
router.post('/verify-email', verifyEmailValidation, validate, verifyEmail);
router.post('/resend-verification', resendVerificationValidation, validate, resendVerification);
router.post('/login', loginValidation, validate, login);
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePasswordValidation, validate, updatePassword);
router.post('/logout', protect, logout);

module.exports = router;