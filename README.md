# RevTrack — Executive Revenue & Salary Management System

A full-stack, cloud-ready financial web platform engineered for personal and family compensation tracking, multi-frequency salary projections (Weekly, Bi-Weekly, Monthly, and Yearly), itemized deduction auditing, and household cash flow analytics.

Designed for seamless deployment to **Render's Free Tier** paired with serverless **Cloud PostgreSQL** (via Neon or Supabase) with zero local server requirements.

---

## Key Features

### 1. Multi-Cadence Salary Engine
- **Cross-Horizon Projections**: Calculates and converts compensation across **Weekly**, **Bi-Weekly**, **Monthly**, **Yearly**, **Daily**, and **Hourly** cadences.
- **Itemized Deductions**: Detailed breakdowns for Income Tax withholding, Retirement / 401(k) / Provident Fund (PF), Health Insurance, and custom deductions.
- **Overtime & Bonus Modeling**: Built-in overtime hours calculation with standard 1.5x / 2.0x multipliers.
- **Retention & Efficiency Metrics**: Real-time display of take-home efficiency (% of gross retained).

### 2. Personal & Family Workspaces
- **Individual Mode**: Manage your primary job salary, side hustles, freelance gigs, and bonuses.
- **Household / Family Mode**: 
  - Create a Family Workspace with a unique 8-character invite code (e.g., `MORG-2026`).
  - Invite partner or household members.
  - Aggregated household monthly & annual gross and net revenue.
  - Visual member contribution share (% distribution across earners).
  - Head of Family administrative management.

### 3. Financial Visualizations (Powered by Chart.js 4.4)
- **Income Distribution Donut**: Visual slice of Net Take-Home vs. Taxes vs. Retirement vs. Benefits.
- **Multi-Period Bar Chart**: Side-by-side comparison of Gross, Deductions, and Net across Weekly, Monthly, and Annual horizons.
- **Historical Net Trend**: Interactive area spline tracking actual pay slip earnings over time.
- **Family Contribution Share**: Circular distribution of household revenue per family member.
- **Live Interactive Simulator**: Real-time slider and inputs for dynamic salary scenario testing without page reloads.

### 4. Compensation Auditing & Records
- **Pay Slips Management**: Log, view, edit, and categorize pay stubs (Primary Job, Freelance, Side Hustle, Bonus).
- **Printable Pay Slip**: Official pay stub layout formatted for print and PDF generation (`@media print`).
- **CSV Data Export**: 1-click export of historical salary records for Excel / tax accounting.
- **Multi-Currency Support**: Switch between USD ($), INR (₹), EUR (€), GBP (£), CAD (C$), and AUD (A$).
- **1-Click Demo Account**: Pre-seeded with the Morgan Household (3 family earners, 6 months of historical slips).

---

## Technology Stack

| Layer | Component | Notes |
| :--- | :--- | :--- |
| **Language** | Python 3.10+ | Clean, modular, type-safe architecture |
| **Backend** | Flask 3.1 | Ultra-low memory footprint (~40 MB RAM), ideal for Render free tier |
| **WSGI Server** | Gunicorn | Production-grade HTTP server |
| **Database** | PostgreSQL / SQLite | Seamlessly switches between Cloud Postgres (via `DATABASE_URL`) and SQLite |
| **ORM** | SQLAlchemy 2.0 | Declarative models and transactional integrity |
| **Frontend** | HTML5 + Modern CSS | Executive Fintech Dark/Light mode theme with glassmorphic cards |
| **Icons** | FontAwesome 6 | Professional vector iconography |
| **Charts** | Chart.js 4.4 | Hardware-accelerated client-side canvas visualizations |

---

## Directory Structure
```
D:\revenue_management\
├── app.py                     # Main application & route handlers
├── config.py                  # Database and environment configurations
├── models.py                  # SQLAlchemy models (User, Family, SalaryProfile, SalaryRecord)
├── calculator.py              # Precision multi-frequency compensation engine
├── demo_data.py               # Pre-populated realistic demo data seeder
├── DEPLOYMENT.md              # Complete Render free tier deployment guide
├── Procfile                   # Process file for Render execution (web: gunicorn app:app)
├── render.yaml                # Render Blueprint infrastructure-as-code specification
├── requirements.txt           # Production Python dependencies
├── runtime.txt                # Python runtime specification (3.10.12)
├── .env.example               # Template for environment variables
├── .gitignore                 # Standard Python gitignore
├── static/
│   ├── css/
│   │   └── style.css          # Fintech design system with dark/light themes
│   └── js/
│       ├── main.js            # Modals, theme switcher, and navigation
│       ├── charts.js          # Personal dashboard visualizations
│       ├── family_charts.js   # Household multi-earner visualizations
│       └── calculator.js      # Live real-time salary simulator
└── templates/
    ├── base.html              # Base layout with responsive sidebar and navigation
    ├── index.html             # Landing showcase page
    ├── login.html             # Authentication login page with 1-click demo
    ├── register.html          # Registration with personal & family options
    ├── dashboard.html         # Personal dashboard with KPI cards & charts
    ├── family.html            # Family dashboard with aggregated household revenue
    ├── family_empty.html      # Create or join family workspace state
    ├── calculator.html        # Interactive salary calculator tool
    ├── records.html           # Historical salary records & filter table
    └── print_slip.html        # Official printable pay stub receipt
```

---

## Free Cloud Deployment to Render (No Local Server Needed)

See [DEPLOYMENT.md](DEPLOYMENT.md) for full screenshots and detailed instructions.

### Summary:
1. Create a free permanent PostgreSQL database on **[Neon.tech](https://neon.tech)** and copy your `DATABASE_URL`.
2. Push `D:\revenue_management` to your **GitHub** account.
3. On **[Render.com](https://render.com)**, create a new **Web Service** from your GitHub repo.
4. Set the environment variable:
   - `DATABASE_URL`: *(Your Neon PostgreSQL connection string)*
5. Click **Deploy**. Your app is live globally on Render’s free tier!
