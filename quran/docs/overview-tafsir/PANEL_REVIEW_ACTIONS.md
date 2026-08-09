# Overview Tafsir — Panel Review Actions

_Derived from an **internal simulated advisory-panel review** of
`OVERVIEW_TAFSIR_SPEC.md`. Run `2026-07-26T08-51-15Z_full` (20 disciplinary
perspectives). Last updated 2026-07-26._

> **These recommendations are simulated, not scholarly authority.** They were
> produced by AI models role-playing disciplinary perspectives, for design
> hypothesis-generation only — not fatwa, clinical judgment, or ijmāʿ. Agreement
> among simulated experts is *not* scholarly consensus. Every item below is a
> proposal for the human project owner to accept, modify, or reject. Nothing
> here has been adopted into the canonical spec automatically.

This document translates the panel synthesis into concrete actions, grouped by
how safe they are to adopt. Citations in `(role:item)` form trace each action to
the opinions that produced it; the full run lives in the private council repo.

---

## The one finding everything orbits

**Consensus-inflation.** Nine disciplines independently reached the same
structural gap: nothing in the pipeline distinguishes *independent* scholarly
convergence from **shared citational lineage** (later works quoting al-Ṭabarī)
or a **translation/abridgement counted alongside its own original**. Until that
exists, `^[1,3,5]` clusters and `commentators_studied: N` can manufacture an
appearance of corroboration the sources do not support — the precise thing the
project Philosophy refuses to build.

---

## A. Adopt now — safe, additive, clearly correct

These are additive (new stored fields, new render rules, a factual correction).
None require a scholar's judgment to be *correct*; they only require your assent
to be *adopted*. A proposed schema v2 capturing the data-model items is in §D.

1. **Fix the language-coverage overclaim (§1).** §1 says the feature gathers
   commentary "across all languages," but the pilot's actual editions (§7) are
   Arabic + English only; Urdu appears solely via English translations of
   Urdu-original works, and Bengali/Kurdish/Russian are absent. Reword §1 to
   claim only what a given surah actually has, and disclose per-surah coverage.
   *(agreement; 10_urdu:M1, 11_bengali:M1, 12_other_lang:M1 — all high)*

2. **Never surface `commentators_studied` as a weight/thoroughness signal.**
   It is a fetch-coverage count, not evidence of corroboration or
   representativeness. Keep it in data; do not render it as "compiled from N
   commentaries" implying authority. *(agreement; flagged by 10 of 20 roles)*

3. **Store per-reference `source_language` distinct from edition language**, so
   an English edition of an Urdu-original work is never treated as
   English-original scholarship. *(SHOULD; 13_translation_studies, 10_urdu)*

4. **Add an explicit `omitted_editions` / `omitted_languages` field with
   reasons** to the stored JSON, rather than signalling omission by absence from
   the reference list — absence won't survive automation across many surahs.
   *(MUST; 18_ontology:M2, 09_textual_editing:M2)*

5. **Render hadith/athar grade as always-visible metadata.** Every report shows
   its grade or an explicit `ungraded by [source]` state — silence must not
   read as authentication. Store whether the citing commentator endorses,
   relays, or refutes it. *(MUST; 03_hadith:R1,M1)*

6. **Keep a recoverable link from every plain-English gloss back to the original
   term** (legal, spiritual, or linguistic) instead of glossing silently — one
   mechanism serves all three vocabularies. *(compatible agreement; 02, 06, 07)*

7. **Add reproducibility metadata to storage:** model id, prompt/template
   version, sampling params, and a content hash (or snapshot reference) of the
   raw fetched tafsir per compiled section — without it, a future model upgrade
   + recompile can silently change framings with no diff. *(MUST; 19_ai_and_nlp:R*,M1)*

8. **Record the `theme_breaks.json` version/hash** a section was compiled
   against, so boundary drift is detectable later. *(SHOULD; 18_ontology)*

9. **Add `work_period` and `genre_or_method` to each reference entry**, so
   rhetorical/linguistic works are not flattened into report-based ones and
   historical dependence is visible. *(SHOULD; 08_history, 02_arabic_linguistics)*

10. **Modern-lens (§3b) discipline hardening (additive parts):** restrict its
    scope in writing to physical/natural-science touchpoints the mufassirūn
    themselves gesture toward — explicitly **out of scope**: positive-psychology,
    neuroscience-of-meditation, behavioural "benefits of dhikr/ṣabr" — pending
    sign-off; and **log the search queries + retrieved snippets** behind every
    science-verification claim (the one *critical* warning in the run).
    *(MUST_NOT + MUST; 19_ai_and_nlp:M3 critical, 05, 14)*

---

## B. Needs your decision (judgment calls)

> **Owner decisions (2026-07-27):**
> - **Default selection: YES** — Overview is the default, top-of-dropdown view.
>   It is a compilation of existing knowledge; a later pass adds an explicit
>   "synthesis across multiple commentators and languages" disclosure so readers
>   understand what it is.
> - **Review model: fidelity, not adjudication.** The owner is not acting as a
>   scholar and issues no rulings. "Human review" of creedal/legal/sensitive
>   sections means confirming the compilation *faithfully reflects and orders what
>   the sources say*, with attribution and disagreement preserved — never deciding
>   between views. This matches the project's "attribute, never adjudicate" spine
>   and is built into the fidelity gate (`store.check_section`) + the DEPLOYMENT
>   step-3 read.

Remaining open items below still benefit from your judgement.

1. ~~Should Overview remain the default selection?~~ **Decided: yes** (above).

2. **The "positive framing" rule (§2.6) vs. recorded disagreement.** Locating
   every difficulty "on the reader's side" risks functioning as suppression of
   genuine, unresolved disagreement the fetched sources themselves record. Where
   is the line? *(UNRESOLVED; 20_ethics:M1 high)*

3. **Message-first "In short" compression on contested verses.** Whether a given
   verse is "disagreement on detail" (safe to compress) or "disagreement on
   basic sense" (unsafe) is itself a tafsir/theology/fiqh judgment — flagged for
   **real human review**, not an editorial fix. *(conflict, requires_human_review)*

4. **School-marked theological content in an unnamed voice.** How to handle e.g.
   al-Kashshāf's Muʿtazilī-inflected readings when folded into "the commentators
   say." *(UNRESOLVED)*

---

## C. Needs code + real human reviewers (out of scope for autonomous change)

These are real work items but touch live pipeline code, recompilation of
already-compiled surahs, or the recruitment of qualified human reviewers — none
of which should be changed on the strength of a simulated review. Listed so they
are not lost.

- **Dependency / `derivative_of` model** to detect shared citational lineage
  before any "agree"/count language is shown (the headline finding). *(MUST)*
- **Intermediate `claims` layer** between raw commentary and final essay, with
  per-claim verse/word attachment and `linguistic_basis`
  (grammar/rhetoric/narration) — without it the "structured knowledge before
  presentation" premise is not actually met by this feature. *(agreement; 18, 02)*
- **Creedal-stakes** and **legal-derivation (madhhab)** review gates and prose
  overrides for flagged sections. *(MUST; 04_theology, 07_fiqh)*
- **Pastoral-sensitivity review pass** (punishment/despair/apostasy) distinct
  from the accuracy QA, plus optional signposting. *(SHOULD; 15_pastoral:M1 high)*
- **Independent grounding verification** (not the same-architecture self-QA).
  *(MUST; 19_ai_and_nlp)*
- **Named accountable human sign-off** before an Overview goes live as default;
  clarify whether the §4 step-8 QA is human or automated. *(MUST; 20_ethics)*
- **Comprehension testing** of the §3 style rules on a broader reader sample
  before locking them in, plus a "read these editions next" pointer. *(SHOULD; 16_education)*
- **Mufassir review** of whether thematic-section boundaries fragment any
  commentator's continuous argument, before templating on other surahs. *(SHOULD; 01_tafsir)*

---

## D. Proposed storage schema v2 (concrete, for §A adoption)

Additive superset of the current §5 shape. New keys marked `// NEW`.

```jsonc
{
  "surah": 87,
  "coverage": {                                   // NEW (A1)
    "languages_present": ["ar", "en"],
    "languages_via_translation": ["ur"],          // Urdu-origin, English-rendered
    "languages_absent": ["bn", "ku", "ru"],
    "note": "Arabic and English editions only for this surah."
  },
  "omitted_editions": [                            // NEW (A4)
    { "edition": "ar-tahrir-wa-tanwir", "reason": "very long; angle overlaps al-Biqāʿī here" },
    { "edition": "ar-ibn-kathir", "reason": "redundant with en abridgement for this surah" }
  ],
  "pipeline_provenance": {                         // NEW (A7)
    "model": "…", "prompt_version": "…",
    "sampling": { "temperature": 0 },
    "theme_breaks_version": "sha256:…"             // NEW (A8)
  },
  "references": [
    {
      "n": 1, "edition": "ar-tabari", "label": "al-Ṭabarī, Jāmiʿ al-Bayān",
      "note": "foundational; range of early opinion",
      "source_language": "ar",                     // NEW (A3)
      "work_period": "3rd c. AH", "genre_or_method": "riwāya", // NEW (A9)
      "derivative_of": null                        // NEW (C — dependency model)
    }
  ],
  "commentators_studied": 12,                      // keep; DO NOT render as authority (A2)
  "sections": {
    "87:1": {
      "verse_range": "1-5", "title": "…", "in_short": "…",
      "essay_html": "…",
      "sources_used": [1, 3, 5],
      "source_hash": "sha256:…",                   // NEW (A7)
      "flags": {                                   // NEW (C — routing)
        "creedal_stakes": false, "legal_content": false, "sensitive_content": false
      },
      "claims": [                                  // NEW (C — structured layer)
        {
          "text": "…", "attaches_to": "87:1",
          "sources": [1, 3], "linguistic_basis": "narration",
          "report_grade": null, "commentator_stance": null,
          "original_terms": [ { "term": "sabbiḥ", "gloss": "glorify / declare free of fault" } ],
          "theological_school": null, "madhhab": null
        }
      ],
      "modern_lens": {
        "strength": "light", "html": "…",
        "sources": [ { "label": "…", "url": "…" } ],
        "verification_log": [                       // NEW (A10)
          { "query": "…", "retrieved_snippet": "…", "url": "…" }
        ]
      },
      "compiled_at": "2026-07-11"
    }
  }
}
```

---

## Provenance

Full opinions, synthesis, and traceability: private council repo,
`panel_runs/2026-07-26T08-51-15Z_full/`. Panel is simulated; treat as input to
human review, not as a decision.
