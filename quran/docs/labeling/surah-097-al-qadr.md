# Surah Al-Qadr (97) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 97:1 (1–3) — The Night of Decree

We sent it down on the Night of Decree. But what will convey to you what the Night of Decree is? The Night of Decree is better than a thousand months.

| Facet | Labels |
|---|---|
| divine-attributes | `divine-decree`, `power` |
| revelation | `the-quran` |

**3 labels. Confidence: high.**

## Section 2 — 97:4 (4) — Angels descend by command

In it descend the angels and the Spirit, by the leave of their Lord, with every command.

| Facet | Labels |
|---|---|
| people | `angels` |
| divine-attributes | `divine-decree` |
| revelation | `the-quran` |

**3 labels. Confidence: high.**

## Section 3 — 97:5 (5) — Peace until dawn

Peace it is; until the rise of dawn.

| Facet | Labels |
|---|---|
| divine-attributes | `mercy`, `divine-decree` |

**2 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "97:1": {
    "labels": [
      "the-quran",
      "divine-decree",
      "power"
    ],
    "confidence": "high"
  },
  "97:4": {
    "labels": [
      "angels",
      "divine-decree",
      "the-quran"
    ],
    "confidence": "high"
  },
  "97:5": {
    "labels": [
      "mercy",
      "divine-decree"
    ],
    "confidence": "high"
  },
  "_surah_summary_97": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 2,
      "mean": 2.7,
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

- Every section in `theme_breaks.json` for Surah 97 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
