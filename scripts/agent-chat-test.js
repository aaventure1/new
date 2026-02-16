const { io } = require('socket.io-client');
const mongoose = require('mongoose');
const User = require('../server/models/User');
const { v4: uuidv4 } = require('uuid');

const SERVER_URL = 'http://localhost:3000';
const ROOM_ID = 'aa';

async function runAgentTest() {
    console.log('🤖 Starting Multi-Agent Interaction Test...');

    try {
        await mongoose.connect('mongodb://localhost:27017/aaventure');
        console.log('✅ Connected to MongoDB');

        const agents = [
            { name: 'Agent Alpha', color: '\x1b[32m' },
            { name: 'Agent Beta', color: '\x1b[34m' },
            { name: 'Agent Gamma', color: '\x1b[35m' }
        ];

        const sockets = [];

        for (const agent of agents) {
            console.log(`\n👤 Creating ${agent.name}...`);

            // 1. Create/Register Agent in DB
            const uniqueId = uuidv4().substring(0, 6);
            const userData = {
                username: `agent_${uniqueId}`,
                email: `agent_${uniqueId}@aaventure.test`,
                password: 'password123',
                chatName: agent.name
            };

            const user = new User(userData);
            await user.save();
            agent.userId = user._id.toString();
            agent.username = user.username;

            // 2. Connect to Socket.io
            const socket = io(SERVER_URL, {
                reconnection: false,
                forceNew: true
            });

            sockets.push(socket);

            socket.on('connect', () => {
                console.log(`${agent.color}${agent.name} connected to socket server\x1b[0m`);

                // 3. Join Room
                socket.emit('join-room', {
                    roomId: ROOM_ID,
                    userId: agent.userId,
                    chatName: agent.name
                });
            });

            socket.on('new-message', (data) => {
                if (!data.isSystemMessage) {
                    console.log(`${agent.color}[${agent.name} Received] ${data.chatName}: ${data.message}\x1b[0m`);
                } else {
                    console.log(`\x1b[90m[${agent.name} System] ${data.message}\x1b[0m`);
                }
            });
        }

        // Wait for connections and joins
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('\n💬 Starting Agent Conversation...\n');

        const script = [
            { agentIdx: 0, text: "Hello everyone, Alpha here. Glad to be in this meeting today." },
            { agentIdx: 1, text: "Hi Alpha! This is Beta. Welcome." },
            { agentIdx: 2, text: "Gamma here. Nice to see you both. How is everyone's day going?" },
            { agentIdx: 0, text: "Doing great. Just for today, I am staying sober." },
            { agentIdx: 1, text: "Same here. One day at a time!" },
            { agentIdx: 2, text: "Awesome. I love this community vibe." }
        ];

        for (const line of script) {
            const agent = agents[line.agentIdx];
            const socket = sockets[line.agentIdx];

            socket.emit('send-message', {
                roomId: ROOM_ID,
                userId: agent.userId,
                username: agent.username,
                chatName: agent.name,
                message: line.text
            });

            // Small delay between messages for realistic flow
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        console.log('\n✅ Conversation Finished.');

        // Final check on active users list (optional but good)
        sockets[0].on('active-users', (users) => {
            console.log(`\n👥 Current Active Users in ${ROOM_ID}:`, users.map(u => u.chatName).join(', '));
        });

        // Keep session open briefly to see final logs
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Cleanup
        console.log('\n🧹 Cleaning up agents...');
        for (const socket of sockets) {
            socket.disconnect();
        }

        // Optional: Remove test users from DB
        // for (const agent of agents) {
        //     await User.deleteOne({ _id: agent.userId });
        // }

        console.log('✨ Test Complete.');
        process.exit(0);

    } catch (err) {
        console.error('❌ Test Execution Failed:', err);
        process.exit(1);
    }
}

runAgentTest();
