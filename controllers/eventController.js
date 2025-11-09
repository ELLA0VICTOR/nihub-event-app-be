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
      imageUrl,
      selectedTrack,
      tracks,
    } = req.body;

    // Handle uploaded image file
    let finalImageUrl = imageUrl;
    if (req.file) {
      // If file was uploaded, use the file path
      finalImageUrl = `/uploads/${req.file.filename}`;
    }

    // Calculate dates if not provided
    let calculatedStartDate = startDate || date;
    let calculatedEndDate = endDate;

    if (duration && !calculatedEndDate) {
      const end = new Date(calculatedStartDate);
      end.setDate(end.getDate() + parseInt(duration));
      calculatedEndDate = end;
    }

    // Ensure we have a date value
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
      imageUrl: finalImageUrl,
      selectedTrack: selectedTrack || null,
      tracks: tracks ? (typeof tracks === 'string' ? JSON.parse(tracks) : tracks) : [],
      createdBy: req.user.id,
    });

    const populatedEvent = await Event.findById(event._id).populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        event: populatedEvent,
      },
    });
  } catch (error) {
    // Clean up uploaded file if event creation fails
    if (req.file) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
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

    const events = await Event.find(query)
      .populate('createdBy', 'name email')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Event.countDocuments(query);

    // Auto-terminate expired events
    await Event.terminateExpiredEvents();

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

    res.status(200).json({
      success: true,
      data: {
        event: {
          ...event.toObject(),
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
      isActive,
      imageUrl,
      selectedTrack,
      tracks,
    } = req.body;

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

    // Handle uploaded image file
    let finalImageUrl = imageUrl || event.imageUrl;
    if (req.file) {
      // If new file was uploaded, use the new file path
      finalImageUrl = `/uploads/${req.file.filename}`;
      
      // Optionally delete old image file
      if (event.imageUrl && event.imageUrl.startsWith('/uploads/')) {
        const fs = require('fs');
        const path = require('path');
        const oldFilePath = path.join(__dirname, '..', event.imageUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    // Calculate new dates if duration changed
    let calculatedEndDate = endDate;
    if (duration && !endDate) {
      const start = startDate || event.startDate;
      const end = new Date(start);
      end.setDate(end.getDate() + parseInt(duration));
      calculatedEndDate = end;
    }

    event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        name: name || event.name,
        description: description !== undefined ? description : event.description,
        date: startDate || date || event.date,
        startDate: startDate || date || event.startDate,
        endDate: calculatedEndDate !== undefined ? calculatedEndDate : event.endDate,
        duration: duration ? parseInt(duration) : event.duration,
        autoTerminate: autoTerminate !== undefined ? autoTerminate : event.autoTerminate,
        location: location || event.location,
        maxParticipants: maxParticipants ? parseInt(maxParticipants) : event.maxParticipants,
        status: status || event.status,
        isActive: isActive !== undefined ? isActive : event.isActive,
        imageUrl: finalImageUrl,
        selectedTrack: selectedTrack !== undefined ? selectedTrack : event.selectedTrack,
        tracks: tracks ? (typeof tracks === 'string' ? JSON.parse(tracks) : tracks) : event.tracks,
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: {
        event,
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