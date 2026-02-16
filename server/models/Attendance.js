const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    meetingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting',
        required: true
    },
    certificateId: {
        type: String,
        required: true,
        unique: true
    },
    meetingType: {
        type: String,
        required: true
    },
    meetingTitle: {
        type: String,
        required: true
    },
    joinTime: {
        type: Date,
        required: true
    },
    leaveTime: {
        type: Date,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    pdfGenerated: {
        type: Boolean,
        default: false
    },
    pdfPath: {
        type: String,
        default: null
    },
    verificationCode: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
attendanceSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
