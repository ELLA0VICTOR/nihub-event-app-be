const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant',
    required: [true, 'Participant ID is required'],
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required'],
  },
  scannedAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  // NEW: Store the specific date of attendance (for multi-day tracking)
  attendanceDate: {
    type: Date,
    required: true,
    default: function() {
      // Set to start of day for the scanned date
      const date = new Date(this.scannedAt || Date.now());
      date.setHours(0, 0, 0, 0);
      return date;
    },
  },
  status: {
    type: String,
    enum: ['present', 'late', 'excused', 'absent'],
    default: 'present',
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
  },
  location: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// NEW: Compound index for per-day attendance (participant can attend multiple days)
attendanceSchema.index({ participantId: 1, eventId: 1, attendanceDate: 1 }, { unique: true });

// Index for faster queries
attendanceSchema.index({ eventId: 1, scannedAt: -1 });
attendanceSchema.index({ eventId: 1, attendanceDate: 1 });
attendanceSchema.index({ participantId: 1 });
attendanceSchema.index({ scannedAt: -1 });
attendanceSchema.index({ attendanceDate: 1 });

// Pre-save middleware to ensure attendanceDate is set
attendanceSchema.pre('save', function(next) {
  if (!this.attendanceDate) {
    const date = new Date(this.scannedAt || Date.now());
    date.setHours(0, 0, 0, 0);
    this.attendanceDate = date;
  }
  next();
});

// Static method to get attendance for a specific date
attendanceSchema.statics.getAttendanceForDate = async function(eventId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    eventId,
    attendanceDate: { $gte: startOfDay, $lte: endOfDay },
  }).populate('participantId');
};

// Static method to check if participant attended on specific date
attendanceSchema.statics.hasAttendedOnDate = async function(participantId, eventId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const record = await this.findOne({
    participantId,
    eventId,
    attendanceDate: { $gte: startOfDay, $lte: endOfDay },
  });
  
  return !!record;
};

module.exports = mongoose.model('Attendance', attendanceSchema);