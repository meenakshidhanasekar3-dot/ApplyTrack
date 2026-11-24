"""ApplyTrack - Job Application Tracker Flask entry point."""

import os
from flask import Flask, jsonify, render_template

from config import Config
from db import close_db, init_db
from routes.applications import applications_bp
from routes.interviews import interviews_bp


def create_app(test_config: dict | None = None) -> Flask:
    """Create and configure the ApplyTrack Flask application."""
    app = Flask(__name__)
    app.config.from_object(Config)

    if test_config:
        app.config.update(test_config)

    # Initialize SQLite tables on startup and ensure connections close after each request.
    init_db(app.config["DATABASE_PATH"])
    app.teardown_appcontext(close_db)

    app.register_blueprint(applications_bp)
    app.register_blueprint(interviews_bp)

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "app": "ApplyTrack"})

    @app.errorhandler(404)
    def handle_404(_err):
        return jsonify({"error": "Resource not found."}), 404

    @app.errorhandler(405)
    def handle_405(_err):
        return jsonify({"error": "HTTP method not allowed for this endpoint."}), 405

    @app.errorhandler(500)
    def handle_500(_err):
        return jsonify({"error": "An unexpected server error occurred."}), 500

    return app


app = create_app()

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=debug_mode)
