const Participant = require('../models/Participant');
const Event = require('../models/Event');
const { generateQRCode } = require('../utils/qrGenerator');
const { sendQRCodeEmail } = require('../utils/mailSender');

/**
 * @desc    Register participant for event (FIXED - Photo path corrected)
 * @route   POST /api/participants/register
 * @access  Public
 */
exports.registerParticipant = async (req, res, next) => {
  try {
    const {
      name,
      email,
      department,
      matricNo,
      gender,
      eventId,
      phoneNumber,
    } = req.body;

    // Handle photo if uploaded - FIX: Ensure leading slash
    let photo = null;
    if (req.file) {
      // FIX: Add leading slash to make it absolute URL
      photo = `/uploads/${req.file.filename}`;
    }

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    // Check if event is active
    if (!event.isActive || event.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Event registration is closed',
      });
    }

    // Check if event has terminated
    if (event.status === 'terminated' || event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `This event has been ${event.status}`,
      });
    }

    // Check if already registered for THIS event
    const existingParticipant = await Participant.findOne({ 
      email: email.toLowerCase(), 
      eventId 
    });
    
    if (existingParticipant) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this event',
      });
    }

    // Check max participants limit
    if (event.maxParticipants) {
      const currentCount = await Participant.countDocuments({ eventId });
      if (currentCount >= event.maxParticipants) {
        return res.status(400).json({
          success: false,
          message: 'Event has reached maximum participant capacity',
        });
      }
    }

    // Get track from EVENT, not from participant input
    const participantTrack = event.selectedTrack || null;

    // TRACK RESTRICTION CHECK (only if event has a track)
    if (participantTrack) {
      const trackCheck = await Participant.checkTrackAvailability(
        email.toLowerCase(),
        participantTrack,
        eventId
      );

      if (!trackCheck.available) {
        return res.status(400).json({
          success: false,
          message: `You are already registered for another track-based event: ${trackCheck.currentTrack}. Please contact an admin to remove you from that track before registering for this one.`,
          data: {
            currentTrack: trackCheck.currentTrack,
            currentEventId: trackCheck.currentEvent,
          },
        });
      }
    }

    // Create participant
    const participant = await Participant.create({
      name,
      email: email.toLowerCase(),
      photo, // Now has leading slash
      department,
      matricNo,
      gender,
      track: participantTrack,
      currentActiveTrack: participantTrack || null,
      currentActiveTrackEvent: participantTrack ? eventId : null,
      eventId,
      phoneNumber,
    });

    // Generate QR code
    const qrCode = await generateQRCode(participant._id.toString());
    participant.qrCode = qrCode;
    await participant.save();

    // Send QR code via email
    try {
      await sendQRCodeEmail({
        to: email,
        name,
        eventName: event.name,
        qrCode,
        eventDate: event.date,
        eventLocation: event.location,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    res.status(201).json({
      success: true,
      message: participantTrack 
        ? `Registration successful for ${event.name} - ${participantTrack} track! QR code sent to your email.`
        : `Registration successful for ${event.name}! QR code sent to your email.`,
      data: {
        participant: {
          id: participant._id,
          name: participant.name,
          email: participant.email,
          track: participant.track,
          eventId: participant.eventId,
          qrCode: participant.qrCode,
          photo: participant.photo, // This will now have the correct path
        },
        event: {
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          duration: event.duration,
          track: participantTrack,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ... rest of your controller methods remain the same ...

exports.getEventParticipants = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 20, search, gender, department } = req.query;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    const query = { eventId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { matricNo: { $regex: search, $options: 'i' } },
      ];
    }

    if (gender) {
      query.gender = gender;
    }

    if (department) {
      query.department = { $regex: department, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const participants = await Participant.find(query)
      .populate('eventId', 'name date location')
      .sort('-registeredAt')
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Participant.countDocuments(query);

    res.status(200).json({
      success: true,
      count: participants.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: {
        participants,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id)
      .populate('eventId', 'name date location');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        participant,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateParticipant = async (req, res, next) => {
  try {
    const {
      name,
      email,
      photo,
      department,
      matricNo,
      gender,
      track,
      phoneNumber,
      isActive,
    } = req.body;

    let participant = await Participant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    participant = await Participant.findByIdAndUpdate(
      req.params.id,
      {
        name,
        email,
        photo,
        department,
        matricNo,
        gender,
        track,
        phoneNumber,
        isActive,
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('eventId', 'name date location');

    res.status(200).json({
      success: true,
      message: 'Participant updated successfully',
      data: {
        participant,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id).populate('eventId');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    const event = participant.eventId;
    const userId = req.user.id;
    const userRole = req.user.role;

    let hasPermission = false;

    if (userRole === 'superadmin') {
      hasPermission = true;
    } else if (event.createdBy.toString() === userId) {
      hasPermission = true;
    } else {
      hasPermission = await EventPermission.hasPermission(userId, event._id, 'canEdit');
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete participants from this event',
      });
    }

    await Participant.updateMany(
      {
        email: participant.email,
        currentActiveTrackEvent: event._id,
      },
      {
        $set: {
          currentActiveTrack: null,
          currentActiveTrackEvent: null,
        },
      }
    );

    await participant.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Participant deleted successfully. They can now register for another track if needed.',
    });
  } catch (error) {
    next(error);
  }
};

exports.checkTrackEligibility = async (req, res, next) => {
  try {
    const { email, trackName, eventId } = req.body;

    if (!email || !eventId) {
      return res.status(400).json({
        success: false,
        message: 'Email and event ID are required',
      });
    }

    if (!trackName) {
      return res.status(200).json({
        success: true,
        data: {
          canRegister: true,
          message: 'No track restrictions apply',
        },
      });
    }

    const trackCheck = await Participant.checkTrackAvailability(
      email.toLowerCase(),
      trackName,
      eventId
    );

    if (trackCheck.available) {
      return res.status(200).json({
        success: true,
        data: {
          canRegister: true,
          message: 'You can register for this track',
        },
      });
    }

    const currentEvent = await Event.findById(trackCheck.currentEvent);

    res.status(200).json({
      success: true,
      data: {
        canRegister: false,
        message: `You are currently enrolled in ${trackCheck.currentTrack}`,
        currentTrack: trackCheck.currentTrack,
        currentEvent: {
          id: currentEvent._id,
          name: currentEvent.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.resendQRCode = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id)
      .populate('eventId', 'name date location');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    await sendQRCodeEmail({
      to: participant.email,
      name: participant.name,
      eventName: participant.eventId.name,
      qrCode: participant.qrCode,
      eventDate: participant.eventId.date,
      eventLocation: participant.eventId.location,
    });

    res.status(200).json({
      success: true,
      message: 'QR code sent successfully',
    });
  } catch (error) {
    next(error);
  }
};