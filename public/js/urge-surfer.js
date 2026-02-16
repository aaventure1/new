/**
 * Urge-Surfer CBT Module
 * Innovative approach: Real-time mindfulness and distraction tool for managing cravings
 */

class UrgeSurfer {
    constructor() {
        this.timer = null;
        this.timeLeft = 600; // 10 minutes (standard urge duration)
        this.steps = [
            { title: "Identify the Urge", text: "Notice where you feel the urge in your body. Is it your chest? Your stomach? Just observe it without judgment." },
            { title: "Breathe Deeply", text: "Take 5 slow breaths. Inhale for 4, hold for 4, exhale for 4. You are safe." },
            { title: "HALT Check", text: "Are you Hungry, Angry, Lonely, or Tired? Identifying the root cause weakens the urge." },
            { title: "Surfing the Wave", text: "An urge is like a wave. It peaks and then subsides. You are the surfer, not the wave." },
            { title: "Call a Friend", text: "Reach out to your Sober Buddy or post in the Open Recovery room now." }
        ];
        this.currentStep = 0;
    }

    start() {
        this.currentStep = 0;
        this.timeLeft = 600;
        this.updateUI();
        this.startTimer();
        document.getElementById('urgeSurferModal').classList.add('active');
    }

    startTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            if (this.timeLeft <= 0) {
                this.complete();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const min = Math.floor(this.timeLeft / 60);
        const sec = this.timeLeft % 60;
        const display = `${min}:${sec.toString().padStart(2, '0')}`;
        document.getElementById('urgeTimer').textContent = display;
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.updateUI();
        } else {
            this.complete();
        }
    }

    updateUI() {
        const step = this.steps[this.currentStep];
        document.getElementById('urgeStepTitle').textContent = step.title;
        document.getElementById('urgeStepText').textContent = step.text;
        document.getElementById('urgeProgress').style.width = `${((this.currentStep + 1) / this.steps.length) * 100}%`;
    }

    complete() {
        clearInterval(this.timer);
        app.showNotification('You surfed the wave! 10 XP Awarded.', 'success');
        // Award XP via API
        fetch('/api/auth/award-xp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 10, source: 'Urge Surfing' })
        });
        document.getElementById('urgeSurferModal').classList.remove('active');
    }
}

window.urgeSurfer = new UrgeSurfer();
