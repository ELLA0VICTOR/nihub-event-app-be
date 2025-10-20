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
  photo: {
    type: String,
    trim: true,
  },
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department cannot exceed 100 characters'],
  },
  matricNo: {
    type: String,
    trim: true,
    maxlength: [50, 'Matric number cannot exceed 50 characters'],
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
  },
  track: {
    type: String,
    trim: true,
    maxlength: [100, 'Track cannot exceed 100 characters'],
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
  phoneNumber: {
    type: String,
    trim: true,
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

// Virtual for attendance records
participantSchema.virtual('attendanceRecords', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'participantId',
});

// Enable virtuals in JSON
participantSchema.set('toJSON', { virtuals: true });
participantSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Participant', participantSchema);