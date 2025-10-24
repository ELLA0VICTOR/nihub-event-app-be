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
/**
 * @desc    Delete attendance record
 * @route   DELETE /api/attendance/:id
 * @access  Private (Superadmin)
 */
exports.deleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ensure valid id (validateObjectId middleware already runs for routes that use it,
    // but we defensively check here)
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Attendance ID is required',
      });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }

    // Use findByIdAndDelete so we return the removed doc if needed
    await Attendance.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully',
      data: {
        id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get attendance report for an event
 * @route   GET /api/attendance/event/:eventId/report
 * @access  Private (Admin/Superadmin)
 *
 * Response example:
 * {
 *   success: true,
 *   data: {
 *     totals: { total, present, late, excused, absent },
 *     percentages: { presentPct, latePct, excusedPct, absentPct },
 *     byDate: [ { date: '2025-10-21', total: 42, present: 40, late: 1, excused: 1 } ],
 *     topParticipants: [ { participantId, name, email, count } ]
 *   }
 * }
 */
exports.getAttendanceReport = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required',
      });
    }

    // Ensure event exists (routes call validateObjectId earlier)
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Aggregation for totals per status and overall counts
    const totalsAgg = await Attendance.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Convert totalsAgg into an object with defaults
    const totals = {
      total: 0,
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    };

    totalsAgg.forEach((t) => {
      totals[t._id] = t.count;
      totals.total += t.count;
    });

    // percentages (avoid division by zero)
    const safeTotal = totals.total || 1;
    const percentages = {
      presentPct: parseFloat(((totals.present / safeTotal) * 100).toFixed(2)),
      latePct: parseFloat(((totals.late / safeTotal) * 100).toFixed(2)),
      excusedPct: parseFloat(((totals.excused / safeTotal) * 100).toFixed(2)),
      absentPct: parseFloat(((totals.absent / safeTotal) * 100).toFixed(2)),
    };

    // Optional: breakdown by date (group by date of scannedAt)
    const byDate = await Attendance.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' },
          },
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] },
          },
          late: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] },
          },
          excused: {
            $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } }, // ascending dates
      {
        $project: {
          date: '$_id',
          total: 1,
          present: 1,
          late: 1,
          excused: 1,
          absent: 1,
          _id: 0,
        },
      },
    ]);

    // Top participants by attendance count (in case of multiple records per participant)
    const topParticipants = await Attendance.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: '$participantId',
          count: { $sum: 1 },
          latestAttendance: { $max: '$scannedAt' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'participants',
          localField: '_id',
          foreignField: '_id',
          as: 'participant',
        },
      },
      { $unwind: { path: '$participant', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          participantId: '$_id',
          count: 1,
          latestAttendance: 1,
          name: '$participant.name',
          email: '$participant.email',
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totals,
        percentages,
        byDate,
        topParticipants,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all attendance records for a specific participant
 * @route   GET /api/attendance/participant/:participantId
 * @access  Private (Admin/Superadmin)
 *
 * Query params:
 *  - page (default 1)
 *  - limit (default 20)
 *  - sortBy (default -scannedAt)
 */
exports.getParticipantAttendance = async (req, res, next) => {
  try {
    const { participantId } = req.params;
    const { page = 1, limit = 20, sortBy = '-scannedAt' } = req.query;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required',
      });
    }

    // Ensure participant exists
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [attendance, total] = await Promise.all([
      Attendance.find({ participantId })
        .populate('eventId', 'name date location')
        .populate('scannedBy', 'name email')
        .sort(sortBy)
        .limit(parseInt(limit, 10))
        .skip(skip),
      Attendance.countDocuments({ participantId }),
    ]);

    res.status(200).json({
      success: true,
      count: attendance.length,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data: {
        participant: {
          id: participant._id,
          name: participant.name,
          email: participant.email,
        },
        attendance,
      },
    });
  } catch (error) {
    next(error);
  }
};

