// js/scholar.js
// Scholar modal: tabbed overlay (Tafsir + My Notes) for any thematic section.
// Exposes window.openScholarModal(surahNum, start, end, data).

(function () {
    'use strict';

    const QF_BASE = '/api/qf-public/api/v4';
    const QF_AUTH_BASE = '/api/qf/auth/v1';
    const DEFAULT_TAFSIR_SLUGS = ['en-tafisr-ibn-kathir', 'en-tafsir-ibn-kathir', 'en-tafsir-maarif-ul-quran'];

    // -----------------------------------------------------------------
    // State
    // -----------------------------------------------------------------
    let modalEl = null;
    let activeSection = null; // { surah, start, end, data }
    let activeTab = 'tafsir';
    let tafsirList = null;    // cached list from /resources/tafsirs
    let selectedTafsirId = null;
    const tafsirCache = new Map(); // key = `${tafsirId}|${verseKey}` -> html
    let escHandler = null;

    // -----------------------------------------------------------------
    // Utils
    // -----------------------------------------------------------------
    function isLoggedIn() {
        return !!document.cookie.split(';').find(c => c.trim().startsWith('quran_access_token_'));
    }

    function prettySurahName(surahNum) {
        let name = `Surah ${surahNum}`;
        if (typeof window.getSurahName === 'function') {
            const raw = window.getSurahName(surahNum);
            if (raw) {
                const parts = raw.split(' ');
                if (parts.length > 1 && !isNaN(parts[0])) parts.shift();
                name = 'Surah ' + parts.join(' ');
            }
        }
        return name;
    }

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Strip <script> for basic safety; retain <p>/<em>/<strong>/<br> etc. from QF responses
    function sanitizeTafsirHtml(html) {
        if (!html) return '';
        return String(html).replace(/<script[\s\S]*?<\/script>/gi, '');
    }

    // -----------------------------------------------------------------
    // Fetch with retry-on-429 (single retry using exponential backoff)
    // -----------------------------------------------------------------
    async function fetchJson(url, options = {}, retries = 1) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429 && retries > 0) {
                const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
                await new Promise(r => setTimeout(r, Math.max(retryAfter, 1) * 1000));
                return fetchJson(url, options, retries - 1);
            }
            const text = await res.text();
            let json = null;
            try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { error: text }; }
            return { ok: res.ok, status: res.status, data: json };
        } catch (e) {
            return { ok: false, status: 0, data: { error: e.message } };
        }
    }

    // -----------------------------------------------------------------
    // DOM: build the modal shell once
    // -----------------------------------------------------------------
    function buildModal() {
        if (modalEl) return modalEl;

        const overlay = document.createElement('div');
        overlay.id = 'scholarModal';
        overlay.className = 'fixed inset-0 z-[90] hidden overflow-y-auto';
        overlay.style.background = 'linear-gradient(to bottom, #12101C 0%, #221F2B 50%, #352B39 100%)';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'scholarModalTitle');

        overlay.innerHTML = `
            <div class="max-w-3xl mx-auto px-4 md:px-8 pt-8 md:pt-14 pb-32">

                <!-- Header -->
                <div class="flex items-center justify-between gap-3 mb-8">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-[#56A3A6]/20 flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-2xl text-[#56A3A6]" aria-hidden="true">menu_book</span>
                        </div>
                        <div>
                            <h2 id="scholarModalTitle" class="text-2xl md:text-3xl font-bold font-['Forum'] tracking-widest text-white uppercase">Scholar</h2>
                            <p id="scholarModalSubtitle" class="text-xs text-[#56A3A6] font-bold font-['Nunito'] tracking-widest uppercase mt-1"></p>
                        </div>
                    </div>
                    <button id="scholarCloseBtn" aria-label="Close Scholar"
                        class="text-white/50 hover:text-white hover:bg-white/10 w-10 h-10 rounded-full flex items-center justify-center transition border border-transparent hover:border-white/10 shrink-0">
                        <span class="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
                    </button>
                </div>

                <!-- Section card replica -->
                <div id="scholarSectionReplica"></div>

                <!-- Tabs -->
                <div class="mt-8 border-b border-white/10" role="tablist" aria-label="Scholar tabs">
                    <div class="flex gap-1">
                        <button id="scholarTabTafsir" role="tab" aria-selected="true" data-tab="tafsir"
                            class="scholar-tab-btn px-4 py-2.5 font-['Nunito'] text-sm font-bold uppercase tracking-wider border-b-2 transition">
                            <span class="material-symbols-outlined align-middle text-base mr-1" aria-hidden="true">auto_stories</span>Tafsir
                        </button>
                        <button id="scholarTabNotes" role="tab" aria-selected="false" data-tab="notes"
                            class="scholar-tab-btn px-4 py-2.5 font-['Nunito'] text-sm font-bold uppercase tracking-wider border-b-2 transition">
                            <span class="material-symbols-outlined align-middle text-base mr-1" aria-hidden="true">edit_note</span>My Notes
                        </button>
                    </div>
                </div>

                <!-- Body -->
                <div id="scholarBody" class="py-6 font-['Nunito']"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        modalEl = overlay;

        overlay.querySelector('#scholarCloseBtn').addEventListener('click', closeModal);
        overlay.querySelector('#scholarTabTafsir').addEventListener('click', () => setActiveTab('tafsir'));
        overlay.querySelector('#scholarTabNotes').addEventListener('click', () => setActiveTab('notes'));

        return overlay;
    }

    function setActiveTab(tab) {
        activeTab = tab;
        const tBtn = modalEl.querySelector('#scholarTabTafsir');
        const nBtn = modalEl.querySelector('#scholarTabNotes');

        const activeClasses = ['text-[#56A3A6]', 'border-[#56A3A6]'];
        const inactiveClasses = ['text-white/50', 'border-transparent', 'hover:text-white/80'];

        [tBtn, nBtn].forEach(btn => btn.classList.remove(...activeClasses, ...inactiveClasses));
        (tab === 'tafsir' ? tBtn : nBtn).classList.add(...activeClasses);
        (tab === 'tafsir' ? nBtn : tBtn).classList.add(...inactiveClasses);
        tBtn.setAttribute('aria-selected', String(tab === 'tafsir'));
        nBtn.setAttribute('aria-selected', String(tab === 'notes'));

        if (tab === 'tafsir') renderTafsir();
        else renderNotes();
    }

    function closeModal() {
        if (!modalEl) return;
        modalEl.classList.add('hidden');
        document.body.style.overflow = '';
        if (escHandler) {
            document.removeEventListener('keydown', escHandler);
            escHandler = null;
        }
    }

    // -----------------------------------------------------------------
    // Section card replica (header + arabic + translation + actions)
    // -----------------------------------------------------------------
    function renderSectionReplica() {
        const host = modalEl.querySelector('#scholarSectionReplica');
        if (!host || !activeSection) return;

        const { surah, start, end, data } = activeSection;
        const fontSelect = document.getElementById('fontSelect');
        const currentFontClass = fontSelect ? fontSelect.value : 'font-amiri';
        const selectedLang = document.getElementById('languageSelect') ? document.getElementById('languageSelect').value : 'en';
        const isUrdu = selectedLang === 'ur';

        // Build arabic html
        let arabicHtml = '';
        data.forEach(v => {
            const verseNum = v.ayah_no_surah;
            const arNum = verseNum.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
            const badge = `<span class="ayah-badge"><span class="ayah-symbol">۝</span><span class="ayah-number">${arNum}</span></span>`;
            arabicHtml += `${escapeHtml(v.ayah_ar || '')}&nbsp;${badge} `;
        });

        // Build translation html
        let transHtml = '';
        data.forEach(v => {
            const verseNum = v.ayah_no_surah;
            const badge = `<span class="align-super text-xs text-[#56A3A6] font-bold mx-1 font-['Nunito']">(${verseNum})</span>`;
            const text = isUrdu ? (v.urdu_translation || '') : (v.ayah_en || '');
            transHtml += isUrdu ? `${escapeHtml(text)} ${badge} ` : `${badge} ${escapeHtml(text)} `;
        });

        host.innerHTML = `
            <div class="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6">
                <div class="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-white/10">
                    <span class="text-xs font-bold text-white/60 tracking-widest uppercase font-['Nunito']">Verses ${start} - ${end}</span>
                    <div class="flex items-center gap-1">
                        <button id="scholarReplicaShare" aria-label="Share" class="text-white/40 hover:text-[#56A3A6] p-2 transition">
                            <span class="material-symbols-outlined text-xl" aria-hidden="true">link</span>
                        </button>
                        <button id="scholarReplicaCopy" aria-label="Copy text" class="text-white/40 hover:text-[#56A3A6] p-2 transition">
                            <span class="material-symbols-outlined text-xl" aria-hidden="true">content_copy</span>
                        </button>
                        <button id="scholarReplicaDownload" aria-label="Export" class="text-white/40 hover:text-[#56A3A6] p-2 transition">
                            <span class="material-symbols-outlined text-xl" aria-hidden="true">download</span>
                        </button>
                    </div>
                </div>
                <div dir="rtl" class="${currentFontClass} text-right text-[#F3E4CE] mb-5" style="font-size: 1.6rem; line-height: 2.2;">${arabicHtml}</div>
                <div ${isUrdu ? 'dir="rtl"' : ''} class="${isUrdu ? 'font-urdu text-right leading-[2.2] text-white/90' : "font-['Nunito'] text-left leading-relaxed text-white/80"}" style="font-size: 1.05rem;">${transHtml}</div>
            </div>
        `;

        // Wire replica buttons by triggering the originals on the live card
        const live = document.getElementById(`section-${surah}-${start}`);
        host.querySelector('#scholarReplicaShare').addEventListener('click', () => {
            const btn = live && live.querySelector('button[aria-label^="Share"]');
            if (btn) btn.click();
        });
        host.querySelector('#scholarReplicaCopy').addEventListener('click', () => {
            const btn = live && live.querySelector('button[aria-label^="Copy"]');
            if (btn) btn.click();
        });
        host.querySelector('#scholarReplicaDownload').addEventListener('click', () => {
            const btn = live && live.querySelector('button[aria-label^="Export"]');
            if (btn) btn.click();
        });
    }

    // -----------------------------------------------------------------
    // TAFSIR TAB
    // -----------------------------------------------------------------
    async function loadTafsirList() {
        if (tafsirList) return tafsirList;
        const res = await fetchJson(`${QF_BASE}/resources/tafsirs?language=en`);
        if (res.status === 401) throw new Error('unauthorized');
        if (res.status === 403) throw new Error('forbidden');
        if (!res.ok) throw new Error(res.data && res.data.error ? res.data.error : `HTTP ${res.status}`);
        const list = (res.data && (res.data.tafsirs || res.data.data || [])) || [];
        tafsirList = list;

        // Pick a sensible default: first English tafsir, prefer known slugs
        if (!selectedTafsirId && list.length) {
            const bySlug = list.find(t => DEFAULT_TAFSIR_SLUGS.includes(t.slug));
            const firstEn = list.find(t => (t.language_name || '').toLowerCase() === 'english');
            selectedTafsirId = (bySlug || firstEn || list[0]).id;
        }
        return list;
    }

    async function loadTafsirForAyah(tafsirId, verseKey) {
        const cacheKey = `${tafsirId}|${verseKey}`;
        if (tafsirCache.has(cacheKey)) return tafsirCache.get(cacheKey);
        const res = await fetchJson(`${QF_BASE}/tafsirs/${encodeURIComponent(tafsirId)}/by_ayah/${encodeURIComponent(verseKey)}`);
        let text = '';
        if (res.ok) {
            const t = res.data && (res.data.tafsir || (res.data.tafsirs && res.data.tafsirs[0]) || res.data.data);
            text = (t && (t.text || t.translated_text)) || '';
        }
        tafsirCache.set(cacheKey, text);
        return text;
    }

    // async function saveNote(noteText, range) {
    //     const payload = { body: noteText, ranges: [range] };

    //     // Step 1: create the note
    //     const createRes = await fetchJson(`${QF_AUTH_BASE}/notes`, {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify(payload)
    //     });
    //     if (!createRes.ok) return createRes;

    //     // Step 2: publish the note
    //     const d = createRes.data;
    //     const noteId = d && ((d.data && d.data.id) || (d.note && d.note.id) || d.id);
    //     if (!noteId) return createRes;

    //     return fetchJson(`${QF_AUTH_BASE}/notes`, {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify(payload),
    //         saveToQR: true
    //     });
    // }

    async function saveNote(noteText, range) {
    const payload = {
        body: noteText,
        saveToQR: true,
        ranges: [range]
    };

    return fetchJson(`${QF_AUTH_BASE}/notes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });
}

    async function renderTafsir() {
        const body = modalEl.querySelector('#scholarBody');
        if (!body || !activeSection) return;

        body.innerHTML = `
            <div class="flex items-center justify-center py-12 text-white/60">
                <span class="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                Loading tafsirs…
            </div>
        `;

        let list;
        try {
            list = await loadTafsirList();
        } catch (e) {
            body.innerHTML = `
                <div class="text-center py-10 text-white/70">
                    <span class="material-symbols-outlined text-4xl text-red-400 mb-2 block">error</span>
                    <p class="font-bold">Could not load tafsirs.</p>
                    <p class="text-sm text-white/50 mt-1">${escapeHtml(e.message)}</p>
                </div>
            `;
            return;
        }

        if (activeTab !== 'tafsir') return;

        // Group by language, English first then alphabetical
        const byLang = {};
        list.forEach(t => {
            const lang = (t.language_name || 'other').toLowerCase();
            if (!byLang[lang]) byLang[lang] = [];
            byLang[lang].push(t);
        });
        const langOrder = Object.keys(byLang).sort((a, b) => {
            if (a === 'english') return -1;
            if (b === 'english') return 1;
            return a.localeCompare(b);
        });
        const options = langOrder.map(lang => {
            const groupLabel = lang.charAt(0).toUpperCase() + lang.slice(1);
            const opts = byLang[lang].map(t => {
                const name = (t.translated_name && t.translated_name.name) ? t.translated_name.name : (t.name || t.slug || String(t.id));
                return `<option value="${escapeHtml(String(t.id))}" ${String(t.id) === String(selectedTafsirId) ? 'selected' : ''}>${escapeHtml(name)}</option>`;
            }).join('');
            return `<optgroup label="${escapeHtml(groupLabel)}">${opts}</optgroup>`;
        }).join('');

        body.innerHTML = `
            <div class="flex items-center justify-between flex-wrap gap-3 mb-5">
                <label for="scholarTafsirSelect" class="text-white/60 text-xs uppercase tracking-widest font-bold">Tafsir</label>
                <select id="scholarTafsirSelect" class="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#56A3A6] max-w-full">
                    ${options}
                </select>
            </div>
            <div id="scholarTafsirContent" class="scholar-prose"></div>
        `;

        const sel = body.querySelector('#scholarTafsirSelect');
        sel.addEventListener('change', () => {
            selectedTafsirId = sel.value;
            renderTafsirContent();
        });

        renderTafsirContent();
    }

    async function renderTafsirContent() {
        const host = modalEl.querySelector('#scholarTafsirContent');
        if (!host || !activeSection) return;
        const { surah, data } = activeSection;

        host.innerHTML = `
            <div class="flex items-center py-8 text-white/60">
                <span class="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                Fetching tafsir…
            </div>
        `;

        const verseKeys = data.map(v => `${surah}:${v.ayah_no_surah}`);
        const results = await Promise.all(verseKeys.map(k => loadTafsirForAyah(selectedTafsirId, k).catch(() => '')));

        if (activeTab !== 'tafsir') return;

        const blocks = verseKeys.map((vk, i) => {
            const html = sanitizeTafsirHtml(results[i]);
            return `
                <section class="scholar-ayah-block">
                    <header class="scholar-ayah-heading">
                        <span class="scholar-ayah-marker">${escapeHtml(vk)}</span>
                    </header>
                    <div class="scholar-ayah-body">
                        ${html ? html : '<p class="text-white/40 italic">No tafsir available for this ayah from the selected source.</p>'}
                    </div>
                </section>
            `;
        }).join('');

        host.innerHTML = blocks || '<p class="text-white/60">No verses in this section.</p>';
    }

    // -----------------------------------------------------------------
    // NOTES TAB
    // -----------------------------------------------------------------
    function buildNoteBlocks(surah, data, notes) {
        const byVerseKey = {};
        data.forEach(v => { byVerseKey[`${surah}:${v.ayah_no_surah}`] = []; });

        const attach = (note, key) => {
            if (!(key in byVerseKey)) return;
            if (!byVerseKey[key].some(n => n.id === note.id)) byVerseKey[key].push(note);
        };

        notes.forEach(note => {
            if (note.verse_key) attach(note, note.verse_key);
            const ranges = Array.isArray(note.ranges) ? note.ranges : (note.verse_keys || []);
            ranges.forEach(r => {
                if (typeof r === 'string' && r.indexOf('-') !== -1) {
                    const [a, b] = r.split('-');
                    const [s1, a1] = a.split(':').map(Number);
                    const [s2, a2] = (b || '').split(':').map(Number);
                    if (!Number.isNaN(s1)) {
                        const sTo = Number.isNaN(s2) ? s1 : s2, vTo = Number.isNaN(a2) ? a1 : a2;
                        if (s1 === surah && sTo === surah) {
                            for (let i = a1; i <= vTo; i++) attach(note, `${surah}:${i}`);
                        }
                    }
                } else if (typeof r === 'string' && r.indexOf(':') !== -1) {
                    attach(note, r);
                }
            });
        });

        return data.map(v => {
            const key = `${surah}:${v.ayah_no_surah}`;
            const ns = byVerseKey[key] || [];
            const notesHtml = ns.length
                ? ns.map(n => `
                    <article class="scholar-note" data-note-id="${escapeHtml(String(n.id))}">
                        <div class="scholar-note-body">${escapeHtml((n.body || n.text || '').toString()).replace(/\n/g, '<br>')}</div>
                    </article>`).join('')
                : '<p class="text-white/40 italic text-sm">No notes for this ayah.</p>';
            return `
                <section class="scholar-ayah-block">
                    <header class="scholar-ayah-heading">
                        <span class="scholar-ayah-marker">${escapeHtml(key)}</span>
                    </header>
                    <div class="scholar-ayah-body">${notesHtml}</div>
                </section>`;
        }).join('');
    }

    async function renderNotes() {
        const body = modalEl.querySelector('#scholarBody');
        if (!body || !activeSection) return;

        if (!isLoggedIn()) {
            body.innerHTML = `
                <div class="text-center py-12 max-w-md mx-auto">
                    <span class="material-symbols-outlined text-5xl text-[#56A3A6]/60 block mb-3">lock_person</span>
                    <h3 class="text-white text-lg font-bold mb-2">Sign in to manage notes</h3>
                    <p class="text-white/60 mb-5">Connect your Quran.com account to write and sync personal reflections on any section.</p>
                    <a href="/auth/login" class="inline-flex items-center gap-2 bg-[#56A3A6] hover:bg-[#458a8d] text-white font-bold px-6 py-3 rounded-full transition">
                        <span class="material-symbols-outlined" aria-hidden="true">login</span>
                        Sign in with Quran.com
                    </a>
                </div>`;
            return;
        }

        const { surah, start, end, data } = activeSection;
        const range = `${surah}:${start}-${surah}:${end}`;

        body.innerHTML = `
            <div class="mb-8 bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6">
                <h4 class="text-white/60 text-xs uppercase tracking-widest font-bold mb-1 font-['Nunito']">Add a Note</h4>
                <p class="text-white/30 text-xs font-['Nunito'] mb-4">${escapeHtml(prettySurahName(surah))}, verses ${start}–${end} · synced to Quran.com · minimum 6 characters</p>
                <textarea id="scholarNoteInput" rows="5" placeholder="Write your reflection on this section…"
                    class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/90 text-sm placeholder-white/30 focus:outline-none focus:border-[#56A3A6] resize-none font-['Nunito']"></textarea>
                <div class="flex items-center justify-between mt-3 gap-3">
                    <span id="scholarNoteSaveStatus" class="text-xs text-white/40 font-['Nunito']"></span>
                    <button id="scholarNoteSaveBtn"
                        class="inline-flex items-center gap-2 bg-[#56A3A6] hover:bg-[#458a8d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 rounded-full transition">
                        <span class="material-symbols-outlined text-base" aria-hidden="true">cloud_upload</span>
                        Save to Quran.com
                    </button>
                </div>
            </div>
            <div id="scholarNotesList">
                <div class="flex items-center py-4 text-white/40 text-sm font-['Nunito']">
                    <span class="material-symbols-outlined animate-spin mr-2 text-base">progress_activity</span>
                    Loading your notes…
                </div>
            </div>`;

        const saveBtn = body.querySelector('#scholarNoteSaveBtn');
        const textarea = body.querySelector('#scholarNoteInput');
        const statusEl = body.querySelector('#scholarNoteSaveStatus');

        saveBtn.addEventListener('click', async () => {
            const text = textarea.value.trim();
            if (text.length < 6) { statusEl.textContent = 'Note must be at least 6 characters.'; return; }
            saveBtn.disabled = true;
            statusEl.textContent = 'Saving…';
            const res = await saveNote(text, range);
            if (res.ok) {
                textarea.value = '';
                statusEl.textContent = 'Saved and published to Quran.com!';
                setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
                refreshNotesList(surah, start, end, data);
            } else if (res.status === 401) {
                statusEl.textContent = 'Session expired — please sign in again.';
            } else {
                statusEl.textContent = `Error: ${(res.data && res.data.error) || `HTTP ${res.status}`}`;
            }
            saveBtn.disabled = false;
        });

        refreshNotesList(surah, start, end, data);
    }

    async function refreshNotesList(surah, start, end, data) {
        const listEl = modalEl && modalEl.querySelector('#scholarNotesList');
        if (!listEl || activeTab !== 'notes') return;

        const res = await fetchJson(`${QF_AUTH_BASE}/notes/by-range?from=${surah}:${start}&to=${surah}:${end}`);
        if (activeTab !== 'notes' || !modalEl.querySelector('#scholarNotesList')) return;

        if (res.status === 401) {
            listEl.innerHTML = `
                <div class="text-center py-8 text-white/70">
                    <span class="material-symbols-outlined text-3xl text-amber-400 block mb-2">key_off</span>
                    <p class="font-bold text-sm">Session expired.</p>
                    <a href="/auth/login" class="inline-flex items-center gap-2 mt-3 bg-[#56A3A6] hover:bg-[#458a8d] text-white font-bold text-sm px-5 py-2 rounded-full transition">
                        <span class="material-symbols-outlined text-base" aria-hidden="true">login</span>Sign in
                    </a>
                </div>`;
            return;
        }

        if (!res.ok) {
            listEl.innerHTML = `<p class="text-red-400/70 text-sm py-2 font-['Nunito']">Could not load notes: ${escapeHtml((res.data && res.data.error) || `HTTP ${res.status}`)}</p>`;
            return;
        }

        const notes = (res.data && (res.data.data || res.data.notes || [])) || [];
        const blocks = buildNoteBlocks(surah, data, notes);
        listEl.innerHTML = blocks || '<p class="text-white/40 italic text-sm py-4 font-[\'Nunito\']">No notes yet for this section.</p>';
    }

    // -----------------------------------------------------------------
    // Open
    // -----------------------------------------------------------------
    function openScholarModal(surah, start, end, data) {
        buildModal();
        activeSection = { surah, start, end, data: Array.isArray(data) ? data : [] };
        tafsirCache.clear(); // clear per-verse cache when section changes

        modalEl.querySelector('#scholarModalTitle').textContent = prettySurahName(surah);
        modalEl.querySelector('#scholarModalSubtitle').textContent = `Verses ${start}–${end}`;

        modalEl.scrollTop = 0;
        modalEl.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        renderSectionReplica();
        setActiveTab('tafsir');

        escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', escHandler);
    }

    window.openScholarModal = openScholarModal;
    window.closeScholarModal = closeModal;
})();
