const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const walletSchema = new mongoose.Schema(
  {
    chain: {
      type: String,
      enum: ['ethereum', 'solana'],
      required: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    deviceName: { type: String, default: 'Unknown Device' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    lastActive: { type: Date, default: Date.now },
    tokenHash: { type: String }, // hashed JWT for revocation
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // allow null until set
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_-]{3,30}$/, 'Username must be 3-30 chars: letters, numbers, _ or -'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'organizer', 'admin'],
      default: 'user',
    },

    // Profile
    bio: {
      type: String,
      maxlength: 500,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    socialLinks: {
      x: { type: String, default: '' },
      instagram: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      github: { type: String, default: '' },
      website: { type: String, default: '' },
    },

    // Web3 — multi-chain wallets
    wallets: [walletSchema],

    // Legacy single wallet (kept for backward compatibility, will be migrated)
    walletAddress: {
      type: String,
      default: '',
      trim: true,
    },

    // Security
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    sessions: [sessionSchema],

    // Preferences
    preferences: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      locale: { type: String, default: 'en' },
      emailNotifications: { type: Boolean, default: true },
    },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Index for discovery / search
userSchema.index({ name: 'text', username: 'text' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare given password with stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Get primary wallet address (helper)
userSchema.methods.getPrimaryWallet = function (chain = 'ethereum') {
  const wallet = this.wallets.find((w) => w.chain === chain && w.isPrimary);
  return wallet ? wallet.address : this.walletAddress || null;
};

// Virtual for profile URL
userSchema.virtual('profileUrl').get(function () {
  return this.username ? `/profile/${this.username}` : `/profile/${this._id}`;
});

module.exports = mongoose.model('User', userSchema);
