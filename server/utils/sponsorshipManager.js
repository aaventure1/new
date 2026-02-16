/**
 * Sponsorship Manager - Neural Matching Logic
 * Innovative approach: Algorithmic compatibility for recovery partners
 */

const User = require('../models/User');

class SponsorshipManager {
    /**
     * Find the best potential sponsors for a user
     * @param {Object} user User looking for a sponsor
     */
    async findMatches(user) {
        // Find users available to sponsor who aren't the current user
        const candidates = await User.find({
            'sponsorship.isAvailable': true,
            _id: { $ne: user._id }
        }).limit(20);

        // Determine user's preferred meeting type
        const userTypes = user.attendanceRecords.map(r => r.meetingType);
        const preferredType = userTypes.sort((a,b) =>
            userTypes.filter(v => v===a).length - userTypes.filter(v => v===b).length
        ).pop();

        const matches = candidates.map(candidate => {
            let score = 0;

            // 1. Level Disparity (Higher level sponsor is better)
            const levelDiff = candidate.level - user.level;
            if (levelDiff > 5) score += 30;
            else if (levelDiff > 0) score += 15;

            // 2. Sobriety Longevity (Experience factor)
            if (candidate.sobrietyDate) {
                const daysSober = (new Date() - new Date(candidate.sobrietyDate)) / (1000 * 60 * 60 * 24);
                if (daysSober > 365) score += 20; // 1 year+
                if (daysSober > 1825) score += 10; // 5 years+
            }

            // 3. Activity Consistency
            if (candidate.streaks.current > 7) score += 20;

            // 4. Meeting Affinity (Neural Match)
            const candTypes = candidate.attendanceRecords.map(r => r.meetingType);
            if (preferredType && candTypes.includes(preferredType)) {
                score += 20; // Matches primary fellowship
            }

            // Cap at 100%
            score = Math.min(score, 100);

            return {
                id: candidate._id,
                chatName: candidate.chatName,
                level: candidate.level,
                streak: candidate.streaks.current,
                compatibility: score,
                isVeteran: candidate.level >= 10 || (candidate.sobrietyDate && (new Date() - new Date(candidate.sobrietyDate)) / (1000 * 60 * 60 * 24) > 365)
            };
        });

        // Sort by compatibility score
        return matches.sort((a, b) => b.compatibility - a.compatibility).slice(0, 6);
    }

    /**
     * Send a sponsorship request
     */
    async sendRequest(fromUser, toUserId) {
        const target = await User.findById(toUserId);
        if (!target) return { success: false, error: 'User not found' };

        if (!target.sponsorship.requests.includes(fromUser._id)) {
            target.sponsorship.requests.push(fromUser._id);
            await target.save();
        }

        return { success: true };
    }

    /**
     * Accept a sponsorship request
     */
    async acceptRequest(user, requesterId) {
        // Clear other requests and link
        user.sponsorship.partnerId = requesterId;
        user.sponsorship.requests = user.sponsorship.requests.filter(id => id.toString() !== requesterId.toString());
        await user.save();

        // Update the requester too
        const requester = await User.findById(requesterId);
        if (requester) {
            requester.sponsorship.partnerId = user._id;
            requester.sponsorship.isLooking = false;
            await requester.save();
        }

        return { success: true };
    }
}

module.exports = new SponsorshipManager();
