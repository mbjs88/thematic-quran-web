# Next Labeling Handoff

## Current state

Machine assignments currently cover these surahs:

- 1 — Al-Fatihah
- 2 — Al-Baqarah
- 3 — Ali 'Imran
- 4 — An-Nisa
- 19 — Maryam
- 62 — Al-Jumu'ah
- 63 — Al-Munafiqun
- 67 — Al-Mulk
- 73 — Al-Muzzammil
- 81 — At-Takwir
- 85 — Al-Buruj
- 90 — Al-Balad
- 91 — Ash-Shams
- 92 — Al-Layl
- 93 — Ad-Duhaa
- 94 — Ash-Sharh
- 95 — At-Tin
- 97 — Al-Qadr
- 99 — Az-Zalzalah
- 100 — Al-'Adiyat
- 101 — Al-Qari'ah
- 102 — At-Takathur
- 104 — Al-Humazah
- 105 — Al-Fil
- 106 — Quraysh
- 107 — Al-Ma'un
- 111 — Al-Masad
- 112 — Al-Ikhlas
- 113 — Al-Falaq
- 114 — An-Nas

The next numerical surah is:

```text
5 — Al-Ma'idah
```

The packet is ready:

```text
docs/labeling/packets/surah-005-al-ma-idah.packet.md
```

If continuing the short-surah acceleration pass, the next clean five-section candidates are:

```text
50, 52, 53, 66, 68, 69, 70, 71, 83, 84, 87, 88, 96
```

Avoid these short surahs until their duplicate section starts are reviewed:

```text
98, 103, 108, 109, 110
```

## Required reading for the next LLM

Read in this order:

1. `docs/labeling/CORPUS_LABELING_STRATEGY.md`
2. `docs/labeling/LABELING_INSTRUCTIONS.md`
3. `docs/taxonomy.md`
4. The pilot files: `surah-001-al-fatihah.md`, `surah-019-maryam.md`, `surah-067-al-mulk.md`, `surah-112-al-ikhlas.md`
5. The packet for Surah 5

## Surah 5 deliverables

Create:

```text
docs/labeling/surah-005-al-ma-idah.md
```

Then merge machine entries into:

```text
data/thematic_labels/assignments.json
```

The machine JSON must include all 33 Surah 5 section entries plus:

```text
_surah_summary_5
```

## Validation commands

After merging Surah 5:

```bash
python3 scripts/validate_thematic_labels.py
python3 scripts/validate_thematic_labels.py --surah 5
```

Use `--full` only when checking full-corpus completion:

```bash
python3 scripts/validate_thematic_labels.py --full
```

`--full` is expected to fail until every surah is labeled.

## Current validation status

The current partial corpus has no structural errors:

```text
Validated 30 labeled surahs against 133 taxonomy labels.
No structural errors found.
```

Current warnings are all duplicate section starts in `data/theme_breaks.json` for future, unlabeled surahs:

```text
41, 48, 98, 103, 108, 109, 110
```

Do not change these during labeling unless the human owner explicitly asks for a section-boundary cleanup. They are editorial data questions, not assignment JSON errors.

## One correction already made

During validation, `19:73` was found to contain an imperative "Say:" and was missing `qul-statements`. The machine JSON and Maryam review doc now include that label.

Surah 4 has also been completed as `docs/labeling/surah-004-an-nisa.md` and merged into `data/thematic_labels/assignments.json`.

The clean three-section short-surah batch has also been completed and merged:

```text
91, 94, 97, 99, 102, 105, 106, 107, 111, 113, 114
```

The clean four-section short-surah batch has also been completed and merged:

```text
62, 63, 73, 81, 85, 90, 92, 93, 95, 100, 101, 104
```
