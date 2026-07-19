# Surah Al-Fil (105) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 105:1 (1–2) — People of the Elephant and failed plotting

Have you not considered how your Lord dealt with the People of the Elephant? Did He not make their plan go wrong?

| Facet | Labels |
|---|---|
| people | `quraysh` |
| divine-attributes | `power` |
| negative-attributes | `plotting` |
| eschatology | `punishment-of-past-nations` |

**4 labels. Confidence: medium.** Note: quraysh is contextually implied by the attack on the House in Mecca; the translation names People of the Elephant, not Quraysh.

## Section 2 — 105:3 (3–4) — Birds and stones sent against them

He sent against them swarms of birds. Throwing at them rocks of baked clay.

| Facet | Labels |
|---|---|
| divine-attributes | `power` |
| eschatology | `punishment-of-past-nations` |
| cosmology | `natural-signs` |
| revelation | `miracles` |

**4 labels. Confidence: high.**

## Section 3 — 105:5 (5) — Left like chewed leaves

Leaving them like chewed-up leaves.

| Facet | Labels |
|---|---|
| divine-attributes | `power` |
| eschatology | `punishment-of-past-nations` |

**2 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "105:1": {
    "labels": [
      "quraysh",
      "plotting",
      "punishment-of-past-nations",
      "power"
    ],
    "confidence": "medium",
    "notes": "quraysh is contextually implied by the attack on the House in Mecca; the translation names People of the Elephant, not Quraysh."
  },
  "105:3": {
    "labels": [
      "natural-signs",
      "miracles",
      "punishment-of-past-nations",
      "power"
    ],
    "confidence": "high"
  },
  "105:5": {
    "labels": [
      "punishment-of-past-nations",
      "power"
    ],
    "confidence": "high"
  },
  "_surah_summary_105": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 2,
      "mean": 3.3,
      "max": 4
    },
    "overflowSections": [],
    "lowConfidenceSections": [
      "105:1"
    ],
    "suggestedNewLabels": []
  }
}
```

## Open questions

1. 105:1 tags `quraysh` contextually because the Elephant attack targets the House linked to Quraysh security in Surah 106.

## Self-check

- Every section in `theme_breaks.json` for Surah 105 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
