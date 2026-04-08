const mongoose = require('mongoose');

const ticketTierSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'General Admission' },
    price: { type: Number, default: 0 },
    priceUnit: { type: String, enum: ['ETH', 'USD', 'INR', 'FREE'], default: 'ETH' },
    capacity: { type: Number, default: 100 },
    sold: { type: Number, default: 0 },
    description: { type: String, default: '' },
  },
  { _id: true }
);

const locationSchema = new mongoose.Schema(
  {
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number },
    virtualUrl: { type: String, default: '' },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: 5000,
    },
    coverImageUrl: {
      type: String,
      default: '',
    },

    // Date & Time
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },

    // Legacy date field (backward compat)
    date: {
      type: String,
      default: '',
    },

    // Location
    locationType: {
      type: String,
      enum: ['offline', 'virtual', 'hybrid'],
      default: 'offline',
    },
    location: locationSchema,

    // Legacy venue field (backward compat)
    venue: {
      type: String,
      default: '',
      trim: true,
    },

    // Visibility & Access
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    requireApproval: {
      type: Boolean,
      default: false,
    },
    isFree: {
      type: Boolean,
      default: false,
    },

    // Token Gating
    tokenGate: {
      enabled: { type: Boolean, default: false },
      contractAddress: { type: String, default: '' },
      minBalance: { type: Number, default: 1 },
      chain: { type: String, enum: ['ethereum', 'polygon', 'base'], default: 'ethereum' }
    },

    // Tickets
    totalCapacity: {
      type: Number,
      default: 100,
      min: 1,
    },
    priceEth: {
      type: Number,
      default: 0.01,
    },
    ticketTiers: [ticketTierSchema],

    // Categorization
    tags: [{ type: String, trim: true }],

    // Hosts
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Status
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
      default: 'published',
    },

    // Registration count (denormalized for perf)
    registrationCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes
eventSchema.index({ status: 1, startTime: -1 });
eventSchema.index({ tags: 1 });
eventSchema.index({ 'location.city': 1 });
eventSchema.index({ name: 'text', description: 'text' });

// Virtual: is upcoming
eventSchema.virtual('isUpcoming').get(function () {
  return this.startTime > new Date();
});

module.exports = mongoose.model('Event', eventSchema);
