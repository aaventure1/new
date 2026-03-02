const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Attendance = require('../models/Attendance');
const AttendanceSubmission = require('../models/AttendanceSubmission');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { auth, requireSubscription } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const CertificateGenerator = require('../utils/certificateGenerator');
const { sendCertificateEmail } = require('../utils/emailUtils');
const RecoveryStatsManager = require('../utils/recoveryStats');
const { enqueueAttendanceSubmissionEmails } = require('../utils/attendanceEmailQueue');
const { getSuggestions } = require('../utils/attendanceHelperService');
const { increment, observeMs } = require('../utils/attendanceMetrics');
const {
    normalizeDateOnlyUTC,
    sanitizeText,
    isValidEmail,
    buildSubmissionKey,
    maskName,
    buildMeetingIdDisplay,
    parseCheckInAt,
    buildValidationErrors
} = require('../utils/attendanceSubmissionUtils');

const helperLimiter = createRateLimiter({
    key: 'attendance-helper',
    windowMs: 60 * 1000,
    max: 10,
    message: 'Attendance helper is receiving high traffic. Please try again shortly.'
});

const featureEnabled = () => process.env.ATTENDANCE_VERIFICATION_FORM_V2 !== 'false';
const requiresAttendanceSubscription = () => process.env.ATTENDANCE_SUBMISSION_REQUIRE_SUBSCRIPTION === 'true';
const getSyncToken = () => (process.env.AAV_SYNC_TOKEN || '').trim();
const getWordPressBridgeUrl = () => (process.env.WORDPRESS_BRIDGE_URL || '').trim().replace(/\/$/, '');

function isWordPressSyncAuthorized(req) {
    const expected = getSyncToken();
    if (!expected) return process.env.NODE_ENV !== 'production';
    return req.get('x-aav-sync-token') === expected;
}

function parseDateWindow(meetingDate, meetingTimeLabel) {
    const checkInAt = parseCheckInAt(meetingDate, meetingTimeLabel);
    const start = new Date(checkInAt.getTime() - (12 * 60 * 60 * 1000));
    const end = new Date(checkInAt.getTime() + (12 * 60 * 60 * 1000));
    return { checkInAt, start, end };
}

async function linkSubmissionToAttendance(submission) {
    const { start, end } = parseDateWindow(submission.meetingDate.toISOString().slice(0, 10), submission.meetingTimeLabel);
    const attendance = await Attendance.findOne({
        userId: submission.userId,
        joinTime: { $gte: start, $lte: end }
    }).sort({ createdAt: -1 });

    if (!attendance) return null;

    attendance.submissionId = submission._id;
    attendance.attendeeFullNameMasked = maskName(submission.attendeeFullName);
    await attendance.save();

    submission.certificateId = attendance.certificateId;
    submission.meetingId = attendance.meetingId || submission.meetingId;
    submission.status = 'linked';
    await submission.save();
    increment('attendance.submit.linked');
    return attendance;
}

async function ensureBridgeUser({ fullName, email }) {
    const normalizedEmail = sanitizeText(email, 255).toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });
    if (user) return user;

    const baseUsername = `wp_${normalizedEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'user'}`.slice(0, 24);
    let username = baseUsername;
    let suffix = 1;
    while (await User.findOne({ username })) {
        username = `${baseUsername}${suffix}`.slice(0, 28);
        suffix += 1;
    }

    const chatName = sanitizeText(fullName, 120) || username;
    user = await User.create({
        username,
        email: normalizedEmail,
        password: `bridge-${crypto.randomUUID()}`,
        chatName,
        subscription: 'basic',
        subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
    return user;
}

async function verifyViaWordPressBridge(certificateId) {
    const base = getWordPressBridgeUrl();
    if (!base) return null;

    try {
        const url = `${base}/?rest_route=/aaventure/v1/verify/${encodeURIComponent(certificateId)}`;
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) return null;
        const data = await response.json();
        if (!data?.success || !data?.certificate?.id) return null;

        return {
            success: true,
            verified: true,
            certificate: {
                id: data.certificate.id,
                attendeeNameMasked: data.certificate.attendeeNameMasked || 'Unknown',
                meetingTitle: data.certificate.meetingTitle || 'Meeting',
                meetingType: data.certificate.meetingType || 'Meeting',
                date: data.certificate.date || null,
                duration: data.certificate.duration || null,
                verified: true
            }
        };
    } catch (error) {
        console.error('WordPress bridge verify error:', error.message);
        return null;
    }
}


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

router.get('/verification-form-metadata', auth, async (req, res) => {
    try {
        const isoDay = new Date().toISOString().slice(0, 10);
        const token = buildMeetingIdDisplay(req.user._id.toString(), process.env.JWT_SECRET, isoDay);
        req.session.attendanceMeetingIdDisplay = token;
        req.session.attendanceMeetingIdDisplayDay = isoDay;
        req.session.attendanceCheckInAt = new Date().toISOString();

        res.json({
            success: true,
            featureEnabled: featureEnabled(),
            meetingIdDisplay: token,
            checkInAt: req.session.attendanceCheckInAt
        });
    } catch (error) {
        console.error('Verification form metadata error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/helper-suggest', auth, helperLimiter, async (req, res) => {
    const startedAt = Date.now();
    try {
        increment('attendance.helper.request');
        if (!featureEnabled()) {
            increment('attendance.helper.unavailable');
            return res.status(404).json({ error: 'Attendance helper unavailable' });
        }

        const suggestions = getSuggestions({
            meetingTopic: req.body?.meetingTopic,
            meetingChairperson: req.body?.meetingChairperson,
            participationInfo: req.body?.participationInfo
        });

        res.json({
            success: true,
            ...suggestions
        });
        increment('attendance.helper.success');
    } catch (error) {
        increment('attendance.helper.failure');
        console.error('Attendance helper suggest error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        observeMs('attendance.helper.latency.ms', Date.now() - startedAt);
    }
});

router.post('/submit-verification-form', auth, async (req, res) => {
    const startedAt = Date.now();
    try {
        increment('attendance.submit.request');
        if (!featureEnabled()) {
            increment('attendance.submit.unavailable');
            return res.status(503).json({ error: 'Attendance verification form is currently disabled' });
        }
        if (requiresAttendanceSubscription() && !req.user?.hasActiveSubscription?.()) {
            increment('attendance.submit.subscription_blocked');
            return res.status(403).json({
                error: 'Active subscription required',
                message: 'Please subscribe to access proof of attendance features'
            });
        }

        const payload = {
            meetingDate: sanitizeText(req.body?.meetingDate, 10),
            meetingTime: sanitizeText(req.body?.meetingTime, 40),
            meetingTopic: sanitizeText(req.body?.meetingTopic, 200),
            meetingChairperson: sanitizeText(req.body?.meetingChairperson, 120),
            participationInfo: sanitizeText(req.body?.participationInfo, 1000),
            fullName: sanitizeText(req.body?.fullName, 120),
            email: sanitizeText(req.body?.email, 255).toLowerCase(),
            sendAdditionalRecipient: sanitizeText(req.body?.sendAdditionalRecipient, 10).toLowerCase(),
            additionalRecipientEmail: sanitizeText(req.body?.additionalRecipientEmail, 255).toLowerCase(),
            meetingIdDisplay: sanitizeText(req.body?.meetingIdDisplay, 64)
        };

        const validationErrors = buildValidationErrors(payload);
        if (Object.keys(validationErrors).length > 0) {
            increment('attendance.submit.validation_error');
            return res.status(400).json({
                error: 'One or more fields have an error. Please check and try again.',
                validationErrors
            });
        }

        const sessionMeetingIdDisplay = req.session?.attendanceMeetingIdDisplay;
        if (!sessionMeetingIdDisplay || payload.meetingIdDisplay !== sessionMeetingIdDisplay) {
            increment('attendance.submit.meeting_id_mismatch');
            return res.status(400).json({
                error: 'Meeting ID validation failed. Refresh the page and try again.'
            });
        }

        const meetingDateNormalized = normalizeDateOnlyUTC(payload.meetingDate);
        if (!meetingDateNormalized) {
            increment('attendance.submit.validation_error');
            return res.status(400).json({
                error: 'One or more fields have an error. Please check and try again.',
                validationErrors: { meetingDateInput: 'The field is required.' }
            });
        }

        if (!isValidEmail(payload.email)) {
            increment('attendance.submit.validation_error');
            return res.status(400).json({
                error: 'One or more fields have an error. Please check and try again.',
                validationErrors: { attendeeEmail: 'The field is required.' }
            });
        }

        const sendAdditionalRecipient = payload.sendAdditionalRecipient === 'yes' || payload.sendAdditionalRecipient === 'true';
        if (sendAdditionalRecipient && !isValidEmail(payload.additionalRecipientEmail)) {
            increment('attendance.submit.validation_error');
            return res.status(400).json({
                error: 'One or more fields have an error. Please check and try again.',
                validationErrors: { extraRecipientEmail: 'The field is required.' }
            });
        }

        const submissionKey = buildSubmissionKey({
            userId: req.user._id.toString(),
            meetingDate: payload.meetingDate,
            meetingTime: payload.meetingTime,
            meetingTopic: payload.meetingTopic
        });

        const submittedAt = new Date();
        const checkInAt = req.session?.attendanceCheckInAt
            ? new Date(req.session.attendanceCheckInAt)
            : parseCheckInAt(payload.meetingDate, payload.meetingTime);

        const existing = await AttendanceSubmission.findOne({ submissionKey });
        let submission;

        if (existing) {
            increment('attendance.submit.duplicate_upsert');
            existing.meetingDate = meetingDateNormalized;
            existing.meetingTimeLabel = payload.meetingTime;
            existing.meetingTopic = payload.meetingTopic;
            existing.meetingChairperson = payload.meetingChairperson;
            existing.participationNotes = payload.participationInfo;
            existing.attendeeFullName = payload.fullName;
            existing.attendeeEmail = payload.email;
            existing.sendAdditionalRecipient = sendAdditionalRecipient;
            existing.additionalRecipientEmail = sendAdditionalRecipient ? payload.additionalRecipientEmail : null;
            existing.meetingIdDisplay = payload.meetingIdDisplay;
            existing.submittedAt = submittedAt;
            existing.checkInAt = checkInAt;
            existing.revision = Number(existing.revision || 1) + 1;
            if (existing.status === 'error') existing.status = 'submitted';
            submission = await existing.save();
        } else {
            increment('attendance.submit.inserted');
            submission = await AttendanceSubmission.create({
                userId: req.user._id,
                submissionKey,
                meetingDate: meetingDateNormalized,
                meetingTimeLabel: payload.meetingTime,
                meetingTopic: payload.meetingTopic,
                meetingChairperson: payload.meetingChairperson,
                participationNotes: payload.participationInfo,
                attendeeFullName: payload.fullName,
                attendeeEmail: payload.email,
                sendAdditionalRecipient,
                additionalRecipientEmail: sendAdditionalRecipient ? payload.additionalRecipientEmail : null,
                meetingIdDisplay: payload.meetingIdDisplay,
                checkInAt,
                submittedAt,
                status: 'submitted',
                revision: 1
            });
        }

        const linkedAttendance = await linkSubmissionToAttendance(submission);
        enqueueAttendanceSubmissionEmails({ submissionId: submission._id.toString(), retries: 2 });
        increment('attendance.submit.success');

        res.json({
            success: true,
            submissionId: submission._id,
            revision: submission.revision,
            linkedCertificateId: linkedAttendance?.certificateId || submission.certificateId || null,
            message: 'Attendance form submitted successfully.'
        });
    } catch (error) {
        increment('attendance.submit.failure');
        console.error('Submit attendance verification form error:', error);
        res.status(500).json({ error: 'Server error submitting attendance form' });
    } finally {
        observeMs('attendance.submit.latency.ms', Date.now() - startedAt);
    }
});

router.post('/wordpress-sync-submission', async (req, res) => {
    try {
        if (!isWordPressSyncAuthorized(req)) {
            return res.status(401).json({ error: 'Unauthorized sync request' });
        }

        const payload = {
            fullName: sanitizeText(req.body?.fullName, 120),
            email: sanitizeText(req.body?.email, 255).toLowerCase(),
            meetingDate: sanitizeText(req.body?.meetingDate, 10),
            meetingTime: sanitizeText(req.body?.meetingTime, 40),
            meetingTopic: sanitizeText(req.body?.meetingTopic, 200),
            meetingChairperson: sanitizeText(req.body?.meetingChairperson, 120),
            participationInfo: sanitizeText(req.body?.participationInfo, 1000),
            sendAdditionalRecipient: sanitizeText(req.body?.sendAdditionalRecipient, 10).toLowerCase(),
            additionalRecipientEmail: sanitizeText(req.body?.additionalRecipientEmail, 255).toLowerCase(),
            meetingIdDisplay: sanitizeText(req.body?.meetingIdDisplay, 64),
            certificateId: sanitizeText(req.body?.certificateId, 191),
            wpSubmissionId: sanitizeText(req.body?.wpSubmissionId, 40)
        };

        const validationErrors = buildValidationErrors(payload);
        if (Object.keys(validationErrors).length > 0) {
            return res.status(400).json({
                error: 'One or more fields have an error. Please check and try again.',
                validationErrors
            });
        }

        if (!isValidEmail(payload.email)) {
            return res.status(400).json({ error: 'Invalid attendee email' });
        }

        const meetingDateNormalized = normalizeDateOnlyUTC(payload.meetingDate);
        if (!meetingDateNormalized) {
            return res.status(400).json({ error: 'Invalid meeting date' });
        }

        const user = await ensureBridgeUser({ fullName: payload.fullName, email: payload.email });
        const submissionKey = buildSubmissionKey({
            userId: user._id.toString(),
            meetingDate: payload.meetingDate,
            meetingTime: payload.meetingTime,
            meetingTopic: payload.meetingTopic
        });

        const sendAdditionalRecipient = payload.sendAdditionalRecipient === 'yes' || payload.sendAdditionalRecipient === 'true';
        const checkInAt = parseCheckInAt(payload.meetingDate, payload.meetingTime);
        const submittedAt = new Date();
        const nextStatus = payload.certificateId ? 'linked' : 'submitted';

        let submission = await AttendanceSubmission.findOne({ submissionKey });
        if (submission) {
            submission.meetingDate = meetingDateNormalized;
            submission.meetingTimeLabel = payload.meetingTime;
            submission.meetingTopic = payload.meetingTopic;
            submission.meetingChairperson = payload.meetingChairperson;
            submission.participationNotes = payload.participationInfo;
            submission.attendeeFullName = payload.fullName;
            submission.attendeeEmail = payload.email;
            submission.sendAdditionalRecipient = sendAdditionalRecipient;
            submission.additionalRecipientEmail = sendAdditionalRecipient ? payload.additionalRecipientEmail : null;
            submission.meetingIdDisplay = payload.meetingIdDisplay || payload.wpSubmissionId || submission.meetingIdDisplay;
            submission.checkInAt = checkInAt;
            submission.submittedAt = submittedAt;
            submission.certificateId = payload.certificateId || submission.certificateId;
            submission.status = payload.certificateId ? 'linked' : submission.status;
            submission.revision = Number(submission.revision || 1) + 1;
            await submission.save();
        } else {
            submission = await AttendanceSubmission.create({
                userId: user._id,
                submissionKey,
                meetingDate: meetingDateNormalized,
                meetingTimeLabel: payload.meetingTime,
                meetingTopic: payload.meetingTopic,
                meetingChairperson: payload.meetingChairperson,
                participationNotes: payload.participationInfo,
                attendeeFullName: payload.fullName,
                attendeeEmail: payload.email,
                sendAdditionalRecipient,
                additionalRecipientEmail: sendAdditionalRecipient ? payload.additionalRecipientEmail : null,
                meetingIdDisplay: payload.meetingIdDisplay || payload.wpSubmissionId || buildMeetingIdDisplay(user._id.toString(), process.env.JWT_SECRET, payload.meetingDate),
                checkInAt,
                submittedAt,
                certificateId: payload.certificateId || null,
                status: nextStatus,
                revision: 1
            });
        }

        return res.json({
            success: true,
            synced: true,
            submissionId: submission._id,
            revision: submission.revision,
            canonicalCertificateId: submission.certificateId || null
        });
    } catch (error) {
        console.error('WordPress sync submission error:', error);
        return res.status(500).json({ error: 'Server error syncing WordPress submission' });
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
        const certificateId = crypto.randomUUID();
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
            const submission = await AttendanceSubmission.findOne({ certificateId: req.params.certificateId })
                .sort({ submittedAt: -1 })
                .select('certificateId attendeeFullName meetingTopic meetingTimeLabel meetingDate');

            if (submission) {
                return res.json({
                    success: true,
                    verified: true,
                    certificate: {
                        id: submission.certificateId,
                        attendeeNameMasked: maskName(submission.attendeeFullName || 'Unknown'),
                        meetingTitle: submission.meetingTopic || 'Meeting',
                        meetingType: 'Meeting',
                        date: submission.meetingDate,
                        duration: null,
                        verified: true
                    }
                });
            }

            const wpBridgeResult = await verifyViaWordPressBridge(req.params.certificateId);
            if (wpBridgeResult) {
                return res.json(wpBridgeResult);
            }

            return res.status(404).json({ error: 'Certificate not found' });
        }

        let attendeeNameMasked = attendance.attendeeFullNameMasked || null;
        if (!attendeeNameMasked && attendance.submissionId) {
            const submission = await AttendanceSubmission.findById(attendance.submissionId).select('attendeeFullName');
            if (submission?.attendeeFullName) attendeeNameMasked = maskName(submission.attendeeFullName);
        }
        if (!attendeeNameMasked) {
            attendeeNameMasked = maskName(attendance.userId?.chatName || 'Unknown');
        }

        res.json({
            success: true,
            verified: true,
            certificate: {
                id: attendance.certificateId,
                attendeeNameMasked,
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
