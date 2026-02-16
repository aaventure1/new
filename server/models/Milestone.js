const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: String,
    content: String, // Transcribed text
    type: {
        type: String,
        enum: ['daily_reflection', 'sobriety_milestone', 'gratitude'],
        default: 'daily_reflection'
    },
    audioUrl: String, // Optional: if we store the blob
    xpAwarded: {
        type: Number,
        default: 25
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Milestone', milestoneSchema);
