# Surah Al-Ikhlas (112) — Section Labels v0

**Status:** Auto-drafted by Claude — needs Maaz review
**Created:** 2026-05-17
**Taxonomy version:** v0 + Maryam additions + prophet batch + `disjoined-letters` + straddling/cosmic-bodies clarifications + `praise` + `qul-statements`
**Linked taxonomy:** [`../taxonomy.md`](../taxonomy.md)

## Why this surah next

Al-Ikhlas is the canonical tawhid declaration — recited by the Prophet ﷺ as equivalent to a third of the Qur'an in reward. Three reasons for picking it now:

1. **First test of `qul-statements`.** It opens with "Qul: Huwa Allāhu aḥad" — the prototypical Qul-statement. If the new label doesn't fit cleanly here, it doesn't fit anywhere.
2. **First test of the new descriptive-category policy.** "He neither begets nor is born" is a clear refutation of Christian Trinitarian doctrine — does it warrant `people-of-the-book` under the new "make a judgement call" rule?
3. **Tiny surah, big test.** Two sections, four verses, exercises a lot of policy decisions per byte.

---

## Section 1 — 112:1–3 — He is God, the One; the Eternal Refuge; neither begets nor is born

> Say: He is God, [the] One. God, the Eternal Refuge. He neither begets nor is born.

| Facet | Labels |
|---|---|
| people | `people-of-the-book`, `polytheists` |
| divine-attributes | `tawhid`, `sovereignty` |
| negative-attributes | `shirk` |
| revelation | `qul-statements` |

**6 labels.  Confidence: high.  Note:**
- `qul-statements` for the opening "Say:".
- `tawhid` is the section's whole point — "He is God, [the] One."
- `sovereignty` for "Al-Ṣamad" (the Eternal Refuge / Self-Sufficient Master to whom all turn) — this is a sovereignty/independence claim.
- `people-of-the-book` per the new descriptive-category policy: "neither begets nor is born" directly refutes the Trinitarian "begotten Son" doctrine. Per Ibn Kathir, the surah was revealed in response to Meccan and Jewish/Christian questioning of God's nature.
- `polytheists` because the pagan Arabs also attributed begotten children (daughters) to God — the negation cuts both ways.
- `shirk` for the implicit refutation of associating any equivalent to God.
- **Not tagged `muhammad`:** under the new rule, "Say:" alone doesn't trigger `muhammad`. There is no direct second-person address to him in this section.

---

## Section 2 — 112:4 — Nor is there to Him any equivalent

> Nor is there to Him any equivalent.

| Facet | Labels |
|---|---|
| divine-attributes | `tawhid` |
| negative-attributes | `shirk` |

**2 labels.  Confidence: high.  Note:** single-verse section. The same tawhid argument, sharpened to its conclusion. By the straddling rule (rule 1) `qul-statements` could carry over from §1 since this verse continues the Qul-declaration — flag this for review; I held back because the imperative `Qul` itself is only in v.1, and v.4 is the continuation of what is to be said.

---

## Coverage summary

- **Sections labeled:** 2 / 2 (100%)
- **Labels per section:** 2 and 6 (mean 4)
- **New-policy tests:** `qul-statements` ✅ landed cleanly on §1; `praise` ✗ not applicable (no hamd/tabāraka/subḥān formula); descriptive-category → `people-of-the-book` ✅ tagged on §1.
- **Empty sections:** 0

---

## What this surah revealed about the taxonomy

1. **`qul-statements` straddling question.** Al-Ikhlas §2 (v.4) is *part of* the Qul declaration but doesn't contain the imperative `Qul` itself. By the straddling rule, it could carry the label. I held back here — the imperative is in §1 only. Worth deciding once: does `qul-statements` cover *the imperative verse only* or *all verses of the continued declaration*? Recommendation: just the verse with the imperative, plus any later verse where it recurs.
2. **Al-Samad is hard to label.** "The Eternal Refuge" is a unique divine attribute that doesn't map cleanly to my 12 attribute clusters. I used `sovereignty` (best fit) but a case can be made for `nearness-and-response` (the refuge sense) or `tawhid` (the self-sufficiency sense). If you want a dedicated `al-samad` label, this would be the time to add it.
3. **The `tawhid`/`shirk` pairing is the spine of refutation-sections.** Every "no son", "no equivalent", "no associate" verse will get both. That's correct and useful — users can filter "show me every section that argues against shirk by asserting tawhid" with a multi-select.

---

## Open questions for you

1. **Should §2 also carry `qul-statements`** as a continuation of the Qul declaration started in §1? (See "What this surah revealed" #1.) Recommendation: no, only the verse with the imperative.
2. **Add a dedicated `al-samad` label?** Currently folded into `sovereignty`. The name appears only once in the Qur'an, so a dedicated label would be very sparse — but Al-Samad is theologically central. Recommendation: leave folded for now; revisit if users ask for it.

---

## JSON snippet for `assignments.json`

```json
{
  "112:1": { "labels": ["people-of-the-book", "polytheists", "tawhid", "sovereignty", "shirk", "qul-statements"], "confidence": "high" },
  "112:4": { "labels": ["tawhid", "shirk"], "confidence": "high", "notes": "Continuation of the Qul declaration from 112:1; qul-statements held back because the imperative itself is in §1 only — pending §1 straddling rule call." }
}
```
