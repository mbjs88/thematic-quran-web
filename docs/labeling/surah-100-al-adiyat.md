# Surah Al-'Adiyat (100) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 100:1 (1–5) — Charging steeds and raid scene

By the racers panting. Igniting sparks. Raiding at dawn. Raising clouds of dust. Storming into the midst.

| Facet | Labels |
|---|---|
| worldly-matters | `war-and-treaties` |
| cosmology | `natural-signs` |

**2 labels. Confidence: medium.** Note: war-and-treaties reflects the raiding cavalry scene; natural-signs tags the animal imagery.

## Section 2 — 100:6 (6–8) — Human ingratitude and love of wealth

Indeed, the human being is ungrateful to his Lord. And he bears witness to that. And he is fierce in his love of wealth.

| Facet | Labels |
|---|---|
| people | `mankind` |
| ethical-states | `gratitude` |
| negative-attributes | `greed-and-miserliness` |

**3 labels. Confidence: high.**

## Section 3 — 100:9 (9–10) — Graves and hearts exposed

Does he not know? When the contents of the graves are scattered around. And the contents of the hearts are obtained.

| Facet | Labels |
|---|---|
| divine-attributes | `knowledge` |
| eschatology | `resurrection`, `reckoning` |
| cosmology | `death-and-dying` |

**4 labels. Confidence: high.**

## Section 4 — 100:11 (11) — Lord fully informed

Their Lord, on that Day, is fully informed of them.

| Facet | Labels |
|---|---|
| divine-attributes | `knowledge` |
| eschatology | `day-of-judgment`, `reckoning` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "100:1": {
    "labels": [
      "war-and-treaties",
      "natural-signs"
    ],
    "confidence": "medium",
    "notes": "war-and-treaties reflects the raiding cavalry scene; natural-signs tags the animal imagery."
  },
  "100:6": {
    "labels": [
      "mankind",
      "gratitude",
      "greed-and-miserliness"
    ],
    "confidence": "high"
  },
  "100:9": {
    "labels": [
      "resurrection",
      "reckoning",
      "death-and-dying",
      "knowledge"
    ],
    "confidence": "high"
  },
  "100:11": {
    "labels": [
      "day-of-judgment",
      "knowledge",
      "reckoning"
    ],
    "confidence": "high"
  },
  "_surah_summary_100": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 2,
      "mean": 3.0,
      "max": 4
    },
    "overflowSections": [],
    "lowConfidenceSections": [
      "100:1"
    ],
    "suggestedNewLabels": []
  }
}
```

## Open questions

1. Review `100:1` medium-confidence note: war-and-treaties reflects the raiding cavalry scene; natural-signs tags the animal imagery..

## Self-check

- Every section in `theme_breaks.json` for Surah 100 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
