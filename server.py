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
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make scripts/ importable so we can talk to the labeler worker.
REPO_ROOT = Path(__file__).resolve().parent
LOCAL_FEEDBACK_DIR = REPO_ROOT / "data" / "feedback"
LOCAL_FEEDBACK_FILE = LOCAL_FEEDBACK_DIR / "submissions.jsonl"
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


def _clean_text(value, max_len: int, multiline: bool = False) -> str:
    if not isinstance(value, str):
        return ""
    value = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not multiline:
        value = " ".join(value.split())
    return value[:max_len]


def _feedback_admin_authorized(handler) -> bool:
    expected = os.environ.get("FEEDBACK_ADMIN_TOKEN") or "local-dev"
    header = handler.headers.get("Authorization") or ""
    token = header[len("Bearer "):].strip() if header.startswith("Bearer ") else ""
    fallback = handler.headers.get("X-Feedback-Admin-Token") or ""
    return token == expected or fallback == expected


def _read_local_feedback_items() -> list:
    if not LOCAL_FEEDBACK_FILE.exists():
        return []
    items = []
    with LOCAL_FEEDBACK_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            key = record.get("key") or f"feedback:{record.get('createdAt', '')}:{record.get('id', '')}"
            items.append({**record, "key": key, "status": record.get("status") or "new"})
    return sorted(items, key=lambda item: item.get("createdAt") or "", reverse=True)


def _write_local_feedback_items(items: list) -> None:
    LOCAL_FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    with LOCAL_FEEDBACK_FILE.open("w", encoding="utf-8") as f:
        for item in items:
            record = dict(item)
            record.pop("key", None)
            f.write(json.dumps(record, ensure_ascii=False) + "\n")


def _period_bounds(period: str):
    now = datetime.now(timezone.utc)
    if period == "7d":
        return now.timestamp() - 7 * 24 * 60 * 60, None
    if period == "30d":
        return now.timestamp() - 30 * 24 * 60 * 60, None
    if period == "this-week":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start = start - timedelta(days=start.weekday())
        return start.timestamp(), None
    if period == "last-month":
        first_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if first_this_month.month == 1:
            first_last_month = first_this_month.replace(year=first_this_month.year - 1, month=12)
        else:
            first_last_month = first_this_month.replace(month=first_this_month.month - 1)
        return first_last_month.timestamp(), first_this_month.timestamp()
    return None, None


def _filter_local_feedback(items: list, filters: dict) -> list:
    status = filters.get("status") or "all"
    feedback_type = filters.get("type") or "all"
    query = (filters.get("query") or "").lower()
    start_ts, end_ts = _period_bounds(filters.get("period") or "all")

    out = []
    for item in items:
        if status != "all" and item.get("status") != status:
            continue
        if feedback_type != "all" and item.get("type") != feedback_type:
            continue
        if start_ts or end_ts:
            try:
                created_ts = datetime.fromisoformat((item.get("createdAt") or "").replace("Z", "+00:00")).timestamp()
            except ValueError:
                created_ts = 0
            if start_ts and created_ts < start_ts:
                continue
            if end_ts and created_ts >= end_ts:
                continue
        if query:
            context = item.get("context") or {}
            haystack = " ".join([
                item.get("message") or "",
                item.get("contact") or "",
                context.get("themeQuery") or "",
                context.get("pageUrl") or "",
            ]).lower()
            if query not in haystack:
                continue
        out.append(item)
    return out


def _is_likely_scam(message: str) -> bool:
    lowered = (message or "").lower()
    spam_terms = ["seo", "backlink", "crypto", "viagra", "casino", "link building", "marketing agency", "guest post"]
    return any(term in lowered for term in spam_terms)


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


def _api_feedback(handler) -> None:
    body = _read_json_body(handler)
    if body.get("website"):
        return _send_json(handler, 200, {"ok": True, "id": None})

    allowed_types = {"bug", "theme-search", "audio", "account-sync", "content", "suggestion", "other"}
    feedback_type = body.get("type") if body.get("type") in allowed_types else "other"
    message = _clean_text(body.get("message"), 4000, multiline=True)
    contact = _clean_text(body.get("contact"), 200)

    if len(message) < 10:
        return _send_json(handler, 400, {"ok": False, "error": "Please include at least 10 characters of feedback."})

    if contact and ("@" not in contact or "." not in contact.rsplit("@", 1)[-1]):
        return _send_json(handler, 400, {"ok": False, "error": "Please enter a valid email address, or leave it blank."})

    context = body.get("context") if isinstance(body.get("context"), dict) else {}
    allowed_context = {
        "source", "pageUrl", "viewMode", "surah", "themeQuery", "thematicQueryToken",
        "referrer", "userAgent", "viewport", "language", "timezone", "submittedAt"
    }
    cleaned_context = {
        key: _clean_text(value, 1000)
        for key, value in context.items()
        if key in allowed_context and isinstance(value, str) and value.strip()
    }

    feedback_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    feedback_key = f"feedback:{created_at}:{feedback_id}"
    record = {
        "key": feedback_key,
        "id": feedback_id,
        "createdAt": created_at,
        "type": feedback_type,
        "status": "new",
        "message": message,
        "contact": contact or None,
        "context": cleaned_context,
        "schemaVersion": 1,
        "storage": "local-dev"
    }

    LOCAL_FEEDBACK_DIR.mkdir(parents=True, exist_ok=True)
    with LOCAL_FEEDBACK_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    _send_json(handler, 201, {"ok": True, "id": feedback_id})


def _api_feedback_admin_list(handler) -> None:
    if not _feedback_admin_authorized(handler):
        return _send_json(handler, 401, {"ok": False, "error": "Unauthorized"})
    parsed = urllib.parse.urlparse(handler.path)
    params = urllib.parse.parse_qs(parsed.query)
    filters = {
        "status": (params.get("status") or ["all"])[0],
        "period": (params.get("period") or ["all"])[0],
        "type": (params.get("type") or ["all"])[0],
        "query": (params.get("query") or [""])[0],
    }
    all_items = _read_local_feedback_items()
    filtered = _filter_local_feedback(all_items, filters)
    _send_json(handler, 200, {"ok": True, "total": len(all_items), "count": len(filtered), "items": filtered[:500]})


def _api_feedback_admin_update(handler) -> None:
    if not _feedback_admin_authorized(handler):
        return _send_json(handler, 401, {"ok": False, "error": "Unauthorized"})
    body = _read_json_body(handler)
    key = _clean_text(body.get("key"), 300)
    status = _clean_text(body.get("status"), 40)
    allowed = {"new", "reviewed", "planned", "done", "ignored", "scam"}
    if not key or status not in allowed:
        return _send_json(handler, 400, {"ok": False, "error": "Invalid key or status."})

    items = _read_local_feedback_items()
    for item in items:
        if item.get("key") == key:
            item["status"] = status
            item["updatedAt"] = datetime.now(timezone.utc).isoformat()
            _write_local_feedback_items(items)
            return _send_json(handler, 200, {"ok": True, "item": item})
    _send_json(handler, 404, {"ok": False, "error": "Feedback record not found."})


def _api_feedback_admin_summary(handler) -> None:
    if not _feedback_admin_authorized(handler):
        return _send_json(handler, 401, {"ok": False, "error": "Unauthorized"})
    body = _read_json_body(handler)
    filters = {
        "status": body.get("status") or "new",
        "period": body.get("period") or "7d",
        "type": body.get("type") or "all",
        "query": body.get("query") or "",
    }
    all_items = _read_local_feedback_items()
    filtered = _filter_local_feedback(all_items, filters)
    scam_keys = [item["key"] for item in filtered if _is_likely_scam(item.get("message") or "")]
    usable = [item for item in filtered if item["key"] not in set(scam_keys)]

    by_type = {}
    for item in usable:
        by_type[item.get("type") or "other"] = by_type.get(item.get("type") or "other", 0) + 1
    actionable = [
        {
            "title": f"{feedback_type.replace('-', ' ').title()} feedback",
            "priority": "medium",
            "count": count,
            "evidenceKeys": [item["key"] for item in usable if (item.get("type") or "other") == feedback_type][:5],
            "recommendation": "Review the grouped messages and decide whether this is a bugfix, copy change, or product backlog item."
        }
        for feedback_type, count in sorted(by_type.items(), key=lambda pair: pair[1], reverse=True)
    ]

    if body.get("autoMarkScam") is not False and scam_keys:
        for item in all_items:
            if item.get("key") in scam_keys:
                item["status"] = "scam"
                item["updatedAt"] = datetime.now(timezone.utc).isoformat()
        _write_local_feedback_items(all_items)

    summary = {
        "headline": "Local fallback summary",
        "scope": "Local server fallback. Production summaries use Gemini when GEMINI_API_KEY is configured.",
        "totalRecords": len(filtered),
        "usableRecords": len(usable),
        "scamExcluded": len(scam_keys),
        "scamKeys": scam_keys,
        "actionablePoints": actionable,
        "bugs": [{"title": item.get("message", "")[:80], "evidenceKeys": [item["key"]], "nextStep": "Reproduce and confirm."} for item in usable if item.get("type") == "bug"][:5],
        "themeSearchIssues": [{"title": item.get("message", "")[:80], "evidenceKeys": [item["key"]], "nextStep": "Check theme aliases and section labels."} for item in usable if item.get("type") == "theme-search"][:5],
        "quickWins": ["Triage new items weekly.", "Promote repeated issues into a planned backlog item."],
        "needsReply": [{"key": item["key"], "reason": "User provided contact details.", "suggestedReply": "Thank you for the detailed feedback. I am reviewing it now."} for item in usable if item.get("contact")][:5],
        "patterns": [f"{count} item(s) tagged {feedback_type}." for feedback_type, count in by_type.items()]
    }
    _send_json(handler, 200, {"ok": True, "summary": summary, "markedScams": len(scam_keys), "model": "local-fallback"})


_ROUTES = {
    ("GET", "/api/labeler/config"):       _api_get_config,
    ("POST", "/api/labeler/config"):      _api_save_config,
    ("GET", "/api/labeler/coverage"):     _api_get_coverage,
    ("POST", "/api/labeler/jobs"):        _api_start_job,
    ("POST", "/api/labeler/compare"):     _api_start_compare,
    ("GET", "/api/labeler/jobs/current"): _api_current_job,
    ("POST", "/api/labeler/jobs/cancel"): _api_cancel,
    ("GET", "/api/labeler/pricing"):      _api_pricing,
    ("POST", "/api/feedback"):            _api_feedback,
    ("GET", "/api/feedback/admin"):        _api_feedback_admin_list,
    ("PATCH", "/api/feedback/admin"):      _api_feedback_admin_update,
    ("POST", "/api/feedback/admin"):       _api_feedback_admin_summary,
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
        if not (path.startswith("/api/labeler/") or path == "/api/feedback" or path == "/api/feedback/admin"):
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

    def do_PATCH(self):  # noqa: N802
        if self._route_api("PATCH"):
            return
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
