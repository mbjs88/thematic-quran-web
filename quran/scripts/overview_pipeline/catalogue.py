"""
Grounded edition/works catalogue.

Single source of truth for *which* commentaries the pipeline may use, loaded from
`data/commentators.json`. This replaces the old hand-written `config.EDITIONS`
list — the mechanism that let phantom editions (al-Kashshāf, al-Jalālayn, Naẓm
al-Durar) enter from memory. Here, nothing exists unless it is in the catalogue,
and at run time the catalogue is further narrowed to what the API actually serves
(see qf_client.reconcile).

Key ideas encoded here:
  * A **work** is one scholarly voice. Its editions across languages (Ibn Kathīr
    in ar/en/ur/bn) are the SAME voice — one reference number, never counted as
    independent corroboration (spec §2.7).
  * Reference numbers `n` are stable and chronological (earliest author first),
    so `^[1]` is always al-Ṭabarī.
  * Each work carries an English plan: use an existing English edition, or
    translate a chosen edition into English (spec §4 step 5).

Pure data logic — no network, no config import (config imports THIS).
"""

import json
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
CATALOGUE_PATH = _ROOT / "data" / "commentators.json"

_INF = 10_000  # sort key for undated (committee/contemporary) authors — last


def load():
    """Raw commentators.json as a dict."""
    return json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))


def _earliest_death(author_ids, authors_by_id):
    deaths = [
        authors_by_id[a].get("death_ce")
        for a in author_ids
        if authors_by_id.get(a) and authors_by_id[a].get("death_ce") is not None
    ]
    return min(deaths) if deaths else _INF


def works(include_excluded=False):
    """
    Ordered list of work dicts, each enriched with a stable reference `n`,
    resolved authors, chronology, English plan, and a display label.

    `include_excluded=False` drops works flagged `exclude_recommended`
    (currently Fatḥ al-Majīd — a Kitāb al-Tawḥīd commentary, not a Qurʾān tafsir).
    """
    doc = load()
    authors_by_id = {a["id"]: a for a in doc["authors"]}
    editions_by_id = {e["edition_id"]: e for e in doc["editions"]}

    selected = [
        w for w in doc["works"]
        if include_excluded or not w.get("exclude_recommended")
    ]

    # Stable, meaningful order: earliest author death first, then work_id.
    def sort_key(w):
        return (_earliest_death(w["author_ids"], authors_by_id), w["work_id"])

    selected = sorted(selected, key=sort_key)

    out = []
    for i, w in enumerate(selected, start=1):
        authors = [authors_by_id[a] for a in w["author_ids"] if a in authors_by_id]
        primary = authors[0] if authors else None
        out.append({
            "n": i,
            "work_id": w["work_id"],
            "title": w["title"],
            "label": w["title"],  # attribution shown via author fields below
            "author_ids": w["author_ids"],
            "author": primary["name_translit"] if primary else w["title"],
            "short": (primary.get("short") or primary["name_translit"]) if primary else w["title"],
            "authors": authors,
            "original_language": w["original_language"],
            "earliest_death_ce": _earliest_death(w["author_ids"], authors_by_id),
            "english_source": w["english_source"],
            "editions": [editions_by_id[eid] for eid in w["editions"] if eid in editions_by_id],
            "note": w.get("note", ""),
            "exclude_recommended": bool(w.get("exclude_recommended")),
        })
    return out


def references(include_excluded=False):
    """Document-level reference template. A surah's store keeps only the subset
    actually fetched (store.py filters), but the `n`→work mapping is global."""
    return [
        {
            "n": w["n"],
            "work_id": w["work_id"],
            "label": w["label"],
            "author_id": w["author_ids"][0] if w["author_ids"] else None,
            "author": w["author"],
            "source_language": w["original_language"],
            "note": w["note"],
        }
        for w in works(include_excluded)
    ]


def fetch_plan(include_excluded=False):
    """
    Per work, what to fetch and whether to translate — the input to gathering.

    - use_english_edition  → fetch the English edition, translate=False.
    - translate            → fetch the chosen source edition, translate=True.
    Same-work editions are represented by ONE plan entry (one voice).
    """
    plan = []
    for w in works(include_excluded):
        es = w["english_source"]
        plan.append({
            "n": w["n"],
            "work_id": w["work_id"],
            "label": w["label"],
            "author_id": w["author_ids"][0] if w["author_ids"] else None,
            "fetch_edition_id": es["edition_id"],
            "fetch_edition_slug": es["edition_slug"],
            "fetch_language": es["from_language"],
            "translate": bool(es.get("translate")),
            "strategy": es["strategy"],
        })
    return plan


def languages(include_excluded=False):
    """All source languages present across the catalogue's works."""
    langs = []
    for w in works(include_excluded):
        for e in w["editions"]:
            if e["edition_language"] not in langs:
                langs.append(e["edition_language"])
    return langs


def dependence_pairs(include_excluded=False):
    """
    (earlier_work, later_work) pairs where the later author lived well after the
    earlier one — a hint that apparent agreement may be inherited, not independent
    (spec §2.7). This is a heuristic *flag for attention*, not proof of copying.
    """
    ws = [w for w in works(include_excluded) if w["earliest_death_ce"] < _INF]
    pairs = []
    for a in ws:
        for b in ws:
            if a["earliest_death_ce"] + 100 <= b["earliest_death_ce"]:
                pairs.append((a["work_id"], b["work_id"]))
    return pairs
