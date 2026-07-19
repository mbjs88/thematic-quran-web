# Surah Az-Zalzalah (99) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 99:1 (1–5) — Earthquake and earth testimony

When the earth is shaken with its quake. And the earth brings out its loads. And man says, “What is the matter with it?” On that Day, it will tell its tales. For your Lord will have inspired it.

| Facet | Labels |
|---|---|
| people | `mankind` |
| divine-attributes | `divine-decree` |
| eschatology | `day-of-judgment`, `resurrection` |
| cosmology | `natural-signs` |

**5 labels. Confidence: high.**

## Section 2 — 99:6 (6–7) — People shown their works

On that Day, the people will emerge in droves, to be shown their works. Whoever has done an atom's weight of good will see it.

| Facet | Labels |
|---|---|
| divine-attributes | `justice` |
| ethical-states | `righteous-conduct` |
| eschatology | `day-of-judgment`, `resurrection`, `reckoning` |

**5 labels. Confidence: high.**

## Section 3 — 99:8 (8) — Evil also seen

And whoever has done an atom's weight of evil will see it.

| Facet | Labels |
|---|---|
| divine-attributes | `justice` |
| eschatology | `day-of-judgment`, `reckoning` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "99:1": {
    "labels": [
      "day-of-judgment",
      "resurrection",
      "natural-signs",
      "mankind",
      "divine-decree"
    ],
    "confidence": "high"
  },
  "99:6": {
    "labels": [
      "day-of-judgment",
      "resurrection",
      "reckoning",
      "justice",
      "righteous-conduct"
    ],
    "confidence": "high"
  },
  "99:8": {
    "labels": [
      "day-of-judgment",
      "reckoning",
      "justice"
    ],
    "confidence": "high"
  },
  "_surah_summary_99": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 3,
      "mean": 4.3,
      "max": 5
    },
    "overflowSections": [],
    "lowConfidenceSections": [],
    "suggestedNewLabels": []
  }
}
```

## Open questions

None.

## Self-check

- Every section in `theme_breaks.json` for Surah 99 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
