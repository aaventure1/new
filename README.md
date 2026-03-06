# AAVenture - Online Recovery Meetings Platform

A comprehensive online platform for AA, NA, and recovery support meetings with court-ordered proof of attendance certificates. Built to replicate and enhance the 12step-online.com business model.

## 🤝 Help Build This

We are actively looking for contributors and early collaborators.

- Start here: `CONTRIBUTING.md`
- Roadmap: `docs/OPEN_SOURCE_ROADMAP.md`
- Open issues labeled `help wanted` and `good first issue` are ideal entry points.
- Community expectations: `CODE_OF_CONDUCT.md`
- Security reporting: `SECURITY.md`

## 🌟 Features

### Core Features
- **24/7 Chat Rooms**: Real-time text-based recovery support rooms (AA, NA, Christian, Open)
- **Scheduled Video Meetings**: Zoom-integrated scheduled meetings
- **User Authentication**: Secure registration and login system
- **Anonymous Chat Names**: Users can choose anonymous names for privacy

### Premium Features (Subscription Required)
- **Court-Ordered Proof of Attendance**: Generate official attendance certificates
- **Instant PDF Download**: Immediate certificate generation after meetings
- **Attendance Tracking**: Complete history of all attended meetings
- **Verification System**: Unique verification codes for each certificate
- **30-Minute Minimum**: Automatic duration tracking for valid certificates

- **Premium UI/UX**: Modern glassmorphism design with smooth animations, mesh gradients, and frosted glass aesthetics
- **WordPress Integration**: Headless CMS capability for Blog and "Just for Today" (JFT) daily reflections
- **Donation System**: "Pass the Can" floating CTA for community support
- **Resources Library**: Comprehensive guides for 12 Steps, Traditions, and literature

## 🚀 Quick Start

### Prerequisites
- Node.js (v20.19 or higher)
- MongoDB (v4.4 or higher)
- Stripe account (for payments)

### Installation

1. **Clone and Install**
```bash
cd aaventure
npm install
```

2. **Start MongoDB**
```bash
# On macOS with Homebrew:
brew services start mongodb-community

# Or manually:
mongod --dbpath /path/to/your/data/directory
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Seed Database**
```bash
npm run seed
```

5. **Start Server**
```bash
npm run dev
```

6. **Access Application**
Open your browser to: http://localhost:3000

## 📋 Configuration

### Environment Variables

Edit `.env` file with your settings:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/aaventure

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-super-secret-session-key

# Stripe (Get from https://dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URLs
BASE_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
```

### Stripe Setup

1. Create account at https://stripe.com
2. Get API keys from Dashboard > Developers > API keys
3. Set up webhook endpoint: `/api/subscription/webhook`
4. Add webhook secret to `.env`

## 💳 Subscription Plans

Matching 12step-online.com pricing:

- **1 Month**: $20.00
- **2 Months**: $35.00 (Save $5)
- **3 Months**: $45.00 (Save $15)

All plans include:
- Court-Ordered Proof of Attendance
- Immediate PDF Certificates
- Attendance Tracking
- Verification Support
- Access to All Meetings

## 🏗️ Architecture

### Backend
- **Framework**: Express.js
- **Real-time**: Socket.io
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT + Express Sessions
- **Payments**: Stripe
- **PDF Generation**: PDFKit

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Custom design with gradients and animations
- **JavaScript**: Vanilla JS with Socket.io client
- **No Framework**: Pure web technologies for maximum performance

### Database Models
- **User**: Authentication, subscription, attendance records
- **Meeting**: Room configuration and scheduling
- **Message**: Chat history
- **Attendance**: Certificate records with verification

## 📁 Project Structure

```
aaventure/
├── server/
│   ├── models/          # Database models
│   │   ├── User.js
│   │   ├── Meeting.js
│   │   ├── Message.js
│   │   └── Attendance.js
│   ├── routes/          # API routes
│   │   ├── auth.js
│   │   ├── meetings.js
│   │   ├── attendance.js
│   │   └── subscription.js
│   ├── middleware/      # Auth middleware
│   │   └── auth.js
│   ├── utils/           # Utilities
│   │   └── certificateGenerator.js
│   ├── index.js         # Main server file
│   └── seed.js          # Database seeding
├── public/
│   ├── css/
│   │   └── style.css    # Premium styling
│   ├── js/
│   │   └── app.js       # Client application
│   ├── certificates/    # Generated PDFs
│   └── index.html       # Main HTML
├── .env                 # Environment config
├── .env.example         # Config template
├── package.json
└── README.md
```

## 🔐 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Session management with MongoDB store
- CORS protection
- Input validation
- SQL injection prevention (NoSQL)
- XSS protection

## 📱 Usage Guide

### For Users

1. **Register**: Create account with username, email, and chat name
2. **Join Meetings**: Enter any 24/7 chat room or scheduled meeting
3. **Chat**: Participate in recovery discussions
4. **Subscribe**: Purchase subscription for certificates
5. **Get Certificates**: After 30+ minutes, generate proof of attendance
6. **Download**: Instant PDF download with verification code

### For Administrators

- Add meetings via API or database
- Monitor user activity
- Manage subscriptions
- Verify certificates

## 🎨 Design Philosophy

- **Premium Aesthetics**: Vibrant gradients, glassmorphism, smooth animations
- **User-Centric**: Intuitive navigation and clear call-to-actions
- **Accessibility**: High contrast, readable fonts, semantic HTML
- **Responsive**: Mobile-first design approach
- **Performance**: Optimized assets and efficient code

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Meetings
- `GET /api/meetings` - List all meetings
- `GET /api/meetings/room/:roomId` - Get meeting by room
- `POST /api/meetings/:id/join` - Join meeting
- `POST /api/meetings/:id/leave` - Leave meeting

### Attendance
- `GET /api/attendance/my-records` - Get user's records
- `POST /api/attendance/generate-certificate` - Generate certificate
- `GET /api/attendance/verify/:certificateId` - Verify certificate
- `GET /api/attendance/download/:certificateId` - Download PDF

### Subscription
- `GET /api/subscription/plans` - Get pricing plans
- `POST /api/subscription/create-checkout` - Create Stripe checkout
- `POST /api/subscription/webhook` - Stripe webhook
- `GET /api/subscription/status` - Check subscription status

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","chatName":"Test User","password":"password123"}'
```

## 🚀 Deployment

### Production Checklist

1. ✅ Change JWT_SECRET and SESSION_SECRET
2. ✅ Set up production MongoDB (MongoDB Atlas)
3. ✅ Configure Stripe production keys
4. ✅ Set NODE_ENV=production
5. ✅ Enable HTTPS
6. ✅ Set up domain and SSL certificate
7. ✅ Configure CORS for production domain
8. ✅ Set up monitoring and logging
9. ✅ Configure backup strategy
10. ✅ Set up email notifications

### Deployment Platforms

- **Heroku**: Easy deployment with MongoDB Atlas
- **DigitalOcean**: VPS with full control
- **AWS**: Scalable cloud infrastructure
- **Vercel/Netlify**: Frontend + serverless functions

## 📊 Business Model

Replicates 12step-online.com:

1. **Free Tier**: Access to all chat rooms and meetings
2. **Premium Tier**: Court-ordered proof of attendance
3. **Revenue Streams**:
   - Subscription fees ($20-45/month)
   - Potential affiliate partnerships
   - Donation system ("Pass the Can")

## 🤝 Contributing

This is a private project, but suggestions are welcome!

## 📄 License

ISC License - Copyright (c) 2026 Seth Kontny

## 🆘 Support

For issues or questions:
- Check the documentation
- Review API endpoints
- Check MongoDB connection
- Verify environment variables
- Check browser console for errors

## 🎯 Roadmap

- [ ] Video chat integration (WebRTC)
- [ ] Mobile apps (React Native)
- [ ] Email notifications
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] Multi-language support
- [ ] SMS reminders
- [ ] Integration with court systems

## 🙏 Acknowledgments

- Inspired by 12step-online.com
- Built with modern web technologies
- Designed to help people in recovery

---

**Built with ❤️ for the recovery community**
