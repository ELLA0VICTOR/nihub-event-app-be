const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true,
    minlength: [3, 'Event name must be at least 3 characters'],
    maxlength: [200, 'Event name cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  date: {
    type: Date,
    required: [true, 'Event date is required'],
  },
  // NEW: Multi-day event support
  startDate: {
    type: Date,
    required: [true, 'Event start date is required'],
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value >= this.startDate;
      },
      message: 'End date must be after or equal to start date',
    },
  },
  duration: {
    type: Number, // Duration in days
    min: [1, 'Duration must be at least 1 day'],
  },
  autoTerminate: {
    type: Boolean,
    default: false, // If true, event auto-terminates after duration
  },
  location: {
    type: String,
    required: [true, 'Event location is required'],
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled', 'terminated'],
    default: 'upcoming',
  },
  maxParticipants: {
    type: Number,
    min: [1, 'Maximum participants must be at least 1'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false, // Soft delete to preserve attendance history
  },
  deletedAt: {
    type: Date,
  },
  imageUrl: {
    type: String,
    trim: true,
  },
  // Track selection from predefined options
  selectedTrack: {
    type: String,
    enum: ['Web and App', 'Networking', 'Cloud Computing', 'PCB', null],
    default: null,
  },
  // Optional: Store track details if needed
  tracks: [{
    trackId: {
      type: String,
      required: true,
    },
    trackName: {
      type: String,
      required: true,
    },
    trackAbbreviation: {
      type: String,
      required: true,
    }
  }],
}, {
  timestamps: true,
});

// Pre-save middleware to set startDate and endDate
eventSchema.pre('save', function(next) {
  // If startDate not set, use date
  if (!this.startDate) {
    this.startDate = this.date;
  }
  
  // Calculate endDate if duration is provided
  if (this.duration && !this.endDate) {
    const end = new Date(this.startDate);
    end.setDate(end.getDate() + this.duration);
    this.endDate = end;
  }
  
  next();
});

// Index for faster queries
eventSchema.index({ date: 1, status: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ isDeleted: 1 });
eventSchema.index({ selectedTrack: 1 });

// Virtual for participant count
eventSchema.virtual('participantCount', {
  ref: 'Participant',
  localField: '_id',
  foreignField: 'eventId',
  count: true,
});

// Virtual for attendance count
eventSchema.virtual('attendanceCount', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'eventId',
  count: true,
});

// Method to check if event is currently active
eventSchema.methods.isEventActive = function() {
  const now = new Date();
  return (
    this.isActive &&
    !this.isDeleted &&
    this.status !== 'terminated' &&
    this.status !== 'cancelled' &&
    (!this.endDate || now <= this.endDate)
  );
};

// Method to check if event should auto-terminate
eventSchema.methods.shouldAutoTerminate = function() {
  if (!this.autoTerminate || !this.endDate) return false;
  const now = new Date();
  return now > this.endDate && this.status !== 'terminated';
};

// Static method to auto-terminate expired events
eventSchema.statics.terminateExpiredEvents = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      autoTerminate: true,
      endDate: { $lt: now },
      status: { $nin: ['terminated', 'cancelled', 'completed'] },
      isDeleted: false,
    },
    {
      $set: { status: 'terminated' },
    }
  );
  return result;
};

// Enable virtuals in JSON
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);