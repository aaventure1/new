# AAVenture Setup Guide

## Quick Start Options

### Option 0: Professional Hosting (Live Store)
If you are ready to take the project live, please see [DEPLOY.md](./DEPLOY.md).
It covers using **Railway.app** and **MongoDB Atlas** for a production-grade experience with SSL and 24/7 uptime.

### Option 1: Using Docker (Easiest for Local Development)

1. **Start Docker Desktop**
   - Open Docker Desktop application on your Mac
   - Wait for it to fully start (whale icon in menu bar should be steady)

2. **Start MongoDB**
   ```bash
   docker-compose up -d
   ```

3. **Seed Database**
   ```bash
   npm run seed
   ```

4. **Start Server**
   ```bash
   npm run dev
   ```

5. **Access Application**
   - Open browser to: http://localhost:3000

### Option 2: Using Homebrew MongoDB

1. **Install MongoDB** (if not installed)
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   ```

2. **Start MongoDB**
   ```bash
   brew services start mongodb-community
   ```

3. **Seed Database**
   ```bash
   npm run seed
   ```

4. **Start Server**
   ```bash
   npm run dev
   ```

### Option 3: Manual MongoDB Start

1. **Create data directory**
   ```bash
   mkdir -p ~/data/db
   ```

2. **Start MongoDB manually**
   ```bash
   mongod --dbpath ~/data/db
   ```
   (Keep this terminal open)

3. **In a new terminal, seed database**
   ```bash
   cd /Users/smk/dev/aaventure
   npm run seed
   ```

4. **Start server**
   ```bash
   npm run dev
   ```

## Troubleshooting

### MongoDB Connection Issues

**Error: "MongoParseError" or connection refused**
- Make sure MongoDB is running: `pgrep mongod`
- Check MongoDB logs: `tail -f ~/data/db/mongodb.log`
- Try restarting MongoDB

**Error: "ECONNREFUSED"**
- MongoDB is not running
- Start MongoDB using one of the options above

### Port Already in Use

**Error: "Port 3000 already in use"**
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

**Error: "Port 27017 already in use"**
- MongoDB is already running (this is good!)
- Just proceed with seeding and starting the server

### Stripe Configuration

For testing without Stripe:
- The app will work without valid Stripe keys
- Subscription features will fail gracefully
- You can test all other features

To enable payments:
1. Sign up at https://stripe.com
2. Get test API keys from Dashboard
3. Update `.env` file with your keys

## First Time Setup Checklist

- [ ] Node.js installed (v20.19+)
- [ ] MongoDB running (Docker, Homebrew, or manual)
- [ ] Dependencies installed (`npm install`)
- [ ] Environment configured (`.env` file exists)
- [ ] Database seeded (`npm run seed`)
- [ ] Server started (`npm run dev`)
- [ ] Browser open to http://localhost:3000

## Testing the Application

### 1. Register a User
- Click "Register" button
- Fill in: username, email, chat name, password
- Submit

### 2. Join a Chat Room
- Click on any room (AA, NA, Christian, Open)
- Start chatting!

### 3. Test Attendance (Requires Subscription)
- Stay in a room for 30+ minutes
- Click "Get Certificate"
- Note: Requires active subscription

### 4. Subscribe (Test Mode)
- Go to "Subscribe" page
- Select a plan
- Use Stripe test card: 4242 4242 4242 4242
- Any future expiry date, any CVC

## Development Tips

### Watch Logs
```bash
# Server logs
npm run dev

# MongoDB logs (if manual start)
tail -f ~/data/db/mongodb.log
```

### Reset Database
```bash
# Drop database and reseed
mongosh aaventure --eval "db.dropDatabase()"
npm run seed
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:3000/api/health

# Get meetings
curl http://localhost:3000/api/meetings
```

## Production Deployment

See main README.md for production deployment checklist.

Key points:
- Change all secrets in `.env`
- Use MongoDB Atlas or production MongoDB
- Enable HTTPS
- Configure Stripe production keys
- Set NODE_ENV=production

## Need Help?

1. Check this guide
2. Review main README.md
3. Check server logs
4. Check browser console (F12)
5. Verify MongoDB is running
6. Verify all dependencies installed

## Common Commands

```bash
# Start everything (with Docker)
docker-compose up -d && npm run seed && npm run dev

# Stop MongoDB (Docker)
docker-compose down

# Stop MongoDB (Homebrew)
brew services stop mongodb-community

# View all running processes
ps aux | grep -E 'mongod|node'

# Kill all node processes
pkill -f node

# Reinstall dependencies
rm -rf node_modules package-lock.json && npm install
```
