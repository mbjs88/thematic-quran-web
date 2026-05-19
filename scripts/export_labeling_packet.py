#!/usr/bin/env python3
"""Export an LLM-ready packet for labeling one surah."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QURAN_DATA_PATH = ROOT / "data" / "quran_data.json"
THEME_BREAKS_PATH = ROOT / "data" / "theme_breaks.json"
TAXONOMY_PATH = ROOT / "data" / "thematic_labels" / "taxonomy.json"
ASSIGNMENTS_PATH = ROOT / "data" / "thematic_labels" / "assignments.json"
DEFAULT_OUTPUT_DIR = ROOT / "docs" / "labeling" / "packets"


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "surah"


def build_surah_sections(surah: int, quran_data: list[dict], theme_breaks: dict[str, list[int]]):
    verses = [verse for verse in quran_data if int(verse["surah_no"]) == surah]
    if not verses:
        raise SystemExit(f"Surah {surah} not found in quran_data.json")

    breaks = [int(item) for item in theme_breaks.get(str(surah), [])]
    if not breaks:
        raise SystemExit(f"Surah {surah} not found in theme_breaks.json")

    verse_by_ayah = {int(verse["ayah_no_surah"]): verse for verse in verses}
    last_ayah = max(verse_by_ayah)
    sections = []

    for index, start in enumerate(breaks):
        end = breaks[index + 1] - 1 if index + 1 < len(breaks) else last_ayah
        section_verses = [
            verse_by_ayah[ayah]
            for ayah in range(start, end + 1)
            if ayah in verse_by_ayah
        ]
        sections.append({
            "id": f"{surah}:{start}",
            "start": start,
            "end": end,
            "verses": section_verses,
        })

    return verses[0], sections


def label_reference(taxonomy: dict) -> str:
    labels_by_facet: dict[str, list[str]] = defaultdict(list)
    facet_names: dict[str, str] = {}

    for facet_id, facet in taxonomy.get("facets", {}).items():
        display = facet.get("displayName", {})
        facet_names[facet_id] = display.get("en") or facet_id

    for label in taxonomy.get("labels", []):
        labels_by_facet[label["facet"]].append(label["id"])

    blocks = []
    for facet_id in taxonomy.get("facets", {}):
        labels = " ".join(sorted(labels_by_facet.get(facet_id, [])))
        blocks.append(f"### {facet_names.get(facet_id, facet_id)} (`{facet_id}`)\n\n```text\n{labels}\n```")

    return "\n\n".join(blocks)


def format_assignment(entry: dict | None) -> str:
    if not entry:
        return "_None yet._"
    return "```json\n" + json.dumps(entry, ensure_ascii=False, indent=2) + "\n```"


def render_packet(surah: int, surah_meta: dict, sections: list[dict], taxonomy: dict, assignments: dict) -> str:
    title = f"Surah {surah}: {surah_meta['surah_name_roman']} ({surah_meta['surah_name_en']})"
    lines = [
        f"# Labeling Packet: {title}",
        "",
        "Use this packet with `docs/labeling/LABELING_INSTRUCTIONS.md` and `docs/taxonomy.md`.",
        "Do not invent labels. Output section IDs exactly as shown.",
        "",
        "## Required Output",
        "",
        f"- Human review file: `docs/labeling/surah-{surah:03d}-{slugify(surah_meta['surah_name_roman'])}.md`",
        "- Machine entries: merge into `data/thematic_labels/assignments.json`",
        f"- Summary key: `_surah_summary_{surah}`",
        "",
        "## Surah Metadata",
        "",
        f"- `surah_no`: {surah}",
        f"- `surah_name_roman`: {surah_meta['surah_name_roman']}",
        f"- `surah_name_en`: {surah_meta['surah_name_en']}",
        f"- `surah_name_ar`: {surah_meta['surah_name_ar']}",
        f"- sections: {len(sections)}",
        "",
        "## Label IDs By Facet",
        "",
        label_reference(taxonomy),
        "",
        "## Sections",
        "",
    ]

    for section in sections:
        ayah_range = f"{section['start']}-{section['end']}" if section["start"] != section["end"] else str(section["start"])
        lines.extend([
            f"### {section['id']} ({surah}:{ayah_range})",
            "",
            "Existing assignment:",
            "",
            format_assignment(assignments.get(section["id"])),
            "",
            "| Ayah | Arabic | English | Urdu |",
            "|---:|---|---|---|",
        ])
        for verse in section["verses"]:
            ayah = verse["ayah_no_surah"]
            arabic = str(verse.get("ayah_ar", "")).replace("|", "\\|")
            english = str(verse.get("ayah_en", "")).replace("|", "\\|")
            urdu = str(verse.get("urdu_translation", "")).replace("|", "\\|")
            lines.append(f"| {ayah} | {arabic} | {english} | {urdu} |")
        lines.append("")

    lines.extend([
        "## Self-Check",
        "",
        "- Every section above has one JSON entry.",
        "- Every label ID appears in the taxonomy.",
        "- Every confidence value is `high`, `medium`, or `low`.",
        "- Overflow sections have notes with trim candidates.",
        "- `suggestedNewLabels` are surfaced for human review and are not silently added to taxonomy.",
    ])

    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export an LLM-ready packet for one surah.")
    parser.add_argument("--surah", type=int, required=True, help="Surah number to export.")
    parser.add_argument("--out", type=Path, help="Output path. Defaults to docs/labeling/packets/...")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    quran_data = load_json(QURAN_DATA_PATH)
    theme_breaks = load_json(THEME_BREAKS_PATH)
    taxonomy = load_json(TAXONOMY_PATH)
    assignments = load_json(ASSIGNMENTS_PATH) if ASSIGNMENTS_PATH.exists() else {}

    surah_meta, sections = build_surah_sections(args.surah, quran_data, theme_breaks)
    output_path = args.out
    if output_path is None:
        slug = slugify(surah_meta["surah_name_roman"])
        output_path = DEFAULT_OUTPUT_DIR / f"surah-{args.surah:03d}-{slug}.packet.md"
    if not output_path.is_absolute():
        output_path = ROOT / output_path

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_packet(args.surah, surah_meta, sections, taxonomy, assignments), encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
