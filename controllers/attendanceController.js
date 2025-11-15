const Attendance = require('../models/Attendance');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const { validateQRData } = require('../utils/qrGenerator');
const EventPermission = require('../models/EventPermission');

/**
 * @desc    Verify QR code and fetch participant details (NO ATTENDANCE MARKING)
 * @route   POST /api/attendance/verify-qr
 * @access  Private (Event Creator, Granted Admins, or Superadmin)
 */
exports.verifyQRCode = async (req, res, next) => {
  try {
    const { participantId, eventId } = req.body;
    const scannerId = req.user.id;
    const scannerRole = req.user.role;

    if (!validateQRData(participantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data',
      });
    }

    const participant = await Participant.findById(participantId)
      .populate('eventId', 'name date location startDate endDate status isActive isDeleted createdBy');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    if (!participant.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Participant registration is inactive',
      });
    }

    const event = participant.eventId;

    if (!event.isActive || event.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'This event is no longer active',
      });
    }
    
    if (event.status === 'terminated' || event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `This event has been ${event.status}`,
      });
    }
    
    const now = new Date();
    if (event.endDate && now > event.endDate) {
      return res.status(400).json({
        success: false,
        message: 'This event has ended. QR code is no longer valid.',
      });
    }
    
    if (eventId && event._id.toString() !== eventId) {
      return res.status(400).json({
        success: false,
        message: 'Participant is not registered for this event',
      });
    }

    let hasPermission = false;
    if (scannerRole === 'superadmin') {
      hasPermission = true;
    } else if (event.createdBy.toString() === scannerId) {
      hasPermission = true;
    } else {
      hasPermission = await EventPermission.hasPermission(scannerId, event._id, 'canScan');
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to scan attendance for this event',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      participantId,
      eventId: event._id,
      attendanceDate: today,
    });

    const photoDataUri = (participant.photo && participant.photo.data)
      ? `data:${participant.photo.contentType};base64,${participant.photo.data.toString('base64')}`
      : null;

    res.status(200).json({
      success: true,
      message: 'QR code verified successfully',
      data: {
        participant: {
          id: participant._id,
          name: participant.name,
          email: participant.email,
          photo: photoDataUri,
          department: participant.department,
          matricNo: participant.matricNo,
          gender: participant.gender,
          track: participant.track,
          phoneNumber: participant.phoneNumber,
        },
        event: {
          id: event._id,
          name: event.name,
          date: event.date,
          location: event.location,
        },
        alreadyMarked: !!existingAttendance,
        existingAttendance: existingAttendance ? {
          scannedAt: existingAttendance.scannedAt,
          status: existingAttendance.status,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark attendance after verification
 * @route   POST /api/attendance/mark-present
 * @access  Private (Event Creator, Granted Admins, or Superadmin)
 */
exports.markPresent = async (req, res, next) => {
  try {
    const { participantId, eventId, notes } = req.body;
    const scannerId = req.user.id;
    const scannerRole = req.user.role;

    if (!validateQRData(participantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid participant ID',
      });
    }

    const participant = await Participant.findById(participantId)
      .populate('eventId', 'name date location startDate endDate status isActive isDeleted createdBy');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    if (!participant.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Participant registration is inactive',
      });
    }

    const event = participant.eventId;

    if (eventId && event._id.toString() !== eventId) {
      return res.status(400).json({
        success: false,
        message: 'Participant is not registered for this event',
      });
    }

    let hasPermission = false;
    if (scannerRole === 'superadmin') {
      hasPermission = true;
    } else if (event.createdBy.toString() === scannerId) {
      hasPermission = true;
    } else {
      hasPermission = await EventPermission.hasPermission(scannerId, event._id, 'canScan');
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to mark attendance for this event',
      });
    }

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

    const attendance = await Attendance.create({
      participantId,
      eventId: event._id,
      scannedBy: scannerId,
      notes,
      status: 'present',
      attendanceDate: today,
    });

    const photoDataUri = (participant.photo && participant.photo.data)
      ? `data:${participant.photo.contentType};base64,${participant.photo.data.toString('base64')}`
      : null;

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        attendance,
        participant: {
          id: participant._id,
          name: participant.name,
          email: participant.email,
          photo: photoDataUri,
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
    const { page = 1, limit = 20, status, sortBy = '-scannedAt', date } = req.query;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const query = { eventId };
    if (status) {
      query.status = status;
    }
    
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      query.attendanceDate = targetDate;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const attendance = await Attendance.find(query)
      .populate('participantId', 'name email photo department matricNo gender track phoneNumber')
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
      .populate('participantId', 'name email photo department matricNo gender track phoneNumber')
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
      .populate('participantId', 'name email photo department matricNo gender track phoneNumber')
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

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const allParticipants = await Participant.find({ eventId, isActive: true });
    const totalRegistered = allParticipants.length;

    const totalsAgg = await Attendance.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totals = {
      totalRegistered,
      present: 0,
      late: 0,
      excused: 0,
    };

    totalsAgg.forEach((t) => {
      totals[t._id] = t.count;
    });

    const totalScanned = totals.present + totals.late + totals.excused;
    totals.absent = totalRegistered - totalScanned;
    totals.totalScanned = totalScanned;

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
      phoneNumber: p.phoneNumber,
    }));

    const safeTotal = totalRegistered || 1;
    const percentages = {
      presentPct: parseFloat(((totals.present / safeTotal) * 100).toFixed(2)),
      latePct: parseFloat(((totals.late / safeTotal) * 100).toFixed(2)),
      excusedPct: parseFloat(((totals.excused / safeTotal) * 100).toFixed(2)),
      absentPct: parseFloat(((totals.absent / safeTotal) * 100).toFixed(2)),
      attendanceRate: parseFloat(((totalScanned / safeTotal) * 100).toFixed(2)),
    };

    const byDate = await Attendance.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$attendanceDate' },
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
 * ============================================================================
 * CRITICAL FIX: Multi-day attendance tracking with late registration support
 * ============================================================================
 * @desc    Get downloadable attendance report with COMPLETE multi-day tracking
 * @route   GET /api/attendance/event/:eventId/download-report
 * @access  Private (Admin/Superadmin)
 */
exports.getDownloadableReport = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Get ALL active participants for this event
    const allParticipants = await Participant.find({ eventId, isActive: true })
      .select('name email track matricNo registeredAt phoneNumber department')
      .lean();

    if (allParticipants.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No participants registered for this event yet',
        data: {
          event: {
            name: event.name,
            track: event.selectedTrack || null,
            startDate: event.startDate,
            endDate: event.endDate,
            eventType: event.eventType || 'general',
          },
          attendanceRecords: [],
        },
      });
    }

    // CRITICAL: Determine the event start date
    // This is the FIRST day we start tracking attendance
    const eventStartDate = new Date(event.startDate);
    eventStartDate.setHours(0, 0, 0, 0);

    // Get ALL attendance records for this event (all days)
    const allAttendance = await Attendance.find({ eventId })
      .select('participantId attendanceDate status scannedAt')
      .lean();

    // Create a Map for fast lookup: "participantId_YYYY-MM-DD" => attendance record
    const attendanceMap = new Map();
    for (const record of allAttendance) {
      const dateStr = new Date(record.attendanceDate).toISOString().split('T')[0];
      const key = `${record.participantId}_${dateStr}`;
      attendanceMap.set(key, record);
    }

    // Determine which days to track
    // From event start date to TODAY (or event end date if event has ended)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const eventEndDate = event.endDate ? new Date(event.endDate) : today;
    eventEndDate.setHours(0, 0, 0, 0);
    
    // The last day to track is the earlier of: today or event end date
    const lastDayToTrack = today < eventEndDate ? today : eventEndDate;

    // Generate ALL dates from event start to last tracking day
    const allDates = [];
    const currentDate = new Date(eventStartDate);
    while (currentDate <= lastDayToTrack) {
      allDates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // CRITICAL: Build attendance records for EVERY participant for EVERY day
    const attendanceRecords = [];

    for (const participant of allParticipants) {
      const participantRegDate = new Date(participant.registeredAt);
      participantRegDate.setHours(0, 0, 0, 0);

      for (const date of allDates) {
        const dateStr = date.toISOString().split('T')[0];
        
        // Check if participant was registered by this date
        const wasRegistered = participantRegDate <= date;

        if (!wasRegistered) {
          // Participant registered AFTER this date - mark as "Not registered yet"
          attendanceRecords.push({
            eventName: event.name,
            eventType: event.eventType || 'general',
            track: event.selectedTrack || 'N/A',
            participantName: participant.name,
            phoneNumber: participant.phoneNumber || 'N/A',
            matricNo: participant.matricNo || 'N/A',
            department: participant.department || 'N/A',
            status: 'Absent',
            date: dateStr,
            scannedAt: null,
            reason: 'Not registered yet',
          });
        } else {
          // Participant WAS registered by this date
          const lookupKey = `${participant._id}_${dateStr}`;
          const attendanceRecord = attendanceMap.get(lookupKey);

          if (attendanceRecord) {
            // They attended this day
            attendanceRecords.push({
              eventName: event.name,
              eventType: event.eventType || 'general',
              track: event.selectedTrack || 'N/A',
              participantName: participant.name,
              phoneNumber: participant.phoneNumber || 'N/A',
              matricNo: participant.matricNo || 'N/A',
              department: participant.department || 'N/A',
              status: 'Present',
              date: dateStr,
              scannedAt: attendanceRecord.scannedAt,
              reason: null,
            });
          } else {
            // They did NOT attend this day - mark as absent
            attendanceRecords.push({
              eventName: event.name,
              eventType: event.eventType || 'general',
              track: event.selectedTrack || 'N/A',
              participantName: participant.name,
              phoneNumber: participant.phoneNumber || 'N/A',
              matricNo: participant.matricNo || 'N/A',
              department: participant.department || 'N/A',
              status: 'Absent',
              date: dateStr,
              scannedAt: null,
              reason: 'Did not attend',
            });
          }
        }
      }
    }

    // Calculate summary statistics
    const totalPresent = attendanceRecords.filter(r => r.status === 'Present').length;
    const totalAbsent = attendanceRecords.filter(r => r.status === 'Absent').length;
    const totalRecords = attendanceRecords.length;

    res.status(200).json({
      success: true,
      data: {
        event: {
          name: event.name,
          track: event.selectedTrack || null,
          eventStartDate: eventStartDate,
          eventEndDate: event.endDate || null,
          totalDays: allDates.length,
          eventType: event.eventType || 'general',
        },
        summary: {
          totalParticipants: allParticipants.length,
          totalPresent,
          totalAbsent,
          totalRecords,
          attendanceRate: totalRecords > 0 
            ? ((totalPresent / totalRecords) * 100).toFixed(2) + '%' 
            : '0%',
        },
        attendanceRecords,
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
    const { date } = req.query;

    const event = await Event.findById(eventId).select('name startDate endDate');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    if (!event.startDate || !event.endDate) {
      return res.status(400).json({
        success: false,
        message: 'This is not a multi-day event. Use a different report.',
      });
    }

    const allParticipants = await Participant.find({ eventId, isActive: true })
      .select('name email track phoneNumber registeredAt')
      .lean();

    const allAttendanceRecords = await Attendance.find({ eventId })
      .select('participantId attendanceDate scannedAt status')
      .lean();

    const attendanceMap = new Map();
    for (const record of allAttendanceRecords) {
      const dateStr = record.attendanceDate.toISOString().split('T')[0];
      const key = `${record.participantId}_${dateStr}`;
      attendanceMap.set(key, {
        scannedAt: record.scannedAt,
        status: record.status,
      });
    }

    let reportStartDate = new Date(event.startDate);
    let reportEndDate = new Date(event.endDate);

    if (date) {
      const requestedDate = new Date(date + 'T00:00:00Z');

      if (requestedDate < reportStartDate || requestedDate > reportEndDate) {
        return res.status(400).json({
          success: false,
          message: 'Requested date is not within the event duration.',
        });
      }

      reportStartDate = requestedDate;
      reportEndDate = requestedDate;
    }

    const dailyBreakdown = [];
    const currentDate = new Date(reportStartDate);

    while (currentDate <= reportEndDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      const attendees = [];
      const absentees = [];
      let totalRegisteredForThisDay = 0;

      for (const participant of allParticipants) {
        const registeredDate = new Date(participant.registeredAt);
        registeredDate.setUTCHours(0, 0, 0, 0);

        if (registeredDate > currentDate) {
          continue;
        }

        totalRegisteredForThisDay++;
        
        const lookupKey = `${participant._id}_${dateStr}`;
        const attendanceRecord = attendanceMap.get(lookupKey);

        if (attendanceRecord) {
          attendees.push({
            participantId: participant._id,
            name: participant.name,
            email: participant.email,
            status: attendanceRecord.status,
            scannedAt: attendanceRecord.scannedAt,
          });
        } else {
          absentees.push({
            participantId: participant._id,
            name: participant.name,
            email: participant.email,
            track: participant.track,
            phoneNumber: participant.phoneNumber,
          });
        }
      }

      dailyBreakdown.push({
        date: dateStr,
        totalRegistered: totalRegisteredForThisDay,
        presentCount: attendees.length,
        absentCount: absentees.length,
        attendanceRate: (totalRegisteredForThisDay > 0) 
          ? ((attendees.length / totalRegisteredForThisDay) * 100).toFixed(2) 
          : "0.00",
        attendees: attendees,
        absentees: absentees,
      });

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

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
 * @desc    Download event participants as JSON
 * @route   GET /api/attendance/download/:eventId
 * @access  Private (Admin/Superadmin)
 */
exports.downloadEventData = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate('createdBy', 'name email');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const participants = await Participant.find({ eventId })
      .populate('eventId', 'name date location')
      .lean();

    const attendanceRecords = await Attendance.find({ eventId }).lean();

    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.participantId.toString()] = {
        status: record.status,
        scannedAt: record.scannedAt,
        notes: record.notes,
      };
    });

    const downloadData = participants.map(participant => {
      const attendance = attendanceMap[participant._id.toString()];
      return {
        participantId: participant._id,
        name: participant.name,
        email: participant.email,
        phoneNumber: participant.phoneNumber || 'N/A',
        department: participant.department || 'N/A',
        matricNo: participant.matricNo || 'N/A',
        gender: participant.gender || 'N/A',
        track: participant.track || 'N/A',
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
          eventType: event.eventType || 'general',
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