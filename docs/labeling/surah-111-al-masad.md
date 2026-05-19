# Surah Al-Masad (111) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 111:1 (1–3) — Abu Lahab condemned

Condemned are the hands of Abee Lahab, and he is condemned. His wealth did not avail him, nor did what he acquired. He will burn in a Flaming Fire.

| Facet | Labels |
|---|---|
| people | `disbelievers` |
| negative-attributes | `greed-and-miserliness` |
| eschatology | `hell` |

**3 labels. Confidence: high.**

## Section 2 — 111:4 (4) — His wife the firewood carrier

And his wife—the firewood carrier.

| Facet | Labels |
|---|---|
| people | `disbelievers` |
| negative-attributes | `slander-and-backbiting` |
| eschatology | `hell` |

**3 labels. Confidence: medium.** Note: slander-and-backbiting reflects the traditional reading of the firewood carrier as carrying harm/slander; review if sticking only to surface translation.

## Section 3 — 111:5 (5) — Rope of thorns

Around her neck is a rope of thorns.

| Facet | Labels |
|---|---|
| eschatology | `hell`, `punishment-of-past-nations` |

**2 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "111:1": {
    "labels": [
      "disbelievers",
      "greed-and-miserliness",
      "hell"
    ],
    "confidence": "high"
  },
  "111:4": {
    "labels": [
      "disbelievers",
      "hell",
      "slander-and-backbiting"
    ],
    "confidence": "medium",
    "notes": "slander-and-backbiting reflects the traditional reading of the firewood carrier as carrying harm/slander; review if sticking only to surface translation."
  },
  "111:5": {
    "labels": [
      "hell",
      "punishment-of-past-nations"
    ],
    "confidence": "high"
  },
  "_surah_summary_111": {
    "sectionsLabeled": 3,
    "sectionsTotal": 3,
    "labelsPerSection": {
      "min": 2,
      "mean": 2.7,
      "max": 3
    },
    "overflowSections": [],
    "lowConfidenceSections": [
      "111:4"
    ],
    "suggestedNewLabels": []
  }
}
```

## Open questions

1. 111:4 tags `slander-and-backbiting` by traditional reading of the firewood carrier; review if requiring surface text only.

## Self-check

- Every section in `theme_breaks.json` for Surah 111 has an entry: 3 / 3.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
