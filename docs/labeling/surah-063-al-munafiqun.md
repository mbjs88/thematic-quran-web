# Surah Al-Munafiqun (63) — Section Labels v0

**Status:** Auto-drafted by Codex — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + short-surah batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

Section IDs use `"{surah}:{startAyah}"` and match `data/theme_breaks.json` exactly. Summaries are content summaries rather than full verse quotations.

## Section 1 — 63:1 (1–4) — Hypocrites false testimony

When the hypocrites come to you, they say, “We bear witness that you are Allah’s Messenger.” Allah knows that you are His Messenger, and Allah bears witness that the hypocrites are liars. They treat their oaths as a cover, and so they repel others from Allah’s path. Evil is what they do. That is because they believed, and then disbelieved; so their hearts were sealed, and they cannot understand. When you see them, their appearance impresses you. And when they speak, you listen to what they say. They are like propped-up timber. They think every shout is aimed at them. They are the enemy, so beware of them. Allah condemns them; how deluded they are!

| Facet | Labels |
|---|---|
| people | `hypocrites`, `muhammad` |
| divine-attributes | `guidance`, `knowledge` |
| worldly-matters | `oaths-and-vows` |
| negative-attributes | `hypocrisy`, `disbelief` |

**7 labels. Confidence: high.**

## Section 2 — 63:5 (5–8) — Refusing forgiveness and boasting power

And when it is said to them, “Come, the Messenger of Allah will ask forgiveness for you,” they bend their heads, and you see them turning away arrogantly. It is the same for them, whether you ask forgiveness for them, or do not ask forgiveness for them; Allah will not forgive them. Allah does not guide the sinful people. It is they who say: “Do not spend anything on those who side with Allah’s Messenger, unless they have dispersed.” To Allah belong the treasures of the heavens and the earth, but the hypocrites do not understand. They say, “If we return to the City, the more powerful therein will evict the weak.” But power belongs to Allah, and His Messenger, and the believers; but the hypocrites do not know.

| Facet | Labels |
|---|---|
| people | `hypocrites`, `muhammad` |
| divine-attributes | `sovereignty`, `knowledge`, `power` |
| dua | `dua-forgiveness` |
| worldly-matters | `migration` |
| negative-attributes | `arrogance`, `greed-and-miserliness` |
| cosmology | `creation-of-heavens-earth` |

**10 labels. Confidence: high.**

## Section 3 — 63:9 (9–10) — Wealth, children, charity, and delayed death

O you who believe! Let neither your possessions nor your children distract you from the remembrance of Allah. Whoever does that—these are the losers. And give from what We have provided for you, before death approaches one of you, and he says, “My Lord, if only You would delay me for a short while, so that I may be charitable, and be one of the righteous.”

| Facet | Labels |
|---|---|
| people | `believers` |
| divine-attributes | `provision` |
| dua | `dua-distress` |
| worldly-matters | `zakat-and-charity` |
| ethical-states | `remembrance`, `righteous-conduct` |
| cosmology | `death-and-dying` |

**7 labels. Confidence: high.**

## Section 4 — 63:11 (11) — No delay at appointed time

But Allah will not delay a soul when its time has come. Allah is Informed of what you do.

| Facet | Labels |
|---|---|
| divine-attributes | `knowledge`, `divine-decree` |
| cosmology | `death-and-dying` |

**3 labels. Confidence: high.**

---

## JSON snippet for `assignments.json`

```json
{
  "63:1": {
    "labels": [
      "hypocrites",
      "muhammad",
      "hypocrisy",
      "oaths-and-vows",
      "disbelief",
      "guidance",
      "knowledge"
    ],
    "confidence": "high"
  },
  "63:5": {
    "labels": [
      "hypocrites",
      "muhammad",
      "dua-forgiveness",
      "arrogance",
      "greed-and-miserliness",
      "migration",
      "sovereignty",
      "creation-of-heavens-earth",
      "knowledge",
      "power"
    ],
    "confidence": "high"
  },
  "63:9": {
    "labels": [
      "believers",
      "remembrance",
      "zakat-and-charity",
      "provision",
      "death-and-dying",
      "dua-distress",
      "righteous-conduct"
    ],
    "confidence": "high"
  },
  "63:11": {
    "labels": [
      "death-and-dying",
      "knowledge",
      "divine-decree"
    ],
    "confidence": "high"
  },
  "_surah_summary_63": {
    "sectionsLabeled": 4,
    "sectionsTotal": 4,
    "labelsPerSection": {
      "min": 3,
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

- Every section in `theme_breaks.json` for Surah 63 has an entry: 4 / 4.
- Every label ID appears in `taxonomy.json`.
- Every section has `confidence`.
- No section exceeds the 12-label ceiling.
- No new labels proposed.
