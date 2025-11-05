const EventPermission = require('../models/EventPermission');
const Event = require('../models/Event');
const User = require('../models/User');
const bcrypt = require('bcrypt');

/**
 * @desc    Grant permission to another admin for an event
 * @route   POST /api/event-permissions/grant
 * @access  Private (Event Creator or Superadmin)
 */
exports.grantPermission = async (req, res, next) => {
  try {
    const { eventId, grantToAdminId, password, permissions, notes } = req.body;

    // Validate required fields
    if (!eventId || !grantToAdminId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Event ID, admin ID, and password are required',
      });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Verify user is creator or superadmin
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'superadmin' && event.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the event creator or superadmin can grant permissions',
      });
    }

    // Verify password
    const user = await User.findById(userId).select('+password');
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Permission granting failed.',
      });
    }

    // Find the admin to grant permission to
    const adminToGrant = await User.findById(grantToAdminId);
    if (!adminToGrant) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found',
      });
    }

    if (adminToGrant.role !== 'admin' && adminToGrant.role !== 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'Can only grant permissions to admin users',
      });
    }

    // Prevent granting to self
    if (grantToAdminId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot grant permissions to yourself',
      });
    }

    // Check if permission already exists
    let existingPermission = await EventPermission.findOne({
      eventId,
      grantedTo: grantToAdminId,
    });

    if (existingPermission) {
      // Update existing permission
      existingPermission.permissions = permissions || {
        canScan: true,
        canEdit: false,
        canDelete: false,
        canViewReports: true,
      };
      existingPermission.isActive = true;
      existingPermission.revokedAt = null;
      existingPermission.grantedBy = userId;
      existingPermission.grantedAt = new Date();
      existingPermission.notes = notes || '';
      await existingPermission.save();

      return res.status(200).json({
        success: true,
        message: 'Permission updated successfully',
        data: {
          permission: existingPermission,
        },
      });
    }

    // Create new permission
    const permission = await EventPermission.create({
      eventId,
      grantedBy: userId,
      grantedTo: grantToAdminId,
      permissions: permissions || {
        canScan: true,
        canEdit: false,
        canDelete: false,
        canViewReports: true,
      },
      notes: notes || '',
    });

    const populatedPermission = await EventPermission.findById(permission._id)
      .populate('grantedBy', 'name email')
      .populate('grantedTo', 'name email')
      .populate('eventId', 'name date location');

    res.status(201).json({
      success: true,
      message: `Permission granted to ${adminToGrant.name} successfully`,
      data: {
        permission: populatedPermission,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Revoke permission from an admin for an event
 * @route   POST /api/event-permissions/revoke
 * @access  Private (Event Creator or Superadmin)
 */
exports.revokePermission = async (req, res, next) => {
  try {
    const { eventId, revokeFromAdminId, password } = req.body;

    if (!eventId || !revokeFromAdminId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Event ID, admin ID, and password are required',
      });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Verify user is creator or superadmin
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'superadmin' && event.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the event creator or superadmin can revoke permissions',
      });
    }

    // Verify password
    const user = await User.findById(userId).select('+password');
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Permission revocation failed.',
      });
    }

    // Revoke permission
    const permission = await EventPermission.revokePermission(eventId, revokeFromAdminId);

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Permission revoked successfully',
      data: {
        permission,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all permissions for an event
 * @route   GET /api/event-permissions/event/:eventId
 * @access  Private (Event Creator or Superadmin)
 */
exports.getEventPermissions = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Verify user is creator or superadmin
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'superadmin' && event.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the event creator or superadmin can view permissions',
      });
    }

    const permissions = await EventPermission.find({ eventId })
      .populate('grantedBy', 'name email')
      .populate('grantedTo', 'name email')
      .sort('-grantedAt');

    res.status(200).json({
      success: true,
      count: permissions.length,
      data: {
        permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all events a user has been granted access to
 * @route   GET /api/event-permissions/my-granted-events
 * @access  Private (Admin)
 */
exports.getMyGrantedEvents = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const permissions = await EventPermission.find({
      grantedTo: userId,
      isActive: true,
    })
      .populate('eventId', 'name date location status createdBy')
      .populate('grantedBy', 'name email')
      .sort('-grantedAt');

    const events = permissions.map(p => ({
      event: p.eventId,
      permissions: p.permissions,
      grantedBy: p.grantedBy,
      grantedAt: p.grantedAt,
    }));

    res.status(200).json({
      success: true,
      count: events.length,
      data: {
        grantedEvents: events,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check if current user has access to an event
 * @route   GET /api/event-permissions/check/:eventId
 * @access  Private
 */
exports.checkEventAccess = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    let hasAccess = false;
    let accessType = 'none';
    let permissions = {};

    // Superadmin has full access
    if (userRole === 'superadmin') {
      hasAccess = true;
      accessType = 'superadmin';
      permissions = {
        canScan: true,
        canEdit: true,
        canDelete: true,
        canViewReports: true,
      };
    }
    // Event creator has full access
    else if (event.createdBy.toString() === userId) {
      hasAccess = true;
      accessType = 'creator';
      permissions = {
        canScan: true,
        canEdit: true,
        canDelete: true,
        canViewReports: true,
      };
    }
    // Check granted permissions
    else {
      const permission = await EventPermission.findOne({
        eventId,
        grantedTo: userId,
        isActive: true,
      });

      if (permission) {
        hasAccess = true;
        accessType = 'granted';
        permissions = permission.permissions;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        hasAccess,
        accessType,
        permissions,
        event: {
          id: event._id,
          name: event.name,
          createdBy: event.createdBy,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};