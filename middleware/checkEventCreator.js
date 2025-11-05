const Event = require('../models/Event');
const EventPermission = require('../models/EventPermission');

/**
 * Check if user is the creator of the event or has been granted permission
 */
exports.checkEventAccess = (permissionType = 'canScan') => {
  return async (req, res, next) => {
    try {
      const eventId = req.params.eventId || req.params.id || req.body.eventId;
      
      if (!eventId) {
        return res.status(400).json({
          success: false,
          message: 'Event ID is required',
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

      // Check if event is deleted
      if (event.isDeleted) {
        return res.status(403).json({
          success: false,
          message: 'This event has been deleted',
        });
      }

      const userId = req.user.id;
      const userRole = req.user.role;

      // Superadmin can access any event
      if (userRole === 'superadmin') {
        req.event = event;
        return next();
      }

      // Check if user is the creator
      if (event.createdBy.toString() === userId) {
        req.event = event;
        return next();
      }

      // Check if user has been granted permission
      const hasPermission = await EventPermission.hasPermission(
        userId,
        eventId,
        permissionType
      );

      if (hasPermission) {
        req.event = event;
        return next();
      }

      // User has no access
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this event',
      });
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user is the creator of the event (strict - no granted permissions)
 */
exports.checkEventCreatorStrict = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id || req.body.eventId;
    
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required',
      });
    }

    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Superadmin can access any event
    if (userRole === 'superadmin') {
      req.event = event;
      return next();
    }

    // Only creator can proceed
    if (event.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the event creator or superadmin can perform this action',
      });
    }

    req.event = event;
    next();
  } catch (error) {
    next(error);
  }
};