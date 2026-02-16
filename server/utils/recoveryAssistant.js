/**
 * Utility for providing AI-inspired recovery guidance and daily inspirations
 */

class RecoveryAssistant {
    constructor() {
        this.inspirations = [
            "Recovery is not for people who need it, it's for people who want it.",
            "One day at a time.",
            "Keep coming back, it works if you work it.",
            "The first step is the hardest, but you've already taken it.",
            "Sobriety is its own reward.",
            "You are worth the effort of recovery.",
            "Easy does it.",
            "Progress, not perfection.",
            "Live and let live.",
            "First things first."
        ];

        this.tips = [
            "Joining a meeting today? Try to share even if it's brief.",
            "Have you reached out to a recovery friend today?",
            "Remember to breathe deeply when things get stressful.",
            "Your level represents your commitment. Keep growing!",
            "Showing up consistently is a strong sign of progress."
        ];
    }

    /**
     * Get a random daily inspiration
     */
    getDailyInspiration() {
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        return this.inspirations[dayOfYear % this.inspirations.length];
    }

    /**
     * Get a random helpful tip
     */
    getRandomTip() {
        return this.tips[Math.floor(Math.random() * this.tips.length)];
    }

    /**
     * Calculate Community Pulse (0-100)
     * Simulates collective strength based on active participation
     */
    calculateCommunityPulse(activeUsersCount, messagesLastHour) {
        // Base strength from active users
        const userWeight = Math.min(activeUsersCount * 5, 50);
        // Engagement strength from messages
        const engagementWeight = Math.min(messagesLastHour / 2, 50);
        
        return Math.floor(userWeight + engagementWeight);
    }

    /**
     * Calculate a recovery message based on user level
     */
    getMessageForLevel(level) {
        if (level < 5) return "Welcome to the path! You're building a strong foundation.";
        if (level < 10) return "You're becoming a regular part of the fellowship. Your presence matters.";
        if (level < 20) return "Impressive dedication! You're an inspiration to newcomers.";
        return "A true veteran of the program. Thank you for your service and leadership.";
    }
}

module.exports = new RecoveryAssistant();
