# Overview Tafsir — Specification

_Status: design phase (rebuild). Last updated 2026-07-27._

> **Reset note (2026-07-27).** The earlier Al-Aʿlā / aṭ-Ṭāriq pilot output was
> **cleared** as exploratory: its source list included editions (al-Kashshāf,
> al-Jalālayn, Naẓm al-Durar, Ibn ʿĀshūr) that are **not served by the Quran
> Foundation API** and appear to have been written from memory — a grounding
> failure. This spec now describes the **grounded rebuild**: the corpus is
> limited to editions the API actually serves (catalogued in
> [`quran/data/commentators.json`](../../data/commentators.json)), a structured
> claim layer is stored before any prose (schema:
> [`extracted_claim.schema.json`](../../data/schemas/extracted_claim.schema.json)),
> and the 20-discipline advisory-panel findings in
> [`PANEL_REVIEW_ACTIONS.md`](PANEL_REVIEW_ACTIONS.md) are folded in.

## 1. What "Overview" is

**Overview** is a pre-compiled, section-level English commentary that appears as a selectable tafsir in the section reader's tafsir dropdown. For each thematic section (a "paragraph"), it gathers the commentary the Quran Foundation API **actually serves** for that section's verses — in whatever languages are available for that passage — and renders one approachable English explanation of the points the classical and modern commentators raise, and where they differ.

**Coverage is disclosed, never overstated.** The corpus is whatever the API returns for the section (see the catalogue in `quran/data/commentators.json`); it is **not** "all languages." Where a work is served only in a non-English language, it is translated into English (translate early, from the original where available — see §4); where an English edition of a work already exists, that edition is used directly. Each compiled section records which languages and editions were present and which were absent (§5), so a reader is never given the impression of broader multilingual grounding than actually exists.

It is **not** a devotional essay and **not** independent interpretation. Its single job is to let an English-only reader understand what the mufassirūn actually say about a passage, with each point attributed to the scholar who holds it.

When an Overview exists for the active section, it becomes the **default** selection in the dropdown and appears at the top of the list, carrying the disclaimer in §6.

## 2. The hard constraints (grounding)

These are non-negotiable. A compilation that breaks any of them is rejected.

1. **Fetched tafsir only — including which editions exist.** Every substantive claim must trace to tafsir fetched from the canonical Quran Foundation tools (`fetch_tafsir`) for that section's verses, and every *edition named as a source* must be one the API actually served. Nothing from model memory — **not the commentary, and not the source list itself.** (The earlier pilot cited al-Kashshāf, al-Jalālayn, and Naẓm al-Durar, which the API does not serve; that is the exact failure this rule forbids.) If a claim or a source cannot be traced to a real fetch, it does not go in.
2. **Translation is rendering, never reinterpretation.** Non-English tafsir is carried into English faithfully, as *what that scholar said* — not as a licence to add, soften, or reinterpret. Rendered passages are model translations, not verbatim scholarly quotes, and are labelled as such where quoted closely.
3. **No external material.** No hadith, poetry, or scholarly view is introduced unless a fetched tafsir itself invokes it. (Al-Ṭabarī citing Mujāhid is fair game; a hadith the sources don't mention is not.)
4. **Attribute, never adjudicate.** Where sources agree, say so. Where they differ, lay the readings side by side, each named to its source. Do not collapse disagreement into a single "Islamic view," and do not declare a winner unless a fetched source itself states consensus or a preference (in which case attribute *that* — e.g. "al-Ṭabarī judged the strongest view to be…").
5. **Flag uncertainty.** Weak or uncertain reports are presented as such when the sources grade them. Gratuitous isrāʾīliyyāt and graphic material are omitted.
6. **Honour the text.** Any difficulty is located on the reader's side — the limits of our understanding — never framed as a flaw in the Qurʾān. (Per `EDITORIAL_POLICY §10` and the project's positive-framing rule.)
7. **Independent voices only — no consensus by count.** Agreement counts only where the sources are genuinely independent. A translation, abridgement, or adaptation is **the same voice** as its original (Ibn Kathīr in Arabic, English, Urdu, and Bengali is one voice, not four; al-Saʿdī's Russian edition is not a second witness). A later work that draws on an earlier one is not independent corroboration — the author chronology in `commentators.json` is used to detect this. Reference counts and any "compiled from N commentaries" figure must never be presented as a measure of scholarly weight or agreement.
8. **Report grade is always visible.** When a claim rests on a hadith or athar, its grade (ṣaḥīḥ / ḥasan / ḍaʿīf / mawḍūʿ) is shown, or an explicit "ungraded by [source]" state — silence must never read as authentication. Whether the citing commentator endorses, relays, or refutes a report is preserved.

## 3. Writing style

The full house voice is **`WRITING_STYLE.md`** (read it). In short: accessible to an
ordinary reader, but **rich** — the detail is where the beauty is, so it is retained,
not compressed away. Register from `ABOUT_ME/anti-ai-writing-style.md` and `about_me.md`
(measured, dense, educator-shaped, topic-sentence-led, British English, no AI tells),
with craft borrowed selectively from `ABOUT_ME/p_and_g_llm_style.md` (lifespan dates on
scholars, close-reading a single term, Arabic kept and glossed). Arabic terms are kept
and glossed at first use (e.g. _taqwā_ (God-consciousness)), not dissolved. Emotion is
carried only where a source brings it, **attributed and restrained** — never performed,
never a benediction or exhortation to the reader (that would break §2). The correction to
the earlier brief: comprehension is necessary, but it is **not** the whole job — faithful
richness is.

**Two rules learned from reader feedback on the Al-Aʿlā pilot:**

1. **Message first.** Every section opens with a short **"In short"** line, one or two sentences of plain English stating what the passage actually says, before any nuance. Each body paragraph then leads with its point in everyday language, and only afterwards fills in the detail. Readers should never have to dig for the meaning.
2. **Markers carry the density; names carry the weight.** Attach a superscript reference marker to every point, e.g. `…never speaking it carelessly.^[1,3,5]`, mapping to a numbered **references list**. Do not thread every point with a crowd of names. But **do name a scholar in the prose where the name carries the point** — a distinctive reading, a stated preference, a famous saying, or creedal / legal / graded content — with lifespan dates on first naming (e.g. "al-Ṭabarī (d. 923) judged the strongest view to be…"). This is the panel's correction: stripping all names loses information that theology, fiqh, and hadith treat as load-bearing. Early authorities cited *by* the commentaries (Ibn ʿAbbās, Mujāhid) are usually folded into "one report" plus a marker, unless the saying is famous enough to earn the name.

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
3. `list_editions(edition_type='tafsir')` → enumerate every available edition, and **reconcile against `commentators.json`**. Only editions the API actually returns are eligible; the source list is taken from this call, never from memory. (When the API returns an edition not yet in `commentators.json`, add it there first — with author, chronology, and language — rather than guessing.)
4. `fetch_tafsir(ayahs=<section range>, editions=<available>)` per section (paginate as needed). Also `fetch_quran` (Arabic) and `fetch_translation` for display. Store a hash of each raw fetched passage for provenance (§5).
5. **Resolve English per work (`commentators.json` → `works[].english_source`).** If a work has an English edition, use it directly. Otherwise translate into English — from the original language where the API serves it, faithfully (§2.2), tagging the rendering with source language and a translation-confidence marker. Collapse same-work editions to **one voice** (§2.7).
6. **Extract structured claims** (`extracted_claim.schema.json`) — one record per discrete point, with its verse/word attachment, source edition(s) and each commentator's stance, original term + gloss, report grade if any, and provenance. This claim layer is the durable asset; the essay is derived from it, not the reverse.
7. Compose each section essay from the claims, under §2 and §3. Independence and grade come from the claim records (§2.7, §2.8), not from counting footnotes.
8. **Modern-lens pass (§3b):** re-read the full fetched commentary for a genuine *physical/natural-science* touchpoint only (no psychology/behavioural-science extension without sign-off). Verify the science against reputable present-day sources and **log every query and retrieved snippet** (§5). Add nothing where there is no real touchpoint.
9. **QA pass** (hostile-reader): every claim traces to a fetched source *and a real edition*; no memory leakage in content **or source list**; grades and independence correct; modern-lens text-first and logged; positive framing intact; creedal / legal / sensitive-content sections routed to the appropriate human review (§8 / `PANEL_REVIEW_ACTIONS.md`).
10. Store as JSON (§5).

## 5. Storage & integration

One file per surah under `data/tafsir_overview/`, e.g. `data/tafsir_overview/087.json`. One entry per section, keyed by section start id (`"87:1"`, `"87:6"`, …), mirroring how `theme_breaks.json` and translations are keyed.

Two companion data assets underpin this file and must be read together with it:
`quran/data/commentators.json` (the grounded edition catalogue + author chronology + English-vs-translate plan) and
`quran/data/schemas/extracted_claim.schema.json` (the structured claim layer). The
full proposed field set — coverage, omissions, provenance, per-reference
`source_language`, and the claim layer — is specified in
[`PANEL_REVIEW_ACTIONS.md` §D](PANEL_REVIEW_ACTIONS.md).

```json
{
  "surah": 87,
  "coverage": {
    "editions_present": ["ar-tafsir-al-tabari", "en-tafisr-ibn-kathir", "..."],
    "independent_works": 8,
    "languages_present": ["ar", "en"],
    "languages_absent": ["bn", "ku", "ru"],
    "note": "Only the editions the API returned for this surah. Not 'all languages'."
  },
  "pipeline_provenance": { "model": "…", "prompt_version": "…", "theme_breaks_version": "sha256:…" },
  "references": [
    { "n": 1, "edition": "ar-tafsir-al-tabari", "author_id": "al-tabari", "source_language": "ar", "label": "al-Ṭabarī, Jāmiʿ al-Bayān" }
  ],
  "modern_lens_framing": "The Qurʾan is taken here as fixed, revealed truth; science is our provisional, evolving account of the observable world…",
  "sections": {
    "87:1": {
      "verse_range": "1-5", "title": "Glorify the Most High",
      "in_short": "Praise God, and keep His name high above anything unworthy of it…",
      "claims": [ "…records conforming to extracted_claim.schema.json…" ],
      "essay_html": "<p>…never speaking it carelessly.<sup class=\"ref\">1</sup></p>",
      "sources_used": [1],
      "source_hash": "sha256:…",
      "flags": { "creedal_stakes": false, "legal_content": false, "sensitive_content": false },
      "modern_lens": {
        "strength": "light", "html": "<p>…</p>",
        "sources": [ { "label": "…", "url": "https://…" } ],
        "verification_log": [ { "query": "…", "retrieved_snippet": "…", "url": "https://…" } ]
      },
      "compiled_at": "2026-07-27"
    }
  }
}
```

`modern_lens` is present only on sections with a genuine touchpoint (§3b); omit it otherwise. The `references` array is document-level (one numbered list per surah) so markers stay stable across sections, and every entry carries its `author_id` (→ `commentators.json`) and `source_language`. `coverage.independent_works` — **not** a raw edition count — is what may be surfaced to the reader, and never as a claim of thoroughness or consensus (§2.7). The essay is rendered **from** the `claims` layer, which is the durable, reusable asset.

**Persistence.** A surah is compiled once and stored. Before compiling, check for an existing `data/tafsir_overview/{NNN}.json` and reuse it. Recompile to correct an error, add a newly-available edition, or when the model/prompt version changes materially (tracked in `pipeline_provenance`).

Integration in `js/scholar.js`: when an Overview entry exists for the active section, inject it as a synthetic edition at the top of the tafsir `<select>`, label it **Overview**, select it by default, and render `essay_html`. The disclaimer (§6) is shown under the section header (or as an info affordance next to the label).

## 6. Disclaimer

Shown wherever Overview is presented:

> Compiled from multiple classical and modern commentaries across languages, gathered into one approachable English overview. It reflects only what those sources say — not independent opinion. Named attributions show which scholar each point comes from.

## 7. Editions (grounded catalogue)

The authoritative, live edition list is **`quran/data/commentators.json`** — do not
maintain a separate hand-written list here (that is how the earlier
memory-sourced editions crept in). As catalogued from the Quran Foundation API
(2026-07-26): **20 editions across 6 languages** (Arabic 7, English 3, Urdu 4,
Bengali 4, Russian 1, Kurdish 1), resolving to **15 distinct works**. Three works
have a ready English edition (Ibn Kathīr, Maʿārif al-Qurʾān, Tazkīr al-Qurʾān);
the rest are translated into English (§4 step 5). Same-work editions across
languages count as one voice (§2.7).

**Not served by the API** (removed from the earlier spec as memory-sourced):
al-Kashshāf, al-Jalālayn, Naẓm al-Durar, al-Taḥrīr wa-l-Tanwīr — see
`commentators.json → removed_unavailable`. Re-add only if a credentialed
`list_editions` call actually returns them. **Fatḥ al-Majīd** (Bengali) is in the
API but is a commentary on *Kitāb al-Tawḥīd*, not a Qurʾān tafsir — flagged
`exclude_recommended` pending a decision.

## 7a. Progress tracking

`scripts/overview_progress.py` scans `data/tafsir_overview/*.json` against `data/theme_breaks.json` and writes `data/tafsir_overview/_progress.json` plus a self-contained dashboard at `docs/overview-tafsir/progress.html`. Run it after compiling a surah to refresh the view. The phased completion plan and per-session budgets live in `PROJECT_PLAN.md`; the dashboard is the live source of truth for what is done and what is next. (The store was **cleared to zero** in the 2026-07-27 grounded rebuild; both `_progress.json` and `progress.html` regenerate on the next scan.)

## 8. Open items

- **Panel review (2026-07-26):** an internal simulated 20-discipline advisory
  panel reviewed this spec. Concrete, traceable action items — a coverage-honesty
  fix, always-visible hadith grades, a dependency/consensus-inflation guard,
  reproducibility metadata, a proposed storage schema v2, and open questions for
  human/scholar decision — are in `PANEL_REVIEW_ACTIONS.md`. Those recommendations
  are simulated (hypothesis-generation only), not adopted, and await human review.
- Automate the pipeline (currently run interactively for the pilot).
- Decide how many named attributions is "enough" per thread before it clutters — the pilot errs toward representative names.
- Confirm the dropdown label and info-affordance treatment in `scholar.js`.
- Extend to a full surah set once the Al-Aʿlā output is reviewed.
