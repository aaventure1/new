# 🚀 AAVenture: Zero-Cost Deployment Guide (Free Forever)

This guide will walk you through deploying AAVenture using highly reliable free tiers: **Render** (for the app) and **MongoDB Atlas** (for the database).

## Part 1: Database (MongoDB Atlas)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and sign up for a free account.
2. Create a **New Cluster** (select the "Shared" or "Free" option, usually M0).
3. **Database Access**: Create a database user (e.g., `admin`) and password. **Save this password!**
4. **Network Access**: Click "Add IP Address" -> "Allow Access from Anywhere" (`0.0.0.0/0`). This is required for Render to connect.
5. Click **Connect** -> **Drivers** -> Copy the connection string.
   - It will look like: `mongodb+srv://admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`
   - Replace `<password>` with your actual password.
   - **Save this string.** You will need it in Part 2.

## Part 2: Hosting the App (Render)
1. Push your current code to GitHub.
2. Go to [Render.com](https://render.com) and sign up/login (using GitHub is easiest).
3. Click **New +** -> **Blueprint Instance**.
4. Connect your `aaventure` repository.
5. Render will automatically detect the `render.yaml` configuration.
6. Click **Apply**.
7. You will be prompted to enter your Environment Variables (secrets):
   - `MONGODB_URI`: Paste the connection string from Part 1.
   - `JWT_SECRET`: Strong random string for auth token signing.
   - `SESSION_SECRET`: Strong random string for session cookies.
   - `BASE_URL`: Your Render app URL (for links and callbacks).
   - `CLIENT_URL`: Usually the same as `BASE_URL`.
   - `ALLOWED_ORIGINS`: Optional comma-separated list for additional domains (for example staging or custom frontend domains).
   - `EMAIL_ENABLED`: `false` unless valid SMTP credentials are configured.
   - `ALLOW_DEMO_SUBSCRIPTIONS`: `false` in production.
8. Click **Create Web Service**.

## Part 3: Finalizing
1. Render will start building your app. It might take 2-5 minutes.
2. Once the build finishes, you will see a green "Live" badge.
3. Click the URL provided by Render (e.g., `https://aaventure.onrender.com`).
4. **Important**: Go back to your Environment Variables and update `BASE_URL` with this actual URL if you haven't already.

## Troubleshooting
- **Build Fails?** Check the "Logs" tab in Render.
- **Can't Connect to DB?** Ensure you whitelisted `0.0.0.0/0` in MongoDB Atlas Network Access.
- **Updates**: Whenever you push code to GitHub, Render will automatically re-deploy your site!
