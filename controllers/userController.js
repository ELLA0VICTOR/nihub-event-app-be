const User = require('../models/User');
const { sendEmail } = require('../utils/mailSender');
/**
 * @desc    Get all users (admins)
 * @route   GET /api/users
 * @access  Private (Superadmin only)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;

    const query = {};
    if (role) {
      query.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        users,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user
 * @route   GET /api/users/:id
 * @access  Private (Superadmin only)
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

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
 * @desc    Create admin user (by superadmin) - AUTO-VERIFIED
 * @route   POST /api/users
 * @access  Private (Superadmin only)
 */
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create admin - AUTO-APPROVED and AUTO-VERIFIED (created by superadmin)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'admin',
      isApproved: true, // Auto-approved since created by superadmin
      isEmailVerified: true, // Auto-verified since created by superadmin
    });

    // Send welcome email with login credentials
    try {
      await sendEmail({
        to: email,
        subject: 'Admin Account Created - Attendance Management System',
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
              .button-container { text-align: center; margin: 30px 0; }
              .login-button { 
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white !important; 
                padding: 15px 40px; 
                text-decoration: none; 
                border-radius: 5px;
                font-weight: bold;
                font-size: 16px;
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
                <h1> Welcome Admin!</h1>
              </div>
              <div class="content">
                <p>Hello <strong>${name}</strong>,</p>
                <p>A superadmin has created an admin account for you in the Attendance Management System.</p>
                
                <div class="info-box">
                  <h3>📧 Your Login Credentials:</h3>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Password:</strong> ${password}</p>
                  <p><strong>Role:</strong> ${role || 'admin'}</p>
                </div>

                <p><strong>⚠️ Important Security Steps:</strong></p>
                <ul>
                  <li>Your account is already verified and active</li>
                  <li><strong>Change your password immediately</strong> after first login</li>
                  <li>Keep your credentials secure</li>
                  <li>Do not share your login details</li>
                </ul>

                <div class="button-container">
                  <a href="${process.env.FRONTEND_URL}/admin-login" class="login-button">Login Now</a>
                </div>

                <p>As an admin, you can:</p>
                <ul>
                  <li>Create and manage events</li>
                  <li>Scan QR codes for attendance</li>
                  <li>View attendance reports</li>
                  <li>Manage participants</li>
                </ul>
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
      console.error('Welcome email failed:', emailError);
      // Don't fail admin creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Admin created successfully. Welcome email sent with login credentials.',
      data: {
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
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private (Superadmin only)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, isApproved } = req.body;

    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent superadmin from demoting themselves
    if (req.params.id === req.user.id && role !== 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role',
      });
    }

    user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, isApproved },
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private (Superadmin only)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Prevent superadmin from deleting themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};