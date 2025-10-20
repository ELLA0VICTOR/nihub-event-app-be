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

// Compound index to prevent duplicate attendance records
attendanceSchema.index({ participantId: 1, eventId: 1 }, { unique: true });

// Index for faster queries
attendanceSchema.index({ eventId: 1, scannedAt: -1 });
attendanceSchema.index({ participantId: 1 });
attendanceSchema.index({ scannedAt: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);