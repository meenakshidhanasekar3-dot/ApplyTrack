"""Configuration settings for ApplyTrack."""

import os
import secrets

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Application configuration loaded from environment with safe defaults."""

    # Never hardcode a fixed secret key; read from environment or generate per-process.
    SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
    DATABASE_PATH = os.environ.get(
        "APPLYTRACK_DB",
        os.path.join(BASE_DIR, "instance", "applytrack.db"),
    )
    JSON_SORT_KEYS = False
