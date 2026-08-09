"""
Batch-API path — build, submit, collect.

  python -m scripts.overview_pipeline.batch build   [--surahs 78-114] [--limit N]
  python -m scripts.overview_pipeline.batch submit   _work/batch_input.jsonl
  python -m scripts.overview_pipeline.batch collect  <batch_id>

Each request is one section (custom_id = "s{surah}_a{start}"). The batch runs
asynchronously at 50% cost; results are matched back by custom_id and merged into
the store, after which scripts/overview_progress.py is re-run to refresh the
dashboard. Re-running build only ever includes sections not already compiled.
"""

import argparse
import datetime
import json
import re
import subprocess
import sys

from . import config, prompt, qf_client, store, corpus


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


def _custom_id(surah, start):
    return f"s{surah}_a{start}"


def _decode_custom_id(cid):
    m = re.match(r"s(\d+)_a(\d+)", cid)
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


# ------------------------------------------------------------- preflight -------
def cmd_preflight(args):
    """Pre-handoff sanity check — run this before the big unattended batch.
    Verifies creds, reconciles the catalogue against the live API, counts the
    work, samples one section for size, and projects the full-run cost."""
    problems = []
    print("== Overview batch preflight ==")
    print(f"model: {config.MODEL}   max_tokens: {config.MAX_TOKENS}")

    if not config.QF_CLIENT_ID or not config.QF_CLIENT_SECRET:
        problems.append("QF_CLIENT_ID / QF_CLIENT_SECRET not set (needed to fetch tafsir)")
    if not config.ANTHROPIC_API_KEY:
        problems.append("ANTHROPIC_API_KEY not set (needed to submit/collect the batch)")

    try:
        live = qf_client.list_tafsirs()
        served, cov = qf_client.reconcile(config.fetch_plan(), live=live)
        print(f"catalogue: {cov['independent_works']} works served; "
              f"languages {cov['languages_present']}; absent {cov['languages_absent'] or 'none'}")
        if cov["editions_absent"]:
            problems.append(f"planned works NOT served: {cov['editions_absent']}")
        from . import catalogue
        known = {e["slug"] for e in catalogue.load()["editions"]}
        extra = [t.get("slug") for t in live if t.get("slug") not in known]
        if extra:
            print(f"note: API serves {len(extra)} tafsir(s) not in commentators.json "
                  f"(add deliberately if wanted): {extra}")
    except Exception as ex:
        problems.append(f"live catalogue check failed: {type(ex).__name__}: {str(ex)[:150]}")
        served = None

    pending = store.pending_sections(_parse_surahs(args.surahs))
    print(f"pending sections: {len(pending)} / 1228")

    if served and pending:
        s, a, e = pending[0]
        try:
            _, sources = corpus.gather_section(s, a, e, served)
            chars = sum(len(v["text"]) for v in sources.values())
            in_tok = chars / 4.0
            p = config.PRICE.get(config.MODEL, config.PRICE["claude-sonnet-5"])
            per = (in_tok / 1e6 * p["in"] + 4000 / 1e6 * p["out"]) * config.BATCH_DISCOUNT
            print(f"sample {s}:{a}: {len(sources)} voices, ~{in_tok/1000:.0f}k input tokens "
                  f"→ ~${per:.3f}/section at batch rate")
            print(f"very rough full-run projection: ~${per * len(pending):,.0f} "
                  f"(the real number prints at `build`, computed from all fetched sections)")
        except Exception as ex:
            problems.append(f"sample fetch failed: {type(ex).__name__}: {str(ex)[:150]}")

    print()
    if problems:
        print("PREFLIGHT PROBLEMS:")
        for p in problems:
            print(f"  ✗ {p}")
    else:
        print("Preflight OK — ready to build/submit.")


# ---------------------------------------------------------------- build --------
def cmd_build(args):
    # Ground the run: narrow the catalogue plan to what the API actually serves.
    served_plan, coverage = qf_client.reconcile(config.fetch_plan())
    print(f"  catalogue → {coverage['independent_works']} works served; "
          f"languages present {coverage['languages_present']}, absent {coverage['languages_absent']}")
    surahs = _parse_surahs(args.surahs)
    pending = list(store.pending_sections(surahs))
    if args.limit:
        pending = pending[: args.limit]

    out_path = config.WORK / "batch_input.jsonl"
    meta_path = config.WORK / "section_meta.json"
    # Merge into any existing meta so successive builds (e.g. a retry of a slice)
    # don't orphan the earlier sections that collect will still need.
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    n = failed = 0
    with out_path.open("w", encoding="utf-8") as f:
        for surah, start, end in pending:
            try:
                verses, sources = corpus.gather_section(surah, start, end, served_plan)
            except Exception as ex:
                print(f"  [fetch-err] {surah}:{start} — {type(ex).__name__}: {str(ex)[:120]}")
                failed += 1
                continue
            if not sources:
                print(f"  [skip] {surah}:{start} — no tafsir fetched")
                continue
            user = prompt.build_user_message(surah, start, end, verses, sources)
            cid = _custom_id(surah, start)
            req = {
                "custom_id": cid,
                "params": {
                    "model": config.MODEL,
                    "max_tokens": config.MAX_TOKENS,
                    # cache the (identical) system prompt so it is billed once, not per
                    # request — the tafsir content in the user message stays unique.
                    "system": [{"type": "text", "text": prompt.SYSTEM,
                                "cache_control": {"type": "ephemeral"}}],
                    "messages": [{"role": "user", "content": user}],
                },
            }
            f.write(json.dumps(req, ensure_ascii=False) + "\n")
            # keep just what collect needs (not the raw text): n → language/hash/trim
            meta[cid] = {
                "surah": surah, "start": start, "end": end,
                "coverage": coverage,
                "sources_meta": {
                    str(k): {"language": v["language"], "source_hash": v["source_hash"],
                             "edition_slug": v["edition_slug"], "translate": v["translate"],
                             "truncated": v.get("truncated", False)}
                    for k, v in sources.items()
                },
            }
            n += 1
            trim = sum(1 for v in sources.values() if v.get("truncated"))
            print(f"  [built] {surah}:{start} ({len(sources)} voices"
                  + (f", {trim} trimmed" if trim else "") + ")")
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {n} requests to {out_path} (+ section_meta.json)"
          + (f"; {failed} sections failed to fetch (retry build to pick them up)" if failed else ""))
    _estimate_cost(out_path)


def _count_input_tokens(reqs):
    """Accurate input-token total: count_tokens on a sample of requests (extrapolated
    to the full set), or a calibrated char-ratio fallback if the API/key is unavailable.
    The old chars/4 rule under-counted this Arabic-heavy corpus by ~2.3x."""
    import random
    n = len(reqs)
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        sample = reqs if n <= 24 else random.sample(reqs, 24)
        tot = sum(
            client.messages.count_tokens(model=r["params"]["model"],
                                         system=r["params"]["system"],
                                         messages=r["params"]["messages"]).input_tokens
            for r in sample
        )
        return int(tot / len(sample) * n), f"counted (sampled {len(sample)}/{n})"
    except Exception:
        chars = sum(len(json.dumps(r["params"], ensure_ascii=False)) for r in reqs)
        return int(chars / config.CHARS_PER_TOKEN), "estimated (char-ratio fallback)"


def _estimate_cost(jsonl_path):
    reqs = [json.loads(l) for l in jsonl_path.read_text(encoding="utf-8").splitlines()]
    n = len(reqs)
    if not n:
        print("No requests to estimate.")
        return
    in_tok, how = _count_input_tokens(reqs)
    out_tok = int(in_tok * config.OUTPUT_INPUT_RATIO)
    p = config.PRICE.get(config.MODEL, config.PRICE["claude-opus-4-8"])
    d = config.BATCH_DISCOUNT
    in_cost, out_cost = in_tok / 1e6 * p["in"] * d, out_tok / 1e6 * p["out"] * d
    print(f"Estimated batch cost — {config.MODEL}, ${p['in']}/{p['out']} per M × {d} batch:")
    print(f"  input : ~{in_tok/1e6:.2f}M tok  [{how}]  → ${in_cost:,.2f}")
    print(f"  output: ~{out_tok/1e6:.2f}M tok  [~{config.OUTPUT_INPUT_RATIO:.0%} of input, from real runs]  → ${out_cost:,.2f}")
    print(f"  TOTAL : ~${in_cost + out_cost:,.2f}   ({n} sections; output scales with section density)")


# --------------------------------------------------------------- submit --------
def cmd_submit(args):
    import anthropic  # pip install anthropic
    from pathlib import Path
    # Resolve the input file robustly: use the given path if it exists, else fall
    # back to the canonical _work/ location where `build` writes it.
    fp = Path(args.file)
    if not fp.exists():
        fp = config.WORK / fp.name
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    requests = [json.loads(l) for l in open(fp, encoding="utf-8")]
    batch = client.messages.batches.create(requests=requests)
    (config.WORK / "last_batch_id.txt").write_text(batch.id)
    print(f"Submitted batch {batch.id} — {len(requests)} requests. Status: {batch.processing_status}")
    print("Poll with:  python -m scripts.overview_pipeline.status batch")


# -------------------------------------------------------------- collect --------
def cmd_collect(args):
    import anthropic
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    batch_id = args.batch_id or (config.WORK / "last_batch_id.txt").read_text().strip()
    b = client.messages.batches.retrieve(batch_id)
    if b.processing_status != "ended":
        print(f"Batch {batch_id} not finished (status: {b.processing_status}). Try later.")
        return

    config.TODAY = config.TODAY or datetime.date.today().isoformat()
    meta = json.loads((config.WORK / "section_meta.json").read_text(encoding="utf-8"))
    failures = []                                  # [{custom_id, reason}] for retry
    def fail(cid, reason):
        failures.append({"custom_id": cid, "reason": reason})

    ok = err = skipped = 0
    for result in client.messages.batches.results(batch_id):
        cid = result.custom_id
        surah, start = _decode_custom_id(cid)
        if result.result.type != "succeeded":
            print(f"  [err] {cid}: {result.result.type}")
            fail(cid, f"result:{result.result.type}"); err += 1
            continue
        msg = result.result.message
        stop = getattr(msg, "stop_reason", None)
        text = "".join(blk.text for blk in msg.content if blk.type == "text")
        try:
            obj = json.loads(_json_only(text))
        except Exception as ex:
            hint = " (hit max_tokens — output truncated; raise OVERVIEW_MAX_TOKENS)" if stop == "max_tokens" else ""
            print(f"  [parse-err] {cid}: {ex}{hint}")
            fail(cid, f"parse:{stop or ex}"); err += 1
            continue

        m = meta.get(cid)
        if not m:
            print(f"  [err] {cid}: no section_meta (rebuild the batch)")
            fail(cid, "no-section-meta"); err += 1
            continue
        # rebuild the {n: {...}} sources map collect needs from the sidecar
        sources = {int(k): v for k, v in m["sources_meta"].items()}
        end = m["end"]

        check = store.check_section(obj, sources)
        if check["errors"]:
            print(f"  [FIDELITY-FAIL] {cid}: {check['errors']} — not saved")
            fail(cid, "fidelity:" + "; ".join(check["errors"])[:200]); skipped += 1
            continue
        for w in check["warnings"]:
            print(f"     [warn] {cid}: {w}")
        enriched = store.enrich_claims(obj.get("claims", []), surah, start, sources,
                                       config.MODEL, prompt.PROMPT_VERSION)
        schema_errs = store.validate_claims(enriched)
        if schema_errs:
            print(f"  [SCHEMA-FAIL] {cid}: {schema_errs[:3]} — not saved")
            fail(cid, "schema:" + "; ".join(schema_errs)[:200]); skipped += 1
            continue
        store.write_section(surah, start, end, obj, enriched, sources, m["coverage"],
                            config.MODEL, prompt.PROMPT_VERSION)
        ok += 1
        print(f"  [saved] {surah}:{start} ({len(enriched)} claims)")

    if failures:
        fp = config.WORK / "failures.jsonl"
        fp.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in failures), encoding="utf-8")
        print(f"\n{len(failures)} sections did not save — written to {fp}")
        print("  Retry: `batch build` (recompiles only pending sections) → submit → collect.")
    print(f"\nSaved {ok} sections, {skipped} rejected (fidelity/schema), {err} errors.")
    _refresh_dashboard()


def _json_only(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n|\n```$", "", text.strip())
    a, b = text.find("{"), text.rfind("}")
    return text[a: b + 1] if a >= 0 else text


def _refresh_dashboard():
    subprocess.run([sys.executable, str(config.ROOT / "scripts" / "overview_progress.py")])


def main():
    ap = argparse.ArgumentParser(description="Overview batch pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)
    pf = sub.add_parser("preflight"); pf.add_argument("--surahs", default=""); pf.set_defaults(fn=cmd_preflight)
    b = sub.add_parser("build"); b.add_argument("--surahs", default=""); b.add_argument("--limit", type=int, default=0); b.set_defaults(fn=cmd_build)
    s = sub.add_parser("submit"); s.add_argument("file"); s.set_defaults(fn=cmd_submit)
    c = sub.add_parser("collect"); c.add_argument("batch_id", nargs="?"); c.set_defaults(fn=cmd_collect)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
