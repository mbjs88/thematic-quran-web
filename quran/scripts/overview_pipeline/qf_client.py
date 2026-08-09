"""
Quran Foundation content-API client.

Pulls the raw tafsir the pipeline feeds to the model. Uses the OAuth2
client-credentials flow (QF_CLIENT_ID / QF_CLIENT_SECRET), resolves edition ids
from the live /resources/tafsirs list (so ids never go stale), and fetches
tafsir / Arabic / translation for a verse range.

NB: endpoint paths and header names follow the Quran Foundation API; confirm
against your account's API docs and adjust QF_API_BASE / QF_AUTH_URL in config
or the environment if they differ. Network calls are made only when you run this
on your machine with real credentials.
"""

import time
import html
import re
import hashlib

from . import config

# `requests` is imported lazily inside the network calls so that the pure-logic
# helpers (source_hash, reconcile with a supplied listing) work without it.


def source_hash(text):
    """Stable content hash of a fetched passage, for provenance/drift-auditing."""
    return "sha256:" + hashlib.sha256((text or "").encode("utf-8")).hexdigest()

_token_cache = {"value": None, "exp": 0}


def _strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def _token():
    import requests
    now = time.time()
    if _token_cache["value"] and now < _token_cache["exp"] - 30:
        return _token_cache["value"]
    resp = requests.post(
        config.QF_AUTH_URL,
        data={"grant_type": "client_credentials", "scope": "content"},
        auth=(config.QF_CLIENT_ID, config.QF_CLIENT_SECRET),
        timeout=30,
    )
    resp.raise_for_status()
    j = resp.json()
    _token_cache["value"] = j["access_token"]
    _token_cache["exp"] = now + int(j.get("expires_in", 3600))
    return _token_cache["value"]


def _headers():
    # QF content API wants the RAW access token in x-auth-token (no "Bearer "
    # prefix) plus x-client-id — matches the site's functions/_shared/qfApiClient.js.
    return {
        "x-auth-token": _token(),
        "x-client-id": config.QF_CLIENT_ID,
        "Accept": "application/json",
    }


_TRANSIENT = {429, 500, 502, 503, 504}


def _get(path, params=None, retries=4):
    """GET with retry+backoff on transient errors (429/5xx) and network blips, so
    a long unattended build never dies or silently drops a voice on a hiccup.
    Non-transient errors (401/404/…) raise immediately as before."""
    import requests
    url = f"{config.QF_API_BASE}{path}"
    for attempt in range(retries + 1):
        try:
            r = requests.get(url, headers=_headers(), params=params or {}, timeout=60)
            if r.status_code in _TRANSIENT and attempt < retries:
                ra = r.headers.get("Retry-After")
                wait = int(ra) if (ra and ra.isdigit()) else min(2 ** attempt, 30)
                time.sleep(min(wait, 60))
                continue
            r.raise_for_status()
            return r.json()
        except requests.HTTPError:
            raise                                  # 4xx (except 429) — don't retry
        except requests.RequestException:
            if attempt < retries:
                time.sleep(min(2 ** attempt, 30))
                continue
            raise


def list_tafsirs():
    """The live tafsir catalogue the API actually serves (list of dicts with
    id/slug/name/language_name/author_name). This is ground truth — the pipeline
    may only cite editions that appear here."""
    return _get("/resources/tafsirs").get("tafsirs", [])


def reconcile(plan, live=None):
    """
    Narrow a catalogue fetch-plan (from catalogue.fetch_plan) to what the API
    actually serves right now. Returns (served_plan, coverage).

    A planned work is kept only if its `fetch_edition_id` is in the live listing.
    Anything absent is dropped and reported — never silently assumed present.
    This is the run-time guard against citing an edition that was not fetched.
    """
    live = live if live is not None else list_tafsirs()
    live_ids = {t.get("id") for t in live}
    live_slugs = {t.get("slug") for t in live}

    served, absent = [], []
    for p in plan:
        ok = p["fetch_edition_id"] in live_ids or p["fetch_edition_slug"] in live_slugs
        (served if ok else absent).append(p)
        if not ok:
            print(f"  [warn] {p['fetch_edition_slug']} ({p['label']}) not served by API — dropping")

    langs_present = sorted({p["fetch_language"] for p in served})
    langs_planned = sorted({p["fetch_language"] for p in plan})
    coverage = {
        "editions_present": [p["fetch_edition_slug"] for p in served],
        "editions_absent": [p["fetch_edition_slug"] for p in absent],
        "independent_works": len(served),
        "languages_present": langs_present,
        "languages_absent": sorted(set(langs_planned) - set(langs_present)),
    }
    return served, coverage


def fetch_tafsir_range(tafsir_id, start, end, surah):
    """Concatenate a tafsir's text across a section's verses (plain text)."""
    import requests
    chunks = []
    for a in range(start, end + 1):
        vk = f"{surah}:{a}"
        try:
            j = _get(f"/tafsirs/{tafsir_id}/by_ayah/{vk}")
        except requests.HTTPError:
            continue
        t = (j.get("tafsir") or {}).get("text") or j.get("text") or ""
        t = _strip_html(t)
        if t:
            chunks.append(f"[{vk}] {t}")
    return "\n".join(chunks)


def fetch_tafsir_verse(tafsir_id, surah, ayah):
    """Raw tafsir text for a single verse (plain text, no marker). '' if none."""
    import requests
    vk = f"{surah}:{ayah}"
    try:
        j = _get(f"/tafsirs/{tafsir_id}/by_ayah/{vk}")
    except requests.HTTPError:
        return ""
    t = (j.get("tafsir") or {}).get("text") or j.get("text") or ""
    return _strip_html(t)


def fetch_verse_display(surah, ayah):
    """Arabic + a translation for one verse: {'arabic':…, 'translation':…}."""
    import requests
    vk = f"{surah}:{ayah}"
    arabic, tr = "", ""
    try:
        q = _get("/quran/verses/uthmani", {"verse_key": vk})
        vs = q.get("verses") or []
        arabic = vs[0].get("text_uthmani", "") if vs else ""
    except requests.HTTPError:
        pass
    try:
        t = _get(f"/quran/translations/{config.TRANSLATION_EDITION_ID}", {"verse_key": vk})
        ts = t.get("translations") or []
        tr = _strip_html(ts[0].get("text", "")) if ts else ""
    except requests.HTTPError:
        pass
    return {"arabic": arabic, "translation": tr}


def fetch_verses(surah, start, end):
    """Arabic + a translation per ayah for display."""
    import requests
    verses = []
    for a in range(start, end + 1):
        vk = f"{surah}:{a}"
        arabic, tr = "", ""
        try:
            q = _get("/quran/verses/uthmani", {"verse_key": vk})
            vs = q.get("verses") or []
            arabic = vs[0].get("text_uthmani", "") if vs else ""
        except requests.HTTPError:
            pass
        try:
            t = _get(f"/quran/translations/{config.TRANSLATION_EDITION_ID}", {"verse_key": vk})
            ts = t.get("translations") or []
            tr = _strip_html(ts[0].get("text", "")) if ts else ""
        except requests.HTTPError:
            pass
        verses.append({"ayah": vk, "arabic": arabic, "translation": tr})
    return verses


_TRUNCATION_MARK = "\n[… truncated for length …]"


def _apply_budget(raw):
    """Trim in place so a section never exceeds the context window. First cap each
    edition to PER_EDITION_CHAR_CAP, then, if the total still exceeds
    SECTION_CHAR_BUDGET, repeatedly halve the current largest. Marks trimmed
    sources so the truncation is disclosed, not hidden."""
    for s in raw.values():
        if len(s["text"]) > config.PER_EDITION_CHAR_CAP:
            s["text"] = s["text"][: config.PER_EDITION_CHAR_CAP] + _TRUNCATION_MARK
            s["truncated"] = True
    guard = 0
    while sum(len(s["text"]) for s in raw.values()) > config.SECTION_CHAR_BUDGET and guard < 200:
        guard += 1
        biggest = max(raw.values(), key=lambda s: len(s["text"]))
        newlen = max(2000, len(biggest["text"]) // 2)
        biggest["text"] = biggest["text"][:newlen] + _TRUNCATION_MARK
        biggest["truncated"] = True


def gather_section(surah, start, end, served_plan):
    """
    Everything the model needs for one section, per WORK (one voice each):
      { n: {text, language, translate, edition_slug, truncated, source_hash} }
    plus the verses. Only works that returned real text are included — a work
    with no text for this section simply does not appear (and is not cited).
    Text is budget-trimmed BEFORE hashing, so source_hash reflects what the model
    actually saw.
    """
    verses = fetch_verses(surah, start, end)
    raw = {}
    for p in served_plan:
        text = fetch_tafsir_range(p["fetch_edition_id"], start, end, surah)
        if not text:
            continue
        raw[p["n"]] = {
            "text": text,
            "language": p["fetch_language"],
            "translate": p["translate"],
            "edition_slug": p["fetch_edition_slug"],
            "truncated": False,
        }
    _apply_budget(raw)
    for s in raw.values():
        s["source_hash"] = source_hash(s["text"])
    return verses, raw
