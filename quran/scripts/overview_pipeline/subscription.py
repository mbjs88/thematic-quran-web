"""
Subscription path — compile via Claude Code headless, billed to your Max plan
instead of the API.

  python -m scripts.overview_pipeline.subscription run [--surahs 78-114] [--limit N]

Same grounded flow as the batch path: the pipeline fetches the tafsir (qf_client),
narrowed to what the API serves, and hands the model exactly those sources. The
only difference is the model call — `claude -p` (billed to Pro/Max) instead of the
Anthropic API. Each section goes through the same fidelity + schema gate before it
is written, so both paths produce identical, grounded output.

Requires Claude Code installed and signed in (`claude` on PATH), plus QF creds to
fetch tafsir. One section per invocation keeps it fully resumable.
"""

import argparse
import datetime
import json
import subprocess

from . import config, prompt, qf_client, store, corpus
from .batch import _parse_surahs, _refresh_dashboard


def _json_only(text):
    a, b = text.find("{"), text.rfind("}")
    if a < 0:
        return None
    try:
        return json.loads(text[a: b + 1])
    except json.JSONDecodeError:
        return None


def run_one(surah, start, end, served_plan, coverage):
    verses, sources = corpus.gather_section(surah, start, end, served_plan)
    if not sources:
        print(f"  [skip] {surah}:{start} — no tafsir fetched")
        return False

    full_prompt = prompt.SYSTEM + "\n\n" + prompt.build_user_message(
        surah, start, end, verses, sources)
    cmd = ["claude", "-p", full_prompt, "--model", config.MODEL, "--output-format", "json"]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if res.returncode != 0:
        print(f"  [err] {surah}:{start} claude exited {res.returncode}\n{res.stderr[:300]}")
        return False
    try:
        text = json.loads(res.stdout).get("result", res.stdout)
    except json.JSONDecodeError:
        text = res.stdout
    obj = _json_only(text)
    if obj is None:
        print(f"  [parse-err] {surah}:{start}")
        return False

    check = store.check_section(obj, sources)
    if check["errors"]:
        print(f"  [FIDELITY-FAIL] {surah}:{start}: {check['errors']} — not saved")
        return False
    for w in check["warnings"]:
        print(f"     [warn] {surah}:{start}: {w}")
    enriched = store.enrich_claims(obj.get("claims", []), surah, start, sources,
                                   config.MODEL, prompt.PROMPT_VERSION)
    schema_errs = store.validate_claims(enriched)
    if schema_errs:
        print(f"  [SCHEMA-FAIL] {surah}:{start}: {schema_errs[:3]} — not saved")
        return False
    store.write_section(surah, start, end, obj, enriched, sources, coverage,
                        config.MODEL, prompt.PROMPT_VERSION)
    print(f"  [saved] {surah}:{start} ({len(enriched)} claims)")
    return True


def cmd_run(args):
    config.TODAY = config.TODAY or datetime.date.today().isoformat()
    served_plan, coverage = qf_client.reconcile(config.fetch_plan())
    print(f"  catalogue → {coverage['independent_works']} works served; "
          f"languages present {coverage['languages_present']}, absent {coverage['languages_absent']}")
    pending = store.pending_sections(_parse_surahs(args.surahs))
    if args.limit:
        pending = pending[: args.limit]
    print(f"{len(pending)} sections to compile via subscription ({config.MODEL}).")
    done = 0
    for surah, start, end in pending:
        if run_one(surah, start, end, served_plan, coverage):
            done += 1
    print(f"\nCompiled {done}/{len(pending)} sections.")
    _refresh_dashboard()


def main():
    ap = argparse.ArgumentParser(description="Overview subscription pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run"); r.add_argument("--surahs", default=""); r.add_argument("--limit", type=int, default=0); r.set_defaults(fn=cmd_run)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
