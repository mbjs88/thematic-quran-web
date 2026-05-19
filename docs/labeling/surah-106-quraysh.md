# Surah Quraysh (106) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 106:1 (1–2) — Quraysh security and journeys

For the security of Quraish. Their security during winter and summer journeys.

| Facet | Labels |
|---|---|
| people | `quraysh` |
| divine-attributes | `provision` |
| worldly-matters | `trade-and-debt` |

**3 labels. Confidence: high.**

## Section 2 — 106:3 (3) — Worship Lord of the House

Let them worship the Lord of this House.

| Facet | Labels |
|---|---|
| people | `quraysh` |
| divine-attributes | `tawhid` |
| worldly-matters | `prayer`, `sacred-mosque-and-qiblah` |

**4 labels. Confidence: high.**

## Section 3 — 106:4 (4) — Fed from hunger and secured from fear

Who has fed them against hunger, and has secured them against fear.

| Facet | Labels |
|---|---|
| people | `quraysh` |
| divine-attributes | `provision`, `mercy` |
| worldly-matters | `sacred-mosque-and-qiblah` |

**4 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "106:1": {
    "labels": [
      "quraysh",
      "trade-and-debt",
      "provision"
    ],
    "confidence": "high"
  },
  "106:3": {
    "labels": [
      "quraysh",
      "tawhid",
      "prayer",
      "sacred-mosque-and-qiblah"
    ],
    "confidence": "high"
  },
  "106:4": {
    "labels": [
      "quraysh",
      "provision",
      "mercy",
      "sacred-mosque-and-qiblah"
    ],
    "confidence": "high"
  },
  "_surah_summary_106": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 3,
      "mean": 3.7,
      "max": 4
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

- Every section in `theme_breaks.json` for Surah 106 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
