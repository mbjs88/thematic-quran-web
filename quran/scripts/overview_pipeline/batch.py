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

from . import config, prompt, qf_client, store


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


# ---------------------------------------------------------------- build --------
def cmd_build(args):
    editions = qf_client.resolve_edition_ids(config.EDITIONS)
    surahs = _parse_surahs(args.surahs)
    pending = [(s, a, e) for (s, a, e) in store.pending_sections(surahs)]
    if args.limit:
        pending = pending[: args.limit]

    out_path = config.WORK / "batch_input.jsonl"
    n = 0
    with out_path.open("w", encoding="utf-8") as f:
        for surah, start, end in pending:
            verses, tafsir_by_edition = qf_client.gather_section(surah, start, end, editions)
            if not tafsir_by_edition:
                print(f"  [skip] {surah}:{start} — no tafsir fetched")
                continue
            user = prompt.build_user_message(surah, start, end, verses, tafsir_by_edition, editions)
            req = {
                "custom_id": _custom_id(surah, start),
                "params": {
                    "model": config.MODEL,
                    "max_tokens": config.MAX_TOKENS,
                    "system": prompt.SYSTEM,
                    "messages": [{"role": "user", "content": user}],
                    "metadata": {"commentators": len(tafsir_by_edition)},
                },
            }
            f.write(json.dumps(req, ensure_ascii=False) + "\n")
            n += 1
            print(f"  [built] {surah}:{start} ({len(tafsir_by_edition)} commentaries)")
    print(f"\nWrote {n} requests to {out_path}")
    _estimate_cost(out_path)


def _estimate_cost(jsonl_path):
    chars = sum(len(l) for l in jsonl_path.read_text(encoding="utf-8").splitlines())
    in_tok = chars / 4.0                       # ~4 chars/token, input-dominant
    out_tok = jsonl_path.read_text().count("\n") * 1200
    p = config.PRICE.get(config.MODEL, config.PRICE["claude-opus-4-8"])
    cost = (in_tok / 1e6 * p["in"] + out_tok / 1e6 * p["out"]) * config.BATCH_DISCOUNT
    print(f"Rough batch cost for this file ({config.MODEL}): ${cost:,.2f} "
          f"(~{in_tok/1e6:.1f}M in, ~{out_tok/1e6:.2f}M out, 50% batch)")


# --------------------------------------------------------------- submit --------
def cmd_submit(args):
    import anthropic  # pip install anthropic
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    requests = [json.loads(l) for l in open(args.file, encoding="utf-8")]
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
    ok = err = 0
    for result in client.messages.batches.results(batch_id):
        surah, start = _decode_custom_id(result.custom_id)
        if result.result.type != "succeeded":
            print(f"  [err] {result.custom_id}: {result.result.type}")
            err += 1
            continue
        text = "".join(
            blk.text for blk in result.result.message.content if blk.type == "text")
        try:
            obj = json.loads(_json_only(text))
        except Exception as ex:
            print(f"  [parse-err] {result.custom_id}: {ex}")
            err += 1
            continue
        commentators = getattr(result, "metadata", {}) or {}
        obj["_commentators"] = commentators.get("commentators")
        store.write_section(surah, start, obj)
        ok += 1
        print(f"  [saved] {surah}:{start}")
    print(f"\nSaved {ok} sections, {err} problems.")
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
    b = sub.add_parser("build"); b.add_argument("--surahs", default=""); b.add_argument("--limit", type=int, default=0); b.set_defaults(fn=cmd_build)
    s = sub.add_parser("submit"); s.add_argument("file"); s.set_defaults(fn=cmd_submit)
    c = sub.add_parser("collect"); c.add_argument("batch_id", nargs="?"); c.set_defaults(fn=cmd_collect)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
