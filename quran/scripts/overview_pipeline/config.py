"""
Overview-tafsir compilation pipeline — central configuration.

Everything the batch and subscription runners share lives here: which model,
which commentaries, where the data is, and the cost model. Read secrets from
the environment (see .env.example); never hard-code keys.
"""

import os
from pathlib import Path

# ---- paths -------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
THEME_BREAKS = DATA / "theme_breaks.json"
STORE_DIR = DATA / "tafsir_overview"                 # NNN.json outputs live here
CATALOGUE = DATA / "commentators.json"               # grounded edition/works catalogue
CLAIM_SCHEMA = DATA / "schemas" / "extracted_claim.schema.json"
WORK = ROOT / "scripts" / "overview_pipeline" / "_work"   # batch inputs/outputs, gitignored
WORK.mkdir(parents=True, exist_ok=True)

# ---- model -------------------------------------------------------------------
# Sonnet is the chosen model for the full run — good enough for this compilation
# task and far cheaper than Opus. Override with OVERVIEW_MODEL if needed.
MODEL = os.environ.get("OVERVIEW_MODEL", "claude-sonnet-5")
# Output cap = 64k (Sonnet's max). Dense sections legitimately produce ~25-40k
# output tokens (full claims + essay). A LOW cap truncates the JSON → the whole
# section is lost AND its output tokens are billed anyway (100% wasted). A HIGH cap
# lets the section COMPLETE — usable, paid once, no re-run. So 64k is the
# money-SAVING choice here, not the expensive one. (If the model's real max is
# lower, the API says so at submit; drop to 32000 then.)
MAX_TOKENS = int(os.environ.get("OVERVIEW_MAX_TOKENS", "64000"))

# ---- per-section input budget (anti-context-overflow) ------------------------
# Long legal surahs (2-9) can return enormous tafsir per verse; 14 voices at once
# could exceed the model's context window and fail the request. gather_section
# trims to these caps (truncating the longest texts with a disclosed marker and
# recording which editions were trimmed) so no section ever blows the window.
PER_EDITION_CHAR_CAP = int(os.environ.get("OVERVIEW_PER_EDITION_CHARS", "60000"))   # ~15k tok
SECTION_CHAR_BUDGET = int(os.environ.get("OVERVIEW_SECTION_CHARS", "480000"))       # ~120k tok

# Pricing per million tokens (standard). Batch applies 50%.
PRICE = {
    "claude-opus-4-8":        {"in": 5.0,  "out": 25.0},
    # Sonnet is on its intro rate until 2026-08-31 (reverts to 3.0/15.0 after).
    # This is what the API actually bills now, so estimates match the invoice.
    "claude-sonnet-5":        {"in": 2.0,  "out": 10.0},
    "claude-haiku-4-5":       {"in": 1.0,  "out": 5.0},
}
BATCH_DISCOUNT = 0.5

# Estimator tuning. Input is counted for real (see batch._estimate_cost). Output
# is estimated as a FRACTION OF INPUT — observed ~0.40 across real runs (full-claims
# output scales with how much source text a section carries), which auto-adjusts for
# short vs dense sections far better than a flat per-section guess. The fallback char
# ratio is calibrated to this Arabic/Urdu/Bengali/Kurdish corpus (~1.8 chars/token).
OUTPUT_INPUT_RATIO = float(os.environ.get("OVERVIEW_OUTPUT_RATIO", "0.40"))
CHARS_PER_TOKEN = float(os.environ.get("OVERVIEW_CHARS_PER_TOKEN", "1.8"))

# ---- Quran Foundation content API -------------------------------------------
# The site already proxies this at /api/qf-public/api/v4 using QF_CLIENT_ID/SECRET.
# For a standalone run we hit the QF API directly with the client-credentials flow.
QF_AUTH_URL = os.environ.get(
    "QF_AUTH_URL", "https://oauth2.quran.foundation/oauth2/token")
QF_API_BASE = os.environ.get(
    "QF_API_BASE", "https://apis.quran.foundation/content/api/v4")
QF_CLIENT_ID = os.environ.get("QF_CLIENT_ID", "")
QF_CLIENT_SECRET = os.environ.get("QF_CLIENT_SECRET", "")

# Canonical text + translation editions for display in each section.
QURAN_EDITION = "quran-simple-clean"          # Arabic
TRANSLATION_EDITION_ID = 85                    # Abdel Haleem (resolve at runtime if needed)

# ---- the commentary set ------------------------------------------------------
# The commentary set is NOT hand-written here any more (that is how phantom
# editions once crept in from memory). It is loaded from the grounded catalogue
# `data/commentators.json` via the catalogue module, then narrowed at run time to
# what the live API actually serves (qf_client.reconcile). Each entry is a *work*
# (one scholarly voice); its stable `n` is what the reader-facing `^[n]` markers
# point to. Fatḥ al-Majīd is excluded by default (not a Qurʾān tafsir).
from . import catalogue                       # noqa: E402  (after paths/env above)

INCLUDE_EXCLUDED = os.environ.get("OVERVIEW_INCLUDE_EXCLUDED", "0") == "1"

def works():
    """The active list of works (voices) for this run."""
    return catalogue.works(include_excluded=INCLUDE_EXCLUDED)

def fetch_plan():
    """Per-work fetch/translate plan for this run."""
    return catalogue.fetch_plan(include_excluded=INCLUDE_EXCLUDED)

# ---- modern-lens policy ------------------------------------------------------
# Batch requests cannot browse to verify scientific claims, so by default the
# batch produces the grounded reading only, and the modern-lens layer (§3b of the
# spec) is added in a separate verified pass (the subscription/interactive runner,
# which can web-search). Set to "draft" to let the batch propose UNVERIFIED
# candidates flagged for later source-checking.
MODERN_LENS = os.environ.get("OVERVIEW_MODERN_LENS", "manual")   # manual | draft

MODERN_LENS_FRAMING = (
    "The Qurʾan is taken here as fixed, revealed truth; science is our provisional, "
    "evolving account of the observable world. What follows notes where the two meet "
    "— a contemplation, not a proof. Where the science later shifts, that reflects the "
    "limits of our knowledge, not the text."
)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
TODAY = os.environ.get("OVERVIEW_DATE", "")  # set by runners to date.today() if empty

# Standard Ḥafṣ ayah counts per surah — used to resolve each surah's final section end.
AYAH_COUNTS = {
    1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
    11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
    21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
    31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
    41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
    51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
    61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
    71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
    81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
    91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
    101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
    111: 5, 112: 4, 113: 5, 114: 6,
}
