"""
Local dev server for thematic-quran-web.

Serves the static site AND exposes a small JSON API under /api/labeler/ that
the admin pipeline UI uses to drive scripts/labeler.py.

Stdlib only.  Run with:
    python3 server.py
"""

import http.server
import json
import os
import sys
import threading
import urllib.parse
from pathlib import Path

# Make scripts/ importable so we can talk to the labeler worker.
REPO_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
import labeler  # noqa: E402


class LocalServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mask_key(key: str) -> str:
    if not key:
        return ""
    tail = key[-4:]
    return f"●●●●●●●●{tail}"


def _read_json_body(handler) -> dict:
    length = int(handler.headers.get("content-length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def _send_json(handler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    # Don't cache API responses.
    handler.send_header("cache-control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


# ---------------------------------------------------------------------------
# /api/labeler/* router
# ---------------------------------------------------------------------------

def _api_get_config(handler) -> None:
    env_key = labeler.get_api_key()
    env = labeler.load_env()
    default_model = (
        os.environ.get("ANTHROPIC_DEFAULT_MODEL")
        or env.get("ANTHROPIC_DEFAULT_MODEL")
        or labeler.DEFAULT_MODEL
    )
    models = [
        {"id": mid, "label": meta["label"], "inUsdPer1M": meta["in"], "outUsdPer1M": meta["out"]}
        for mid, meta in labeler.MODEL_PRICING.items()
    ]
    _send_json(handler, 200, {
        "hasKey": bool(env_key),
        "maskedKey": _mask_key(env_key) if env_key else None,
        "defaultModel": default_model,
        "models": models,
        "envFile": str(labeler.ENV_FILE),
    })


def _api_save_config(handler) -> None:
    body = _read_json_body(handler)
    api_key = body.get("apiKey")
    default_model = body.get("defaultModel")
    saved = []
    if isinstance(api_key, str) and api_key.strip():
        labeler.save_env_field("ANTHROPIC_API_KEY", api_key.strip())
        saved.append("apiKey")
    if isinstance(default_model, str) and default_model in labeler.MODEL_PRICING:
        labeler.save_env_field("ANTHROPIC_DEFAULT_MODEL", default_model)
        saved.append("defaultModel")
    if not saved:
        return _send_json(handler, 400, {"error": "Nothing saved — provide apiKey and/or defaultModel."})
    return _api_get_config(handler)


def _api_get_coverage(handler) -> None:
    coverage = labeler.compute_surah_coverage()
    # Add the canonical surah name for the picker tooltip.
    quran = labeler.load_quran()
    names = {}
    for v in quran:
        n = v.get("surah_no")
        if n and n not in names:
            names[n] = v.get("surah_name_roman") or f"Surah {n}"
    out = {}
    for n, info in coverage.items():
        out[str(n)] = {**info, "name": names.get(n, f"Surah {n}")}
    _send_json(handler, 200, {"surahs": out})


def _api_start_job(handler) -> None:
    body = _read_json_body(handler)
    surahs = body.get("surahs") or []
    model = body.get("model") or labeler.DEFAULT_MODEL

    if not isinstance(surahs, list) or not all(isinstance(s, int) for s in surahs):
        return _send_json(handler, 400, {"error": "surahs must be an array of integers"})
    surahs = [s for s in surahs if 1 <= s <= 114]
    if not surahs:
        return _send_json(handler, 400, {"error": "no valid surah numbers provided"})

    if model not in labeler.MODEL_PRICING:
        return _send_json(handler, 400, {"error": f"unknown model: {model}"})

    api_key = labeler.get_api_key()
    if not api_key:
        return _send_json(handler, 400, {"error": "ANTHROPIC_API_KEY is not set. Add it via the admin panel or .env file."})

    if labeler.is_running():
        return _send_json(handler, 409, {"error": "A labeling run is already in progress."})

    try:
        job_id = labeler.run_job_in_background(surahs, model, api_key)
    except Exception as e:
        return _send_json(handler, 500, {"error": f"failed to start job: {e}"})
    return _send_json(handler, 202, {"jobId": job_id, "surahs": surahs, "model": model})


def _api_start_compare(handler) -> None:
    body = _read_json_body(handler)
    surahs = body.get("surahs") or []
    model = body.get("model") or labeler.DEFAULT_MODEL

    if not isinstance(surahs, list) or not all(isinstance(s, int) for s in surahs):
        return _send_json(handler, 400, {"error": "surahs must be an array of integers"})
    surahs = [s for s in surahs if 1 <= s <= 114]
    if not surahs:
        return _send_json(handler, 400, {"error": "no valid surah numbers provided"})

    if model not in labeler.MODEL_PRICING:
        return _send_json(handler, 400, {"error": f"unknown model: {model}"})

    api_key = labeler.get_api_key()
    if not api_key:
        return _send_json(handler, 400, {"error": "ANTHROPIC_API_KEY is not set. Add it via the admin panel or .env file."})

    if labeler.is_running():
        return _send_json(handler, 409, {"error": "A labeling run is already in progress."})

    try:
        job_id = labeler.run_compare_in_background(surahs, model, api_key)
    except Exception as e:
        return _send_json(handler, 500, {"error": f"failed to start comparison: {e}"})
    return _send_json(handler, 202, {"jobId": job_id, "surahs": surahs, "model": model, "mode": "compare"})


def _api_current_job(handler) -> None:
    state = labeler.read_status() or {}
    state["isRunning"] = labeler.is_running()
    _send_json(handler, 200, state)


def _api_cancel(handler) -> None:
    cancelled = labeler.cancel_active_run()
    _send_json(handler, 200, {"cancelled": cancelled, "isRunning": labeler.is_running()})


def _api_pricing(handler) -> None:
    _send_json(handler, 200, {"models": labeler.MODEL_PRICING})


_ROUTES = {
    ("GET", "/api/labeler/config"):       _api_get_config,
    ("POST", "/api/labeler/config"):      _api_save_config,
    ("GET", "/api/labeler/coverage"):     _api_get_coverage,
    ("POST", "/api/labeler/jobs"):        _api_start_job,
    ("POST", "/api/labeler/compare"):     _api_start_compare,
    ("GET", "/api/labeler/jobs/current"): _api_current_job,
    ("POST", "/api/labeler/jobs/cancel"): _api_cancel,
    ("GET", "/api/labeler/pricing"):      _api_pricing,
}


# ---------------------------------------------------------------------------
# Custom handler — same headers as before, plus /api routing.
# ---------------------------------------------------------------------------

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    # Increase logging context for our API endpoints; keep static-file noise normal.
    def log_message(self, fmt, *args):  # noqa: A003
        sys.stderr.write("[server] " + fmt % args + "\n")

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        # Use `credentialless` instead of `require-corp` so cross-origin CDN
        # resources (Tailwind, Google Fonts, Material Symbols) load without
        # needing their own CORP header. SharedArrayBuffer for FFmpeg video
        # export still works under `credentialless` in Chrome.
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def _route_api(self, method: str) -> bool:
        path = urllib.parse.urlparse(self.path).path
        if not path.startswith("/api/labeler/"):
            return False
        handler = _ROUTES.get((method, path))
        if not handler:
            _send_json(self, 404, {"error": f"no handler for {method} {path}"})
            return True
        try:
            handler(self)
        except Exception as e:  # last-resort guard so the server keeps running
            _send_json(self, 500, {"error": f"server exception: {e}"})
        return True

    def do_GET(self):  # noqa: N802
        if self._route_api("GET"):
            return
        super().do_GET()

    def do_POST(self):  # noqa: N802
        if self._route_api("POST"):
            return
        # No POST handling for static files — return 405 instead of crashing.
        _send_json(self, 405, {"error": "method not allowed"})


# ---------------------------------------------------------------------------
# Boot
# ---------------------------------------------------------------------------

PORT = 5501

if __name__ == "__main__":
    print(f"Serving at http://127.0.0.1:{PORT}")
    print(f"  Admin labeler UI: http://127.0.0.1:{PORT}/admin/label-analytics.html")
    with LocalServer(("", PORT), CustomHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.")
