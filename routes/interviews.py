"""API routes for tracking scheduled interviews."""

from datetime import date, datetime

from flask import Blueprint, jsonify, request

from db import get_db
from validators import validate_interview_payload

interviews_bp = Blueprint("interviews", __name__, url_prefix="/api/interviews")


def _enrich_interview(row) -> dict:
    item = dict(row)
    today = date.today()
    try:
        iv_date = datetime.strptime(item["interview_date"], "%Y-%m-%d").date()
        delta = (iv_date - today).days
        item["days_until"] = delta
        item["is_today"] = delta == 0
        item["is_upcoming"] = delta >= 0
    except ValueError:
        item["days_until"] = None
        item["is_today"] = False
        item["is_upcoming"] = False
    return item


@interviews_bp.route("", methods=["GET"])
def list_interviews():
    """List all interviews with upcoming entries sorted soonest first."""
    conn = get_db()
    today_str = date.today().isoformat()
    # Bucket upcoming (>= today) before past (< today), sorting upcoming ascending and past descending.
    rows = conn.execute(
        """
        SELECT i.id, i.application_id, i.company, i.interview_date, i.interview_time,
               i.notes, i.is_demo, i.created_at, a.job_role
        FROM interviews i
        LEFT JOIN applications a ON i.application_id = a.id
        ORDER BY
            CASE WHEN i.interview_date >= ? THEN 0 ELSE 1 END ASC,
            CASE WHEN i.interview_date >= ? THEN i.interview_date END ASC,
            CASE WHEN i.interview_date >= ? THEN i.interview_time END ASC,
            i.interview_date DESC,
            i.interview_time DESC
        """,
        (today_str, today_str, today_str),
    ).fetchall()
    return jsonify({"interviews": [_enrich_interview(r) for r in rows]})


@interviews_bp.route("", methods=["POST"])
def create_interview():
    """Create a new interview record."""
    payload = request.get_json(silent=True)
    cleaned, errors = validate_interview_payload(payload)
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    conn = get_db()
    app_id = cleaned["application_id"]
    if app_id is not None:
        exists = conn.execute(
            "SELECT id FROM applications WHERE id = ?", (app_id,)
        ).fetchone()
        if exists is None:
            return jsonify(
                {
                    "error": "Validation failed.",
                    "details": {"application_id": "Linked application does not exist."},
                }
            ), 400

    cursor = conn.execute(
        """
        INSERT INTO interviews (
            application_id, company, interview_date, interview_time, notes, is_demo
        ) VALUES (?, ?, ?, ?, ?, 0)
        """,
        (
            app_id,
            cleaned["company"],
            cleaned["interview_date"],
            cleaned["interview_time"],
            cleaned["notes"],
        ),
    )
    conn.commit()
    created = conn.execute(
        """
        SELECT i.*, a.job_role
        FROM interviews i
        LEFT JOIN applications a ON i.application_id = a.id
        WHERE i.id = ?
        """,
        (cursor.lastrowid,),
    ).fetchone()
    return jsonify({"interview": _enrich_interview(created)}), 201


@interviews_bp.route("/<int:interview_id>", methods=["PUT"])
def update_interview(interview_id: int):
    """Update an existing interview record."""
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM interviews WHERE id = ?", (interview_id,)
    ).fetchone()
    if existing is None:
        return jsonify({"error": "Interview not found."}), 404

    payload = request.get_json(silent=True)
    cleaned, errors = validate_interview_payload(payload)
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    app_id = cleaned["application_id"]
    if app_id is not None:
        exists = conn.execute(
            "SELECT id FROM applications WHERE id = ?", (app_id,)
        ).fetchone()
        if exists is None:
            return jsonify(
                {
                    "error": "Validation failed.",
                    "details": {"application_id": "Linked application does not exist."},
                }
            ), 400

    conn.execute(
        """
        UPDATE interviews
        SET application_id = ?, company = ?, interview_date = ?, interview_time = ?, notes = ?
        WHERE id = ?
        """,
        (
            app_id,
            cleaned["company"],
            cleaned["interview_date"],
            cleaned["interview_time"],
            cleaned["notes"],
            interview_id,
        ),
    )
    conn.commit()
    updated = conn.execute(
        """
        SELECT i.*, a.job_role
        FROM interviews i
        LEFT JOIN applications a ON i.application_id = a.id
        WHERE i.id = ?
        """,
        (interview_id,),
    ).fetchone()
    return jsonify({"interview": _enrich_interview(updated)})


@interviews_bp.route("/<int:interview_id>", methods=["DELETE"])
def delete_interview(interview_id: int):
    """Delete an interview record."""
    conn = get_db()
    cursor = conn.execute("DELETE FROM interviews WHERE id = ?", (interview_id,))
    conn.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Interview not found."}), 404
    return jsonify({"deleted": True, "id": interview_id})
