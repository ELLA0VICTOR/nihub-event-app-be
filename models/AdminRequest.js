const mongoose = require('mongoose');

const adminRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true,
  },
  requestedRole: {
    type: String,
    enum: ['admin'],
    default: 'admin',
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  requestMessage: {
    type: String,
    trim: true,
    maxlength: [500, 'Request message cannot exceed 500 characters'],
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
  reviewNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Review notes cannot exceed 500 characters'],
  },
}, {
  timestamps: true,
});

// Index for faster queries
adminRequestSchema.index({ status: 1, createdAt: -1 });
adminRequestSchema.index({ userId: 1 });

module.exports = mongoose.model('AdminRequest', adminRequestSchema);