const Event = require('../models/Event');
const Participant = require('../models/Participant');
const Attendance = require('../models/Attendance');
const EventPermission = require('../models/EventPermission');

/**
 * @desc    Create new event
 * @route   POST /api/events
 * @access  Private (Admin/Superadmin)
 */
exports.createEvent = async (req, res, next) => {
  try {
    const {
      name,
      description,
      date,
      startDate,
      endDate,
      duration,
      autoTerminate,
      location,
      maxParticipants,
      status,
      selectedTrack,
      tracks,
    } = req.body;

    // Create the eventImage object from req.file
    let eventImage = {};
    if (req.file) {
      eventImage.data = req.file.buffer;
      eventImage.contentType = req.file.mimetype;
    }

    // Calculate dates if not provided
    let calculatedStartDate = startDate || date;
    let calculatedEndDate = endDate;

    if (duration && !calculatedEndDate) {
      const end = new Date(calculatedStartDate);
      end.setDate(end.getDate() + parseInt(duration));
      calculatedEndDate = end;
    }

    if (!calculatedStartDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date or date is required',
      });
    }

    const event = await Event.create({
      name,
      description,
      date: calculatedStartDate,
      startDate: calculatedStartDate,
      endDate: calculatedEndDate,
      duration: duration ? parseInt(duration) : undefined,
      autoTerminate: autoTerminate || false,
      location,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : undefined,
      status: status || 'upcoming',
      
      // Use the new eventImage object
      eventImage: eventImage.data ? eventImage : undefined, 

      selectedTrack: selectedTrack || null,
      tracks: tracks ? (typeof tracks === 'string' ? JSON.parse(tracks) : tracks) : [],
      createdBy: req.user.id,
    });

    const populatedEvent = await Event.findById(event._id).populate('createdBy', 'name email');

    // Convert image to Base64 for the response
    let eventData = populatedEvent.toObject();
    if (eventData.eventImage && eventData.eventImage.data) {
      eventData.eventImage = `data:${eventData.eventImage.contentType};base64,${eventData.eventImage.data.toString('base64')}`;
    }

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        event: eventData, // Send the converted data
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all events
 * @route   GET /api/events
 * @access  Public
 */
exports.getAllEvents = async (req, res, next) => {
  try {
    const { status, sortBy = '-date', page = 1, limit = 10, includeDeleted = false } = req.query;

    // Build query
    const query = {};
    
    // Don't show deleted events by default
    if (includeDeleted !== 'true') {
      query.isDeleted = false;
    }
    
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 1. We removed .select('-eventImage.data') to get the image data
    const eventsDocs = await Event.find(query)
      .populate('createdBy', 'name email')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Event.countDocuments(query);

    // Auto-terminate expired events
    await Event.terminateExpiredEvents();

    // 2. Manually convert all event images to Base64
    const events = eventsDocs.map(event => {
      let eventData = event.toObject();
      if (eventData.eventImage && eventData.eventImage.data) {
        eventData.eventImage = `data:${eventData.eventImage.contentType};base64,${eventData.eventImage.data.toString('base64')}`;
      }
      return eventData;
    });

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        events, // 3. Send the converted events
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single event
 * @route   GET /api/events/:id
 * @access  Public
 */
exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'name email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Get participant and attendance counts
    const participantCount = await Participant.countDocuments({ eventId: event._id });
    const attendanceCount = await Attendance.countDocuments({ eventId: event._id });

    // Check if event should auto-terminate
    if (event.shouldAutoTerminate()) {
      event.status = 'terminated';
      await event.save();
    }

    // ===== MODIFICATION =====
    // Convert image buffer to Base64 string for the response
    let eventData = event.toObject();
    if (event.eventImage && event.eventImage.data) {
      eventData.eventImage = `data:${event.eventImage.contentType};base64,${event.eventImage.data.toString('base64')}`;
    }
    // ========================

    res.status(200).json({
      success: true,
      data: {
        event: {
          ...eventData, // Send the modified event data
          participantCount,
          attendanceCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update event
 * @route   PUT /api/events/:id
 * @access  Private (Event Creator or Superadmin)
 */
exports.updateEvent = async (req, res, next) => {
  try {
    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check permissions
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'superadmin' && event.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the event creator or superadmin can update this event',
      });
    }

    // ===== MODIFICATION =====
    // Get all fields from req.body to update
    const fieldsToUpdate = { ...req.body };

    // Handle new image upload
    if (req.file) {
      fieldsToUpdate.eventImage = {
        data: req.file.buffer,
        contentType: req.file.mimetype
      };
    }

    // Remove the old, unused 'imageUrl' field if it exists
    delete fieldsToUpdate.imageUrl; 
    // ========================

    // Calculate new dates if duration changed
    let calculatedEndDate = fieldsToUpdate.endDate;
    if (fieldsToUpdate.duration && !fieldsToUpdate.endDate) {
      const start = fieldsToUpdate.startDate || event.startDate;
      const end = new Date(start);
      end.setDate(end.getDate() + parseInt(fieldsToUpdate.duration));
      calculatedEndDate = end;
    }
    fieldsToUpdate.endDate = calculatedEndDate || event.endDate;
    
    // Ensure 'date' and 'startDate' are consistent
    if (fieldsToUpdate.startDate) {
        fieldsToUpdate.date = fieldsToUpdate.startDate;
    } else if (fieldsToUpdate.date) {
        fieldsToUpdate.startDate = fieldsToUpdate.date;
    }

    event = await Event.findByIdAndUpdate(
      req.params.id,
      fieldsToUpdate, // Pass the updated fields object
      {
        new: true,
        runValidators: true,
      }
    ).populate('createdBy', 'name email');

    // Convert image to Base64 for the response
    let eventData = event.toObject();
    if (eventData.eventImage && eventData.eventImage.data) {
      eventData.eventImage = `data:${eventData.eventImage.contentType};base64,${eventData.eventImage.data.toString('base64')}`;
    }

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: {
        event: eventData,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete event (soft delete to preserve data)
 * @route   DELETE /api/events/:id
 * @access  Private (Event Creator or Superadmin)
 */
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check permissions
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'superadmin' && event.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the event creator or superadmin can delete this event',
      });
    }

    // Soft delete to preserve attendance history
    event.isDeleted = true;
    event.deletedAt = new Date();
    event.isActive = false;
    event.status = 'cancelled';
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully. Attendance history has been preserved.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Terminate event manually
 * @route   POST /api/events/:id/terminate
 * @access  Private (Event Creator or Superadmin)
 */
exports.terminateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check permissions
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'superadmin' && event.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the event creator or superadmin can terminate this event',
      });
    }

    if (event.status === 'terminated') {
      return res.status(400).json({
        success: false,
        message: 'Event is already terminated',
      });
    }

    event.status = 'terminated';
    event.isActive = false;
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event terminated successfully',
      data: {
        event,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get event statistics
 * @route   GET /api/events/:id/stats
 * @access  Private
 */
exports.getEventStats = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const totalParticipants = await Participant.countDocuments({ eventId: event._id });
    const totalAttendance = await Attendance.countDocuments({ eventId: event._id });

    // Attendance by status
    const attendanceByStatus = await Attendance.aggregate([
      { $match: { eventId: event._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Gender distribution
    const genderDistribution = await Participant.aggregate([
      { $match: { eventId: event._id } },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
    ]);

    // Department distribution
    const departmentDistribution = await Participant.aggregate([
      { $match: { eventId: event._id, department: { $exists: true, $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Per-day attendance if multi-day event
    let dailyAttendance = [];
    if (event.startDate && event.endDate) {
      dailyAttendance = await Attendance.aggregate([
        { $match: { eventId: event._id } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$attendanceDate' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    res.status(200).json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          duration: event.duration,
        },
        statistics: {
          totalParticipants,
          totalAttendance,
          attendanceRate:
            totalParticipants > 0 ? ((totalAttendance / totalParticipants) * 100).toFixed(2) : 0,
          attendanceByStatus,
          genderDistribution,
          departmentDistribution,
          dailyAttendance,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get events created by current user
 * @route   GET /api/events/my-events
 * @access  Private (Admin/Superadmin)
 */
exports.getMyEvents = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { createdBy: userId, isDeleted: false };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const events = await Event.find(query)
      .populate('createdBy', 'name email')
      .select('-eventImage.data') // Exclude large image data for fast list loading
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Event.countDocuments(query);

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        events,
      },
    });
  } catch (error) {
    next(error);
  }
};