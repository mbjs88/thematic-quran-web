# Overview Tafsir — Completion Plan

_Companion to `OVERVIEW_TAFSIR_SPEC.md`. Last updated 2026-07-11._

The goal is one compiled English **Overview** for every thematic section of the Qur'an: **1,228 sections across 114 surahs**. Progress is tracked automatically — run `python3 scripts/overview_progress.py` and open `docs/overview-tafsir/progress.html`. That dashboard, not this document, is the live source of truth for what is done and what is next.

## Where we are

At the last scan: **11 / 1,228 sections (0.9%)**, 2 surahs complete (Al-Aʿlā, aṭ-Ṭāriq), 12 commentators studied each. The store lives in `data/tafsir_overview/NNN.json`; the scanner counts what is there.

## Why this needs a budget

Each session (one Claude conversation) has a finite context window. The cost of compiling a section is dominated by the **raw tafsir we fetch**, and that varies enormously:

- **Short Meccan surahs** (most of Juz 28–30) have short verses. Twelve editions for a whole surah fit comfortably in one pass. Cheap.
- **Long Madani surahs** (Al-Baqarah, An-Nisāʾ, Āl ʿImrān, Al-Māʾidah, etc.) have long legal verses. A single verse of al-Ṭabarī or Ibn ʿĀshūr can run thousands of tokens; twelve editions across a whole surah cannot fit in one context. Expensive.

So the plan is ordered **short-first, working backward from Sūrah 114**, and long surahs are compiled in **section-batches across several sessions** rather than in one go. Because every surah is persisted the moment it is written, the work is fully resumable: nothing already compiled is ever re-fetched.

## Roadmap (phased, short-first)

| Phase | Surahs | Sections | Character | Est. sessions* |
|------:|--------|---------:|-----------|---------------:|
| 1 | 78–114 (Juz 30) | 153 | short Meccan, cheap | 6–8 |
| 2 | 50–77 | 177 | short/medium | 8–10 |
| 3 | 36–49 | 174 | medium | 10–12 |
| 4 | 23–35 | 161 | medium | 10–12 |
| 5 | 10–22 | 239 | medium/long | 16–20 |
| 6 | 2–9 | 321 | long, legal, heavy | 30–40 |
| 7 | 1 (Al-Fātiḥah) | 3 | short but very rich | 1 |
| | **Total** | **1,228** | | **~80–100** |

\*A "session" is one fresh conversation with roughly a full context budget. The estimate is deliberately rough; it will tighten as we log actuals (see below). Done so far: 11 sections in the setup work.

### Per-session throughput targets

Rather than counting tokens directly, aim for a **section target per session** and stop before context fills:

- **Short-surah phases (1–2):** ~20–30 sections/session (≈ 4–6 whole short surahs).
- **Medium phases (3–5):** ~12–18 sections/session (1–2 surahs, or part of a longer one).
- **Long phase (6):** ~6–10 sections/session. Compile in natural blocks (a rukūʿ, or a run of thematic sections), store, and move on.

## Guardrails for the heavy surahs

For the longest legal passages, staying in budget matters more than maximal breadth:

1. **Trim the edition set per heavy verse.** The full 12 is the standard, but for the most massive ayahs, drop the two largest (Ibn ʿĀshūr's *at-Taḥrīr* and full-Arabic Ibn Kathīr) and lean on the abridged/representative sources. Record the actual `commentators_studied` per surah honestly — the dashboard shows it.
2. **Never hold a whole long surah's raw tafsir at once.** Fetch a section-batch, synthesise it, write it to the store, then let that context go before the next batch.
3. **One surah's file can grow across sessions.** Writing sections `2:1`…`2:30` in one session and `2:34`… in the next is fine; the scanner counts whatever sections are present.

## Automated runner

The interactive loop below is now also scripted in `scripts/overview_pipeline/` (see its
README). Two interchangeable paths, sharing one prompt and the same store:

- **Batch API** (`batch.py`, Opus 4.8, ~$240 for the whole Qurʾan at the 50% batch rate):
  `build → submit → status → collect`. Grounded reading only; the modern-lens layer is added
  in a verified pass.
- **Subscription** (`subscription.py`, Claude Code headless, bills the Max plan, no API cost):
  agentic and fully verified in one pass, including the web-checked modern-lens layer.

Monitor with `status.py` or the `progress.html` dashboard. Both paths skip already-compiled
sections, so runs are resumable and can be mixed.

## The repeatable loop (every session)

1. `python3 scripts/overview_progress.py` — see the dashboard, pick the next surah/sections (short-first, or resume a partial one).
2. Check for an existing `data/tafsir_overview/NNN.json` and reuse it; never recompile a done section.
3. Fetch grounding rules once, then Arabic + translation + the edition set for the target sections.
4. Synthesise each section per the spec (message-first, `^[n]` reference markers, differences shown neutrally, text honoured).
5. Write/extend `NNN.json`; optionally render the reading HTML.
6. Re-run the scanner to refresh `progress.html`.

## Suggested next steps

Continue down Juz 30 from where we are. Natural next: **88 (Al-Ghāshiyah)** — the surah the Prophet paired with Al-Aʿlā in prayer — then **85, 84, 83…** downward, or cluster by sitting (e.g., 89–95 in one session). Al-Fātiḥah is best saved for its own careful session despite being short.

## Calibration log

Fill this in as real sessions complete, to replace the estimates above with measured throughput.

| Date | Surahs done | Sections | Notes |
|------|-------------|---------:|-------|
| 2026-07-11 | 86, 87 | 11 | pilot + methodology + tracker built |
