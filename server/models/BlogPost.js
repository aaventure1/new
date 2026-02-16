const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    excerpt: String,
    content: {
        type: String,
        required: true
    },
    author: {
        type: String,
        default: 'AAVenture Team'
    },
    featuredImage: String,
    category: {
        type: String,
        enum: ['General', 'Just For Today', 'Recovery Stories', 'News'],
        default: 'General'
    },
    source: {
        type: String,
        default: 'local' // or 'wordpress'
    },
    sourceUrl: String,
    wpId: Number,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BlogPost', blogPostSchema);
