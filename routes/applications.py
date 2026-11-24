"""API routes for job applications, dashboard metrics, analytics, CSV export, and demo data."""

import csv
import io
from datetime import date, datetime

from flask import Blueprint, Response, jsonify, request

from db import clear_demo_data, get_db, seed_demo_data
from validators import VALID_STATUSES, validate_application_payload

applications_bp = Blueprint("applications", __name__, url_prefix="/api")


def _row_to_dict(row) -> dict:
    return dict(row)


def _build_filter_query(search: str, status: str, job_type: str) -> tuple[str, list]:
    """Build a parameterized SQL WHERE clause for application search and filters."""
    clauses = []
    params: list = []

    if search:
        pattern = f"%{search}%"
        clauses.append("(company LIKE ? OR job_role LIKE ?)")
        params.extend([pattern, pattern])

    if status and status != "All":
        clauses.append("status = ?")
        params.append(status)

    if job_type and job_type != "All":
        clauses.append("job_type = ?")
        params.append(job_type)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where_sql, params


@applications_bp.route("/applications", methods=["GET"])
def list_applications():
    """Return filtered job applications ordered by newest application date first."""
    search = (request.args.get("search") or "").strip()
    status = (request.args.get("status") or "").strip()
    job_type = (request.args.get("job_type") or "").strip()

    where_sql, params = _build_filter_query(search, status, job_type)
    sql = f"""
        SELECT id, company, job_role, location, job_type, salary,
               application_date, status, job_link, notes, follow_up_date,
               is_demo, created_at, updated_at
        FROM applications
        {where_sql}
        ORDER BY application_date DESC, id DESC
    """
    conn = get_db()
    rows = conn.execute(sql, params).fetchall()
    return jsonify({"applications": [_row_to_dict(r) for r in rows]})


@applications_bp.route("/applications", methods=["POST"])
def create_application():
    """Create a new job application after validation."""
    payload = request.get_json(silent=True)
    cleaned, errors = validate_application_payload(payload, partial=False)
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    conn = get_db()
    cursor = conn.execute(
        """
        INSERT INTO applications (
            company, job_role, location, job_type, salary,
            application_date, status, job_link, notes, follow_up_date, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """,
        (
            cleaned["company"],
            cleaned["job_role"],
            cleaned.get("location", ""),
            cleaned["job_type"],
            cleaned.get("salary", ""),
            cleaned["application_date"],
            cleaned["status"],
            cleaned.get("job_link", ""),
            cleaned.get("notes", ""),
            cleaned.get("follow_up_date", ""),
        ),
    )
    conn.commit()
    created = conn.execute(
        "SELECT * FROM applications WHERE id = ?", (cursor.lastrowid,)
    ).fetchone()
    return jsonify({"application": _row_to_dict(created)}), 201


@applications_bp.route("/applications/<int:app_id>", methods=["GET"])
def get_application(app_id: int):
    """Fetch a single job application by ID."""
    conn = get_db()
    row = conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Application not found."}), 404
    return jsonify({"application": _row_to_dict(row)})


@applications_bp.route("/applications/<int:app_id>", methods=["PUT", "PATCH"])
def update_application(app_id: int):
    """Update an application (full update via PUT or partial update via PATCH)."""
    conn = get_db()
    existing = conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
    if existing is None:
        return jsonify({"error": "Application not found."}), 404

    payload = request.get_json(silent=True)
    is_partial = request.method == "PATCH"
    cleaned, errors = validate_application_payload(payload, partial=is_partial)
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400
    if not cleaned:
        return jsonify({"error": "No fields provided to update."}), 400

    # Only validated column names from `cleaned` are interpolated; all values use `?` placeholders.
    set_clauses = [f"{col} = ?" for col in cleaned]
    set_clauses.append("updated_at = datetime('now')")
    params = list(cleaned.values()) + [app_id]

    conn.execute(
        f"UPDATE applications SET {', '.join(set_clauses)} WHERE id = ?",
        params,
    )
    conn.commit()

    updated = conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
    return jsonify({"application": _row_to_dict(updated)})


@applications_bp.route("/applications/<int:app_id>", methods=["DELETE"])
def delete_application(app_id: int):
    """Delete a job application by ID."""
    conn = get_db()
    cursor = conn.execute("DELETE FROM applications WHERE id = ?", (app_id,))
    conn.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Application not found."}), 404
    return jsonify({"deleted": True, "id": app_id})


@applications_bp.route("/dashboard", methods=["GET"])
def get_dashboard():
    """Return summary metrics, recent applications, upcoming interviews, and follow-ups."""
    conn = get_db()
    today_str = date.today().isoformat()

    status_counts = {status: 0 for status in VALID_STATUSES}
    for row in conn.execute(
        "SELECT status, COUNT(*) AS cnt FROM applications GROUP BY status"
    ).fetchall():
        if row["status"] in status_counts:
            status_counts[row["status"]] = row["cnt"]

    total_applications = sum(status_counts.values())

    upcoming_interview_count = conn.execute(
        "SELECT COUNT(*) AS cnt FROM interviews WHERE interview_date >= ?",
        (today_str,),
    ).fetchone()["cnt"]

    # Combine scheduled upcoming interviews with applications currently in Interview stage
    # while also exposing both numbers transparently.
    interviews_scheduled = upcoming_interview_count

    demo_count = conn.execute(
        "SELECT COUNT(*) AS cnt FROM applications WHERE is_demo = 1"
    ).fetchone()["cnt"]

    recent_rows = conn.execute(
        """
        SELECT id, company, job_role, location, job_type, salary,
               application_date, status, follow_up_date, is_demo
        FROM applications
        ORDER BY application_date DESC, id DESC
        LIMIT 5
        """
    ).fetchall()

    upcoming_interviews = conn.execute(
        """
        SELECT i.id, i.application_id, i.company, i.interview_date, i.interview_time,
               i.notes, i.is_demo, a.job_role
        FROM interviews i
        LEFT JOIN applications a ON i.application_id = a.id
        WHERE i.interview_date >= ?
        ORDER BY i.interview_date ASC, i.interview_time ASC
        LIMIT 5
        """,
        (today_str,),
    ).fetchall()

    upcoming_follow_ups = conn.execute(
        """
        SELECT id, company, job_role, status, follow_up_date, is_demo
        FROM applications
        WHERE follow_up_date IS NOT NULL
          AND follow_up_date != ''
          AND follow_up_date >= ?
          AND status NOT IN ('Offer', 'Rejected')
        ORDER BY follow_up_date ASC, id ASC
        LIMIT 5
        """,
        (today_str,),
    ).fetchall()

    return jsonify(
        {
            "summary": {
                "total_applications": total_applications,
                "interviews_scheduled": interviews_scheduled,
                "applications_in_interview": status_counts["Interview"],
                "offers_received": status_counts["Offer"],
                "rejections": status_counts["Rejected"],
                "demo_count": demo_count,
            },
            "status_counts": status_counts,
            "recent_applications": [_row_to_dict(r) for r in recent_rows],
            "upcoming_interviews": [_row_to_dict(r) for r in upcoming_interviews],
            "upcoming_follow_ups": [_row_to_dict(r) for r in upcoming_follow_ups],
        }
    )


@applications_bp.route("/analytics", methods=["GET"])
def get_analytics():
    """Return status distribution, monthly application trend, and conversion rates."""
    conn = get_db()

    status_counts = {status: 0 for status in VALID_STATUSES}
    for row in conn.execute(
        "SELECT status, COUNT(*) AS cnt FROM applications GROUP BY status"
    ).fetchall():
        if row["status"] in status_counts:
            status_counts[row["status"]] = row["cnt"]

    total = sum(status_counts.values())

    # Applications that reached at least the interview stage (either by current status
    # in Interview/Offer or by having a logged interview linked to them).
    interview_reached = conn.execute(
        """
        SELECT COUNT(DISTINCT a.id) AS cnt
        FROM applications a
        LEFT JOIN interviews i ON i.application_id = a.id
        WHERE a.status IN ('Interview', 'Offer') OR i.id IS NOT NULL
        """
    ).fetchone()["cnt"]

    offer_count = status_counts["Offer"]

    interview_rate = round((interview_reached / total) * 100, 1) if total > 0 else 0.0
    offer_rate = round((offer_count / total) * 100, 1) if total > 0 else 0.0
    interview_to_offer_rate = (
        round((offer_count / interview_reached) * 100, 1)
        if interview_reached > 0
        else 0.0
    )

    monthly_rows = conn.execute(
        """
        SELECT substr(application_date, 1, 7) AS month, COUNT(*) AS cnt
        FROM applications
        WHERE length(application_date) >= 7
        GROUP BY substr(application_date, 1, 7)
        ORDER BY month ASC
        """
    ).fetchall()

    monthly_trend = []
    for row in monthly_rows:
        month_str = row["month"]
        try:
            label = datetime.strptime(month_str, "%Y-%m").strftime("%b %Y")
        except ValueError:
            label = month_str
        monthly_trend.append(
            {"month": month_str, "label": label, "count": row["cnt"]}
        )

    return jsonify(
        {
            "total_applications": total,
            "status_distribution": status_counts,
            "monthly_trend": monthly_trend,
            "conversion": {
                "interview_reached_count": interview_reached,
                "interview_rate": interview_rate,
                "offer_count": offer_count,
                "offer_rate": offer_rate,
                "interview_to_offer_rate": interview_to_offer_rate,
            },
        }
    )


@applications_bp.route("/export/csv", methods=["GET"])
def export_csv():
    """Download filtered or all job applications as a CSV file."""
    search = (request.args.get("search") or "").strip()
    status = (request.args.get("status") or "").strip()
    job_type = (request.args.get("job_type") or "").strip()

    where_sql, params = _build_filter_query(search, status, job_type)
    conn = get_db()
    rows = conn.execute(
        f"""
        SELECT id, company, job_role, location, job_type, salary,
               application_date, status, job_link, follow_up_date, notes, is_demo
        FROM applications
        {where_sql}
        ORDER BY application_date DESC, id DESC
        """,
        params,
    ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Company",
            "Job Role",
            "Location",
            "Job Type",
            "Salary",
            "Application Date",
            "Status",
            "Job Link",
            "Follow-Up Date",
            "Notes",
            "Demo Record",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["company"],
                row["job_role"],
                row["location"],
                row["job_type"],
                row["salary"],
                row["application_date"],
                row["status"],
                row["job_link"],
                row["follow_up_date"],
                row["notes"],
                "Yes" if row["is_demo"] else "No",
            ]
        )

    csv_content = output.getvalue()
    output.close()

    return Response(
        csv_content,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="applytrack_applications.csv"'
        },
    )


@applications_bp.route("/demo/load", methods=["POST"])
def load_demo():
    """Load clearly-labelled sample demo records into SQLite."""
    conn = get_db()
    result = seed_demo_data(conn)
    return jsonify(result), 201 if result["loaded"] else 200


@applications_bp.route("/demo/clear", methods=["DELETE"])
def clear_demo():
    """Remove only clearly-labelled demo records from SQLite."""
    conn = get_db()
    result = clear_demo_data(conn)
    return jsonify(result), 200
