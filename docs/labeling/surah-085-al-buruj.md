# Surah Al-Buruj (85) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 85:1 (1–9) — Constellations, promised Day, and trench persecution

By the sky with the constellations. And by the Promised Day. And by the witness and the witnessed. Destroyed were the People of the Trench. The fire supplied with fuel. While they sat around it. And were witnessing what they did to the believers.  They begrudged them only because they believed in Allah the Almighty, the Praiseworthy. To Whom belongs the sovereignty of the heavens and the earth. Allah is witness over everything.

| Facet | Labels |
|---|---|
| people | `believers` |
| divine-attributes | `power`, `sovereignty` |
| worldly-matters | `justice-and-witness` |
| ethical-states | `praise` |
| negative-attributes | `anger-and-violence` |
| eschatology | `day-of-judgment`, `hell` |
| cosmology | `cosmic-bodies`, `creation-of-heavens-earth` |

**10 labels. Confidence: high.**

## Section 2 — 85:10 (10–11) — Persecutors and righteous believers

Those who tempt the believers, men and women, then do not repent; for them is the punishment of Hell; for them is the punishment of Burning. Those who believe and do righteous deeds will have Gardens beneath which rivers flow. That is the great triumph.

| Facet | Labels |
|---|---|
| people | `believers` |
| ethical-states | `repentance`, `righteous-conduct` |
| eschatology | `hell`, `paradise` |

**5 labels. Confidence: high.**

## Section 3 — 85:12 (12–21) — Severe grasp, Pharaoh, Thamud, and glorious Quran

The onslaught of your Lord is severe. It is He who begins and repeats. And He is the Forgiving, the Loving. Possessor of the Glorious Throne. Doer of whatever He wills. Has there come to you the story of the legions? Of Pharaoh and Thamood? In fact, those who disbelieve are in denial. And Allah encloses them from beyond. In fact, it is a Glorious Quran.

| Facet | Labels |
|---|---|
| people | `pharaoh`, `thamud`, `disbelievers` |
| divine-attributes | `power`, `creation`, `mercy`, `sovereignty`, `divine-decree` |
| eschatology | `resurrection` |
| revelation | `denial-of-revelation`, `the-quran` |

**11 labels. Confidence: high.**

## Section 4 — 85:22 (22) — Preserved Tablet

In a Preserved Tablet.

| Facet | Labels |
|---|---|
| divine-attributes | `divine-decree` |
| revelation | `the-quran` |

**2 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "85:1": {
    "labels": [
      "cosmic-bodies",
      "day-of-judgment",
      "believers",
      "anger-and-violence",
      "hell",
      "power",
      "praise",
      "sovereignty",
      "creation-of-heavens-earth",
      "justice-and-witness"
    ],
    "confidence": "high"
  },
  "85:10": {
    "labels": [
      "believers",
      "repentance",
      "hell",
      "paradise",
      "righteous-conduct"
    ],
    "confidence": "high"
  },
  "85:12": {
    "labels": [
      "power",
      "creation",
      "resurrection",
      "mercy",
      "sovereignty",
      "divine-decree",
      "pharaoh",
      "thamud",
      "disbelievers",
      "denial-of-revelation",
      "the-quran"
    ],
    "confidence": "high"
  },
  "85:22": {
    "labels": [
      "the-quran",
      "divine-decree"
    ],
    "confidence": "high"
  },
  "_surah_summary_85": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 2,
      "mean": 7.0,
      "max": 11
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

- Every section in `theme_breaks.json` for Surah 85 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
