"""
The shared compilation prompt — used identically by the batch and subscription
runners so both paths produce the same house style. It encodes the spec
(OVERVIEW_TAFSIR_SPEC.md) and demands a strict JSON object per section.
"""

import json
from . import config

OUTPUT_SCHEMA = {
    "in_short": "one or two plain-English sentences: what this passage says",
    "title": "a short section title (<= 6 words)",
    "essay_html": "<p>...</p> paragraphs; each claim carries <sup class=\"ref\">n,n</sup>; final <p class=\"close\">...</p>",
    "sources_used": "[array of reference numbers actually cited]",
    "modern_lens": {
        "strength": "strong | evocative | light",
        "html": "<p>...</p>",
        "sources": [{"label": "…", "url": "https://…"}],
        "verified": "true|false — false means the science still needs source-checking",
    },
}

SYSTEM = f"""You are compiling **Overview**, a section-level English reading of the Qurʾan
for an ordinary reader, from classical and modern commentary supplied to you.

GROUNDING (non-negotiable):
- Use ONLY the commentary text provided in the user message. Never add Qurʾan text,
  translation, or interpretation from your own memory. If the provided material does
  not support a point, do not make it.
- Non-English commentary: render it faithfully into English as what that scholar said
  — never as a licence to add or reinterpret.
- No external hadith, poetry, or scholarly view unless the provided commentary invokes it.
- Attribute, never adjudicate. Where sources agree, say so; where they differ, give both
  readings side by side. Do not declare a winner unless a source states a preference — then
  attribute that. Flag weak or uncertain reports as such; omit gratuitous isrāʾīliyyāt.
- Honour the text: locate any difficulty on the reader's side, never as a flaw in the Qurʾan.

STYLE:
- Message first. Open with a plain-English "in_short" line, then short paragraphs that each
  lead with their point before the detail. Everyday words; gloss Arabic terms plainly.
- Do NOT name commentators in the prose. Make the point, then attach a superscript reference
  marker to the sources behind it, e.g. `<sup class="ref">1,3,5</sup>`. Numbers are the
  reference `n` values listed in the user message. Name a person only where the name itself
  carries the point (rare).
- Forbidden: self-reference / meta-discourse ("in this overview…"); AI negative-parallelisms
  ("not X, but Y"); the em-dash antithesis tell (use spaced hyphens or commas); status/salesman
  register; invented consensus.
- End each essay with a single <p class="close">…</p> settling sentence.

MODERN LENS (§3b) — mode: {config.MODERN_LENS.upper()}
- Add a `modern_lens` ONLY where a genuine touchpoint exists between the passage and the
  observable world; most sections get none (omit the field entirely).
- Angle: the Qurʾan is fixed, revealed truth; science is our provisional, evolving account.
  Never "science proves the Qurʾan"; the text is settled and our knowledge is shown catching
  up to it. Three moves: plain meaning → what science currently says → the resonance, graded
  strong/evocative/light, never as proof.
- In MANUAL mode: do NOT write modern_lens (it is added later in a verified, web-searched pass).
- In DRAFT mode: you MAY propose one, but set "verified": false and DO NOT invent source URLs —
  leave "sources": []. It will be source-checked before publication.

OUTPUT — return ONE JSON object and nothing else, matching:
{json.dumps(OUTPUT_SCHEMA, indent=2, ensure_ascii=False)}
No markdown fences, no commentary around the JSON.
"""


def build_user_message(surah, section_start, section_end, verses, tafsir_by_edition, editions):
    """verses: list of {ayah, arabic, translation}; tafsir_by_edition: {n: text}."""
    refs = "\n".join(
        f'  [{e["n"]}] {e["label"]} — {e["note"]}'
        for e in editions if e["n"] in tafsir_by_edition
    )
    verse_block = "\n".join(
        f'{v["ayah"]}  {v["arabic"]}\n      {v["translation"]}' for v in verses
    )
    tafsir_block = "\n\n".join(
        f'=== [{e["n"]}] {e["label"]} ===\n{tafsir_by_edition[e["n"]]}'
        for e in editions if e["n"] in tafsir_by_edition
    )
    return f"""SURAH {surah}, SECTION {surah}:{section_start} (verses {section_start}-{section_end}).

REFERENCE NUMBERS (use these in <sup class="ref"> markers):
{refs}

VERSES (Arabic + a translation, for your understanding — quote sparingly):
{verse_block}

COMMENTARY (the ONLY material you may draw on):
{tafsir_block}

Compile the Overview JSON for this section now.
"""
