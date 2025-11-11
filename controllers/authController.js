const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendVerificationEmail, sendEmail } = require('../utils/mailSender');

/**
 * Generate JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

/**
 * @desc    Register superadmin with email verification
 * @route   POST /api/auth/register-superadmin
 * @access  Public
 */
exports.registerSuperadmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Registration pending. Please check your email for verification link or request a new one.',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Create user with unverified status
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'superadmin',
      isEmailVerified: false,
      isApproved: false, // Will be set to true after email verification
      emailVerificationToken: hashedToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    // Create verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${email}`;

    // Send verification email
    try {
      await sendVerificationEmail({
        to: email,
        name,
        verificationUrl,
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        data: {
          email: user.email,
          name: user.name,
          requiresVerification: true,
        },
      });
    } catch (emailError) {
      // If email fails, delete the user and return error
      await user.deleteOne();
      console.error('Verification email error:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please try again.',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify email with token
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Token and email are required',
      });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with matching token and email
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token. Please request a new verification email.',
      });
    }

    // Mark email as verified and approve account
    user.isEmailVerified = true;
    user.isApproved = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Generate auth token
    const authToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
      data: {
        token: authToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: user.isApproved,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Public
 */
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified. Please log in.',
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Create verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${email}`;

    // Send verification email
    await sendVerificationEmail({
      to: email,
      name: user.name,
      verificationUrl,
    });

    res.status(200).json({
      success: true,
      message: 'Verification email sent! Please check your inbox.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    // Support both lowercase and capitalized field names
    const email = req.body.email || req.body.Email;
    const password = req.body.password || req.body.Password;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check if user exists (include password for comparison)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        requiresVerification: true,
        email: user.email,
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is approved
    if (!user.isApproved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: user.isApproved,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user password
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      data: {
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    // In a stateless JWT setup, logout is handled client-side
    // by removing the token. This endpoint is for consistency.
    
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};
/**
 * @desc    Request password reset (SUPERADMIN ONLY)
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address',
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists or not (security)
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    // Only superadmins can reset their own password
    if (user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Password reset is only available for superadmin accounts. Contact your superadmin to reset your password.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Save hashed token and expiry
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${email}`;

    // Send reset email
    try {
      await sendEmail({
        to: email,
        subject: 'Password Reset Request - Attendance Management System',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 40px 20px; 
                text-align: center; 
              }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 40px 30px; background-color: #ffffff; }
              .content p { margin: 0 0 15px 0; font-size: 16px; }
              .button-container { text-align: center; margin: 30px 0; }
              .reset-button { 
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white !important; 
                padding: 15px 40px; 
                text-decoration: none; 
                border-radius: 5px;
                font-weight: bold;
                font-size: 16px;
              }
              .info-box { 
                background: #f8f9fa; 
                padding: 20px; 
                margin: 20px 0; 
                border-left: 4px solid #667eea;
                border-radius: 4px;
              }
              .footer { 
                text-align: center; 
                padding: 20px; 
                font-size: 12px; 
                color: #666;
                background: #f8f9fa;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔒 Password Reset</h1>
              </div>
              <div class="content">
                <p>Hello <strong>${user.name}</strong>,</p>
                <p>We received a request to reset your password for your superadmin account.</p>
                
                <div class="button-container">
                  <a href="${resetUrl}" class="reset-button">Reset Password</a>
                </div>

                <div class="info-box">
                  <p><strong>⚠️ Important:</strong></p>
                  <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>This link is valid for <strong>1 hour</strong></li>
                    <li>If you didn't request this, please ignore this email</li>
                    <li>Your password will not change until you set a new one</li>
                  </ul>
                </div>

                <p>If the button doesn't work, copy and paste this link:</p>
                <p style="word-break: break-all; color: #667eea; font-size: 12px;">${resetUrl}</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply.</p>
                <p>&copy; ${new Date().getFullYear()} Attendance Management System. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      res.status(200).json({
        success: true,
        message: 'Password reset link sent to your email',
      });
    } catch (emailError) {
      console.error('Reset email error:', emailError);
      
      // Clear reset token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        message: 'Failed to send reset email. Please try again.',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password with token (SUPERADMIN ONLY)
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token, email, and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Hash the token to compare
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with matching token and email
    const user = await User.findOne({
      email: email.toLowerCase(),
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Generate new auth token
    const authToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.',
      data: {
        token: authToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
/**
 * @desc    Reset admin password by superadmin
 * @route   PUT /api/users/:id/reset-password
 * @access  Private (Superadmin only)
 */
exports.resetAdminPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.params.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent superadmin from resetting their own password this way
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Use the forgot password flow to reset your own password',
      });
    }

    // Only allow resetting admin passwords (not other superadmins)
    if (user.role === 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset another superadmin\'s password',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send notification email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset - Attendance Management System',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; 
                padding: 40px 20px; 
                text-align: center; 
              }
              .header h1 { margin: 0; font-size: 28px; }
              .content { padding: 40px 30px; background-color: #ffffff; }
              .content p { margin: 0 0 15px 0; font-size: 16px; }
              .info-box { 
                background: #f8f9fa; 
                padding: 20px; 
                margin: 20px 0; 
                border-left: 4px solid #667eea;
                border-radius: 4px;
              }
              .footer { 
                text-align: center; 
                padding: 20px; 
                font-size: 12px; 
                color: #666;
                background: #f8f9fa;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Password Reset</h1>
              </div>
              <div class="content">
                <p>Hello <strong>${user.name}</strong>,</p>
                <p>Your password has been reset by a superadmin.</p>
                
                <div class="info-box">
                  <h3>📧 Your New Login Credentials:</h3>
                  <p><strong>Email:</strong> ${user.email}</p>
                  <p><strong>Temporary Password:</strong> ${newPassword}</p>
                </div>

                <p><strong>⚠️ Important Security Steps:</strong></p>
                <ul>
                  <li><strong>Change your password immediately</strong> after login</li>
                  <li>Do not share this password with anyone</li>
                  <li>Choose a strong, unique password</li>
                </ul>

                <p>You can log in at: <a href="${process.env.FRONTEND_URL}/AdminLogin">${process.env.FRONTEND_URL}/AdminLogin</a></p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply.</p>
                <p>&copy; ${new Date().getFullYear()} Attendance Management System. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } catch (emailError) {
      console.error('Password reset notification email failed:', emailError);
      // Don't fail the password reset if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Admin password reset successfully. Notification sent to their email.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};