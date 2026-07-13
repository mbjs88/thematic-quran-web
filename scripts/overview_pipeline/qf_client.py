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
import requests

from . import config

_token_cache = {"value": None, "exp": 0}


def _strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def _token():
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
    return {
        "x-auth-token": f"Bearer {_token()}",
        "x-client-id": config.QF_CLIENT_ID,
        "Accept": "application/json",
    }


def _get(path, params=None):
    url = f"{config.QF_API_BASE}{path}"
    r = requests.get(url, headers=_headers(), params=params or {}, timeout=60)
    r.raise_for_status()
    return r.json()


def resolve_edition_ids(editions):
    """Return editions with `id` filled in from the live tafsir resource list where
    an id is missing, matching on the `match` keywords. Logs anything unresolved."""
    listing = _get("/resources/tafsirs").get("tafsirs", [])
    def find(keys):
        for t in listing:
            hay = f'{t.get("slug","")} {t.get("name","")} {t.get("author_name","")}'.lower()
            if any(k in hay for k in keys):
                return t.get("id")
        return None
    out = []
    for e in editions:
        e = dict(e)
        if e.get("id") is None:
            e["id"] = find(e["match"])
        if e["id"] is None:
            print(f"  [warn] could not resolve tafsir id for {e['key']} ({e['label']}) — skipping")
        out.append(e)
    return out


def fetch_tafsir_range(tafsir_id, start, end, surah):
    """Concatenate a tafsir's text across a section's verses (plain text)."""
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


def fetch_verses(surah, start, end):
    """Arabic + a translation per ayah for display."""
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


def gather_section(surah, start, end, editions):
    """Everything the model needs for one section: verses + tafsir per edition."""
    verses = fetch_verses(surah, start, end)
    tafsir_by_edition = {}
    for e in editions:
        if e.get("id") is None:
            continue
        text = fetch_tafsir_range(e["id"], start, end, surah)
        if text:
            tafsir_by_edition[e["n"]] = text
    return verses, tafsir_by_edition
