const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const SponsorshipManager = require('../utils/sponsorshipManager');

// Get potential sponsor matches
router.get('/matches', auth, async (req, res) => {
    try {
        const matches = await SponsorshipManager.findMatches(req.user);
        res.json({ success: true, matches });
    } catch (error) {
        console.error('Find matches error:', error);
        res.status(500).json({ error: 'Failed to find matches' });
    }
});

// Update sponsorship preference
router.post('/status', auth, async (req, res) => {
    try {
        const { isAvailable, isLooking } = req.body;
        if (isAvailable !== undefined) req.user.sponsorship.isAvailable = isAvailable;
        if (isLooking !== undefined) req.user.sponsorship.isLooking = isLooking;
        
        await req.user.save();
        res.json({ success: true, sponsorship: req.user.sponsorship });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Send sponsorship request
router.post('/request/:id', auth, async (req, res) => {
    try {
        const result = await SponsorshipManager.sendRequest(req.user, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to send request' });
    }
});

module.exports = router;
