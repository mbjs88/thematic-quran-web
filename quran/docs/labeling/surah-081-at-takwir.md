# Surah At-Takwir (81) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 81:1 (1–14) — Cosmic upheaval and each soul knowing

When the sun is rolled up. When the stars are dimmed. When the mountains are set in motion. When the relationships are suspended. When the beasts are gathered. When the oceans are set aflame. When the souls are paired. When the girl, buried alive, is asked: For what crime was she killed? When the records are made public. When the sky is peeled away. When the Fire is set ablaze. When Paradise is brought near. Each soul will know what it has readied.

| Facet | Labels |
|---|---|
| negative-attributes | `anger-and-violence` |
| eschatology | `day-of-judgment`, `resurrection`, `hell`, `paradise`, `reckoning` |
| cosmology | `cosmic-bodies`, `natural-signs`, `creation-of-heavens-earth` |

**9 labels. Confidence: high.**

## Section 2 — 81:15 (15–26) — Oaths, noble messenger, and revelation

I swear by the galaxies. Precisely running their courses. And by the night as it recedes. And by the morn as it breathes. This is the speech of a noble messenger. Endowed with power, eminent with the Lord of the Throne.  Obeyed and honest. Your friend is not possessed. He saw him on the luminous horizon. And He does not withhold knowledge of the Unseen. And it is not the word of an accursed devil. So where are you heading?

| Facet | Labels |
|---|---|
| people | `angels`, `muhammad`, `iblis` |
| divine-attributes | `knowledge` |
| negative-attributes | `disbelief` |
| cosmology | `cosmic-bodies` |
| revelation | `the-quran`, `prophethood-general` |

**8 labels. Confidence: high.**

## Section 3 — 81:27 (27–28) — Reminder for mankind

It is only a Reminder to all mankind. To whoever of you wills to go straight.

| Facet | Labels |
|---|---|
| people | `mankind` |
| divine-attributes | `guidance` |
| revelation | `the-quran` |

**3 labels. Confidence: high.**

## Section 4 — 81:29 (29) — Will under Allahs will

But you cannot will, unless Allah wills—The Lord of the Worlds.

| Facet | Labels |
|---|---|
| divine-attributes | `divine-decree`, `sovereignty`, `guidance` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "81:1": {
    "labels": [
      "day-of-judgment",
      "cosmic-bodies",
      "natural-signs",
      "creation-of-heavens-earth",
      "resurrection",
      "hell",
      "paradise",
      "reckoning",
      "anger-and-violence"
    ],
    "confidence": "high"
  },
  "81:15": {
    "labels": [
      "cosmic-bodies",
      "angels",
      "muhammad",
      "the-quran",
      "prophethood-general",
      "knowledge",
      "iblis",
      "disbelief"
    ],
    "confidence": "high"
  },
  "81:27": {
    "labels": [
      "the-quran",
      "mankind",
      "guidance"
    ],
    "confidence": "high"
  },
  "81:29": {
    "labels": [
      "divine-decree",
      "sovereignty",
      "guidance"
    ],
    "confidence": "high"
  },
  "_surah_summary_81": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 3,
      "mean": 5.8,
      "max": 9
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

- Every section in `theme_breaks.json` for Surah 81 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
