# Surah Al-Layl (92) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 92:1 (1–4) — Night, day, and diverse striving

By the night as it covers. And the day as it reveals. And He who created the male and the female. Your endeavors are indeed diverse.

| Facet | Labels |
|---|---|
| people | `mankind` |
| divine-attributes | `creation` |
| cosmology | `cosmic-bodies`, `human-creation` |

**4 labels. Confidence: high.**

## Section 2 — 92:5 (5–11) — Giving versus miserliness

As for him who gives and is righteous. And confirms goodness. We will ease his way towards ease. But as for him who is stingy and complacent. And denies goodness. We will ease his way towards difficulty. And his money will not avail him when he plummets.

| Facet | Labels |
|---|---|
| divine-attributes | `guidance` |
| worldly-matters | `zakat-and-charity` |
| ethical-states | `taqwa`, `righteous-conduct` |
| negative-attributes | `greed-and-miserliness` |
| revelation | `denial-of-revelation` |

**6 labels. Confidence: high.**

## Section 3 — 92:12 (12–20) — Guidance, blaze, and sincere giving

It is upon Us to guide. And to Us belong the Last and the First. I have warned you of a Fierce Blaze. None will burn in it except the very wicked. He who denies and turns away. But the devout will avoid it. He who gives his money to become pure. Seeking no favor in return. Only seeking the acceptance of his Lord, the Most High.

| Facet | Labels |
|---|---|
| divine-attributes | `guidance`, `sovereignty` |
| worldly-matters | `zakat-and-charity` |
| ethical-states | `sincerity`, `taqwa` |
| negative-attributes | `disbelief` |
| eschatology | `hell` |

**7 labels. Confidence: high.**

## Section 4 — 92:21 (21) — Final satisfaction

And he will be satisfied.

| Facet | Labels |
|---|---|
| divine-attributes | `mercy` |
| eschatology | `paradise` |

**2 labels. Confidence: medium.** Note: paradise is inferred from the promised satisfaction of the devout in context.

---

## JSON snippet for `assignments.json`

```json
{
  "92:1": {
    "labels": [
      "cosmic-bodies",
      "creation",
      "human-creation",
      "mankind"
    ],
    "confidence": "high"
  },
  "92:5": {
    "labels": [
      "zakat-and-charity",
      "taqwa",
      "righteous-conduct",
      "greed-and-miserliness",
      "denial-of-revelation",
      "guidance"
    ],
    "confidence": "high"
  },
  "92:12": {
    "labels": [
      "guidance",
      "sovereignty",
      "hell",
      "disbelief",
      "zakat-and-charity",
      "sincerity",
      "taqwa"
    ],
    "confidence": "high"
  },
  "92:21": {
    "labels": [
      "paradise",
      "mercy"
    ],
    "confidence": "medium",
    "notes": "paradise is inferred from the promised satisfaction of the devout in context."
  },
  "_surah_summary_92": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 2,
      "mean": 4.8,
      "max": 7
    },
    "overflowSections": [],
    "lowConfidenceSections": [
      "92:21"
    ],
    "suggestedNewLabels": []
  }
}
```

## Open questions

1. Review `92:21` medium-confidence note: paradise is inferred from the promised satisfaction of the devout in context..

## Self-check

- Every section in `theme_breaks.json` for Surah 92 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
