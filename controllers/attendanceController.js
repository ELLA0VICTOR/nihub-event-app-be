const Attendance = require('../models/Attendance');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const { validateQRData } = require('../utils/qrGenerator');
const EventPermission = require('../models/EventPermission');

/**
 * @desc    Scan QR code and mark attendance (WITH CREATOR PERMISSION CHECK)
 * @route   POST /api/attendance/scan
 * @access  Private (Event Creator, Granted Admins, or Superadmin)
 */
exports.scanQRCode = async (req, res, next) => {
  try {
    const { participantId, eventId, notes } = req.body;
    const scannerId = req.user.id;
    const scannerRole = req.user.role;

    // Validate QR data
    if (!validateQRData(participantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data',
      });
    }

    // Find participant
    const participant = await Participant.findById(participantId).populate('eventId', 'name date location startDate endDate status isActive isDeleted createdBy');

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

    const event = participant.eventId;

    // Check if event is active
    if (!event.isActive || event.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'This event is no longer active',
      });
    }

    // Check if event is terminated
    if (event.status === 'terminated' || event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `This event has been ${event.status}`,
      });
    }

    // Check if QR code is still valid (within event dates)
    const now = new Date();
    if (event.endDate && now > event.endDate) {
      return res.status(400).json({
        success: false,
        message: 'This event has ended. QR code is no longer valid.',
      });
    }

    // Verify event match if provided
    if (eventId && event._id.toString() !== eventId) {
      return res.status(400).json({
        success: false,
        message: 'Participant is not registered for this event',
      });
    }

    // CHECK SCANNER PERMISSIONS
    let hasPermission = false;

    // Superadmin can scan any event
    if (scannerRole === 'superadmin') {
      hasPermission = true;
    }
    // Event creator can scan their own event
    else if (event.createdBy.toString() === scannerId) {
      hasPermission = true;
    }
    // Check if scanner has been granted permission
    else {
      hasPermission = await EventPermission.hasPermission(scannerId, event._id, 'canScan');
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to scan attendance for this event',
      });
    }

    // Check if already marked attendance TODAY
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      participantId,
      eventId: event._id,
      attendanceDate: today,
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already recorded for this participant today',
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
      eventId: event._id,
      scannedBy: scannerId,
      notes,
      status: 'present',
      attendanceDate: today,
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
          id: event._id,
          name: event.name,
          date: event.date,
          location: event.location,
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
 * @desc    Get attendance report for an event (WITH ABSENTEE TRACKING)
 * @route   GET /api/attendance/event/:eventId/report
 * @access  Private (Admin/Superadmin)
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

    // Ensure event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Get all registered participants for this event
    const allParticipants = await Participant.find({ eventId, isActive: true });
    const totalRegistered = allParticipants.length;

    // Aggregation for totals per status
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
      totalRegistered,
      present: 0,
      late: 0,
      excused: 0,
    };

    totalsAgg.forEach((t) => {
      totals[t._id] = t.count;
    });

    // Calculate actual absent count (registered but not scanned)
    const totalScanned = totals.present + totals.late + totals.excused;
    totals.absent = totalRegistered - totalScanned;
    totals.totalScanned = totalScanned;

    // Get list of absentees (participants who didn't scan)
    const attendedParticipantIds = await Attendance.find({ eventId })
      .distinct('participantId');
    
    const absentees = allParticipants.filter(
      p => !attendedParticipantIds.some(id => id.toString() === p._id.toString())
    ).map(p => ({
      participantId: p._id,
      name: p.name,
      email: p.email,
      department: p.department,
      matricNo: p.matricNo,
      track: p.track,
      gender: p.gender,
    }));

    // Percentages (avoid division by zero)
    const safeTotal = totalRegistered || 1;
    const percentages = {
      presentPct: parseFloat(((totals.present / safeTotal) * 100).toFixed(2)),
      latePct: parseFloat(((totals.late / safeTotal) * 100).toFixed(2)),
      excusedPct: parseFloat(((totals.excused / safeTotal) * 100).toFixed(2)),
      absentPct: parseFloat(((totals.absent / safeTotal) * 100).toFixed(2)),
      attendanceRate: parseFloat(((totalScanned / safeTotal) * 100).toFixed(2)),
    };

    // Breakdown by date
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
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          total: 1,
          present: 1,
          late: 1,
          excused: 1,
          _id: 0,
        },
      },
    ]);

    // Top participants by attendance count
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
        absentees,
        byDate,
        topParticipants,
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Get comprehensive attendance report with first-day logic
 * @route   GET /api/attendance/event/:eventId/comprehensive-report
 * @access  Private (Admin/Superadmin)
 */
exports.getComprehensiveReport = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Get all participants
    const allParticipants = await Participant.find({ eventId, isActive: true })
      .select('name email track department matricNo registeredAt')
      .lean();

    if (allParticipants.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No participants registered for this event yet',
        data: {
          event: {
            id: event._id,
            name: event.name,
            track: event.selectedTrack,
          },
          participants: [],
          dailyReports: [],
        },
      });
    }

    // Find the FIRST registration date (this is when event effectively started)
    const firstRegistrationDate = new Date(
      Math.min(...allParticipants.map(p => new Date(p.registeredAt)))
    );
    firstRegistrationDate.setHours(0, 0, 0, 0);

    // Get all attendance records
    const allAttendance = await Attendance.find({ eventId })
      .select('participantId attendanceDate status scannedAt')
      .lean();

    // Get unique attendance dates
    const attendanceDates = [...new Set(
      allAttendance.map(a => {
        const d = new Date(a.attendanceDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    )].sort((a, b) => a - b);

    // If no one has attended yet, show all as absent
    if (attendanceDates.length === 0) {
      const report = allParticipants.map(p => ({
        participantId: p._id,
        name: p.name,
        email: p.email,
        track: p.track || 'N/A',
        department: p.department || 'N/A',
        matricNo: p.matricNo || 'N/A',
        registeredAt: p.registeredAt,
        attendanceStatus: 'No attendance records yet',
        totalDaysPresent: 0,
        totalDaysAbsent: 0,
      }));

      return res.status(200).json({
        success: true,
        data: {
          event: {
            id: event._id,
            name: event.name,
            track: event.selectedTrack,
          },
          eventStartDate: firstRegistrationDate,
          totalParticipants: allParticipants.length,
          participants: report,
          dailyReports: [],
        },
      });
    }

    // Generate daily reports
    const dailyReports = [];

    for (const dateTimestamp of attendanceDates) {
      const date = new Date(dateTimestamp);
      const dateString = date.toISOString().split('T')[0];

      // Get participants who were registered by this date
      const registeredByThisDate = allParticipants.filter(p => {
        const regDate = new Date(p.registeredAt);
        regDate.setHours(0, 0, 0, 0);
        return regDate <= date;
      });

      // Get attendance for this date
      const dateAttendance = allAttendance.filter(a => {
        const attDate = new Date(a.attendanceDate);
        attDate.setHours(0, 0, 0, 0);
        return attDate.getTime() === dateTimestamp;
      });

      const attendedIds = dateAttendance.map(a => a.participantId.toString());

      // Calculate present and absent
      const present = registeredByThisDate.filter(p => 
        attendedIds.includes(p._id.toString())
      );

      const absent = registeredByThisDate.filter(p => 
        !attendedIds.includes(p._id.toString())
      );

      dailyReports.push({
        date: dateString,
        dayNumber: dailyReports.length + 1,
        totalRegistered: registeredByThisDate.length,
        presentCount: present.length,
        absentCount: absent.length,
        attendanceRate: ((present.length / registeredByThisDate.length) * 100).toFixed(2) + '%',
        present: present.map(p => ({
          name: p.name,
          email: p.email,
          track: p.track || 'N/A',
          matricNo: p.matricNo || 'N/A',
        })),
        absent: absent.map(p => ({
          name: p.name,
          email: p.email,
          track: p.track || 'N/A',
          matricNo: p.matricNo || 'N/A',
          reason: new Date(p.registeredAt) > date 
            ? 'Registered after this date' 
            : 'Did not attend',
        })),
      });
    }

    // Generate participant summary
    const participantSummary = allParticipants.map(p => {
      const participantAttendance = allAttendance.filter(a => 
        a.participantId.toString() === p._id.toString()
      );

      // Count days participant should have attended
      const regDate = new Date(p.registeredAt);
      regDate.setHours(0, 0, 0, 0);
      
      const applicableDates = attendanceDates.filter(d => d >= regDate.getTime());
      const totalDaysApplicable = applicableDates.length;
      const totalDaysPresent = participantAttendance.length;
      const totalDaysAbsent = totalDaysApplicable - totalDaysPresent;

      return {
        participantId: p._id,
        name: p.name,
        email: p.email,
        track: p.track || 'N/A',
        department: p.department || 'N/A',
        matricNo: p.matricNo || 'N/A',
        registeredAt: p.registeredAt,
        totalDaysApplicable,
        totalDaysPresent,
        totalDaysAbsent,
        attendanceRate: totalDaysApplicable > 0 
          ? ((totalDaysPresent / totalDaysApplicable) * 100).toFixed(2) + '%'
          : 'N/A',
      };
    });

    res.status(200).json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
          track: event.selectedTrack || 'No track',
          startDate: event.startDate,
          endDate: event.endDate,
        },
        eventStartDate: firstRegistrationDate,
        totalParticipants: allParticipants.length,
        totalAttendanceDays: attendanceDates.length,
        participants: participantSummary,
        dailyReports,
      },
    });
  } catch (error) {
    next(error);
  }
};



/**
 * @desc    Get daily attendance breakdown for multi-day events
 * @route   GET /api/attendance/event/:eventId/daily
 * @access  Private (Admin/Superadmin)
 */
exports.getDailyAttendance = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Get all participants
    const allParticipants = await Participant.find({ eventId, isActive: true });

    // Get attendance grouped by date
    const dailyAttendance = await Attendance.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$attendanceDate' } },
            participantId: '$participantId',
          },
          status: { $first: '$status' },
          scannedAt: { $first: '$scannedAt' },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          participants: {
            $push: {
              participantId: '$_id.participantId',
              status: '$status',
              scannedAt: '$scannedAt',
            },
          },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Calculate absentees per day
    const dailyBreakdown = dailyAttendance.map(day => {
      const attendedIds = day.participants.map(p => p.participantId.toString());
      const absentees = allParticipants.filter(
        p => !attendedIds.includes(p._id.toString())
      ).map(p => ({
        participantId: p._id,
        name: p.name,
        email: p.email,
        track: p.track,
      }));

      return {
        date: day._id,
        totalRegistered: allParticipants.length,
        presentCount: day.presentCount,
        absentCount: absentees.length,
        attendanceRate: ((day.presentCount / allParticipants.length) * 100).toFixed(2),
        attendees: day.participants,
        absentees,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
        },
        dailyBreakdown,
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

/**
 * @desc    Mark all participants as present for an event
 * @route   POST /api/attendance/mark-all-present/:eventId
 * @access  Private (Superadmin only)
 */
exports.markAllPresent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    // Verify event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Get all participants for this event
    const participants = await Participant.find({ eventId, isActive: true });

    if (participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No participants found for this event',
      });
    }

    // Check which participants already have attendance
    const existingAttendanceIds = await Attendance.find({ eventId })
      .distinct('participantId');

    // Filter out participants who already have attendance
    const participantsToMark = participants.filter(
      p => !existingAttendanceIds.some(id => id.toString() === p._id.toString())
    );

    if (participantsToMark.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All participants already marked present',
      });
    }

    // Create attendance records for all participants without attendance
    const attendanceRecords = participantsToMark.map(participant => ({
      participantId: participant._id,
      eventId,
      scannedBy: req.user.id,
      status: 'present',
      notes: 'Marked present by admin (bulk)',
      scannedAt: new Date(),
    }));

    await Attendance.insertMany(attendanceRecords);

    res.status(201).json({
      success: true,
      message: `Successfully marked ${participantsToMark.length} participants as present`,
      data: {
        totalMarked: participantsToMark.length,
        totalParticipants: participants.length,
        alreadyMarked: existingAttendanceIds.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download event participants as JSON (can be converted to CSV on frontend)
 * @route   GET /api/attendance/download/:eventId
 * @access  Private (Admin/Superadmin)
 */
exports.downloadEventData = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    // Get event details
    const event = await Event.findById(eventId).populate('createdBy', 'name email');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Get all participants with attendance status
    const participants = await Participant.find({ eventId })
      .populate('eventId', 'name date location')
      .lean();

    // Get all attendance records
    const attendanceRecords = await Attendance.find({ eventId }).lean();

    // Create attendance map for quick lookup
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.participantId.toString()] = {
        status: record.status,
        scannedAt: record.scannedAt,
        notes: record.notes,
      };
    });

    // Combine participant and attendance data
    const downloadData = participants.map(participant => {
      const attendance = attendanceMap[participant._id.toString()];
      return {
        participantId: participant._id,
        name: participant.name,
        email: participant.email,
        department: participant.department || 'N/A',
        matricNo: participant.matricNo || 'N/A',
        gender: participant.gender || 'N/A',
        track: participant.track || 'N/A',
        phoneNumber: participant.phoneNumber || 'N/A',
        registeredAt: participant.registeredAt,
        attendanceStatus: attendance ? attendance.status : 'absent',
        scannedAt: attendance ? attendance.scannedAt : null,
        attendanceNotes: attendance ? attendance.notes : '',
      };
    });

    res.status(200).json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
          date: event.date,
          location: event.location,
          createdBy: event.createdBy.name,
        },
        participants: downloadData,
        summary: {
          total: participants.length,
          present: attendanceRecords.filter(a => a.status === 'present').length,
          late: attendanceRecords.filter(a => a.status === 'late').length,
          excused: attendanceRecords.filter(a => a.status === 'excused').length,
          absent: participants.length - attendanceRecords.length,
        },
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

