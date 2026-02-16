const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['AA', 'NA', 'Christian', 'Open', 'Zoom'],
        required: true
    },
    format: {
        type: String,
        enum: ['text', 'video', 'hybrid'],
        default: 'text'
    },
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        default: ''
    },
    schedule: {
        dayOfWeek: {
            type: Number,
            min: 0,
            max: 6
        },
        time: String,
        recurring: {
            type: Boolean,
            default: true
        }
    },
    zoomLink: {
        type: String,
        default: null
    },
    isExternal: {
        type: Boolean,
        default: false
    },
    source: {
        type: String, // e.g., 'Zoom', 'YouTube', 'External'
        default: 'Internal'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: Date,
        leftAt: Date
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Meeting', meetingSchema);
