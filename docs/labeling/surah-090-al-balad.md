# Surah Al-Balad (90) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 90:1 (1–5) — Oath by the city and human distress

I swear by this land. And you are a resident of this land. And by a father and what he fathered. We created man in distress. Does he think that no one has power over him?

| Facet | Labels |
|---|---|
| people | `muhammad`, `mankind` |
| divine-attributes | `power` |
| worldly-matters | `sacred-mosque-and-qiblah` |
| cosmology | `human-creation` |

**5 labels. Confidence: medium.** Note: sacred-mosque-and-qiblah is inferred from 'this land' as the sacred city; review if using only surface translation.

## Section 2 — 90:6 (6–10) — Boasting wealth and human faculties

He says, “I have used up so much money.” Does he think that no one sees him? Did We not give him two eyes? And a tongue, and two lips? And We showed him the two ways?

| Facet | Labels |
|---|---|
| people | `mankind` |
| divine-attributes | `knowledge`, `creation`, `guidance`, `provision` |
| negative-attributes | `greed-and-miserliness` |

**6 labels. Confidence: high.**

## Section 3 — 90:11 (11–19) — The steep path of freeing and feeding

But he did not brave the ascent. And what will explain to you what the ascent is? The freeing of a slave. Or the feeding on a day of hunger. An orphan near of kin. Or a destitute in the dust. Then he becomes of those who believe, and advise one another to patience, and advise one another to kindness. These are the people of happiness. But as for those who defy Our revelations—these are the people of misery.

| Facet | Labels |
|---|---|
| people | `believers` |
| divine-attributes | `mercy` |
| worldly-matters | `manumission-and-captives`, `zakat-and-charity`, `orphan-care` |
| ethical-states | `patience`, `righteous-conduct` |
| revelation | `denial-of-revelation` |

**8 labels. Confidence: high.**

## Section 4 — 90:20 (20) — Padlocked Fire

Upon them is a padlocked Fire.

| Facet | Labels |
|---|---|
| eschatology | `hell` |
| revelation | `denial-of-revelation` |

**2 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "90:1": {
    "labels": [
      "muhammad",
      "mankind",
      "human-creation",
      "power",
      "sacred-mosque-and-qiblah"
    ],
    "confidence": "medium",
    "notes": "sacred-mosque-and-qiblah is inferred from 'this land' as the sacred city; review if using only surface translation."
  },
  "90:6": {
    "labels": [
      "mankind",
      "greed-and-miserliness",
      "knowledge",
      "creation",
      "guidance",
      "provision"
    ],
    "confidence": "high"
  },
  "90:11": {
    "labels": [
      "believers",
      "manumission-and-captives",
      "zakat-and-charity",
      "orphan-care",
      "patience",
      "mercy",
      "denial-of-revelation",
      "righteous-conduct"
    ],
    "confidence": "high"
  },
  "90:20": {
    "labels": [
      "hell",
      "denial-of-revelation"
    ],
    "confidence": "high"
  },
  "_surah_summary_90": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 2,
      "mean": 5.2,
      "max": 8
    },
    "overflowSections": [],
    "lowConfidenceSections": [
      "90:1"
    ],
    "suggestedNewLabels": []
  }
}
```

## Open questions

1. Review `90:1` medium-confidence note: sacred-mosque-and-qiblah is inferred from 'this land' as the sacred city; review if using only surface translation..

## Self-check

- Every section in `theme_breaks.json` for Surah 90 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
