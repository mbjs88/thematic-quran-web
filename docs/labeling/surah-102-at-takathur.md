# Surah At-Takathur (102) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 102:1 (1–4) — Distracted by abundance until graves

Abundance distracts you. Until you visit the graveyards. Indeed, you will know.  Certainly, you will know.

| Facet | Labels |
|---|---|
| negative-attributes | `greed-and-miserliness` |
| eschatology | `reckoning` |
| cosmology | `death-and-dying` |

**3 labels. Confidence: high.**

## Section 2 — 102:5 (5–7) — Certainty and the Inferno

If you knew with knowledge of certainty. You would see the Inferno. Then you will see it with the eye of certainty.

| Facet | Labels |
|---|---|
| divine-attributes | `knowledge` |
| eschatology | `hell`, `reckoning` |

**3 labels. Confidence: high.**

## Section 3 — 102:8 (8) — Questioned about bliss

Then, on that Day, you will be questioned about the Bliss.

| Facet | Labels |
|---|---|
| divine-attributes | `provision` |
| eschatology | `day-of-judgment`, `reckoning` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "102:1": {
    "labels": [
      "greed-and-miserliness",
      "death-and-dying",
      "reckoning"
    ],
    "confidence": "high"
  },
  "102:5": {
    "labels": [
      "knowledge",
      "hell",
      "reckoning"
    ],
    "confidence": "high"
  },
  "102:8": {
    "labels": [
      "day-of-judgment",
      "reckoning",
      "provision"
    ],
    "confidence": "high"
  },
  "_surah_summary_102": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 3,
      "mean": 3.0,
      "max": 3
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

- Every section in `theme_breaks.json` for Surah 102 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
