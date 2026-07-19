# Surah At-Tin (95) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 95:1 (1–3) — Fig, olive, Sinai, and safe land

By the fig and the olive. And Mount Sinai. And this safe land.

| Facet | Labels |
|---|---|
| people | `moses` |
| worldly-matters | `sacred-mosque-and-qiblah` |
| cosmology | `natural-signs` |

**3 labels. Confidence: medium.** Note: moses is inferred from Mount Sinai; sacred-mosque-and-qiblah from the safe land as Mecca.

## Section 2 — 95:4 (4–5) — Human created in best form

We created man in the best design. Then reduced him to the lowest of the low.

| Facet | Labels |
|---|---|
| people | `mankind` |
| divine-attributes | `creation` |
| cosmology | `human-creation` |

**3 labels. Confidence: high.**

## Section 3 — 95:6 (6–7) — Belief, deeds, and religion rejected

Except those who believe and do righteous deeds; for them is a reward without end. So why do you still reject the religion?

| Facet | Labels |
|---|---|
| people | `believers` |
| ethical-states | `righteous-conduct` |
| negative-attributes | `disbelief` |
| eschatology | `paradise` |

**4 labels. Confidence: high.**

## Section 4 — 95:8 (8) — Wisest judge

Is Allah not the Wisest of the wise?

| Facet | Labels |
|---|---|
| divine-attributes | `wisdom`, `justice` |

**2 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "95:1": {
    "labels": [
      "natural-signs",
      "moses",
      "sacred-mosque-and-qiblah"
    ],
    "confidence": "medium",
    "notes": "moses is inferred from Mount Sinai; sacred-mosque-and-qiblah from the safe land as Mecca."
  },
  "95:4": {
    "labels": [
      "human-creation",
      "creation",
      "mankind"
    ],
    "confidence": "high"
  },
  "95:6": {
    "labels": [
      "believers",
      "righteous-conduct",
      "paradise",
      "disbelief"
    ],
    "confidence": "high"
  },
  "95:8": {
    "labels": [
      "wisdom",
      "justice"
    ],
    "confidence": "high"
  },
  "_surah_summary_95": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 2,
      "mean": 3.0,
      "max": 4
    },
    "overflowSections": [],
    "lowConfidenceSections": [
      "95:1"
    ],
    "suggestedNewLabels": []
  }
}
```

## Open questions

1. Review `95:1` medium-confidence note: moses is inferred from Mount Sinai; sacred-mosque-and-qiblah from the safe land as Mecca..

## Self-check

- Every section in `theme_breaks.json` for Surah 95 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
