# Surah Al-Ma'un (107) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 107:1 (1–3) — Denial shown in orphan mistreatment

Have you considered him who denies the religion? It is he who mistreats the orphan. And does not encourage the feeding of the poor.

| Facet | Labels |
|---|---|
| worldly-matters | `orphan-care`, `zakat-and-charity` |
| negative-attributes | `disbelief`, `greed-and-miserliness` |

**4 labels. Confidence: high.**

## Section 2 — 107:4 (4–6) — Showy, heedless prayer

So woe to those hypocrites who pray. Those who are heedless of their prayers. Those who put on the appearance.

| Facet | Labels |
|---|---|
| people | `hypocrites` |
| worldly-matters | `prayer` |
| ethical-states | `sincerity` |
| negative-attributes | `hypocrisy` |

**4 labels. Confidence: high.**

## Section 3 — 107:7 (7) — Withholding small assistance

And withhold the assistance.

| Facet | Labels |
|---|---|
| worldly-matters | `zakat-and-charity` |
| negative-attributes | `greed-and-miserliness`, `hypocrisy` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "107:1": {
    "labels": [
      "disbelief",
      "orphan-care",
      "zakat-and-charity",
      "greed-and-miserliness"
    ],
    "confidence": "high"
  },
  "107:4": {
    "labels": [
      "hypocrites",
      "prayer",
      "hypocrisy",
      "sincerity"
    ],
    "confidence": "high"
  },
  "107:7": {
    "labels": [
      "zakat-and-charity",
      "greed-and-miserliness",
      "hypocrisy"
    ],
    "confidence": "high"
  },
  "_surah_summary_107": {
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

- Every section in `theme_breaks.json` for Surah 107 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
