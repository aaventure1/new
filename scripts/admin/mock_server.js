const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock Database
const users = [];
const meetings = [
    { _id: '1', title: 'AA Morning Reflection', type: 'AA', format: 'text', roomId: 'aa', isActive: true },
    { _id: '2', title: 'NA Evening Hope', type: 'NA', format: 'video', roomId: 'na', zoomLink: 'https://zoom.us/j/123', isActive: true }
];
const messages = [];

// Mock API Routes
app.post('/api/auth/register', (req, res) => {
    const { username, email, chatName, password } = req.body;
    const user = { id: uuidv4(), username, email, chatName, xp: 0, level: 1, streaks: { current: 0 }, badges: [] };
    users.push(user);
    res.json({ success: true, user });
});

app.post('/api/auth/login', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email) || { id: 'mock-id', chatName: 'MockUser', xp: 10, level: 1, streaks: { current: 1 }, badges: [] };
    res.json({ success: true, user });
});

app.get('/api/auth/me', (req, res) => {
    res.json({ user: users[0] || null });
});

app.get('/api/meetings', (req, res) => {
    res.json({ success: true, meetings });
});

app.get('/api/wordpress/posts', (req, res) => {
    res.json([{ title: 'Welcome to Recovery', excerpt: 'One day at a time...', date: new Date() }]);
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Mock server running', mongodb: 'mocked' });
});

// Mock Socket.io
io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, chatName }) => {
        socket.join(roomId);
        io.to(roomId).emit('new-message', { chatName: 'System', message: `${chatName} joined`, isSystemMessage: true });
    });
    socket.on('send-message', (data) => {
        io.to(data.roomId).emit('new-message', { ...data, timestamp: new Date() });
    });
});

// Serve index.html for all other routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = 3001; // Use a different port for the mock walkthrough
server.listen(PORT, () => {
    console.log(`Mock AAVenture Server running on port ${PORT}`);
});
