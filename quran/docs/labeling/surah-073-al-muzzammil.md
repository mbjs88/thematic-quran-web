# Surah Al-Muzzammil (73) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 73:1 (1–9) — Night vigil and heavy revelation

O you Enwrapped one. Stay up the night, except a little. For half of it, or reduce it a little. Or add to it; and chant the Quran rhythmically. We are about to give you a heavy message. The vigil of night is more effective, and better suited for recitation. In the daytime, you have lengthy work to do. So remember the Name of your Lord, and devote yourself to Him wholeheartedly. Lord of the East and the West. There is no god but He, so take Him as a Trustee.

| Facet | Labels |
|---|---|
| people | `muhammad` |
| divine-attributes | `tawhid` |
| worldly-matters | `prayer` |
| ethical-states | `remembrance`, `sincerity`, `trust-in-god` |
| revelation | `the-quran` |

**7 labels. Confidence: high.**

## Section 2 — 73:10 (10–14) — Patience before deniers and the Day

And endure patiently what they say, and withdraw from them politely. And leave Me to those who deny the truth, those of luxury, and give them a brief respite. With Us are shackles, and a Fierce Fire. And food that chokes, and a painful punishment. On the Day when the earth and the mountains tremble, and the mountains become heaps of sand.

| Facet | Labels |
|---|---|
| ethical-states | `patience` |
| eschatology | `hell`, `day-of-judgment`, `punishment-of-past-nations` |
| cosmology | `natural-signs` |
| revelation | `denial-of-revelation` |

**6 labels. Confidence: high.**

## Section 3 — 73:15 (15–19) — Messenger witness and Pharaoh warning

We have sent to you a messenger, a witness over you, as We sent to Pharaoh a messenger. But Pharaoh defied the Messenger, so We seized him with a terrible seizing. So how will you, if you persist in unbelief, save yourself from a Day which will turn the children gray-haired? The heaven will shatter thereby. His promise is always fulfilled. This is a reminder. So whoever wills, let him take a path to his Lord.

| Facet | Labels |
|---|---|
| people | `muhammad`, `pharaoh` |
| divine-attributes | `guidance` |
| ethical-states | `remembrance` |
| negative-attributes | `disbelief` |
| eschatology | `punishment-of-past-nations`, `day-of-judgment` |
| cosmology | `natural-signs` |
| revelation | `prophethood-general` |

**9 labels. Confidence: high.**

## Section 4 — 73:20 (20) — Eased night recitation and core duties

Your Lord knows that you stay up nearly two-thirds of the night, or half of it, or one-third of it, along with a group of those with you. Allah designed the night and the day. He knows that you are unable to sustain it, so He has pardoned you. So read of the Quran what is possible for you. He knows that some of you may be ill; and others travelling through the land, seeking Allah’s bounty; and others fighting in Allah’s cause. So read of it what is possible for you, and observe the prayers, and give regular charity, and lend Allah a generous loan. Whatever good you advance for yourselves, you will find it with Allah, better and generously rewarded. And seek Allah’s forgiveness, for Allah is Forgiving and Merciful.

| Facet | Labels |
|---|---|
| people | `muhammad`, `believers` |
| divine-attributes | `knowledge`, `mercy` |
| dua | `dua-forgiveness` |
| worldly-matters | `prayer`, `zakat-and-charity`, `trade-and-debt`, `war-and-treaties` |
| ethical-states | `righteous-conduct` |
| cosmology | `cosmic-bodies` |
| revelation | `the-quran` |

**12 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "73:1": {
    "labels": [
      "muhammad",
      "prayer",
      "the-quran",
      "remembrance",
      "sincerity",
      "tawhid",
      "trust-in-god"
    ],
    "confidence": "high"
  },
  "73:10": {
    "labels": [
      "patience",
      "denial-of-revelation",
      "hell",
      "day-of-judgment",
      "punishment-of-past-nations",
      "natural-signs"
    ],
    "confidence": "high"
  },
  "73:15": {
    "labels": [
      "muhammad",
      "pharaoh",
      "prophethood-general",
      "punishment-of-past-nations",
      "day-of-judgment",
      "disbelief",
      "natural-signs",
      "guidance",
      "remembrance"
    ],
    "confidence": "high"
  },
  "73:20": {
    "labels": [
      "muhammad",
      "believers",
      "knowledge",
      "mercy",
      "the-quran",
      "prayer",
      "zakat-and-charity",
      "trade-and-debt",
      "war-and-treaties",
      "dua-forgiveness",
      "cosmic-bodies",
      "righteous-conduct"
    ],
    "confidence": "high"
  },
  "_surah_summary_73": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 6,
      "mean": 8.5,
      "max": 12
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

- Every section in `theme_breaks.json` for Surah 73 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
