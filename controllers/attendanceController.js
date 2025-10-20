const Attendance = require('../models/Attendance');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const { validateQRData } = require('../utils/qrGenerator');

/**
 * @desc    Scan QR code and mark attendance
 * @route   POST /api/attendance/scan
 * @access  Private (Admin/Superadmin)
 */
exports.scanQRCode = async (req, res, next) => {
  try {
    const { participantId, eventId, notes } = req.body;

    // Validate QR data
    if (!validateQRData(participantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data',
      });
    }

    // Find participant
    const participant = await Participant.findById(participantId).populate('eventId', 'name date location');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    // Check if participant is active
    if (!participant.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Participant registration is inactive',
      });
    }

    // Verify event match if provided
    if (eventId && participant.eventId._id.toString() !== eventId) {
      return res.status(400).json({
        success: false,
        message: 'Participant is not registered for this event',
      });
    }

    // Check if already marked attendance
    const existingAttendance = await Attendance.findOne({
      participantId,
      eventId: participant.eventId._id,
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already recorded for this participant',
        data: {
          attendance: existingAttendance,
          participant: {
            name: participant.name,
            email: participant.email,
            scannedAt: existingAttendance.scannedAt,
          },
        },
      });
    }

    // Create attendance record
    const attendance = await Attendance.create({
      participantId,
      eventId: participant.eventId._id,
      scannedBy: req.user.id,
      notes,
      status: 'present',
    });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        attendance,
        participant: {
          id: participant._id,
          name: participant.name,
          email: participant.email,
          photo: participant.photo,
          department: participant.department,
          matricNo: participant.matricNo,
          gender: participant.gender,
          track: participant.track,
        },
        event: {
          id: participant.eventId._id,
          name: participant.eventId.name,
          date: participant.eventId.date,
          location: participant.eventId.location,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all attendance records for an event
 * @route   GET /api/attendance/event/:eventId
 * @access  Private (Admin/Superadmin)
 */
exports.getEventAttendance = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 20, status, sortBy = '-scannedAt' } = req.query;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Build query
    const query = { eventId };
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const attendance = await Attendance.find(query)
      .populate('participantId', 'name email photo department matricNo gender track')
      .populate('scannedBy', 'name email')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      count: attendance.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single attendance record
 * @route   GET /api/attendance/:id
 * @access  Private (Admin/Superadmin)
 */
exports.getAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('participantId', 'name email photo department matricNo gender track')
      .populate('eventId', 'name date location')
      .populate('scannedBy', 'name email');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update attendance record
 * @route   PUT /api/attendance/:id
 * @access  Private (Admin/Superadmin)
 */
exports.updateAttendance = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    let attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate('participantId', 'name email photo department matricNo gender track')
      .populate('eventId', 'name date location')
      .populate('scannedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully',
      data: {
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};
