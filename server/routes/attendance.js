const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Attendance = require('../models/Attendance');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { auth, requireSubscription } = require('../middleware/auth');
const CertificateGenerator = require('../utils/certificateGenerator');
const { sendCertificateEmail } = require('../utils/emailUtils');
const RecoveryStatsManager = require('../utils/recoveryStats');


// Get user's attendance records
router.get('/my-records', auth, async (req, res) => {
    try {
        const records = await Attendance.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .populate('meetingId');

        res.json({
            success: true,
            records
        });
    } catch (error) {
        console.error('Get attendance records error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user's recovery stats (streaks and badges)
router.get('/my-stats', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            streaks: req.user.streaks,
            badges: req.user.badges,
            attendanceCount: req.user.attendanceRecords.length,
            xp: req.user.xp,
            level: req.user.level
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error fetching stats' });
    }
});

// Generate attendance certificate (requires active subscription)
router.post('/generate-certificate', auth, requireSubscription, async (req, res) => {
    try {
        const { meetingId } = req.body;

        if (!meetingId) {
            return res.status(400).json({ error: 'Meeting ID is required' });
        }

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        let parsedJoinTime;
        let parsedLeaveTime;

        // Prefer server-tracked participant sessions for stronger attendance integrity.
        const participant = [...meeting.participants]
            .reverse()
            .find(p => p.userId && p.userId.toString() === req.user._id.toString() && p.joinedAt);

        if (!participant) {
            return res.status(400).json({
                error: 'No tracked attendance session found. Please rejoin the meeting and try again.'
            });
        }

        parsedJoinTime = new Date(participant.joinedAt);
        parsedLeaveTime = participant.leftAt ? new Date(participant.leftAt) : new Date();

        if (!participant.leftAt) {
            participant.leftAt = parsedLeaveTime;
            await meeting.save();
        }

        if (Number.isNaN(parsedJoinTime.getTime()) || Number.isNaN(parsedLeaveTime.getTime())) {
            return res.status(400).json({ error: 'Invalid join or leave time' });
        }

        if (parsedLeaveTime <= parsedJoinTime) {
            return res.status(400).json({ error: 'Leave time must be after join time' });
        }

        // Calculate duration in seconds
        const duration = (parsedLeaveTime - parsedJoinTime) / 1000;

        // Minimum 30 minutes required for certificate
        if (duration < 1800) {
            return res.status(400).json({
                error: 'Minimum 30 minutes attendance required for certificate'
            });
        }

        // Generate unique certificate ID and verification code
        const certificateId = uuidv4();
        const verificationCode = CertificateGenerator.generateVerificationCode();

        // Create attendance record
        const attendance = new Attendance({
            userId: req.user._id,
            meetingId: meeting._id,
            certificateId,
            meetingType: meeting.type,
            meetingTitle: meeting.title,
            joinTime: parsedJoinTime,
            leaveTime: parsedLeaveTime,
            duration,
            verificationCode
        });

        await attendance.save();

        // Add to user's attendance records
        req.user.attendanceRecords.push({
            meetingId: meeting._id,
            date: parsedJoinTime,
            duration,
            certificateId
        });
        await req.user.save();

        // Update streaks and check badges
        const recoveryResult = await RecoveryStatsManager.updateStreak(req.user);

        // Generate PDF certificate
        const certificateData = {
            certificateId,
            verificationCode,
            userName: req.user.chatName,
            meetingType: meeting.type,
            meetingTitle: meeting.title,
            joinTime: parsedJoinTime,
            leaveTime: parsedLeaveTime,
            duration
        };

        const pdfResult = await CertificateGenerator.generateAttendanceCertificate(certificateData);

        // Update attendance record with PDF info
        attendance.pdfGenerated = true;
        attendance.pdfPath = pdfResult.filepath;
        await attendance.save();

        // Send certificate email (non-blocking)
        sendCertificateEmail(req.user.email, {
            meetingTitle: meeting.title,
            certificateId,
            duration
        }).catch(err => console.error('Certificate email error:', err));



        res.json({
            success: true,
            message: 'Certificate generated successfully',
            recoveryData: recoveryResult,
            attendance: {

                id: attendance._id,
                certificateId,
                verificationCode,
                pdfUrl: pdfResult.url,
                meetingType: meeting.type,
                meetingTitle: meeting.title,
                duration: Math.round(duration / 60)
            }
        });
    } catch (error) {
        console.error('Generate certificate error:', error);
        res.status(500).json({ error: 'Server error generating certificate' });
    }
});


// Record User Mood
router.post('/mood', auth, async (req, res) => {
    try {
        const { mood, note } = req.body;
        if (!mood) return res.status(400).json({ error: 'Mood is required' });

        // Add to history
        req.user.moodHistory.push({
            mood,
            note: note || '',
            timestamp: new Date()
        });

        // Award XP for check-in (Daily Evolution)
        const xpResult = await RecoveryStatsManager.awardXP(req.user, 10, 'Daily Mood Check-in');

        await req.user.save();

        res.json({
            success: true,
            moodRecorded: true,
            xp: xpResult
        });
    } catch (error) {
        console.error('Mood record error:', error);
        res.status(500).json({ error: 'Server error recording mood' });
    }
});


// Verify certificate
router.get('/verify/:certificateId', async (req, res) => {
    try {
        const attendance = await Attendance.findOne({ certificateId: req.params.certificateId })
            .populate('userId', 'chatName')
            .populate('meetingId', 'title type');

        if (!attendance) {
            return res.status(404).json({ error: 'Certificate not found' });
        }

        res.json({
            success: true,
            verified: true,
            certificate: {
                id: attendance.certificateId,
                userName: attendance.userId?.chatName || 'Unknown',
                meetingTitle: attendance.meetingTitle,
                meetingType: attendance.meetingType,
                date: attendance.joinTime,
                duration: Math.round(attendance.duration / 60),
                verified: true
            }
        });
    } catch (error) {
        console.error('Verify certificate error:', error);
        res.status(500).json({ error: 'Server error verifying certificate' });
    }
});


// Download certificate PDF
router.get('/download/:certificateId', auth, async (req, res) => {
    try {
        const attendance = await Attendance.findOne({
            certificateId: req.params.certificateId,
            userId: req.user._id
        });

        if (!attendance) {
            return res.status(404).json({ error: 'Certificate not found' });
        }

        if (!attendance.pdfGenerated || !attendance.pdfPath) {
            return res.status(404).json({ error: 'PDF not available' });
        }

        res.download(attendance.pdfPath, `certificate_${attendance.certificateId}.pdf`);
    } catch (error) {
        console.error('Download certificate error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
