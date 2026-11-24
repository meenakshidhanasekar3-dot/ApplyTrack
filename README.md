# ApplyTrack – Job Application Tracker

**ApplyTrack** is a full-stack job application tracking web application built with **Python Flask**, **SQLite**, **HTML/CSS/Vanilla JavaScript**, and **Chart.js**. Designed with a clean SaaS-style interface, it helps job seekers organize applications, manage hiring stages on a Kanban board, prepare for upcoming interviews, analyze conversion metrics, and export records to CSV.

---

## Project Overview

Job searching quickly gets messy across spreadsheets, emails, and bookmarks. ApplyTrack centralizes the entire workflow in a lightweight local web app backed by SQLite:

- Track every application with salary, job type, location, posting link, follow-up dates, and notes.
- Visualize pipeline stages from **Applied** to **Offer** via an interactive Kanban board.
- Keep upcoming interviews highlighted so you never miss a round.
- Measure interview and offer conversion rates automatically with Chart.js analytics.
- Explore safely using opt-in, clearly-labelled `[DEMO]` sample data without mixing it with your personal entries.

---

## Features

- **Dashboard Overview**
  - KPI summary cards: **Total Applications**, **Interviews Scheduled**, **Offers Received**, and **Rejections**
  - Application Status Doughnut Chart (Chart.js)
  - Recent 5 Applications list
  - Upcoming Interviews & Follow-Ups feed with `Today` / `Interview` / `Follow-Up` badges
- **Application Management (Full CRUD)**
  - Add, edit, and delete applications via validated modals
  - Tracks: `company`, `job_role`, `location`, `job_type`, `salary`, `application_date`, `status`, `job_link`, `notes`, and `follow_up_date`
  - Client-side and server-side validation with inline field error messages
- **Interactive Kanban Board**
  - 5 stage columns: `Applied`, `Assessment`, `Interview`, `Offer`, `Rejected`
  - Drag-and-drop cards between columns or use the accessible quick-status dropdown on each card
- **Search & Filtering**
  - Instant debounced search by company name or job role
  - Filter by application status and job type (`Full-time`, `Part-time`, `Internship`, `Contract`, `Freelance`)
- **Interview Tracker**
  - Log interviews with date, time, company, optional linked application, and preparation notes
  - Automatically separates and highlights **Upcoming Interviews** (`Today`, `Tomorrow`, `In X days`) above completed ones
- **Analytics & Conversion Metrics**
  - Status Distribution Bar Chart and chronological Monthly Application Trend Line Chart
  - Calculates **Interview Conversion Rate**, **Offer Conversion Rate**, and **Interview-to-Offer Rate** with exact counts
- **CSV Export**
  - Download all applications or only currently filtered results as an RFC-compliant `.csv` file

---

## Technology Stack

- **Backend**: Python 3.11+, Flask 3.x
- **Database**: SQLite (`sqlite3` with parameterized queries and foreign key enforcement)
- **Frontend**: Semantic HTML5, responsive CSS3 (custom properties, Flexbox/Grid), Vanilla JavaScript (ES6+)
- **Charts**: Chart.js 4.x (loaded via jsDelivr CDN)
- **Testing**: `pytest`

---

## Screenshots

> Add your own screenshots after running the app locally and place them in a `docs/screenshots/` folder:

| Dashboard | Kanban Board |
| --- | --- |
| *Pipeline KPIs, status doughnut chart, and upcoming reminders* | *Drag-and-drop 5-stage application pipeline* |

| Interview Tracker | Analytics |
| --- | --- |
| *Highlighted upcoming rounds and prep notes* | *Status distribution, monthly trend, and conversion rates* |

---

## Installation Instructions

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd ApplyTrack
   ```

2. **Create and activate a virtual environment**

   On Windows (PowerShell):
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
   *(If your Python distribution creates `venv\bin\` instead of `venv\Scripts\`, activate with `.\venv\bin\Activate.ps1`.)*

   On macOS / Linux:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

---

## How to Run Locally

1. **Start the Flask server**
   ```bash
   python app.py
   ```
2. **Open ApplyTrack in your browser**
   ```text
   http://127.0.0.1:5000
   ```
   The SQLite database is automatically initialized at `instance/applytrack.db` on first startup.

3. **Optional environment variables**
   - `PORT` (default: `5000`)
   - `FLASK_DEBUG` (`1` to enable debug mode during development; default `0`)
   - `SECRET_KEY` (optional custom Flask secret key; a random per-process key is generated automatically if unset)
   - `APPLYTRACK_DB` (optional custom path to the SQLite database file)

4. **Run the automated test suite**
   ```bash
   pytest -v
   ```

---

## Project Folder Structure

```text
ApplyTrack/
├── app.py                    # Flask app factory, index route, health check & JSON error handlers
├── config.py                 # Environment-aware configuration (DB path, runtime secret key)
├── db.py                     # SQLite connection, schema initialization & opt-in demo data
├── validators.py             # Server-side input validation & sanitization
├── routes/
│   ├── __init__.py
│   ├── applications.py       # Applications CRUD, Dashboard, Analytics, CSV export & Demo APIs
│   └── interviews.py         # Interviews CRUD & upcoming/past enrichment API
├── static/
│   ├── css/
│   │   └── style.css         # Responsive SaaS theme (white/lavender, indigo/purple, navy text)
│   └── js/
│       ├── api.js            # Fetch wrapper for backend REST APIs
│       ├── components.js     # Reusable UI renderers (tables, cards, badges, empty states, toasts)
│       ├── charts.js         # Chart.js renderers for Dashboard & Analytics
│       └── app.js            # View switching, Kanban, search/filters & modal validation
├── templates/
│   └── index.html            # Main application shell & modals
├── tests/
│   └── test_app.py           # Automated pytest API & SQLite persistence test suite
├── requirements.txt          # Python dependencies
├── .gitignore                # Excludes venv, SQLite DB files, caches, and .env
└── README.md
```
