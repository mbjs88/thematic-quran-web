// js/ui-renderer.js

const UI_KEYS = {
    SURAH_NO: 'surah_no',
    AYAH_NO: 'ayah_no_surah',
    ARABIC: 'ayah_ar',
    ENGLISH: 'ayah_en',
    URDU: 'urdu_translation'
};

// HELPER: Convert English Digits to Arabic Numerals (123 -> ١٢٣)
function toArabicNumerals(n) {
    return n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function updatePageMetadata(title, description) {
    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);
}

function renderThematicSurah(surahNum, verses, breaks) {
    const container = document.getElementById('contentArea');
    container.innerHTML = '';
    const lastVerseNum = verses.length > 0 ? verses[verses.length - 1][UI_KEYS.AYAH_NO] : 0;

    const surahSelect = document.getElementById('surahSelect');
    let surahName = `Surah ${surahNum}`;
    if (surahSelect) {
        const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === surahNum);
        if (option) surahName = option.text;
    }

    updatePageMetadata(
        `${surahName} | Thematic Quran`,
        `Read and listen to ${surahName} with synchronized translation and thematic verse grouping.`
    );

    const spacer = document.getElementById('mainSpacer');
    if (spacer) {
        if (surahNum === 9) {
            spacer.className = "w-full h-[130px] md:h-[180px] shrink-0 transition-all duration-300";
        } else {
            spacer.className = "w-full h-[150px] md:h-[160px] shrink-0 transition-all duration-300";
        }
    }

    if (surahNum !== 9 && surahNum !== 1) {
        const bismillahDiv = document.createElement('div');
        bismillahDiv.className = "text-center mb-10 opacity-90 transition-opacity select-none";
        const fontSelect = document.getElementById('fontSelect');
        const currentFontClass = fontSelect ? fontSelect.value : 'font-amiri';
        bismillahDiv.innerHTML = `<span class="${currentFontClass} text-3xl md:text-3xl text-white">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>`;
        container.appendChild(bismillahDiv);
    }

    breaks.forEach((startVerse, index) => {
        const nextBreak = breaks[index + 1];
        const endVerse = nextBreak ? (nextBreak - 1) : lastVerseNum;
        const sectionData = verses.filter(v => {
            const vNum = v[UI_KEYS.AYAH_NO];
            return vNum >= startVerse && vNum <= endVerse;
        });

        if (sectionData.length > 0) {
            container.appendChild(createCard(surahNum, startVerse, endVerse, sectionData));
        }
    });
}

function renderThematicJuz(juzId, verses, allBreaks) {
    const container = document.getElementById('contentArea');
    container.innerHTML = '';
    updatePageMetadata(`Juz ${juzId} | Thematic Quran`, `Read and listen to Juz ${juzId}.`);

    const spacer = document.getElementById('mainSpacer');
    if (spacer) spacer.className = "w-full h-[100px] shrink-0 transition-all duration-300";

    const juzHeader = document.createElement('div');
    juzHeader.className = "text-center mb-12";
    juzHeader.innerHTML = `<h1 class="text-4xl font-['Forum'] text-white tracking-widest uppercase">Juz ${juzId}</h1>`;
    container.appendChild(juzHeader);

    if (!verses || verses.length === 0) return;

    let currentSurah = null;
    let currentSectionData = [];
    let sectionStartVerse = -1;

    verses.forEach((verse, index) => {
        const surah = verse[UI_KEYS.SURAH_NO];
        const verseNum = verse[UI_KEYS.AYAH_NO];

        if (surah !== currentSurah) {
            if (currentSectionData.length > 0) {
                const endVerse = currentSectionData[currentSectionData.length - 1][UI_KEYS.AYAH_NO];
                container.appendChild(createCard(currentSurah, sectionStartVerse, endVerse, currentSectionData));
                currentSectionData = [];
            }
            const latinName = verse['surah_name_roman'] || "";
            const engName = verse['surah_name_en'] || "";
            container.appendChild(createMiniSurahHeader(surah, latinName, engName));
            currentSurah = surah;
            sectionStartVerse = verseNum;
        }

        const surahBreaks = allBreaks[String(surah)] || [];
        const isBreak = surahBreaks.includes(verseNum);

        if (isBreak && verseNum !== sectionStartVerse && currentSectionData.length > 0) {
            const endVerse = currentSectionData[currentSectionData.length - 1][UI_KEYS.AYAH_NO];
            container.appendChild(createCard(surah, sectionStartVerse, endVerse, currentSectionData));
            currentSectionData = [];
            sectionStartVerse = verseNum;
        }
        currentSectionData.push(verse);
    });

    if (currentSectionData.length > 0) {
        const endVerse = currentSectionData[currentSectionData.length - 1][UI_KEYS.AYAH_NO];
        container.appendChild(createCard(currentSurah, sectionStartVerse, endVerse, currentSectionData));
    }
}

function createMiniSurahHeader(surahNum, latinName, engName) {
    const container = document.createElement('div');
    container.className = "surah-mini-header mt-16 mb-8 text-center border-t border-white/10 pt-10";
    const title = document.createElement('h2');
    title.className = "text-2xl font-bold text-[#56A3A6] font-['Nunito'] mb-6";
    let displayText = `${surahNum}. ${latinName} (${engName})`;
    if (!latinName) displayText = `Surah ${surahNum}`;
    title.textContent = displayText;
    container.appendChild(title);

    if (surahNum !== 9 && surahNum !== 1) {
        const bismillah = document.createElement('div');
        bismillah.className = "text-center opacity-80 select-none";
        const fontSelect = document.getElementById('fontSelect');
        const currentFontClass = fontSelect ? fontSelect.value : 'font-amiri';
        bismillah.innerHTML = `<span class="${currentFontClass} text-2xl text-white">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>`;
        container.appendChild(bismillah);
    }
    return container;
}

function createCard(surahNum, start, end, data) {
    const card = document.createElement('div');
    const baseClass = "thematic-card relative bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-lg p-6 md:p-8 transition-all duration-300 mb-8 scroll-mt-[20px]";
    card.className = (typeof isEditMode !== 'undefined' && isEditMode)
        ? baseClass + " border-dashed border-white/30"
        : baseClass + " hover:bg-white/10";

    card.id = `section-${surahNum}-${start}`;
    card.dataset.surah = surahNum;
    card.dataset.start = start;
    card.dataset.end = end;

    if (typeof isEditMode === 'undefined' || !isEditMode) {
        const overlay = document.createElement('div');
        overlay.className = "selection-overlay absolute inset-0 z-20 bg-[#56A3A6]/20 border-4 border-[#56A3A6] rounded-3xl hidden cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity";
        overlay.innerHTML = `<div class="bg-[#1E1426] rounded-full p-2 shadow-lg"><span class="material-symbols-outlined text-[#56A3A6] text-3xl">check_circle</span></div>`;
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            const event = new CustomEvent('card-toggle-select', { detail: { card: card } });
            document.dispatchEvent(event);
        });
        card.appendChild(overlay);
    }

    const header = document.createElement('div');
    header.className = "flex justify-between items-center mb-6 border-b border-white/10 pb-4";
    let editCue = "";
    if (typeof isEditMode !== 'undefined' && isEditMode && start !== 1) {
        editCue = `<span class="ml-2 text-xs text-red-300 bg-red-900/50 px-2 py-1 rounded border border-red-500/30">Start of Section</span>`;
    }
    const titleHtml = `<div class="flex items-center"><span class="text-sm font-bold text-white/60 tracking-widest uppercase font-['Nunito']">Verses ${start} - ${end}</span>${editCue}</div>`;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = "flex items-center gap-2 transition-opacity duration-200";

    if (typeof isEditMode === 'undefined' || !isEditMode) {
        const shareBtn = document.createElement('button');
        shareBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition";
        shareBtn.setAttribute('aria-label', `Share verses ${start} to ${end}`);
        shareBtn.innerHTML = '<span class="material-symbols-outlined text-xl" aria-hidden="true">link</span>';
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            const url = `${window.location.origin}${window.location.pathname}#s=${surahNum}&v=${start}-${end}`;
            navigator.clipboard.writeText(url);
            if (window.showToast) window.showToast('Link copied', 'link');
        };

        const copyTextBtn = document.createElement('button');
        copyTextBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition";
        copyTextBtn.setAttribute('aria-label', `Copy text`);
        copyTextBtn.innerHTML = '<span class="material-symbols-outlined text-xl" aria-hidden="true">content_copy</span>';
        copyTextBtn.onclick = (e) => {
            e.stopPropagation();
            if (window.showToast) window.showToast('Text copied', 'content_copy');
        };

        const downloadBtn = document.createElement('button');
        downloadBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition";
        downloadBtn.setAttribute('aria-label', `Download`);
        downloadBtn.innerHTML = '<span class="material-symbols-outlined text-xl" aria-hidden="true">download</span>';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            openDownloadModal(surahNum, start, end);
        };

        const playBtn = document.createElement('button');
        playBtn.className = "play-btn ml-2 w-10 h-10 rounded-full bg-[#56A3A6] hover:bg-[#458a8d] text-white flex items-center justify-center transition-colors shadow-md";
        playBtn.setAttribute('aria-label', `Play`);
        playBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>';
        playBtn.onclick = (e) => handleCardPlayClick(card, surahNum, start, end);

        actionsDiv.appendChild(shareBtn);
        actionsDiv.appendChild(copyTextBtn);
        actionsDiv.appendChild(downloadBtn);
        actionsDiv.appendChild(playBtn);
    }

    header.innerHTML = titleHtml;
    header.appendChild(actionsDiv);

    // --- ARABIC TEXT RENDER ---
    const fontSelect = document.getElementById('fontSelect');
    const currentFontClass = fontSelect ? fontSelect.value : 'font-amiri';
    const scale = (typeof currentFontScale !== 'undefined') ? currentFontScale : 1.0;

    const arabicDiv = document.createElement('div');
    // CRITICAL FIX: setAttribute('dir', 'rtl') forces the browser to treat this as RTL
    arabicDiv.setAttribute('dir', 'rtl');
    arabicDiv.className = `${currentFontClass} text-right text-[#F3E4CE] mb-8`;
    arabicDiv.style.fontSize = `calc(1.875rem * ${scale})`;

    data.forEach(v => {
        const verseNum = v[UI_KEYS.AYAH_NO];
        const span = document.createElement('span');
        span.id = `ayah-ar-${surahNum}-${verseNum}`;

        // --- BADGE (Arabic Digits + Amiri) ---
        let badgeHtml = `
            <span class="ayah-badge" aria-label="Verse ${verseNum}">
                <span class="ayah-symbol">۝</span>
                <span class="ayah-number">${toArabicNumerals(verseNum)}</span>
            </span>`;

        if (typeof isEditMode !== 'undefined' && isEditMode) {
            span.className = "cursor-pointer transition hover:opacity-80";
            if (verseNum === start && verseNum !== 1) badgeHtml = `<span class="text-red-400"> ۝ </span>`;
            span.onclick = (e) => {
                e.stopPropagation();
                if (typeof window.handleVerseBreakToggle === 'function') window.handleVerseBreakToggle(surahNum, verseNum);
            };
        } else {
            span.className = "verse-span";
            span.onclick = (e) => {
                e.stopPropagation();
                triggerVersePlay(card, surahNum, start, end, verseNum, 'arabic');
            };
        }

        // Use non-breaking space (&nbsp;) to glue badge to text
        span.innerHTML = `${v[UI_KEYS.ARABIC] || ""}&nbsp;${badgeHtml} `;
        arabicDiv.appendChild(span);
    });

    // --- TRANSLATION RENDER ---
    const selectedLang = document.getElementById('languageSelect') ? document.getElementById('languageSelect').value : 'en';
    const isUrdu = selectedLang === 'ur';
    const textKey = isUrdu ? UI_KEYS.URDU : UI_KEYS.ENGLISH;

    const transDiv = document.createElement('div');
    if (isUrdu) transDiv.setAttribute('dir', 'rtl'); // Ensure Urdu is also RTL
    transDiv.className = isUrdu
        ? "font-urdu text-right leading-[2.2] text-white/90"
        : "font-['Nunito'] text-left leading-relaxed text-white/80 tracking-normal";
    transDiv.style.fontSize = `calc(1.25rem * ${scale})`;

    data.forEach(v => {
        const verseNum = v[UI_KEYS.AYAH_NO];
        const span = document.createElement('span');
        span.id = `ayah-en-${surahNum}-${verseNum}`;
        let badgeHtml = `<span class="align-super text-xs text-[#56A3A6] font-bold mx-1 font-['Nunito']">(${verseNum})</span>`;

        if (typeof isEditMode !== 'undefined' && isEditMode) {
            span.className = "cursor-pointer transition hover:opacity-80";
            span.onclick = (e) => {
                e.stopPropagation();
                if (typeof window.handleVerseBreakToggle === 'function') window.handleVerseBreakToggle(surahNum, verseNum);
            };
        } else {
            span.className = "verse-span";
            span.onclick = (e) => {
                e.stopPropagation();
                triggerVersePlay(card, surahNum, start, end, verseNum, 'translation');
            };
        }
        const text = v[textKey] || "";
        span.innerHTML = isUrdu ? `${text} ${badgeHtml} ` : `${badgeHtml} ${text} `;
        transDiv.appendChild(span);
    });

    card.appendChild(header);
    card.appendChild(arabicDiv);
    card.appendChild(transDiv);
    return card;
}

function handleCardPlayClick(card, surah, start, end) {
    document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
    card.classList.add('ring-2', 'ring-[#56A3A6]');
    document.getElementById('autoAdvanceToggle').checked = true;
    if (typeof playSession === 'function') playSession(surah, start, end);
    document.dispatchEvent(new CustomEvent('manual-play-started', { detail: { card: card } }));
}

function triggerVersePlay(card, surah, start, end, verseNum, type) {
    document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
    card.classList.add('ring-2', 'ring-[#56A3A6]');
    if (typeof playRange === 'function') playRange(surah, start, end, verseNum, type);
    document.dispatchEvent(new CustomEvent('manual-play-started', { detail: { card: card } }));
}

function openDownloadModal(surah, start, end) {
    const modal = document.getElementById('downloadModal');
    const reciterSelect = document.getElementById('reciterSelect');
    const langSelect = document.getElementById('languageSelect');

    document.getElementById('dlModalTitle').textContent = `Surah ${surah}: Verses ${start}-${end}`;
    const dlReciterSelect = document.getElementById('dlModalReciterSelect');
    const dlLangSelect = document.getElementById('dlModalLangSelect');

    if (dlReciterSelect) { dlReciterSelect.innerHTML = reciterSelect.innerHTML; dlReciterSelect.value = reciterSelect.value; }
    if (dlLangSelect) { dlLangSelect.innerHTML = langSelect.innerHTML; dlLangSelect.value = langSelect.value; }

    document.getElementById('dlProgressContainer').classList.add('hidden');
    document.getElementById('dlConfirmBtn').style.display = 'block';
    modal.classList.remove('hidden');

    document.getElementById('dlConfirmBtn').onclick = () => {
        document.getElementById('dlProgressContainer').classList.remove('hidden');
        document.getElementById('dlConfirmBtn').style.display = 'none';
        const finalReciter = dlReciterSelect ? dlReciterSelect.value : reciterSelect.value;
        const finalLang = dlLangSelect ? dlLangSelect.value : langSelect.value;
        const surahSelect = document.getElementById('surahSelect');
        let surahName = `Surah ${surah}`;
        const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === surah);
        if (option) surahName = option.text;

        if (typeof downloadGroupedSection === 'function') downloadGroupedSection(surah, start, end, finalReciter, finalLang, surahName);
    };
    document.getElementById('dlCancelBtn').onclick = closeDownloadModal;
}

function closeDownloadModal() { document.getElementById('downloadModal').classList.add('hidden'); }

window.highlightActiveVerseUI = function (surah, verse, type) {
    document.querySelectorAll('.active-verse').forEach(el => el.classList.remove('active-verse'));
    const prefix = (type === 'arabic') ? 'ayah-ar' : 'ayah-en';
    const id = `${prefix}-${surah}-${verse}`;
    const el = document.getElementById(id);

    if (el) {
        el.classList.add('active-verse');

        // SMART SCROLL LOGIC
        const rect = el.getBoundingClientRect();
        const headerHeight = document.getElementById('mainHeader')?.offsetHeight || 100;
        const playerBarHeight = document.getElementById('playerBar')?.offsetHeight || 100;

        // Define safe viewing area (viewport minus header and footer)
        const safeTop = headerHeight + 20;
        const safeBottom = window.innerHeight - playerBarHeight - 20;

        // Check if element is outside the safe viewing area
        const isOffScreenTop = rect.top < safeTop;
        const isOffScreenBottom = rect.bottom > safeBottom;

        if (isOffScreenTop || isOffScreenBottom) {
            // If off-screen, scroll it near the top (but under the header)
            const mainContainer = document.getElementById('mainContainer');
            // Calculate where we want the element's top to be (relative to viewport top)
            // We want (rect.top) to be (safeTop + 20)
            // Current scroll position is mainContainer.scrollTop
            // The scroll change needed is (rect.top - safeTop - 20)

            // Note: rect.top is relative to viewport. 
            // We need to adjust scrollTop by the difference between where it IS and where we WANT it.
            const offset = rect.top - (safeTop + 20);

            mainContainer.scrollBy({ top: offset, behavior: 'smooth' });
        }
    }
}

window.showToast = function (message, icon = 'info') {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="material-symbols-outlined text-[#56A3A6]">${icon}</span> ${message}`;
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => toast.classList.remove('toast-visible'), 3000);
};