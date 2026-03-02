const express = require('express');
const router = express.Router();
const BlogPost = require('../models/BlogPost');
const { syncWordPressPosts } = require('../utils/blogAutomation');
const { auth, adminAuth } = require('../middleware/auth');

// Get Blog Posts
router.get('/posts', async (req, res) => {
    try {
        const { category, limit = 10 } = req.query;
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
        let query = {};

        if (category) {
            query.category = category;
        }

        let posts = await BlogPost.find(query)
            .sort({ createdAt: -1 })
            .limit(parsedLimit);

        // If no posts in DB, try to sync once
        if (posts.length === 0) {
            await syncWordPressPosts();
            posts = await BlogPost.find(query)
                .sort({ createdAt: -1 })
                .limit(parsedLimit);
        }

        res.json(posts);

    } catch (error) {
        console.error('Fetch posts error:', error);
        res.status(500).json({ message: 'Error fetching blog content' });
    }
});

// Sync posts (Admin only)
router.post('/sync', auth, adminAuth, async (req, res) => {
    try {
        const count = await syncWordPressPosts();
        res.json({ success: true, added: count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
