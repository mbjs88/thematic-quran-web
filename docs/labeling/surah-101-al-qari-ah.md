# Surah Al-Qari'ah (101) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 101:1 (1–3) — The Calamity named

The Shocker. What is the Shocker? What will explain to you what the Shocker is?

| Facet | Labels |
|---|---|
| eschatology | `day-of-judgment` |

**1 labels. Confidence: high.**

## Section 2 — 101:4 (4–9) — Scales, moths, mountains, and destinies

The Day when the people will be like scattered moths. And the mountains will be like tufted wool. As for he whose scales are heavy.  He will be in a pleasant life. But as for he whose scales are light. His home is the Abyss.

| Facet | Labels |
|---|---|
| eschatology | `day-of-judgment`, `resurrection`, `reckoning`, `paradise`, `hell` |
| cosmology | `natural-signs` |

**6 labels. Confidence: high.**

## Section 3 — 101:10 (10) — What is the Abyss

Do you know what it is?

| Facet | Labels |
|---|---|
| eschatology | `hell` |

**1 labels. Confidence: high.**

## Section 4 — 101:11 (11) — Raging Fire

A Raging Fire.

| Facet | Labels |
|---|---|
| eschatology | `hell` |

**1 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "101:1": {
    "labels": [
      "day-of-judgment"
    ],
    "confidence": "high"
  },
  "101:4": {
    "labels": [
      "day-of-judgment",
      "resurrection",
      "natural-signs",
      "reckoning",
      "paradise",
      "hell"
    ],
    "confidence": "high"
  },
  "101:10": {
    "labels": [
      "hell"
    ],
    "confidence": "high"
  },
  "101:11": {
    "labels": [
      "hell"
    ],
    "confidence": "high"
  },
  "_surah_summary_101": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 1,
      "mean": 2.2,
      "max": 6
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

- Every section in `theme_breaks.json` for Surah 101 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
