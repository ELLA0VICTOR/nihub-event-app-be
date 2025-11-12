const Participant = require('../models/Participant');
const Event = require('../models/Event');
const { generateQRCode } = require('../utils/qrGenerator');
const { sendQRCodeEmail } = require('../utils/mailSender');

/**
 * @desc    Register participant for event (FIXED - All issues resolved)
 * @route   POST /api/participants/register
 * @access  Public
 */
exports.registerParticipant = async (req, res, next) => {
  try {
    console.log('📥 Step 1: Received body:', req.body);
    console.log('📥 Step 2: Received file:', req.file ? `(File: ${req.file.mimetype}, Size: ${req.file.size})` : '(No file)');
    
    const {
      name,
      email,
      department,
      matricNo,
      gender,
      eventId,
      phoneNumber,
    } = req.body;

    console.log('📥 Step 3: Destructured values:', { 
      name, email, department, matricNo, gender, eventId, phoneNumber 
    });

    // VALIDATION: Check required fields
    if (!name || !email || !gender || !eventId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields. Name, email, gender, phone number, and event ID are required.',
        // ... (rest of your errors array)
      });
    }

    // Handle photo from req.file
    let photo = {};
    if (req.file) {
      photo.data = req.file.buffer;
      photo.contentType = req.file.mimetype;
      console.log('📥 Step 4: Photo data captured from buffer');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Photo is required for registration',
      });
    }

    // ... (Steps 5-15: All your event and track validation logic remains exactly the same) ...

    console.log('🔍 Step 5: Looking for event with ID:', eventId);
    const event = await Event.findById(eventId);
    
    if (!event) {
      console.log('❌ Step 6: Event NOT found with ID:', eventId);
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    console.log('✅ Step 6: Event found:', event.name);

    if (!event.isActive || event.isDeleted) {
      return res.status(400).json({ success: false, message: 'Event registration is closed' });
    }
    console.log('✅ Step 7: Event is active');

    if (event.status === 'terminated' || event.status === 'cancelled') {
      return res.status(400).json({ success: false, message: `This event has been ${event.status}` });
    }
    console.log('✅ Step 8: Event status is valid:', event.status);

    const existingParticipant = await Participant.findOne({ email: email.toLowerCase(), eventId });
    if (existingParticipant) {
      return res.status(400).json({ success: false, message: 'You are already registered for this event' });
    }
    console.log('✅ Step 10: Not already registered');

    if (event.maxParticipants) {
      console.log('🔍 Step 11: Checking participant limit. Max:', event.maxParticipants);
      const currentCount = await Participant.countDocuments({ eventId });
      console.log('📊 Current participant count:', currentCount);
      if (currentCount >= event.maxParticipants) {
        return res.status(400).json({ success: false, message: 'Event has reached maximum participant capacity' });
      }
    }
    console.log('✅ Step 11-12: Participant limit OK');

    const participantTrack = event.selectedTrack || null;
    console.log('🎯 Step 13: Participant track from event:', participantTrack);

    if (participantTrack) {
      console.log('🔍 Step 14: Event has track. Checking track availability for:', participantTrack);
      const trackCheck = await Participant.checkTrackAvailability(email.toLowerCase(), participantTrack, eventId);
      console.log('📊 Track check result:', trackCheck);
      if (!trackCheck.available) {
        return res.status(400).json({
          success: false,
          message: `You are already registered for another track-based event: ${trackCheck.currentTrack}. Please contact an admin to remove you from that track before registering for this one.`,
          data: { currentTrack: trackCheck.currentTrack, currentEventId: trackCheck.currentEvent },
        });
      }
      console.log('✅ Step 14-15: Track availability OK');
    } else {
      console.log('✅ Step 14-15: Event has NO track. Skipping track validation.');
    }

    // Prepare participant data
    const participantData = {
      name,
      email: email.toLowerCase(),
      
      photo: photo, // Use the new photo object
      
      gender,
      eventId,
      phoneNumber,
      track: participantTrack,
      currentActiveTrack: participantTrack || null,
      currentActiveTrackEvent: participantTrack ? eventId : null,
    };

    // ... (add optional fields)
    if (department) participantData.department = department;
    if (matricNo) participantData.matricNo = matricNo;

    console.log('💾 Step 16: Creating participant with data...');
    const participant = await Participant.create(participantData);
    console.log('✅ Step 17: Participant created with ID:', participant._id);

    // ... (Steps 18-21: QR code generation and email logic remain the same) ...
    console.log('🔄 Step 18: Generating QR code');
    const qrCode = await generateQRCode(participant._id.toString());
    participant.qrCode = qrCode;
    await participant.save();
    console.log('✅ Step 19: QR code generated and saved');

    console.log('📧 Step 20: Attempting to send email to:', email);
    try {
      await sendQRCodeEmail({
        to: email, name, eventName: event.name, qrCode, eventDate: event.date, eventLocation: event.location,
      });
      console.log('✅ Step 21: Email sent successfully');
    } catch (emailError) {
      console.error('❌ Step 21: Email sending failed:', emailError);
    }

    console.log('🎉 Step 22: Registration complete, sending response');

    // Convert photo buffer to Base64 string for the response
    const photoDataUri = (participant.photo && participant.photo.data)
      ? `data:${participant.photo.contentType};base64,${participant.photo.data.toString('base64')}`
      : null;

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
          phoneNumber: participant.phoneNumber,
          track: participant.track,
          eventId: participant.eventId,
          qrCode: participant.qrCode,
          photo: photoDataUri, // Send the Base64 string
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
    // ... (Your existing error handling is perfect and needs no changes) ...
    console.error('💥 REGISTRATION ERROR:', error);
    next(error);
  }
};
// Export other controller methods unchanged
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
      const EventPermission = require('../models/EventPermission');
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

    // FIX: Handle no track scenario
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