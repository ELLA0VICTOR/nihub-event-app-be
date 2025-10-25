const Participant = require('../models/Participant');
const Event = require('../models/Event');
const { generateQRCode } = require('../utils/qrGenerator');
const { sendQRCodeEmail } = require('../utils/mailSender');

/**
 * @desc    Register participant for event
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
      track,
      eventId,
      phoneNumber,
    } = req.body;

    // Handle photo if uploaded
    let photo = null;
    if (req.file) {
      photo = req.file.path; // Save file path
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
    if (!event.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Event registration is closed',
      });
    }

    // Check if already registered
    const existingParticipant = await Participant.findOne({ email, eventId });
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

    // Validate track exists in event
    if (track && event.tracks && event.tracks.length > 0) {
      const trackExists = event.tracks.some(t => 
        t.trackAbbreviation === track || t.trackName === track
      );
      if (!trackExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid track selected for this event',
        });
      }
    }

    // Create participant
    const participant = await Participant.create({
      name,
      email,
      photo,
      department,
      matricNo,
      gender,
      track,
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
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! QR code sent to your email.',
      data: {
        participant: {
          id: participant._id,
          name: participant.name,
          email: participant.email,
          eventId: participant.eventId,
          qrCode: participant.qrCode,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all participants for an event
 * @route   GET /api/participants/event/:eventId
 * @access  Private (Admin/Superadmin)
 */
exports.getEventParticipants = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 20, search, gender, department } = req.query;

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

    // Pagination
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

/**
 * @desc    Get single participant
 * @route   GET /api/participants/:id
 * @access  Private (Admin/Superadmin)
 */
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

/**
 * @desc    Update participant
 * @route   PUT /api/participants/:id
 * @access  Private (Admin/Superadmin)
 */
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

/**
 * @desc    Delete participant
 * @route   DELETE /api/participants/:id
 * @access  Private (Superadmin only)
 */
exports.deleteParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found',
      });
    }

    await participant.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Participant deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend QR code to participant
 * @route   POST /api/participants/:id/resend-qr
 * @access  Private (Admin/Superadmin)
 */
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

    // Send QR code via email
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