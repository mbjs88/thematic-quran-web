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
WORK = ROOT / "scripts" / "overview_pipeline" / "_work"   # batch inputs/outputs, gitignored
WORK.mkdir(parents=True, exist_ok=True)

# ---- model -------------------------------------------------------------------
# Opus 4.8 for the whole run, as chosen. Override with OVERVIEW_MODEL if needed.
MODEL = os.environ.get("OVERVIEW_MODEL", "claude-opus-4-8")
MAX_TOKENS = int(os.environ.get("OVERVIEW_MAX_TOKENS", "4000"))   # per section output

# Pricing per million tokens (standard). Batch applies 50%.
PRICE = {
    "claude-opus-4-8":        {"in": 5.0,  "out": 25.0},
    "claude-sonnet-5":        {"in": 3.0,  "out": 15.0},   # $2/$10 intro to 2026-08-31
    "claude-haiku-4-5":       {"in": 1.0,  "out": 5.0},
}
BATCH_DISCOUNT = 0.5

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

# ---- the commentary set (the 12 studied in the pilots) -----------------------
# `id` is the QF/quran.com tafsir id observed in the pilot citation URLs where known;
# `match` keywords let qf_client resolve the id from /resources/tafsirs at runtime,
# which is the robust path (ids can differ between environments). ref `n` must stay
# stable — it is what the reader-facing `^[n]` markers point to.
EDITIONS = [
    {"n": 1,  "key": "ar-tabari",        "id": 15,   "label": "al-Ṭabarī, Jāmiʿ al-Bayān",              "match": ["tabari", "jami al-bayan"],        "lang": "ar", "note": "foundational; range of early opinion"},
    {"n": 2,  "key": "en-ibn-kathir",    "id": 169,  "label": "Ibn Kathīr",                              "match": ["ibn kathir"],                     "lang": "en", "note": "Qurʾan + prophetic reports"},
    {"n": 3,  "key": "ar-qurtubi",       "id": 90,   "label": "al-Qurṭubī, al-Jāmiʿ li-Aḥkām al-Qurʾan",  "match": ["qurtubi"],                        "lang": "ar", "note": "legal, context, language"},
    {"n": 4,  "key": "ar-kashaf",        "id": None, "label": "al-Zamakhsharī, al-Kashshāf",             "match": ["kashshaf", "kashaf", "zamakhshari"], "lang": "ar", "note": "language and rhetoric"},
    {"n": 5,  "key": "ar-baghawi",       "id": 94,   "label": "al-Baghawī, Maʿālim al-Tanzīl",           "match": ["baghawi", "maalim"],              "lang": "ar", "note": "early reports, consensus"},
    {"n": 6,  "key": "ar-nathm-aldurar", "id": None, "label": "al-Biqāʿī, Naẓm al-Durar",                "match": ["biqai", "nazm al-durar", "nathm"], "lang": "ar", "note": "purpose / structure of the surah"},
    {"n": 7,  "key": "ar-saadi",         "id": 91,   "label": "al-Saʿdī, Taysīr al-Karīm al-Raḥmān",     "match": ["saadi", "sadi", "taysir"],        "lang": "ar", "note": "practical lesson"},
    {"n": 8,  "key": "ar-jalalayn",      "id": 926,  "label": "al-Jalālayn",                             "match": ["jalalayn"],                       "lang": "ar", "note": "short word-by-word gloss"},
    {"n": 9,  "key": "ar-muyassar",      "id": 16,   "label": "al-Muyassar",                             "match": ["muyassar"],                       "lang": "ar", "note": "plain mainstream meaning"},
    {"n": 10, "key": "ar-al-wasit",      "id": 93,   "label": "al-Wasīṭ (Ṭanṭāwī)",                      "match": ["wasit", "tantawi"],               "lang": "ar", "note": "modern, everyday life"},
    {"n": 11, "key": "en-maarif",        "id": 168,  "label": "Maʿārif al-Qurʾan (Muḥammad Shafīʿ)",     "match": ["maarif"],                         "lang": "en", "note": "modern, practical, English"},
    {"n": 12, "key": "en-tazkir",        "id": 817,  "label": "Tazkīr al-Qurʾan (Wahiduddin Khan)",      "match": ["tazkir", "tazkirul", "wahiduddin"], "lang": "en", "note": "modern, reflective"},
]
# Editions QF does not serve numerically may resolve to None; the run records the
# real count actually fetched as `commentators_studied` per surah — never fake it.

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
