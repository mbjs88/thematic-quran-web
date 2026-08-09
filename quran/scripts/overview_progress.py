#!/usr/bin/env python3
"""
Overview tafsir — progress scanner & dashboard generator.

Backend: scans data/theme_breaks.json (the source of truth for how many
thematic sections every surah has) against the compiled files in
data/tafsir_overview/NNN.json, and works out what is done.

Outputs:
  - data/tafsir_overview/_progress.json   (machine-readable summary)
  - docs/overview-tafsir/progress.html     (self-contained dashboard, data embedded)

Run:  python3 scripts/overview_progress.py
"""

import json
import os
import re
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TB_PATH = os.path.join(ROOT, "data", "theme_breaks.json")
META_PATH = os.path.join(ROOT, "data", "surah_metadata.json")
OVERVIEW_DIR = os.path.join(ROOT, "data", "tafsir_overview")
DOCS_DIR = os.path.join(ROOT, "docs", "overview-tafsir")
PROGRESS_JSON = os.path.join(OVERVIEW_DIR, "_progress.json")
PROGRESS_HTML = os.path.join(DOCS_DIR, "progress.html")

SURAH_NAMES = [
    "Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am",
    "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus", "Hud", "Yusuf", "Ar-Ra'd",
    "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Ta-Ha",
    "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara",
    "An-Naml", "Al-Qasas", "Al-'Ankabut", "Ar-Rum", "Luqman", "As-Sajdah",
    "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar",
    "Ghafir", "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah",
    "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf", "Adh-Dhariyat",
    "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid",
    "Al-Mujadila", "Al-Hashr", "Al-Mumtahanah", "As-Saff", "Al-Jumu'ah",
    "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam",
    "Al-Haqqah", "Al-Ma'arij", "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir",
    "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "'Abasa",
    "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj",
    "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad", "Ash-Shams",
    "Al-Layl", "Ad-Duha", "Ash-Sharh", "At-Tin", "Al-'Alaq", "Al-Qadr",
    "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat", "Al-Qari'ah", "At-Takathur",
    "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar",
    "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas",
]


def slugify(name):
    s = name.lower()
    s = s.replace("'", "").replace("`", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def verse_counts():
    """Best-effort ayah count per surah from quran_data.json; empty if unavailable."""
    path = os.path.join(ROOT, "data", "quran_data.json")
    counts = {}
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception:
        return counts
    rows = data if isinstance(data, list) else data.get("verses") or data.get("data") or []
    for r in rows:
        if not isinstance(r, dict):
            continue
        s = r.get("surah_no") or r.get("surah") or r.get("sura") or r.get("s")
        try:
            s = int(s)
        except (TypeError, ValueError):
            continue
        counts[s] = counts.get(s, 0) + 1
    return counts


def scan():
    theme_breaks = json.load(open(TB_PATH, encoding="utf-8"))
    try:
        meta = json.load(open(META_PATH, encoding="utf-8")).get("surahs", {})
    except Exception:
        meta = {}
    vcounts = verse_counts()

    surahs = []
    total_sections = 0
    done_sections = 0
    surahs_complete = 0
    surahs_partial = 0
    commentator_counts = []

    for num in range(1, 115):
        starts = [int(x) for x in theme_breaks.get(str(num), [])]
        n_sections = len(starts)
        total_sections += n_sections

        compiled_path = os.path.join(OVERVIEW_DIR, f"{num:03d}.json")
        compiled_keys = set()
        commentators = None
        compiled_at = None
        if os.path.exists(compiled_path):
            try:
                doc = json.load(open(compiled_path, encoding="utf-8"))
                for k in doc.get("sections", {}):
                    try:
                        compiled_keys.add(int(str(k).split(":")[1]))
                    except (IndexError, ValueError):
                        pass
                # v2 stores independent_works under coverage; fall back to the
                # legacy commentators_studied for any pre-rebuild file.
                commentators = (doc.get("coverage") or {}).get("independent_works") \
                    or doc.get("commentators_studied")
                compiled_at = (doc.get("pipeline_provenance") or {}).get("compiled_at") \
                    or doc.get("compiled_at")
            except Exception:
                pass

        done = len([s for s in starts if s in compiled_keys])
        done_sections += done
        if commentators:
            commentator_counts.append(commentators)

        if n_sections and done == n_sections:
            status = "complete"
            surahs_complete += 1
        elif done:
            status = "partial"
            surahs_partial += 1
        else:
            status = "none"

        slug = slugify(SURAH_NAMES[num - 1])
        html_name = f"{slug}-overview.html"
        has_reading = os.path.exists(os.path.join(DOCS_DIR, html_name))

        surahs.append({
            "num": num,
            "name": SURAH_NAMES[num - 1],
            "type": (meta.get(str(num), {}) or {}).get("type"),
            "verses": vcounts.get(num),
            "sections_total": n_sections,
            "sections_done": done,
            "status": status,
            "commentators": commentators,
            "compiled_at": compiled_at,
            "reading": html_name if has_reading else None,
        })

    return {
        "generated_at": datetime.date.today().isoformat(),
        "totals": {
            "surahs": 114,
            "surahs_complete": surahs_complete,
            "surahs_partial": surahs_partial,
            "sections_total": total_sections,
            "sections_done": done_sections,
            "pct_sections": round(100 * done_sections / total_sections, 1) if total_sections else 0,
            "pct_surahs": round(100 * surahs_complete / 114, 1),
            "avg_commentators": round(sum(commentator_counts) / len(commentator_counts), 1) if commentator_counts else 0,
        },
        "surahs": surahs,
    }


# ---------------------------------------------------------------- rendering ---

def render_html(p):
    t = p["totals"]
    ring = t["pct_sections"]
    # dasharray for a 100-length circle
    cells = []
    for s in p["surahs"]:
        cls = s["status"]
        title = f'{s["num"]}. {s["name"]} — {s["sections_done"]}/{s["sections_total"]} sections'
        if s["status"] == "complete":
            title += " · complete"
        inner = f'<span class="c-num">{s["num"]}</span><span class="c-frac">{s["sections_done"]}/{s["sections_total"]}</span>'
        if s["reading"]:
            cell = f'<a class="cell {cls}" href="{s["reading"]}" title="{title}">{inner}</a>'
        else:
            cell = f'<div class="cell {cls}" title="{title}">{inner}</div>'
        cells.append(cell)
    grid = "\n".join(cells)

    done_rows = ""
    for s in sorted([s for s in p["surahs"] if s["status"] != "none"],
                    key=lambda x: (x["compiled_at"] or ""), reverse=True):
        link = f'<a href="{s["reading"]}">Read</a>' if s["reading"] else "&mdash;"
        badge = "complete" if s["status"] == "complete" else "partial"
        done_rows += (
            f'<tr><td class="r-num">{s["num"]}</td><td>{s["name"]}</td>'
            f'<td>{s["sections_done"]}/{s["sections_total"]}</td>'
            f'<td>{s["commentators"] or "&mdash;"}</td>'
            f'<td><span class="pill {badge}">{badge}</span></td>'
            f'<td>{s["compiled_at"] or "&mdash;"}</td><td>{link}</td></tr>'
        )
    if not done_rows:
        done_rows = '<tr><td colspan="7" class="empty">Nothing compiled yet.</td></tr>'

    data_json = json.dumps(p, ensure_ascii=False)

    return TEMPLATE.format(
        ring=ring,
        pct_sections=t["pct_sections"],
        sections_done=t["sections_done"],
        sections_total=t["sections_total"],
        surahs_complete=t["surahs_complete"],
        surahs_partial=t["surahs_partial"],
        avg_comm=t["avg_commentators"],
        generated=p["generated_at"],
        grid=grid,
        done_rows=done_rows,
        data_json=data_json,
    )


TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Overview Tafsir — Progress</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
<style>
:root{{
  --paper: oklch(0.977 0.012 76); --paper-2: oklch(0.962 0.014 72);
  --ink: oklch(0.305 0.014 52); --ink-soft: oklch(0.475 0.014 55); --ink-faint: oklch(0.625 0.012 60);
  --rule: oklch(0.905 0.012 70);
  --dawn-high: oklch(0.962 0.018 78); --dawn-mid: oklch(0.945 0.034 56); --waterline: oklch(0.930 0.024 62);
  --sun: oklch(0.965 0.045 72); --dawn-glow: oklch(0.912 0.052 44);
  --done: oklch(0.605 0.090 80); --partial: oklch(0.78 0.10 82); --none: oklch(0.92 0.012 70);
  --serif: "Newsreader", Georgia, serif;
}}
*{{ box-sizing:border-box; }}
body{{ margin:0; background:var(--paper); color:var(--ink); font-family:var(--serif); font-size:18px; line-height:1.6; -webkit-font-smoothing:antialiased; }}
.masthead{{ display:flex; align-items:center; justify-content:space-between; gap:1.5rem; padding:1.4rem clamp(1.25rem,5vw,3rem); border-bottom:1px solid var(--rule); }}
.wordmark{{ display:flex; align-items:center; gap:0.7rem; }}
.wordmark .sun{{ width:15px; height:15px; border-radius:50%; background:radial-gradient(circle at 50% 45%, var(--sun), var(--dawn-glow) 70%); box-shadow:0 0 0 1px oklch(0.86 0.04 60 / 0.5); }}
.wordmark .name{{ font-size:1.08rem; }}
.masthead .tag{{ font-variant:small-caps; letter-spacing:0.14em; font-size:0.78rem; color:var(--ink-faint); }}
.hero{{ text-align:center; padding:clamp(2.5rem,6vw,4rem) 1.5rem 2rem; background:linear-gradient(180deg,var(--dawn-high),var(--waterline) 70%,var(--paper)); }}
.hero h1{{ font-weight:400; font-size:clamp(1.7rem,3.6vw,2.4rem); margin:0 0 0.3rem; letter-spacing:-0.015em; }}
.hero p{{ margin:0; color:var(--ink-soft); font-style:italic; }}
.wrap{{ max-width:62rem; margin:0 auto; padding:2rem clamp(1.25rem,5vw,2rem) 3rem; }}
.top{{ display:grid; grid-template-columns:auto 1fr; gap:clamp(1.5rem,4vw,3rem); align-items:center; margin-bottom:2.5rem; }}
.ring{{ --v:{ring}; width:150px; height:150px; border-radius:50%; display:grid; place-items:center;
  background:conic-gradient(var(--done) calc(var(--v)*1%), var(--none) 0); flex:none; }}
.ring .inner{{ width:116px; height:116px; border-radius:50%; background:var(--paper); display:grid; place-items:center; text-align:center; }}
.ring .pct{{ font-size:1.9rem; font-weight:500; line-height:1; }}
.ring .lbl{{ font-size:0.72rem; font-variant:small-caps; letter-spacing:0.1em; color:var(--ink-faint); }}
.stats{{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:1rem; }}
.stat{{ background:var(--paper-2); border:1px solid var(--rule); border-radius:12px; padding:1rem 1.2rem; }}
.stat .n{{ font-size:1.6rem; font-weight:500; }}
.stat .k{{ font-size:0.78rem; font-variant:small-caps; letter-spacing:0.08em; color:var(--ink-faint); }}
h2.sec{{ font-weight:400; font-size:1.25rem; margin:2.5rem 0 0.4rem; }}
.sec-sub{{ color:var(--ink-faint); font-style:italic; font-size:0.9rem; margin:0 0 1.2rem; }}
.legend{{ display:flex; gap:1.2rem; flex-wrap:wrap; font-size:0.82rem; color:var(--ink-soft); margin-bottom:1rem; }}
.legend i{{ display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:0.35rem; vertical-align:-1px; }}
.grid{{ display:grid; grid-template-columns:repeat(auto-fill,minmax(58px,1fr)); gap:6px; }}
.cell{{ aspect-ratio:1; border-radius:8px; border:1px solid var(--rule); display:flex; flex-direction:column; align-items:center; justify-content:center; text-decoration:none; color:var(--ink-soft); background:var(--none); transition:transform .12s; }}
.cell:hover{{ transform:translateY(-2px); }}
.cell .c-num{{ font-size:0.95rem; font-weight:500; color:var(--ink); }}
.cell .c-frac{{ font-size:0.62rem; color:var(--ink-faint); }}
.cell.complete{{ background:var(--done); border-color:oklch(0.55 0.09 80); }}
.cell.complete .c-num, .cell.complete .c-frac{{ color:oklch(0.30 0.03 80); }}
.cell.partial{{ background:var(--partial); border-color:oklch(0.72 0.10 82); }}
a.cell.complete:hover, a.cell.partial:hover{{ filter:brightness(1.03); }}
table{{ width:100%; border-collapse:collapse; font-size:0.9rem; margin-top:0.5rem; }}
th,td{{ text-align:left; padding:0.55rem 0.6rem; border-bottom:1px solid var(--rule); }}
th{{ font-variant:small-caps; letter-spacing:0.06em; font-size:0.76rem; color:var(--ink-faint); font-weight:400; }}
td.r-num{{ color:var(--ink-faint); }}
.pill{{ font-size:0.72rem; font-variant:small-caps; letter-spacing:0.06em; padding:0.1rem 0.5rem; border-radius:20px; }}
.pill.complete{{ background:var(--done); color:oklch(0.30 0.03 80); }}
.pill.partial{{ background:var(--partial); color:oklch(0.32 0.04 82); }}
td a{{ color:var(--done); text-decoration:none; border-bottom:1px solid var(--rule); }}
.empty{{ color:var(--ink-faint); font-style:italic; text-align:center; }}
footer{{ border-top:1px solid var(--rule); background:var(--paper-2); }}
.foot-inner{{ max-width:62rem; margin:0 auto; padding:1.5rem clamp(1.25rem,5vw,2rem); color:var(--ink-faint); font-size:0.82rem; font-style:italic; }}
.foot-inner code{{ font-family:ui-monospace,Menlo,monospace; font-style:normal; font-size:0.76rem; background:oklch(0.94 0.01 70); padding:0.05rem 0.35rem; border-radius:4px; }}
@media(max-width:560px){{ .top{{ grid-template-columns:1fr; justify-items:center; }} }}
</style>
</head>
<body>
<header class="masthead">
  <div class="wordmark"><span class="sun"></span><span class="name">The Thematic Qur'an</span></div>
  <span class="tag">Overview · compilation progress</span>
</header>

<section class="hero">
  <h1>Overview Tafsir — Progress</h1>
  <p>How far the compiled English reading has reached across the Qur'an.</p>
</section>

<div class="wrap">
  <div class="top">
    <div class="ring"><div class="inner"><div><div class="pct">{pct_sections}%</div><div class="lbl">sections</div></div></div></div>
    <div class="stats">
      <div class="stat"><div class="n">{sections_done}<span style="color:var(--ink-faint);font-size:1rem"> / {sections_total}</span></div><div class="k">Sections compiled</div></div>
      <div class="stat"><div class="n">{surahs_complete}<span style="color:var(--ink-faint);font-size:1rem"> / 114</span></div><div class="k">Surahs complete</div></div>
      <div class="stat"><div class="n">{surahs_partial}</div><div class="k">Surahs in progress</div></div>
      <div class="stat"><div class="n">{avg_comm}</div><div class="k">Avg commentators / surah</div></div>
    </div>
  </div>

  <h2 class="sec">The whole Qur'an, at a glance</h2>
  <p class="sec-sub">Each square is a surah (1&ndash;114). Filled squares are compiled; the fraction shows sections done. Compiled surahs link to their reading.</p>
  <div class="legend">
    <span><i style="background:var(--done)"></i>Complete</span>
    <span><i style="background:var(--partial)"></i>In progress</span>
    <span><i style="background:var(--none);border:1px solid var(--rule)"></i>Not started</span>
  </div>
  <div class="grid">
{grid}
  </div>

  <h2 class="sec">Compiled so far</h2>
  <table>
    <thead><tr><th>#</th><th>Surah</th><th>Sections</th><th>Commentators</th><th>Status</th><th>Compiled</th><th></th></tr></thead>
    <tbody>
{done_rows}
    </tbody>
  </table>
</div>

<footer>
  <div class="foot-inner">
    Generated {generated} by <code>scripts/overview_progress.py</code>, scanning <code>data/tafsir_overview/</code> against <code>data/theme_breaks.json</code>. Re-run the script after compiling a surah to refresh this page.
  </div>
</footer>

<script id="progress-data" type="application/json">{data_json}</script>
</body>
</html>
"""


def main():
    p = scan()
    os.makedirs(OVERVIEW_DIR, exist_ok=True)
    os.makedirs(DOCS_DIR, exist_ok=True)
    with open(PROGRESS_JSON, "w", encoding="utf-8") as f:
        json.dump(p, f, ensure_ascii=False, indent=2)
    with open(PROGRESS_HTML, "w", encoding="utf-8") as f:
        f.write(render_html(p))

    t = p["totals"]
    print("Overview tafsir progress")
    print("=" * 34)
    print(f"  Sections compiled : {t['sections_done']} / {t['sections_total']}  ({t['pct_sections']}%)")
    print(f"  Surahs complete   : {t['surahs_complete']} / 114")
    print(f"  Surahs in progress: {t['surahs_partial']}")
    print(f"  Avg commentators  : {t['avg_commentators']}")
    print("-" * 34)
    for s in p["surahs"]:
        if s["status"] != "none":
            print(f"  [{s['status'][:4]}] {s['num']:>3} {s['name']:<16} {s['sections_done']}/{s['sections_total']}")
    print("-" * 34)
    print(f"  Wrote {os.path.relpath(PROGRESS_JSON, ROOT)}")
    print(f"  Wrote {os.path.relpath(PROGRESS_HTML, ROOT)}")


if __name__ == "__main__":
    main()
