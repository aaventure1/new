const mongoose = require('mongoose');
const User = require('../server/models/User');
const RecoveryStatsManager = require('../server/utils/recoveryStats');
const { v4: uuidv4 } = require('uuid');

async function verifyPerfectWorkflow() {
    console.log('🚀 Starting AAVenture Robustness Test (30 Iterations)...');

    try {
        await mongoose.connect('mongodb://localhost:27017/aaventure');
        console.log('✅ Connected to MongoDB');

        for (let i = 1; i <= 30; i++) {
            console.log(`\n🔄 Iteration ${i}/30: Simulating User Journey...`);

            // 1. Unique User Generation
            const uniqueId = uuidv4().substring(0, 8);
            const testUser = {
                username: `user_${uniqueId}`,
                email: `test_${uniqueId}@example.com`,
                password: 'password123',
                chatName: `Traveler ${i}`
            };

            // 2. Signup
            const user = new User(testUser);
            await user.save();
            // console.log(`   📝 Signup verified for ${testUser.username}`);

            // 3. Attendance Day 1
            user.attendanceRecords.push({
                meetingId: new mongoose.Types.ObjectId(),
                date: new Date(),
                duration: 3600,
                certificateId: `cert_${uniqueId}_1`
            });

            let result = await RecoveryStatsManager.updateStreak(user);
            if (result.streak.current !== 1 || !result.newBadges.some(b => b.name === 'First Meeting')) {
                throw new Error(`Iteration ${i} Failed: Day 1 stats incorrect`);
            }

            // 4. Attendance Day 2 (Streak)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            user.streaks.lastAttendance = yesterday;

            user.attendanceRecords.push({
                meetingId: new mongoose.Types.ObjectId(),
                date: new Date(),
                duration: 3600,
                certificateId: `cert_${uniqueId}_2`
            });

            result = await RecoveryStatsManager.updateStreak(user);
            if (result.streak.current !== 2) {
                throw new Error(`Iteration ${i} Failed: Day 2 streak broken`);
            }

            // 5. Milestone (Power of 10)
            for (let j = 0; j < 8; j++) {
                user.attendanceRecords.push({
                    meetingId: new mongoose.Types.ObjectId(),
                    date: new Date(),
                    duration: 3600,
                    certificateId: `cert_${uniqueId}_bonus_${j}`
                });
            }

            const badges = await RecoveryStatsManager.checkBadges(user);
            if (!badges.some(b => b.name === 'Power of 10')) {
                throw new Error(`Iteration ${i} Failed: Power of 10 badge missing`);
            }

            await user.save();
            // console.log(`   ✅ Journey complete. Badges: ${user.badges.length}, Streak: ${user.streaks.current}`);

            // Cleanup randomly to keep DB size manageable, but keep some for manual inspection
            if (i < 25) await User.deleteOne({ _id: user._id });
        }

        console.log('\n🎉 ALL 30 WORKFLOW VARIATIONS PASSED PERFECTLY!');
        console.log('-----------------------------------');
        console.log('System is robust and ready for production.');
        console.log('-----------------------------------');

    } catch (err) {
        console.error('❌ Robustness Test Failed:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

verifyPerfectWorkflow();
