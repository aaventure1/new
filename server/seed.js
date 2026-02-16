require('dotenv').config();
const mongoose = require('mongoose');
const Meeting = require('./models/Meeting');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aaventure';

// REAL-WORLD & Simulated Meetings Data
const meetings = [
    // --- Internal Text Chat Rooms (24/7) ---
    {
        title: 'AA Daily Chat',
        type: 'AA',
        format: 'text',
        roomId: 'aa',
        description: '24/7 Alcoholics Anonymous support chat room. Always open.',
        isExternal: false,
        source: 'Internal',
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        isActive: true
    },
    {
        title: 'NA Recovery Room',
        type: 'NA',
        format: 'text',
        roomId: 'na',
        description: '24/7 Narcotics Anonymous support chat room.',
        isExternal: false,
        source: 'Internal',
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        isActive: true
    },
    {
        title: 'Open Recovery & Serenity',
        type: 'Open',
        format: 'text',
        roomId: 'open',
        description: 'All fellowships welcome. Smart Recovery, Dharma, etc.',
        isExternal: false,
        source: 'Internal',
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        isActive: true
    },

    // --- EXTERNAL LIVE STREAMS (Real Links) ---
    {
        title: '24/7 AA International Marathon',
        type: 'AA',
        format: 'video',
        roomId: 'aa-intl-247',
        description: 'Live continuous meeting via Zoom. Hosted by 247aaonline.com',
        isExternal: true,
        source: 'Zoom',
        zoomLink: 'https://us02web.zoom.us/j/2923712604', // Public 24/7 AA Zoom ID
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        isActive: true
    },
    {
        title: 'NA Global 24/7 Marathon',
        type: 'NA',
        format: 'video',
        roomId: 'na-global-247',
        description: 'Non-stop Narcotics Anonymous meeting from around the world.',
        isExternal: true,
        source: 'Zoom',
        zoomLink: 'https://us02web.zoom.us/j/4949655895', // Public 24/7 NA Zoom ID
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        isActive: true
    },
    {
        title: '319 AA Group (24/7)',
        type: 'AA',
        format: 'video',
        roomId: 'aa-319-group',
        description: 'One of the largest 24/7 online AA groups.',
        isExternal: true,
        source: 'Zoom',
        zoomLink: 'https://us02web.zoom.us/j/376241908', // Public 319 Group
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        isActive: true
    },
    
    // --- Scheduled Internal Meetings (Hybrid/Video) ---
    {
        title: 'Newcomers Orientation',
        type: 'Open',
        format: 'video',
        roomId: 'newcomers-daily',
        description: 'Introduction to AAVenture and recovery basics.',
        isExternal: false,
        source: 'Internal',
        schedule: { dayOfWeek: 1, time: '19:00', recurring: true },
        isActive: true
    },
    {
        title: 'Saturday Night Speaker',
        type: 'AA',
        format: 'video',
        roomId: 'sat-night-speaker',
        description: 'Weekly speaker sharing their experience, strength, and hope.',
        isExternal: false,
        source: 'Internal',
        schedule: { dayOfWeek: 6, time: '20:00', recurring: true },
        isActive: true
    }
];

async function seedDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🗑️  Clearing existing meetings...');
        await Meeting.deleteMany({});

        console.log('📝 Creating meetings...');
        await Meeting.insertMany(meetings);

        console.log('✅ Database seeded successfully!');
        console.log(`📊 Created ${meetings.length} meetings`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();