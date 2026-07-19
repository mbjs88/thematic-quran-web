# Corpus Labeling Strategy

**Audience:** LLMs and human reviewers continuing the thematic-label corpus.
**Status:** operational runbook for scaling from pilot surahs to full Qur'an coverage.

## Goal

Label every canonical section in `data/theme_breaks.json` with taxonomy IDs from `docs/taxonomy.md`, then keep `data/thematic_labels/assignments.json` valid enough for the filter UI to consume safely.

This is a corpus production workflow, not a single prompt. Work one surah at a time, preserve review notes, validate after every merge, and keep the machine JSON aligned with the human-readable labeling docs.

## Source Of Truth

- Human instructions: `docs/labeling/LABELING_INSTRUCTIONS.md`
- Human taxonomy: `docs/taxonomy.md`
- Section boundaries: `data/theme_breaks.json`
- Verse text: `data/quran_data.json`
- Machine taxonomy: `data/thematic_labels/taxonomy.json`
- Machine assignments: `data/thematic_labels/assignments.json`
- Gold-standard style examples: `docs/labeling/surah-001-al-fatihah.md`, `surah-019-maryam.md`, `surah-067-al-mulk.md`, `surah-112-al-ikhlas.md`

Before labeling any surah, read `LABELING_INSTRUCTIONS.md` end to end, read `docs/taxonomy.md`, and skim the pilot files for density and style.

## Current Operating Policy

1. Process surahs in numerical order unless the human owner explicitly changes the order.
2. Do not analyze the whole Qur'an in one prompt. Use one surah per work unit, with shorter surahs grouped only after the validator is stable.
3. Every section ID is `surah:startAyah`, exactly matching a start ayah in `theme_breaks.json`.
4. Use existing labels only. If a gap is real, add `suggestedNewLabels` in the surah output and surface it for review; do not silently add IDs to assignments.
5. Keep the human review file and machine JSON in sync. A surah is not complete until both exist and validation passes.
6. Treat `qul-statements` as the canonical label for "Say:" passages. The older self-check wording that mentions `muhammad` for every "Say:" passage conflicts with the detailed policy; follow the detailed `qul-statements` policy.
7. The label-count ceiling is a review signal, not a hard trim rule. Keep defensible labels, add overflow notes, and let a reviewer decide.

## Per-Surah Workflow

1. Generate a packet:

```bash
python3 scripts/export_labeling_packet.py --surah 4
```

2. Label the surah using the packet, taxonomy, and instructions.
3. Write the review file:

```text
docs/labeling/surah-XXX-name.md
```

Use the existing pilot format: content summary first, facet-grouped label table, JSON block, self-check/open questions.

4. Merge section entries plus `_surah_summary_<n>` into:

```text
data/thematic_labels/assignments.json
```

5. Validate:

```bash
python3 scripts/validate_thematic_labels.py
```

6. Fix structural errors before moving on. Warnings can remain only when they are intentional review items and are documented in the surah file.

## Batch Order

Recommended next sequence:

1. Surah 4, because the project has already completed Surahs 1-3 and should continue numerically.
2. Surahs 5-9 individually, because they are long and legally/theologically dense.
3. Surahs 10-18 individually or in small groups only after validation is consistently clean.
4. Surahs 20-66 after Surah 19 is already covered.
5. Surahs 68-111 after Surah 67 is already covered.
6. Surahs 113-114 last, after confirming the short-surah style with 112.

Do not skip ahead for convenience unless the human owner wants coverage of a specific theme or juz.

## Validation Gates

The validator should fail on structural problems:

- assignment key is not a real section start
- label ID is not in `taxonomy.json`
- label ID looks like an alias or malformed ID
- confidence is missing or invalid
- completed surah has missing sections
- completed surah has no `_surah_summary_<n>`
- overflow section has no notes

The validator should warn on heuristic review items:

- "Say:" section may be missing `qul-statements`
- "O mankind" section may be missing `mankind`
- "O you who believe" section may be missing `believers`
- disjoined-letter opening may be missing `disjoined-letters`
- summary statistics do not match current entries
- suggested-new-label volume is high

Warnings are not automatically wrong; they are prompts for human review.

## Machine Data Contract

`data/thematic_labels/assignments.json` is consumed by the UI as:

```json
{
  "2:255": {
    "labels": ["tawhid", "sovereignty", "knowledge", "power"],
    "confidence": "high",
    "notes": "optional review note"
  },
  "_surah_summary_2": {
    "sectionsLabeled": 81,
    "sectionsTotal": 81,
    "labelsPerSection": { "min": 3, "mean": 11.3, "max": 22 },
    "overflowSections": ["2:30"],
    "lowConfidenceSections": [],
    "suggestedNewLabels": []
  }
}
```

The UI ignores `_surah_summary_*` entries for filtering. Keep summaries in the same file because they make coverage and review status easy to compute.

## Handoff Checklist

When passing to another LLM, include:

- the next surah number
- the packet path
- validator output
- any open taxonomy questions
- whether warnings are known/accepted or need fixing

The next worker should be able to start from the packet, read the instructions and taxonomy, label the surah, merge JSON, and run validation without reverse-engineering the project.
