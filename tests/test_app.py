"""Automated API and persistence tests for ApplyTrack."""

import csv
import io
from datetime import date, timedelta

import pytest

from app import create_app


@pytest.fixture()
def client(tmp_path):
    """Create a test client backed by a fresh temporary SQLite database."""
    db_file = tmp_path / "test_applytrack.db"
    test_app = create_app(
        {
            "TESTING": True,
            "DATABASE_PATH": str(db_file),
        }
    )
    with test_app.test_client() as test_client:
        yield test_client


def test_health_and_homepage(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"

    home = client.get("/")
    assert home.status_code == 200
    assert b"ApplyTrack" in home.data

    # Verify JSON error handlers for 404 and 405
    not_found = client.get("/api/applications/999999")
    assert not_found.status_code == 404
    assert "error" in not_found.get_json()

    wrong_method = client.delete("/api/health")
    assert wrong_method.status_code == 405
    assert "error" in wrong_method.get_json()


def test_empty_dashboard_and_analytics(client):
    dash = client.get("/api/dashboard").get_json()
    assert dash["summary"]["total_applications"] == 0
    assert dash["summary"]["interviews_scheduled"] == 0
    assert dash["summary"]["offers_received"] == 0
    assert dash["summary"]["rejections"] == 0

    analytics = client.get("/api/analytics").get_json()
    assert analytics["total_applications"] == 0
    assert analytics["conversion"]["interview_rate"] == 0.0
    assert analytics["conversion"]["offer_rate"] == 0.0


def test_application_validation_errors(client):
    res = client.post("/api/applications", json={"company": "", "job_role": ""})
    assert res.status_code == 400
    details = res.get_json()["details"]
    assert "company" in details
    assert "job_role" in details
    assert "application_date" in details
    assert "status" in details

    bad_url = client.post(
        "/api/applications",
        json={
            "company": "Acme",
            "job_role": "Engineer",
            "job_type": "Full-time",
            "application_date": "2026-11-20",
            "status": "Applied",
            "job_link": "ftp://invalid.example.com",
        },
    )
    assert bad_url.status_code == 400
    assert "job_link" in bad_url.get_json()["details"]


def test_application_crud_search_filter_and_kanban_patch(client):
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    # Create two applications
    r1 = client.post(
        "/api/applications",
        json={
            "company": "Stripe",
            "job_role": "Backend Engineer",
            "location": "Remote",
            "job_type": "Full-time",
            "salary": "$150k",
            "application_date": today,
            "status": "Applied",
            "job_link": "https://stripe.com/jobs",
            "notes": "Applied directly",
            "follow_up_date": tomorrow,
        },
    )
    assert r1.status_code == 201
    app1_id = r1.get_json()["application"]["id"]

    r2 = client.post(
        "/api/applications",
        json={
            "company": "Figma",
            "job_role": "Design Intern",
            "location": "San Francisco",
            "job_type": "Internship",
            "salary": "$50/hr",
            "application_date": today,
            "status": "Assessment",
        },
    )
    assert r2.status_code == 201

    # Search by role
    search_res = client.get("/api/applications?search=Backend").get_json()
    assert len(search_res["applications"]) == 1
    assert search_res["applications"][0]["company"] == "Stripe"

    # Filter by job_type
    intern_res = client.get("/api/applications?job_type=Internship").get_json()
    assert len(intern_res["applications"]) == 1
    assert intern_res["applications"][0]["company"] == "Figma"

    # Kanban status PATCH
    patch_res = client.patch(
        f"/api/applications/{app1_id}", json={"status": "Interview"}
    )
    assert patch_res.status_code == 200
    assert patch_res.get_json()["application"]["status"] == "Interview"

    # Full PUT edit
    put_res = client.put(
        f"/api/applications/{app1_id}",
        json={
            "company": "Stripe",
            "job_role": "Senior Backend Engineer",
            "location": "Remote",
            "job_type": "Full-time",
            "salary": "$165k",
            "application_date": today,
            "status": "Offer",
            "job_link": "https://stripe.com/jobs",
            "notes": "Received offer",
            "follow_up_date": "",
        },
    )
    assert put_res.status_code == 200
    assert put_res.get_json()["application"]["job_role"] == "Senior Backend Engineer"

    # Delete
    del_res = client.delete(f"/api/applications/{app1_id}")
    assert del_res.status_code == 200
    assert client.get(f"/api/applications/{app1_id}").status_code == 404


def test_interviews_and_upcoming_sorting(client):
    today = date.today()
    past_day = (today - timedelta(days=3)).isoformat()
    next_day = (today + timedelta(days=2)).isoformat()

    r_past = client.post(
        "/api/interviews",
        json={
            "company": "OldCorp",
            "interview_date": past_day,
            "interview_time": "09:00",
            "notes": "Past screening",
        },
    )
    assert r_past.status_code == 201

    r_upcoming = client.post(
        "/api/interviews",
        json={
            "company": "FutureTech",
            "interview_date": next_day,
            "interview_time": "14:30",
            "notes": "Technical round",
        },
    )
    assert r_upcoming.status_code == 201
    upcoming_id = r_upcoming.get_json()["interview"]["id"]

    list_res = client.get("/api/interviews").get_json()["interviews"]
    assert len(list_res) == 2
    assert list_res[0]["company"] == "FutureTech"
    assert list_res[0]["is_upcoming"] is True
    assert list_res[1]["company"] == "OldCorp"
    assert list_res[1]["is_upcoming"] is False

    # Update & delete
    upd = client.put(
        f"/api/interviews/{upcoming_id}",
        json={
            "company": "FutureTech",
            "interview_date": next_day,
            "interview_time": "15:00",
            "notes": "Rescheduled",
        },
    )
    assert upd.status_code == 200
    assert upd.get_json()["interview"]["interview_time"] == "15:00"

    assert client.delete(f"/api/interviews/{upcoming_id}").status_code == 200


def test_analytics_conversion_rates_and_csv_export(client):
    # Create 4 applications: 1 Applied, 1 Rejected, 1 Interview, 1 Offer
    entries = [
        ("Alpha", "SWE", "2026-09-10", "Applied"),
        ("Beta", "SWE", "2026-09-15", "Rejected"),
        ("Gamma", "SWE", "2026-10-05", "Interview"),
        ("Delta", "SWE", "2026-10-20", "Offer"),
    ]
    for company, role, dt, status in entries:
        res = client.post(
            "/api/applications",
            json={
                "company": company,
                "job_role": role,
                "job_type": "Full-time",
                "application_date": dt,
                "status": status,
            },
        )
        assert res.status_code == 201

    analytics = client.get("/api/analytics").get_json()
    assert analytics["total_applications"] == 4
    # Gamma (Interview) + Delta (Offer) = 2 / 4 = 50.0%
    assert analytics["conversion"]["interview_reached_count"] == 2
    assert analytics["conversion"]["interview_rate"] == 50.0
    # Delta (Offer) = 1 / 4 = 25.0%
    assert analytics["conversion"]["offer_count"] == 1
    assert analytics["conversion"]["offer_rate"] == 25.0
    # 1 offer / 2 interviewed = 50.0%
    assert analytics["conversion"]["interview_to_offer_rate"] == 50.0
    assert [m["month"] for m in analytics["monthly_trend"]] == ["2026-09", "2026-10"]

    # CSV Export
    csv_res = client.get("/api/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.content_type
    reader = list(csv.reader(io.StringIO(csv_res.data.decode("utf-8"))))
    assert len(reader) == 5  # header + 4 rows
    assert reader[0][1] == "Company"


def test_demo_data_load_and_clear_preserves_real_data(client):
    # Add 1 real user application
    client.post(
        "/api/applications",
        json={
            "company": "RealUserCo",
            "job_role": "Developer",
            "job_type": "Full-time",
            "application_date": date.today().isoformat(),
            "status": "Applied",
        },
    )

    load_res = client.post("/api/demo/load")
    assert load_res.status_code == 201
    assert load_res.get_json()["loaded"] is True

    apps_with_demo = client.get("/api/applications").get_json()["applications"]
    assert len(apps_with_demo) > 1

    clear_res = client.delete("/api/demo/clear")
    assert clear_res.status_code == 200

    remaining = client.get("/api/applications").get_json()["applications"]
    assert len(remaining) == 1
    assert remaining[0]["company"] == "RealUserCo"
