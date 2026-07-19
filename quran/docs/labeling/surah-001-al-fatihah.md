# Surah Al-Fatihah (1) — Section Labels v0

**Status:** Auto-drafted by Claude — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + Maryam + prophet batch + `disjoined-letters` + straddling/cosmic-bodies clarifications
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

## Why this surah next

Al-Fatihah is foundational — the most-recited surah in the Qur'an, paired liturgically with the protective surahs. Two reasons it earns priority over a longer surah right now:

1. **Du'a facet test.** Maryam and Al-Mulk between them landed zero `dua-*` labels. Al-Fatihah is structurally a du'a (1:5 "we worship and ask for help"; 1:6 "guide us"). If our du'a labels can't capture this, the facet needs work before scale.
2. **High-traffic entry point.** Users searching by theme are likely to look at how Fatihah is tagged first. Getting it right is high-leverage.

---

## ⚠ Heads-up before the labels

`theme_breaks.json` for Surah 1 is `[2, 5, 7]`. By the existing renderer convention (in `js/ui-renderer.js`), this means the basmala (1:1) **is not included in any section** — the renderer iterates the breaks and only renders verses ≥ the first break. Surah 2 by contrast has `[1, 6, …]`, including verse 1.

This is almost certainly a data bug in `theme_breaks.json`. Two ways to fix:

- **Option A:** Change `theme_breaks.json` for surah 1 to `[1, 5, 7]`. Then 1:1 (basmala) joins the praise section 1:1–4. Cleanest, matches the surah-2 convention.
- **Option B:** Leave the file, treat 1:1 as a special-cased basmala. Adds renderer complexity.

I've labeled what the existing breaks say — three sections starting at 2, 5, 7. **If you fix the breaks file to `[1, 5, 7]`, the §1 verse range becomes 1:1–4 and I'd add `tawhid` (the basmala asserts it) but no other label changes.**

---

## Section 1 — 1:2–4 — Praise and the Day of Judgment

> All praise is due to God, Lord of the worlds. The Most Gracious, the Most Merciful. Master of the Day of Judgment.

| Facet | Labels |
|---|---|
| divine-attributes | `tawhid`, `sovereignty`, `creation`, `mercy` |
| ethical-states | `praise` |
| eschatology | `day-of-judgment` |

**6 labels.  Confidence: high.  Note:** `praise` for "al-ḥamdu lillāh" — now its own ethical-states label. `sovereignty` + `creation` come from "Lord of the worlds." `tawhid` is implicit in "All praise is due to God."

---

## Section 2 — 1:5–6 — Worship, help, and the prayer for guidance

> It is You we worship, and You we ask for help. Guide us to the straight path.

| Facet | Labels |
|---|---|
| divine-attributes | `tawhid`, `guidance` |
| dua | `dua-guidance` |
| worldly-matters | `prayer` |
| ethical-states | `sincerity`, `trust-in-god` |

**6 labels.  Confidence: high.  Note:** `dua-guidance` is the canonical example for that label — "ihdina aṣ-ṣirāṭ al-mustaqīm." `tawhid` is in "*You alone* we worship" (the exclusivity is the assertion). `sincerity` (ikhlas) is in the same exclusivity ("It is *You* we worship"). `trust-in-god` is in "You we ask for help" (istiʿānah). `prayer` covers worship as the act of salah.

---

## Section 3 — 1:7 — The path of those favored

> The path of those upon whom You have bestowed favor — not of those who have evoked anger, nor of those who are astray.

| Facet | Labels |
|---|---|
| people | `people-of-the-book` |
| divine-attributes | `guidance`, `mercy` |
| negative-attributes | `disbelief` |
| revelation | `prophethood-general` |

**5 labels.  Confidence: high.  Note:** Per the new descriptive-category policy, "those who evoked anger" + "those who are astray" map to Jews + Christians per Ibn Kathir → `people-of-the-book`. "Those upon whom You have bestowed favor" → `prophethood-general` (the catalogue from 4:69: prophets, truthful, martyrs, righteous).

---

## Coverage summary

- **Sections labeled:** 3 / 3 (100% of what `theme_breaks.json` declares; 1:1 basmala excluded — see warning above)
- **Labels per section:** range 4–6, mean 5
- **Du'a facet activation:** ✅ `dua-guidance` lands on §2 — facet works.
- **Empty sections:** 0

---

## What this surah revealed about the taxonomy

1. **The "hamd vs shukr" question matters.** Al-Fatihah opens with "praise" (hamd). Maryam §9 used "fell in prostration and weeping" (depicted shukr). The corpus contains many praise-passages and gratitude-passages, and we need a clear policy on whether `gratitude` covers praise generally or only shukr-flavored gratitude. **My recommendation:** keep `gratitude` for explicit shukr / depicted thanks; create no separate `praise-of-god` label (over-specific). Praise → covered by the divine attribute being praised (`mercy`, `sovereignty`, etc.).
2. **Descriptive categories vs named groups.** §3's "those who evoked anger / those astray" are interpretively tied to specific peoples but aren't named as such. Same problem will recur in many places (`9:30` says "the Jews say…" — named; `1:7` only describes). **My recommendation:** add a sub-rule under rule 3: "Tag people-group labels only when the group is named explicitly (`al-yahūd`, `an-naṣārā`, etc.), not when it is alluded to via descriptive categories in the text."
3. **The basmala question is corpus-wide.** Surah 1's missing section start for 1:1 is the visible bug, but every surah has a basmala question — surah 9 has none, surahs 2–8 and 10–114 do. Worth checking that `theme_breaks.json` handles this consistently.

---

## Open questions for you

1. **Fix `theme_breaks.json` for surah 1?** `[2, 5, 7]` → `[1, 5, 7]` is the cleaner change (matches surah-2 convention). If yes, §1 becomes 1:1–4 and I'd add `tawhid` from the basmala (already there) and `qul-statements` only if you read the basmala as itself a recitation-command.

**Resolved:**
- ~~`gratitude` vs praise on §1 → `praise` is now its own label and is tagged.~~
- ~~`people-of-the-book` on §3 → tagged per the new descriptive-category policy.~~

---

## JSON snippet for `assignments.json`

```json
{
  "1:2": { "labels": ["tawhid", "sovereignty", "creation", "mercy", "praise", "day-of-judgment"], "confidence": "high" },
  "1:5": { "labels": ["tawhid", "guidance", "dua-guidance", "prayer", "sincerity", "trust-in-god"], "confidence": "high" },
  "1:7": { "labels": ["people-of-the-book", "guidance", "mercy", "disbelief", "prophethood-general"], "confidence": "high" }
}
```
