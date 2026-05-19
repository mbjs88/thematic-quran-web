# Surah Ad-Duhaa (93) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 93:1 (1–5) — Consolation and future gift

By the morning light. And the night as it settles. Your Lord did not abandon you, nor did He forget. The Hereafter is better for you than the First. And your Lord will give you, and you will be satisfied.

| Facet | Labels |
|---|---|
| people | `muhammad` |
| divine-attributes | `mercy`, `provision` |
| eschatology | `day-of-judgment` |
| cosmology | `cosmic-bodies` |

**5 labels. Confidence: high.**

## Section 2 — 93:6 (6–8) — Shelter, guidance, and enrichment

Did He not find you orphaned, and sheltered you? And found you wandering, and guided you? And found you in need, and enriched you?

| Facet | Labels |
|---|---|
| people | `muhammad` |
| divine-attributes | `guidance`, `provision`, `mercy` |
| worldly-matters | `orphan-care` |

**5 labels. Confidence: high.**

## Section 3 — 93:9 (9–10) — Do not mistreat orphan or seeker

Therefore, do not mistreat the orphan. Nor rebuff the seeker.

| Facet | Labels |
|---|---|
| divine-attributes | `mercy` |
| worldly-matters | `orphan-care`, `zakat-and-charity` |

**3 labels. Confidence: high.**

## Section 4 — 93:11 (11) — Proclaim blessing

But proclaim the blessings of your Lord.

| Facet | Labels |
|---|---|
| divine-attributes | `provision` |
| ethical-states | `gratitude`, `praise` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "93:1": {
    "labels": [
      "muhammad",
      "mercy",
      "day-of-judgment",
      "provision",
      "cosmic-bodies"
    ],
    "confidence": "high"
  },
  "93:6": {
    "labels": [
      "muhammad",
      "orphan-care",
      "guidance",
      "provision",
      "mercy"
    ],
    "confidence": "high"
  },
  "93:9": {
    "labels": [
      "orphan-care",
      "zakat-and-charity",
      "mercy"
    ],
    "confidence": "high"
  },
  "93:11": {
    "labels": [
      "gratitude",
      "provision",
      "praise"
    ],
    "confidence": "high"
  },
  "_surah_summary_93": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 3,
      "mean": 4.0,
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

- Every section in `theme_breaks.json` for Surah 93 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
