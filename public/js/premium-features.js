// Real-time Auto-Refresh Feature for Meeting Updates
class LiveUpdater {
    constructor() {
        this.refreshInterval = 30000; // 30 seconds
        this.intervalId = null;
        this.lastUpdate = Date.now();
    }

    start(updateFunction) {
        this.stop(); // Clear any existing interval

        // Initial update
        updateFunction();

        // Set up periodic updates
        this.intervalId = setInterval(() => {
            updateFunction();
            this.lastUpdate = Date.now();
            this.showUpdateIndicator();
        }, this.refreshInterval);

        console.log('✅ Live updates enabled');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    showUpdateIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'update-indicator';
        indicator.innerHTML = '✓ Updated';
        indicator.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 2rem;
            font-size: 0.875rem;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            z-index: 9999;
            animation: slideInRight 0.3s ease, fadeOut 0.5s ease 2s forwards;
        `;

        document.body.appendChild(indicator);

        setTimeout(() => {
            indicator.remove();
        }, 2500);
    }
}

// Enhanced Notification System
class NotificationManager {
    constructor() {
        this.queue = [];
        this.maxNotifications = 3;
        this.createContainer();
    }

    createContainer() {
        if (!document.getElementById('notificationContainer')) {
            const container = document.createElement('div');
            container.id = 'notificationContainer';
            container.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
    }

    show(message, type = 'info', duration = 4000) {
        const notification = this.createNotification(message, type);
        const container = document.getElementById('notificationContainer');

        // Remove oldest if at max
        if (this.queue.length >= this.maxNotifications) {
            const oldest = this.queue.shift();
            oldest.remove();
        }

        container.appendChild(notification);
        this.queue.push(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        });

        // Auto-remove
        setTimeout(() => {
            this.remove(notification);
        }, duration);

        return notification;
    }

    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;

        const colors = {
            success: { bg: 'linear-gradient(135deg, #10b981, #059669)', icon: '✓' },
            error: { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: '✕' },
            warning: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: '⚠' },
            info: { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: 'ℹ' }
        };

        const config = colors[type] || colors.info;

        notification.style.cssText = `
            background: ${config.bg};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 1rem;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            min-width: 300px;
            max-width: 400px;
            pointer-events: auto;
            cursor: pointer;
            transform: translateX(400px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-weight: 500;
            font-size: 0.9375rem;
        `;

        notification.innerHTML = `
            <span style="font-size: 1.25rem; flex-shrink: 0;">${config.icon}</span>
            <span style="flex: 1;">${message}</span>
            <button style="background: none; border: none; color: white; cursor: pointer; font-size: 1.25rem; padding: 0; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">×</button>
        `;

        notification.querySelector('button').onclick = () => this.remove(notification);
        notification.onclick = (e) => {
            if (e.target !== notification.querySelector('button')) {
                this.remove(notification);
            }
        };

        return notification;
    }

    remove(notification) {
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';

        setTimeout(() => {
            notification.remove();
            const index = this.queue.indexOf(notification);
            if (index > -1) {
                this.queue.splice(index, 1);
            }
        }, 300);
    }
}

// Theme Management (Dark/Light Mode)
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.applyTheme();
    }

    toggle() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
        return this.theme;
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = this.theme === 'light' ? '🌙' : '☀️';
        }
    }
}

// Stats and Gamification Manager
class StatsManager {
    constructor() {
        this.stats = null;
    }

    async loadStats() {
        try {
            const response = await fetch('/api/attendance/my-stats');
            if (response.ok) {
                const data = await response.json();
                this.stats = data;
                this.renderStats();
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    renderStats() {
        const streakEl = document.getElementById('currentStreak');
        const countEl = document.getElementById('meetingCount');
        const badgeGrid = document.getElementById('badgeGrid');
        const dashboard = document.getElementById('recoveryDashboard');

        // Level Elements
        const userLevel = document.getElementById('userLevel');
        const userXP = document.getElementById('userXP');
        const nextLevelXP = document.getElementById('nextLevelXP');
        const progressBar = document.getElementById('levelProgressBar');
        const levelTitle = document.getElementById('userLevelTitle');

        if (dashboard && this.stats) {
            dashboard.classList.remove('hidden');
        }

        if (streakEl && this.stats) streakEl.textContent = this.stats.streaks?.current || 0;
        if (countEl && this.stats) countEl.textContent = this.stats.attendanceCount || 0;

        if (this.stats && userLevel) {
            const currentLevel = this.stats.level || 1;
            const currentXP = this.stats.xp || 0;
            const nextXP = currentLevel * 100;
            const percentage = Math.min((currentXP / nextXP) * 100, 100);

            userLevel.textContent = currentLevel;
            userXP.textContent = currentXP;
            nextLevelXP.textContent = nextXP;
            if (progressBar) progressBar.style.width = `${percentage}%`;

            // Dynamic Titles
            const titles = ['Novice', 'Seeker', 'Apprentice', 'Warrior', 'Guide', 'Guardian', 'Sage', 'Master', 'Legend', 'Ascended'];
            if (levelTitle) levelTitle.textContent = titles[Math.min(currentLevel - 1, titles.length - 1)] + " Recovery";
        }

        if (badgeGrid && this.stats && this.stats.badges) {
            badgeGrid.innerHTML = this.stats.badges.map(badge => `
                <div class="badge-item" title="${badge.description}">
                    ${badge.icon}
                    <div class="badge-tooltip">${badge.name}: ${badge.description}</div>
                </div>
            `).join('');
        }
    }
}

// Initialize global instances
window.themeManager = new ThemeManager();
window.statsManager = new StatsManager();
window.liveUpdater = new LiveUpdater();
window.notificationManager = new NotificationManager();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes fadeOut {
        to {
            opacity: 0;
            transform: translateY(-10px);
        }
    }
    
    .notification:hover {
        transform: translateX(-4px) scale(1.02);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    }
`;
document.head.appendChild(style);

console.log('✅ Premium features loaded: Live Updates & Enhanced Notifications');

// Serenity AI Support Engine
class SerenityAI {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.responses = {
            'thriving': "That's amazing! Keep sharing that light with the fellowship. Service is a great way to stay thriving.",
            'stable': "Consistency is the foundation of recovery. Keep doing what works.",
            'tired': "Rest is a vital part of HALT (Hungry, Angry, Lonely, Tired). Be gentle with yourself today.",
            'vulnerable': "It's okay to feel this way. Remember, one day at a time. Maybe join a meeting or call your sponsor?",
            'urgent': "I'm here. Please consider calling a local helpline or joining our 24/7 Open Recovery room immediately. You are not alone.",
            'default': "I hear you. Remember, we only have today. What's one small thing you can do for your recovery right now?"
        };
        this.setupListeners();
    }

    setupListeners() {
        const toggleBtn = document.getElementById('toggleSerenityBtn');
        const serenityDiv = document.getElementById('serenityAI');
        const sendBtn = document.getElementById('sendSerenityBtn');
        const input = document.getElementById('serenityInput');

        toggleBtn?.addEventListener('click', () => {
            serenityDiv.classList.toggle('hidden');
            this.isOpen = !serenityDiv.classList.contains('hidden');
        });

        sendBtn?.addEventListener('click', () => this.handleMessage());
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleMessage();
        });

        // Mood buttons
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mood = btn.dataset.mood;
                this.handleMoodSelection(mood, btn);
            });
        });
    }

    async handleMoodSelection(mood, btn) {
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        try {
            const response = await fetch('/api/attendance/mood', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mood })
            });
            const data = await response.json();

            if (data.success) {
                if (data.xp && data.xp.leveledUp) {
                    window.notificationManager?.show(`🌟 LEVEL UP! You are now Level ${data.xp.currentLevel}`, 'success', 8000);
                    window.app.confetti(); // reuse confetti
                } else if (data.xp) {
                    window.notificationManager?.show(`Mood recorded. +10 Evolution XP!`, 'info');
                }

                // Refresh stats to show new XP
                window.statsManager?.loadStats();
            }
        } catch (error) {
            console.error('Mood save error', error);
        }

        const quoteEl = document.getElementById('moodQuote');
        const responses = {
            'thriving': "Keep that momentum going! You're doing great.",
            'good': "A good day is a gift. Enjoy it soberly.",
            'stable': "Steady as she goes. One day at a time.",
            'struggling': "The struggle is real, but so is the solution. We're here.",
            'urgent': "Please reach out to someone. You don't have to do this alone."
        };

        if (quoteEl) {
            quoteEl.textContent = responses[mood] || "Thank you for checking in.";
            quoteEl.style.color = mood === 'urgent' ? '#ef4444' : 'var(--primary)';
        }

        // If they are struggling or urgent, open Serenity AI to offer support
        if (mood === 'struggling' || mood === 'urgent') {
            document.getElementById('serenityAI').classList.remove('hidden');
            this.addMessage("AI", this.responses[mood === 'urgent' ? 'urgent' : 'vulnerable']);
        }
    }

    handleMessage() {
        const input = document.getElementById('serenityInput');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage("User", text);
        input.value = '';

        // Simple AI response logic
        setTimeout(() => {
            const lowerText = text.toLowerCase();
            let response = this.responses.default;

            if (lowerText.includes('struggle') || lowerText.includes('hard')) {
                response = "I'm sorry things are tough. Remember the Serenity Prayer. Focus only on the next hour.";
            } else if (lowerText.includes('happy') || lowerText.includes('sober')) {
                response = "That's wonderful! Sobriety brings a life second to none. How many days do you have today?";
            } else if (lowerText.includes('help')) {
                response = "I'm here. If you need immediate human support, our 24/7 Open Recovery room is always active.";
            }

            this.addMessage("AI", response);
        }, 1000);
    }

    addMessage(sender, text) {
        const container = document.getElementById('serenityMessages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `serenity-msg ${sender.toLowerCase()}`;
        msgDiv.textContent = text;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }
}

// Initialize Serenity AI
window.serenityAI = new SerenityAI();
