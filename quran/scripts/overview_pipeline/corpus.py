"""
Raw tafsir corpus — the durable, inspectable source layer.

Two-phase design: FETCH the raw tafsir once into a logical filesystem, then
COMPILE from it. Fetching every verse × every edition is slow and one-time;
caching it makes the batch build fast, gives real provenance (the raw source
snapshots the project philosophy calls "the permanent asset"), and lets us
recompile freely without re-hitting the API.

Layout under data/tafsir_raw/ :
  {edition_slug}/{NNN}.json   one file per edition per surah:
      { edition_slug, edition_id, language, surah, fetched_at,
        verses: { "112:1": "raw tafsir text", … } }
  _quran/{NNN}.json           Arabic + translation per verse for display.

`gather_section` returns exactly what the compilation needs, cache-first: it
reads the cache and (if allowed) fetches+caches any missing verse, so `build`
works whether or not you pre-ran `fetch`. Run standalone:

  python -m scripts.overview_pipeline.corpus fetch  [--surahs 78-114]   # populate
  python -m scripts.overview_pipeline.corpus status                     # coverage
"""

import argparse
import datetime
import json

from . import config, qf_client

RAW = config.DATA / "tafsir_raw"
QURAN_DIR = RAW / "_quran"


def _tafsir_file(slug, surah):
    return RAW / slug / f"{surah:03d}.json"


def _quran_file(surah):
    return QURAN_DIR / f"{surah:03d}.json"


def _load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def _save(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")


def _today():
    return config.TODAY or datetime.date.today().isoformat()


def _tafsir_range(plan, surah, start, end, allow_fetch):
    """Concatenated tafsir text for the range, cache-first. Fills+caches misses
    when allow_fetch. A verse with no tafsir is cached as '' so it is not refetched."""
    slug, eid = plan["fetch_edition_slug"], plan["fetch_edition_id"]
    doc = _load(_tafsir_file(slug, surah)) or {
        "edition_slug": slug, "edition_id": eid, "language": plan["fetch_language"],
        "surah": surah, "fetched_at": _today(), "verses": {},
    }
    changed, chunks = False, []
    for a in range(start, end + 1):
        vk = f"{surah}:{a}"
        if vk not in doc["verses"]:
            if not allow_fetch:
                continue
            doc["verses"][vk] = qf_client.fetch_tafsir_verse(eid, surah, a)
            changed = True
        if doc["verses"][vk]:
            chunks.append(f'[{vk}] {doc["verses"][vk]}')
    if changed:
        doc["fetched_at"] = _today()
        _save(_tafsir_file(slug, surah), doc)
    return "\n".join(chunks)


def _verses(surah, start, end, allow_fetch):
    doc = _load(_quran_file(surah)) or {"surah": surah, "verses": {}}
    changed, out = False, []
    for a in range(start, end + 1):
        vk = f"{surah}:{a}"
        if vk not in doc["verses"]:
            if not allow_fetch:
                out.append({"ayah": vk, "arabic": "", "translation": ""})
                continue
            doc["verses"][vk] = qf_client.fetch_verse_display(surah, a)
            changed = True
        d = doc["verses"][vk]
        out.append({"ayah": vk, "arabic": d.get("arabic", ""), "translation": d.get("translation", "")})
    if changed:
        _save(_quran_file(surah), doc)
    return out


def gather_section(surah, start, end, served_plan, allow_fetch=True):
    """Cache-backed drop-in for qf_client.gather_section — same return shape
    ({n: {text, language, translate, edition_slug, truncated, source_hash}}, verses),
    but served from data/tafsir_raw/ (fetching+caching misses when allowed)."""
    verses = _verses(surah, start, end, allow_fetch)
    raw = {}
    for p in served_plan:
        text = _tafsir_range(p, surah, start, end, allow_fetch)
        if not text:
            continue
        raw[p["n"]] = {
            "text": text, "language": p["fetch_language"], "translate": p["translate"],
            "edition_slug": p["fetch_edition_slug"], "truncated": False,
        }
    qf_client._apply_budget(raw)
    for s in raw.values():
        s["source_hash"] = qf_client.source_hash(s["text"])
    return verses, raw


# ---- CLI --------------------------------------------------------------------

def _parse_surahs(spec):
    if not spec:
        return list(range(1, 115))
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def _fetch_section(served, s, a, e, workers):
    """Populate one section's cache, fetching its editions CONCURRENTLY. Safe:
    each edition writes its own file (data/tafsir_raw/{slug}/{NNN}.json), and
    sections of one surah are processed by the caller in sequence, so no two
    threads touch the same file."""
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=workers) as ex:
        ex.submit(_verses, s, a, e, True)
        futs = [ex.submit(_tafsir_range, p, s, a, e, True) for p in served]
        got = sum(1 for f in futs if f.result())
    return got


def cmd_fetch(args):
    """Phase 1 — populate the raw corpus. Resumable: only missing verses are
    fetched, so stop and resume freely. Editions within a section are fetched in
    parallel (--workers); retry/backoff in qf_client handles any rate limiting."""
    from . import store
    config.TODAY = config.TODAY or datetime.date.today().isoformat()
    served, cov = qf_client.reconcile(config.fetch_plan())
    print(f"corpus fetch — {cov['independent_works']} works; languages {cov['languages_present']}; "
          f"{args.workers} workers", flush=True)
    surahs = _parse_surahs(args.surahs)
    sections = [(s, a, e) for s in surahs for (a, e) in store.surah_sections(s)]
    done = 0
    for i, (s, a, e) in enumerate(sections, 1):
        try:
            got = _fetch_section(served, s, a, e, args.workers)
            done += 1
            print(f"  [{i}/{len(sections)}] cached {s}:{a} ({got} voices)", flush=True)
        except Exception as ex:
            print(f"  [{i}/{len(sections)}] [err] {s}:{a} — {type(ex).__name__}: "
                  f"{str(ex)[:120]} (rerun to resume)", flush=True)
    print(f"\ncorpus populated for {done}/{len(sections)} sections → {RAW}", flush=True)


def cmd_status(args):
    """Coverage of the raw corpus: cached verses per edition."""
    if not RAW.exists():
        print("No corpus yet. Run: python -m scripts.overview_pipeline.corpus fetch")
        return
    print(f"corpus at {RAW}")
    for plan in config.fetch_plan():
        slug = plan["fetch_edition_slug"]
        cached = sum(
            len(_load(f)["verses"]) for f in sorted((RAW / slug).glob("*.json"))
        ) if (RAW / slug).exists() else 0
        print(f"  {slug:<32} {cached:>5} verses cached")


def main():
    ap = argparse.ArgumentParser(description="Raw tafsir corpus")
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch"); f.add_argument("--surahs", default=""); f.add_argument("--workers", type=int, default=8); f.set_defaults(fn=cmd_fetch)
    st = sub.add_parser("status"); st.set_defaults(fn=cmd_status)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
