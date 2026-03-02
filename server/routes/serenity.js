const express = require('express');
const router = express.Router();
const { createRateLimiter } = require('../middleware/rateLimit');

const serenityLimiter = createRateLimiter({
    key: 'serenity-chat',
    windowMs: 60 * 1000,
    max: 30,
    message: 'Serenity is receiving a high volume of requests. Please try again in a moment.'
});

// This would ideally connect to OpenAI or Anthropic API
// For the demo, we use a robust recovery-focused AI logic
router.post('/chat', serenityLimiter, async (req, res) => {
    try {
        const { message, userId } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }
        if (message.length > 2000) {
            return res.status(400).json({ success: false, error: 'Message is too long' });
        }

        console.log(`🤖 Serenity processing message: "${message.slice(0, 120)}"`);

        // Simulate "Web Search" and "Thinking"
        await new Promise(resolve => setTimeout(resolve, 1500));

        let response = "";
        let suggestedActions = [];

        const msg = message.toLowerCase();

        if (msg.includes('meeting') || msg.includes('schedule') || msg.includes('time')) {
            response = "I can help with that. We have live meetings running right now. You can also join one of our premium 24/7 global streams.";
            suggestedActions = [
                { label: "View Calendar", action: "navigate:calendar" },
                { label: "Join Open Room", action: "join:open" }
            ];
        } else if (msg.includes('craving') || msg.includes('urge') || msg.includes('drink') || msg.includes('use')) {
            response = "I hear you. This feeling is temporary. Breathe. Remember HALT (Hungry, Angry, Lonely, Tired). I strongly recommend connecting with a human being right now.";
            suggestedActions = [
                { label: "🌊 Open Urge Surfer", action: "modal:urgeSurfer" },
                { label: "🗣️ Join 24/7 Support", action: "join:open" },
                { label: "🆘 Emergency Numbers", action: "modal:support" }
            ];
        } else if (msg.includes('step') || msg.includes('tradition')) {
            response = "The 12 Steps and Traditions are our roadmap. Which one are you working on? I can provide specific literature.";
            suggestedActions = [
                { label: "Read the 12 Steps", action: "resource:steps" },
                { label: "Read the 12 Traditions", action: "resource:traditions" }
            ];
        } else if (msg.includes('anxious') || msg.includes('scared') || msg.includes('fear')) {
            response = "Anxiety is common in recovery. Let's focus on the present moment. 'Just for Today.' Would you like to read today's reflection?";
            suggestedActions = [
                { label: "📖 Read Daily Reflection", action: "navigate:blog" },
                { label: "🧘 Breathing Exercise", action: "modal:urgeSurfer" }
            ];
        } else if (msg.includes('hello') || msg.includes('hi')) {
            response = "Hello! I am Serenity, your active recovery assistant. I'm here to help you navigate meetings, resources, and difficult moments. How are you feeling today?";
            suggestedActions = [
                { label: "I'm doing well", action: "reply:I'm doing well!" },
                { label: "I'm struggling", action: "reply:I'm struggling a bit." }
            ];
        } else {
            response = "I'm listening. Sometimes just sharing what's on your mind helps. You can also ask me about meetings, the Steps, or handling cravings.";
            suggestedActions = [
                { label: "Find a Meeting", action: "navigate:calendar" },
                { label: "Read Resources", action: "navigate:resources" }
            ];
        }

        res.json({ success: true, response, suggestedActions });
    } catch (error) {
        console.error('Serenity AI Error:', error);
        res.status(500).json({ success: false, error: 'Serenity is resting.' });
    }
});

module.exports = router;
