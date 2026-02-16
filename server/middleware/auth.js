const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Check for token in header or session
        let token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token && req.session && req.session.token) {
            token = req.session.token;
        }

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid authentication token' });
    }
};

const requireSubscription = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!req.user.hasActiveSubscription()) {
            return res.status(403).json({
                error: 'Active subscription required',
                message: 'Please subscribe to access proof of attendance features'
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

const admin = async (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
        // If not already authenticated by previous middleware, try to authenticate now
        return auth(req, res, () => {
            if (req.user && req.user.isAdmin) {
                next();
            } else {
                res.status(403).json({ error: 'Access denied. Admin privileges required.' });
            }
        });
    }

    // Checking if authenticated user is admin
    if (req.user.isAdmin) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
};

module.exports = { auth, requireSubscription, adminAuth: admin };
