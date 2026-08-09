# Overview pipeline — deployment runbook

Everything below runs on **your machine with real credentials**. The pipeline
code is complete and grounded; these are the steps to take it live. Do a
one-surah dry run first and read the output before compiling at scale.

## 1. Credentials & install

```bash
pip install requests anthropic          # anthropic only for the batch path
export QF_CLIENT_ID=…  QF_CLIENT_SECRET=…    # already in quran/.dev.vars
export ANTHROPIC_API_KEY=…                    # batch path only
```

Confirm `QF_API_BASE` / `QF_AUTH_URL` in `config.py` match your Quran Foundation
account docs (defaults follow the public API).

## 2. Confirm the live catalogue matches ours (resolves the memory question for good)

```bash
python -m scripts.overview_pipeline.status catalogue   # (see step 6 if not present)
# or a one-liner:
python -c "import sys;sys.path.insert(0,'scripts'); from scripts.overview_pipeline import qf_client as q; \
print([t['slug'] for t in q.list_tafsirs()])"
```

Every slug your run cites must appear here. If the API serves editions not yet in
`data/commentators.json` (e.g. a real al-Jalālayn), add them to the catalogue
first — author, chronology, language, English plan — never let the model supply
them.

## 3. Dry run — one section, inspect before trusting

```bash
# Subscription path (no API bill), a single section:
python -m scripts.overview_pipeline.subscription run --surahs 78 --limit 1

# then read it
python -c "import json;print(json.dumps(json.load(open('data/tafsir_overview/078.json')),ensure_ascii=False,indent=2))" | less
```

Check by eye (this is the human review — **fidelity, not rulings**):
- every `essay_html` point traces to a `claims` record, and every claim's
  `sources` are works that were actually fetched (the gate enforces this, but
  read it anyway);
- non-English sources read as faithful renderings, with `original_terms` kept;
- disagreements are laid side by side, no verdict invented;
- `coverage` honestly lists languages present/absent;
- `flags` (creedal / legal / sensitive) look right for the passage.

## 4. Compile a slice (short-first, per PROJECT_PLAN)

**Batch path (cheapest):**
```bash
python -m scripts.overview_pipeline.batch build   --surahs 78-114   # writes _work/ + prints cost
python -m scripts.overview_pipeline.batch submit  _work/batch_input.jsonl
python -m scripts.overview_pipeline.status batch                    # wait for "ended"
python -m scripts.overview_pipeline.batch collect                   # fidelity+schema gated write
```
Rejected sections (fidelity/schema) are reported and **not saved** — rebuild/resubmit those.

**Subscription path (billed to Max, no API cost):**
```bash
python -m scripts.overview_pipeline.subscription run --surahs 78-114 --limit 30
```

## 5. Modern-lens (§3b) — separate verified pass

Batch runs `OVERVIEW_MODERN_LENS=manual` (no science layer). Add the physical/
natural-science touchpoints afterward in a pass that web-searches and **logs the
query + snippet** per claim (`verification_log`). Never psychology/behavioural
resonances (spec §3b).

## 6. Monitor

```bash
python -m scripts.overview_pipeline.status store     # X / 1228, surahs complete
open docs/overview-tafsir/progress.html
```

## 7. Handoff: the unattended whole-Qurʾan batch

The goal is a single non-urgent batch that works through all 1,228 sections. The
model is **Sonnet** (`claude-sonnet-5`, the default — good enough for this
compilation; Opus is not needed).

### Cost (Sonnet, Batch API, 50% off)

Anchored on a real section (112:1 fetched ~28k input tokens across 14 voices) and
a conservative ~30k-input / ~3k-output average per section:

| Pricing | Rough full-Qurʾan cost |
|---|---|
| Standard ($1.5 in / $7.5 out per M, batched) | **~$85** |
| Intro to 2026-08-31 ($1 / $5 per M, batched) | **~$55** |

Budget **~$100** to be safe. `preflight` and `build` both print a live estimate
from the actual fetched sizes before you ever submit — no blind spend.

### Pre-handoff checklist

1. **Read a sample.** Do the step-3 fidelity read on 112:1 (and ideally 1–2
   more) and be satisfied it faithfully reflects the sources.
2. **`preflight`** — `python -m scripts.overview_pipeline.batch preflight`. It
   verifies creds, reconciles the catalogue vs the live API, counts pending
   sections, samples one for size, and projects cost. Fix anything it flags.
3. **Decide the 3 extra editions** the credentialed API serves that aren't in
   `commentators.json` (preflight lists them) — add deliberately or ignore.
4. **Confirm budget** and that `ANTHROPIC_API_KEY` + QF creds are set.

### The one-er (two phases: fetch the corpus once, then compile from it)

**Phase 1 — fetch the raw tafsir into the local corpus (`data/tafsir_raw/`).** This
is the slow part (sequential, tens of thousands of QF calls, hours) but it runs
**once** and is fully resumable — only missing verses are fetched. Run it overnight
or in chunks; nothing downstream re-hits the API.

```bash
python -m scripts.overview_pipeline.corpus fetch --surahs 78-114   # then 50-77, … or omit for all
python -m scripts.overview_pipeline.corpus status                  # verses cached per edition
```

**Phase 2 — compile from the corpus (fast; no more fetching).**

```bash
python -m scripts.overview_pipeline.batch preflight
python -m scripts.overview_pipeline.batch build            # reads the corpus → _work/ (+ live cost)
python -m scripts.overview_pipeline.batch submit _work/batch_input.jsonl
python -m scripts.overview_pipeline.status   batch         # poll (batches can take up to 24h)
python -m scripts.overview_pipeline.batch collect          # gated write; failures → _work/failures.jsonl
# mop up anything that failed the gate or truncated:
python -m scripts.overview_pipeline.batch build            # only recompiles still-pending sections
#   ...submit ...collect again. Repeat until status store shows 1228/1228.
```

`build` also works without Phase 1 — it fetches+caches any missing section on the
fly — so Phase 1 is an optimisation and a durable source archive, not a hard
prerequisite. The raw corpus is git-ignored (large); back it up to R2 if you want
it preserved.

### What protects an unattended run (guards now in place)

- **Anti-truncation:** `MAX_TOKENS=16000` — big multi-claim sections won't clip
  into invalid JSON. Any that still hit the cap are reported (`stop_reason`) and
  logged to `failures.jsonl`, never silently lost.
- **Context-overflow guard:** per-section input is budget-trimmed
  (`PER_EDITION_CHAR_CAP`, `SECTION_CHAR_BUDGET`) so even the huge legal sections
  of surahs 2–9 never blow the window; trimmed voices are disclosed
  (`truncated_sources`).
- **Network resilience:** QF fetches retry with backoff on 429/5xx, so a hiccup
  during the long build doesn't drop a voice or kill the run.
- **Resumable everywhere:** `build` skips already-compiled sections and *merges*
  `section_meta`; `collect` re-runs safely. Stop and resume freely.
- **The fidelity + schema gate** still rejects (never saves) any section that
  cites an unfetched source or breaks the claim schema — those go to
  `failures.jsonl` for a retry, not into the store.

### Known operational notes

- **The fetch (Phase 1) is slow, but one-time.** It is sequential (per verse × 14
  editions), tens of thousands of QF calls, hours — but it caches to
  `data/tafsir_raw/` and never re-hits the API. Fully resumable; run overnight or
  in chunks (`corpus fetch --surahs 78-114`, then `50-77`, …). Phase 2 (`build`)
  then reads the cache and is fast.
- **One batch fits.** 1,228 requests is well under the Batch API's limits
  (100k requests / 256 MB); no need to split the submit.
- A future speedup (parallelising fetches, or a KV push for live console counts)
  is optional, not required for correctness.

## What is intentionally NOT automated

- **The fidelity read** (step 3) — a human confirming the compilation reflects the
  sources. Not scholarly adjudication; just faithful ordering of what is written.
- **Adding a newly-served edition** to `commentators.json` — a deliberate act, so
  the catalogue never grows from a model's memory.
- **Setting Overview as the reader default** — a `scholar.js` change (decided:
  yes; later work adds the "synthesis across commentators & languages" disclosure).
