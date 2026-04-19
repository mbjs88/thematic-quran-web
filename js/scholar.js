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
    let notesCache = null;    // last fetched notes array (for current section only)
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

    async function saveNote(noteText, verseKey) {
        return fetchJson(`${QF_AUTH_BASE}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: noteText, verse_key: verseKey })
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
            const existingHtml = ns.length
                ? ns.map(n => `
                    <article class="scholar-note" data-note-id="${escapeHtml(String(n.id))}">
                        <div class="scholar-note-body">${escapeHtml((n.body || n.text || '').toString()).replace(/\n/g, '<br>')}</div>
                    </article>`).join('')
                : '<p class="text-white/40 italic text-sm mb-1">No notes yet.</p>';

            return `
                <section class="scholar-ayah-block" data-verse-key="${escapeHtml(key)}">
                    <header class="scholar-ayah-heading">
                        <span class="scholar-ayah-marker">${escapeHtml(key)}</span>
                    </header>
                    <div class="scholar-ayah-body">
                        <div class="scholar-notes-list">${existingHtml}</div>
                        <button class="scholar-add-note-btn mt-3 flex items-center gap-1.5 text-[#56A3A6]/60 hover:text-[#56A3A6] text-xs font-bold uppercase tracking-wider transition font-['Nunito']">
                            <span class="material-symbols-outlined text-sm">add_circle</span>Add a note
                        </button>
                        <div class="scholar-note-form hidden mt-3">
                            <textarea rows="3" placeholder="Your reflection on this ayah…"
                                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/90 text-sm placeholder-white/30 focus:outline-none focus:border-[#56A3A6] resize-none font-['Nunito']"></textarea>
                            <div class="flex items-center justify-between mt-2 gap-3">
                                <span class="save-status text-xs text-white/40"></span>
                                <div class="flex gap-2">
                                    <button class="cancel-note-btn text-white/40 hover:text-white/60 text-xs px-3 py-1.5 rounded-full border border-white/10 transition font-['Nunito']">Cancel</button>
                                    <button class="save-note-btn inline-flex items-center gap-1.5 bg-[#56A3A6] hover:bg-[#458a8d] disabled:opacity-50 text-white font-bold text-xs px-4 py-1.5 rounded-full transition">
                                        <span class="material-symbols-outlined text-sm">cloud_upload</span>Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>`;
        }).join('');
    }

    function wireNoteForms(container, surah) {
        container.querySelectorAll('[data-verse-key]').forEach(section => {
            const verseKey = section.dataset.verseKey;
            const addBtn = section.querySelector('.scholar-add-note-btn');
            const form = section.querySelector('.scholar-note-form');
            const textarea = form.querySelector('textarea');
            const cancelBtn = section.querySelector('.cancel-note-btn');
            const saveBtn = section.querySelector('.save-note-btn');
            const statusEl = section.querySelector('.save-status');
            const icon = addBtn.querySelector('.material-symbols-outlined');

            addBtn.addEventListener('click', () => {
                const opening = form.classList.contains('hidden');
                form.classList.toggle('hidden');
                icon.textContent = opening ? 'remove_circle' : 'add_circle';
                if (opening) textarea.focus();
            });

            cancelBtn.addEventListener('click', () => {
                form.classList.add('hidden');
                textarea.value = '';
                statusEl.textContent = '';
                icon.textContent = 'add_circle';
            });

            saveBtn.addEventListener('click', async () => {
                const text = textarea.value.trim();
                if (!text) { statusEl.textContent = 'Please write something first.'; return; }
                saveBtn.disabled = true;
                statusEl.textContent = 'Saving…';
                const res = await saveNote(text, verseKey);
                if (res.ok) {
                    refreshNotesList(surah, activeSection.start, activeSection.end, activeSection.data);
                } else if (res.status === 401) {
                    statusEl.textContent = 'Session expired — please sign in again.';
                    saveBtn.disabled = false;
                } else {
                    statusEl.textContent = `Error: ${(res.data && res.data.error) || `HTTP ${res.status}`}`;
                    saveBtn.disabled = false;
                }
            });
        });
    }

    async function renderNotes() {
        const body = modalEl.querySelector('#scholarBody');
        if (!body || !activeSection) return;

        if (!isLoggedIn()) {
            body.innerHTML = `
                <div class="text-center py-12 max-w-md mx-auto">
                    <span class="material-symbols-outlined text-5xl text-[#56A3A6]/60 block mb-3">lock_person</span>
                    <h3 class="text-white text-lg font-bold mb-2">Sign in to manage notes</h3>
                    <p class="text-white/60 mb-5">Connect your Quran.com account to write and sync personal notes for every ayah.</p>
                    <a href="/auth/login" class="inline-flex items-center gap-2 bg-[#56A3A6] hover:bg-[#458a8d] text-white font-bold px-6 py-3 rounded-full transition">
                        <span class="material-symbols-outlined" aria-hidden="true">login</span>
                        Sign in with Quran.com
                    </a>
                </div>`;
            return;
        }

        body.innerHTML = `
            <div class="flex items-center py-6 text-white/40 text-sm">
                <span class="material-symbols-outlined animate-spin mr-2 text-base">progress_activity</span>
                Loading notes…
            </div>`;

        const { surah, start, end, data } = activeSection;
        await refreshNotesList(surah, start, end, data);
    }

    async function refreshNotesList(surah, start, end, data) {
        const body = modalEl && modalEl.querySelector('#scholarBody');
        if (!body || activeTab !== 'notes') return;

        const res = await fetchJson(`${QF_AUTH_BASE}/notes/by-range?from=${surah}:${start}&to=${surah}:${end}`);
        if (activeTab !== 'notes') return;

        if (res.status === 401) {
            body.innerHTML = `
                <div class="text-center py-10 text-white/70">
                    <span class="material-symbols-outlined text-4xl text-amber-400 block mb-2">key_off</span>
                    <p class="font-bold">Your session has expired.</p>
                    <p class="text-sm text-white/50 mt-1 mb-4">Please sign in again to continue.</p>
                    <a href="/auth/login" class="inline-flex items-center gap-2 bg-[#56A3A6] hover:bg-[#458a8d] text-white font-bold px-5 py-2.5 rounded-full transition">
                        <span class="material-symbols-outlined text-base" aria-hidden="true">login</span>Sign in
                    </a>
                </div>`;
            return;
        }

        if (!res.ok) {
            body.innerHTML = `
                <div class="text-center py-10 text-white/70">
                    <span class="material-symbols-outlined text-4xl text-red-400 block mb-2">error</span>
                    <p class="font-bold">Could not load notes.</p>
                    <p class="text-sm text-white/50 mt-1">${escapeHtml((res.data && res.data.error) || `HTTP ${res.status}`)}</p>
                </div>`;
            return;
        }

        const notes = (res.data && (res.data.data || res.data.notes || [])) || [];
        notesCache = notes;
        const blocks = buildNoteBlocks(surah, data, notes);
        body.innerHTML = blocks || '<p class="text-white/40 italic text-sm py-4">No notes yet for this section.</p>';
        if (blocks) wireNoteForms(body, surah);
    }

    // -----------------------------------------------------------------
    // Open
    // -----------------------------------------------------------------
    function openScholarModal(surah, start, end, data) {
        buildModal();
        activeSection = { surah, start, end, data: Array.isArray(data) ? data : [] };
        notesCache = null;
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
