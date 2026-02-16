/**
 * Utility for handling gamification (streaks and badges)
 */

const User = require('../models/User');

class RecoveryStatsManager {
    /**
     * Updates a user's attendance streak
     * @param {Object} user User document
     */
    static async updateStreak(user) {
        const now = new Date();
        const lastAttendance = user.streaks.lastAttendance;

        if (!lastAttendance) {
            // First time
            user.streaks.current = 1;
            user.streaks.longest = 1;
        } else {
            const diffTime = Math.abs(now - lastAttendance);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Continuous streak (yesterday)
                user.streaks.current += 1;
                if (user.streaks.current > user.streaks.longest) {
                    user.streaks.longest = user.streaks.current;
                }
            } else if (diffDays > 1) {
                // Streak broken
                user.streaks.current = 1;
            }
            // If diffDays === 0, same day, current streak stays the same
        }

        user.streaks.lastAttendance = now;

        // Check for new badges
        const newBadges = await this.checkBadges(user);

        await user.save();
        return {
            streak: user.streaks,
            newBadges: newBadges
        };
    }

    /**
     * Checks if user has earned new badges
     * @param {Object} user User document
     */
    static async checkBadges(user) {
        const newBadges = [];
        const currentBadgeNames = user.badges.map(b => b.name);

        const badgeDefinitions = [
            { name: 'First Meeting', icon: '🐣', condition: u => u.attendanceRecords.length >= 1, desc: 'Attended your first recovery meeting!' },
            { name: 'Power of 10', icon: '⭐', condition: u => u.attendanceRecords.length >= 10, desc: 'Attended 10 recovery meetings.' },
            { name: 'Silver Member', icon: '🥈', condition: u => u.attendanceRecords.length >= 25, desc: 'Attended 25 recovery meetings.' },
            { name: 'Gold Member', icon: '🥇', condition: u => u.attendanceRecords.length >= 50, desc: 'Attended 50 recovery meetings.' },
            { name: 'Platinum Fellowship', icon: '💎', condition: u => u.attendanceRecords.length >= 100, desc: 'Attended 100 recovery meetings.' },
            { name: 'Early Bird', icon: '🌅', condition: u => u.attendanceRecords.some(r => new Date(r.date).getHours() < 9), desc: 'Attended a morning meeting.' },
            { name: 'Night Owl', icon: '🦉', condition: u => u.attendanceRecords.some(r => new Date(r.date).getHours() >= 21), desc: 'Attended a late-night meeting.' },
            { name: 'Century Club', icon: '💯', condition: u => u.attendanceRecords.length >= 100, desc: '100 Meetings Attended!' },
            { name: 'XP Collector', icon: '📈', condition: u => u.level >= 5, desc: 'Reached Level 5 in Evolution.' },
            { name: '3-Day Streak', icon: '🔥', condition: u => u.streaks.current >= 3, desc: 'Attended meetings for 3 consecutive days.' },
            { name: '7-Week', icon: '🔥', condition: u => u.streaks.current >= 7, desc: 'A full week of meetings! Consistency is key.' },
            { name: '30-Day Warrior', icon: '🛡️', condition: u => u.streaks.current >= 30, desc: '30 consecutive days of meetings!' },
            { name: 'Supportive Friend', icon: '🤝', condition: u => u.attendanceRecords.length >= 5, desc: 'Regular contributor to the fellowship.' }
        ];

        for (const definition of badgeDefinitions) {
            if (definition.condition(user) && !currentBadgeNames.includes(definition.name)) {
                user.badges.push({
                    name: definition.name,
                    icon: definition.icon,
                    description: definition.desc,
                    earnedAt: new Date()
                });
                newBadges.push(definition);
            }
        }

        return newBadges;
    }

    /**
     * Awards XP to user and handles leveling up
     * @param {Object} user User document
     * @param {Number} amount Amount of XP to award
     * @param {String} source Source of XP for logging (optional)
     */
    static async awardXP(user, amount, source) {
        if (!user.xp) user.xp = 0;
        if (!user.level) user.level = 1;

        user.xp += amount;

        // Level Up Logic: Level * 100 XP required for next level

        let leveledUp = false;
        const xpForNextLevel = user.level * 100;

        if (user.xp >= xpForNextLevel) {
            user.level += 1;
            user.xp = user.xp - xpForNextLevel; // Carry over excess
            leveledUp = true;
        }

        return {
            currentXP: user.xp,
            currentLevel: user.level,
            xpForNextLevel: user.level * 100,
            leveledUp
        };
    }
}

module.exports = RecoveryStatsManager;
