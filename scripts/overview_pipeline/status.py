"""
Monitor — what's done, and how a running batch is doing.

  python -m scripts.overview_pipeline.status store    # completion from the JSON store
  python -m scripts.overview_pipeline.status batch [id]  # poll a submitted batch

`store` also re-runs scripts/overview_progress.py so the HTML dashboard stays fresh.
"""

import argparse
import subprocess
import sys

from . import config, store


def cmd_store(args):
    total = done = 0
    partial = complete = 0
    for s in range(1, 115):
        secs = store.surah_sections(s)
        total += len(secs)
        d = len(store.compiled_section_starts(s) & {a for a, _ in secs})
        done += d
        if secs and d == len(secs):
            complete += 1
        elif d:
            partial += 1
    pct = round(100 * done / total, 1) if total else 0
    print(f"Sections compiled : {done} / {total}  ({pct}%)")
    print(f"Surahs complete   : {complete} / 114")
    print(f"Surahs in progress: {partial}")
    print(f"Remaining sections: {total - done}")
    # keep the dashboard in sync
    subprocess.run([sys.executable, str(config.ROOT / "scripts" / "overview_progress.py")],
                   stdout=subprocess.DEVNULL)
    print("Dashboard refreshed: docs/overview-tafsir/progress.html")


def cmd_batch(args):
    import anthropic
    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    bid = args.batch_id
    if not bid:
        f = config.WORK / "last_batch_id.txt"
        bid = f.read_text().strip() if f.exists() else None
    if not bid:
        print("No batch id given and none saved. Submit a batch first.")
        return
    b = client.messages.batches.retrieve(bid)
    c = b.request_counts
    print(f"Batch {bid}")
    print(f"  status     : {b.processing_status}")
    print(f"  processing : {c.processing}")
    print(f"  succeeded  : {c.succeeded}")
    print(f"  errored    : {c.errored}")
    print(f"  canceled   : {c.canceled}  expired: {c.expired}")
    if b.processing_status == "ended":
        print("  → collect:  python -m scripts.overview_pipeline.batch collect")


def main():
    ap = argparse.ArgumentParser(description="Overview pipeline status")
    sub = ap.add_subparsers(dest="cmd", required=True)
    st = sub.add_parser("store"); st.set_defaults(fn=cmd_store)
    ba = sub.add_parser("batch"); ba.add_argument("batch_id", nargs="?"); ba.set_defaults(fn=cmd_batch)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
