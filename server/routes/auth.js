const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendWelcomeEmail } = require('../utils/emailUtils');
const SoberGuard = require('../utils/soberGuard');
const RecoveryStatsManager = require('../utils/recoveryStats');

const registerLimiter = createRateLimiter({
    key: 'auth-register',
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many registration attempts. Please wait a few minutes and try again.'
});

const loginLimiter = createRateLimiter({
    key: 'auth-login',
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many login attempts. Please wait a few minutes and try again.'
});

// Register new user
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password, chatName } = req.body;
        const normalizedUsername = typeof username === 'string' ? username.trim() : '';
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const normalizedChatName = typeof chatName === 'string' ? chatName.trim() : '';

        // Validation
        if (!normalizedUsername || !normalizedEmail || !password || !normalizedChatName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email or username' });
        }

        // Create new user
        const user = new User({
            username: normalizedUsername,
            email: normalizedEmail,
            password,
            chatName: normalizedChatName
        });

        await user.save();

        // Send welcome email (non-blocking)
        sendWelcomeEmail(user.email, user.chatName).catch(err => console.error('Welcome email error:', err));

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '7d' }
        );

        // Store token in session
        req.session.token = token;
        req.session.userId = user._id.toString();

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                chatName: user.chatName,
                subscription: user.subscription,
                isAdmin: user.isAdmin,
                hasActiveSubscription: user.hasActiveSubscription()
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        if (error && error.code === 11000) {
            return res.status(400).json({ error: 'User already exists with this email or username' });
        }
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';

        if (!normalizedEmail || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '7d' }
        );

        // Store token in session
        req.session.token = token;
        req.session.userId = user._id.toString();

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                chatName: user.chatName,
                subscription: user.subscription,
                isAdmin: user.isAdmin,
                hasActiveSubscription: user.hasActiveSubscription()
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                username: req.user.username,
                email: req.user.email,
                chatName: req.user.chatName,
                subscription: req.user.subscription,
                subscriptionExpiry: req.user.subscriptionExpiry,
                isAdmin: req.user.isAdmin,
                hasActiveSubscription: req.user.hasActiveSubscription(),
                attendanceCount: req.user.attendanceRecords.length,
                xp: req.user.xp,
                level: req.user.level
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout
router.post('/logout', auth, async (req, res) => {
    try {
        req.session.destroy();
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Server error during logout' });
    }
});

// Neural Sober-Guard Analysis
router.get('/guard-status', auth, async (req, res) => {
    try {
        const riskScore = SoberGuard.analyzeRisk(req.user);
        const intervention = SoberGuard.getIntervention(riskScore);

        res.json({
            success: true,
            riskScore,
            ...intervention
        });
    } catch (error) {
        console.error('Sober-Guard analysis error:', error);
        res.status(500).json({ error: 'Sober-Guard analysis failed' });
    }
});

// Gamification: Award XP
router.post('/award-xp', auth, async (req, res) => {
    try {
        const { amount, source } = req.body;
        const result = await RecoveryStatsManager.awardXP(req.user, amount || 10, source || 'Community Engagement');
        await req.user.save();

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('XP Award error:', error);
        res.status(500).json({ error: 'Failed to award XP' });
    }
});

// Privacy Toggle
router.post('/privacy-toggle', auth, async (req, res) => {
    try {
        req.user.anonymousMode = !req.user.anonymousMode;

        // Update privacy settings based on mode
        if (req.user.anonymousMode) {
            req.user.privacySettings.hideProfile = true;
            req.user.privacySettings.hideSobrietyDate = true;
        }

        await req.user.save();

        res.json({
            success: true,
            anonymousMode: req.user.anonymousMode,
            message: `Anonymous mode ${req.user.anonymousMode ? 'enabled' : 'disabled'}`
        });
    } catch (error) {
        console.error('Privacy toggle error:', error);
        res.status(500).json({ error: 'Failed to toggle privacy mode' });
    }
});

module.exports = router;
