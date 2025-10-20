const Event = require('../models/Event');
const Participant = require('../models/Participant');
const Attendance = require('../models/Attendance');

/**
 * @desc    Create new event
 * @route   POST /api/events
 * @access  Private (Superadmin only)
 */
exports.createEvent = async (req, res, next) => {
  try {
    const { name, description, date, location, maxParticipants, status } = req.body;

    const event = await Event.create({
      name,
      description,
      date,
      location,
      maxParticipants,
      status,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: {
        event,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all events
 * @route   GET /api/events
 * @access  Private
 */
exports.getAllEvents = async (req, res, next) => {
  try {
    const { status, sortBy = '-date', page = 1, limit = 10 } = req.query;

    // Build query
    const query = {};
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
 * @access  Private
 */
exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Get participant and attendance counts
    const participantCount = await Participant.countDocuments({ eventId: event._id });
    const attendanceCount = await Attendance.countDocuments({ eventId: event._id });

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
 * @access  Private (Superadmin only)
 */
exports.updateEvent = async (req, res, next) => {
  try {
    const { name, description, date, location, maxParticipants, status, isActive } = req.body;

    let event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Update fields
    event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        date,
        location,
        maxParticipants,
        status,
        isActive,
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
 * @desc    Delete event
 * @route   DELETE /api/events/:id
 * @access  Private (Superadmin only)
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

    // Delete associated participants and attendance records
    await Participant.deleteMany({ eventId: event._id });
    await Attendance.deleteMany({ eventId: event._id });

    await event.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Event and associated data deleted successfully',
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

    // Department distribution (if applicable)
    const departmentDistribution = await Participant.aggregate([
      { $match: { eventId: event._id, department: { $exists: true, $ne: null } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
        },
        statistics: {
          totalParticipants,
          totalAttendance,
          attendanceRate: totalParticipants > 0 
            ? ((totalAttendance / totalParticipants) * 100).toFixed(2) 
            : 0,
          attendanceByStatus,
          genderDistribution,
          departmentDistribution,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};