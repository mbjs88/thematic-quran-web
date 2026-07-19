#!/usr/bin/env python3
"""
Thematic Qur'an Labeler
=======================

Calls the Anthropic Claude API to label every section of a surah against the
taxonomy in `docs/taxonomy.md`, following the rules in
`docs/labeling/LABELING_INSTRUCTIONS.md`.

Runnable two ways:

  1. Standalone from the terminal:
       python3 scripts/labeler.py --surahs 4,5,6 --model claude-sonnet-4-6

  2. Imported by `server.py` to run as a background thread (admin pipeline UI).

Output is merged directly into `data/thematic_labels/assignments.json`
(trust + spot-check workflow).  Per-run status is written to
`data/thematic_labels/.runs/last-run.json` for the UI to poll, plus a
plain-text log at `data/thematic_labels/.runs/last-run.log`.

Stdlib only — no `pip install` required.  Talks to the Anthropic Messages API
via `urllib.request`.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Callable, Optional

# ---------------------------------------------------------------------------
# Paths and constants
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
THEMATIC_DIR = DATA_DIR / "thematic_labels"
RUNS_DIR = THEMATIC_DIR / ".runs"
TAXONOMY_MD = REPO_ROOT / "docs" / "taxonomy.md"
INSTRUCTIONS_MD = REPO_ROOT / "docs" / "labeling" / "LABELING_INSTRUCTIONS.md"
ASSIGNMENTS_JSON = THEMATIC_DIR / "assignments.json"
TAXONOMY_JSON = THEMATIC_DIR / "taxonomy.json"
QURAN_JSON = DATA_DIR / "quran_data.json"
THEME_BREAKS_JSON = DATA_DIR / "theme_breaks.json"
ENV_FILE = REPO_ROOT / ".env"

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_API_VERSION = "2023-06-01"

# Cost table — dollars per 1M tokens (input / output).  Used for live cost
# estimates in the admin UI; refresh these if Anthropic updates prices.
MODEL_PRICING = {
    "claude-haiku-4-5-20251001": {"in": 1.00, "out": 5.00, "label": "Haiku 4.5 (cheap, fast)"},
    "claude-sonnet-4-6":         {"in": 3.00, "out": 15.00, "label": "Sonnet 4.6 (recommended)"},
    "claude-opus-4-6":           {"in": 15.00, "out": 75.00, "label": "Opus 4.6 (best, expensive)"},
}
DEFAULT_MODEL = "claude-sonnet-4-6"

# Soft cap on labels-per-section (matches the taxonomy rule).  Used for warnings.
LABEL_SOFT_CAP = 12

# Backoff strategy for 429 / 5xx — capped exponential.
INITIAL_BACKOFF_SECONDS = 5
MAX_BACKOFF_SECONDS = 90
MAX_RETRIES_PER_SURAH = 5

# Network-resilience tuning.
NETWORK_PROBE_TIMEOUT_SECONDS = 4       # quick check to decide pause-vs-retry
NETWORK_PROBE_INTERVAL_SECONDS = 20     # how often we poll while paused
NETWORK_PROBE_URL = "https://api.anthropic.com/"  # cheap reachability probe

# Auto-retry sweep for surahs that errored: 1 initial pass + up to N-1 retries.
MAX_RETRY_PASSES = 3


# ---------------------------------------------------------------------------
# .env loading (no python-dotenv dependency)
# ---------------------------------------------------------------------------

def load_env(path: Path = ENV_FILE) -> dict:
    """Returns key=value pairs from .env. Empty dict if file is missing."""
    out = {}
    if not path.exists():
        return out
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def save_env_field(key: str, value: str, path: Path = ENV_FILE) -> None:
    """Upsert a single key in .env, preserving comments and other keys."""
    lines = []
    if path.exists():
        lines = path.read_text().splitlines()
    found = False
    for i, raw in enumerate(lines):
        if raw.strip().startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            found = True
            break
    if not found:
        # Append a freshly-written line.
        if lines and lines[-1].strip():
            lines.append("")
        lines.append(f"{key}={value}")
    path.write_text("\n".join(lines) + "\n")


def get_api_key() -> Optional[str]:
    return os.environ.get("ANTHROPIC_API_KEY") or load_env().get("ANTHROPIC_API_KEY")


# ---------------------------------------------------------------------------
# Job state model + run-log
# ---------------------------------------------------------------------------

@dataclass
class SurahResult:
    surah: int
    status: str = "pending"            # pending | running | done | error | cancelled
    sections_labeled: int = 0
    sections_total: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    duration_seconds: float = 0.0
    overflow_sections: list = field(default_factory=list)   # ids over the 12-cap
    suggested_new_labels: list = field(default_factory=list)
    changed_sections: int = 0
    unchanged_sections: int = 0
    added_labels: int = 0
    removed_labels: int = 0
    section_diffs: list = field(default_factory=list)
    error: Optional[str] = None
    finished_at: Optional[str] = None


@dataclass
class JobState:
    job_id: str
    model: str
    surahs: list                       # list of int
    started_at: str
    mode: str = "label"                # label | compare
    status: str = "running"            # running | done | cancelled | error
    current_surah: Optional[int] = None
    results: dict = field(default_factory=dict)   # surah_no (str) -> SurahResult dict
    tokens_in_total: int = 0
    tokens_out_total: int = 0
    cost_usd_total: float = 0.0
    log_tail: list = field(default_factory=list)   # last ~100 log lines
    finished_at: Optional[str] = None
    # Network-resilience state:
    paused: bool = False
    paused_reason: Optional[str] = None
    retry_pass: int = 1                 # 1 = first pass; bumps on each retry sweep
    baseline_path: Optional[str] = None
    report_path: Optional[str] = None

    def to_json(self) -> dict:
        d = asdict(self)
        d["results"] = {str(k): v for k, v in self.results.items()}
        return d


def _ensure_runs_dir() -> None:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)


def _status_path() -> Path:
    return RUNS_DIR / "last-run.json"


def _log_path() -> Path:
    return RUNS_DIR / "last-run.log"


def write_status(state: JobState) -> None:
    _ensure_runs_dir()
    _status_path().write_text(json.dumps(state.to_json(), indent=2))


def read_status() -> Optional[dict]:
    p = _status_path()
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def append_log(state: JobState, line: str) -> None:
    _ensure_runs_dir()
    stamp = time.strftime("%H:%M:%S")
    rendered = f"[{stamp}] {line}"
    print(rendered, flush=True)
    state.log_tail.append(rendered)
    state.log_tail = state.log_tail[-200:]
    with _log_path().open("a") as f:
        f.write(rendered + "\n")


# ---------------------------------------------------------------------------
# Network connectivity probe + pause-and-wait helper
# ---------------------------------------------------------------------------

def _network_alive(timeout: float = NETWORK_PROBE_TIMEOUT_SECONDS) -> bool:
    """
    Returns True if api.anthropic.com is reachable. Any HTTP response from the
    server (even a 401/403) counts as reachable — only true network errors
    (URLError / TimeoutError / OSError) count as 'down'.
    """
    try:
        urllib.request.urlopen(NETWORK_PROBE_URL, timeout=timeout)
        return True
    except urllib.error.HTTPError:
        return True  # got a real response from the server
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _wait_for_network(state: "JobState", token: "CancellationToken") -> bool:
    """
    Block the worker until network connectivity returns. Honors the
    cancellation token (cancelling during a pause exits cleanly).
    Returns True if connectivity came back, False if cancelled.
    """
    state.paused = True
    state.paused_reason = "Network unreachable — waiting for connectivity."
    write_status(state)
    append_log(state, "⏸  Paused: network unreachable. Will resume automatically when it's back.")
    while not token.cancelled:
        # Sleep in 1-second slices so cancellation feels snappy.
        for _ in range(NETWORK_PROBE_INTERVAL_SECONDS):
            if token.cancelled:
                break
            time.sleep(1)
        if token.cancelled:
            break
        if _network_alive():
            append_log(state, "▶  Network restored. Resuming.")
            state.paused = False
            state.paused_reason = None
            write_status(state)
            return True
    state.paused = False
    state.paused_reason = None
    write_status(state)
    return False


# ---------------------------------------------------------------------------
# Cancellation
# ---------------------------------------------------------------------------

class CancellationToken:
    def __init__(self):
        self._stop = False
    def cancel(self):
        self._stop = True
    @property
    def cancelled(self) -> bool:
        return self._stop


# A module-level token + lock so the HTTP server can cancel an in-progress run.
_active_token: Optional[CancellationToken] = None
_active_lock = threading.Lock()


def cancel_active_run() -> bool:
    with _active_lock:
        if _active_token is not None:
            _active_token.cancel()
            return True
    return False


def is_running() -> bool:
    with _active_lock:
        return _active_token is not None


# ---------------------------------------------------------------------------
# Data loaders
# ---------------------------------------------------------------------------

def load_quran():
    with QURAN_JSON.open() as f:
        return json.load(f)


def load_theme_breaks():
    with THEME_BREAKS_JSON.open() as f:
        return json.load(f)


def load_taxonomy_md() -> str:
    return TAXONOMY_MD.read_text()


def load_instructions_md() -> str:
    if INSTRUCTIONS_MD.exists():
        return INSTRUCTIONS_MD.read_text()
    return "[LABELING_INSTRUCTIONS.md missing — using taxonomy.md only]"


def load_assignments() -> dict:
    if ASSIGNMENTS_JSON.exists():
        with ASSIGNMENTS_JSON.open() as f:
            return json.load(f)
    return {}


def save_assignments(data: dict) -> None:
    ASSIGNMENTS_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def load_taxonomy_json() -> dict:
    if TAXONOMY_JSON.exists():
        with TAXONOMY_JSON.open() as f:
            return json.load(f)
    return {}


def valid_label_ids() -> set:
    tax = load_taxonomy_json()
    return {lab["id"] for lab in (tax.get("labels") or [])}


# ---------------------------------------------------------------------------
# Coverage analysis (used by the UI surah-picker)
# ---------------------------------------------------------------------------

def compute_surah_coverage() -> dict:
    """Returns { surah_no: {sections: int, labeled: int, status: str} } for surahs 1-114."""
    breaks = load_theme_breaks()
    assigns = load_assignments()

    out = {}
    for surah_no in range(1, 115):
        sb = breaks.get(str(surah_no), []) or []
        total = len(sb)
        labeled = 0
        for start in sb:
            start_v = start["start"] if isinstance(start, dict) else start
            if f"{surah_no}:{start_v}" in assigns:
                labeled += 1
        if total == 0:
            status = "empty"
        elif labeled == 0:
            status = "not-started"
        elif labeled < total:
            status = "partial"
        else:
            status = "complete"
        out[surah_no] = {"sections": total, "labeled": labeled, "status": status}
    return out


def _section_ids_for_surahs(quran, breaks, surahs: list) -> list:
    ids = []
    for surah_no in surahs:
        ids.extend(f"{surah_no}:{start}" for start, _, _ in _enumerate_sections(quran, breaks, surah_no))
    return ids


def _save_compare_baseline(job_id: str, surahs: list, quran, breaks) -> Path:
    assignments = load_assignments()
    section_ids = _section_ids_for_surahs(quran, breaks, surahs)
    baseline = {
        sid: assignments.get(sid, {"labels": [], "confidence": None})
        for sid in section_ids
    }
    path = RUNS_DIR / f"compare-{job_id}-baseline.json"
    path.write_text(json.dumps({
        "jobId": job_id,
        "savedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "surahs": surahs,
        "sections": baseline,
    }, indent=2, ensure_ascii=False))
    return path


def _write_compare_report(state: JobState) -> Path:
    path = RUNS_DIR / f"compare-{state.job_id}-report.json"
    path.write_text(json.dumps(state.to_json(), indent=2, ensure_ascii=False))
    return path


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def _surah_name(quran, surah_no: int) -> str:
    for v in quran:
        if v.get("surah_no") == surah_no:
            return v.get("surah_name_roman") or f"Surah {surah_no}"
    return f"Surah {surah_no}"


def _enumerate_sections(quran, breaks, surah_no: int):
    """Yields (start, end, [verses]) for each section in this surah."""
    sb = breaks.get(str(surah_no), []) or []
    verses = [v for v in quran if v.get("surah_no") == surah_no]
    if not verses or not sb:
        return
    last = max(v["ayah_no_surah"] for v in verses)
    for i, raw in enumerate(sb):
        start = raw["start"] if isinstance(raw, dict) else raw
        nxt = sb[i + 1] if i + 1 < len(sb) else None
        nxt_start = (nxt["start"] if isinstance(nxt, dict) else nxt) if nxt else None
        end = (nxt_start - 1) if nxt_start else last
        section_verses = [v for v in verses if start <= v["ayah_no_surah"] <= end]
        yield start, end, section_verses


def _system_prompt() -> str:
    taxonomy = load_taxonomy_md()
    instructions = load_instructions_md()
    return (
        "You are labeling sections of the Qur'an against a fixed thematic taxonomy.\n\n"
        "Read both documents below and follow them exactly. The taxonomy is the\n"
        "source of truth for valid label IDs. Output strict JSON with no commentary,\n"
        "no markdown fences, no prose outside the JSON object.\n\n"
        "===== BEGIN LABELING_INSTRUCTIONS.md =====\n"
        f"{instructions}\n"
        "===== END LABELING_INSTRUCTIONS.md =====\n\n"
        "===== BEGIN taxonomy.md =====\n"
        f"{taxonomy}\n"
        "===== END taxonomy.md =====\n"
    )


def _user_prompt(quran, breaks, surah_no: int) -> str:
    name = _surah_name(quran, surah_no)
    sections = list(_enumerate_sections(quran, breaks, surah_no))
    if not sections:
        return ""

    lines = [
        f"Surah {surah_no} — {name}",
        f"{len(sections)} sections to label.",
        "",
        "For each section below, return labels per the rules. The output JSON",
        "object's keys must be exactly the section IDs shown (\"surah:startAyah\").",
        "",
        "Required output shape (strict JSON, no prose, no markdown fences):",
        "{",
        '  "<surah:startAyah>": {',
        '    "labels": ["<id>", "<id>", ...],',
        '    "confidence": "high|medium|low",',
        '    "notes": "<optional>",',
        '    "suggestedNewLabels": ["<proposed-id>", ...]    // optional, omit if empty',
        "  },",
        "  ...",
        "}",
        "",
        "Sections:",
    ]
    for start, end, verses in sections:
        lines.append(f"\n--- Section {surah_no}:{start} (verses {start}–{end}) ---")
        for v in verses:
            arabic = v.get("ayah_ar", "").strip()
            english = v.get("ayah_en", "").strip()
            n = v.get("ayah_no_surah")
            lines.append(f"  {n}. AR: {arabic}")
            lines.append(f"     EN: {english}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Anthropic API call
# ---------------------------------------------------------------------------

# Output-token budget. Long surahs (Al-Baqarah's 81 sections, Al-Imran's 41)
# need a lot of JSON. Sonnet/Opus/Haiku 4.x all support far more than this.
# We bumped from 8000 → 24000 after seeing Surah 3 (41 sections) truncate.
DEFAULT_MAX_TOKENS = 24000
TRUNCATION_RETRY_MAX_TOKENS = 48000


def _call_anthropic(api_key: str, model: str, system: str, user: str,
                    max_tokens: int = DEFAULT_MAX_TOKENS, timeout: int = 360) -> dict:
    body = json.dumps({
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode("utf-8")
    req = urllib.request.Request(
        ANTHROPIC_API_URL,
        data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_API_VERSION,
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def _extract_text(payload: dict) -> str:
    blocks = payload.get("content") or []
    parts = []
    for b in blocks:
        if isinstance(b, dict) and b.get("type") == "text":
            parts.append(b.get("text", ""))
    return "".join(parts)


def _parse_assignments_json(text: str) -> dict:
    """The model occasionally wraps JSON in ``` fences. Strip them defensively."""
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    # Find the first { and the last } as fallback.
    if not s.startswith("{"):
        i, j = s.find("{"), s.rfind("}")
        if i >= 0 and j > i:
            s = s[i:j + 1]
    return json.loads(s)


# ---------------------------------------------------------------------------
# Per-surah runner
# ---------------------------------------------------------------------------

def label_one_surah(surah_no: int, model: str, api_key: str,
                    quran, breaks, valid_ids,
                    state: JobState, token: CancellationToken,
                    persist: bool = True) -> SurahResult:
    name = _surah_name(quran, surah_no)
    section_ids = [f"{surah_no}:{start}" for start, _, _ in _enumerate_sections(quran, breaks, surah_no)]
    result = SurahResult(surah=surah_no, status="running", sections_total=len(section_ids))
    state.results[str(surah_no)] = asdict(result)
    state.current_surah = surah_no
    write_status(state)
    append_log(state, f"Surah {surah_no} ({name}) — {len(section_ids)} sections via {model}")

    if len(section_ids) == 0:
        result.status = "done"
        result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
        state.results[str(surah_no)] = asdict(result)
        append_log(state, f"  Skipped (no theme_breaks).")
        write_status(state)
        return result

    system = _system_prompt()
    user = _user_prompt(quran, breaks, surah_no)

    started = time.time()
    backoff = INITIAL_BACKOFF_SECONDS
    for attempt in range(1, MAX_RETRIES_PER_SURAH + 1):
        if token.cancelled:
            result.status = "cancelled"
            result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
            state.results[str(surah_no)] = asdict(result)
            write_status(state)
            append_log(state, "  Cancelled before API call.")
            return result
        try:
            payload = _call_anthropic(api_key, model, system, user)
            break
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="ignore") if e.fp else str(e)
            if e.code == 429 or 500 <= e.code < 600:
                append_log(state, f"  attempt {attempt} → HTTP {e.code}; backing off {backoff}s")
                # Sleep in 1s slices so cancellation feels snappy.
                for _ in range(backoff):
                    if token.cancelled:
                        break
                    time.sleep(1)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                continue
            result.status = "error"
            result.error = f"HTTP {e.code}: {body_text[:300]}"
            result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
            state.results[str(surah_no)] = asdict(result)
            write_status(state)
            append_log(state, f"  ERROR: {result.error}")
            return result
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            append_log(state, f"  attempt {attempt} → network error: {e}")
            # Distinguish a transient blip from a sustained outage. If we can
            # reach the API root, treat as a blip and back off normally.
            # Otherwise pause the entire run until connectivity returns —
            # cheaper than burning the rest of this surah's retry budget.
            if _network_alive():
                append_log(state, f"  api.anthropic.com reachable; transient — backing off {backoff}s")
                for _ in range(backoff):
                    if token.cancelled:
                        break
                    time.sleep(1)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                continue
            # Network is genuinely down — pause until it's back.
            resumed = _wait_for_network(state, token)
            if not resumed:
                # Cancellation during the wait.
                continue
            backoff = INITIAL_BACKOFF_SECONDS  # reset; we just got connectivity back
            continue
    else:
        result.status = "error"
        result.error = f"Gave up after {MAX_RETRIES_PER_SURAH} attempts"
        result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
        state.results[str(surah_no)] = asdict(result)
        write_status(state)
        append_log(state, f"  ERROR: {result.error}")
        return result

    # If the model hit max_tokens mid-output, retry ONCE with a much larger
    # budget before falling through to the JSON parser (which would fail with
    # an unhelpful 'Unterminated string' error). Long surahs hit this on the
    # default budget; the retry resolves it for nearly all of them.
    if payload.get("stop_reason") == "max_tokens":
        append_log(state,
            f"  Hit max_tokens ({DEFAULT_MAX_TOKENS}); retrying with {TRUNCATION_RETRY_MAX_TOKENS}")
        try:
            payload = _call_anthropic(api_key, model, system, user,
                                      max_tokens=TRUNCATION_RETRY_MAX_TOKENS)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as e:
            result.status = "error"
            result.error = f"Truncation-retry failed: {e}"
            result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
            state.results[str(surah_no)] = asdict(result)
            write_status(state)
            append_log(state, f"  ERROR: {result.error}")
            return result
        if payload.get("stop_reason") == "max_tokens":
            # Still cut off even at the larger budget — surface a clean error
            # rather than a JSON parse failure.
            result.status = "error"
            result.error = (f"Response truncated even at {TRUNCATION_RETRY_MAX_TOKENS} max_tokens. "
                            f"This surah may need to be split or labeled in two halves.")
            result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
            state.results[str(surah_no)] = asdict(result)
            write_status(state)
            append_log(state, f"  ERROR: {result.error}")
            return result

    # Token usage and cost
    usage = (payload.get("usage") or {})
    in_tok = int(usage.get("input_tokens") or 0)
    out_tok = int(usage.get("output_tokens") or 0)
    price = MODEL_PRICING.get(model, {"in": 0, "out": 0})
    cost = (in_tok / 1_000_000) * price["in"] + (out_tok / 1_000_000) * price["out"]
    result.tokens_in = in_tok
    result.tokens_out = out_tok
    result.cost_usd = round(cost, 4)
    state.tokens_in_total += in_tok
    state.tokens_out_total += out_tok
    state.cost_usd_total = round(state.cost_usd_total + cost, 4)

    text = _extract_text(payload)
    try:
        new_entries = _parse_assignments_json(text)
    except json.JSONDecodeError as e:
        # If the model genuinely returned malformed JSON (rare with the
        # truncation guard above), preserve the first chunk so a human can see
        # what went wrong.
        result.status = "error"
        result.error = f"JSON parse error: {e}; first 200 chars: {text[:200]!r}"
        result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
        state.results[str(surah_no)] = asdict(result)
        write_status(state)
        append_log(state, f"  ERROR: {result.error}")
        return result

    # Validate model output. In normal mode, merge into assignments.json. In
    # compare mode, keep assignments.json untouched and report section diffs.
    assignments = load_assignments()
    accepted = 0
    overflow = []
    suggested = set()
    bad_labels = set()
    changed_sections = 0
    unchanged_sections = 0
    added_label_count = 0
    removed_label_count = 0
    section_diffs = []
    for sid, entry in new_entries.items():
        if sid.startswith("_") or sid not in section_ids:
            continue
        if not isinstance(entry, dict):
            continue
        labels = entry.get("labels") or []
        if not isinstance(labels, list):
            continue
        # Strip unknown label IDs and warn
        cleaned = []
        for lab in labels:
            if lab in valid_ids:
                cleaned.append(lab)
            else:
                bad_labels.add(lab)
        if not cleaned:
            continue
        if len(cleaned) > LABEL_SOFT_CAP:
            overflow.append(sid)
        proposed = entry.get("suggestedNewLabels") or []
        if isinstance(proposed, list):
            for s in proposed:
                if isinstance(s, str):
                    suggested.add(s)

        confidence = entry.get("confidence") or "medium"
        notes = entry.get("notes")
        if persist:
            assignments[sid] = {
                "labels": cleaned,
                "confidence": confidence,
            }
            if notes:
                assignments[sid]["notes"] = notes
        else:
            previous = assignments.get(sid) or {}
            old_labels = list(dict.fromkeys(previous.get("labels") or []))
            new_labels = list(dict.fromkeys(cleaned))
            old_set = set(old_labels)
            new_set = set(new_labels)
            added = [lab for lab in new_labels if lab not in old_set]
            removed = [lab for lab in old_labels if lab not in new_set]
            unchanged = [lab for lab in new_labels if lab in old_set]
            if added or removed:
                changed_sections += 1
            else:
                unchanged_sections += 1
            added_label_count += len(added)
            removed_label_count += len(removed)
            section_diffs.append({
                "sectionId": sid,
                "oldLabels": old_labels,
                "newLabels": new_labels,
                "added": added,
                "removed": removed,
                "unchanged": unchanged,
                "oldConfidence": previous.get("confidence"),
                "newConfidence": confidence,
                "notes": notes or "",
            })
        accepted += 1

    if persist:
        # Surah summary entry
        assignments[f"_surah_summary_{surah_no}"] = {
            "labeledAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "model": model,
            "sectionsLabeled": accepted,
            "sectionsTotal": len(section_ids),
            "overflowSections": overflow,
            "suggestedNewLabels": sorted(suggested),
            "tokensIn": in_tok,
            "tokensOut": out_tok,
            "costUsd": round(cost, 4),
        }
        save_assignments(assignments)

    result.sections_labeled = accepted
    result.overflow_sections = overflow
    result.suggested_new_labels = sorted(suggested)
    result.changed_sections = changed_sections
    result.unchanged_sections = unchanged_sections
    result.added_labels = added_label_count
    result.removed_labels = removed_label_count
    result.section_diffs = section_diffs
    result.duration_seconds = round(time.time() - started, 1)
    result.status = "done"
    result.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
    state.results[str(surah_no)] = asdict(result)
    write_status(state)

    extra = ""
    if bad_labels:
        extra += f" [{len(bad_labels)} unknown label IDs dropped]"
    if overflow:
        extra += f" [{len(overflow)} sections >12 labels]"
    if suggested:
        extra += f" [{len(suggested)} new-label proposals: {', '.join(sorted(suggested))}]"
    if persist:
        append_log(state,
            f"  Done: {accepted}/{len(section_ids)} sections, "
            f"{in_tok}+{out_tok} tokens, ${cost:.4f}, {result.duration_seconds}s{extra}"
        )
    else:
        append_log(state,
            f"  Compared: {accepted}/{len(section_ids)} sections, "
            f"{changed_sections} changed, {unchanged_sections} unchanged, "
            f"+{added_label_count}/-{removed_label_count} labels, "
            f"{in_tok}+{out_tok} tokens, ${cost:.4f}, {result.duration_seconds}s{extra}"
        )
    return result


# ---------------------------------------------------------------------------
# Top-level job runner
# ---------------------------------------------------------------------------

def _start_job_threadsafe(token: CancellationToken) -> None:
    global _active_token
    with _active_lock:
        _active_token = token


def _end_job_threadsafe() -> None:
    global _active_token
    with _active_lock:
        _active_token = None


def run_job(surahs: list, model: str, api_key: str,
            compare_only: bool = False,
            on_complete: Optional[Callable[[JobState], None]] = None) -> JobState:
    """Synchronous job runner. Call from a thread to background it."""
    if not api_key:
        raise ValueError("No ANTHROPIC_API_KEY available — set it via the admin panel or .env file.")
    if model not in MODEL_PRICING:
        raise ValueError(f"Unknown model {model!r}. Allowed: {list(MODEL_PRICING)}")
    if not surahs:
        raise ValueError("No surahs requested.")

    token = CancellationToken()
    _start_job_threadsafe(token)

    # Reset log file for this run
    _ensure_runs_dir()
    _log_path().write_text("")

    job_id = time.strftime("%Y%m%dT%H%M%S")
    state = JobState(
        job_id=job_id,
        model=model,
        surahs=[int(s) for s in surahs],
        started_at=time.strftime("%Y-%m-%dT%H:%M:%S"),
        mode="compare" if compare_only else "label",
    )
    for s in state.surahs:
        state.results[str(s)] = asdict(SurahResult(surah=s))
    write_status(state)
    mode_label = "comparison" if compare_only else "labeling"
    append_log(state, f"Starting {mode_label} job {job_id}: {len(state.surahs)} surah(s) via {model}")

    try:
        quran = load_quran()
        breaks = load_theme_breaks()
        valid_ids = valid_label_ids()
        if compare_only:
            baseline_path = _save_compare_baseline(job_id, state.surahs, quran, breaks)
            state.baseline_path = str(baseline_path.relative_to(REPO_ROOT))
            append_log(state, f"Saved comparison baseline: {state.baseline_path}")
            write_status(state)
    except Exception as e:
        state.status = "error"
        state.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
        append_log(state, f"FATAL: could not load data: {e}")
        write_status(state)
        _end_job_threadsafe()
        if on_complete:
            on_complete(state)
        return state

    try:
        # Outer loop = retry passes. Each pass labels every surah that still
        # has an `error` status; we stop early once nothing's left to retry,
        # or we've used up MAX_RETRY_PASSES.
        remaining = list(state.surahs)
        for pass_no in range(1, MAX_RETRY_PASSES + 1):
            if not remaining or token.cancelled:
                break
            state.retry_pass = pass_no
            if pass_no > 1:
                append_log(state, f"--- Retry pass {pass_no}/{MAX_RETRY_PASSES}: {len(remaining)} surah(s) "
                                  f"still failing → {remaining}")
            for surah_no in remaining:
                if token.cancelled:
                    append_log(state, "Job cancelled by user.")
                    state.status = "cancelled"
                    break
                label_one_surah(surah_no, model, api_key, quran, breaks, valid_ids, state, token,
                                persist=not compare_only)
                write_status(state)
            # Recompute the failures-list for the next pass.
            remaining = [s for s in remaining
                         if (state.results.get(str(s)) or {}).get("status") == "error"]
        if token.cancelled:
            state.status = "cancelled"
        elif remaining:
            # Some surahs still error'd after all retry passes — job is "done"
            # overall but with a degraded result; the UI shows the per-surah
            # errors. We don't escalate the whole job to 'error'.
            state.status = "done"
            append_log(state, f"Job finished with {len(remaining)} surah(s) still errored "
                              f"after {MAX_RETRY_PASSES} passes: {remaining}")
        else:
            state.status = "done"
    except Exception as e:
        state.status = "error"
        append_log(state, f"FATAL during run: {e}")
    finally:
        state.current_surah = None
        state.finished_at = time.strftime("%Y-%m-%dT%H:%M:%S")
        write_status(state)
        if compare_only:
            report_path = _write_compare_report(state)
            state.report_path = str(report_path.relative_to(REPO_ROOT))
            write_status(state)
            append_log(state, f"Saved comparison report: {state.report_path}")
        append_log(state,
            f"Job {state.status}. Totals: {state.tokens_in_total}+{state.tokens_out_total} tokens, "
            f"${state.cost_usd_total:.4f}"
        )
        _end_job_threadsafe()
        if on_complete:
            on_complete(state)
    return state


def run_job_in_background(surahs: list, model: str, api_key: str) -> str:
    """Spawn a daemon thread to run the job. Returns the job id."""
    if is_running():
        raise RuntimeError("A labeling run is already in progress.")
    token = CancellationToken()
    # We need the job_id up-front to return to the caller — derive same way as run_job.
    job_id = time.strftime("%Y%m%dT%H%M%S")

    def _wrapped():
        run_job(surahs, model, api_key)

    t = threading.Thread(target=_wrapped, name=f"labeler-{job_id}", daemon=True)
    t.start()
    return job_id


def run_compare_in_background(surahs: list, model: str, api_key: str) -> str:
    """Spawn a daemon thread for a no-write comparison run. Returns the job id."""
    if is_running():
        raise RuntimeError("A labeling run is already in progress.")
    job_id = time.strftime("%Y%m%dT%H%M%S")

    def _wrapped():
        run_job(surahs, model, api_key, compare_only=True)

    t = threading.Thread(target=_wrapped, name=f"labeler-compare-{job_id}", daemon=True)
    t.start()
    return job_id


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_surahs_arg(s: str) -> list:
    """'1,2,19' or '1-5' or 'all' or 'not-started'."""
    s = s.strip().lower()
    if s == "all":
        return list(range(1, 115))
    if s == "not-started":
        cov = compute_surah_coverage()
        return [n for n, info in cov.items() if info["status"] in ("not-started", "partial")]
    out = set()
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.update(range(int(a), int(b) + 1))
        else:
            out.add(int(part))
    return sorted(n for n in out if 1 <= n <= 114)


def main() -> int:
    p = argparse.ArgumentParser(description="Thematic Qur'an labeler (Anthropic Claude).")
    p.add_argument("--surahs", required=True,
                   help="Comma-separated list ('1,2,19'), range ('1-5'), 'all', or 'not-started'")
    p.add_argument("--model", default=DEFAULT_MODEL, choices=list(MODEL_PRICING),
                   help=f"Model name (default {DEFAULT_MODEL})")
    p.add_argument("--api-key", default=None,
                   help="Override API key (otherwise reads ANTHROPIC_API_KEY env / .env)")
    p.add_argument("--compare", action="store_true",
                   help="Run without writing assignments.json; compare model output against current labels.")
    args = p.parse_args()

    key = args.api_key or get_api_key()
    if not key:
        print("Error: ANTHROPIC_API_KEY not set. Add it to .env or pass --api-key.", file=sys.stderr)
        return 2

    surahs = _parse_surahs_arg(args.surahs)
    if not surahs:
        print("Error: no valid surah numbers parsed from --surahs", file=sys.stderr)
        return 2

    action = "Comparing" if args.compare else "Labeling"
    print(f"{action} {len(surahs)} surah(s) via {args.model}: {surahs}")
    state = run_job(surahs, args.model, key, compare_only=args.compare)
    print(f"\nFinal status: {state.status}")
    print(f"Tokens: {state.tokens_in_total}+{state.tokens_out_total}, cost: ${state.cost_usd_total:.4f}")
    if state.baseline_path:
        print(f"Baseline: {state.baseline_path}")
    if state.report_path:
        print(f"Report: {state.report_path}")
    return 0 if state.status == "done" else 1


if __name__ == "__main__":
    sys.exit(main())
