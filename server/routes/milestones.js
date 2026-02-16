const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Milestone = require('../models/Milestone');
const RecoveryStatsManager = require('../utils/recoveryStats');

// Save a new voice-to-text milestone
router.post('/save', auth, async (req, res) => {
    try {
        const { content, type, title } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Milestone content is empty' });
        }

        const milestone = new Milestone({
            userId: req.user._id,
            title: title || 'Voice Reflection',
            content,
            type: type || 'daily_reflection'
        });

        await milestone.save();

        // Award high XP for self-reflection
        const xpResult = await RecoveryStatsManager.awardXP(req.user, 25, 'Voice Milestone');
        await req.user.save();

        res.json({
            success: true,
            message: 'Reflection archived. 25 XP Awarded!',
            xp: xpResult
        });
    } catch (error) {
        console.error('Milestone save error:', error);
        res.status(500).json({ error: 'Failed to archive milestone' });
    }
});

// Get user's milestone history
router.get('/history', auth, async (req, res) => {
    try {
        const history = await Milestone.find({ userId: req.user._id }).sort({ timestamp: -1 });
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

module.exports = router;
