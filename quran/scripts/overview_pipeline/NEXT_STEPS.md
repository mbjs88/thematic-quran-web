# Overview pipeline — resume here

_Snapshot for picking up in a new session. Last updated 2026-08-02._

## Decision of record (2026-08-02): run it once, properly

Owner's call, after weighing token-saving options against re-run waste:
- **Keep the FULL claims layer** — richness is the point; it lives in `claims`, not prose.
  Do NOT trim claims to save tokens. (Prose is already softened for readability, v2.4.)
- **`MAX_TOKENS` = 64000** (`config.py`). A low cap was the real money-sink: a truncated
  section is lost *and still billed* for every token it generated. A high cap lets dense
  sections COMPLETE — paid once, no re-run. So 64k is the money-SAVING choice here.
- **Budget will inflate and that is accepted** — full-Qurʾan est. ~$150–200 at intro
  pricing. "Better to run it properly once than over and over again."
- **Efficiencies already applied** (no richness lost): honest estimator (output = ~40%
  of *real* counted input, `OUTPUT_INPUT_RATIO`); dropped `original_excerpt` +
  model-emitted `translation_confidence` from claims (v2.4); **system prompt is now
  cached** in the batch (billed once, not per request).
- **Do NOT auto-commission runs** — build/estimate freely, but submit only on explicit go.

## Where we are

- **Raw corpus:** complete — all 1,228 sections × 14 editions cached in
  `data/tafsir_raw/` (234 MB, gitignored). No more fetching needed.
- **First batch (Juz 30, surahs 78–114):** submitted + collected. Of 148 sections,
  **35 saved, 113 truncated** at the old 16k token cap (the model wrote one claim per
  commentator on dense sections → over-long output). Batch cost ~$8. Read the 35 via
  the viewer (below).
- **Current pipeline (v2.4, 64k cap — ready to run):** `prompt.py` (a) **consolidates** —
  one claim per distinct POINT listing all its sources, not one per commentator;
  (b) **READABILITY layer** (test-reader feedback: "rich but hard to read") — Cognitive
  Load Theory + Feynman "intelligent-teenager" test: one sentence/one idea (~20-word
  ceiling), define-on-use, concrete-before-abstract, Arabic sparingly in prose, honorific
  matching (رحمه الله for deceased, never حفظه الله); (c) claims dropped `original_excerpt`
  and model-emitted `translation_confidence` (set deterministically in `store.py`).
  `config.MAX_TOKENS` = **64000** so dense sections complete instead of truncating.
  Richness lives in the claims; only the prose softens. `PROMPT_VERSION` = `overview-v2.4`.
- **Budget:** $137 credit; **~$17.62 spent** so far (the earlier Juz 30 run at the 16k cap
  cost 2.3x its estimate — 113 sections truncated but were billed anyway; the old estimator
  also under-counted Arabic input ~2.3x). Both fixed: 64k stops the truncation waste, and
  `_estimate_cost` now counts real tokens (system prompt cached) and estimates output as
  ~40% of input at the live intro price ($2/$10, reverts 31 Aug). Full-Qurʾan est.
  **~$150–200** at intro pricing (higher than the old figure because we keep the full
  claims and let dense sections run to completion) — the accepted "run once, properly" cost.

## THE NEXT ACTION: re-run Juz 30 under v2.4 (only on explicit go)

The truncated sections are still "pending" (not in the store), so a rebuild picks them up.
To make all of Juz 30 uniform v2.4, clear the earlier sections first (recommended):

```bash
cd quran && set -a; . ./.dev.vars; set +a
export OVERVIEW_MODEL=claude-sonnet-5

# clear earlier-version sections so all of Juz 30 is uniform v2.4:
#   rm data/tafsir_overview/0{78..99}.json data/tafsir_overview/1{00..14}.json \
#      data/tafsir_overview/_progress.json  2>/dev/null

python3 -m scripts.overview_pipeline.batch build   --surahs 78-114   # reads corpus, prints HONEST cost
python3 -m scripts.overview_pipeline.batch submit  _work/batch_input.jsonl   # only after owner says go
python3 -m scripts.overview_pipeline.status batch                    # poll until "ended"
python3 -m scripts.overview_pipeline.batch collect                   # gated write
```

Then **read a full Juz** in the viewer and judge quality + real cost before scaling to
the rest of the Qurʾan (stage by juz: `--surahs 50-77`, etc.).

## Read what's compiled

```bash
cd quran && python3 -m http.server 8899
# open http://localhost:8899/overview-reader.html   (sidebar lists all surahs; marked ones have content)
```

## Outstanding / decisions parked

- **Verify v2.2 quality** on the Juz 30 re-run: did consolidation keep the richness
  (the 87:1 sample the owner loved) while cutting the runaway output? If good → scale.
- **3 editions the credentialed API serves but `commentators.json` lacks**:
  `ar-tafsir-jalalayn`, `arabic-tanweer-tafseer`,
  `dr-abdullah-muhammad-abu-bakr-and-sheikh-nasir-khamis`. Add deliberately if wanted
  (al-Jalālayn especially — it was wrongly assumed absent earlier). Adds cost.
- **theme_breaks quirk:** surahs 108/109/110 have a duplicate section-start → one empty
  section each is skipped. Fix `data/theme_breaks.json` for those.
- **Add an honorific-consistency QA** check (رضي الله عنه / رحمه الله vs حفظه الله) — partly
  handled now in the prompt; could also be a post-check in `store.check_section`.
- **In-site reading:** wire Overview into the website tafsir dropdown (`scholar.js`,
  spec §5) — the standalone `overview-reader.html` is the interim reader.
- **Graph ideas (2026-07-28):**
  1. *Claims-graph QA / "Connect" stage (higher value, ours):* build a graph over our
     own extracted claims (nodes: claim, work, author, verse, term; typed edges:
     holds/endorses/refutes, precedes-chronologically → dependence, translates, glosses,
     attaches-to-verse). Use it first as a QA lens (over-cited sources, orphan claims,
     uncovered verses, dependence sanity), then as the plan's "Connect" stage
     (claims → propositions → genuine cross-source agreement) and an interactive view
     (e.g. every reading of al-Ṣamad and who holds each). The typed data already exists
     in `extracted_claim.schema.json` + `commentators.json`.
  2. *Graphify on the codebase (optional dev aid):* Graphify (graphify.net) maps a repo
     into a queryable code knowledge graph for AI assistants — could help future
     cold-start sessions navigate the growing `quran/` codebase (esp. the `scholar.js`
     integration). Navigation aid, not a core bottleneck; the graph goes stale, so
     regenerate on demand. Wrong tool for the *tafsir content* graph (it's code-oriented).
- **Progress console:** `overview-console.html` + `functions/api/overview/progress.js`
  need `OVERVIEW_ADMIN_TOKEN` set (local + Cloudflare Pages) to go live.

## Key files

- Pipeline: `scripts/overview_pipeline/` (see `README.md`, `DEPLOYMENT.md`).
- Catalogue: `data/commentators.json`. Claim schema: `data/schemas/extracted_claim.schema.json`.
- Design: `docs/overview-tafsir/OVERVIEW_TAFSIR_SPEC.md`, `WRITING_STYLE.md`,
  `PROJECT_PLAN.md`, `PANEL_REVIEW_ACTIONS.md`.
- Reader: `overview-reader.html`. Console: `overview-console.html`.
