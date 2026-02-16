const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    username: {
        type: String,
        required: true
    },
    chatName: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 1000
    },
    type: {
        type: String,
        enum: ['chat', 'announcement', 'reading', 'alert', 'system'],
        default: 'chat'
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    isSystemMessage: {
        type: Boolean,
        default: false
    }
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Virtual to check if it's a global announcement
messageSchema.virtual('isAnnouncement').get(function() {
    return this.type === 'announcement';
});

// Index for efficient querying
messageSchema.index({ roomId: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
