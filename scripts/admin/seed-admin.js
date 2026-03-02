const mongoose = require('mongoose');
const User = require('./server/models/User');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aaventure';

async function createAdmin() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const adminUser = new User({
            username: 'admin',
            email: 'admin@aaventure.com',
            password: 'password123', // Will be hashed by pre-save hook
            chatName: 'Admin',
            isAdmin: true,
            subscription: 'premium',
            subscriptionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        });

        await adminUser.save();
        console.log('✅ Admin user created: admin / password123');
        process.exit(0);
    } catch (error) {
        if (error.code === 11000) {
            console.log('⚠️  Admin user already exists');
        } else {
            console.error('❌ Error:', error);
        }
        process.exit(1);
    }
}

createAdmin();
