# Surah Al-Falaq (113) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 113:1 (1–2) — Refuge in the Lord of daybreak

Say, “I take refuge with the Lord of Daybreak. From the evil of what He created.

| Facet | Labels |
|---|---|
| divine-attributes | `tawhid`, `creation` |
| dua | `dua-protection` |
| revelation | `qul-statements` |

**4 labels. Confidence: high.**

## Section 2 — 113:3 (3–4) — Protection from darkness and sorcery

And from the evil of the darkness as it gathers. And from the evil of those who practice sorcery.

| Facet | Labels |
|---|---|
| dua | `dua-protection` |
| negative-attributes | `sorcery` |
| cosmology | `cosmic-bodies` |

**3 labels. Confidence: high.**

## Section 3 — 113:5 (5) — Protection from envy

And from the evil of an envious when he envies.”

| Facet | Labels |
|---|---|
| dua | `dua-protection` |
| negative-attributes | `envy` |

**2 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "113:1": {
    "labels": [
      "qul-statements",
      "dua-protection",
      "tawhid",
      "creation"
    ],
    "confidence": "high"
  },
  "113:3": {
    "labels": [
      "dua-protection",
      "sorcery",
      "cosmic-bodies"
    ],
    "confidence": "high"
  },
  "113:5": {
    "labels": [
      "dua-protection",
      "envy"
    ],
    "confidence": "high"
  },
  "_surah_summary_113": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 2,
      "mean": 3.0,
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

- Every section in `theme_breaks.json` for Surah 113 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
