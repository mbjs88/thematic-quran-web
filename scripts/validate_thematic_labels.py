#!/usr/bin/env python3
"""Validate thematic-label taxonomy and assignments.

The script is intentionally conservative about hard failures. Structural
problems exit non-zero; heuristic content checks are warnings because they
often need human judgment.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from statistics import mean


ROOT = Path(__file__).resolve().parents[1]
TAXONOMY_PATH = ROOT / "data" / "thematic_labels" / "taxonomy.json"
ASSIGNMENTS_PATH = ROOT / "data" / "thematic_labels" / "assignments.json"
THEME_BREAKS_PATH = ROOT / "data" / "theme_breaks.json"
QURAN_DATA_PATH = ROOT / "data" / "quran_data.json"

CONFIDENCE_VALUES = {"high", "medium", "low"}
LABEL_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SECTION_ID_RE = re.compile(r"^([1-9][0-9]*):([1-9][0-9]*)$")
SUMMARY_RE = re.compile(r"^_surah_summary_([1-9][0-9]*)$")
QUL_RE = re.compile(r"(^|[.!?]\s+)Say[:,]", re.IGNORECASE)
DISJOINED_LETTER_SURAHS = {
    2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28, 29, 30, 31, 32,
    36, 38, 40, 41, 42, 43, 44, 45, 46, 50, 68,
}


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def normalize_alias(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def build_sections(theme_breaks: dict[str, list[int]], quran_data: list[dict]):
    last_ayah_by_surah: dict[int, int] = {}
    text_by_surah: dict[int, dict[int, dict]] = defaultdict(dict)

    for verse in quran_data:
        surah = int(verse["surah_no"])
        ayah = int(verse["ayah_no_surah"])
        last_ayah_by_surah[surah] = max(last_ayah_by_surah.get(surah, 0), ayah)
        text_by_surah[surah][ayah] = verse

    sections: dict[str, dict] = {}
    break_warnings: list[str] = []

    for surah_text, raw_breaks in theme_breaks.items():
        surah = int(surah_text)
        breaks = [int(item) for item in raw_breaks]
        last_ayah = last_ayah_by_surah.get(surah)
        if not last_ayah:
            break_warnings.append(f"Surah {surah} is in theme_breaks.json but not quran_data.json")
            continue

        if breaks != sorted(breaks):
            break_warnings.append(f"Surah {surah} breaks are not sorted: {breaks}")
        if len(set(breaks)) != len(breaks):
            break_warnings.append(f"Surah {surah} has duplicate break starts: {breaks}")

        for index, start in enumerate(breaks):
            end = breaks[index + 1] - 1 if index + 1 < len(breaks) else last_ayah
            section_id = f"{surah}:{start}"
            sections[section_id] = {
                "surah": surah,
                "start": start,
                "end": end,
                "verses": [
                    text_by_surah[surah][ayah]
                    for ayah in range(start, end + 1)
                    if ayah in text_by_surah[surah]
                ],
            }

    return sections, break_warnings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate thematic-label assignment data.")
    parser.add_argument("--surah", type=int, action="append", help="Limit validation to one or more surahs.")
    parser.add_argument("--full", action="store_true", help="Require every surah in theme_breaks.json to be labeled.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    taxonomy = load_json(TAXONOMY_PATH)
    assignments = load_json(ASSIGNMENTS_PATH)
    theme_breaks = load_json(THEME_BREAKS_PATH)
    quran_data = load_json(QURAN_DATA_PATH)

    label_ids = {label["id"] for label in taxonomy.get("labels", [])}
    alias_to_id: dict[str, str] = {}
    for label in taxonomy.get("labels", []):
        for alias in label.get("aliases", []):
            alias_to_id.setdefault(normalize_alias(alias), label["id"])

    sections, break_warnings = build_sections(theme_breaks, quran_data)
    requested_surahs = set(args.surah or [])
    errors: list[str] = []
    warnings: list[str] = list(break_warnings)
    sections_by_surah: dict[int, set[str]] = defaultdict(set)
    assigned_by_surah: dict[int, set[str]] = defaultdict(set)
    summaries: dict[int, dict] = {}

    for section_id, section in sections.items():
        sections_by_surah[section["surah"]].add(section_id)

    for key, entry in assignments.items():
        summary_match = SUMMARY_RE.match(key)
        if summary_match:
            surah = int(summary_match.group(1))
            if not requested_surahs or surah in requested_surahs:
                summaries[surah] = entry
            continue

        match = SECTION_ID_RE.match(key)
        if not match:
            errors.append(f"{key}: assignment key is not a section ID or summary key")
            continue

        surah = int(match.group(1))
        if requested_surahs and surah not in requested_surahs:
            continue

        if key not in sections:
            errors.append(f"{key}: assignment key does not exist in theme_breaks.json")
            continue

        assigned_by_surah[surah].add(key)

        if not isinstance(entry, dict):
            errors.append(f"{key}: assignment entry must be an object")
            continue

        labels = entry.get("labels")
        if not isinstance(labels, list):
            errors.append(f"{key}: labels must be an array")
            labels = []

        seen_labels: set[str] = set()
        for label_id in labels:
            if not isinstance(label_id, str):
                errors.append(f"{key}: label IDs must be strings")
                continue
            if not LABEL_ID_RE.match(label_id):
                errors.append(f"{key}: malformed label ID {label_id!r}")
            if label_id in seen_labels:
                warnings.append(f"{key}: duplicate label {label_id}")
            seen_labels.add(label_id)
            if label_id not in label_ids:
                alias_target = alias_to_id.get(normalize_alias(label_id))
                if alias_target:
                    errors.append(f"{key}: {label_id!r} is an alias; use {alias_target!r}")
                else:
                    errors.append(f"{key}: unknown label ID {label_id!r}")

        confidence = entry.get("confidence")
        if confidence not in CONFIDENCE_VALUES:
            errors.append(f"{key}: confidence must be one of {sorted(CONFIDENCE_VALUES)}")

        if len(labels) > 12 and not str(entry.get("notes", "")).strip():
            errors.append(f"{key}: has {len(labels)} labels but no overflow note")

        suggested = entry.get("suggestedNewLabels", [])
        if suggested and not isinstance(suggested, list):
            errors.append(f"{key}: suggestedNewLabels must be an array when present")
            suggested = []
        if len(suggested) > 3:
            warnings.append(f"{key}: has {len(suggested)} suggested new labels; confirm taxonomy review before continuing")
        for proposed in suggested:
            if not isinstance(proposed, str) or not LABEL_ID_RE.match(proposed):
                warnings.append(f"{key}: suggested new label {proposed!r} is not kebab-case")
            elif proposed in label_ids:
                warnings.append(f"{key}: suggested new label {proposed!r} already exists in taxonomy")

        section_text = " ".join(verse.get("ayah_en", "") for verse in sections[key]["verses"])
        labels_set = set(labels)
        if QUL_RE.search(section_text) and "qul-statements" not in labels_set:
            warnings.append(f"{key}: contains 'Say:' but is missing qul-statements")
        if re.search(r"\bO mankind\b", section_text, re.IGNORECASE) and "mankind" not in labels_set:
            warnings.append(f"{key}: contains 'O mankind' but is missing mankind")
        if re.search(r"\bO you who (?:believe|have believed)\b", section_text, re.IGNORECASE) and "believers" not in labels_set:
            warnings.append(f"{key}: contains 'O you who believe' but is missing believers")

    completed_surahs = set(assigned_by_surah)
    if args.full:
        completed_surahs = {int(surah) for surah in theme_breaks}
    if requested_surahs:
        completed_surahs = requested_surahs

    for surah in sorted(completed_surahs):
        expected = sections_by_surah.get(surah, set())
        assigned = assigned_by_surah.get(surah, set())
        missing = sorted(expected - assigned, key=lambda item: int(item.split(":")[1]))
        if missing:
            errors.append(f"Surah {surah}: missing {len(missing)} section assignments: {', '.join(missing[:12])}{' ...' if len(missing) > 12 else ''}")

        if assigned and surah not in summaries:
            errors.append(f"Surah {surah}: missing _surah_summary_{surah}")

        if surah in DISJOINED_LETTER_SURAHS:
            first_start = min(int(item.split(":")[1]) for item in expected) if expected else None
            first_id = f"{surah}:{first_start}" if first_start else None
            first_entry = assignments.get(first_id, {})
            if first_id in assigned and "disjoined-letters" not in first_entry.get("labels", []):
                warnings.append(f"{first_id}: disjoined-letter surah opening may be missing disjoined-letters")

        summary = summaries.get(surah)
        if summary and assigned:
            counts = [len(assignments[section_id].get("labels", [])) for section_id in assigned]
            overflow = sorted([section_id for section_id in assigned if len(assignments[section_id].get("labels", [])) > 12])
            low_confidence = sorted([
                section_id for section_id in assigned
                if assignments[section_id].get("confidence") in {"low", "medium"}
            ])
            if summary.get("sectionsLabeled") != len(assigned):
                warnings.append(f"_surah_summary_{surah}: sectionsLabeled is {summary.get('sectionsLabeled')}, expected {len(assigned)}")
            if summary.get("sectionsTotal") != len(expected):
                warnings.append(f"_surah_summary_{surah}: sectionsTotal is {summary.get('sectionsTotal')}, expected {len(expected)}")
            summary_counts = summary.get("labelsPerSection", {})
            if counts and isinstance(summary_counts, dict):
                actual_mean = round(mean(counts), 1)
                if summary_counts.get("min") != min(counts):
                    warnings.append(f"_surah_summary_{surah}: labelsPerSection.min is {summary_counts.get('min')}, expected {min(counts)}")
                if round(float(summary_counts.get("mean", -1)), 1) != actual_mean:
                    warnings.append(f"_surah_summary_{surah}: labelsPerSection.mean is {summary_counts.get('mean')}, expected {actual_mean}")
                if summary_counts.get("max") != max(counts):
                    warnings.append(f"_surah_summary_{surah}: labelsPerSection.max is {summary_counts.get('max')}, expected {max(counts)}")
            if sorted(summary.get("overflowSections", [])) != overflow:
                warnings.append(f"_surah_summary_{surah}: overflowSections does not match current entries")
            if sorted(summary.get("lowConfidenceSections", [])) != low_confidence:
                warnings.append(f"_surah_summary_{surah}: lowConfidenceSections does not match current entries")

    print(f"Validated {len(assigned_by_surah)} labeled surahs against {len(label_ids)} taxonomy labels.")
    if warnings:
        print(f"\nWARNINGS ({len(warnings)}):")
        for warning in warnings:
            print(f"  - {warning}")
    if errors:
        print(f"\nERRORS ({len(errors)}):")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("\nNo structural errors found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
