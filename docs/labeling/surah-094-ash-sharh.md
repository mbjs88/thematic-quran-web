# Surah Ash-Sharh (94) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 94:1 (1–4) — Relief and raised mention

Did We not soothe your heart? And lift from you your burden. Which weighed down your back? And raised for you your reputation?

| Facet | Labels |
|---|---|
| people | `muhammad` |
| divine-attributes | `mercy`, `nearness-and-response` |
| ethical-states | `remembrance` |

**4 labels. Confidence: high.**

## Section 2 — 94:5 (5–7) — Ease with hardship

With hardship comes ease. With hardship comes ease. When your work is done, turn to devotion.

| Facet | Labels |
|---|---|
| divine-attributes | `mercy` |
| worldly-matters | `prayer` |
| ethical-states | `patience` |

**3 labels. Confidence: high.**

## Section 3 — 94:8 (8) — Turning to the Lord

And to your Lord turn for everything.

| Facet | Labels |
|---|---|
| divine-attributes | `nearness-and-response` |
| worldly-matters | `prayer` |
| ethical-states | `trust-in-god`, `sincerity` |

**4 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "94:1": {
    "labels": [
      "muhammad",
      "mercy",
      "nearness-and-response",
      "remembrance"
    ],
    "confidence": "high"
  },
  "94:5": {
    "labels": [
      "mercy",
      "patience",
      "prayer"
    ],
    "confidence": "high"
  },
  "94:8": {
    "labels": [
      "prayer",
      "trust-in-god",
      "sincerity",
      "nearness-and-response"
    ],
    "confidence": "high"
  },
  "_surah_summary_94": {
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

- Every section in `theme_breaks.json` for Surah 94 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
