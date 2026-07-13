# Overview Tafsir — Specification

_Status: pilot (Surah Al-Aʿlā, 87). Last updated 2026-07-11._

## 1. What "Overview" is

**Overview** is a pre-compiled, section-level English commentary that appears as a selectable tafsir in the section reader's tafsir dropdown. For each thematic section (a "paragraph"), it gathers every commentary the Quran Foundation API serves for that section's verses — across all languages — and renders one approachable English explanation of the points the classical and modern commentators raise, and where they differ.

It is **not** a devotional essay and **not** independent interpretation. Its single job is to let an English-only reader understand what the mufassirūn actually say about a passage, with each point attributed to the scholar who holds it.

When an Overview exists for the active section, it becomes the **default** selection in the dropdown and appears at the top of the list, carrying the disclaimer in §6.

## 2. The hard constraints (grounding)

These are non-negotiable. A compilation that breaks any of them is rejected.

1. **Fetched tafsir only.** Every substantive claim must trace to tafsir fetched from the canonical Quran Foundation tools (`fetch_tafsir`) for that section's verses. Nothing from model memory. If a claim cannot be traced to a fetched source, it does not go in.
2. **Translation is rendering, never reinterpretation.** Non-English tafsir is carried into English faithfully, as *what that scholar said* — not as a licence to add, soften, or reinterpret. Rendered passages are model translations, not verbatim scholarly quotes, and are labelled as such where quoted closely.
3. **No external material.** No hadith, poetry, or scholarly view is introduced unless a fetched tafsir itself invokes it. (Al-Ṭabarī citing Mujāhid is fair game; a hadith the sources don't mention is not.)
4. **Attribute, never adjudicate.** Where sources agree, say so. Where they differ, lay the readings side by side, each named to its source. Do not collapse disagreement into a single "Islamic view," and do not declare a winner unless a fetched source itself states consensus or a preference (in which case attribute *that* — e.g. "al-Ṭabarī judged the strongest view to be…").
5. **Flag uncertainty.** Weak or uncertain reports are presented as such when the sources grade them. Gratuitous isrāʾīliyyāt and graphic material are omitted.
6. **Honour the text.** Any difficulty is located on the reader's side — the limits of our understanding — never framed as a flaw in the Qurʾān. (Per `EDITORIAL_POLICY §10` and the project's positive-framing rule.)

## 3. Writing style

Approachable explainer, written for an ordinary reader with no scholarly background. Register from `ABOUT_ME/anti-ai-writing-style.md`: measured, educator-shaped, topic-sentence-led, short paragraphs, recipient-first (English; Arabic terms glossed in plain words, e.g. "the festival charity" rather than _ṣadaqat al-fiṭr_). Light warmth from `ABOUT_ME/p_and_g_llm_style.md`. Comprehension is the whole job.

**Two rules learned from reader feedback on the Al-Aʿlā pilot:**

1. **Message first.** Every section opens with a short **"In short"** line, one or two sentences of plain English stating what the passage actually says, before any nuance. Each body paragraph then leads with its point in everyday language, and only afterwards fills in the detail. Readers should never have to dig for the meaning.
2. **Names out of the prose; sourcing in the numbers.** Do **not** thread the prose with commentator names — readers drown in "al-Ṭabarī… al-Qurṭubī… al-Zamakhsharī." Make the point plainly, then attach a superscript reference marker to the sources behind it, e.g. `…never speaking it carelessly.^[1,3,5]`. A single numbered **references list** at the foot of the document maps each number to a commentary (with a one-line note on its strength). Name a specific person in the prose only when the name itself carries weight and the point is vivid without a crowd (used sparingly, e.g. "the Prophet taught…"). Early authorities cited *by* the commentaries (Ibn ʿAbbās, Mujāhid, Ibn Masʿūd) are usually folded into "the commentators" or "one report" plus a reference, not named, unless the saying is famous enough to earn it.

Forbidden: self-reference and meta-discourse ("in this overview…", "we will explore…"); AI negative-parallelisms ("not X, but Y"); the em-dash antithesis tell (use spaced hyphens or commas); status/salesman register; invented consensus.

### Per-section shape

- **In short** — the key-message line (see rule 1).
- **The verses** — Arabic + translation for the section's ayāt.
- **Body** — two to four short paragraphs, each leading with its point in plain English, difference between readings stated simply ("the commentators read this two ways…"), every claim carrying a `^[n]` reference. No verdict unless a source states one; where a source records a preference, the preference may be given and referenced.
- **Close** — one short settling sentence.
- **References** (document level) — the numbered list of commentaries the numbers point to.

## 3b. The modern-lens layer (optional, per section)

An optional block, **"A modern lens,"** may follow a section's grounded reading — but only where a genuine touchpoint exists between the passage and the observable world. Most sections get none, and adding nothing is the correct output where there is no real touchpoint. This layer is the project's highest-risk writing; the rules below are what keep it honest.

**Governing principle (the angle).** The Qur'an is treated as fixed, revealed truth; science is our provisional, evolving account of the observable world. The claim direction is therefore never "science proves the Qur'an." It is the reverse: the text is the settled point, and our growing knowledge is shown, in places, arriving at what the text already said. This asymmetry is load-bearing — it de-risks loose resonances, survives future scientific revision, and handles mismatches honestly (a mismatch reflects the limits of our reading of text or world, never a flaw in the text). Standing framing line, shown atop every block:

> _The Qur'an is taken here as fixed, revealed truth; science is our provisional, evolving account of the observable world. What follows notes where the two meet — a contemplation, not a proof. Where the science later shifts, that reflects the limits of our knowledge, not the text._

**Grounded in the full tafsir base, not the summary.** Touchpoints are identified by reading the **complete fetched commentary** for the section (all editions, full text), not the condensed Overview essay. The mufassirūn's own gestures toward the natural world are the best and most honest hooks (e.g. al-Bayḍāwī on the spinal cord, Ibn ʿĀshūr and Sayyid Quṭb on embryology as cited in al-Wasīṭ). Where the commentators already reached toward a touchpoint, say so — it shows the reading is not imported from outside.

**Three honest moves, in order:** (1) state what the verse plainly meant to the commentators; (2) state what science currently establishes, **verified against reputable present-day sources** (search; cite them) — never asserted from memory; (3) name the resonance as something a reader may notice, never as proof or as the verse's "real meaning."

**Grade every note openly** — `strong` / `evocative` / `light` — and never dress a weak link in confident prose. Calling the pulsar link a mere echo is what earns trust for the embryology one. No triumphalism; the stance is contemplation and wonder, honouring the text, not ammunition for debate.

Rendered as a visually distinct panel, clearly set apart from the grounded commentary so a reader never mistakes reflection for sourced tafsir. Per the grounding rules this is Mode 3 (tadabbur / applied reasoning), and the standing framing line is its required disclaimer.

## 4. Pipeline

1. `fetch_grounding_rules` (once) → capture the `grounding_nonce` for all subsequent calls.
2. `fetch_quran_metadata(surah)` and `data/theme_breaks.json` → resolve the surah's sections. Section boundaries are **start verses**; a section runs from its start to (next start − 1), matching `js/app.js`. E.g. Al-Aʿlā `[1, 6, 10, 14, 19]` → sections 1–5, 6–9, 10–13, 14–18, 19.
3. `list_editions(edition_type='tafsir')` → enumerate every available edition.
4. `fetch_tafsir(ayahs=<section range>, editions=<all>)` per section (paginate as needed). Also `fetch_quran` (Arabic) and `fetch_translation` for display.
5. Translate non-English commentary faithfully; cluster the raw material by interpretive point across the section.
6. Synthesise each section essay under §2 and §3.
7. **Modern-lens pass (§3b):** re-read the full fetched commentary for each section for a genuine scientific touchpoint. Where one exists, verify the science against reputable present-day sources (search) and write a graded `modern_lens` note under the §3b rules. Add nothing where there is no real touchpoint.
8. **QA pass** (hostile-reader): every commentary claim traces to a fetched source; every science claim is verified and cited; the modern-lens angle is text-first (never "science proves…"); no memory leakage; no self-reference; positive framing intact; weak reports and weak resonances flagged; qirāʾāt / asbāb handled accurately.
9. Store as JSON (§5).

## 5. Storage & integration

One file per surah under `data/tafsir_overview/`, e.g. `data/tafsir_overview/087.json`. One entry per section, keyed by section start id (`"87:1"`, `"87:6"`, …), mirroring how `theme_breaks.json` and translations are keyed.

```json
{
  "surah": 87,
  "commentators_studied": 12,
  "references": [
    { "n": 1, "edition": "ar-tabari", "label": "al-Ṭabarī, Jāmiʿ al-Bayān", "note": "foundational; range of early opinion" },
    { "n": 2, "edition": "en-ibn-kathir", "label": "Ibn Kathīr", "note": "explained through Qurʾan and prophetic reports" }
  ],
  "modern_lens_framing": "The Qurʾan is taken here as fixed, revealed truth; science is our provisional, evolving account of the observable world…",
  "sections": {
    "87:1": {
      "verse_range": "1-5",
      "title": "Glorify the Most High",
      "in_short": "Praise God, and keep His name high above anything unworthy of it…",
      "essay_html": "<p>…never speaking it carelessly.<sup class=\"ref\">1,3,5</sup></p>",
      "sources_used": [1, 3, 5, 2, 11, 4, 10, 6, 7],
      "modern_lens": {
        "strength": "light",
        "html": "<p>…blackened plant matter is, over ages, what becomes coal…</p>",
        "sources": [ { "label": "Development of the gonads", "url": "https://…" } ]
      },
      "compiled_at": "2026-07-11"
    }
  }
}
```

`modern_lens` is present only on the sections that have a genuine touchpoint (§3b); omit it entirely otherwise. `modern_lens_framing` is the document-level standing line shown atop every panel. The `references` array is document-level (one numbered list per surah) so markers stay stable across sections. `sources_used` per section lists the reference numbers that section actually cites. `commentators_studied` records how many distinct commentaries were read to prepare the surah (the length of `references`); it is surfaced to the reader as a mark of how much scholarship the reading rests on (e.g. "compiled from 12 commentaries").

**Persistence.** A surah is compiled once and stored. Before compiling, check for an existing `data/tafsir_overview/{NNN}.json` and reuse it rather than re-fetching and re-writing. Recompile only to correct an error or add editions.

Integration in `js/scholar.js`: when an Overview entry exists for the active section, inject it as a synthetic edition at the top of the tafsir `<select>`, label it **Overview**, select it by default, and render `essay_html`. The disclaimer (§6) is shown under the section header (or as an info affordance next to the label).

## 6. Disclaimer

Shown wherever Overview is presented:

> Compiled from multiple classical and modern commentaries across languages, gathered into one approachable English overview. It reflects only what those sources say — not independent opinion. Named attributions show which scholar each point comes from.

## 7. Editions (as of the Al-Aʿlā pilot)

Fetched for the pilot: `en-ibn-kathir`, `en-maarif-ul-quran`, `en-tazkirul-quran`, `ar-tabari`, `ar-qurtubi`, `ar-kashaf` (al-Zamakhsharī), `ar-baghawi`, `ar-nathm-aldurar` (al-Biqāʿī), `ar-saadi`, `ar-jalalayn`, `ar-muyassar`, `ar-al-wasit` (Ṭanṭāwī).

Deliberately omitted for the pilot, to be added when the pipeline is automated: `ar-tahrir-wa-tanwir` (Ibn ʿĀshūr — very long entries; its discourse-level angle overlaps al-Biqāʿī here) and full `ar-ibn-kathir` (redundant with the English abridgement for this surah). Omissions are recorded in `sources_used` by their absence and should be disclosed, not hidden.

## 7a. Progress tracking

`scripts/overview_progress.py` scans `data/tafsir_overview/*.json` against `data/theme_breaks.json` and writes `data/tafsir_overview/_progress.json` plus a self-contained dashboard at `docs/overview-tafsir/progress.html`. Run it after compiling a surah to refresh the view. The phased completion plan and per-session budgets live in `PROJECT_PLAN.md`; the dashboard is the live source of truth for what is done and what is next.

## 8. Open items

- Automate the pipeline (currently run interactively for the pilot).
- Decide how many named attributions is "enough" per thread before it clutters — the pilot errs toward representative names.
- Confirm the dropdown label and info-affordance treatment in `scholar.js`.
- Extend to a full surah set once the Al-Aʿlā output is reviewed.
