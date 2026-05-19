# Surah Al-Jumu'ah (62) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 62:1 (1–5) — Glorification, Messenger, and Torah burden

Everything in the heavens and the earth glorifies Allah the Sovereign, the Holy, the Almighty, the Wise. It is He who sent among the unlettered a messenger from themselves; reciting His revelations to them, and purifying them, and teaching them the Scripture and wisdom; although they were in obvious error before that. And others from them, who have not yet joined them. He is the Glorious, the Wise. That is Allah’s grace, which He grants to whomever He wills. Allah is Possessor of limitless grace. The example of those who were entrusted with the Torah, but then failed to uphold it, is like the donkey carrying works of literature. Miserable is the example of the people who denounce Allah’s revelations. Allah does not guide the wrongdoing people.

| Facet | Labels |
|---|---|
| people | `muhammad`, `people-of-the-book` |
| divine-attributes | `sovereignty`, `power`, `wisdom`, `guidance` |
| ethical-states | `praise` |
| revelation | `the-quran`, `previous-scriptures`, `denial-of-revelation` |

**10 labels. Confidence: high.**

## Section 2 — 62:6 (6–8) — Challenge to claimants of election

Say, “O you who follow Judaism; if you claim to be the chosen of Allah, to the exclusion of the rest of mankind, then wish for death if you are sincere.” But they will not wish for it, ever, due to what their hands have advanced. Allah knows well the wrongdoers. Say, “The death from which you flee will catch up with you; then you will be returned to the Knower of the Invisible and the Visible, and He will inform you of what you used to do.”

| Facet | Labels |
|---|---|
| people | `people-of-the-book`, `mankind` |
| divine-attributes | `knowledge` |
| ethical-states | `sincerity` |
| eschatology | `reckoning` |
| cosmology | `death-and-dying` |
| revelation | `qul-statements` |

**7 labels. Confidence: high.**

## Section 3 — 62:9 (9–10) — Friday prayer and trade

O you who believe! When the call is made for prayer on Congregation Day, hasten to the remembrance of Allah, and drop all business. That is better for you, if you only knew. Then, when the prayer is concluded, disperse through the land, and seek Allah’s bounty, and remember Allah much, so that you may prosper.

| Facet | Labels |
|---|---|
| people | `believers` |
| divine-attributes | `provision` |
| worldly-matters | `prayer`, `trade-and-debt` |
| ethical-states | `remembrance` |

**5 labels. Confidence: high.**

## Section 4 — 62:11 (11) — Leaving the Prophet for trade

Yet whenever they come across some business, or some entertainment, they scramble towards it, and leave you standing. Say, “What is with Allah is better than entertainment and business; and Allah is the Best of providers.”

| Facet | Labels |
|---|---|
| people | `muhammad` |
| divine-attributes | `provision` |
| worldly-matters | `trade-and-debt` |
| ethical-states | `remembrance` |
| revelation | `qul-statements` |

**5 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "62:1": {
    "labels": [
      "praise",
      "sovereignty",
      "power",
      "wisdom",
      "muhammad",
      "the-quran",
      "guidance",
      "previous-scriptures",
      "people-of-the-book",
      "denial-of-revelation"
    ],
    "confidence": "high"
  },
  "62:6": {
    "labels": [
      "people-of-the-book",
      "mankind",
      "qul-statements",
      "death-and-dying",
      "knowledge",
      "reckoning",
      "sincerity"
    ],
    "confidence": "high"
  },
  "62:9": {
    "labels": [
      "believers",
      "prayer",
      "remembrance",
      "trade-and-debt",
      "provision"
    ],
    "confidence": "high"
  },
  "62:11": {
    "labels": [
      "muhammad",
      "qul-statements",
      "trade-and-debt",
      "provision",
      "remembrance"
    ],
    "confidence": "high"
  },
  "_surah_summary_62": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 5,
      "mean": 6.8,
      "max": 10
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

- Every section in `theme_breaks.json` for Surah 62 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
