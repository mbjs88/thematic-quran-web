# Thematic Labels Data

This directory contains the machine-readable thematic-label data used by the future filter UI.

- `taxonomy.json` is generated from the human-readable catalog in `docs/taxonomy.md`. Each label has `id`, multilingual `displayName` slots, `aliases`, `facet`, `definition`, examples, and facet color. Arabic and Urdu display-name slots are present but intentionally blank until reviewed translations are available.
- `assignments.json` maps section IDs (`surah:startAyah`) to label assignments. It currently contains the four pilot surahs plus Surah Al-Baqarah (2) and Surah Ali Imran (3), with per-surah summary entries named `_surah_summary_<surahNumber>`.

Human review notes and per-section summaries live in `docs/labeling/`. The authoritative taxonomy remains `docs/taxonomy.md`; update that first, then regenerate this JSON.

## Corpus workflow

The operating runbook for finishing the full Qur'an is `docs/labeling/CORPUS_LABELING_STRATEGY.md`.

Useful commands:

```bash
python3 scripts/export_labeling_packet.py --surah 4
python3 scripts/validate_thematic_labels.py
```

Packets are written to `docs/labeling/packets/` and are intended as LLM-ready inputs for one-surah labeling passes. Run the validator after every surah merge before moving on.
