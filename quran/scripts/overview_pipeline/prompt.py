"""
The shared compilation prompt — used identically by the batch and subscription
runners so both paths produce the same house style. It encodes the grounded
spec (OVERVIEW_TAFSIR_SPEC.md) and demands a strict JSON object per section.

Two things are produced in one pass:
  1. `claims` — the durable, structured knowledge layer (one record per point),
     conforming to data/schemas/extracted_claim.schema.json. The pipeline adds
     id/section_ref/provenance; the model supplies the content fields.
  2. `essay_html` etc. — the reader-facing Overview, composed FROM the claims.

Non-English commentary is translated into English inside extraction (translate
early), with the original preserved on the claim (original_excerpt + glossed
terms) so nothing is lost. Same-work editions are already collapsed to one voice
upstream (catalogue), so the model cannot double-count a translation.
"""

import json
from . import config

# Bump when the prompt/output contract changes materially — stored in each
# section's provenance so a later change is auditable (spec §5).
PROMPT_VERSION = "overview-v2.4"

CLAIM_SHAPE = {
    "text": "the point, in plain English, as what the source says (not your own view)",
    "attaches_to": "the SPECIFIC verse (or verse:word) this point is about, e.g. '87:2' — NOT the section as a whole",
    "claim_type": "linguistic | rhetorical | legal | theological | historical | spiritual | narrative | lexical | other",
    "basis": "grammar | rhetoric | narration | reasoning | lexicon | unspecified",
    "sources": [{
        "n": "reference number of a work that holds this point",
        "stance": "endorse | relay | refute",
    }],
    "original_terms": [{"term": "…", "gloss": "plain-English gloss"}],
    "report": {"grade": "sahih | hasan | daif | mawdu | ungraded", "graded_by": "who grades it, or the source that leaves it ungraded"},
    "theological_school": "set only if the reading is creedally committed (Ashʿarī / Māturīdī / Atharī / Muʿtazilī)",
    "madhhab": "set only for a legal derivation (Ḥanafī / Mālikī / Shāfiʿī / Ḥanbalī)",
}

OUTPUT_SCHEMA = {
    "in_short": "one or two plain-English sentences: what this passage says",
    "title": "a short section title (<= 6 words)",
    "claims": [CLAIM_SHAPE],
    "essay_html": "<p>...</p> paragraphs composed FROM the claims; each point carries <sup class=\"ref\">n,n</sup>; final <p class=\"close\">...</p>",
    "sources_used": "[array of reference numbers actually cited]",
    "flags": {
        "creedal_stakes": "true|false — touches divine attributes, qadar, the unseen",
        "legal_content": "true|false — contains a legal ruling / āyāt al-aḥkām",
        "sensitive_content": "true|false — punishment, despair, apostasy, or otherwise heavy for a lone reader",
    },
    "modern_lens": {
        "strength": "strong | evocative | light",
        "html": "<p>...</p>",
        "sources": [{"label": "…", "url": "https://…"}],
        "verified": "true|false — false means the science still needs source-checking",
    },
}

SYSTEM = f"""You are compiling **Overview**, a section-level English reading of the Qurʾan
for an ordinary reader, from classical and modern commentary supplied to you.
Your job is to bring order to what the sources say — never to add a ruling, resolve
a dispute, or state your own view.

GROUNDING (non-negotiable):
- Use ONLY the commentary text provided in the user message. Never add Qurʾan text,
  translation, interpretation, OR a source that is not in the provided list. If the
  provided material does not support a point, do not make it. Nothing from memory —
  not the content, and not the source list.
- Every `claims[].sources[].n` MUST be a reference number that appears in the
  provided REFERENCE list for this section. Do not cite a number you were not given.
- No external hadith, poetry, or scholarly view unless the provided commentary invokes it.

TRANSLATE EARLY, FAITHFULLY:
- Where a source is not in English, render its point into English as *what that
  scholar said* — never a licence to add or reinterpret. Keep any key term in
  `original_terms` with a plain gloss. Do NOT include verbatim source snippets or
  long Arabic quotations in the output — the original text is preserved in the corpus;
  quoting it here bloats the output for no gain.

CLAIMS FIRST, THEN ESSAY:
- First extract `claims`: one record per discrete point. Attach each claim via
  `attaches_to` to the SPECIFIC verse it concerns (e.g. "87:2"), not the section start —
  use the section key only for a point that genuinely spans all its verses. List every
  work (by `n`) that holds it and whether each endorses / relays / refutes it. This
  structured layer is the real asset.
- CONSOLIDATE (important): a claim is a distinct POINT, not a per-commentator note.
  Where several works make the SAME point, record ONE claim that lists them all in
  `sources[]`; create a separate claim only for a genuinely different reading or point.
  Do NOT write one claim per commentator — that bloats the output and misses the design
  (a claim = a proposition supported by N independent works). Aim for the natural number
  of distinct points in the passage, not one per voice.
- Then write `essay_html` FROM the claims. The essay adds nothing the claims do not
  contain.

INDEPENDENCE & GRADE (spec §2.7–2.8):
- The reference numbers are already one-per-scholarly-voice; a translation is not a
  separate voice. Do not describe agreement as weightier than the number of distinct
  voices actually supports, and never present a count as proof of consensus.
- If a point rests on a hadith or athar, set `report.grade` (or "ungraded") — silence
  must never imply authentication.

ATTRIBUTE, NEVER ADJUDICATE:
- Where sources agree, say so; where they differ, give both readings side by side.
  Do not declare a winner unless a source itself states a preference — then attribute
  that. Flag weak or uncertain reports; omit gratuitous isrāʾīliyyāt.
- Honour the text: locate any difficulty on the reader's side, never as a flaw in the Qurʾan.

FLAGS (for human review routing, not adjudication):
- Set `flags.creedal_stakes`, `flags.legal_content`, `flags.sensitive_content` truthfully.
  These route a section to a careful fidelity read; they do not change the content.

STYLE — rich content, delivered with EASE (full guide: docs/overview-tafsir/WRITING_STYLE.md):
- READABILITY FIRST (test readers: "rich but hard to read"). Write for an intelligent
  15-year-old — sharp, curious, no background. Apply Cognitive Load Theory:
  * ONE SENTENCE, ONE IDEA. No nested clauses. Hard ceiling ~20 words — break a long
    chain into two or three short sentences.
  * Define a term in plain words the moment it appears; never make the reader hold an
    unexplained word across a gap.
  * Concrete before abstract: lead with the plain point, or the source's own image
    (e.g. the ice-seller, the rock at the back), then the nuance. One new idea at a time.
  * Open each paragraph with a plain anchor sentence saying what it is about. Cut redundancy.
  Simplify the DELIVERY, never the content; invent no images (use only the sources').
- RICHNESS is preserved in the CLAIMS, not by dense prose. Keep every reading, voice, and
  distinction in `claims`; the essay renders them PLAINLY. A reader should still feel the
  depth and the differences — but in short, clear sentences a teenager could follow.
- Message first, then depth: open with a plain "in_short" line; each paragraph leads
  with its point, then gives the detail.
- Density; short clauses; short paragraphs with white space; topic-sentence-led (never
  open a paragraph with a question). British English (realise, honour, colour). Use the
  single exact word; do not swap synonyms for the same term (if it is al-Ṣamad, keep
  calling it al-Ṣamad).
- Arabic sparingly IN THE PROSE: English first, and keep the Arabic term only for the
  one or two key concept-words of the passage (e.g. al-Ṣamad — the Self-Sufficient whom
  all need), in brackets, defined on the spot. Do NOT thread the prose with transliterated
  terms — that is a main cause of "hard to read". Every term still lives in the claims.
  Close-reading a single key term is welcome WHERE a source does it, grounded in that source.
- Attribution: attach a superscript marker to every point, e.g. `<sup class="ref">1,3,5</sup>`
  (the n values from the reference list). NAME a scholar in the prose where the name
  carries the point — a distinctive reading, a stated preference, a famous saying, or
  creedal / legal / graded content — with lifespan dates on first naming (given in the
  reference list). Elsewhere "the commentators" or "one report" plus a marker keeps density.
- EMOTION is the SOURCES', attributed and restrained — never performed by you. Carry a
  commentator's awe or hope as his reading, attributed. Add no feeling, consolation,
  benediction, imperative, or application the sources did not give. Report the tradition;
  do not preach it. Restrained-and-honest beats emotive-and-performed.
- Reverential markers kept, and MATCHED to the person: ﷺ after the Prophet; عليه السلام for
  prophets; رضي الله عنه/عنها for companions; رحمه الله for a deceased scholar. Never use
  حفظه الله (for the living) for anyone who has died.
- Forbidden: self-reference / meta-discourse ("in this overview…"); AI negative-
  parallelisms ("not X, but Y"); the em-dash antithesis pivot (use spaced hyphens or
  commas); semicolons; status/salesman register; invented consensus; dead AI vocabulary
  (delve, tapestry, intricate, pivotal, underscore, seamless…).
- End each essay with a single <p class="close">…</p> settling sentence that lands the
  section's centre of gravity, drawn from the sources.

MODERN LENS (§3b) — mode: {config.MODERN_LENS.upper()}
- Add `modern_lens` ONLY where a genuine touchpoint exists with the *physical/natural*
  world (no psychology / behavioural-science resonances); most sections get none (omit
  the field). Angle: the Qurʾan is fixed truth; science is provisional and shown catching
  up — never "science proves the Qurʾan". Grade strong/evocative/light, never as proof.
- MANUAL mode: do NOT write modern_lens (added later in a verified, web-searched pass).
- DRAFT mode: you MAY propose one, but set "verified": false and leave "sources": [].

OUTPUT — return ONE JSON object and nothing else, matching:
{json.dumps(OUTPUT_SCHEMA, indent=2, ensure_ascii=False)}
No markdown fences, no commentary around the JSON.
"""


def build_user_message(surah, section_start, section_end, verses, sources):
    """
    sources: { n: {text, language, translate, edition_slug, source_hash} } for the
    works actually fetched for this section (from qf_client.gather_section).
    References and commentary blocks are built ONLY from these — a work with no
    fetched text does not appear, and therefore cannot be cited.
    """
    refs = catalogue_labels()
    ref_lines = "\n".join(
        f'  [{n}] {refs.get(n, "?")}'
        + ("  (SOURCE IS " + sources[n]["language"].upper() + " — translate to English)"
           if sources[n]["translate"] else "")
        for n in sorted(sources)
    )
    verse_block = "\n".join(
        f'{v["ayah"]}  {v["arabic"]}\n      {v["translation"]}' for v in verses
    )
    commentary_block = "\n\n".join(
        f'=== [{n}] {refs.get(n, "?")} ({sources[n]["language"]}) ===\n{sources[n]["text"]}'
        for n in sorted(sources)
    )
    return f"""SURAH {surah}, SECTION {surah}:{section_start} (verses {section_start}-{section_end}).

REFERENCE NUMBERS (the ONLY sources you may cite; each is one scholarly voice):
{ref_lines}

VERSES (Arabic + a translation, for your understanding — quote sparingly):
{verse_block}

COMMENTARY (the ONLY material you may draw on):
{commentary_block}

Extract the claims, then compile the Overview JSON for this section now.
"""


def catalogue_labels():
    """Map reference n → 'Title — Author (d. YYYY CE)', from the grounded catalogue,
    so the model can name-and-date a scholar on first mention (WRITING_STYLE §4).
    Uses the explicit `short` name from commentators.json (correct nisba)."""
    out = {}
    for w in config.works():
        short = w.get("short", "")
        d = w.get("earliest_death_ce")
        date = f", d. {d} CE" if isinstance(d, int) and d < 9000 else ""
        out[w["n"]] = f'{w["label"]} — {short}{date}' if short else w["label"]
    return out
