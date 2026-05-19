# Thematic Labels — Implementation Roadmap

**Owner:** Maaz
**Status:** Draft v1
**Last updated:** 2026-05-17

## 1. Goal

Allow a user to select one or more themes (e.g. *Mary*, *Mercy*, *Inheritance*, *Hypocrisy*) and see every existing thematic section in the Qur'an that touches those themes. Each section can carry multiple labels; labels are drawn from a curated, multi-faceted taxonomy.

This is a content + UX project as much as an engineering one. The roadmap below is sequenced so that we de-risk the **taxonomy** and **labeling quality** before we invest in the **filtering UI**. Shipping a beautiful filter on top of bad labels is worse than shipping nothing.

---

## 2. Guiding principles

1. **Sections, not verses, are the unit of labeling.** The app already groups verses into sections via `data/theme_breaks.json`. Every label attaches to a `(surah_no, start_ayah)` key — the same identity used by `createCard()` and the share-link format `#s=…&v=…-…`.
2. **Multi-label by design.** Most sections sit at the intersection of several themes (a story about Mary is also about miraculous birth, divine mercy, and refutation of Trinitarian theology). The data model must accept many labels per section from day one.
3. **Faceted taxonomy.** A flat list of 400 tags is unusable. Group labels into facets (People, Divine Attributes, Worldly Matters, Ethical/Spiritual States, Eschatology, Du'a, etc.) so the UI can present them cleanly.
4. **Sourceable, not opinion-only.** Where a label is contested, we record the tafsir / scholarly source that justified it. This protects credibility and creates an audit trail.
5. **Author-in-the-loop, LLM-assisted.** Generate candidate labels with an LLM, but every label that ships is reviewed by a human (initially Maaz, later trusted contributors). The same applies to the taxonomy itself.
6. **Static-first.** The current site is a static SPA with a Cloudflare Functions proxy. Labels should ship as a JSON file alongside `theme_breaks.json` — no new backend until the read-side and write-side genuinely require it.
7. **Versioned content.** Both the taxonomy and the label assignments need version numbers so the client can cache them, the URL share format stays stable, and we can roll back.

---

## 3. Roadmap at a glance

| Phase | Outcome | Effort | Gate to next phase |
|---|---|---|---|
| 1. Taxonomy design | A documented, faceted label set (v1) | 1–2 weeks | A pilot reviewer can label 50 sections using it without inventing new tags |
| 2. Data schema & tooling | `labels.json` format, section-id strategy, authoring tool plan | 3–5 days | Schema reviewed and frozen for v1 |
| 3. Pilot labeling | 1 surah (Maryam, ch. 19) fully labeled by hand, then 1 surah labeled by LLM-then-reviewed | 1–2 weeks | Inter-rater agreement >80% on overlap sample |
| 4. Full corpus labeling | Every section in `theme_breaks.json` carries ≥1 label | 4–8 weeks (most of which is review, not generation) | <5% of sections labeled "unknown"; coverage report passes |
| 5. Section-level UI | Labels visible on each card; clicking a label scopes the view | 1 week | Visual QA passes, mobile usable |
| 6. Theme browser | Dedicated view to pick themes and see matching sections across the whole Qur'an | 1–2 weeks | Filters return correct results on a regression suite of ~30 queries |
| 7. Search & cross-cutting polish | URL state, analytics, perf, accessibility, i18n (en/ur), shareability | 1 week | Lighthouse + a11y audit clean |
| 8. Community & evolution | Contribution flow for label corrections; taxonomy v2 | ongoing | — |

---

## 4. Phase 1 — Thematic taxonomy

The single most important deliverable in this whole project. Everything downstream depends on it.

### 4.1 Facets (proposed top level)

A label belongs to exactly one facet. The facet drives the visual treatment (icon, color) and helps the UI present categories without overwhelming the user. Proposed facets, with examples:

- **People & Figures** — `Adam`, `Noah`, `Abraham`, `Moses`, `Pharaoh`, `Jesus`, `Mary`, `Children of Israel`, `Hypocrites`, `People of the Book`, `Quraysh`, `Believers`, `Disbelievers`.
- **Divine Attributes** — drawn from the 99 names + their semantic clusters: `Mercy`, `Justice`, `Sovereignty`, `Forgiveness`, `Wisdom`, `Power`, `Light`, `Provision`, `Knowledge`, `Oneness (Tawhid)`.
- **Du'a & Supplication** — `Du'a of the Prophets`, `Du'a for forgiveness`, `Du'a for guidance`, `Du'a in distress`, `Du'a for family/offspring`. (These are sections where a supplication is *uttered*, not merely *commanded*.)
- **Worldly Matters / Law** — `Marriage`, `Divorce`, `Inheritance`, `War & Treaties`, `Trade & Debt`, `Food (Halal/Haram)`, `Ritual Purity`, `Fasting`, `Hajj`, `Zakat`, `Oaths`.
- **Ethical & Spiritual States** — `Patience (Sabr)`, `Gratitude (Shukr)`, `God-consciousness (Taqwa)`, `Trust (Tawakkul)`, `Repentance (Tawbah)`, `Humility`.
- **Negative Attributes / Warnings** — `Anger`, `Arrogance`, `Plotting (Makr)`, `Hypocrisy`, `Greed`, `Slander`, `Mockery`, `Disbelief`, `Idolatry (Shirk)`.
- **Eschatology** — `Day of Judgment`, `Paradise`, `Hell`, `Resurrection`, `The Hour (signs of)`, `Reckoning`, `Intercession`.
- **Cosmology & Creation** — `Creation of the heavens and earth`, `Stages of human creation`, `Natural signs (Ayat)`, `Angels`, `Jinn`.
- **Revelation & Prophethood** — `The Qur'an itself`, `Prophethood (general)`, `Previous scriptures`, `Miracles`, `Challenge to produce its like`.
- **Narrative arcs** — `Story of …` (cross-cuts with People). Use sparingly when a story spans multiple sections.

### 4.2 Decisions to make explicitly during taxonomy design

- **Granularity ceiling.** Is "Du'a for forgiveness" a label, or is it "Du'a" + "Forgiveness" combined at query time? Recommendation: keep individual labels coarse-grained and let multi-selection do the narrowing; users get more recall, fewer empty filters.
- **Hierarchy or flat?** Recommendation for v1: **flat within a facet**, with optional `aliases` (so `Tawhid`, `Oneness of God`, `Monotheism` all resolve to one label). No nested parent/child relationships in v1 — they explode review effort.
- **The 99 Names question.** Treat the 99 names as a *reference list* used to seed the Divine Attributes facet, but **don't auto-create 99 separate labels**. Many names cluster (Ar-Rahman/Ar-Rahim → `Mercy`). Start with ~15–20 attribute labels covering the dominant clusters; expand if real sections demand finer granularity.
- **Cross-religion proper nouns.** Decide once: do we use `Jesus` or `Isa`? `Moses` or `Musa`? Recommendation: English primary (`Jesus`), Arabic/transliteration as `alias` and as the display name when the UI language is Urdu/Arabic.
- **"Negative" label scoping.** A section *about* hypocrites is labeled `Hypocrites` (People) + `Hypocrisy` (Negative). A section *warning believers against* hypocrisy gets `Hypocrisy` only. Document this rule in the taxonomy spec — it's the difference between a person-tag and a trait-tag.
- **What gets a `Du'a` label.** Recommendation: only sections containing an *uttered* supplication (often introduced by "Rabbanā…"), not sections describing one. Tightens the filter so users searching "duas" get sections they can actually recite.

### 4.3 Deliverable

A `docs/taxonomy.md` (separate file) containing: every label, its facet, a one-line definition, 2–3 example sections that should carry it, and aliases. **This document is the contract** — labeling reviewers consult it, the LLM gets it as system prompt context, and disagreements are resolved by amending it.

---

## 5. Phase 2 — Data schema & tooling plan

### 5.1 Section identity

A section is uniquely keyed by `"{surah}:{startAyah}"` — e.g. `"2:1"`, `"19:16"`. This matches `theme_breaks.json` exactly and is stable across UI changes. The end ayah is *derived* from the next break or the surah's last verse, so it should **not** be part of the section ID (otherwise re-tuning a break invalidates all labels on the surrounding sections).

**Edge case:** if a user re-tunes a break in edit mode, sections shift. For now, labels are tied to the canonical `theme_breaks.json` — user-customized breaks (stored in `localStorage` as `customBreaks_*`) don't carry labels in v1. Revisit if community-contributed breaks become a feature.

### 5.2 Files to add

```
data/
  thematic_labels/
    taxonomy.json          # canonical label registry (id, facet, displayName, aliases, definition)
    assignments.json       # { "2:1": ["divine-mercy", "guidance", ...], ... }
    coverage.json          # generated: per-surah label coverage + "unlabeled" sections
    CHANGELOG.md           # human-readable history of taxonomy + assignment changes
```

Both `taxonomy.json` and `assignments.json` carry a `version` field. The client fetches them with a versioned query string (e.g. `?v=2.5.0`) so we can bust Cloudflare's cache cleanly when we publish updates.

### 5.3 Taxonomy entry shape (illustrative)

```
{
  "id": "divine-mercy",
  "facet": "divine-attributes",
  "displayName": { "en": "Mercy", "ur": "رحمت" },
  "aliases": ["Rahmah", "Ar-Rahman", "Ar-Rahim", "Compassion"],
  "definition": "Sections that foreground God's mercy, compassion, or forgiveness as the dominant theme.",
  "color": "#56A3A6"
}
```

Keep `id` short, kebab-case, and **never reused**. Renames change `displayName`, not `id`.

### 5.4 Authoring tool

For Phase 3 onward, hand-labeling 1500+ sections in a JSON file by typing IDs is hostile. Plan a lightweight in-app **labeling mode** (gated behind a `?label=1` flag or a hidden toggle), reusing the existing edit-mode plumbing:

- Each card gets a chip strip with the section's current labels.
- A typeahead search adds labels (autocompletes from `taxonomy.json`, suggests aliases).
- A "candidate labels" section shows LLM suggestions with one-click accept/reject.
- All edits write to `localStorage` first; an "Export labels diff" button produces a JSON patch that Maaz commits to `assignments.json`.

This keeps the labeling workflow inside the same product the labels serve — reviewers see exactly the verses they're labeling, in context, with audio.

---

## 6. Phase 3 — Pilot labeling

The goal of the pilot is to validate the taxonomy and the LLM pipeline before scaling.

### 6.1 Round 1 — Hand-label one surah

Pick **Surah Maryam (19)**. It is rich in People, Du'a, Divine Attributes, and Narrative facets — a stress test for the taxonomy. Maaz labels every section manually, *without* LLM assistance, and notes every time the taxonomy felt insufficient. Amend the taxonomy in response. This calibrates the human reviewer and shakes out missing labels.

### 6.2 Round 2 — LLM-assisted labeling on a second surah

Pick **Surah Al-Baqarah (2)** — the largest and most thematically diverse. Run the LLM-assisted pipeline (see §6.3) on it, then have Maaz review every suggestion. Measure:

- **Precision:** of labels the LLM suggested, how many were accepted?
- **Recall:** of labels Maaz added during review, how many had the LLM missed?
- **Taxonomy churn:** how many new labels did review demand?

Target: precision ≥ 85%, recall ≥ 80%, churn near zero. If precision is bad, fix the prompt or shrink the label set. If recall is bad, the taxonomy may be too coarse.

### 6.3 LLM pipeline design

Per section, the prompt contains:
1. The system prompt: definition of the task, the **entire taxonomy** (it's small — under 10k tokens), the labeling rules from §4.2.
2. The section: Arabic, English translation, and (optionally) the first paragraph of a major tafsir (Ibn Kathir) fetched via the existing `/api/qf-public` proxy.
3. Surrounding context: the section before and after, for thematic continuity.

Output: structured JSON — `{ labels: [...], confidence: "high|medium|low", rationale: "…", suggestedNewLabels: [...] }`. The `rationale` is critical: it gives the reviewer something to evaluate without re-reading every tafsir.

Use **Claude Opus** for the actual labeling, **Claude Haiku** for cheap re-passes (cross-checks, coverage scans). Run in batches of 50–100 sections per file with a deterministic seed so re-runs are reproducible.

### 6.4 Inter-rater check (lightweight)

Once a second reviewer is involved, re-label a random 50-section sample from Maryam + Al-Baqarah independently and compute label-level Jaccard overlap. Below 0.6 means the taxonomy is too subjective; revise definitions before scaling.

---

## 7. Phase 4 — Full corpus labeling

Apply the pipeline to every section in `theme_breaks.json`. Some discipline:

- **Coverage report.** A script reads `assignments.json` and prints, per surah: count of sections, average labels per section, distribution by facet, and any sections with zero labels. Block release until "unlabeled" is under 5% (and those exceptions are deliberate — e.g. opening basmalas).
- **Label frequency audit.** If a label is assigned to *no* sections, it shouldn't exist. If a label is assigned to *most* sections, it's probably too vague (`Guidance` might be one — split or drop).
- **Cross-surah consistency spot-checks.** Pick five themes (Mercy, Hypocrites, Hell, Marriage, Du'a) and read every section tagged with each. Re-label any that don't fit. This is the single highest-leverage QA pass — it catches systematic drift the LLM introduces.
- **Don't auto-merge.** Every LLM batch produces a diff; Maaz (or a designated reviewer) approves and merges the diff into `assignments.json` like a PR.

---

## 8. Phase 5 — Section-level UI

The minimum visible UI that makes labels useful before the dedicated browser ships.

### 8.1 Per-card label chips

Below the verse-range header on each card, render a horizontal strip of label chips, one per assigned label, colored by facet. Click a chip → opens the Theme browser (Phase 6) pre-filtered to that label. On mobile, the strip scrolls horizontally; truncate to 3–4 chips with a "+N more" affordance.

Visual constraints to enforce from day one:
- A facet has a fixed color. Use desaturated/dark variants to avoid clashing with the existing teal accent (`#56A3A6`).
- Chips never wrap the section header — they sit *below* the existing header row.
- In Urdu mode (`dir="rtl"` already used for the translation div), the chip strip mirrors correctly.

### 8.2 No new card actions in v1

Resist adding a "Find more like this" button or a "Remove label" control to the card. The chip + browser is enough surface; we'll see what users actually want before adding more.

---

## 9. Phase 6 — Theme browser

This is the headline feature. Two surfaces:

### 9.1 The picker

A dedicated route/view (suggested: `#themes` hash or a new top-level toggle alongside the existing `surah`/`juz` view modes in `currentViewMode`). It shows the taxonomy grouped by facet, with each label as a selectable chip. A counter shows live results: "147 sections match".

UX decisions:

- **AND vs OR semantics.** Default: **AND across facets, OR within a facet**. So selecting `Mary` + `Du'a` finds sections about Mary that contain a supplication; selecting `Mary` + `Jesus` (both in People) finds sections about either. Surface this clearly with the chip layout — a single AND row of facet groups, with OR chips inside each.
- **Empty-state guidance.** When zero sections match, suggest the closest non-empty subset rather than dead-ending.
- **Quick-presets.** Three or four curated combinations as starter buttons: "Stories of the Prophets", "Du'as you can recite", "Sections on Mercy", "The Day of Judgment". These both teach the feature and seed analytics.

### 9.2 The results view

A vertical list of matched sections, each rendered using the existing `createCard()` component (same audio, same scholar modal, same share link). Above the list, show:

- The active filter as removable chips.
- A sort selector: `Qur'anic order` (default) | `Most labels` | `Shortest first`.
- A "Save this query" affordance for signed-in users (Phase 7+).

### 9.3 URL state

The filter state belongs in the URL hash so a user can share `#themes?include=mary,du-a` and land on the same results. Add this to the existing hash router pattern (we already parse `#s=…&v=…-…`).

### 9.4 Performance budget

`assignments.json` for ~1500 sections × ~3 labels each is ~50–150 KB ungzipped — trivial. Filter in-memory; no need for a search index. Build a reverse index (`labelId → [sectionIds]`) on load and cache it. First filter result must render in <100ms on mid-tier mobile.

---

## 10. Phase 7 — Cross-cutting polish

- **Analytics.** Reuse `sendAnalyticsEvent`. Track: `theme_filter_applied` (labels + count), `theme_chip_clicked` (which facet/label), `theme_results_clicked` (which section), `theme_empty_state_shown`. This data tells us which labels are actually useful and which are dead weight in the taxonomy.
- **Search box.** Once labels exist, add a simple keyword box that matches against `displayName` + `aliases` so users who type "Moses" don't have to know the People facet exists. This is high-leverage and cheap.
- **Internationalization.** Label display names already carry `{ en, ur }`. The picker reads the active language from `languageSelect`. Arabic display is a fast follow.
- **Accessibility.** Chips are buttons with `role="button"` and proper `aria-pressed` state. Filter changes announce results count to screen readers via an `aria-live` region.
- **Offline / PWA.** The labels JSON is small enough to be precached by the service worker (alongside `quran_data.json` and `theme_breaks.json`). Update `manifest.json` / SW cache list.
- **Share images / video exporter.** `js/video-exporter.js` could optionally render section labels onto the video slate. Defer until Phase 6 ships, but track it.

---

## 11. Phase 8 — Community & evolution

Once labels are live and being used:

- **"Suggest a label" affordance** on each card — opens a small form that posts (via a new Cloudflare Function) into a moderation queue. Threshold: only for signed-in users (we already have QF OAuth).
- **Public taxonomy doc.** Publish `docs/taxonomy.md` as a page on the site so users understand what each label means and why a section was/wasn't tagged with it.
- **Taxonomy v2.** Plan for splits and merges. Schema must support `deprecated: true` + `replacedBy: "<id>"` so deprecated labels redirect rather than 404. Run a migration job on `assignments.json` whenever the taxonomy mutates.
- **Quarterly recall audits.** Pick a label, read every section tagged with it, and rotate through the taxonomy across the year. This is how labels stay sharp as the corpus understanding matures.

---

## 12. Open questions to resolve before Phase 1 ships

These are the decisions that will shape the rest of the project. Resolve before committing to a taxonomy:

1. **Single primary language for label IDs and display?** Recommendation: English IDs, multilingual display names.
2. **Who is the second reviewer?** Inter-rater agreement requires it. If unavailable in the short term, document the decision and move forward with single-reviewer pilots.
3. **Tafsir source policy.** Which tafsir(s) are authoritative for adjudicating disputed labels? Recommendation: Ibn Kathir as default (already wired into the Scholar modal), Ma'arif-ul-Qur'an as secondary for Urdu/contemporary nuance.
4. **Sectarian caveats.** The taxonomy will lean Sunni by default given existing tafsir choices. Decide whether/how to surface this in the public docs.
5. **What to do with the existing `Bookmarks` feature.** It already groups user-selected sections — labels are the corpus-wide analog. Consider promoting "bookmarks tagged with theme X" as a personal view in Phase 7.

---

## 13. Suggested first step

Don't start with code or a database. Spend the first session on the taxonomy: open `docs/taxonomy.md`, draft the facets, draft 60–80 labels with definitions, and hand-label Surah Maryam (19) using it. Almost every important decision in this roadmap is downstream of that exercise, and most surprises will surface in the first 30 sections.
