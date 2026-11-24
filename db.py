"""SQLite database connection, schema setup, and clearly-labelled demo data."""

import os
import sqlite3
from datetime import date, timedelta

from flask import current_app, g


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    job_role TEXT NOT NULL,
    location TEXT DEFAULT '',
    job_type TEXT NOT NULL DEFAULT 'Full-time',
    salary TEXT DEFAULT '',
    application_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Applied',
    job_link TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    follow_up_date TEXT DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER,
    company TEXT NOT NULL,
    interview_date TEXT NOT NULL,
    interview_time TEXT NOT NULL,
    notes TEXT DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_date ON applications(application_date);
CREATE INDEX IF NOT EXISTS idx_interviews_date ON interviews(interview_date);
"""


def get_connection(db_path: str) -> sqlite3.Connection:
    """Open a SQLite connection with Row factory and foreign key enforcement."""
    parent_dir = os.path.dirname(db_path)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_db() -> sqlite3.Connection:
    """Return the per-request SQLite connection stored on Flask's g object."""
    if "db" not in g:
        g.db = get_connection(current_app.config["DATABASE_PATH"])
    return g.db


def close_db(_error=None) -> None:
    """Close the per-request SQLite connection at teardown."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(db_path: str) -> None:
    """Initialize database tables and indexes if they do not exist."""
    conn = get_connection(db_path)
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def seed_demo_data(conn: sqlite3.Connection) -> dict:
    """Insert clearly-labelled demo applications and interviews if none exist."""
    existing = conn.execute(
        "SELECT COUNT(*) AS cnt FROM applications WHERE is_demo = 1"
    ).fetchone()["cnt"]
    if existing > 0:
        return {"loaded": False, "applications_added": 0, "interviews_added": 0}

    today = date.today()

    def day_offset(days: int) -> str:
        return (today + timedelta(days=days)).isoformat()

    demo_apps = [
        (
            "Stripe",
            "Frontend Engineer",
            "Remote (US)",
            "Full-time",
            "$135k - $155k",
            day_offset(-4),
            "Interview",
            "https://stripe.com/jobs",
            "[DEMO] Strong portfolio match; prepare UI state architecture examples.",
            day_offset(2),
            1,
        ),
        (
            "Linear",
            "Product Engineer",
            "San Francisco, CA",
            "Full-time",
            "$145k - $170k",
            day_offset(-10),
            "Assessment",
            "https://linear.app/careers",
            "[DEMO] Take-home keyboard navigation challenge due this week.",
            day_offset(3),
            1,
        ),
        (
            "Notion",
            "Full-Stack Developer",
            "New York, NY (Hybrid)",
            "Full-time",
            "$130k - $150k",
            day_offset(-22),
            "Offer",
            "https://notion.so/careers",
            "[DEMO] Verbal offer received! Reviewing equity and benefits package.",
            "",
            1,
        ),
        (
            "Vercel",
            "Developer Experience Engineer",
            "Remote",
            "Full-time",
            "$140k - $160k",
            day_offset(-15),
            "Applied",
            "https://vercel.com/careers",
            "[DEMO] Submitted via referral from Sarah.",
            day_offset(1),
            1,
        ),
        (
            "Figma",
            "Software Engineering Intern",
            "San Francisco, CA",
            "Internship",
            "$52 / hr",
            day_offset(-35),
            "Rejected",
            "https://figma.com/careers",
            "[DEMO] Completed first screen; role filled internally.",
            "",
            1,
        ),
        (
            "Shopify",
            "Backend Python Engineer",
            "Remote (Canada/US)",
            "Contract",
            "$85 / hr",
            day_offset(-42),
            "Interview",
            "https://shopify.com/careers",
            "[DEMO] Technical architecture round scheduled.",
            day_offset(4),
            1,
        ),
        (
            "Cloudflare",
            "Systems Support Engineer",
            "Austin, TX",
            "Full-time",
            "$110k - $125k",
            day_offset(-68),
            "Applied",
            "https://cloudflare.com/careers",
            "[DEMO] Applied through university alumni portal.",
            "",
            1,
        ),
    ]

    app_ids = []
    for row in demo_apps:
        cursor = conn.execute(
            """
            INSERT INTO applications (
                company, job_role, location, job_type, salary,
                application_date, status, job_link, notes, follow_up_date, is_demo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            row,
        )
        app_ids.append(cursor.lastrowid)

    demo_interviews = [
        (
            app_ids[0],
            "Stripe",
            day_offset(1),
            "10:30",
            "[DEMO] Live frontend pairing session with Hiring Manager.",
            1,
        ),
        (
            app_ids[5],
            "Shopify",
            day_offset(3),
            "14:00",
            "[DEMO] API design & SQLite/PostgreSQL scaling discussion.",
            1,
        ),
        (
            app_ids[2],
            "Notion",
            day_offset(-5),
            "11:00",
            "[DEMO] Final team culture & offer alignment call (completed).",
            1,
        ),
    ]

    for row in demo_interviews:
        conn.execute(
            """
            INSERT INTO interviews (
                application_id, company, interview_date, interview_time, notes, is_demo
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            row,
        )

    conn.commit()
    return {
        "loaded": True,
        "applications_added": len(demo_apps),
        "interviews_added": len(demo_interviews),
    }


def clear_demo_data(conn: sqlite3.Connection) -> dict:
    """Delete only clearly-labelled demo records while preserving user data."""
    int_cur = conn.execute("DELETE FROM interviews WHERE is_demo = 1")
    app_cur = conn.execute("DELETE FROM applications WHERE is_demo = 1")
    conn.commit()
    return {
        "applications_removed": app_cur.rowcount,
        "interviews_removed": int_cur.rowcount,
    }
