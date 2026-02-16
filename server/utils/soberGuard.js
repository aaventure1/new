/**
 * Neural Sober-Guard - Behavioral Analysis Engine
 * Innovative approach: Predictive risk assessment instead of reactive tracking
 */

class NeuralSoberGuard {
    constructor() {
        this.riskThresholds = {
            SAFE: 0.2,
            CAUTION: 0.5,
            ALERT: 0.8
        };
    }

    /**
     * Analyze user behavior to calculate a 'Relapse Risk Score' (0-1)
     * @param {Object} userData 
     */
    analyzeRisk(userData) {
        const { attendanceRecords, moodHistory, streaks } = userData;
        
        let riskScore = 0.5; // Neutral start

        // 1. Attendance Consistency Factor
        if (attendanceRecords.length > 0) {
            const lastMeeting = new Date(attendanceRecords[attendanceRecords.length - 1].date);
            const daysSinceLast = (new Date() - lastMeeting) / (1000 * 60 * 60 * 24);
            
            if (daysSinceLast <= 1) riskScore -= 0.2; // Good consistency
            else if (daysSinceLast > 3) riskScore += 0.3; // Missing days increases risk
        } else {
            riskScore += 0.2; // No data is initial risk
        }

        // 2. Mood Trend Analysis
        if (moodHistory && moodHistory.length >= 3) {
            const recentMoods = moodHistory.slice(-3);
            const declining = recentMoods.every((m, i) => i === 0 || this._moodToValue(m.mood) <= this._moodToValue(recentMoods[i-1].mood));
            
            if (declining) riskScore += 0.4;
            else riskScore -= 0.1;
        }

        // 3. Streak Stability
        if (streaks.current > 7) riskScore -= 0.1;

        return Math.max(0, Math.min(1, riskScore));
    }

    _moodToValue(mood) {
        const map = { 'thriving': 5, 'good': 4, 'stable': 3, 'struggling': 2, 'urgent': 1 };
        return map[mood] || 3;
    }

    getIntervention(riskScore) {
        if (riskScore >= this.riskThresholds.ALERT) {
            return {
                status: 'CRITICAL',
                message: "Neural Guard Alert: We've detected a shift in your patterns. Your recovery is worth the fight—join an Urgent room now.",
                action: 'join_urgent_room',
                color: '#ef4444'
            };
        } else if (riskScore >= this.riskThresholds.CAUTION) {
            return {
                status: 'CAUTION',
                message: "Pattern Shift: You haven't checked in as frequently. A quick 15-minute meeting might clear your head.",
                action: 'recommend_reading',
                color: '#f59e0b'
            };
        }
        return {
            status: 'PROTECTED',
            message: "Neural Guard Active: Your patterns are strong. Keep following the path—one day at a time.",
            action: 'stay_consistent',
            color: '#10b981'
        };
    }
}

module.exports = new NeuralSoberGuard();
