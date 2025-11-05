const mongoose = require('mongoose');

const eventPermissionSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required'],
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Granter ID is required'],
  },
  grantedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Grantee ID is required'],
  },
  permissions: {
    canScan: {
      type: Boolean,
      default: true,
    },
    canEdit: {
      type: Boolean,
      default: false,
    },
    canDelete: {
      type: Boolean,
      default: false,
    },
    canViewReports: {
      type: Boolean,
      default: true,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  grantedAt: {
    type: Date,
    default: Date.now,
  },
  revokedAt: {
    type: Date,
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
  },
}, {
  timestamps: true,
});

// Compound index to prevent duplicate permissions
eventPermissionSchema.index({ eventId: 1, grantedTo: 1 }, { unique: true });

// Index for faster queries
eventPermissionSchema.index({ eventId: 1, isActive: 1 });
eventPermissionSchema.index({ grantedTo: 1, isActive: 1 });
eventPermissionSchema.index({ grantedBy: 1 });

// Static method to check if user has permission for event
eventPermissionSchema.statics.hasPermission = async function(userId, eventId, permissionType = 'canScan') {
  const permission = await this.findOne({
    eventId,
    grantedTo: userId,
    isActive: true,
  });
  
  if (!permission) return false;
  
  return permission.permissions[permissionType] === true;
};

// Static method to revoke permission
eventPermissionSchema.statics.revokePermission = async function(eventId, userId) {
  return this.findOneAndUpdate(
    { eventId, grantedTo: userId },
    {
      isActive: false,
      revokedAt: new Date(),
    },
    { new: true }
  );
};

module.exports = mongoose.model('EventPermission', eventPermissionSchema);