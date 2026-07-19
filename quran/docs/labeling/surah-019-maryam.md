# Surah Maryam (19) — Section Labels v0.2

**Status:** Auto-drafted by Claude — needs Maaz review
**Created:** 2026-05-17
**Last revised:** 2026-05-17 (post zechariah/john split, label limit 12, full prophet batch)
**Taxonomy version:** v0 + Maryam additions + prophet batch
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

## How to review

For each section: read the content summary, scan the labels, and **strike, edit, or accept**. Two kinds of edit may come out of this:

- **Section-local correction** — a wrong label for *this* section. Just fix it in the JSON block at the bottom.
- **Taxonomy issue** — a label is missing, redundant, or misdefined across the surah. Fix it in `taxonomy.md` and re-apply.

Section IDs use `"{surah}:{startAyah}"` and match `theme_breaks.json` exactly.

---

## Labels added to the taxonomy during this exercise

Two batches:

**Maryam-pass (initial generous-tagging additions):**
- `mankind`, `aaron`, `isaac`, `ishmael`, `jacob`, `idris`, `interest`

**Full prophet batch (added pre-emptively to cover the rest of the corpus):**
- `john` (split from `zechariah-and-john`; the old label was renamed to `zechariah`)
- `hud`, `salih`, `shuayb`, `elijah`, `elisha`, `dhul-kifl`
- `ad`, `thamud`, `madyan` (replacing the old `ad-thamud-madyan` collective; this gives users a way to filter for a specific punished people independently of its messenger)

All people labels now carry Arabic/English aliases inline (`jesus` → "Jesus (Isa, Eesa, ʿĪsā)"), so a user typing `Yahya` finds sections tagged `john` without needing a separate tag.

---

## Section 1 — 19:1–9 — Zechariah's private prayer for an heir

> Disjoined letters (Kāf Hā Yā ʿAyn Ṣād). A reminder of God's mercy on Zechariah. He calls his Lord in secret, noting his weakened bones and white hair, fearing his successors, and asking for an heir from God's grace — to inherit from him and from the family of Jacob. The reply comes: glad tidings of a boy named John, a name not given before. Zechariah asks how, given his wife's barrenness and his old age. The angel responds: it is easy for your Lord, who created you when you were nothing.

| Facet | Labels |
|---|---|
| people | `zechariah`, `john`, `jacob`, `angels` |
| divine-attributes | `mercy`, `power`, `nearness-and-response` |
| dua | `dua-family-offspring` |
| cosmology | `human-creation` |
| revelation | `disjoined-letters` |

**10 labels.  Confidence: high.  Note:** `john` is tagged because he is named here ("a boy named John") even though his character is detailed in the next section. `disjoined-letters` covers the opening Kāf-Hā-Yā-ʿAyn-Ṣād.

---

## Section 2 — 19:10–11 — The sign of muteness

> Zechariah asks for a sign. He is told: he will not speak to people for three nights though sound in body. He emerges from the prayer-chamber and signals his people to glorify God morning and evening.

| Facet | Labels |
|---|---|
| people | `zechariah` |
| divine-attributes | `power`, `nearness-and-response` |
| worldly-matters | `prayer` |
| ethical-states | `remembrance` |
| revelation | `miracles` |

**6 labels.  Confidence: high.**

---

## Section 3 — 19:12–15 — John's character

> O John, take the Scripture with strength. He was given wisdom as a child, tenderness and purity from God, was God-conscious, dutiful to his parents, neither a tyrant nor disobedient. Peace upon him the day he was born, the day he dies, and the day he is raised alive.

| Facet | Labels |
|---|---|
| people | `john` |
| divine-attributes | `mercy`, `wisdom` |
| ethical-states | `taqwa`, `righteous-conduct` |
| eschatology | `death-and-dying`, `resurrection` |
| revelation | `previous-scriptures`, `prophethood-general` |

**9 labels.  Confidence: high.**

---

## Section 4 — 19:16–26 — The annunciation and birth of Jesus

> Mention Mary, when she withdrew to an eastern place behind a screen. God sent His Spirit, appearing as a well-formed man. She sought refuge in the Most Merciful — "if you are God-conscious." He answered: I am only a messenger of your Lord, sent to give you a pure boy. She asked how, having never been touched nor unchaste. The reply: it is easy for your Lord; We will make him a sign for mankind and a mercy from Us — a decreed matter. She conceived and withdrew to a remote place; labor pains drove her to a palm trunk; she wished she had died. A voice called from below: do not grieve — your Lord has placed a stream beneath you. Shake the trunk; fresh dates will fall. Eat, drink, be glad. If you see any human, say: I have vowed silence to the Most Merciful.

| Facet | Labels |
|---|---|
| people | `mary`, `jesus`, `angels`, `mankind` |
| divine-attributes | `mercy`, `power`, `provision`, `divine-decree` |
| dua | `dua-protection` |
| worldly-matters | `marriage-and-family` |
| cosmology | `human-creation` |
| revelation | `miracles` |

**12 labels.  Confidence: high.  Note:** `marriage-and-family` covers the chastity question; `human-creation` covers Jesus's miraculous conception (parallel to Adam in 3:59).

---

## Section 5 — 19:27–33 — Jesus speaks from the cradle

> Mary carries the infant to her people. They exclaim: "O sister of Aaron, your father was not a man of evil, nor your mother unchaste — what is this?" She points to him. They ask: how can we speak to a child in the cradle? He answers: I am the servant of God; He has given me the Scripture and made me a prophet, blessed wherever I am, enjoining prayer and zakat as long as I live, and dutiful to my mother — not made arrogant or wretched. Peace upon me the day I was born, the day I die, and the day I am raised alive.

| Facet | Labels |
|---|---|
| people | `mary`, `jesus`, `aaron` |
| worldly-matters | `prayer`, `zakat-and-charity`, `marriage-and-family` |
| negative-attributes | `slander-and-backbiting` |
| eschatology | `death-and-dying`, `resurrection` |
| revelation | `previous-scriptures`, `prophethood-general`, `miracles` |

**12 labels.  Confidence: high.  Note:** the slander label tags the people's accusation against Mary's lineage; if you read "O sister of Aaron" as innocent inquiry, drop it.

---

## Section 6 — 19:34–40 — Refutation of "Son of God"; warning of the Day

> That is Jesus, son of Mary — the word of truth they dispute. It is not befitting God to take a son; when He decrees a matter, He says "Be" and it is. God is my Lord and your Lord, so worship Him — that is the straight path. The factions differed; woe to those who disbelieve from the scene of a tremendous Day. Warn them, O Muhammad, of the Day of Regret — when the matter is concluded and they are in heedlessness. We will inherit the earth and whoever is on it.

| Facet | Labels |
|---|---|
| people | `jesus`, `mary`, `muhammad` |
| divine-attributes | `tawhid`, `power`, `sovereignty` |
| ethical-states | `praise` |
| negative-attributes | `shirk` |
| eschatology | `day-of-judgment` |

**9 labels.  Confidence: high.  Note:** `praise` for "Subḥānahu" (glorified is He) in v.35.

---

## Section 7 — 19:41–50 — Abraham confronts his father

> Mention Abraham — a man of truth and a prophet. He says to his father: why worship what does not hear, see, or benefit? Knowledge has come to me that has not come to you — follow me, I will guide you on an even path. Do not worship Satan; Satan was disobedient to the Most Merciful. I fear a punishment from the Most Merciful will touch you, and you would be Satan's companion. The father replies: are you turning from my gods, Abraham? If you do not desist, I will stone you — leave me a long while. Abraham: peace be upon you; I will ask my Lord's forgiveness for you — He is gracious to me. I will leave you and what you call upon besides God, and call upon my Lord. So when he left them, We granted him Isaac and Jacob, and made each a prophet, and gave them of Our mercy and a high reputation of truth.

| Facet | Labels |
|---|---|
| people | `abraham`, `isaac`, `jacob`, `iblis`, `disbelievers` |
| divine-attributes | `mercy` |
| dua | `dua-forgiveness` |
| negative-attributes | `shirk` |
| revelation | `prophethood-general` |

**9 labels.  Confidence: high.  Note:** `disbelievers` tags Abraham's father as a representative of his idol-worshipping people. `patience` and `arrogance` were both candidates but the new concept-label rule says they need a concrete trigger — neither is named in the section.

---

## Section 8 — 19:51–57 — Moses, Aaron, Ishmael, Idris

> Mention Moses — chosen, a messenger and prophet. We called him from the right side of the mount and brought him near in confidence. We gave him his brother Aaron as a prophet from Our mercy. Mention Ishmael — true to his promise, a messenger and prophet, who enjoined prayer and zakat on his people, pleasing to his Lord. Mention Idris — a man of truth and a prophet; We raised him to a high station.

| Facet | Labels |
|---|---|
| people | `moses`, `aaron`, `ishmael`, `idris` |
| divine-attributes | `mercy`, `nearness-and-response` |
| worldly-matters | `prayer`, `zakat-and-charity` |
| revelation | `prophethood-general` |

**9 labels.  Confidence: high.  Note:** `nearness-and-response` is explicit — Moses is literally "brought near in confidence."

---

## Section 9 — 19:58–63 — Inheritors of the prophets; Paradise promised

> Those were the ones upon whom God bestowed favor from among the prophets — descendants of Adam, of those We carried with Noah, of the descendants of Abraham and Israel, of those We guided and chose. When the verses of the Most Merciful were recited to them, they fell down in prostration and weeping. But there came after them successors who neglected prayer and pursued desires — they will meet evil. Except those who repent, believe, and do righteousness — they will enter Paradise and not be wronged. Gardens of perpetual residence, promised by the Most Merciful in the unseen — His promise is ever coming. No ill speech, only peace; their provision morning and afternoon. That is Paradise — We give it as inheritance to those of Our servants who were God-fearing.

| Facet | Labels |
|---|---|
| people | `adam`, `noah`, `abraham`, `jacob` |
| worldly-matters | `prayer` |
| ethical-states | `taqwa`, `repentance`, `gratitude` |
| eschatology | `paradise` |
| revelation | `prophethood-general`, `the-quran` |

**11 labels.  Confidence: high.  Note:** `gratitude` tags the depicted act ("fell down in prostration and weeping" at the recitation) — the act *is* shukr expressed bodily, even though the word is not used. `the-quran` tags "the verses of the Most Merciful recited."

---

## Section 10 — 19:64–65 — The angels speak

> [Gabriel:] We descend not except by your Lord's command. To Him belongs what is before us, behind us, and between — your Lord is not forgetful. Lord of the heavens and the earth and what is between them — worship Him, and be patient in His worship. Do you know any similar to Him?

| Facet | Labels |
|---|---|
| people | `angels` |
| divine-attributes | `tawhid`, `sovereignty`, `knowledge`, `divine-decree` |
| worldly-matters | `prayer` |
| ethical-states | `patience` |
| cosmology | `creation-of-heavens-earth` |

**8 labels.  Confidence: high.  Note:** `patience` is explicit ("be patient in His worship").

---

## Section 11 — 19:66–72 — Resurrection denied and affirmed; Hell

> The disbeliever says: when I have died, will I really be brought out alive? Does man not remember that We created him before, when he was nothing? By your Lord, We will gather them and the devils, then bring them around Hell on their knees. From every sect We will extract the most insolent toward the Most Merciful. We are most knowing of those most worthy of burning. And there is none of you except he will come to it — that, upon your Lord, is an inevitability decreed. Then We will save those who feared God, and leave the wrongdoers within it on their knees.

| Facet | Labels |
|---|---|
| people | `disbelievers`, `iblis` |
| divine-attributes | `knowledge`, `divine-decree` |
| ethical-states | `taqwa` |
| eschatology | `resurrection`, `hell`, `reckoning` |
| cosmology | `human-creation` |

**9 labels.  Confidence: high.**

---

## Section 12 — 19:73–80 — Disbelievers' argument from wealth

> When Our clear verses are recited to them, those who disbelieve say to the believers: which of our two parties is best in position and best in association? How many a generation We destroyed before them, better in possessions and appearance. Say: whoever is in error — let the Most Merciful extend him an extension, until they see what was promised: punishment or the Hour. They will know who is worst in position and weakest in soldiers. God increases in guidance those who were guided; enduring good deeds are better with your Lord. Have you seen the one who disbelieved in Our verses and said, "I will surely be given wealth and children" — has he looked into the unseen, or taken a covenant from the Most Merciful? No — We will write what he says, and extend his punishment extensively, and inherit him in what he says; he will come to Us alone.

| Facet | Labels |
|---|---|
| people | `disbelievers`, `believers` |
| divine-attributes | `guidance` |
| negative-attributes | `mockery`, `greed-and-miserliness`, `denial-of-revelation` |
| eschatology | `punishment-of-past-nations`, `day-of-judgment` |
| revelation | `qul-statements` |

**9 labels.  Confidence: high.  Note:** `guidance` is explicit — "God increases in guidance those who were guided." Concept-label rule satisfied. `qul-statements` marks the imperative "Say:" in 19:75.

---

## Section 13 — 19:81–87 — False gods cannot intercede

> They took besides God deities for honor. No — those will deny their worship and be opponents against them. Do you not see that We have sent the devils on the disbelievers, inciting them with constant incitement? Do not be impatient — We are only counting out a [limited] number for them. On the Day, We will gather the righteous to the Most Merciful as a delegation, and drive the criminals to Hell in thirst. None will have intercession except one who has taken from the Most Merciful a covenant.

| Facet | Labels |
|---|---|
| people | `disbelievers`, `iblis` |
| ethical-states | `patience`, `taqwa` |
| negative-attributes | `shirk` |
| eschatology | `day-of-judgment`, `hell`, `intercession` |

**8 labels.  Confidence: high.  Note:** `patience` is explicit ("Do not be impatient").

---

## Section 14 — 19:88–95 — The atrocious claim of a begotten son

> They say: the Most Merciful has taken a son. You have done an atrocious thing. The heavens almost rupture from it, the earth split open, the mountains collapse in devastation — that they attribute to the Most Merciful a son. It is not appropriate for the Most Merciful to take a son. There is no one in the heavens and earth but that he comes to the Most Merciful as a servant. He has enumerated them and counted them a full counting. All of them are coming to Him on the Day of Resurrection alone.

| Facet | Labels |
|---|---|
| people | `people-of-the-book`, `polytheists` |
| divine-attributes | `tawhid`, `knowledge`, `sovereignty` |
| negative-attributes | `shirk` |
| cosmology | `creation-of-heavens-earth` |
| eschatology | `resurrection` |

**8 labels.  Confidence: high.  Note:** `people-of-the-book` tags Christian "Son of God" doctrine; `polytheists` tags pagan claims of God having daughters.

---

## Section 15 — 19:96–97 — Believers will be loved; the Qur'an made easy

> Those who have believed and done righteous deeds — the Most Merciful will appoint for them affection. We have only made it easy in your tongue, O Muhammad, that you may give good tidings to the righteous and warn a hostile people.

| Facet | Labels |
|---|---|
| people | `believers`, `muhammad`, `disbelievers` |
| divine-attributes | `mercy` |
| ethical-states | `righteous-conduct`, `taqwa` |
| revelation | `the-quran` |

**7 labels.  Confidence: high.**

---

## Section 16 — 19:98 — Closing warning

> How many a generation before them have We destroyed — do you perceive of them anyone, or hear from them a sound?

| Facet | Labels |
|---|---|
| people | `disbelievers` |
| eschatology | `punishment-of-past-nations` |

**2 labels.  Confidence: high.**

---

## Coverage summary

- **Sections labeled:** 16 / 16 (100%)
- **Labels per section:** range 2–12, mean ~8.7 (up from 7.2 in v0.1 after applying the 12-label headroom)
- **Most-used labels in this surah:** `disbelievers` (6), `mercy` (5), `taqwa` (5), `prayer` (5), `prophethood-general` (5), `mary` (4), `jesus` (4), `zechariah` (2), `john` (3)
- **Empty sections:** 0

---

## Open questions for you

1. **`slander-and-backbiting` on §5:** I read "O sister of Aaron…" as the accusation Ibn Kathir reads it as. If you prefer to label only explicit slander, drop this.
2. **`people-of-the-book` vs `polytheists` on §14:** the "begotten son" critique addresses Christians explicitly; the Qur'an elsewhere also rebukes pagans claiming God has daughters. I tagged both. Drop one if too generous.

**Resolved:**
- ~~Disjoined letters → now tagged with the new `disjoined-letters` label.~~
- ~~`gratitude` on §9 → confirmed: tag the depicted act.~~
- ~~`john` co-tag in §1 → confirmed: keep.~~

---

## JSON snippet for `assignments.json`

Drop this into `data/thematic_labels/assignments.json` once approved. Schema: section ID → object with `labels` array and optional `confidence`/`notes`.

```json
{
  "19:1":  { "labels": ["zechariah", "john", "jacob", "angels", "mercy", "power", "nearness-and-response", "dua-family-offspring", "human-creation", "disjoined-letters"], "confidence": "high" },
  "19:10": { "labels": ["zechariah", "power", "nearness-and-response", "prayer", "remembrance", "miracles"], "confidence": "high" },
  "19:12": { "labels": ["john", "mercy", "wisdom", "taqwa", "righteous-conduct", "death-and-dying", "resurrection", "previous-scriptures", "prophethood-general"], "confidence": "high" },
  "19:16": { "labels": ["mary", "jesus", "angels", "mankind", "mercy", "power", "provision", "divine-decree", "dua-protection", "marriage-and-family", "human-creation", "miracles"], "confidence": "high" },
  "19:27": { "labels": ["mary", "jesus", "aaron", "prayer", "zakat-and-charity", "marriage-and-family", "slander-and-backbiting", "death-and-dying", "resurrection", "previous-scriptures", "prophethood-general", "miracles"], "confidence": "high" },
  "19:34": { "labels": ["jesus", "mary", "muhammad", "tawhid", "power", "sovereignty", "praise", "shirk", "day-of-judgment"], "confidence": "high" },
  "19:41": { "labels": ["abraham", "isaac", "jacob", "iblis", "disbelievers", "mercy", "dua-forgiveness", "shirk", "prophethood-general"], "confidence": "high" },
  "19:51": { "labels": ["moses", "aaron", "ishmael", "idris", "mercy", "nearness-and-response", "prayer", "zakat-and-charity", "prophethood-general"], "confidence": "high" },
  "19:58": { "labels": ["adam", "noah", "abraham", "jacob", "prayer", "taqwa", "repentance", "gratitude", "paradise", "prophethood-general", "the-quran"], "confidence": "high" },
  "19:64": { "labels": ["angels", "tawhid", "sovereignty", "knowledge", "divine-decree", "prayer", "patience", "creation-of-heavens-earth"], "confidence": "high" },
  "19:66": { "labels": ["disbelievers", "iblis", "knowledge", "divine-decree", "taqwa", "resurrection", "hell", "reckoning", "human-creation"], "confidence": "high" },
  "19:73": { "labels": ["disbelievers", "believers", "guidance", "mockery", "greed-and-miserliness", "denial-of-revelation", "punishment-of-past-nations", "day-of-judgment", "qul-statements"], "confidence": "high" },
  "19:81": { "labels": ["disbelievers", "iblis", "shirk", "patience", "taqwa", "day-of-judgment", "hell", "intercession"], "confidence": "high" },
  "19:88": { "labels": ["people-of-the-book", "polytheists", "tawhid", "knowledge", "sovereignty", "shirk", "creation-of-heavens-earth", "resurrection"], "confidence": "high" },
  "19:96": { "labels": ["believers", "muhammad", "disbelievers", "mercy", "righteous-conduct", "taqwa", "the-quran"], "confidence": "high" },
  "19:98": { "labels": ["disbelievers", "punishment-of-past-nations"], "confidence": "high" }
}
```
