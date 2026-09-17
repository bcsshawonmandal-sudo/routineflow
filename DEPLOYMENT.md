# Deploying RoutineFlow for Free (Netlify & GitHub)

RoutineFlow consists of a modern frontend and a lightweight Node.js backend that securely manages sessions and synchronizes with your **Turso LibSQL Cloud Database**.

---

## 💡 GitHub Pages vs. Netlify

| Platform | Free? | Can run Node Backend & Turso Sync? | Notes |
| :--- | :--- | :--- | :--- |
| **Netlify** (Recommended) | **100% Free** | **Yes** (via Serverless Functions) | Full Google login + Turso DB sync + global CDN |
| **Render.com** | **100% Free** | **Yes** (Node Web Service) | Runs `node server.js` directly out of the box |
| **GitHub Pages** | **100% Free** | Static only (No backend) | Cannot keep `TURSO_AUTH_TOKEN` private on server |

> **Best Approach**: Host your code in a private or public repository on **GitHub**, and connect it to **Netlify** or **Render** for free 1-click hosting!

---

## 🚀 How to Deploy on Netlify (Step-by-Step)

We have already configured `netlify.toml` and `netlify/functions/api.js` for you.

### Step 1: Push your project to GitHub

1. Open your terminal in this directory (`e:\website\routine`) and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of RoutineFlow"
   git branch -M main
   git remote add origin https://github.com/<YOUR-GITHUB-USERNAME>/routineflow.git
   git push -u origin main
   ```
   *(Note: The included `.gitignore` guarantees that your local `.env` containing your private database token is never leaked).*

---

### Step 2: Connect GitHub to Netlify

1. Sign up or log into [netlify.com](https://www.netlify.com/) (Free Tier).
2. Click **Add new site** $\rightarrow$ **Import an existing project**.
3. Choose **GitHub** and select your `routineflow` repository.
4. Netlify will automatically detect the settings from `netlify.toml`:
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`

---

### Step 3: Add your Environment Variables in Netlify

Before deploying, click **Add environment variables** (or go to **Site configuration** $\rightarrow$ **Environment variables**):

| Key | Value |
| :--- | :--- |
| `TURSO_DATABASE_URL` | `https://routine-tursosayshi.aws-ap-south-1.turso.io` |
| `TURSO_AUTH_TOKEN` | *Your Turso token from `.env`* |
| `GOOGLE_CLIENT_ID` | *Your Google OAuth Client ID (optional, or add later)* |
| `SESSION_SECRET` | `routineflow_secure_session_secret_2026` |

---

### Step 4: Click "Deploy site"

- Netlify will build the site and provide a free live URL (e.g. `https://routineflow-xyz.netlify.app`).
- It comes with free automatic HTTPS/SSL and instant updates whenever you push changes to GitHub!

---

## 🌐 Updating Google OAuth for your Live URL

When your Netlify site is live (e.g. `https://your-site.netlify.app`):
1. Open [Google Cloud Console](https://console.cloud.google.com/) $\rightarrow$ **APIs & Services** $\rightarrow$ **Credentials**.
2. Edit your **OAuth 2.0 Client ID**.
3. Under **Authorized JavaScript origins**, add your Netlify domain:
   - `https://your-site.netlify.app`
4. Under **Authorized redirect URIs**, add:
   - `https://your-site.netlify.app`
5. Save changes. Users can now sign in with their Google accounts directly from your live website!
