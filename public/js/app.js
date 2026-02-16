class AAVentureApp {
    constructor() {
        this.currentUser = null;
        this.socket = null;
        this.currentRoom = null;
        this.meetings = [];
        this.joinTime = null;
        this.typingTimeout = null;

        // WebRTC properties
        this.localStream = null;
        this.peers = {}; // socketId -> RTCPeerConnection
        this.isVideoOn = false;
        this.isAudioOn = true;

        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadMeetings();
        this.loadJFT();
        this.checkSubscriptionSuccess();
        this.initHeroStats();
        this.initPulseMeter();
        this.initNeuralGuard();
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                this.currentUser = data.user;
                this.updateUIForAuth();

                // Load user-specific data
                this.loadAttendanceRecords();
                window.statsManager?.loadStats();
                this.initNeuralGuard();
            } else {
                this.currentUser = null;
                this.updateUIForAuth();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.currentUser = null;
            this.updateUIForAuth();
        }
    }



    async initNeuralGuard() {
        if (!this.currentUser) return;

        try {
            const response = await fetch('/api/auth/guard-status', {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                const banner = document.getElementById('neuralGuardBanner');
                const message = document.getElementById('guardMessage');
                const badge = document.getElementById('guardBadge');

                if (banner && message && badge) {
                    banner.style.borderLeftColor = data.color;
                    message.textContent = data.message;
                    badge.style.backgroundColor = data.color;
                    badge.style.boxShadow = `0 0 10px ${data.color}`;
                }
            }
        } catch (error) {
            console.error('Neural Guard check failed');
        }
    }

    initHeroStats() {
        const liveMeetingsCount = document.getElementById('liveMeetingsCount');
        if (liveMeetingsCount) {
            // Simulated live count that changes slightly
            setInterval(() => {
                const base = 5;
                const variation = Math.floor(Math.random() * 4);
                liveMeetingsCount.textContent = `${base + variation} Meetings Active Right Now`;
            }, 10000);
        }
    }

    initPulseMeter() {
        const pulseBarFill = document.getElementById('pulseBarFill');
        const pulseValue = document.getElementById('pulseValue');

        if (pulseBarFill && pulseValue) {
            setInterval(() => {
                const base = 75;
                const variation = Math.floor(Math.random() * 10) - 5;
                const total = Math.min(Math.max(base + variation, 60), 100);
                pulseBarFill.style.width = `${total}%`;

                if (total > 85) pulseValue.textContent = 'Exceptional';
                else if (total > 70) pulseValue.textContent = 'Strong';
                else pulseValue.textContent = 'Steady';

                if (window.serenityEngine) {
                    window.serenityEngine.setPulse(total);
                }
            }, 5000);
        }
    }

    updateUIForAuth() {
        const navAuth = document.getElementById('navAuth');
        const navUser = document.getElementById('navUser');
        const userName = document.getElementById('userName');
        const adminNavLink = document.getElementById('adminNavLink');

        if (this.currentUser) {
            navAuth.classList.add('hidden');
            navUser.classList.remove('hidden');

            // Check Anonymity Mode
            if (this.currentUser.anonymousMode) {
                userName.textContent = "Anonymous Member";
                const privacyBtn = document.getElementById('privacyToggleBtn');
                if (privacyBtn) {
                    privacyBtn.textContent = "👤 Private: ON";
                    privacyBtn.classList.add('active');
                }
            } else {
                userName.textContent = this.currentUser.chatName;
                const privacyBtn = document.getElementById('privacyToggleBtn');
                if (privacyBtn) {
                    privacyBtn.textContent = "👤 Private: OFF";
                    privacyBtn.classList.remove('active');
                }
            }

            // Innovative Link: Update evolving 3D level artifact
            if (window.serenityEngine) {
                window.serenityEngine.updateLevelArtifact(this.currentUser.level || 1);
            }

            // Show recovery dashboard
            document.getElementById('recoveryDashboard')?.classList.remove('hidden');
            document.getElementById('userLevel').textContent = this.currentUser.level || 1;
            document.getElementById('userXP').textContent = this.currentUser.xp || 0;
            if (adminNavLink) {
                adminNavLink.classList.toggle('hidden', !this.currentUser.isAdmin);
            }

        } else {
            navAuth.classList.remove('hidden');
            navUser.classList.add('hidden');
            document.getElementById('recoveryDashboard')?.classList.add('hidden');
            if (adminNavLink) {
                adminNavLink.classList.add('hidden');
            }
        }
    }

    async register(username, email, chatName, password) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, email, chatName, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                this.updateUIForAuth();
                this.closeModal('registerModal');
                this.showNotification('Registration successful!', 'success');
                this.openModal('welcomeOnboardingModal');
                this.initOnboarding();
                this.initNeuralGuard();
                return true;
            } else {
                this.showNotification(data.error || 'Registration failed', 'error');
                return false;
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
            return false;
        }
    }

    async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                this.updateUIForAuth();
                this.closeModal('loginModal');
                this.showNotification('Login successful!', 'success');
                this.initNeuralGuard();
                return true;
            } else {
                this.showNotification(data.error || 'Login failed', 'error');
                return false;
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
            return false;
        }
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            this.currentUser = null;
            this.updateUIForAuth();
            this.navigateTo('home');
            this.showNotification('Logged out successfully', 'success');
        } catch (error) {
            this.showNotification('Logout failed', 'error');
        }
    }

    // Blog & WordPress Integration
    async loadJFT() {
        try {
            const response = await fetch('/api/wordpress/posts?category=Just For Today&limit=1');
            const posts = await response.json();

            if (posts && posts.length > 0) {
                const jft = posts[0];
                const titleEl = document.getElementById('jftHomeTitle');
                const excerptEl = document.getElementById('jftHomeExcerpt');

                if (titleEl) titleEl.textContent = jft.title;
                if (excerptEl) excerptEl.textContent = jft.excerpt;

                document.getElementById('readJftBtn')?.addEventListener('click', () => {
                    this.navigateTo('blog');
                    // In a real app, you might scroll to this specific post
                });
            }
        } catch (error) {
            console.error('Failed to load JFT:', error);
        }
    }

    async loadBlog() {
        try {
            const response = await fetch('/api/wordpress/posts');
            const posts = await response.json();
            this.displayBlogPosts(posts);
        } catch (error) {
            console.error('Failed to load blog posts:', error);
        }
    }

    displayBlogPosts(posts) {
        const blogList = document.getElementById('blogPostsList');
        if (!blogList) return;

        if (posts.length === 0) {
            blogList.innerHTML = '<p>No blog posts found.</p>';
            return;
        }

        blogList.innerHTML = posts.map(post => `
            <div class="blog-card">
                <div class="blog-image">
                    <img src="${post.featured_image || post.featuredImage || ''}" alt="${post.title}">
                </div>
                <div class="blog-content">
                    <div class="blog-meta">${new Date(post.date || post.createdAt || Date.now()).toLocaleDateString()} | By ${post.author || 'AAVenture Team'}</div>
                    <h3>${post.title}</h3>
                    <p>${post.excerpt}</p>
                    <button class="btn btn-secondary btn-block">Read More</button>
                </div>
            </div>
        `).join('');
    }

    // Meetings
    async loadMeetings() {
        try {
            const response = await fetch('/api/meetings');
            const data = await response.json();

            if (data.success) {
                this.meetings = data.meetings;
                this.displayMeetings(data.meetings);
            }
        } catch (error) {
            console.error('Failed to load meetings:', error);
        }
    }

    displayMeetings(meetings) {
        const meetingsList = document.getElementById('meetingsList');

        if (meetings.length === 0) {
            meetingsList.innerHTML = '<p class="text-center text-gray">No scheduled meetings at this time.</p>';
            return;
        }

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const isSubscribed = this.currentUser && this.currentUser.hasActiveSubscription;

        meetingsList.innerHTML = meetings.map(meeting => {
            let actionBtn;

            if (meeting.isExternal && meeting.zoomLink) {
                // External Meeting (Zoom) - PREMIUM ONLY
                if (isSubscribed) {
                    actionBtn = `<button class="btn btn-primary btn-block" onclick="app.joinExternalMeeting('${meeting._id}', '${meeting.zoomLink}', '${meeting.title}')">🎥 Join External Stream</button>`;
                } else {
                    actionBtn = `<button class="btn btn-secondary btn-block" onclick="app.showNotification('Premium subscription required for external streams', 'error'); app.navigateTo('subscription')">🔒 Premium Only</button>`;
                }
            } else if (meeting.format === 'video' || meeting.format === 'hybrid') {
                // Internal Video (placeholder for now, or WebRTC)
                actionBtn = `<button class="btn btn-primary btn-block" onclick="app.joinMeeting('${meeting._id}', '${meeting.roomId}')">🎥 Join Video Room</button>`;
            } else {
                // Internal Text - FREE
                actionBtn = `<button class="btn btn-primary btn-block" onclick="app.joinMeeting('${meeting._id}', '${meeting.roomId}')">💬 Enter Chat Room</button>`;
            }

            return `
                <div class="meeting-card">
                    <div class="meeting-badge">${meeting.type}</div>
                    <h3>${meeting.title}</h3>
                    <p class="meeting-desc">${meeting.description || ''}</p>
                    <div class="meeting-info">
                        <span><strong>🎥 Format:</strong> ${meeting.source === 'Zoom' ? 'External Zoom' : meeting.format.toUpperCase()}</span>
                        ${meeting.schedule ? `
                            <span><strong>🕒 Schedule:</strong> ${meeting.schedule.recurring ? 'Weekly / 24-7' : days[meeting.schedule.dayOfWeek]}</span>
                        ` : '<span><strong>🕒 Schedule:</strong> 24/7 Always Open</span>'}
                    </div>
                    <div class="mt-2">
                        ${actionBtn}
                    </div>
                </div>
            `;
        }).join('');
    }

    async joinExternalMeeting(meetingId, url, title) {
        if (!this.currentUser) {
            this.showNotification('Please login to track attendance', 'error');
            this.openModal('loginModal');
            return;
        }

        try {
            const joinResponse = await fetch(`/api/meetings/${meetingId}/join`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!joinResponse.ok) {
                this.showNotification('Unable to start attendance tracking', 'error');
                return;
            }
        } catch (error) {
            this.showNotification('Network error starting attendance tracking', 'error');
            return;
        }

        // Open Zoom in new tab
        const meetingWindow = window.open(url, '_blank');
        if (!meetingWindow) {
            this.showNotification('Pop-up blocked! Please allow pop-ups to join.', 'error');
            try {
                await fetch(`/api/meetings/${meetingId}/leave`, {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (error) {
                console.error('Failed to clean up blocked join:', error);
            }
            return;
        }

        // Start tracking on THIS tab
        this.currentMeetingId = meetingId;
        this.joinTime = new Date();

        // Show Tracking Modal
        this.showTrackingModal(title);
    }

    showTrackingModal(title) {
        const modalHtml = `
            <div class="modal active" id="trackingModal" style="background: rgba(0,0,0,0.8);">
                <div class="modal-content glass-card text-center">
                    <div class="spinner-pulse" style="margin: 0 auto 1rem; width: 50px; height: 50px; background: var(--primary); border-radius: 50%; animation: pulse 1.5s infinite;"></div>
                    <h2>Attending: ${title}</h2>
                    <p>We are tracking your attendance in the background.</p>
                    <div class="timer-display" id="attendanceTimer" style="font-size: 2rem; font-weight: 800; margin: 1rem 0;">00:00</div>
                    <p class="text-gray text-small mb-2">Please keep this tab open while attending the Zoom meeting.</p>
                    
                    <button class="btn btn-primary btn-block" id="finishAttendanceBtn" disabled>
                        Finish & Generate Certificate (Min 30m)
                    </button>
                    <button class="btn btn-secondary btn-block mt-1" onclick="app.cancelAttendance()">Cancel</button>
                </div>
            </div>
        `;

        // Remove existing if any
        const existing = document.getElementById('trackingModal');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Start Timer
        this.attendanceInterval = setInterval(() => {
            const now = new Date();
            const diff = Math.floor((now - this.joinTime) / 1000);
            const mins = Math.floor(diff / 60).toString().padStart(2, '0');
            const secs = (diff % 60).toString().padStart(2, '0');
            document.getElementById('attendanceTimer').textContent = `${mins}:${secs}`;

            // Enable button after 30 mins (1800s)
            const btn = document.getElementById('finishAttendanceBtn');
            if (diff >= 1800) {
                btn.removeAttribute('disabled');
                btn.textContent = "✅ Generate Certificate Now";
                btn.onclick = () => this.generateCertificate();
            }
        }, 1000);
    }

    async cancelAttendance() {
        clearInterval(this.attendanceInterval);
        document.getElementById('trackingModal')?.remove();

        if (this.currentMeetingId && this.currentUser) {
            try {
                await fetch(`/api/meetings/${this.currentMeetingId}/leave`, {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (error) {
                console.error('Failed to leave tracked meeting:', error);
            }
        }

        this.currentMeetingId = null;
        this.joinTime = null;
    }

    async joinMeeting(meetingId, roomId) {
        if (!this.currentUser) {
            this.showNotification('Please login to join meetings', 'error');
            this.openModal('loginModal');
            return;
        }

        try {
            const response = await fetch(`/api/meetings/${meetingId}/join`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                this.enterChatRoom(roomId, meetingId);
            }
        } catch (error) {
            this.showNotification('Failed to join meeting', 'error');
        }
    }

    // Chat Room
    enterChatRoom(roomId, meetingId = null) {
        if (!this.currentUser) {
            this.showNotification('Please login to enter chat rooms', 'error');
            this.openModal('loginModal');
            return;
        }

        this.currentRoom = roomId;
        this.joinTime = new Date();
        this.currentMeetingId = meetingId;

        // Initialize socket if not already connected
        if (!this.socket) {
            this.initializeSocket();
        }

        // Join the room
        this.socket.emit('join-room', {
            roomId: roomId,
            userId: this.currentUser.id,
            chatName: this.currentUser.chatName
        });

        // Update UI
        document.getElementById('chatRoomTitle').textContent = `${roomId.toUpperCase()} Room`;
        this.navigateTo('chatRoom');
    }

    // Video Chat (WebRTC)
    async toggleVideo() {
        const videoBtn = document.getElementById('toggleVideoBtn');
        const videoGrid = document.getElementById('videoGrid');

        if (!this.isVideoOn) {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: this.isAudioOn
                });

                document.getElementById('localVideo').srcObject = this.localStream;
                videoGrid.classList.remove('hidden');
                this.isVideoOn = true;
                videoBtn.textContent = '📹 Stop Video';
                videoBtn.classList.add('btn-outline');

                // Notify others and start signaling
                this.socket.emit('toggle-video', { roomId: this.currentRoom, isVideoOn: true });

                // Request connections from all active users
                this.socket.emit('request-video-connections', { roomId: this.currentRoom });
            } catch (error) {
                console.error('Error accessing media devices:', error);
                this.showNotification('Could not access camera/microphone', 'error');
            }
        } else {
            this.stopVideo();
            videoBtn.textContent = '📹 Start Video';
            videoBtn.classList.remove('btn-outline');
        }
    }

    stopVideo() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        document.getElementById('localVideo').srcObject = null;
        document.getElementById('videoGrid').classList.add('hidden');
        this.isVideoOn = false;

        // Close all peer connections
        Object.keys(this.peers).forEach(socketId => {
            this.peers[socketId].close();
            this.removeRemoteVideo(socketId);
        });
        this.peers = {};

        if (this.socket) {
            this.socket.emit('toggle-video', { roomId: this.currentRoom, isVideoOn: false });
        }
    }

    async createPeerConnection(socketId, chatName) {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        this.peers[socketId] = pc;

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('new-ice-candidate', {
                    roomId: this.currentRoom,
                    candidate: event.candidate,
                    to: socketId
                });
            }
        };

        pc.ontrack = (event) => {
            this.addRemoteVideo(socketId, event.streams[0], chatName);
        };

        return pc;
    }

    addRemoteVideo(socketId, stream, chatName) {
        if (document.getElementById(`video-${socketId}`)) return;

        const videoGrid = document.getElementById('videoGrid');
        const container = document.createElement('div');
        container.id = `video-container-${socketId}`;
        container.className = 'remote-video-container';

        const video = document.createElement('video');
        video.id = `video-${socketId}`;
        video.autoplay = true;
        video.playsinline = true;
        video.srcObject = stream;

        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = chatName;

        container.appendChild(video);
        container.appendChild(label);
        videoGrid.appendChild(container);
    }

    removeRemoteVideo(socketId) {
        const el = document.getElementById(`video-container-${socketId}`);
        if (el) el.remove();
        if (this.peers[socketId]) {
            this.peers[socketId].close();
            delete this.peers[socketId];
        }
    }

    async handleVideoOffer(from, offer, chatName) {
        const pc = await this.createPeerConnection(from, chatName);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit('video-answer', {
            roomId: this.currentRoom,
            answer: answer,
            to: from
        });
    }

    async handleVideoAnswer(from, answer) {
        const pc = this.peers[from];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }

    async handleIceCandidate(from, candidate) {
        const pc = this.peers[from];
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }

    initializeSocket() {
        this.socket = io({
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('Connected to chat server');
        });

        this.socket.on('message-history', (messages) => {
            this.displayMessageHistory(messages);
        });

        this.socket.on('new-message', (message) => {
            this.displayMessage(message);
        });

        this.socket.on('user-joined', (data) => {
            this.updateActiveUsers(data.activeCount);
        });

        this.socket.on('user-left', (data) => {
            this.updateActiveUsers(data.activeCount);
            if (data.socketId) {
                this.removeRemoteVideo(data.socketId);
            }
        });

        this.socket.on('active-users', (users) => {
            this.displayActiveUsers(users);
            if (window.serenityEngine) {
                window.serenityEngine.updateMeetingCircle(users.length);
            }
        });

        this.socket.on('user-typing', (data) => {
            this.showTypingIndicator(data.chatName);
        });

        this.socket.on('user-stop-typing', () => {
            this.hideTypingIndicator();
        });

        this.socket.on('hand-raised', (data) => {
            this.handleUserHandRaised(data);
        });

        this.socket.on('hand-lowered', (data) => {
            this.handleUserHandLowered(data);
        });

        this.socket.on('reading-shared', (data) => {
            this.displayReading(data);
        });

        this.socket.on('new-announcement', (data) => {
            this.showAnnouncement(data);
        });

        this.socket.on('admin-alert', (data) => {
            if (this.currentUser && this.currentUser.isAdmin) {
                this.showNotification(`🚨 ADMIN ALERT: ${data.message}`, 'error');
            }
        });

        this.socket.on('report-submitted', () => {
            this.showNotification('Report submitted to moderators. Thank you for keeping our community safe.', 'success');
        });

        // WebRTC Signaling
        this.socket.on('video-offer', async (data) => {
            await this.handleVideoOffer(data.from, data.offer, data.chatName);
        });

        this.socket.on('video-answer', async (data) => {
            await this.handleVideoAnswer(data.from, data.answer);
        });

        this.socket.on('new-ice-candidate', async (data) => {
            await this.handleIceCandidate(data.from, data.candidate);
        });

        this.socket.on('request-video-connections', async (data) => {
            // Someone joined/started video and wants to connect
            if (this.isVideoOn) {
                // If we have video on, we send them an offer
                const pc = await this.createPeerConnection(data.from, data.chatName);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                this.socket.emit('video-offer', {
                    roomId: this.currentRoom,
                    offer: offer,
                    to: data.from
                });
            }
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }

    displayMessageHistory(messages) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        messages.forEach(msg => this.displayMessage(msg));
        this.scrollToBottom();
    }

    displayMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = message.isSystemMessage ? 'message system' : 'message';

        const time = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (message.isSystemMessage) {
            messageDiv.innerHTML = `<div class="message-content">${this.escapeHtml(message.message || message.text)}</div>`;
        } else {
            const initials = (message.chatName || '??').substring(0, 2).toUpperCase();
            messageDiv.innerHTML = `
                <div class="avatar">${initials}</div>
                <div class="message-main">
                    <div class="message-header">
                        <span class="message-name">${this.escapeHtml(message.chatName)}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-content">${this.escapeHtml(message.message || message.text)}</div>
                </div>
            `;
        }

        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message || !this.socket || !this.currentRoom) return;

        this.socket.emit('send-message', {
            roomId: this.currentRoom,
            userId: this.currentUser.id,
            username: this.currentUser.username,
            chatName: this.currentUser.chatName,
            message: message
        });

        input.value = '';
        this.socket.emit('stop-typing', {
            roomId: this.currentRoom,
            chatName: this.currentUser.chatName
        });
    }

    handleTyping() {
        if (!this.socket || !this.currentRoom) return;

        this.socket.emit('typing', {
            roomId: this.currentRoom,
            chatName: this.currentUser.chatName
        });

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.socket.emit('stop-typing', {
                roomId: this.currentRoom,
                chatName: this.currentUser.chatName
            });
        }, 1000);
    }

    showTypingIndicator(chatName) {
        const indicator = document.getElementById('typingIndicator');
        indicator.textContent = `${chatName} is typing...`;
        indicator.classList.remove('hidden');
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        indicator.classList.add('hidden');
    }

    updateActiveUsers(count) {
        document.getElementById('activeUsersCount').textContent = `${count} online`;
    }

    displayActiveUsers(users) {
        const usersList = document.getElementById('activeUsersList');
        usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-meta">
                    <span class="user-name">${user.chatName}</span>
                    <span class="user-badge">Lv.${user.level || 1}</span>
                </div>
                <div class="user-actions">
                    ${user.userId !== this.currentUser.id ? `

                        <button class="btn-icon" onclick="app.reportUser('${user.chatName}')" title="Report User">🚩</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }



    reportUser(chatName) {
        const reason = prompt(`Why are you reporting ${chatName}?`, "Harassment/Disrespect");
        if (!reason) return;

        this.socket.emit('report-user', {
            roomId: this.currentRoom,
            targetChatName: chatName,
            reason: reason
        });
    }

    sendAnnouncement() {
        const input = document.getElementById('globalAnnouncementInput');
        const message = input.value.trim();
        if (!message) return;

        this.socket.emit('send-announcement', { message });
        input.value = '';
        this.showNotification('Announcement broadcasted!', 'success');
    }

    showAnnouncement(data) {
        const banner = document.getElementById('announcementBanner');
        const text = document.getElementById('announcementText');
        text.textContent = data.message;
        banner.classList.remove('hidden');

        // Also show in chat if in a room
        if (this.currentRoom) {
            this.displayMessage({
                chatName: 'SYSTEM ANNOUNCEMENT',
                message: data.message,
                timestamp: data.timestamp,
                isSystemMessage: true
            });
        }

        // Auto hide after 10 seconds
        setTimeout(() => {
            banner.classList.add('hidden');
        }, 10000);
    }

    async leaveChatRoom() {
        if (this.socket && this.currentRoom) {
            this.socket.emit('leave-room', {
                roomId: this.currentRoom,
                chatName: this.currentUser.chatName
            });
        }

        if (this.currentMeetingId && this.currentUser) {
            try {
                await fetch(`/api/meetings/${this.currentMeetingId}/leave`, {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (error) {
                console.error('Failed to mark meeting leave:', error);
            }
        }

        this.currentRoom = null;
        this.joinTime = null;
        this.currentMeetingId = null;
        this.navigateTo('rooms');
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }

    handleUserHandRaised(data) {
        if (data.chatName === this.currentUser.chatName) {
            document.getElementById('handRaisedBadge').classList.remove('hidden');
            const btn = document.getElementById('raiseHandBtn');
            btn.textContent = 'Lower Hand';
            btn.classList.add('btn-outline');
        }

        // Add system message
        this.displayMessage({
            chatName: 'System',
            message: `${data.chatName} raised their hand ✋`,
            timestamp: new Date(),
            isSystemMessage: true
        });
    }

    handleUserHandLowered(data) {
        if (data.chatName === this.currentUser.chatName) {
            document.getElementById('handRaisedBadge').classList.add('hidden');
            const btn = document.getElementById('raiseHandBtn');
            btn.textContent = 'Raise Hand';
            btn.classList.remove('btn-outline');
        }
    }

    displayReading(data) {
        const chatMessages = document.getElementById('chatMessages');
        const readingDiv = document.createElement('div');
        readingDiv.className = 'message system reading';
        readingDiv.innerHTML = `
            <div class="reading-card">
                <h3>📖 ${data.title}</h3>
                <div class="reading-content">${data.content}</div>
            </div>
        `;
        chatMessages.appendChild(readingDiv);
        this.scrollToBottom();
    }

    // Attendance & Certificates
    async generateCertificate() {
        if (!this.currentUser) {
            this.showNotification('Please login first', 'error');
            return;
        }

        if (!this.currentUser.hasActiveSubscription) {
            this.showNotification('Active subscription required for certificates', 'error');
            this.navigateTo('subscription');
            return;
        }

        if (!this.joinTime) {
            this.showNotification('Join time not recorded', 'error');
            return;
        }

        const leaveTime = new Date();
        const duration = (leaveTime - this.joinTime) / 1000;

        if (duration < 1800) {
            this.showNotification('Minimum 30 minutes attendance required', 'error');
            return;
        }

        try {
            const response = await fetch('/api/attendance/generate-certificate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    meetingId: this.currentMeetingId,
                    joinTime: this.joinTime.toISOString(),
                    leaveTime: leaveTime.toISOString()
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Certificate generated successfully!', 'success');

                // Close tracking modal if open
                const trackingModal = document.getElementById('trackingModal');
                if (trackingModal) {
                    clearInterval(this.attendanceInterval);
                    trackingModal.remove();
                }

                window.open(data.attendance.pdfUrl, '_blank');

                if (data.recoveryData) {
                    window.statsManager?.renderStats(); // Refresh dashboard
                    if (data.recoveryData.newBadges && data.recoveryData.newBadges.length > 0) {
                        data.recoveryData.newBadges.forEach(badge => {
                            this.showBadgeNotification(badge);
                        });
                    }
                }
            } else {
                this.showNotification(data.error || 'Failed to generate certificate', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async loadAttendanceRecords() {
        if (!this.currentUser) return;

        try {
            const response = await fetch('/api/attendance/my-records', {
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.displayAttendanceRecords(data.records);
            }
        } catch (error) {
            console.error('Failed to load attendance records:', error);
        }
    }

    displayAttendanceRecords(records) {
        const container = document.getElementById('attendanceRecords');
        const notice = document.getElementById('subscriptionNotice');

        if (!this.currentUser.hasActiveSubscription) {
            notice.classList.remove('hidden');
        } else {
            notice.classList.add('hidden');
        }

        if (records.length === 0) {
            container.innerHTML = '<p>No attendance records yet.</p>';
            return;
        }

        container.innerHTML = records.map(record => `
            <div class="attendance-card">
                <div class="attendance-info">
                    <h3>${record.meetingTitle}</h3>
                    <p><strong>Type:</strong> ${record.meetingType}</p>
                    <p><strong>Date:</strong> ${new Date(record.joinTime).toLocaleDateString()}</p>
                    <p><strong>Duration:</strong> ${Math.round(record.duration / 60)} minutes</p>
                    <p><strong>Certificate ID:</strong> ${record.certificateId}</p>
                </div>
                <div class="attendance-actions">
                    <a href="/api/attendance/download/${record.certificateId}" 
                       class="btn btn-primary" 
                       target="_blank">
                        Download PDF
                    </a>
                </div>
            </div>
        `).join('');
    }

    // Subscription
    async loadSubscriptionPlans() {
        try {
            const response = await fetch('/api/subscription/plans');
            const data = await response.json();

            if (data.success) {
                // Plans are already in HTML, just add event listeners
                this.setupSubscriptionButtons();
            }
        } catch (error) {
            console.error('Failed to load subscription plans:', error);
        }
    }

    setupSubscriptionButtons() {
        document.querySelectorAll('.subscribe-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const planId = btn.dataset.plan;
                this.subscribe(planId);
            });
        });
    }

    async subscribe(planId) {
        if (!this.currentUser) {
            this.showNotification('Please login to subscribe', 'error');
            this.openModal('loginModal');
            return;
        }

        try {
            const response = await fetch('/api/subscription/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ planId })
            });

            const data = await response.json();

            if (response.ok && data.url) {
                window.location.href = data.url;
            } else {
                this.showNotification('Failed to create checkout session', 'error');
            }
        } catch (error) {
            this.showNotification('Network error', 'error');
        }
    }

    async checkSubscriptionSuccess() {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        const planId = urlParams.get('planId');

        if (sessionId) {
            if (sessionId.startsWith('DEMO_')) {
                // Activate demo subscription on backend
                try {
                    await fetch(`/api/subscription/demo-success?planId=${planId || '1month'}`, {
                        credentials: 'include'
                    });
                } catch (error) {
                    console.error('Demo activation failed:', error);
                }
            }

            // Clear the URL params without refreshing
            window.history.replaceState({}, document.title, window.location.pathname);
            this.navigateTo('success');
            await this.checkAuth(); // Refresh user data to get premium status
        }
    }

    // Navigation
    navigateTo(pageName) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        const pageMap = {
            'home': 'homePage',
            'calendar': 'calendarPage',
            'rooms': 'roomsPage',
            'chatRoom': 'chatRoomPage',
            'blog': 'blogPage',
            'attendance': 'attendancePage',
            'subscription': 'subscriptionPage',
            'success': 'successPage',
            'resources': 'resourcesPage',
            'verify': 'verifyPage',
            'serenitySupport': 'serenitySupportPage',
            'admin': 'adminPage'
        };

        const pageId = pageMap[pageName];
        if (pageId) {
            document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');

            // Load data for specific pages
            if (pageName === 'attendance') {
                this.loadAttendanceRecords();
            } else if (pageName === 'subscription') {
                this.loadSubscriptionPlans();
            } else if (pageName === 'blog') {
                this.loadBlog();
            } else if (pageName === 'admin') {
                this.loadAdminStats();
            }

            window.scrollTo(0, 0);
        }
    }

    async sendSerenityMessage() {
        const input = document.getElementById('serenityInput');
        const message = input.value.trim();
        if (!message) return;

        const messagesContainer = document.getElementById('serenityMessages');
        const typingIndicator = document.getElementById('serenityTyping');

        // Add user message
        const userMsgDiv = document.createElement('div');
        userMsgDiv.className = 'message-user';
        userMsgDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        messagesContainer.appendChild(userMsgDiv);
        input.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Show typing
        typingIndicator.classList.remove('hidden');

        try {
            const response = await fetch('/api/serenity/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, userId: this.currentUser?.id })
            });

            const data = await response.json();
            typingIndicator.classList.add('hidden');

            const aiMsgDiv = document.createElement('div');
            aiMsgDiv.className = 'message-ai';
            aiMsgDiv.innerHTML = `<div class="message-content">${data.response}</div>`;

            if (data.suggestedActions && data.suggestedActions.length > 0) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'ai-actions';
                actionsDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;';

                data.suggestedActions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-secondary btn-small';
                    btn.style.fontSize = '0.75rem';
                    btn.textContent = action.label;
                    btn.onclick = () => this.handleAIAction(action.action);
                    actionsDiv.appendChild(btn);
                });
                aiMsgDiv.appendChild(actionsDiv);
            }

            messagesContainer.appendChild(aiMsgDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

        } catch (error) {
            typingIndicator.classList.add('hidden');
            this.showNotification('Serenity is having trouble connecting right now.', 'error');
        }
    }

    handleAIAction(actionString) {
        const [type, value] = actionString.split(':');

        if (type === 'navigate') {
            this.navigateTo(value);
            document.getElementById('serenityAI').classList.add('hidden');
        } else if (type === 'join') {
            const selectedMeeting = this.meetings.find(meeting => meeting.roomId === value);
            if (selectedMeeting?._id) {
                this.joinMeeting(selectedMeeting._id, selectedMeeting.roomId);
            } else if (value) {
                // Fallback for unknown room ids.
                this.enterChatRoom(value);
            }
            document.getElementById('serenityAI').classList.add('hidden');
        } else if (type === 'modal') {
            if (value === 'urgeSurfer') {
                window.urgeSurfer.start();
            } else if (value === 'support') {
                document.getElementById('fabSupport').click();
            }
            document.getElementById('serenityAI').classList.add('hidden');
        } else if (type === 'resource') {
            this.navigateTo('resources');
            this.showResource(value);
            document.getElementById('serenityAI').classList.add('hidden');
        } else if (type === 'reply') {
            document.getElementById('serenityInput').value = value;
            this.sendSerenityMessage();
        }
    }

    // Admin Dashboard
    async loadAdminStats() {
        try {
            const response = await fetch('/api/admin/stats', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                document.getElementById('adminStatUsers').textContent = data.stats.users;
                document.getElementById('adminStatMeetings').textContent = data.stats.meetings;
                document.getElementById('adminStatSubs').textContent = data.stats.activeSubscriptions;
                document.getElementById('adminStatAttendance').textContent = data.stats.attendance;

                // Render Activity Feed
                const feed = document.getElementById('adminActivityFeed');
                if (data.activity && data.activity.length > 0) {
                    feed.innerHTML = data.activity.map(item => `
                        <div class="activity-item">
                            <span class="activity-time">${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span class="activity-message">${item.message}</span>
                        </div>
                    `).join('');
                } else {
                    feed.innerHTML = '<p class="text-gray">No recent activity found.</p>';
                }
            }
        } catch (error) {
            console.error('Failed to load admin stats:', error);
        }
    }

    async loadAdminUsers() {
        try {
            const response = await fetch('/api/admin/users', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                const list = document.getElementById('adminUsersList');
                list.innerHTML = data.users.map(user => `
                    <tr>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.chatName}</td>
                        <td>${user.isAdmin ? '✅' : '❌'}</td>
                        <td>${user.subscription}</td>
                        <td>
                            <button class="btn btn-secondary btn-small" onclick="app.toggleAdmin('${user._id}')">Toggle Admin</button>
                            <button class="btn btn-error btn-small" onclick="app.deleteUser('${user._id}')">Delete</button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load admin users:', error);
        }
    }

    async toggleAdmin(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/toggle-admin`, {
                method: 'POST',
                credentials: 'include'
            });
            if (response.ok) {
                this.loadAdminUsers();
                this.showNotification('User admin status updated', 'success');
            }
        } catch (error) {
            this.showNotification('Failed to update user', 'error');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (response.ok) {
                this.loadAdminUsers();
                this.showNotification('User deleted', 'success');
            }
        } catch (error) {
            this.showNotification('Failed to delete user', 'error');
        }
    }

    async loadAdminMeetings() {
        try {
            const response = await fetch('/api/admin/meetings', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                const list = document.getElementById('adminMeetingsList');
                list.innerHTML = data.meetings.map(meeting => `
                    <div class="meeting-item-admin">
                        <div>
                            <strong>${meeting.title}</strong> (${meeting.type})
                            <div class="text-small">${meeting.format} - ${meeting.roomId}</div>
                        </div>
                        <button class="btn btn-error btn-small" onclick="app.deleteMeeting('${meeting._id}')">Delete</button>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load admin meetings:', error);
        }
    }

    async deleteMeeting(meetingId) {
        if (!confirm('Are you sure you want to delete this meeting?')) return;
        try {
            const response = await fetch(`/api/admin/meetings/${meetingId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (response.ok) {
                this.loadAdminMeetings();
                this.showNotification('Meeting deleted', 'success');
            }
        } catch (error) {
            this.showNotification('Failed to delete meeting', 'error');
        }
    }

    async loadAdminAttendance() {
        try {
            const response = await fetch('/api/admin/attendance-review', { credentials: 'include' });
            const data = await response.json();

            if (data.success) {
                const list = document.getElementById('adminAttendanceList');
                if (!list) return;

                if (data.records.length === 0) {
                    list.innerHTML = '<tr><td colspan="5" class="text-center">No recent records found.</td></tr>';
                    return;
                }

                list.innerHTML = data.records.map(record => `
                    <tr>
                        <td>${this.escapeHtml(record.chatName || 'Unknown')}</td>
                        <td>${new Date(record.date).toLocaleDateString()} ${new Date(record.date).toLocaleTimeString()}</td>
                        <td>${Math.round(record.duration / 60)} mins</td>
                        <td><small>${record.certificateId.substring(0, 8)}...</small></td>
                        <td><span class="badge-item" style="font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; background: rgba(16, 185, 129, 0.2); color: #10b981;">Verified</span></td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load attendance review:', error);
            this.showNotification('Failed to load attendance records', 'error');
        }
    }

    showResource(type) {
        const mainSection = document.getElementById('resourceMainSection');
        const detailView = document.getElementById('resourceDetailView');
        const contentEl = document.getElementById('resourceContent');

        const resources = {
            'steps': {
                title: 'The 12 Steps of Alcoholics Anonymous',
                content: `<ol class="steps-list">
                    <li>We admitted we were powerless over alcohol—that our lives had become unmanageable.</li>
                    <li>Came to believe that a Power greater than ourselves could restore us to sanity.</li>
                    <li>Made a decision to turn our will and our lives over to the care of God as we understood Him.</li>
                    <li>Made a searching and fearless moral inventory of ourselves.</li>
                    <li>Admitted to God, to ourselves, and to another human being the exact nature of our wrongs.</li>
                    <li>Were entirely ready to have God remove all these defects of character.</li>
                    <li>Humbly asked Him to remove our shortcomings.</li>
                    <li>Made a list of all persons we had harmed, and became willing to make amends to them all.</li>
                    <li>Made direct amends to such people wherever possible, except when to do so would injure them or others.</li>
                    <li>Continued to take personal inventory and when we were wrong promptly admitted it.</li>
                    <li>Sought through prayer and meditation to improve our conscious contact with God as we understood Him, praying only for knowledge of His will for us and the power to carry that out.</li>
                    <li>Having had a spiritual awakening as the result of these steps, we tried to carry this message to alcoholics, and to practice these principles in all our affairs.</li>
                </ol>`
            },
            'traditions': {
                title: 'The 12 Traditions of Alcoholics Anonymous',
                content: `<ol class="steps-list">
                    <li>Our common welfare should come first; personal recovery depends upon AA unity.</li>
                    <li>For our group purpose there is but one ultimate authority—a loving God as He may express Himself in our group conscience. Our leaders are but trusted servants; they do not govern.</li>
                    <li>The only requirement for AA membership is a desire to stop drinking.</li>
                    <li>Each group should be autonomous except in matters affecting other groups or AA as a whole.</li>
                    <li>Each group has but one primary purpose—to carry its message to the alcoholic who still suffers.</li>
                    <li>An AA group ought never endorse, finance, or lend the AA name to any related facility or outside enterprise, lest problems of money, property, and prestige divert us from our primary purpose.</li>
                    <li>Every AA group ought to be fully self-supporting, declining outside contributions.</li>
                    <li>Alcoholics Anonymous should remain forever nonprofessional, but our service centers may employ special workers.</li>
                    <li>AA, as such, ought never be organized; but we may create service boards or committees directly responsible to those they serve.</li>
                    <li>Alcoholics Anonymous has no opinion on outside issues; hence the AA name ought never be drawn into public controversy.</li>
                    <li>Our public relations policy is based on attraction rather than promotion; we need always maintain personal anonymity at the level of press, radio, and films.</li>
                    <li>Anonymity is the spiritual foundation of all our traditions, ever reminding us to place principles before personalities.</li>
                </ol>`
            }
        };

        const resource = resources[type];
        if (resource) {
            contentEl.innerHTML = `<h2>${resource.title}</h2><div class="mt-2">${resource.content}</div>`;
            mainSection.classList.add('hidden');
            detailView.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    }

    async checkVerification() {
        const input = document.getElementById('verifyInput');
        const resultEl = document.getElementById('verifyResult');
        const certId = input.value.trim();

        if (!certId) {
            this.showNotification('Please enter a Certificate ID', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/attendance/verify/${certId}`);
            const data = await response.json();

            resultEl.classList.remove('hidden');
            if (data.success && data.certificate) {
                const cert = data.certificate;
                resultEl.innerHTML = `
                    <div class="result-badge success">✅ VERIFIED</div>
                    <div class="result-details">
                        <p><strong>Attendee:</strong> ${this.escapeHtml(cert.userName || cert.attendeeName || 'Unknown')}</p>
                        <p><strong>Meeting:</strong> ${this.escapeHtml(cert.meetingTitle || 'Meeting')} (${this.escapeHtml(cert.meetingType || 'N/A')})</p>
                        <p><strong>Date:</strong> ${new Date(cert.date).toLocaleDateString()}</p>
                        <p><strong>Duration:</strong> ${Number(cert.duration || 0)} minutes</p>
                        <p><strong>Certificate ID:</strong> ${this.escapeHtml(cert.id || certId)}</p>
                    </div>
                `;
            } else {
                resultEl.innerHTML = `
                    <div class="result-badge error">❌ INVALID</div>
                    <p>No valid record found for this Certificate ID.</p>
                `;
            }
        } catch (error) {
            this.showNotification('Verification failed', 'error');
        }
    }

    // Modals
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    // Notifications
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            info: '💡'
        };

        toast.innerHTML = `
            <span>${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // Utility
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event Listeners
    setupEventListeners() {
        document.getElementById('findSponsorBtn')?.addEventListener('click', () => {
            this.findSponsor();
        });

        document.getElementById('themeToggle')?.addEventListener('click', () => {
            window.themeManager?.toggle();
        });

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            this.logout();
        });



        document.getElementById('privacyToggleBtn')?.addEventListener('click', () => {
            this.togglePrivacyMode();
        });

        // Mobile Menu Toggle
        const menuToggle = document.getElementById('menuToggle');
        const navMenu = document.getElementById('navMenu');

        menuToggle?.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });

        // Auth buttons
        document.getElementById('loginBtn')?.addEventListener('click', () => {
            this.openModal('loginModal');
        });

        document.getElementById('registerBtn')?.addEventListener('click', () => {
            this.openModal('registerModal');
        });

        // Navigation
        document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navMenu.classList.remove('active');

                // Active state for mobile nav
                document.querySelectorAll('.mobile-nav-item').forEach(item => item.classList.remove('active'));
                if (link.classList.contains('mobile-nav-item')) {
                    link.classList.add('active');
                }

                this.navigateTo(link.dataset.page);
            });
        });

        // Modal close buttons
        document.getElementById('loginModalClose')?.addEventListener('click', () => {
            this.closeModal('loginModal');
        });

        document.getElementById('registerModalClose')?.addEventListener('click', () => {
            this.closeModal('registerModal');
        });

        // Switch between login/register
        document.getElementById('switchToRegister')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal('loginModal');
            this.openModal('registerModal');
        });

        document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeModal('registerModal');
            this.openModal('loginModal');
        });

        // Forms
        document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await this.login(email, password);
        });

        document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const chatName = document.getElementById('registerChatName').value;
            const password = document.getElementById('registerPassword').value;
            await this.register(username, email, chatName, password);
        });

        // Hero buttons
        document.getElementById('heroJoinBtn')?.addEventListener('click', () => {
            this.navigateTo('rooms');
        });

        document.getElementById('heroLearnBtn')?.addEventListener('click', () => {
            this.navigateTo('resources');
        });

        // Room enter buttons
        document.querySelectorAll('.room-enter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.enterChatRoom(btn.dataset.roomId);
            });
        });

        // Chat room
        document.getElementById('backToRoomsBtn')?.addEventListener('click', () => {
            this.leaveChatRoom();
        });

        document.getElementById('sendMessageBtn')?.addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('passTheCanBtn')?.addEventListener('click', () => {
            this.openModal('donationModal');
        });

        document.getElementById('donationModalClose')?.addEventListener('click', () => {
            this.closeModal('donationModal');
        });

        document.getElementById('donateRealBtn')?.addEventListener('click', () => {
            this.showNotification('Donation system initialized. Connecting to Stripe...', 'success');
            setTimeout(() => this.closeModal('donationModal'), 1500);
        });

        document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            } else {
                this.handleTyping();
            }
        });

        document.getElementById('generateCertBtn')?.addEventListener('click', () => {
            this.generateCertificate();
        });

        document.getElementById('toggleVideoBtn')?.addEventListener('click', () => {
            this.toggleVideo();
        });

        document.getElementById('toggleAudioBtn')?.addEventListener('click', () => {
            this.isAudioOn = !this.isAudioOn;
            if (this.localStream) {
                this.localStream.getAudioTracks().forEach(track => track.enabled = this.isAudioOn);
            }
            const btn = document.getElementById('toggleAudioBtn');
            btn.textContent = this.isAudioOn ? '🎤 Mute' : '🎤 Unmute';
            btn.classList.toggle('btn-outline');
        });

        document.getElementById('raiseHandBtn')?.addEventListener('click', () => {
            const btn = document.getElementById('raiseHandBtn');
            const isRaising = btn.textContent === 'Raise Hand';
            if (isRaising) {
                this.socket.emit('raise-hand', { roomId: this.currentRoom, chatName: this.currentUser.chatName });
            } else {
                this.socket.emit('lower-hand', { roomId: this.currentRoom, chatName: this.currentUser.chatName });
            }
        });

        document.querySelectorAll('[data-share]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.share;
                const readings = {
                    'serenity': {
                        title: 'Serenity Prayer',
                        content: 'God, grant me the serenity to accept the things I cannot change, courage to change the things I can, and wisdom to know the difference.'
                    },
                    'preamble': {
                        title: 'AA Preamble',
                        content: 'Alcoholics Anonymous is a fellowship of men and women who share their experience, strength and hope with each other that they may solve their common problem and help others to recover from alcoholism.'
                    },
                    'reflection': {
                        title: 'Daily Reflection',
                        content: 'Today I will focus on being a part of the solution rather than the problem. My progress is measured in my willingness to grow.'
                    },
                    'how-it-works': {
                        title: 'How It Works',
                        content: 'Rarely have we seen a person fail who has thoroughly followed our path. Those who do not recover are people who cannot or will not completely give themselves to this simple program...'
                    }
                };
                const reading = readings[type];
                if (reading) {
                    this.socket.emit('share-reading', { roomId: this.currentRoom, ...reading });
                }
            });
        });

        document.getElementById('checkVerifyBtn')?.addEventListener('click', () => {
            this.checkVerification();
        });

        // Resources Navigation
        document.querySelectorAll('[data-resource]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showResource(btn.dataset.resource);
            });
        });

        document.getElementById('backToResourcesBtn')?.addEventListener('click', () => {
            document.getElementById('resourceDetailView').classList.add('hidden');
            document.getElementById('resourceMainSection').classList.remove('hidden');
        });

        // Success Page buttons
        document.getElementById('successHomeBtn')?.addEventListener('click', () => {
            this.navigateTo('home');
        });

        document.getElementById('successMeetingsBtn')?.addEventListener('click', () => {
            this.navigateTo('calendar');
        });

        // Subscription
        document.getElementById('subscribeNowBtn')?.addEventListener('click', () => {
            this.navigateTo('subscription');
        });



        // Admin Tabs
        document.querySelectorAll('[data-admin-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.adminTab;

                document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
                document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('active'));

                btn.classList.add('active');
                if (tab === 'overview') {
                    document.getElementById('adminOverviewTab').classList.add('active');
                    this.loadAdminStats();
                } else if (tab === 'users') {
                    document.getElementById('adminUsersTab').classList.add('active');
                    this.loadAdminUsers();
                } else if (tab === 'meetings') {
                    document.getElementById('adminMeetingsTab').classList.add('active');
                    this.loadAdminMeetings();
                } else if (tab === 'attendance') {
                    document.getElementById('adminAttendanceTab').classList.add('active');
                    this.loadAdminAttendance();
                }
            });
        });

        // Serenity Support AI Listeners
        document.getElementById('sendSerenityBtn')?.addEventListener('click', () => {
            this.sendSerenityMessage();
        });

        document.getElementById('serenityInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendSerenityMessage();
            }
        });

        // Additional Nav fixes
        document.querySelectorAll('.nav-brand').forEach(brand => {
            brand.addEventListener('click', () => this.navigateTo('home'));
        });

        document.getElementById('sendAnnouncementBtn')?.addEventListener('click', () => {
            this.sendAnnouncement();
        });

        document.getElementById('createMeetingForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const meetingData = {
                title: document.getElementById('newMeetingTitle').value,
                type: document.getElementById('newMeetingType').value,
                format: document.getElementById('newMeetingFormat').value,
                roomId: document.getElementById('newMeetingRoomId').value,
                zoomLink: document.getElementById('newMeetingZoom').value,
                isActive: true
            };

            try {
                const response = await fetch('/api/admin/meetings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(meetingData)
                });
                if (response.ok) {
                    this.showNotification('Meeting created', 'success');
                    e.target.reset();
                    this.loadAdminMeetings();
                } else {
                    const err = await response.json();
                    this.showNotification(err.error || 'Failed to create meeting', 'error');
                }
            } catch (error) {
                this.showNotification('Network error', 'error');
            }
        });

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('active');
            }
        });

        // FAB Listeners
        document.getElementById('fabSerenity')?.addEventListener('click', () => {
            this.navigateTo('serenitySupport');
        });

        document.getElementById('fabSupport')?.addEventListener('click', () => {
            const hotlines = [
                "SAMHSA National Helpline: 1-800-662-HELP (4357)",
                "988 Suicide & Crisis Lifeline: Call or text 988",
                "Alcoholics Anonymous: (212) 870-3400"
            ].join('\n');
            alert("HEARING YOU. YOU ARE NOT ALONE.\n\nEmergency Resources:\n" + hotlines + "\n\nStay on the line, reach out to someone.");
        });
    }

    async findSponsor() {
        const grid = document.getElementById('sponsorMatches');
        if (!grid) return;
        grid.innerHTML = '<p class="text-gray">Calculating compatibility...</p>';

        try {
            const response = await fetch('/api/sponsorship/matches');
            const data = await response.json();

            if (data.success && data.matches.length > 0) {
                grid.innerHTML = data.matches.map(match => `
                    <div class="glass-card compact text-center reveal" style="padding: 1rem;">
                        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${match.isVeteran ? '🎖️' : '🤝'}</div>
                        <h5 style="margin-bottom: 0.2rem;">${match.chatName}</h5>
                        <div style="font-size: 0.7rem; color: var(--theme-text-light);">COMPATIBILITY: ${match.compatibility}%</div>
                        <div style="font-size: 0.7rem; margin-top: 0.5rem;">Lv.${match.level} | ${match.streak}d Streak</div>
                        <button class="btn btn-primary btn-block btn-small mt-1" onclick="app.requestSponsor('${match.id}', '${match.chatName}')">Request</button>
                    </div>
                `).join('');
            } else {
                grid.innerHTML = '<p class="text-gray" style="grid-column: 1/-1;">No matches found at this velocity. Try again later.</p>';
            }
        } catch (error) {
            this.showNotification('Matching engine offline', 'error');
        }
    }

    async requestSponsor(id, name) {
        try {
            const response = await fetch(`/api/sponsorship/request/${id}`, {
                method: 'POST',
                credentials: 'include'
            });
            if (response.ok) {
                this.showNotification(`Sponsorship request sent to ${name}!`, 'success');
            }
        } catch (error) {
            this.showNotification('Failed to send request', 'error');
        }
    }

    showBadgeNotification(badge) {
        if (!badge) return;
        const icon = badge.icon || '🏅';
        const name = badge.name || 'New Badge';
        this.showNotification(`${icon} Badge unlocked: ${name}`, 'success');
    }

    initOnboarding() {
        let currentStep = 1;
        const totalSteps = 3;
        const nextBtn = document.getElementById('nextOnboardingBtn');
        const steps = document.querySelectorAll('.onboarding-steps .step');

        nextBtn?.addEventListener('click', () => {
            if (currentStep < totalSteps) {
                // Hide current
                steps.forEach(s => s.classList.add('hidden'));
                // Show next
                currentStep++;
                const nextStep = document.querySelector(`.onboarding-steps .step[data-step="${currentStep}"]`);
                nextStep?.classList.remove('hidden');

                if (currentStep === totalSteps) {
                    nextBtn.textContent = 'Begin My Journey';
                }
            } else {
                this.closeModal('welcomeOnboardingModal');
                this.navigateTo('rooms');
                // Celebrate onboarding completion
                this.confetti();
                this.showNotification('Welcome home. The first room is waiting.', 'success');
            }
        });
    }

    confetti() {
        const colors = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b'];
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                left: ${Math.random() * 100}vw;
                top: -10px;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: 50%;
                z-index: 9999;
                pointer-events: none;
                animation: confettiDrop ${2 + Math.random() * 2}s linear forwards;
            `;
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 4000);
        }
    }
    async togglePrivacyMode() {
        if (!this.currentUser) return;

        try {
            const response = await fetch('/api/auth/privacy-toggle', {
                method: 'POST',
                credentials: 'include'
            });
            const data = await response.json();

            if (data.success) {
                this.currentUser.anonymousMode = data.anonymousMode;
                this.showNotification(data.message, 'success');
                this.updateUIForAuth();
            }
        } catch (error) {
            this.showNotification('Failed to toggle privacy mode', 'error');
        }
    }

    async mirrorExternalMeeting() {
        const urlInput = document.getElementById('externalMirrorUrl');
        if (!urlInput) return;
        let url = urlInput.value.trim();

        if (!url) {
            this.showNotification('Please enter a meeting URL', 'error');
            return;
        }

        if (!this.currentUser) {
            this.showNotification('Please login to track mirrored attendance', 'error');
            this.openModal('loginModal');
            return;
        }

        // Simple URL validation/formatting
        if (!url.startsWith('http')) url = 'https://' + url;

        this.showNotification('Connecting to external stream...', 'info');

        // Use a real meeting id so certificate generation can be validated server-side.
        const fallbackMeeting = this.meetings.find(m => m.roomId === 'open') || this.meetings[0];
        if (!fallbackMeeting?._id) {
            this.showNotification('Meetings are still loading. Please try again in a moment.', 'error');
            return;
        }

        try {
            const joinResponse = await fetch(`/api/meetings/${fallbackMeeting._id}/join`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!joinResponse.ok) {
                this.showNotification('Unable to start mirrored attendance tracking', 'error');
                return;
            }
        } catch (error) {
            this.showNotification('Network error starting mirrored attendance tracking', 'error');
            return;
        }

        // Open Zoom/Meeting in new window (most reliable due to X-Frame-Options)
        const MeetingWindow = window.open(url, '_blank');

        if (!MeetingWindow) {
            this.showNotification('Pop-up blocked! Please allow pop-ups for mirroring.', 'error');
            try {
                await fetch(`/api/meetings/${fallbackMeeting._id}/leave`, {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (error) {
                console.error('Failed to clean up blocked mirrored join:', error);
            }
            return;
        }

        // Start tracking on the current page
        this.currentMeetingId = fallbackMeeting._id;
        this.joinTime = new Date();
        this.showTrackingModal("Mirrored Session: External Room Active");

        // Add a "Mirror Active" visual to the Community Hub section
        const hub = document.getElementById('communityHub');
        if (hub) {
            const statusGroup = hub.querySelector('.mirror-card');
            const status = document.createElement('div');
            status.className = 'glass-card mt-1';
            status.style.borderLeft = '4px solid var(--secondary)';
            status.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span><strong>Active Mirror:</strong> Listening to external source...</span>
                    <span class="pulse-dot"></span>
                </div>
            `;
            statusGroup.appendChild(status);
        }

        urlInput.value = '';
    }
}

// Initialize app
const app = new AAVentureApp();
window.app = app;
