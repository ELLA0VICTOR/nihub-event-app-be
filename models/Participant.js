const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Participant name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email',
    ],
  },
  
  // ===== MODIFIED FIELD =====
  // Corrected the syntax for a required embedded object
  photo: {
    type: {
      data: Buffer,
      contentType: String,
    },
    required: [true, 'Photo is required'],
  },
  // ==========================

  // OPTIONAL for non-students, REQUIRED contextually
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters'],
    default: null,
  },
  // OPTIONAL for non-students, can be provided by students
  matricNo: {
    type: String,
    trim: true,
    maxlength: [50, 'Matric number cannot exceed 50 characters'],
    default: null,
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: {
      values: ['male', 'female', 'other', 'prefer-not-to-say'],
      message: 'Gender must be male, female, other, or prefer-not-to-say'
    },
  },
  // Phone number is now REQUIRED
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        // Validates Nigerian and international formats
        // +234XXXXXXXXXX or 0XXXXXXXXXX or +XXX...
        return /^(\+?\d{1,4}[\s-]?)?(\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4,}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  // Track is OPTIONAL - only exists if event has a track
  track: {
    type: String,
    trim: true,
    enum: {
      values: ['Web and App', 'Networking', 'Cloud Computing', 'PCB', null],
      message: 'Invalid track selection'
    },
    default: null,
  },
  // Track the current active track this participant is enrolled in
  currentActiveTrack: {
    type: String,
    enum: ['Web and App', 'Networking', 'Cloud Computing', 'PCB', null],
    default: null,
  },
  // Store the active event ID for track restriction
  currentActiveTrackEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required'],
  },
  qrCode: {
    type: String,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound index to prevent duplicate registrations
participantSchema.index({ email: 1, eventId: 1 }, { unique: true });

// Index for faster queries
participantSchema.index({ eventId: 1 });
participantSchema.index({ registeredAt: -1 });
participantSchema.index({ email: 1, currentActiveTrack: 1 });
participantSchema.index({ currentActiveTrackEvent: 1 });

// Virtual for attendance records
participantSchema.virtual('attendanceRecords', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'participantId',
});

// Method to check if participant can register for a track
participantSchema.methods.canRegisterForTrack = function(newTrack, newEventId) {
  // If no track restriction (event has no track), allow registration
  if (!newTrack) return true;
  
  // If participant has no active track, allow registration
  if (!this.currentActiveTrack) return true;
  
  // If registering for same event, allow (in case of re-registration)
  if (this.currentActiveTrackEvent && 
      this.currentActiveTrackEvent.toString() === newEventId.toString()) {
    return true;
  }
  
  // If registering for different track while having active track, block
  if (this.currentActiveTrack && this.currentActiveTrack !== newTrack) {
    return false;
  }
  
  return true;
};

// Static method to check track availability for email
participantSchema.statics.checkTrackAvailability = async function(email, trackName, eventId) {
  // If no track name provided, no restriction applies
  if (!trackName) {
    return { available: true };
  }

  // Find any active participant with this email in a track-based event
  const existingParticipant = await this.findOne({
    email: email.toLowerCase(),
    currentActiveTrack: { $ne: null },
    isActive: true,
    eventId: { $ne: eventId }, // Different event
  }).populate('currentActiveTrackEvent', 'isActive status isDeleted');
  
  if (!existingParticipant) return { available: true };
  
  // Check if the existing track event is still active
  const trackEvent = existingParticipant.currentActiveTrackEvent;
  if (trackEvent && trackEvent.isActive && !trackEvent.isDeleted && 
      trackEvent.status !== 'completed' && trackEvent.status !== 'terminated') {
    return {
      available: false,
      currentTrack: existingParticipant.currentTrack,
      currentEvent: existingParticipant.currentActiveTrackEvent,
    };
  }
  
  return { available: true };
};

// Enable virtuals in JSON
participantSchema.set('toJSON', { virtuals: true });
participantSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Participant', participantSchema);