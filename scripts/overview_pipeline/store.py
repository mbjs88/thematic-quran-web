"""
Section bookkeeping + the JSON store.

theme_breaks.json is the source of truth for how many sections a surah has.
A section is compiled once and written into data/tafsir_overview/NNN.json.
Everything here is idempotent: re-running never recompiles what already exists.
"""

import json
from . import config

REFERENCES = [
    {"n": e["n"], "edition": e["key"], "label": e["label"], "note": e["note"]}
    for e in config.EDITIONS
]


def theme_breaks():
    return json.loads(config.THEME_BREAKS.read_text(encoding="utf-8"))


def surah_sections(surah):
    """Return [(start, end), …] for a surah, end = next start - 1, last = last verse."""
    starts = [int(x) for x in theme_breaks().get(str(surah), [])]
    if not starts:
        return []
    last = config.AYAH_COUNTS.get(surah)
    out = []
    for i, s in enumerate(starts):
        end = (starts[i + 1] - 1) if i + 1 < len(starts) else last
        out.append((s, end))
    return out


def store_path(surah):
    return config.STORE_DIR / f"{surah:03d}.json"


def load_store(surah):
    p = store_path(surah)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None


def compiled_section_starts(surah):
    doc = load_store(surah)
    if not doc:
        return set()
    return {int(k.split(":")[1]) for k in doc.get("sections", {})}


def pending_sections(surahs=range(1, 115)):
    """List of (surah, start, end) not yet in the store."""
    out = []
    for s in surahs:
        done = compiled_section_starts(s)
        for start, end in surah_sections(s):
            if start not in done:
                out.append((s, start, end))
    return out


def write_section(surah, section_start, section_obj, surah_name="", verse_last=None):
    """Merge one compiled section into NNN.json, creating the file if needed."""
    doc = load_store(surah) or {
        "surah": surah,
        "name": surah_name,
        "commentators_studied": None,
        "compiled_at": config.TODAY,
        "modern_lens_framing": config.MODERN_LENS_FRAMING,
        "references": REFERENCES,
        "sections": {},
    }
    doc["sections"][f"{surah}:{section_start}"] = section_obj
    # commentators_studied = how many references were actually available this run
    if section_obj.get("_commentators"):
        doc["commentators_studied"] = section_obj.pop("_commentators")
    store_path(surah).parent.mkdir(parents=True, exist_ok=True)
    store_path(surah).write_text(
        json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
