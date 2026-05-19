# Surah An-Nas (114) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 114:1 (1–3) — Refuge in Lord, King, God of mankind

Say, “I seek refuge in the Lord of mankind. The King of mankind. The God of mankind.

| Facet | Labels |
|---|---|
| people | `mankind` |
| divine-attributes | `tawhid`, `sovereignty` |
| dua | `dua-protection` |
| revelation | `qul-statements` |

**5 labels. Confidence: high.**

## Section 2 — 114:4 (4–5) — Protection from whispering

From the evil of the sneaky whisperer. Who whispers into the hearts of people.

| Facet | Labels |
|---|---|
| people | `iblis`, `mankind` |
| dua | `dua-protection` |

**3 labels. Confidence: medium.** Note: iblis is used for Satanic whispering even though the translation says the sneaky whisperer rather than naming Iblis.

## Section 3 — 114:6 (6) — Whisperers from jinn and mankind

From among jinn and among people.”

| Facet | Labels |
|---|---|
| people | `jinn`, `mankind` |
| dua | `dua-protection` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "114:1": {
    "labels": [
      "qul-statements",
      "dua-protection",
      "mankind",
      "tawhid",
      "sovereignty"
    ],
    "confidence": "high"
  },
  "114:4": {
    "labels": [
      "dua-protection",
      "iblis",
      "mankind"
    ],
    "confidence": "medium",
    "notes": "iblis is used for Satanic whispering even though the translation says the sneaky whisperer rather than naming Iblis."
  },
  "114:6": {
    "labels": [
      "jinn",
      "mankind",
      "dua-protection"
    ],
    "confidence": "high"
  },
  "_surah_summary_114": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 3,
      "mean": 3.7,
      "max": 5
    },
    "overflowSections": [],
    "lowConfidenceSections": [
      "114:4"
    ],
    "suggestedNewLabels": []
  }
}
```

## Open questions

1. 114:4 tags `iblis` for Satanic whispering even though the verse says whisperer rather than naming Iblis.

## Self-check

- Every section in `theme_breaks.json` for Surah 114 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
