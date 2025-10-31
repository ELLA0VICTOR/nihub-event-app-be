const User = require('../models/User');

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
 * @desc    Create admin user (by superadmin)
 * @route   POST /api/users
 * @access  Private (Superadmin only)
 */
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Only superadmin can create users
    // They can create admins or other superadmins
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'admin',
      isApproved: true, // Auto-approved since created by superadmin
    });

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: user.isApproved,
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