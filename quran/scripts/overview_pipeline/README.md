# Overview compilation pipeline

Compiles the section-level **Overview** reading for the whole Qurʾan, either through
the **Anthropic Batch API** or through your **Claude Max subscription** (Claude Code).
Both paths share one prompt (`prompt.py`) and write the same store
(`data/tafsir_overview/NNN.json`), so you can mix them and never compile a section twice.

Model is **Opus 4.8** (`claude-opus-4-8`) by default — set in `config.py` / `OVERVIEW_MODEL`.

```
scripts/overview_pipeline/
  catalogue.py     grounded edition/works loader (data/commentators.json) — the
                   single source of which commentaries exist + the English plan
  config.py        model, paths, pricing, ayah counts; commentary set via catalogue
  prompt.py        shared system prompt → claims + essay (strict JSON contract)
  qf_client.py     Quran Foundation content API (OAuth); reconcile() narrows the
                   catalogue to what the API actually serves; source hashing
  corpus.py        raw tafsir cache (data/tafsir_raw/) — fetch once, compile many;
                   the durable source layer + the `fetch` phase
  store.py         sections; claim enrichment + schema validation; fidelity gate;
                   idempotent v2 merge into NNN.json (coverage, provenance, claims)
  _jsonschema.py   tiny self-contained validator for extracted_claim.schema.json
  batch.py         Batch-API path:  build → submit → collect
  subscription.py  Claude Code path (billed to Max) — same grounded flow
  status.py        monitor: store progress + batch status
```

### Grounding (v2 rebuild)

Nothing may be cited that was not fetched. The commentary set comes from
`data/commentators.json` (not a hand-written list — that is how phantom editions
once entered from memory), and `qf_client.reconcile()` further drops anything the
live API does not serve. Each section stores a structured **claim layer**
(`extracted_claim.schema.json`) that the essay is built from, and every section
passes a **fidelity gate** (`store.check_section`) before it is written: a claim
or essay that cites a source not fetched is rejected, not saved. Same-work
editions across languages (Ibn Kathīr in ar/en/ur/bn) are one voice; works with
an English edition are used directly, the rest are translated early (spec §4).

## 0. Prerequisites

```bash
pip install anthropic requests           # anthropic only needed for the batch path
```

Set secrets in the repo `.env` (see `.env.example`) and export them, or put them in your shell:

- `QF_CLIENT_ID`, `QF_CLIENT_SECRET` — Quran Foundation content API (same creds the site's
  `/api/qf-public` proxy uses; already in `.dev.vars`). Needed to fetch tafsir for the **batch** path.
- `ANTHROPIC_API_KEY` — only for the **batch** path.
- For the **subscription** path: install Claude Code, sign in to Pro/Max, and make the
  quran MCP + web search available to it (a `.mcp.json` with the quran server, and web
  search enabled). No API key required.

> The QF endpoint paths and auth headers in `qf_client.py` follow the Quran Foundation API;
> confirm them against your account docs and adjust `QF_API_BASE` / `QF_AUTH_URL` if needed.
> The edition set is whatever `data/commentators.json` lists AND the live
> `/resources/tafsirs` serves; `reconcile()` intersects the two and reports the coverage
> (languages present/absent). A surah's `coverage.independent_works` is the real number of
> voices fetched — never faked, never a static list. **See `DEPLOYMENT.md` for the runbook.**

## A. Batch API path (cheapest — 50% off, ~$240 for the whole Qurʾan on Opus)

```bash
# 1. Build the request file for a slice (short-first is the plan). Omit --surahs for all.
python -m scripts.overview_pipeline.batch build --surahs 78-114
#    → writes _work/batch_input.jsonl and prints a cost estimate

# 2. Submit it
python -m scripts.overview_pipeline.batch submit _work/batch_input.jsonl
#    → prints a batch id (saved to _work/last_batch_id.txt)

# 3. Watch it (batches usually finish within an hour)
python -m scripts.overview_pipeline.status batch

# 4. When status is "ended", pull results into the store + refresh the dashboard
python -m scripts.overview_pipeline.batch collect
```

Batch requests can't browse, so the modern-lens layer is **off by default**
(`OVERVIEW_MODERN_LENS=manual`) — the batch produces the grounded reading, and the
science layer is added later by the subscription/interactive pass that can verify sources.
Set `OVERVIEW_MODERN_LENS=draft` to let the batch propose unverified candidates
(`"verified": false`) for a later source-check.

## B. Subscription path (bills your Max plan; fully verified in one pass)

```bash
python -m scripts.overview_pipeline.subscription run --surahs 78-114 --limit 20
```

Runs `claude -p` once per pending section. Because it's agentic, the model fetches its own
tafsir via the quran MCP and web-searches to verify any modern-lens science, so it emits the
finished, verified reading directly. Slower and non-batched, but no API bill and no separate
verification step. Ideal for the science-touchpoint sections, or if you'd rather not use API credit.

## Monitoring

```bash
python -m scripts.overview_pipeline.status store      # X / 1228 sections, surahs complete
python -m scripts.overview_pipeline.status batch [id] # live batch counts
open docs/overview-tafsir/progress.html               # the visual dashboard (auto-refreshed)
```

`status store` and every `collect`/`run` re-run `scripts/overview_progress.py`, so the
114-surah dashboard always reflects the store.

## Resuming & cost

Everything keys off the store: `build` and `run` only ever include sections **not already
compiled**, so stop and resume freely. Rough one-time cost on Opus 4.8 via Batch is **~$240**
for all 1,228 sections (front-loaded onto the long surahs 2–9; Juzʾ 30 is a few dollars).
`batch build` prints a live estimate for whatever slice you're about to run.

## Order of work

Follow `PROJECT_PLAN.md`: short-first, backward from Sūrah 114. A good first run is
`--surahs 78-114` (Juzʾ 30), then 50–77, and so on, leaving the heavy surahs 2–9 for last.
