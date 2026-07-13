"""
Subscription path — compile via Claude Code headless, billed to your Max plan
instead of the API.

  python -m scripts.overview_pipeline.subscription run [--surahs 78-114] [--limit N]

For each pending section it shells out to `claude -p` (non-interactive). Unlike
the batch path, this runs agentically: the model fetches its own tafsir through
the quran MCP and web-searches to verify any modern-lens science, so it produces
the fully verified reading in one pass. Requires:
  - Claude Code installed and signed in to a Pro/Max plan (`claude` on PATH)
  - the quran MCP + web search available to Claude Code (see README)

One section per invocation keeps context small and the job fully resumable —
already-compiled sections are skipped on the next run.
"""

import argparse
import datetime
import json
import re
import subprocess
import sys

from . import config, prompt, store
from .batch import _parse_surahs, _refresh_dashboard


def section_prompt(surah, start, end):
    lens = ("Include a verified modern_lens ONLY where a real touchpoint exists: "
            "web-search to confirm the science and include real source URLs, set "
            "\"verified\": true. Most sections get none."
            if config.MODERN_LENS != "manual" else
            "Do not include modern_lens in this pass.")
    refs = "\n".join(f'  [{e["n"]}] {e["label"]}' for e in config.EDITIONS)
    return f"""{prompt.SYSTEM}

TASK: Compile the Overview for surah {surah}, section {surah}:{start} (verses {start}-{end}).
Fetch the canonical Arabic, a translation, and the tafsir for these verses across the
edition set below using the quran MCP tools (fetch_grounding_rules first). Use ONLY the
fetched tafsir — nothing from memory. {lens}

Edition reference numbers for the <sup class="ref"> markers:
{refs}

Return ONLY the JSON object for this one section."""


def run_one(surah, start, end):
    p = section_prompt(surah, start, end)
    cmd = [
        "claude", "-p", p,
        "--model", config.MODEL,
        "--output-format", "json",
        "--allowedTools", "mcp__quran,WebSearch,Read",
        "--permission-mode", "acceptEdits",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if res.returncode != 0:
        print(f"  [err] {surah}:{start} claude exited {res.returncode}\n{res.stderr[:400]}")
        return False
    try:
        payload = json.loads(res.stdout)
        text = payload.get("result", res.stdout)
    except json.JSONDecodeError:
        text = res.stdout
    obj = _json_only(text)
    if obj is None:
        print(f"  [parse-err] {surah}:{start}")
        return False
    store.write_section(surah, start, obj)
    print(f"  [saved] {surah}:{start}")
    return True


def _json_only(text):
    a, b = text.find("{"), text.rfind("}")
    if a < 0:
        return None
    try:
        return json.loads(text[a: b + 1])
    except json.JSONDecodeError:
        return None


def cmd_run(args):
    config.TODAY = config.TODAY or datetime.date.today().isoformat()
    pending = store.pending_sections(_parse_surahs(args.surahs))
    if args.limit:
        pending = pending[: args.limit]
    print(f"{len(pending)} sections to compile via subscription ({config.MODEL}).")
    done = 0
    for surah, start, end in pending:
        if run_one(surah, start, end):
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
