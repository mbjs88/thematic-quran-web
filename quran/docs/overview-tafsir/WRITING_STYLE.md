# Overview Tafsir — Writing Style

_The house voice for the compiled Overview. Consistent in word-style, in detail,
and in emotional register. Last updated 2026-07-27._

The governing tension, stated plainly: **retain the richness and detail of the
tafsir — that is where the beauty is — without ever leaving the ground of what
the sources actually say.** Richness here means the specificity, the vivid
particulars, and the distinct voice of each commentator, faithfully carried into
English. It does **not** mean the writer's own feeling, invention, or verdict.

This guide draws its craft from three sources: `ABOUT_ME/anti-ai-writing-style.md`
(discipline), `ABOUT_ME/about_me.md` (voice), and `ABOUT_ME/p_and_g_llm_style.md`
(devotional craft — borrowed selectively). Where any of them conflicts with the
grounding rules in `OVERVIEW_TAFSIR_SPEC.md §2`, the grounding rules win.

---

## 1. The one rule that shapes everything

**Detail is retained, not compressed away.** The earlier brief — "comprehension
is the whole job" — flattened the tradition into a thin explainer. That is
corrected here. Keep the particulars a commentator gives: the specific report,
the exact word he lingers on, the image he reaches for, the distinction he draws.
A reader should feel the depth and the difference between voices, not a smoothed
average.

Compression still applies to *clutter*, never to *substance*. Cut filler; keep
the tafsir.

## 2. Readability & voice (Cognitive Load Theory + Feynman)

Test readers found the first cut *rich but hard to read*. The richness is right;
the delivery must get easier. Richness lives in the claims layer — softening the
prose loses none of it.

**Write for an intelligent 15-year-old** — sharp, curious, no background. Never
condescend; never assume jargon. Feynman's test: if you cannot say it simply to a
bright teenager, the sentence is not finished. Hard boundary: simplify the
*delivery*, never the *content*, and every image must be the sources' own —
invent none.

**Cognitive load (Sweller): every needless difficulty in HOW a thing is phrased is
stolen from the reader's grasp of WHAT is said.** So:

- **One sentence, one idea.** No nested clauses to hold in the head. Hard ceiling
  ~20 words; break a long chain into two or three short sentences.
- **Define on use.** A term's plain meaning sits right where it appears — never
  make the reader carry an unexplained word across a gap.
- **Concrete before abstract** (the worked-example effect). Lead with the plain
  point or the source's own image (the ice-seller, the rock at the back), then the
  nuance.
- **One new idea at a time.** Do not stack unfamiliar concepts in one breath.
- **Signpost.** Open each paragraph with a plain anchor sentence saying what it is
  about. **Cut redundancy** — do not repeat, do not crowd the prose with names or markers.
- **Arabic sparingly in the prose.** English first. Keep the Arabic term only for
  the one or two key concept-words of the passage, in brackets, defined on the
  spot. All the Arabic and every name still live in the claims layer.

Under that, the standing voice (about_me / anti-ai):

- **Density over decoration.** Every word earns its place. Aspire to weight in
  compressed English.
- **Short clauses. Short paragraphs.** Single-sentence paragraphs, separated by
  white space, are welcome. Decompose any 30-word sentence into two or three.
- **Topic-sentence-led.** Open each paragraph with the point, then give the
  detail. Never open a paragraph with a question (an AI tell).
- **British English throughout:** realise, honour, colour, neighbour.
- **Em-dash discipline:** statement-then-explanation only. Never the balanced
  antithetical pivot ("this isn't X — it's Y"). No semicolons.
- **Find the single exact word.** No elegant variation — if it is *al-Ṣamad*,
  keep calling it *al-Ṣamad*, not "the concept" then "the attribute."
- **Earnest, educator-shaped, never salesman-shaped.** The litmus: is the
  language communicating, or signalling? If it signals, it fails.

## 3. Emotion — the sources', attributed, restrained

The tafsir carries real feeling: awe at *tawḥīd*, dread at the Reckoning, tender
hope in mercy. **Carry that feeling through — as the source's, attributed —
never manufactured by the writer.**

- If al-Saʿdī reads a verse with warmth, or Sayyid Quṭb with awe, let that
  register show *in how their reading is reported*, attributed to them.
- **"Restrained-and-honest beats emotive-and-performed"** (about_me). Do not
  perform emotion the sources did not bring. No benedictions, no consolation
  addressed to the reader, no motivational imperatives, no asserting God's intent
  toward the reader. That is the devotional mode, and it is out of bounds here
  (§6) — it would be the writer adjudicating and adding, which §2 forbids.
- Awe is conveyed by precision and restraint, not by exclamation.

## 4. Craft borrowed from the devotional mode (only what grounding allows)

- **Lifespan dates on a scholar's first naming in prose:** "al-Ṭabarī (d. 923)".
  The chronology in `commentators.json` supplies these; use them. They add ethos
  and quietly encode who came first.
- **Close-reading a single Arabic term** — when a source does it. Isolating one
  word and turning it over (*aḥad* against *wāḥid*; the range packed into
  *al-Ṣamad*) is a genuine tafsir move and a beautiful one. Ground it in the
  commentator who makes it.
- **Arabic as conceptual compression, not ornament.** Keep the key term, gloss
  it plainly at first use: *taqwā* (God-consciousness), *khashya* (awe-filled
  fear). The gloss serves the English reader; the term preserves what English
  cannot carry.
- **Names of Allah** given with an inline gloss when a source invokes them:
  al-Ṣamad (the Self-Sufficient whom all need).
- **Reverential markers**, kept: ﷺ after the Prophet, عليه السلام for prophets,
  رضي الله عنه for companions.
- **Rhythm, used sparingly:** a one-word paragraph to land a pivotal term; a
  short parallel series where the *sources* line up. Rhythm serves the content;
  it never substitutes for it.

## 5. Attribution and the reference markers

- The `^[n]` superscript markers stay — they keep the prose clean and every point
  traceable.
- **Name a scholar in the prose when the name carries the point** — a distinctive
  reading, a stated preference, a famous saying, or content where the school /
  authority matters (creedal, legal, graded reports). Give dates on first mention.
  Elsewhere, "the commentators" or "one report" plus a marker keeps the density.
- Where readings differ, lay them side by side, each owned by its source. State a
  preference only if a source states one, and attribute *that*.

## 6. Out of bounds (the devotional machinery we do NOT use)

These belong to the *Poetry and Gahwa* devotional mode and would break §2:

- second-person consolation or "wound ventriloquism" ("you feel abandoned…");
- benedictions, imperatives, or motivational closes ("So continue. Believe.");
- asserting God's intent toward the reader as comfort;
- the self-help arc (name the ache → diagnose modernity → reframe → console);
- any feeling, moral, or application the fetched sources did not themselves give.

The Overview reports the tradition. It does not preach it.

## 7. Consistency checklist (per section)

- [ ] Detail retained — a reader feels the depth and the differences, not a thin summary.
- [ ] Every substantive point traces to a fetched source (marker or name).
- [ ] Emotion present only where a source carries it, and attributed.
- [ ] British English; density; topic-sentence-led; no AI tells.
- [ ] Arabic terms kept and glossed; scholars dated on first naming.
- [ ] No verdict the sources did not give; no reader-directed exhortation.
