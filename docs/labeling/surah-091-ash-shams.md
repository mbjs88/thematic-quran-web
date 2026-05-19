# Surah Ash-Shams (91) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 91:1 (1–10) — Cosmic oaths and the soul

By the sun and its radiance. And the moon as it follows it. And the day as it reveals it. And the night as it conceals it. And the sky and He who built it. And the earth and He who spread it. And the soul and He who proportioned it. And inspired it with its wickedness and its righteousness. Successful is he who purifies it. Failing is he who corrupts it.

| Facet | Labels |
|---|---|
| divine-attributes | `guidance` |
| ethical-states | `righteous-conduct` |
| negative-attributes | `corruption-on-earth` |
| cosmology | `cosmic-bodies`, `creation-of-heavens-earth`, `human-creation` |

**6 labels. Confidence: high.**

## Section 2 — 91:11 (11–14) — Thamud rejects the she-camel sign

Thamood denied in its pride. When it followed its most wicked. The messenger of Allah said to them, “This is the she-camel of Allah, so let her drink.” But they called him a liar, and hamstrung her. So their Lord crushed them for their sin, and leveled it.

| Facet | Labels |
|---|---|
| people | `thamud`, `salih` |
| negative-attributes | `arrogance`, `anger-and-violence` |
| eschatology | `punishment-of-past-nations` |
| cosmology | `natural-signs` |
| revelation | `denial-of-revelation`, `miracles` |

**8 labels. Confidence: medium.** Note: salih is inferred from the she-camel episode; the translation says messenger but does not name him.

## Section 3 — 91:15 (15) — No fear of the consequence

And He does not fear its sequel.

| Facet | Labels |
|---|---|
| divine-attributes | `power`, `justice` |
| eschatology | `punishment-of-past-nations` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "91:1": {
    "labels": [
      "cosmic-bodies",
      "creation-of-heavens-earth",
      "human-creation",
      "guidance",
      "righteous-conduct",
      "corruption-on-earth"
    ],
    "confidence": "high"
  },
  "91:11": {
    "labels": [
      "thamud",
      "salih",
      "arrogance",
      "denial-of-revelation",
      "punishment-of-past-nations",
      "miracles",
      "natural-signs",
      "anger-and-violence"
    ],
    "confidence": "medium",
    "notes": "salih is inferred from the she-camel episode; the translation says messenger but does not name him."
  },
  "91:15": {
    "labels": [
      "power",
      "justice",
      "punishment-of-past-nations"
    ],
    "confidence": "high"
  },
  "_surah_summary_91": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 3,
      "mean": 5.7,
      "max": 8
    },
    "overflowSections": [],
    "lowConfidenceSections": [
      "91:11"
    ],
    "suggestedNewLabels": []
  }
}
```

## Open questions

1. 91:11 tags `salih` by narrative identification, though the translation only says messenger.

## Self-check

- Every section in `theme_breaks.json` for Surah 91 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
