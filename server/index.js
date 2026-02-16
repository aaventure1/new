require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const attendanceRoutes = require('./routes/attendance');
const subscriptionRoutes = require('./routes/subscription');

const wordpressRoutes = require('./routes/wordpress');
const adminRoutes = require('./routes/admin');
const serenityRoutes = require('./routes/serenity');
const sponsorshipRoutes = require('./routes/sponsorship');
const milestoneRoutes = require('./routes/milestones');
const { syncWordPressPosts } = require('./utils/blogAutomation');
const { ensureDefaultMeetings } = require('./utils/meetingBootstrap');

const Message = require('./models/Message');
const User = require('./models/User');
const packageInfo = require('../package.json');

const app = express();
const server = http.createServer(app);
const isServerlessRuntime = process.env.VERCEL === '1';

const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/$/, '');
const configuredOrigins = Array.from(new Set([
    process.env.CLIENT_URL,
    process.env.BASE_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(',')
]
    .map(normalizeOrigin)
    .filter(Boolean)));

const isOriginAllowed = (origin) => {
    if (!origin) return true; // non-browser clients (curl, health checks)
    if (configuredOrigins.includes('*')) return true;
    if (configuredOrigins.length === 0) return true; // safe fallback for single-origin deploys
    return configuredOrigins.includes(normalizeOrigin(origin));
};

const corsOriginHandler = (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed: ${origin}`));
};

const io = socketIo(server, {
    cors: {
        origin: corsOriginHandler,
        credentials: true
    }
});

if (process.env.NODE_ENV === 'production') {
    // Required for secure cookies when deployed behind Render/NGINX style proxies.
    app.set('trust proxy', 1);

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-in-production')) {
        console.warn('⚠️ JWT_SECRET is not set to a production-safe value.');
    }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('change-in-production')) {
        console.warn('⚠️ SESSION_SECRET is not set to a production-safe value.');
    }
}

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aaventure';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        try {
            const created = await ensureDefaultMeetings();
            if (created > 0) {
                console.log(`✅ Seeded ${created} default meetings`);
            }
        } catch (error) {
            console.error('Meeting bootstrap error:', error);
        }

        try {
            await syncWordPressPosts();
        } catch (error) {
            console.error('WordPress startup sync error:', error);
        }
    })
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Middleware
app.disable('x-powered-by');
app.use(cors({
    origin: corsOriginHandler,
    credentials: true
}));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    next();
});

let sessionStore;
try {
    sessionStore = MongoStore.create({
        mongoUrl: MONGODB_URI,
        touchAfter: 24 * 3600
    });
    sessionStore.on('error', (error) => {
        console.error('Session store error:', error);
    });
} catch (error) {
    console.error('Failed to initialize Mongo session store. Falling back to in-memory sessions.', error);
}

// Session configuration
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    ...(sessionStore ? { store: sessionStore } : {}),
    proxy: process.env.NODE_ENV === 'production',
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
});

app.use(sessionMiddleware);
const jsonParser = express.json({ limit: '1mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '1mb' });

app.use((req, res, next) => {
    // Stripe requires raw request bodies for webhook signature verification.
    if (req.originalUrl.startsWith('/api/subscription/webhook')) return next();
    return jsonParser(req, res, next);
});

app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/subscription/webhook')) return next();
    return urlencodedParser(req, res, next);
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/certificates', express.static(path.join(__dirname, '../public/certificates')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/subscription', subscriptionRoutes);

app.use('/api/wordpress', wordpressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/serenity', serenityRoutes);
app.use('/api/sponsorship', sponsorshipRoutes);
app.use('/api/milestones', milestoneRoutes);

// Socket.io for real-time chat
const activeUsers = new Map(); // roomId -> Set of users

// Share session with socket.io
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);

    // Join room
    socket.on('join-room', async ({ roomId, userId, chatName }) => {
        try {
            const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
            const safeChatName = typeof chatName === 'string' ? chatName.trim().slice(0, 60) : '';

            if (!safeRoomId || !safeChatName || !mongoose.Types.ObjectId.isValid(userId)) {
                socket.emit('error', { message: 'Invalid room join request' });
                return;
            }

            const user = await User.findById(userId).select('_id isAdmin');
            if (!user) {
                socket.emit('error', { message: 'User not found' });
                return;
            }

            socket.join(safeRoomId);
            socket.currentRoom = safeRoomId;
            socket.userId = userId;
            socket.chatName = safeChatName;
            socket.isAdmin = Boolean(user.isAdmin);

            // Add to active users
            if (!activeUsers.has(safeRoomId)) {
                activeUsers.set(safeRoomId, new Set());
            }
            activeUsers.get(safeRoomId).add({ userId, chatName: safeChatName, socketId: socket.id });

            // Load recent messages (last 50)
            const recentMessages = await Message.find({ roomId: safeRoomId })
                .sort({ timestamp: -1 })
                .limit(50)
                .lean();

            socket.emit('message-history', recentMessages.reverse());

            // Notify room of new user
            const systemMessage = {
                roomId: safeRoomId,
                userId: 'system',
                username: 'System',
                chatName: 'System',
                message: `${safeChatName} joined the room`,
                timestamp: new Date(),
                isSystemMessage: true
            };

            io.to(safeRoomId).emit('user-joined', {
                userId,
                chatName: safeChatName,
                activeCount: activeUsers.get(safeRoomId).size
            });

            io.to(safeRoomId).emit('new-message', systemMessage);

            // Send active users list
            const activeUsersList = Array.from(activeUsers.get(safeRoomId)).map(u => ({
                userId: u.userId,
                chatName: u.chatName
            }));
            io.to(safeRoomId).emit('active-users', activeUsersList);

            console.log(`✅ ${safeChatName} joined room ${safeRoomId}`);
        } catch (error) {
            console.error('Join room error:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Send message
    socket.on('send-message', async ({ roomId, userId, username, chatName, message }) => {
        try {
            const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
            const safeMessage = typeof message === 'string' ? message.trim() : '';
            const safeChatName = typeof chatName === 'string' ? chatName.trim().slice(0, 60) : 'Member';
            const safeUsername = typeof username === 'string' ? username.trim().slice(0, 60) : safeChatName;

            if (!safeRoomId || !safeMessage) return;
            if (safeMessage.length > 2000) {
                socket.emit('error', { message: 'Message is too long (max 2000 characters)' });
                return;
            }

            // Save message to database
            const newMessage = new Message({
                roomId: safeRoomId,
                userId,
                username: safeUsername,
                chatName: safeChatName,
                message: safeMessage,
                timestamp: new Date()
            });

            await newMessage.save();

            // Broadcast to room
            io.to(safeRoomId).emit('new-message', {
                roomId: safeRoomId,
                userId,
                username: safeUsername,
                chatName: safeChatName,
                message: safeMessage,
                timestamp: newMessage.timestamp,
                isSystemMessage: false
            });

            console.log(`💬 Message in ${safeRoomId} from ${safeChatName}: ${safeMessage.substring(0, 50)}...`);
        } catch (error) {
            console.error('Send message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Typing indicator
    socket.on('typing', ({ roomId, chatName }) => {
        socket.to(roomId).emit('user-typing', { chatName });
    });

    socket.on('stop-typing', ({ roomId, chatName }) => {
        socket.to(roomId).emit('user-stop-typing', { chatName });
    });

    // Raise hand
    socket.on('raise-hand', ({ roomId, chatName }) => {
        io.to(roomId).emit('hand-raised', { chatName });
    });

    socket.on('lower-hand', ({ roomId, chatName }) => {
        io.to(roomId).emit('hand-lowered', { chatName });
    });

    // WebRTC Signaling for Video Chat
    socket.on('video-offer', ({ roomId, offer, to }) => {
        socket.to(to).emit('video-offer', { from: socket.id, offer, chatName: socket.chatName });
    });

    socket.on('video-answer', ({ roomId, answer, to }) => {
        socket.to(to).emit('video-answer', { from: socket.id, answer });
    });

    socket.on('new-ice-candidate', ({ roomId, candidate, to }) => {
        socket.to(to).emit('new-ice-candidate', { from: socket.id, candidate });
    });

    socket.on('toggle-video', ({ roomId, isVideoOn }) => {
        socket.to(roomId).emit('user-video-toggled', { socketId: socket.id, isVideoOn });
    });

    socket.on('toggle-audio', ({ roomId, isAudioOn }) => {
        socket.to(roomId).emit('user-audio-toggled', { socketId: socket.id, isAudioOn });
    });

    socket.on('request-video-connections', ({ roomId }) => {
        socket.to(roomId).emit('request-video-connections', { from: socket.id, chatName: socket.chatName });
    });

    // Share prayer/reading
    socket.on('share-reading', ({ roomId, title, content }) => {
        io.to(roomId).emit('reading-shared', { title, content });
    });

    // Global Announcements (Admin Only)
    socket.on('send-announcement', async ({ message }) => {
        try {
            const user = await User.findById(socket.userId);
            if (!user || !user.isAdmin) return;
            const announcementMessage = typeof message === 'string' ? message.trim() : '';
            if (!announcementMessage) return;
            if (announcementMessage.length > 400) {
                socket.emit('error', { message: 'Announcement is too long (max 400 characters)' });
                return;
            }

            const announcement = new Message({
                roomId: 'global',
                userId: user._id,
                username: user.username,
                chatName: 'ADMIN',
                message: announcementMessage,
                type: 'announcement'
            });
            await announcement.save();

            io.emit('new-announcement', {
                message: announcementMessage,
                chatName: 'System Announcement',
                timestamp: announcement.timestamp
            });
        } catch (error) {
            console.error('Announcement error:', error);
        }
    });

    // Safety Reporting
    socket.on('report-user', async ({ roomId, targetChatName, reason }) => {
        try {
            const reporter = await User.findById(socket.userId);
            const safeRoomId = typeof roomId === 'string' ? roomId.trim() : 'unknown-room';
            const safeTarget = typeof targetChatName === 'string' ? targetChatName.trim().slice(0, 60) : 'Unknown';
            const safeReason = typeof reason === 'string' ? reason.trim().slice(0, 300) : 'No reason provided';
            const reportMessage = `SAFETY REPORT: ${reporter ? reporter.chatName : 'Unknown'} reported ${safeTarget} in ${safeRoomId}. Reason: ${safeReason}`;

            const alert = new Message({
                roomId: 'admin-alerts',
                userId: socket.userId || 'system',
                username: 'safety-bot',
                chatName: 'Safety Bot',
                message: reportMessage,
                type: 'alert'
            });
            await alert.save();

            // Notify all online admins
            io.sockets.sockets.forEach(s => {
                if (s.isAdmin) {
                    s.emit('admin-alert', {
                        type: 'safety_report',
                        message: reportMessage,
                        roomId: safeRoomId,
                        timestamp: alert.timestamp
                    });
                }
            });

            socket.emit('report-submitted', { success: true });
        } catch (error) {
            console.error('Report error:', error);
        }
    });

    // Leave room
    socket.on('leave-room', ({ roomId, chatName }) => {
        handleUserLeave(socket, roomId, chatName);
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (socket.currentRoom && socket.chatName) {
            handleUserLeave(socket, socket.currentRoom, socket.chatName);
        }
        console.log('👋 User disconnected:', socket.id);
    });
});

function handleUserLeave(socket, roomId, chatName) {
    const safeRoomId = typeof roomId === 'string' ? roomId.trim() : '';
    const safeChatName = typeof chatName === 'string' ? chatName.trim().slice(0, 60) : 'Member';
    if (!safeRoomId) return;

    socket.leave(safeRoomId);

    // Remove from active users
    if (activeUsers.has(safeRoomId)) {
        const roomUsers = activeUsers.get(safeRoomId);
        roomUsers.forEach(user => {
            if (user.socketId === socket.id) {
                roomUsers.delete(user);
            }
        });

        // Notify room
        const systemMessage = {
            roomId: safeRoomId,
            userId: 'system',
            username: 'System',
            chatName: 'System',
            message: `${safeChatName} left the room`,
            timestamp: new Date(),
            isSystemMessage: true
        };

        io.to(safeRoomId).emit('user-left', {
            chatName: safeChatName,
            socketId: socket.id,
            activeCount: roomUsers.size
        });

        io.to(safeRoomId).emit('new-message', systemMessage);

        // Send updated active users list
        const activeUsersList = Array.from(roomUsers).map(u => ({
            userId: u.userId,
            chatName: u.chatName
        }));
        io.to(safeRoomId).emit('active-users', activeUsersList);

        if (roomUsers.size === 0) {
            activeUsers.delete(safeRoomId);
        }
    }

    console.log(`👋 ${safeChatName} left room ${safeRoomId}`);
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'AAVenture server is running',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptimeSeconds: Math.round(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        version: packageInfo.version,
        timestamp: new Date().toISOString()
    });
});

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    if (err?.message?.startsWith('Origin not allowed:')) {
        return res.status(403).json({ error: 'Request origin is not allowed' });
    }
    console.error('Unhandled server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
});

// Serve index.html for all other routes (SPA)
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;

if (!isServerlessRuntime) {
    server.listen(PORT, () => {
        console.log(`\n🚀 AAVenture Server running on port ${PORT}`);
        console.log(`📱 Access at: http://localhost:${PORT}`);
        console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⏳ Connecting...'}`);
        if (configuredOrigins.length > 0) {
            console.log(`🌐 Allowed origins: ${configuredOrigins.join(', ')}`);
        } else {
            console.log('🌐 Allowed origins: any (no explicit origin list configured)');
        }
    });
}

module.exports = { app, server, io };
