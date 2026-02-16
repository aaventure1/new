const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const { auth, adminAuth } = require('../middleware/auth');

// All routes here require admin privileges
router.use(auth, adminAuth);

// --- Stats & Activity ---

router.get('/stats', async (req, res) => {
    try {
        const usersCount = await User.countDocuments();
        const meetingsCount = await Meeting.countDocuments();
        const now = new Date();
        const activeSubsCount = await User.countDocuments({
            subscription: { $ne: 'free' },
            subscriptionExpiry: { $gt: now }
        });

        // Calculate total certificates issued
        const attendanceStats = await User.aggregate([
            { $unwind: "$attendanceRecords" },
            { $count: "totalCertificates" }
        ]);
        const totalCertificates = attendanceStats.length > 0 ? attendanceStats[0].totalCertificates : 0;

        // Recent Activity (New Features!)
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);
        
        // Flatten recent attendance from users
        const recentActivity = [
            ...recentUsers.map(u => ({
                type: 'user_joined',
                message: `New user registered: ${u.chatName}`,
                timestamp: u.createdAt
            }))
        ];

        // Fetch last 5 attendance from across all users (complex query)
        const recentAttendance = await User.aggregate([
            { $unwind: "$attendanceRecords" },
            { $sort: { "attendanceRecords.date": -1 } },
            { $limit: 5 },
            { $project: { chatName: 1, attendance: "$attendanceRecords" } }
        ]);

        recentAttendance.forEach(a => {
            recentActivity.push({
                type: 'attendance',
                message: `${a.chatName} generated certificate for meeting`,
                timestamp: a.attendance.date
            });
        });

        res.json({
            success: true,
            stats: {
                users: usersCount,
                meetings: meetingsCount,
                activeSubscriptions: activeSubsCount,
                attendance: totalCertificates
            },
            activity: recentActivity.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// --- User Management ---

router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/users/:userId/toggle-admin', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ error: 'Cannot remove your own admin status' });
        }
        user.isAdmin = !user.isAdmin;
        await user.save();
        res.json({ success: true, isAdmin: user.isAdmin });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/users/:userId', async (req, res) => {
    try {
        if (req.params.userId === req.user._id.toString()) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        await User.findByIdAndDelete(req.params.userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Meeting Management ---

router.get('/meetings', async (req, res) => {
    try {
        const meetings = await Meeting.find({}).sort({ 'schedule.dayOfWeek': 1 });
        res.json({ success: true, meetings });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/meetings', async (req, res) => {
    try {
        const { title, type, format, roomId, zoomLink } = req.body;
        if (!title || !type || !format || !roomId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const newMeeting = new Meeting({
            title, type, format, roomId, zoomLink,
            isActive: true,
            schedule: { dayOfWeek: 0, time: "12:00", recurring: true }
        });
        await newMeeting.save();
        res.json({ success: true, meeting: newMeeting });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/meetings/:meetingId', async (req, res) => {
    try {
        await Meeting.findByIdAndDelete(req.params.meetingId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Attendance Review ---



router.get('/attendance-review', async (req, res) => {

    try {

        // Fetch recent attendance across all users

        const records = await User.aggregate([

            { $unwind: "$attendanceRecords" },

            { $sort: { "attendanceRecords.date": -1 } },

            { $limit: 20 },

            {

                $project: {

                    userId: "$_id",

                    chatName: 1,

                    meetingId: "$attendanceRecords.meetingId",

                    date: "$attendanceRecords.date",

                    duration: "$attendanceRecords.duration",

                    certificateId: "$attendanceRecords.certificateId"

                }

            }

        ]);



        // Populate meeting details manually or via lookup if needed

        // For simplicity, we just return the raw data which is sufficient for review

        res.json({ success: true, records });

    } catch (error) {

        console.error('Attendance review error:', error);

        res.status(500).json({ error: 'Server error' });

    }

});



module.exports = router;
