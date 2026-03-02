const Meeting = require('../models/Meeting');

const DEFAULT_MEETINGS = [
    {
        title: 'AA Daily Chat',
        type: 'AA',
        format: 'text',
        roomId: 'aa',
        description: '24/7 Alcoholics Anonymous support chat room.',
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        source: 'Internal',
        isExternal: false,
        isActive: true
    },
    {
        title: 'NA Recovery Room',
        type: 'NA',
        format: 'text',
        roomId: 'na',
        description: '24/7 Narcotics Anonymous support chat room.',
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        source: 'Internal',
        isExternal: false,
        isActive: true
    },
    {
        title: 'Open Recovery & Serenity',
        type: 'Open',
        format: 'text',
        roomId: 'open',
        description: 'All fellowships welcome. Smart Recovery, Dharma, and peer support.',
        schedule: { dayOfWeek: 0, time: '00:00', recurring: true },
        source: 'Internal',
        isExternal: false,
        isActive: true
    },
    {
        title: 'Newcomers Orientation',
        type: 'Open',
        format: 'video',
        roomId: 'newcomers-daily',
        description: 'Introduction to AAVenture and recovery basics.',
        schedule: { dayOfWeek: 1, time: '19:00', recurring: true },
        source: 'Internal',
        isExternal: false,
        isActive: true
    }
];

async function ensureDefaultMeetings() {
    const activeCount = await Meeting.countDocuments({ isActive: true });
    if (activeCount > 0) return 0;

    await Meeting.insertMany(DEFAULT_MEETINGS, { ordered: false });
    return DEFAULT_MEETINGS.length;
}

module.exports = {
    ensureDefaultMeetings
};

