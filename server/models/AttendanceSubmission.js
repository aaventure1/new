const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
    recipient: { type: String, required: true },
    type: { type: String, enum: ['attendee', 'additional'], required: true },
    sentAt: { type: Date, default: Date.now },
    providerMessageId: { type: String, default: null },
    success: { type: Boolean, required: true },
    error: { type: String, default: null }
}, { _id: false });

const attendanceSubmissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    meetingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting',
        default: null
    },
    certificateId: {
        type: String,
        default: null,
        index: true
    },
    submissionKey: {
        type: String,
        required: true,
        unique: true
    },
    meetingDate: {
        type: Date,
        required: true
    },
    meetingTimeLabel: {
        type: String,
        required: true,
        trim: true,
        maxlength: 40
    },
    meetingTopic: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    meetingChairperson: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    participationNotes: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    attendeeFullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    attendeeEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    sendAdditionalRecipient: {
        type: Boolean,
        required: true
    },
    additionalRecipientEmail: {
        type: String,
        default: null,
        lowercase: true,
        trim: true
    },
    meetingIdDisplay: {
        type: String,
        required: true,
        trim: true
    },
    checkInAt: {
        type: Date,
        required: true
    },
    submittedAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    revision: {
        type: Number,
        default: 1
    },
    status: {
        type: String,
        enum: ['submitted', 'linked', 'emailed', 'error'],
        default: 'submitted'
    },
    emailLog: {
        type: [emailLogSchema],
        default: []
    }
}, {
    timestamps: true
});

attendanceSubmissionSchema.index({ userId: 1, submittedAt: -1 });

module.exports = mongoose.model('AttendanceSubmission', attendanceSubmissionSchema);
