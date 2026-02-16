const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const { auth, adminAuth } = require('../middleware/auth');

// Get all meetings
router.get('/', async (req, res) => {
    try {
        const meetings = await Meeting.find({ isActive: true })
            .sort({ 'schedule.dayOfWeek': 1, 'schedule.time': 1 });

        res.json({
            success: true,
            meetings
        });
    } catch (error) {
        console.error('Get meetings error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get meeting by room ID
router.get('/room/:roomId', async (req, res) => {
    try {
        const meeting = await Meeting.findOne({ roomId: req.params.roomId, isActive: true });

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting room not found' });
        }

        res.json({
            success: true,
            meeting
        });
    } catch (error) {
        console.error('Get meeting error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get meetings by type
router.get('/type/:type', async (req, res) => {
    try {
        const meetings = await Meeting.find({
            type: req.params.type.toUpperCase(),
            isActive: true
        }).sort({ 'schedule.dayOfWeek': 1, 'schedule.time': 1 });

        res.json({
            success: true,
            meetings
        });
    } catch (error) {
        console.error('Get meetings by type error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new meeting (admin only - simplified for now)
router.post('/', auth, adminAuth, async (req, res) => {
    try {
        const { title, type, format, roomId, description, schedule, zoomLink } = req.body;
        const safeTitle = typeof title === 'string' ? title.trim() : '';
        const safeRoomId = typeof roomId === 'string' ? roomId.trim().toLowerCase() : '';
        const normalizedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
        const normalizedFormat = typeof format === 'string' ? format.trim().toLowerCase() : '';
        const safeType = ({
            aa: 'AA',
            na: 'NA',
            christian: 'Christian',
            open: 'Open',
            zoom: 'Zoom'
        })[normalizedType] || (typeof type === 'string' ? type.trim() : '');
        const safeFormat = ({
            text: 'text',
            video: 'video',
            hybrid: 'hybrid'
        })[normalizedFormat] || (typeof format === 'string' ? format.trim() : '');

        if (!safeTitle || !safeRoomId || !safeType || !safeFormat) {
            return res.status(400).json({ error: 'title, type, format, and roomId are required' });
        }

        const meeting = new Meeting({
            title: safeTitle,
            type: safeType,
            format: safeFormat,
            roomId: safeRoomId,
            description: typeof description === 'string' ? description.trim() : '',
            schedule,
            zoomLink: typeof zoomLink === 'string' ? zoomLink.trim() : null
        });

        await meeting.save();

        res.status(201).json({
            success: true,
            message: 'Meeting created successfully',
            meeting
        });
    } catch (error) {
        console.error('Create meeting error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Join meeting
router.post('/:meetingId/join', auth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.meetingId);

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Add user to participants if not already there
        const existingParticipant = meeting.participants.find(
            p => p.userId.toString() === req.user._id.toString() && !p.leftAt
        );

        if (!existingParticipant) {
            meeting.participants.push({
                userId: req.user._id,
                joinedAt: new Date()
            });
            await meeting.save();
        }

        res.json({
            success: true,
            message: 'Joined meeting successfully',
            meeting
        });
    } catch (error) {
        console.error('Join meeting error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Leave meeting
router.post('/:meetingId/leave', auth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.meetingId);

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Find active participant and mark as left
        const participant = meeting.participants.find(
            p => p.userId.toString() === req.user._id.toString() && !p.leftAt
        );

        if (participant) {
            participant.leftAt = new Date();
            await meeting.save();
        }

        res.json({
            success: true,
            message: 'Left meeting successfully'
        });
    } catch (error) {
        console.error('Leave meeting error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
