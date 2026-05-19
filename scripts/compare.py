#!/usr/bin/env python3
"""
Thematic Qur'an — Model Comparison
==================================

Runs two models (or one model + the human reference in `assignments.json`)
against the same surah(s) and writes a human-readable comparison report.

Does NOT touch `assignments.json`. All output goes to
`data/thematic_labels/.compare/<timestamp>/`.

Usage:
    python3 scripts/compare.py --surah 12 --models opus,sonnet
    python3 scripts/compare.py --surah 19 --models human,sonnet
    python3 scripts/compare.py --surahs 1,67,112 --models human,opus

Model arguments accept:
    - Full model ID (e.g. claude-sonnet-4-6)
    - Short aliases: haiku, sonnet, opus
    - Special: human  (uses existing assignments.json — no API call, no cost)

Outputs per run, into a fresh `data/thematic_labels/.compare/<timestamp>/`:
    summary.md                        aggregate scores across all surahs
    surah-{NNN}-comparison.md         human-readable side-by-side report
    surah-{NNN}-comparison.json       machine diff
    surah-{NNN}-{model}.json          each model's raw labeled output
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple

# Pull worker primitives from labeler.py
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import labeler  # noqa: E402

REPO_ROOT = labeler.REPO_ROOT
COMPARE_DIR = labeler.THEMATIC_DIR / ".compare"

MODEL_ALIASES = {
    "haiku":     "claude-haiku-4-5-20251001",
    "sonnet":    "claude-sonnet-4-6",
    "opus":      "claude-opus-4-6",
    "human":     "human",
    "canonical": "human",
    "gold":      "human",
}


# ---------------------------------------------------------------------------
# Spec helpers
# ---------------------------------------------------------------------------

def resolve_model(name: str) -> str:
    """Accept 'opus' / 'sonnet' / 'human' / full IDs."""
    key = name.strip().lower()
    if key in MODEL_ALIASES:
        return MODEL_ALIASES[key]
    if key in labeler.MODEL_PRICING or key == "human":
        return key
    raise SystemExit(f"Unknown model: {name!r}. Choose from: {list(MODEL_ALIASES)} or any full model ID in labeler.MODEL_PRICING.")


def short_label(model: str) -> str:
    """Short token suitable for filenames."""
    if model == "human":
        return "human"
    # claude-sonnet-4-6 -> sonnet
    parts = model.split("-")
    for p in parts:
        if p in ("haiku", "sonnet", "opus"):
            return p
    return model.replace("/", "_")


def parse_surahs_arg(s: str) -> list:
    """'1,2,19', '1-5', 'all', 'not-started'."""
    s = s.strip().lower()
    if s == "all":
        return list(range(1, 115))
    if s == "not-started":
        cov = labeler.compute_surah_coverage()
        return [n for n, info in cov.items() if info["status"] in ("not-started", "partial")]
    out = set()
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.update(range(int(a), int(b) + 1))
        else:
            out.add(int(part))
    return sorted(n for n in out if 1 <= n <= 114)


# ---------------------------------------------------------------------------
# Get labels for (model, surah) — either from API or from canonical file
# ---------------------------------------------------------------------------

@dataclass
class ModelResult:
    model: str                    # 'human' or a Claude model ID
    label_sets: dict              # section_id -> {labels, confidence, notes}
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    duration_seconds: float = 0.0
    parse_error: Optional[str] = None


def labels_from_human(surah_no: int) -> ModelResult:
    """Pulls existing assignments.json entries for this surah."""
    assignments = labeler.load_assignments()
    sections = list(labeler._enumerate_sections(
        labeler.load_quran(), labeler.load_theme_breaks(), surah_no
    ))
    out = {}
    for start, _, _ in sections:
        sid = f"{surah_no}:{start}"
        entry = assignments.get(sid)
        if entry:
            out[sid] = {
                "labels": entry.get("labels") or [],
                "confidence": entry.get("confidence") or "n/a",
                "notes": entry.get("notes") or "",
            }
        else:
            out[sid] = {"labels": [], "confidence": "missing", "notes": "no entry"}
    return ModelResult(model="human", label_sets=out)


def labels_from_model(surah_no: int, model: str, api_key: str) -> ModelResult:
    """Calls Claude API for the surah; returns the parsed labels."""
    quran = labeler.load_quran()
    breaks = labeler.load_theme_breaks()
    valid_ids = labeler.valid_label_ids()

    sections = list(labeler._enumerate_sections(quran, breaks, surah_no))
    section_ids = [f"{surah_no}:{start}" for start, _, _ in sections]
    if not section_ids:
        return ModelResult(model=model, label_sets={}, parse_error="no theme_breaks for this surah")

    system = labeler._system_prompt()
    user = labeler._user_prompt(quran, breaks, surah_no)

    started = time.time()
    payload = labeler._call_anthropic(api_key, model, system, user)
    text = labeler._extract_text(payload)
    try:
        raw = labeler._parse_assignments_json(text)
    except json.JSONDecodeError as e:
        return ModelResult(
            model=model,
            label_sets={},
            parse_error=f"JSON parse error: {e}; first 300 chars: {text[:300]!r}"
        )

    usage = payload.get("usage") or {}
    tin = int(usage.get("input_tokens") or 0)
    tout = int(usage.get("output_tokens") or 0)
    price = labeler.MODEL_PRICING.get(model, {"in": 0, "out": 0})
    cost = (tin / 1_000_000) * price["in"] + (tout / 1_000_000) * price["out"]

    cleaned = {}
    for sid, entry in raw.items():
        if sid.startswith("_") or sid not in section_ids:
            continue
        if not isinstance(entry, dict):
            continue
        labs = [l for l in (entry.get("labels") or []) if l in valid_ids]
        cleaned[sid] = {
            "labels": labs,
            "confidence": entry.get("confidence") or "medium",
            "notes": entry.get("notes") or "",
        }
    return ModelResult(
        model=model,
        label_sets=cleaned,
        tokens_in=tin,
        tokens_out=tout,
        cost_usd=round(cost, 4),
        duration_seconds=round(time.time() - started, 1),
    )


def get_labels(surah_no: int, model: str, api_key: Optional[str]) -> ModelResult:
    if model == "human":
        return labels_from_human(surah_no)
    if not api_key:
        raise SystemExit("Need ANTHROPIC_API_KEY (in .env or --api-key) for non-human models.")
    return labels_from_model(surah_no, model, api_key)


# ---------------------------------------------------------------------------
# Diff math
# ---------------------------------------------------------------------------

def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    u = a | b
    return len(a & b) / len(u) if u else 1.0


def diff_surah(a: ModelResult, b: ModelResult) -> dict:
    """Per-section + aggregate diff for one surah."""
    section_ids = sorted(set(a.label_sets) | set(b.label_sets), key=lambda s: int(s.split(":")[1]))
    per_section = []
    jacc_total = 0.0
    full_agree = 0
    no_overlap = 0
    counted = 0
    for sid in section_ids:
        la = set((a.label_sets.get(sid) or {}).get("labels") or [])
        lb = set((b.label_sets.get(sid) or {}).get("labels") or [])
        shared = la & lb
        only_a = la - lb
        only_b = lb - la
        j = jaccard(la, lb)
        per_section.append({
            "section": sid,
            "labels_a": sorted(la),
            "labels_b": sorted(lb),
            "shared": sorted(shared),
            "only_a": sorted(only_a),
            "only_b": sorted(only_b),
            "jaccard": round(j, 3),
            "confidence_a": (a.label_sets.get(sid) or {}).get("confidence"),
            "confidence_b": (b.label_sets.get(sid) or {}).get("confidence"),
        })
        jacc_total += j
        if j == 1.0:
            full_agree += 1
        if j == 0.0:
            no_overlap += 1
        counted += 1

    return {
        "model_a": a.model,
        "model_b": b.model,
        "sections": counted,
        "mean_jaccard": round(jacc_total / counted, 3) if counted else 0.0,
        "full_agreement_sections": full_agree,
        "no_overlap_sections": no_overlap,
        "tokens_a": {"in": a.tokens_in, "out": a.tokens_out},
        "tokens_b": {"in": b.tokens_in, "out": b.tokens_out},
        "cost_usd_a": a.cost_usd,
        "cost_usd_b": b.cost_usd,
        "cost_usd_total": round(a.cost_usd + b.cost_usd, 4),
        "duration_a": a.duration_seconds,
        "duration_b": b.duration_seconds,
        "per_section": per_section,
    }


# ---------------------------------------------------------------------------
# Markdown rendering
# ---------------------------------------------------------------------------

def render_surah_report(surah_no: int, surah_name: str, diff: dict) -> str:
    a, b = diff["model_a"], diff["model_b"]
    lines = [
        f"# Comparison — Surah {surah_no} ({surah_name})",
        "",
        f"**Model A:** `{a}`  |  **Model B:** `{b}`",
        f"**Sections compared:** {diff['sections']}",
        f"**Mean Jaccard overlap:** **{diff['mean_jaccard']}** "
        f"({diff['full_agreement_sections']} full agreement, {diff['no_overlap_sections']} no overlap)",
        "",
    ]
    # Cost line — skip if both are human (no API calls)
    cost_bits = []
    if a != "human":
        cost_bits.append(f"A: {diff['tokens_a']['in']}+{diff['tokens_a']['out']} tok, ${diff['cost_usd_a']:.4f}, {diff['duration_a']}s")
    if b != "human":
        cost_bits.append(f"B: {diff['tokens_b']['in']}+{diff['tokens_b']['out']} tok, ${diff['cost_usd_b']:.4f}, {diff['duration_b']}s")
    if cost_bits:
        lines.append(f"**Cost / time:** {' · '.join(cost_bits)} (total ${diff['cost_usd_total']:.4f})")
        lines.append("")

    lines.append("## Quick read")
    lines.append("")
    lines.append(_quick_read(diff))
    lines.append("")

    lines.append("## Per-section comparison")
    lines.append("")
    lines.append("| Section | Jaccard | Shared | Only A | Only B |")
    lines.append("|---|---|---|---|---|")
    for row in diff["per_section"]:
        sid = row["section"]
        j = row["jaccard"]
        shared = ", ".join(f"`{l}`" for l in row["shared"]) or "—"
        oa = ", ".join(f"`{l}`" for l in row["only_a"]) or "—"
        ob = ", ".join(f"`{l}`" for l in row["only_b"]) or "—"
        lines.append(f"| {sid} | {j} | {shared} | {oa} | {ob} |")
    lines.append("")

    lines.append("## Label-by-label deep dive")
    lines.append("")
    for row in diff["per_section"]:
        sid = row["section"]
        lines.append(f"### {sid}  (Jaccard {row['jaccard']})")
        ca, cb = row.get("confidence_a"), row.get("confidence_b")
        if ca or cb:
            lines.append(f"_Confidence — A: `{ca or '—'}`  ·  B: `{cb or '—'}`_")
        lines.append("")
        lines.append(f"- **A ({a}):** {', '.join(f'`{l}`' for l in row['labels_a']) or '—'}")
        lines.append(f"- **B ({b}):** {', '.join(f'`{l}`' for l in row['labels_b']) or '—'}")
        if row['only_a']:
            lines.append(f"  - **A added that B missed:** {', '.join(f'`{l}`' for l in row['only_a'])}")
        if row['only_b']:
            lines.append(f"  - **B added that A missed:** {', '.join(f'`{l}`' for l in row['only_b'])}")
        lines.append("")
    return "\n".join(lines)


def _quick_read(diff: dict) -> str:
    """One-paragraph summary in plain English."""
    a, b = diff["model_a"], diff["model_b"]
    mean = diff["mean_jaccard"]
    if mean >= 0.85:
        verdict = "extremely close — the two views are nearly identical."
    elif mean >= 0.7:
        verdict = "high agreement — minor variation per section."
    elif mean >= 0.5:
        verdict = "moderate agreement — they disagree on enough sections to matter."
    elif mean >= 0.3:
        verdict = "low agreement — these are noticeably different labelings."
    else:
        verdict = "very low agreement — treat the two views as substantively different."
    return (
        f"`{a}` and `{b}` agree on a mean Jaccard of **{mean}** across "
        f"{diff['sections']} sections; {verdict}  "
        f"Full agreement on {diff['full_agreement_sections']} section(s); "
        f"zero overlap on {diff['no_overlap_sections']} section(s)."
    )


def render_summary(all_diffs: list, model_a: str, model_b: str) -> str:
    """Aggregate report across all surahs run."""
    if not all_diffs:
        return "# Comparison summary\n\n(no surahs processed)\n"
    total_sections = sum(d["sections"] for d in all_diffs)
    weighted_jacc = (
        sum(d["mean_jaccard"] * d["sections"] for d in all_diffs) / total_sections
        if total_sections else 0.0
    )
    total_cost = round(sum(d["cost_usd_total"] for d in all_diffs), 4)
    lines = [
        f"# Comparison summary",
        "",
        f"**Models compared:** `{model_a}`  vs.  `{model_b}`",
        f"**Surahs:** {', '.join(str(d.get('surah_no', '?')) for d in all_diffs)}",
        f"**Sections (total):** {total_sections}",
        f"**Mean Jaccard (section-weighted):** **{round(weighted_jacc, 3)}**",
        f"**Total cost:** ${total_cost:.4f}",
        "",
        "| Surah | Sections | Mean Jaccard | Full agreement | No overlap | Cost |",
        "|---|---|---|---|---|---|",
    ]
    for d in all_diffs:
        lines.append(
            f"| {d.get('surah_no', '?')} ({d.get('surah_name', '')}) "
            f"| {d['sections']} | {d['mean_jaccard']} | {d['full_agreement_sections']} "
            f"| {d['no_overlap_sections']} | ${d['cost_usd_total']:.4f} |"
        )
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def run_compare(surahs: list, models: Tuple[str, str], api_key: Optional[str],
                out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    quran = labeler.load_quran()
    surah_names = {v["surah_no"]: v.get("surah_name_roman", f"Surah {v['surah_no']}")
                   for v in quran}

    all_diffs = []
    for n in surahs:
        name = surah_names.get(n, f"Surah {n}")
        print(f"\n=== Surah {n} ({name}) ===")
        ra = get_labels(n, models[0], api_key)
        print(f"  A ({models[0]}): {len(ra.label_sets)} sections"
              + (f" — {ra.tokens_in}+{ra.tokens_out} tok, ${ra.cost_usd:.4f}, {ra.duration_seconds}s"
                 if models[0] != 'human' else ""))
        if ra.parse_error:
            print(f"    !! parse_error: {ra.parse_error}")

        rb = get_labels(n, models[1], api_key)
        print(f"  B ({models[1]}): {len(rb.label_sets)} sections"
              + (f" — {rb.tokens_in}+{rb.tokens_out} tok, ${rb.cost_usd:.4f}, {rb.duration_seconds}s"
                 if models[1] != 'human' else ""))
        if rb.parse_error:
            print(f"    !! parse_error: {rb.parse_error}")

        # Save raw outputs
        npad = f"{n:03d}"
        (out_dir / f"surah-{npad}-{short_label(models[0])}.json").write_text(
            json.dumps(ra.label_sets, indent=2, ensure_ascii=False))
        (out_dir / f"surah-{npad}-{short_label(models[1])}.json").write_text(
            json.dumps(rb.label_sets, indent=2, ensure_ascii=False))

        # Compute + save the diff
        diff = diff_surah(ra, rb)
        diff["surah_no"] = n
        diff["surah_name"] = name
        all_diffs.append(diff)

        (out_dir / f"surah-{npad}-comparison.json").write_text(
            json.dumps(diff, indent=2, ensure_ascii=False))
        (out_dir / f"surah-{npad}-comparison.md").write_text(
            render_surah_report(n, name, diff))

        print(f"  Mean Jaccard: {diff['mean_jaccard']}  "
              f"({diff['full_agreement_sections']} full / {diff['no_overlap_sections']} zero)")

    # Top-level summary
    summary_md = render_summary(all_diffs, models[0], models[1])
    (out_dir / "summary.md").write_text(summary_md)
    print(f"\nReport directory: {out_dir}")
    print("Open the surah-specific .md files for the per-section breakdown.")
    return {"out_dir": str(out_dir), "diffs": all_diffs}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    p = argparse.ArgumentParser(
        description="Compare two labeling models on the same surah(s).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sg = p.add_mutually_exclusive_group(required=True)
    sg.add_argument("--surah", type=int, help="A single surah number (1-114).")
    sg.add_argument("--surahs", help="Comma list '1,2,19', range '1-5', 'all', or 'not-started'.")
    p.add_argument("--models", required=True,
                   help="Two comma-separated model names. Aliases: haiku, sonnet, opus, human. "
                        "Example: --models opus,sonnet  or  --models human,sonnet")
    p.add_argument("--api-key", default=None,
                   help="Override API key (otherwise reads .env / ANTHROPIC_API_KEY)")
    p.add_argument("--out", default=None,
                   help="Output dir (default: data/thematic_labels/.compare/<timestamp>/)")
    args = p.parse_args()

    raw_models = [m.strip() for m in args.models.split(",") if m.strip()]
    if len(raw_models) != 2:
        print("Error: --models must list exactly 2 names.", file=sys.stderr)
        return 2
    models = (resolve_model(raw_models[0]), resolve_model(raw_models[1]))
    if models[0] == models[1]:
        print("Error: pick two different models.", file=sys.stderr)
        return 2

    surahs = [args.surah] if args.surah else parse_surahs_arg(args.surahs)
    if not surahs:
        print("Error: no surahs parsed.", file=sys.stderr)
        return 2

    needs_key = any(m != "human" for m in models)
    api_key = args.api_key or labeler.get_api_key() if needs_key else None
    if needs_key and not api_key:
        print("Error: ANTHROPIC_API_KEY not set. Add to .env or pass --api-key.", file=sys.stderr)
        return 2

    if args.out:
        out_dir = Path(args.out)
    else:
        stamp = time.strftime("%Y%m%dT%H%M%S")
        out_dir = COMPARE_DIR / stamp

    print(f"Comparing models: {models[0]}  vs.  {models[1]}")
    print(f"Surahs: {surahs}")
    print(f"Output: {out_dir}")
    run_compare(surahs, models, api_key, out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
