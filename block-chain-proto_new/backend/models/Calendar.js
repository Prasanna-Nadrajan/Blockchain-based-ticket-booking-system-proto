const mongoose = require('mongoose');

const calendarSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Calendar name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    coverImageUrl: {
      type: String,
      default: '',
    },

    // Ownership
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Subscribers
    subscribers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        subscribedAt: { type: Date, default: Date.now },
      },
    ],

    // Linked events
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
      },
    ],

    // Settings
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

calendarSchema.index({ slug: 1 });
calendarSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Calendar', calendarSchema);
