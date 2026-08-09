"""
Section bookkeeping + the JSON store (v2, grounded rebuild).

theme_breaks.json is the source of truth for how many sections a surah has.
A section is compiled once and written into data/tafsir_overview/NNN.json.
Everything here is idempotent: re-running never recompiles what already exists.

v2 changes vs the pilot store:
  * `references` are the works ACTUALLY fetched for the surah — never a static
    list (that was the phantom-edition leak).
  * a `coverage` block (languages present/absent, independent works) and a
    `pipeline_provenance` block (model, prompt version, theme_breaks hash).
  * each section stores its structured `claims` (the durable asset), the essay
    derived from them, per-source hashes, and review `flags`.
  * `check_section` enforces fidelity: nothing may cite a source that was not
    fetched, and the essay may not out-run the claims.
"""

import json
import hashlib
from datetime import date

from . import config, catalogue, _jsonschema


# ---- section bookkeeping (unchanged) ----------------------------------------

def theme_breaks():
    return json.loads(config.THEME_BREAKS.read_text(encoding="utf-8"))


def theme_breaks_version():
    raw = config.THEME_BREAKS.read_bytes()
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def surah_sections(surah):
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
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def compiled_section_starts(surah):
    doc = load_store(surah)
    return {int(k.split(":")[1]) for k in doc.get("sections", {})} if doc else set()


def pending_sections(surahs=range(1, 115)):
    out = []
    for s in surahs:
        done = compiled_section_starts(s)
        for start, end in surah_sections(s):
            if start not in done:
                out.append((s, start, end))
    return out


# ---- claim enrichment + validation ------------------------------------------

_CLAIM_SCHEMA = json.loads(config.CLAIM_SCHEMA.read_text(encoding="utf-8"))


def _works_by_n():
    return {w["n"]: w for w in config.works()}


def _as_int(n):
    """Reference numbers may arrive from the model as int or str ('1'); normalise."""
    try:
        return int(n)
    except (TypeError, ValueError):
        return None


def enrich_claims(model_claims, surah, start, sources, model, prompt_version):
    """Turn the model's claim content into full extracted_claim records: add id /
    section_ref / provenance, and resolve each source `n` to its edition + author."""
    wbn = _works_by_n()
    section_ref = f"{surah}:{start}"
    today = config.TODAY or date.today().isoformat()
    out = []
    for i, c in enumerate(model_claims or [], start=1):
        rec = {
            "id": f"{section_ref}#c{i}",
            "section_ref": section_ref,
            "attaches_to": c.get("attaches_to") or section_ref,
            "text": c.get("text", ""),
            "claim_type": c.get("claim_type", "other"),
            "sources": [],
            "provenance": {"model": model, "prompt_version": prompt_version, "extracted_at": today},
        }
        if c.get("basis"):
            rec["basis"] = c["basis"]
        if c.get("original_terms"):
            rec["original_terms"] = c["original_terms"]
        if c.get("report") and c["report"].get("grade"):
            rec["report"] = {"grade": c["report"]["grade"]}
            if c["report"].get("graded_by"):
                rec["report"]["graded_by"] = c["report"]["graded_by"]
        if c.get("theological_school"):
            rec["theological_school"] = c["theological_school"]
        if c.get("madhhab"):
            rec["madhhab"] = c["madhhab"]
        for s in c.get("sources", []):
            n = _as_int(s.get("n"))
            w = wbn.get(n)
            src = {
                "edition_id": (w["english_source"]["edition_slug"] if w else str(s.get("n"))),
                "stance": s.get("stance", "relay"),
            }
            if w:
                src["author_id"] = w["author_ids"][0] if w["author_ids"] else None
            lang = sources[n]["language"] if n in sources else None
            if lang:
                src["source_language"] = lang
                # confidence set deterministically from language (the model no longer
                # emits it — saves tokens): English = n/a, low-resource = medium, else high.
                src["translation_confidence"] = (
                    "not_applicable" if lang == "en"
                    else "medium" if lang in ("bn", "ku") else "high")
            rec["sources"].append(src)
        out.append(rec)
    return out


def validate_claims(enriched):
    """Schema-validate each enriched claim; return a flat list of errors."""
    errors = []
    for c in enriched:
        for e in _jsonschema.validate(c, _CLAIM_SCHEMA):
            errors.append(f"{c.get('id','?')}{e}")
    return errors


def check_section(model_out, sources):
    """
    Fidelity / grounding gate. `sources` is the fetched {n: {...}} for the section.
    Hard errors block the write (a citation to something not fetched); warnings are
    logged. This is the automated half of 'faithfully reflect the sources'.
    """
    fetched = {int(k) for k in sources}
    errors, warnings = [], []

    claim_ns = set()
    for c in model_out.get("claims", []):
        for s in c.get("sources", []):
            n = _as_int(s.get("n"))
            claim_ns.add(n)
            if n not in fetched:
                errors.append(f"claim cites source [{s.get('n')}] that was not fetched for this section")
        basis = c.get("basis")
        if basis == "narration" and not (c.get("report") or {}).get("grade"):
            warnings.append(f"narration-based claim has no report grade: {c.get('text','')[:60]}…")

    for raw in model_out.get("sources_used", []):
        n = _as_int(raw)
        if n not in fetched:
            errors.append(f"essay cites source [{raw}] that was not fetched")
        elif n not in claim_ns:
            warnings.append(f"essay cites [{raw}] but no claim records it")

    if not model_out.get("claims"):
        warnings.append("section produced no claims")
    return {"errors": errors, "warnings": warnings}


# ---- writing the store ------------------------------------------------------

def _reference_for(n):
    for r in catalogue.references():
        if r["n"] == n:
            return r
    return {"n": n, "label": f"[{n}]"}


def write_section(surah, section_start, section_end, model_out, enriched_claims,
                  sources, coverage, model, prompt_version, surah_name=""):
    """Merge one compiled section (v2) into NNN.json, creating the file if needed."""
    doc = load_store(surah) or {
        "surah": surah,
        "name": surah_name,
        "coverage": coverage,
        "pipeline_provenance": {
            "model": model,
            "prompt_version": prompt_version,
            "theme_breaks_version": theme_breaks_version(),
            "compiled_at": config.TODAY or date.today().isoformat(),
        },
        "modern_lens_framing": config.MODERN_LENS_FRAMING,
        "references": [],
        "sections": {},
    }
    doc["coverage"] = coverage  # keep the surah-level coverage current

    # references = union of works actually fetched across this surah's sections
    have = {r["n"] for r in doc["references"]}
    for n in sorted(sources):
        if n not in have:
            doc["references"].append(_reference_for(n))
            have.add(n)
    doc["references"].sort(key=lambda r: r["n"])

    section = {
        "verse_range": f"{section_start}-{section_end}",
        "title": model_out.get("title", ""),
        "in_short": model_out.get("in_short", ""),
        "claims": enriched_claims,
        "essay_html": model_out.get("essay_html", ""),
        "sources_used": model_out.get("sources_used", []),
        "source_hashes": {str(n): sources[n]["source_hash"] for n in sorted(sources)},
        "flags": model_out.get("flags", {}),
        "compiled_at": config.TODAY or date.today().isoformat(),
    }
    # disclose any voices whose source text was trimmed to fit the context window
    trimmed = [n for n in sorted(sources) if sources[n].get("truncated")]
    if trimmed:
        section["truncated_sources"] = trimmed
    if model_out.get("modern_lens"):
        section["modern_lens"] = model_out["modern_lens"]

    doc["sections"][f"{surah}:{section_start}"] = section
    store_path(surah).parent.mkdir(parents=True, exist_ok=True)
    store_path(surah).write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    return doc
