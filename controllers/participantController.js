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
    console.log('📥 Step 1: Received body:', req.body);
    console.log('📥 Step 2: Received file:', req.file);
    
    const {
      name,
      email,
      department,
      matricNo,
      gender,
      eventId,
      phoneNumber,
    } = req.body;

    console.log('📥 Step 3: Destructured values:', { name, email, department, matricNo, gender, eventId, phoneNumber });

    // Handle photo if uploaded - FIX: Ensure leading slash
    let photo = null;
    if (req.file) {
      // FIX: Add leading slash to make it absolute URL
      photo = `/uploads/${req.file.filename}`;
      console.log('📥 Step 4: Photo path set to:', photo);
    }

    // Check if event exists
    console.log('🔍 Step 5: Looking for event with ID:', eventId);
    const event = await Event.findById(eventId);
    
    if (!event) {
      console.log('❌ Step 6: Event NOT found with ID:', eventId);
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    console.log('✅ Step 6: Event found:', event.name);

    // Check if event is active
    if (!event.isActive || event.isDeleted) {
      console.log('❌ Step 7: Event is not active or is deleted');
      return res.status(400).json({
        success: false,
        message: 'Event registration is closed',
      });
    }

    console.log('✅ Step 7: Event is active');

    // Check if event has terminated
    if (event.status === 'terminated' || event.status === 'cancelled') {
      console.log('❌ Step 8: Event status is:', event.status);
      return res.status(400).json({
        success: false,
        message: `This event has been ${event.status}`,
      });
    }

    console.log('✅ Step 8: Event status is valid:', event.status);

    // Check if already registered for THIS event
    console.log('🔍 Step 9: Checking if already registered');
    const existingParticipant = await Participant.findOne({ 
      email: email.toLowerCase(), 
      eventId 
    });
    
    if (existingParticipant) {
      console.log('❌ Step 10: Already registered');
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this event',
      });
    }

    console.log('✅ Step 10: Not already registered');

    // Check max participants limit
    if (event.maxParticipants) {
      console.log('🔍 Step 11: Checking participant limit. Max:', event.maxParticipants);
      const currentCount = await Participant.countDocuments({ eventId });
      console.log('📊 Current participant count:', currentCount);
      
      if (currentCount >= event.maxParticipants) {
        console.log('❌ Step 12: Event is full');
        return res.status(400).json({
          success: false,
          message: 'Event has reached maximum participant capacity',
        });
      }
    }

    console.log('✅ Step 11-12: Participant limit OK');

    // Get track from EVENT, not from participant input
    const participantTrack = event.selectedTrack || null;
    console.log('🎯 Step 13: Participant track:', participantTrack);

    // TRACK RESTRICTION CHECK (only if event has a track)
    if (participantTrack) {
      console.log('🔍 Step 14: Checking track availability for:', participantTrack);
      const trackCheck = await Participant.checkTrackAvailability(
        email.toLowerCase(),
        participantTrack,
        eventId
      );

      console.log('📊 Track check result:', trackCheck);

      if (!trackCheck.available) {
        console.log('❌ Step 15: Track not available');
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

    console.log('✅ Step 14-15: Track availability OK');

    // Create participant
    console.log('💾 Step 16: Creating participant with data:', {
      name,
      email: email.toLowerCase(),
      photo,
      department,
      matricNo,
      gender,
      track: participantTrack,
      currentActiveTrack: participantTrack || null,
      currentActiveTrackEvent: participantTrack ? eventId : null,
      eventId,
      phoneNumber,
    });

    const participant = await Participant.create({
      name,
      email: email.toLowerCase(),
      photo,
      department,
      matricNo,
      gender,
      track: participantTrack,
      currentActiveTrack: participantTrack || null,
      currentActiveTrackEvent: participantTrack ? eventId : null,
      eventId,
      phoneNumber,
    });

    console.log('✅ Step 17: Participant created with ID:', participant._id);

    // Generate QR code
    console.log('🔄 Step 18: Generating QR code');
    const qrCode = await generateQRCode(participant._id.toString());
    participant.qrCode = qrCode;
    await participant.save();

    console.log('✅ Step 19: QR code generated and saved');

    // Send QR code via email
    console.log('📧 Step 20: Attempting to send email to:', email);
    try {
      await sendQRCodeEmail({
        to: email,
        name,
        eventName: event.name,
        qrCode,
        eventDate: event.date,
        eventLocation: event.location,
      });
      console.log('✅ Step 21: Email sent successfully');
    } catch (emailError) {
      console.error('❌ Step 21: Email sending failed:', emailError);
    }

    console.log('🎉 Step 22: Registration complete, sending response');

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
          photo: participant.photo,
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
    console.error('💥 REGISTRATION ERROR:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      console.error('Validation errors:', errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors,
      });
    }
    
    // Handle mongoose cast errors (invalid ObjectId)
    if (error.name === 'CastError') {
      console.error('Cast error on field:', error.path);
      return res.status(400).json({
        success: false,
        message: `Invalid ${error.path}`,
      });
    }
    
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