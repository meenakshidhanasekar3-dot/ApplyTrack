"""Validation helpers for application and interview payloads."""

from datetime import datetime
from urllib.parse import urlparse

VALID_STATUSES = ("Applied", "Assessment", "Interview", "Offer", "Rejected")
VALID_JOB_TYPES = ("Full-time", "Part-time", "Internship", "Contract", "Freelance")


def _clean_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def is_valid_date(value: str) -> bool:
    """Return True if value matches YYYY-MM-DD."""
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def is_valid_time(value: str) -> bool:
    """Return True if value matches 24-hour HH:MM."""
    try:
        datetime.strptime(value, "%H:%M")
        return True
    except ValueError:
        return False


def is_valid_url(value: str) -> bool:
    """Return True if value is a valid http or https URL."""
    parsed = urlparse(value)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def validate_application_payload(data: dict, partial: bool = False) -> tuple[dict, dict]:
    """Validate and sanitize an application create/update payload.

    Returns (cleaned_fields, field_errors).
    """
    if not isinstance(data, dict):
        return {}, {"_error": "Request body must be a JSON object."}

    errors: dict[str, str] = {}
    cleaned: dict[str, object] = {}

    # Required text fields
    if not partial or "company" in data:
        company = _clean_str(data.get("company"))
        if not company:
            errors["company"] = "Company name is required."
        elif len(company) > 120:
            errors["company"] = "Company name must be 120 characters or fewer."
        else:
            cleaned["company"] = company

    if not partial or "job_role" in data:
        job_role = _clean_str(data.get("job_role"))
        if not job_role:
            errors["job_role"] = "Job role is required."
        elif len(job_role) > 120:
            errors["job_role"] = "Job role must be 120 characters or fewer."
        else:
            cleaned["job_role"] = job_role

    if not partial or "job_type" in data:
        job_type = _clean_str(data.get("job_type"))
        if not job_type:
            errors["job_type"] = "Job type is required."
        elif job_type not in VALID_JOB_TYPES:
            errors["job_type"] = f"Job type must be one of: {', '.join(VALID_JOB_TYPES)}."
        else:
            cleaned["job_type"] = job_type

    if not partial or "application_date" in data:
        app_date = _clean_str(data.get("application_date"))
        if not app_date:
            errors["application_date"] = "Application date is required."
        elif not is_valid_date(app_date):
            errors["application_date"] = "Application date must be in YYYY-MM-DD format."
        else:
            cleaned["application_date"] = app_date

    if not partial or "status" in data:
        status = _clean_str(data.get("status"))
        if not status:
            errors["status"] = "Status is required."
        elif status not in VALID_STATUSES:
            errors["status"] = f"Status must be one of: {', '.join(VALID_STATUSES)}."
        else:
            cleaned["status"] = status

    # Optional fields
    if not partial or "location" in data:
        location = _clean_str(data.get("location"))
        if len(location) > 120:
            errors["location"] = "Location must be 120 characters or fewer."
        else:
            cleaned["location"] = location

    if not partial or "salary" in data:
        salary = _clean_str(data.get("salary"))
        if len(salary) > 80:
            errors["salary"] = "Salary must be 80 characters or fewer."
        else:
            cleaned["salary"] = salary

    if not partial or "job_link" in data:
        job_link = _clean_str(data.get("job_link"))
        if job_link and not is_valid_url(job_link):
            errors["job_link"] = "Job link must start with http:// or https://."
        elif len(job_link) > 500:
            errors["job_link"] = "Job link must be 500 characters or fewer."
        else:
            cleaned["job_link"] = job_link

    if not partial or "notes" in data:
        notes = _clean_str(data.get("notes"))
        if len(notes) > 2000:
            errors["notes"] = "Notes must be 2000 characters or fewer."
        else:
            cleaned["notes"] = notes

    if not partial or "follow_up_date" in data:
        follow_up_date = _clean_str(data.get("follow_up_date"))
        if follow_up_date and not is_valid_date(follow_up_date):
            errors["follow_up_date"] = "Follow-up date must be in YYYY-MM-DD format."
        else:
            cleaned["follow_up_date"] = follow_up_date

    return cleaned, errors


def validate_interview_payload(data: dict) -> tuple[dict, dict]:
    """Validate and sanitize an interview create/update payload."""
    if not isinstance(data, dict):
        return {}, {"_error": "Request body must be a JSON object."}

    errors: dict[str, str] = {}
    cleaned: dict[str, object] = {}

    company = _clean_str(data.get("company"))
    if not company:
        errors["company"] = "Company name is required."
    elif len(company) > 120:
        errors["company"] = "Company name must be 120 characters or fewer."
    else:
        cleaned["company"] = company

    interview_date = _clean_str(data.get("interview_date"))
    if not interview_date:
        errors["interview_date"] = "Interview date is required."
    elif not is_valid_date(interview_date):
        errors["interview_date"] = "Interview date must be in YYYY-MM-DD format."
    else:
        cleaned["interview_date"] = interview_date

    interview_time = _clean_str(data.get("interview_time"))
    if not interview_time:
        errors["interview_time"] = "Interview time is required."
    elif not is_valid_time(interview_time):
        errors["interview_time"] = "Interview time must be in HH:MM (24-hour) format."
    else:
        cleaned["interview_time"] = interview_time

    raw_app_id = data.get("application_id")
    if raw_app_id in (None, "", "null"):
        cleaned["application_id"] = None
    else:
        try:
            app_id = int(raw_app_id)
            if app_id <= 0:
                raise ValueError
            cleaned["application_id"] = app_id
        except (TypeError, ValueError):
            errors["application_id"] = "Invalid linked application ID."

    notes = _clean_str(data.get("notes"))
    if len(notes) > 2000:
        errors["notes"] = "Notes must be 2000 characters or fewer."
    else:
        cleaned["notes"] = notes

    return cleaned, errors
