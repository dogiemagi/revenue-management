# Deploying RevTrack to Render Free Tier (Zero Local Server Needed)

This guide walks you through deploying **RevTrack (Revenue Management)** to **Render's Free Tier** so that it runs 100% in the cloud, accessible from anywhere on the web, without running any local server on your computer.

---

## Architecture Overview
- **Hosting**: Render Free Web Service (512 MB RAM, runs `gunicorn app:app`)
- **Database**: Free permanent Cloud PostgreSQL via **Neon.tech** (or Supabase)
- **Frontend**: Interactive Glassmorphic UI with Chart.js visualizations & FontAwesome 6 icons

---

## Step 1: Get Your Free Permanent PostgreSQL Database (1 Minute)

Render's free tier instances have an ephemeral file system (local SQLite databases reset when the server goes to sleep). To keep your personal & family salary records permanent for free:

1. Visit **[https://neon.tech](https://neon.tech)** and sign up for free (No credit card required).
2. Click **New Project** and name it `revenue-management`.
3. In your Neon dashboard under **Connection Details**:
   - Ensure **Connection String** is selected.
   - Click **Copy** to copy the URL. It looks like:
     ```
     postgresql://username:password@ep-xyz-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
4. Keep this URL handy for Step 3.

---

## Step 2: Push `D:\revenue_management` to GitHub

1. Open your terminal or Git Bash inside `D:\revenue_management`:
   ```bash
   cd D:\revenue_management
   git init
   git add .
   git commit -m "Initial commit of RevTrack Revenue Management System"
   ```
2. Create a new repository on your GitHub account (named `revenue-management`).
3. Link and push your repository:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/revenue-management.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 3: Deploy to Render Free Tier (2 Minutes)

1. Sign in to your Render account at **[https://render.com](https://render.com)**.
2. Click the **New +** button in the top navigation and select **Web Service**.
3. Choose **Build and deploy from a Git repository** and connect your `revenue-management` repository.
4. Render will detect the configuration automatically. Verify these settings:
   - **Name**: `revtrack-revenue-management` (or your preferred name)
   - **Region**: Choose the closest region (e.g., Oregon or Frankfurt)
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: **Free** ($0 / month)
5. Scroll down to **Environment Variables** and add:
   - **Key**: `DATABASE_URL`
   - **Value**: *(Paste the PostgreSQL connection string you copied from Neon in Step 1)*
   - **Key**: `SECRET_KEY`
   - **Value**: *(Any random string or click Generate)*
6. Click **Create Web Service**.

---

## Step 4: Access Your Live Application!

- Render will build the Python environment, install dependencies, and launch Gunicorn.
- Within 90 seconds, your site will be live at:
  ```
  https://revtrack-revenue-management.onrender.com
  ```
- You can now open this URL from your phone, laptop, or share it with family members!

---

## Key Features Ready in Your Deployed App:
- **Weekly, Bi-weekly, Monthly, and Annual Calculations**: Automatic conversions and breakdowns.
- **Itemized Deductions**: Taxes, 401(k)/PF retirement, insurance, and custom deductions.
- **Visual Analytics**: Interactive Chart.js donuts, multi-horizon bars, and historical spline trends.
- **Personal & Family Workspaces**: Switch between individual pay stubs and combined household cash flow.
- **Shareable Invite Codes**: Family heads can invite members via unique 8-character codes.
- **1-Click Pre-loaded Demo**: Instantly test the Morgan Household demo account with 6 months of pay slips.
- **Pay Slip Generation**: Official print receipts with `@media print` styles and CSV export.
