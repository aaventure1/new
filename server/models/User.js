const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    chatName: {
        type: String,
        required: true,
        trim: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    subscription: {
        type: String,
        enum: ['free', 'basic', 'premium'],
        default: 'free'
    },
    subscriptionExpiry: {
        type: Date,
        default: null
    },
    stripeCustomerId: {
        type: String,
        default: null
    },

    attendanceRecords: [{
        meetingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Meeting'
        },
        date: {
            type: Date,
            default: Date.now
        },
        duration: Number,
        certificateId: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    sobrietyDate: {
        type: Date,
        default: null
    },
    streaks: {
        current: { type: Number, default: 0 },
        longest: { type: Number, default: 0 },
        lastAttendance: { type: Date, default: null }
    },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    moodHistory: [{
        mood: String,
        note: String,
        timestamp: { type: Date, default: Date.now }
    }],
    badges: [{
        name: String,
        icon: String,
        earnedAt: { type: Date, default: Date.now },
        description: String
    }],
    sponsorship: {
        isAvailable: { type: Boolean, default: false },
        isLooking: { type: Boolean, default: false },
        partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        requests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    anonymousMode: {
        type: Boolean,
        default: false
    },
    privacySettings: {
        hideProfile: { type: Boolean, default: false },
        hideSobrietyDate: { type: Boolean, default: false }

    }
});

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error;
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if subscription is active
userSchema.methods.hasActiveSubscription = function () {
    if (this.subscription === 'free') return false;
    if (!this.subscriptionExpiry) return false;
    return this.subscriptionExpiry > new Date();
};

module.exports = mongoose.model('User', userSchema);
