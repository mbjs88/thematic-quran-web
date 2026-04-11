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

            // Get Surah Name from Select or Helper
            let surahName = `Surah ${surahNum}`;
            if (typeof window.getSurahName === 'function') {
                // Formatting: "2 Al-Baqarah" -> "Al-Baqarah" usually handled by helper or substring
                // Let's use the UI text if possible or helper
                surahName = window.getSurahName(surahNum);
                // Remove number prefix if present for cleaner copy? User text implies "Surah English Name"
                // getSurahName returns "2 Al-Baqarah", let's keep it informative or strip.
                // User Example: "Surah Al-Baqarah 1-5 https..."
                // Logic: split by space, take rest?
                const parts = surahName.split(' ');
                if (parts.length > 1 && !isNaN(parts[0])) parts.shift();
                surahName = "Surah " + parts.join(' ');
            }

            const copyString = `${surahName} ${start}-${end} ${url}`;

            navigator.clipboard.writeText(copyString);
            if (window.showToast) window.showToast('Link copied', 'link');
        };

        const copyTextBtn = document.createElement('button');
        copyTextBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition";
        copyTextBtn.setAttribute('aria-label', `Copy text`);
        copyTextBtn.innerHTML = '<span class="material-symbols-outlined text-xl" aria-hidden="true">content_copy</span>';
        copyTextBtn.onclick = (e) => {
            e.stopPropagation();

            // Construct Text Payload
            let arabicText = "";
            let transText = "";
            const isUrdu = (document.getElementById('languageSelect')?.value === 'ur');
            const textKey = isUrdu ? UI_KEYS.URDU : UI_KEYS.ENGLISH;

            data.forEach(v => {
                const num = v[UI_KEYS.AYAH_NO];
                arabicText += `${v[UI_KEYS.ARABIC]} (${num}) `;
                transText += `${v[textKey]} (${num}) `;
            });

            // Clean up trailing spaces
            arabicText = arabicText.trim();
            transText = transText.trim();

            let surahName = `Surah ${surahNum}`;
            if (typeof window.getSurahName === 'function') {
                surahName = window.getSurahName(surahNum);
                const parts = surahName.split(' ');
                if (parts.length > 1 && !isNaN(parts[0])) parts.shift();
                surahName = "Surah " + parts.join(' ');
            }

            const url = `${window.location.origin}${window.location.pathname}#s=${surahNum}&v=${start}-${end}`;
            const ref = `${surahName} : ${start}-${end} | Thematic Quran`;

            const payload = `${arabicText}\n\n${transText}\n\n${ref}\n${url}`;

            navigator.clipboard.writeText(payload);

            if (window.showToast) window.showToast('Text copied', 'content_copy');
        };

        const bookmarkBtn = document.createElement('button');
        bookmarkBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition bookmark-toggle-btn";
        bookmarkBtn.setAttribute('aria-label', `Bookmark`);
        bookmarkBtn.dataset.surah = surahNum;
        bookmarkBtn.dataset.start = start;
        bookmarkBtn.dataset.end = end;
        
        const isSaved = window.isBookmarked && window.isBookmarked(surahNum, start, end);
        bookmarkBtn.innerHTML = `<span class="material-symbols-outlined text-xl" aria-hidden="true">${isSaved ? 'bookmark' : 'bookmark_border'}</span>`;
        if (isSaved) {
            bookmarkBtn.style.color = '#56A3A6';
            bookmarkBtn.classList.remove('text-white/40');
        }
        
        bookmarkBtn.onclick = (e) => {
            e.stopPropagation();
            if (window.toggleBookmark) {
                const nowSaved = window.toggleBookmark(surahNum, start, end, data);
                bookmarkBtn.innerHTML = `<span class="material-symbols-outlined text-xl" aria-hidden="true">${nowSaved ? 'bookmark' : 'bookmark_border'}</span>`;
                if (nowSaved) {
                    bookmarkBtn.style.color = '#56A3A6';
                    bookmarkBtn.classList.remove('text-white/40');
                } else {
                    bookmarkBtn.style.color = '';
                    bookmarkBtn.classList.add('text-white/40');
                }
            }
        };

        const downloadBtn = document.createElement('button');
        downloadBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition";
        downloadBtn.setAttribute('aria-label', `Export`);
        downloadBtn.innerHTML = '<span class="material-symbols-outlined text-xl" aria-hidden="true">download</span>';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            openDownloadModal(card, surahNum, start, end, data);
        };

        const playBtn = document.createElement('button');
        playBtn.className = "play-btn ml-2 w-10 h-10 rounded-full bg-[#56A3A6] hover:bg-[#458a8d] text-white flex items-center justify-center transition-colors shadow-md";
        playBtn.setAttribute('aria-label', `Play`);
        playBtn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>';
        playBtn.onclick = (e) => handleCardPlayClick(card, surahNum, start, end);

        actionsDiv.appendChild(bookmarkBtn);
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

function openDownloadModal(card, surah, start, end, data) {
    const modal = document.getElementById('downloadModal');
    if (!modal) return;

    document.getElementById('dlModalTitle').textContent = `Export Surah ${surah}: ${start}-${end}`;

    const warningEl = document.getElementById('vidModalWarning');
    if (warningEl) {
        if (card && card.scrollHeight > 1000) {
            warningEl.classList.remove('hidden');
        } else {
            warningEl.classList.add('hidden');
        }
    }

    const reciterSelect = document.getElementById('reciterSelect');
    const langSelect = document.getElementById('languageSelect');
    const dlReciterSelect = document.getElementById('dlModalReciterSelect');
    const dlLangSelect = document.getElementById('dlModalLangSelect');
    const vidPaceSelect = document.getElementById('vidModalPaceSelect');

    if (dlReciterSelect) { dlReciterSelect.innerHTML = reciterSelect.innerHTML; dlReciterSelect.value = reciterSelect.value; }
    if (dlLangSelect) { dlLangSelect.innerHTML = langSelect.innerHTML; dlLangSelect.value = langSelect.value; }

    document.getElementById('dlProgressContainer').classList.add('hidden');
    document.getElementById('dlConfirmBtn').style.display = 'flex';
    document.getElementById('vidConfirmBtn').style.display = 'flex';
    
    modal.classList.remove('hidden');

    // Audio Download Logic
    document.getElementById('dlConfirmBtn').onclick = () => {
        document.getElementById('dlProgressContainer').classList.remove('hidden');
        document.getElementById('dlConfirmBtn').style.display = 'none';
        document.getElementById('vidConfirmBtn').style.display = 'none';
        
        const finalReciter = dlReciterSelect ? dlReciterSelect.value : reciterSelect.value;
        const finalLang = dlLangSelect ? dlLangSelect.value : langSelect.value;
        
        const surahSelect = document.getElementById('surahSelect');
        let surahName = `Surah ${surah}`;
        if (surahSelect) {
            const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === surah);
            if (option) surahName = option.text;
        }

        if (typeof downloadGroupedSection === 'function') {
            downloadGroupedSection(surah, start, end, finalReciter, finalLang, surahName).finally(() => {
                closeDownloadModal();
            });
        }
    };

    // Video Export Logic
    document.getElementById('vidConfirmBtn').onclick = () => {
        closeDownloadModal();
        if (window.VideoExporter) {
            if (window.VideoExporter.isExporting) {
                if (window.showToast) window.showToast('Already exporting a video.', 'warning');
                return;
            }
            const finalReciter = dlReciterSelect ? dlReciterSelect.value : reciterSelect.value;
            const finalLang = dlLangSelect ? dlLangSelect.value : langSelect.value;
            const finalPace = vidPaceSelect ? parseFloat(vidPaceSelect.value) : 1.0;

            window.VideoExporter.exportCardToVideo(card, surah, start, end, data, finalReciter, finalLang, finalPace);
        } else {
            if (window.showToast) window.showToast('Video Exporter not loaded.', 'error');
        }
    };

    document.getElementById('dlCancelBtn').onclick = closeDownloadModal;
}

function closeDownloadModal() { 
    const modal = document.getElementById('downloadModal');
    if (modal) modal.classList.add('hidden'); 
}

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
// --- WELCOME PAGE RENDERER ---
// --- WELCOME PAGE RENDERER ---
const WELCOME_PAGE_HTML = `
    <!-- STATIC WELCOME PAGE (SEO OPTIMIZED) -->
    <div id="staticWelcomeContent" class="py-8 md:py-16 animate-fade-in">
        
        <!-- HERO SECTION -->
        <div class="text-center mb-16">
            <div class="inline-flex items-center justify-center gap-2 px-3 py-1 bg-[#56A3A6]/10 border border-[#56A3A6]/30 rounded-full mb-6">
                <span class="material-symbols-outlined text-[#56A3A6] text-sm">headphones</span>
                <span class="text-[#56A3A6] text-xs font-bold uppercase tracking-wider">Audio Experience</span>
            </div>
            <h1 class="text-4xl md:text-6xl font-['Forum'] text-white tracking-widest drop-shadow-2xl mb-4 uppercase">
                THEMATIC QUR’AN</h1>
            <p class="text-white/60 font-['Nunito'] text-sm md:text-base uppercase tracking-[0.3em]">LISTEN &bull; REFLECT &bull; UNDERSTAND</p>
        </div>

        <!-- HERO COPY -->
        <div class="space-y-6 text-[#F3E4CE] font-['Nunito'] leading-relaxed text-lg md:text-xl text-center max-w-2xl mx-auto mb-16">
            <p class="font-bold text-white/90 text-xl md:text-2xl">
                The Qur’an is meant to be recited and understood.
            </p>
            <p>
                Thematic Qur’an is a guided Qur’an audio experience that pairs beautiful Arabic recitation with clear English narration, based on Talal Itani’s translation — so you can follow the meaning without breaking your focus.
            </p>
            <p>
                Ayahs are grouped into connected listening journeys, bringing verses together in a way that helps you understand both the <span class="text-[#56A3A6] font-bold">meaning</span> and the <span class="text-[#56A3A6] font-bold">context</span> of what you’re hearing.
            </p>
            <div class="w-24 h-px bg-white/10 mx-auto mt-8"></div>
            <p class="text-sm text-white/40 uppercase tracking-widest mt-4">Listen in short sessions. Reflect at your own pace.</p>
        </div>

        <!-- CTA -->
        <div class="text-center mb-20">
            <button onclick="document.dispatchEvent(new CustomEvent('start-listening'))"
                class="bg-[#56A3A6] text-white px-10 py-4 rounded-full font-bold hover:bg-[#458a8d] transition shadow-[0_0_20px_rgba(86,163,166,0.2)] hover:shadow-[0_0_30px_rgba(86,163,166,0.4)] hover:scale-105 active:scale-95 text-lg cursor-pointer mb-6" aria-label="Start Listening to Thematic Quran">
                Start Listening
            </button>
            <!-- Podcast Affiliation Tag -->
            <div class="mb-6 flex items-center justify-center gap-2 text-white/50 text-xs uppercase tracking-widest font-bold">
                <span class="material-symbols-outlined text-sm">podcasts</span>
                The official web companion to the Thematic Qur'an Podcast
            </div>
            <a href="#howItWorks" class="text-xs text-white/40 hover:text-[#56A3A6] transition border-b border-transparent hover:border-[#56A3A6] pb-0.5 uppercase tracking-wider">How it works</a>
        </div>

        <!-- FEATURE CARDS -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 border-t border-white/10 pt-16 mb-20">
            <div class="bg-white/5 p-6 rounded-2xl text-center hover:bg-white/10 transition duration-300 group">
                <span class="material-symbols-outlined text-[#56A3A6] text-4xl mb-3 group-hover:scale-110 transition-transform">record_voice_over</span>
                <h3 class="font-bold text-white mb-2 text-sm md:text-base">Custom Narration</h3>
                <p class="text-xs text-white/60">Clear, paced English narration.</p>
            </div>
            <div class="bg-white/5 p-6 rounded-2xl text-center hover:bg-white/10 transition duration-300 group">
                <span class="material-symbols-outlined text-[#56A3A6] text-4xl mb-3 group-hover:scale-110 transition-transform">segment</span>
                <h3 class="font-bold text-white mb-2 text-sm md:text-base">Curated Listening</h3>
                <p class="text-xs text-white/60">Ayahs grouped for meaning and context.</p>
            </div>
            <div class="bg-white/5 p-6 rounded-2xl text-center hover:bg-white/10 transition duration-300 group">
                <span class="material-symbols-outlined text-[#56A3A6] text-4xl mb-3 group-hover:scale-110 transition-transform">graphic_eq</span>
                <h3 class="font-bold text-white mb-2 text-sm md:text-base">Synced Audio</h3>
                <p class="text-xs text-white/60">Seamless Arabic recitation + English meaning.</p>
            </div>
            <div class="bg-white/5 p-6 rounded-2xl text-center hover:bg-white/10 transition duration-300 group">
                <span class="material-symbols-outlined text-[#56A3A6] text-4xl mb-3 group-hover:scale-110 transition-transform">tune</span>
                <h3 class="font-bold text-white mb-2 text-sm md:text-base">Custom Mixes</h3>
                <p class="text-xs text-white/60">Create your own compilations.</p>
            </div>
        </div>

        <!-- HOW IT WORKS -->
        <div id="howItWorks" class="max-w-2xl mx-auto mb-20 pt-10">
            <h2 class="text-2xl md:text-3xl font-['Forum'] text-white text-center mb-10 tracking-wider">How it works</h2>
            <div class="space-y-4">
                <div class="flex items-center gap-6 p-4 rounded-xl hover:bg-white/5 transition">
                    <span class="flex-shrink-0 w-10 h-10 rounded-full bg-[#56A3A6]/20 text-[#56A3A6] flex items-center justify-center font-bold">1</span>
                    <p class="text-[#F3E4CE] text-lg">Press play</p>
                </div>
                <div class="flex items-center gap-6 p-4 rounded-xl hover:bg-white/5 transition">
                    <span class="flex-shrink-0 w-10 h-10 rounded-full bg-[#56A3A6]/20 text-[#56A3A6] flex items-center justify-center font-bold">2</span>
                    <p class="text-[#F3E4CE] text-lg">Listen to the Arabic recitation</p>
                </div>
                <div class="flex items-center gap-6 p-4 rounded-xl hover:bg-white/5 transition">
                    <span class="flex-shrink-0 w-10 h-10 rounded-full bg-[#56A3A6]/20 text-[#56A3A6] flex items-center justify-center font-bold">3</span>
                    <p class="text-[#F3E4CE] text-lg">Follow the English narration</p>
                </div>
                <div class="flex items-center gap-6 p-4 rounded-xl hover:bg-white/5 transition">
                    <span class="flex-shrink-0 w-10 h-10 rounded-full bg-[#56A3A6]/20 text-[#56A3A6] flex items-center justify-center font-bold">4</span>
                    <p class="text-[#F3E4CE] text-lg">Finish with a clearer understanding of meaning and context</p>
                </div>
            </div>
        </div>

        <!-- FAQ -->
        <div class="max-w-2xl mx-auto border-t border-white/10 pt-16">
            <h2 class="text-2xl md:text-3xl font-['Forum'] text-white text-center mb-10 tracking-wider">FAQ</h2>
            <div class="space-y-4">
                <details class="group bg-white/5 rounded-xl border border-white/5 open:bg-white/10 transition-all duration-300">
                    <summary class="flex justify-between items-center p-6 cursor-pointer list-none">
                        <span class="font-bold text-[#F3E4CE]">What is Thematic Qur’an?</span>
                        <span class="material-symbols-outlined text-[#56A3A6] transform group-open:rotate-180 transition-transform">expand_more</span>
                    </summary>
                    <div class="px-6 pb-6 text-white/70 leading-relaxed text-sm">
                        <p class="mb-2">Thematic Qur'an is an audio experience designed to provide a foundational understanding of the Qur'an's message. While many resources offer deep dives into grammatical nuances or legal specificities, the first step should always be understanding the core guidance in its proper context.</p>
                        <p>By grouping verses thematically and ensuring you hear the connection between a verse and those before and after it, this project gives listeners a clear overview of the translation. Once this foundational "scaffold" of understanding is built, it provides the perfect platform to progress into deeper, more nuanced studies supported by other platforms.</p>
                    </div>
                </details>
                <details class="group bg-white/5 rounded-xl border border-white/5 open:bg-white/10 transition-all duration-300">
                    <summary class="flex justify-between items-center p-6 cursor-pointer list-none">
                        <span class="font-bold text-[#F3E4CE]">Which English translation is used?</span>
                        <span class="material-symbols-outlined text-[#56A3A6] transform group-open:rotate-180 transition-transform">expand_more</span>
                    </summary>
                    <div class="px-6 pb-6 text-white/70 leading-relaxed text-sm">
                        English narration is based on Talal Itani’s translation.
                    </div>
                </details>
                <details class="group bg-white/5 rounded-xl border border-white/5 open:bg-white/10 transition-all duration-300">
                    <summary class="flex justify-between items-center p-6 cursor-pointer list-none">
                        <span class="font-bold text-[#F3E4CE]">How are ayahs arranged?</span>
                        <span class="material-symbols-outlined text-[#56A3A6] transform group-open:rotate-180 transition-transform">expand_more</span>
                    </summary>
                    <div class="px-6 pb-6 text-white/70 leading-relaxed text-sm">
                        <p class="mb-2">Ayahs are grouped into connected sequences to help listeners follow meaning and context without interruption.</p>
                        <p>Our methodology for thematic grouping takes structural inspiration from renowned scholars, particularly the work of <strong>M.A.S. Abdel Haleem</strong> and <strong>The Clear Quran</strong> by Dr. Mustafa Khattab, ensuring a logical and authentic narrative flow.</p>
                    </div>
                </details>
                <details class="group bg-white/5 rounded-xl border border-white/5 open:bg-white/10 transition-all duration-300">
                    <summary class="flex justify-between items-center p-6 cursor-pointer list-none">
                        <span class="font-bold text-[#F3E4CE]">How do I know I can trust this?</span>
                        <span class="material-symbols-outlined text-[#56A3A6] transform group-open:rotate-180 transition-transform">expand_more</span>
                    </summary>
                    <div class="px-6 pb-6 text-white/70 leading-relaxed text-sm">
                        <p>We rely strictly on established and authentic Quran translations. The English narration utilizes the translation by Talal Itani, while the structural pacing draws from widely acclaimed academic sources. We do not invent new translations or exegeses; we simply curate the audio presentation to make the timeless message of the Qur'an more accessible for daily reflection and Tadabbur.</p>
                    </div>
                </details>
                <details class="group bg-white/5 rounded-xl border border-white/5 open:bg-white/10 transition-all duration-300">
                    <summary class="flex justify-between items-center p-6 cursor-pointer list-none">
                        <span class="font-bold text-[#F3E4CE]">Can I use this for deep study and Tafseer?</span>
                        <span class="material-symbols-outlined text-[#56A3A6] transform group-open:rotate-180 transition-transform">expand_more</span>
                    </summary>
                    <div class="px-6 pb-6 text-white/70 leading-relaxed text-sm">
                        <p>Thematic Qur’an is designed as a companion tool to build foundational familiarity, flow, and Tadabbur (deep reflection). While it is an excellent starting point, users seeking profound legal (Fiqh) or detailed theological understanding should consult classical Tafseer volumes and qualified Islamic scholars.</p>
                    </div>
                </details>
            </div>
        </div>

    </div>
`;

window.renderWelcomePage = function () {
    const container = document.getElementById('contentArea');

    // Adjust Spacer for Welcome Page
    const spacer = document.getElementById('mainSpacer');
    if (spacer) {
        spacer.className = "w-full h-[160px] md:h-[180px] shrink-0 transition-all duration-300";
    }

    // Prefer the captured HTML if valid (non-empty), otherwise use hardcoded fallback
    let contentToRender = window.STATIC_WELCOME_HTML && window.STATIC_WELCOME_HTML.trim().length > 100
        ? window.STATIC_WELCOME_HTML
        : WELCOME_PAGE_HTML;

    container.innerHTML = contentToRender;

    document.title = "Thematic Qur’an Audio | Listen, Reflect & Understand";

    // Reset Player UI
    if (typeof resetPlayerState === 'function') resetPlayerState();
    const verseText = document.getElementById('playerVerse');
    if (verseText) verseText.textContent = "Select a Surah to begin";
};
