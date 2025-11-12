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
      return res.status(400).json({ success: false, message: 'Invalid QR code data' });
    }

    // Find participant and populate their event
    const participant = await Participant.findById(participantId)
        .populate('eventId', 'name date location startDate endDate status isActive isDeleted createdBy');

    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }
    
    if (!participant.isActive) {
      return res.status(400).json({ success: false, message: 'Participant registration is inactive' });
    }
    const event = participant.eventId;
    if (!event.isActive || event.isDeleted) {
      return res.status(400).json({ success: false, message: 'This event is no longer active' });
    }
    if (event.status === 'terminated' || event.status === 'cancelled') {
      return res.status(400).json({ success: false, message: `This event has been ${event.status}` });
    }
    const now = new Date();
    if (event.endDate && now > event.endDate) {
      return res.status(400).json({ success: false, message: 'This event has ended. QR code is no longer valid.' });
    }
    if (eventId && event._id.toString() !== eventId) {
      return res.status(400).json({ success: false, message: 'Participant is not registered for this event' });
    }

    let hasPermission = false;
    if (scannerRole === 'superadmin') hasPermission = true;
    else if (event.createdBy.toString() === scannerId) hasPermission = true;
    else hasPermission = await EventPermission.hasPermission(scannerId, event._id, 'canScan');

    if (!hasPermission) {
      return res.status(403).json({ success: false, message: 'You do not have permission to scan attendance for this event' });
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

    // Create attendance record
    const attendance = await Attendance.create({
      participantId,
      eventId: event._id,
      scannedBy: scannerId,
      notes,
      status: 'present',
      attendanceDate: today,
    });
    
    // Convert the participant's photo buffer to a Base64 string for the response
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
 * @desc    Verify QR code and fetch participant details (NO ATTENDANCE MARKING)
 * @route   POST /api/attendance/verify-qr
 * @access  Private (Event Creator, Granted Admins, or Superadmin)
 */
exports.verifyQRCode = async (req, res, next) => {
  try {
    const { participantId, eventId } = req.body;
    const scannerId = req.user.id;
    const scannerRole = req.user.role;

    // Validate QR data
    if (!validateQRData(participantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data',
      });
    }

    // Find participant and populate their event
    const participant = await Participant.findById(participantId)
      .populate('eventId', 'name date location startDate endDate status isActive isDeleted createdBy');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    // ===== CRITICAL: Check if participant is active =====
    if (!participant.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Participant registration is inactive',
      });
    }

    const event = participant.eventId;

    // ===== CRITICAL: Validate event status =====
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

    // ===== CRITICAL: Check scanner permissions =====
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

    // Check if already marked attendance TODAY
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      participantId,
      eventId: event._id,
      attendanceDate: today,
    });

    // Convert photo buffer to Base64 data URI
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

    // Validate QR data
    if (!validateQRData(participantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid participant ID',
      });
    }

    // Find participant and populate their event
    const participant = await Participant.findById(participantId)
      .populate('eventId', 'name date location startDate endDate status isActive isDeleted createdBy');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    // ===== CRITICAL: Check if participant is active =====
    if (!participant.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Participant registration is inactive',
      });
    }

    const event = participant.eventId;

    // Verify event match
    if (eventId && event._id.toString() !== eventId) {
      return res.status(400).json({
        success: false,
        message: 'Participant is not registered for this event',
      });
    }

    // ===== CRITICAL: Check scanner permissions =====
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

    // Convert photo buffer to Base64 data URI
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
 * @desc    Get all attendance records for an event (ALL DAYS, NOT JUST TODAY)
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

    // Build query
    const query = { eventId };
    if (status) {
      query.status = status;
    }
    
    // FIXED: Allow filtering by specific date if provided, otherwise get ALL records
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
 * @desc    Get downloadable attendance report (FIXED WITH PHONE NUMBERS & CONDITIONAL FIELDS)
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

    // FIXED: Include phoneNumber in selection
    const allParticipants = await Participant.find({ eventId, isActive: true })
      .select('name email track matricNo registeredAt phoneNumber')
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
            eventType: event.eventType || 'general', // For conditional CSV fields
          },
          attendanceRecords: [],
        },
      });
    }

    const firstRegistrationDate = new Date(
      Math.min(...allParticipants.map(p => new Date(p.registeredAt)))
    );
    firstRegistrationDate.setHours(0, 0, 0, 0);

    // FIXED: Include attendanceDate in selection
    const allAttendance = await Attendance.find({ eventId })
      .select('participantId attendanceDate status scannedAt')
      .lean();

    const attendanceDates = [...new Set(
      allAttendance.map(a => {
        const d = new Date(a.attendanceDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    )].sort((a, b) => a - b);

    if (attendanceDates.length === 0) {
      // FIXED: Include phoneNumber even when no attendance
      const records = allParticipants.map(p => ({
        eventName: event.name,
        eventType: event.eventType || 'general',
        track: event.selectedTrack || 'N/A',
        participantName: p.name,
        phoneNumber: p.phoneNumber || 'N/A',
        matricNo: p.matricNo || 'N/A',
        status: 'Absent',
        date: firstRegistrationDate.toISOString().split('T')[0],
        reason: 'No attendance recorded yet',
      }));

      return res.status(200).json({
        success: true,
        data: {
          event: {
            name: event.name,
            track: event.selectedTrack || null,
            eventStartDate: firstRegistrationDate,
            eventType: event.eventType || 'general',
          },
          summary: {
            totalParticipants: allParticipants.length,
            totalPresent: 0,
            totalAbsent: allParticipants.length,
          },
          attendanceRecords: records,
        },
      });
    }

    // FIXED: Include phoneNumber in all records
    const attendanceRecords = [];

    for (const dateTimestamp of attendanceDates) {
      const date = new Date(dateTimestamp);
      const dateString = date.toISOString().split('T')[0];

      const registeredByThisDate = allParticipants.filter(p => {
        const regDate = new Date(p.registeredAt);
        regDate.setHours(0, 0, 0, 0);
        return regDate <= date;
      });

      const dateAttendance = allAttendance.filter(a => {
        const attDate = new Date(a.attendanceDate);
        attDate.setHours(0, 0, 0, 0);
        return attDate.getTime() === dateTimestamp;
      });

      const attendedIds = dateAttendance.map(a => a.participantId.toString());

      for (const participant of registeredByThisDate) {
        const didAttend = attendedIds.includes(participant._id.toString());
        const attendanceRecord = dateAttendance.find(
          a => a.participantId.toString() === participant._id.toString()
        );

        attendanceRecords.push({
          eventName: event.name,
          eventType: event.eventType || 'general',
          track: event.selectedTrack || 'N/A',
          participantName: participant.name,
          phoneNumber: participant.phoneNumber || 'N/A', // FIXED: Always include
          matricNo: participant.matricNo || 'N/A',
          status: didAttend ? 'Present' : 'Absent',
          date: dateString,
          scannedAt: didAttend && attendanceRecord 
            ? attendanceRecord.scannedAt 
            : null,
          reason: !didAttend 
            ? (new Date(participant.registeredAt) > date 
                ? 'Not registered yet' 
                : 'Did not attend')
            : null,
        });
      }
    }

    const totalPresent = attendanceRecords.filter(r => r.status === 'Present').length;
    const totalAbsent = attendanceRecords.filter(r => r.status === 'Absent').length;

    res.status(200).json({
      success: true,
      data: {
        event: {
          name: event.name,
          track: event.selectedTrack || null,
          eventStartDate: firstRegistrationDate,
          totalDays: attendanceDates.length,
          eventType: event.eventType || 'general', // FIXED: For conditional CSV export
        },
        summary: {
          totalParticipants: allParticipants.length,
          totalPresent,
          totalAbsent,
          attendanceRate: ((totalPresent / (totalPresent + totalAbsent)) * 100).toFixed(2) + '%',
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

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // FIXED: Include phoneNumber
    const allParticipants = await Participant.find({ eventId, isActive: true })
      .select('name email track matricNo phoneNumber');

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

    const dailyBreakdown = dailyAttendance.map(day => {
      const attendedIds = day.participants.map(p => p.participantId.toString());
      const absentees = allParticipants.filter(
        p => !attendedIds.includes(p._id.toString())
      ).map(p => ({
        participantId: p._id,
        name: p.name,
        email: p.email,
        track: p.track,
        phoneNumber: p.phoneNumber,
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
 * @desc    Mark all participants as present for an event (WITH REVOCATION TRACKING)
 * @route   POST /api/attendance/mark-all-present/:eventId
 * @access  Private (Superadmin only)
 */
exports.markAllPresent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const participants = await Participant.find({ eventId, isActive: true });

    if (participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No participants found for this event',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.find({ 
      eventId,
      attendanceDate: today 
    });
    const existingAttendanceIds = existingAttendance.map(a => a.participantId.toString());

    const participantsToMark = participants.filter(
      p => !existingAttendanceIds.includes(p._id.toString())
    );

    if (participantsToMark.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All participants already marked present for today',
      });
    }

    const attendanceRecords = participantsToMark.map(participant => ({
      participantId: participant._id,
      eventId,
      scannedBy: req.user.id,
      status: 'present',
      notes: 'BULK_MARKED_PRESENT',
      attendanceDate: today,
      scannedAt: new Date(),
    }));

    await Attendance.insertMany(attendanceRecords);

    // Return updated counts
    const totalPresent = existingAttendanceIds.length + participantsToMark.length;
    const totalAbsent = participants.length - totalPresent;

    res.status(201).json({
      success: true,
      message: `Successfully marked ${participantsToMark.length} participants as present for today`,
      data: {
        totalMarked: participantsToMark.length,
        totalParticipants: participants.length,
        alreadyMarked: existingAttendanceIds.length,
        date: today.toISOString().split('T')[0],
        updatedStats: {
          totalRegistered: participants.length,
          present: totalPresent,
          absent: totalAbsent,
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Revoke "Mark All Present" action (NEW ENDPOINT)
 * @route   POST /api/attendance/revoke-mark-all/:eventId
 * @access  Private (Superadmin only)
 */
exports.revokeMarkAllPresent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { date } = req.body; // Optional: specific date to revoke, defaults to today

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Determine which date to revoke
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Find all bulk-marked attendance for this date
    const bulkMarkedRecords = await Attendance.find({
      eventId,
      attendanceDate: targetDate,
      notes: 'BULK_MARKED_PRESENT',
    });

    if (bulkMarkedRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No bulk-marked attendance found for this date',
      });
    }

    // Delete only the bulk-marked records (preserves individually scanned ones)
    const deletedCount = await Attendance.deleteMany({
      eventId,
      attendanceDate: targetDate,
      notes: 'BULK_MARKED_PRESENT',
    });

    res.status(200).json({
      success: true,
      message: `Successfully revoked bulk attendance marking for ${deletedCount.deletedCount} participants`,
      data: {
        revokedCount: deletedCount.deletedCount,
        date: targetDate.toISOString().split('T')[0],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download event participants as JSON (FIXED WITH PHONE NUMBERS)
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

    // FIXED: Include phoneNumber in populate
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

    // FIXED: Include phoneNumber in download data
    const downloadData = participants.map(participant => {
      const attendance = attendanceMap[participant._id.toString()];
      return {
        participantId: participant._id,
        name: participant.name,
        email: participant.email,
        phoneNumber: participant.phoneNumber || 'N/A', // FIXED
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
          eventType: event.eventType || 'general', // For conditional CSV fields
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