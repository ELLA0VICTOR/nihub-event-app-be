const AdminRequest = require('../models/AdminRequest');
const User = require('../models/User');
const { sendAdminApprovalEmail } = require('../utils/mailSender');

/**
 * @desc    Get all admin requests
 * @route   GET /api/admin-requests
 * @access  Private (Superadmin only)
 */
exports.getAllRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const requests = await AdminRequest.find(query)
      .populate('userId', 'name email role createdAt')
      .populate('reviewedBy', 'name email')
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(skip);

    const total = await AdminRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      count: requests.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        requests,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single admin request
 * @route   GET /api/admin-requests/:id
 * @access  Private (Superadmin only)
 */
exports.getRequest = async (req, res, next) => {
  try {
    const request = await AdminRequest.findById(req.params.id)
      .populate('userId', 'name email role createdAt')
      .populate('reviewedBy', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Admin request not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        request,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve admin request
 * @route   PUT /api/admin-requests/:id/approve
 * @access  Private (Superadmin only)
 */
exports.approveRequest = async (req, res, next) => {
  try {
    const { reviewNotes } = req.body;

    const request = await AdminRequest.findById(req.params.id).populate('userId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Admin request not found',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been processed',
      });
    }

    // Update request
    request.status = 'approved';
    request.reviewedBy = req.user.id;
    request.reviewedAt = Date.now();
    request.reviewNotes = reviewNotes;
    await request.save();

    // Update user approval status
    await User.findByIdAndUpdate(request.userId._id, {
      isApproved: true,
    });

    // Send approval email
    try {
      await sendAdminApprovalEmail({
        to: request.userId.email,
        name: request.userId.name,
        status: 'approved',
        notes: reviewNotes,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Admin request approved successfully',
      data: {
        request,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject admin request
 * @route   PUT /api/admin-requests/:id/reject
 * @access  Private (Superadmin only)
 */
exports.rejectRequest = async (req, res, next) => {
  try {
    const { reviewNotes } = req.body;

    const request = await AdminRequest.findById(req.params.id).populate('userId', 'name email');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Admin request not found',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been processed',
      });
    }

    // Update request
    request.status = 'rejected';
    request.reviewedBy = req.user.id;
    request.reviewedAt = Date.now();
    request.reviewNotes = reviewNotes;
    await request.save();

    // Send rejection email
    try {
      await sendAdminApprovalEmail({
        to: request.userId.email,
        name: request.userId.name,
        status: 'rejected',
        notes: reviewNotes,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Admin request rejected',
      data: {
        request,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete admin request
 * @route   DELETE /api/admin-requests/:id
 * @access  Private (Superadmin only)
 */
exports.deleteRequest = async (req, res, next) => {
  try {
    const request = await AdminRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Admin request not found',
      });
    }

    await request.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Admin request deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin request statistics
 * @route   GET /api/admin-requests/stats
 * @access  Private (Superadmin only)
 */
exports.getRequestStats = async (req, res, next) => {
  try {
    const pending = await AdminRequest.countDocuments({ status: 'pending' });
    const approved = await AdminRequest.countDocuments({ status: 'approved' });
    const rejected = await AdminRequest.countDocuments({ status: 'rejected' });
    const total = await AdminRequest.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          total,
          pending,
          approved,
          rejected,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
