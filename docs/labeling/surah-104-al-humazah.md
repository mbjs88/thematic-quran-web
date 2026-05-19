# Surah Al-Humazah (104) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 104:1 (1–3) — Slanderer counting wealth

Woe to every slanderer backbiter. Who gathers wealth and counts it over. Thinking that his wealth has made him immortal.

| Facet | Labels |
|---|---|
| negative-attributes | `slander-and-backbiting`, `greed-and-miserliness` |
| cosmology | `death-and-dying` |

**3 labels. Confidence: high.**

## Section 2 — 104:4 (4–5) — Thrown into the Crusher

By no means. He will be thrown into the Crusher. And what will make you realize what the Crusher is?

| Facet | Labels |
|---|---|
| eschatology | `hell`, `reckoning` |

**2 labels. Confidence: high.**

## Section 3 — 104:6 (6–8) — Allahs kindled Fire

Allah's kindled Fire. That laps to the hearts. It closes in on them.

| Facet | Labels |
|---|---|
| eschatology | `hell`, `punishment-of-past-nations` |

**2 labels. Confidence: high.**

## Section 4 — 104:9 (9) — Extended columns

In extended columns.

| Facet | Labels |
|---|---|
| eschatology | `hell` |

**1 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "104:1": {
    "labels": [
      "slander-and-backbiting",
      "greed-and-miserliness",
      "death-and-dying"
    ],
    "confidence": "high"
  },
  "104:4": {
    "labels": [
      "hell",
      "reckoning"
    ],
    "confidence": "high"
  },
  "104:6": {
    "labels": [
      "hell",
      "punishment-of-past-nations"
    ],
    "confidence": "high"
  },
  "104:9": {
    "labels": [
      "hell"
    ],
    "confidence": "high"
  },
  "_surah_summary_104": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 1,
      "mean": 2.0,
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

- Every section in `theme_breaks.json` for Surah 104 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
