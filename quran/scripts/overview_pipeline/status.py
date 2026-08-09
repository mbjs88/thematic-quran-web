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


def cmd_catalogue(args):
    """Reconcile the grounded catalogue against the LIVE API — the pre-flight check.
    Confirms every planned work is actually served, and surfaces any API editions
    not yet in commentators.json (which must be added deliberately, never guessed)."""
    from . import qf_client, catalogue
    live = qf_client.list_tafsirs()
    served, coverage = qf_client.reconcile(config.fetch_plan(), live=live)
    print(f"Planned works served : {coverage['independent_works']}")
    print(f"Languages present    : {coverage['languages_present']}")
    print(f"Languages absent     : {coverage['languages_absent']}")
    if coverage["editions_absent"]:
        print(f"  [!] planned but NOT served: {coverage['editions_absent']}")
    known = {e["slug"] for e in catalogue.load()["editions"]}
    extra = [t["slug"] for t in live if t.get("slug") not in known]
    if extra:
        print(f"\nAPI serves {len(extra)} tafsir(s) NOT in commentators.json "
              f"(add deliberately if wanted):")
        for s in extra:
            print(f"  + {s}")
    else:
        print("\nEvery live tafsir is accounted for in commentators.json.")


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
    ca = sub.add_parser("catalogue"); ca.set_defaults(fn=cmd_catalogue)
    ba = sub.add_parser("batch"); ba.add_argument("batch_id", nargs="?"); ba.set_defaults(fn=cmd_batch)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
