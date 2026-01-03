const UI_KEYS = {
    SURAH_NO: 'surah_no',
    AYAH_NO: 'ayah_no_surah',
    ARABIC: 'ayah_ar',
    ENGLISH: 'ayah_en',
    URDU: 'urdu_translation'
};

/**
 * Renders a Single Surah (Standard Mode)
 */
function renderThematicSurah(surahNum, verses, breaks) {
    const container = document.getElementById('contentArea');
    container.innerHTML = ''; 
    const lastVerseNum = verses.length > 0 ? verses[verses.length - 1][UI_KEYS.AYAH_NO] : 0;

    // Spacer
    const spacer = document.getElementById('mainSpacer');
    if (spacer) {
        if (surahNum === 9) {
            spacer.className = "w-full h-[130px] md:h-[180px] shrink-0 transition-all duration-300";
        } else {
            spacer.className = "w-full h-[150px] md:h-[160px] shrink-0 transition-all duration-300";
        }
    }

    // --- BISMILLAH HEADER (Visual Only) ---
    // LOGIC: Hide for Surah 9 (Tawbah) AND Surah 1 (Fatihah)
    if (surahNum !== 9 && surahNum !== 1) {
        const bismillahDiv = document.createElement('div');
        bismillahDiv.className = "text-center mb-10 opacity-90 transition-opacity select-none";
        
        const fontSelect = document.getElementById('fontSelect');
        const currentFontClass = fontSelect ? fontSelect.value : 'font-amiri';
        const scale = (typeof currentFontScale !== 'undefined') ? currentFontScale : 1.0;
        bismillahDiv.style.fontSize = `calc(2.0rem * ${scale})`;
        
        bismillahDiv.innerHTML = `<span class="${currentFontClass} text-3xl md:text-3xl text-white">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>`;
        
        container.appendChild(bismillahDiv);
    }

    // Sections
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

/**
 * Renders a Juz (Juz Mode)
 */
function renderThematicJuz(juzId, verses, allBreaks) {
    const container = document.getElementById('contentArea');
    container.innerHTML = '';

    // Adjust spacer for Juz mode
    const spacer = document.getElementById('mainSpacer');
    if (spacer) spacer.className = "w-full h-[100px] shrink-0 transition-all duration-300";

    // Add Juz Title
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
        
        // 1. CHECK FOR NEW SURAH
        if (surah !== currentSurah) {
            // Close previous section if exists
            if (currentSectionData.length > 0) {
                const endVerse = currentSectionData[currentSectionData.length - 1][UI_KEYS.AYAH_NO];
                container.appendChild(createCard(currentSurah, sectionStartVerse, endVerse, currentSectionData));
                currentSectionData = [];
            }

            // Inject Mini Header
            const latinName = verse['surah_name_roman'] || "";
            const engName = verse['surah_name_en'] || "";
            container.appendChild(createMiniSurahHeader(surah, latinName, engName));

            currentSurah = surah;
            sectionStartVerse = verseNum;
        }

        // 2. CHECK FOR THEME BREAK
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

    // Close final section
    if (currentSectionData.length > 0) {
        const endVerse = currentSectionData[currentSectionData.length - 1][UI_KEYS.AYAH_NO];
        container.appendChild(createCard(currentSurah, sectionStartVerse, endVerse, currentSectionData));
    }
}

/**
 * Helper to draw headers inside the list
 */
function createMiniSurahHeader(surahNum, latinName, engName) {
    const container = document.createElement('div');
    container.className = "surah-mini-header mt-16 mb-8 text-center border-t border-white/10 pt-10";

    // 1. Surah Name
    const title = document.createElement('h2');
    title.className = "text-2xl font-bold text-[#56A3A6] font-['Nunito'] mb-6";
    
    // Format: "78. An-Naba (The Tidings)"
    let displayText = `${surahNum}. `;
    if (latinName && engName) {
        displayText += `${latinName} (${engName})`;
    } else if (latinName) {
        displayText += latinName;
    } else {
        displayText += `Surah ${surahNum}`;
    }

    title.textContent = displayText;
    container.appendChild(title);

    // 2. Bismillah (Unless Surah 9 or 1)
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
    
    // Scroll margin top set to 20px so it aligns near the top of the viewport
    const baseClass = "thematic-card relative bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-lg p-6 md:p-8 transition-all duration-300 mb-8 scroll-mt-[20px]";
    card.className = (typeof isEditMode !== 'undefined' && isEditMode) 
        ? baseClass + " border-dashed border-white/30" 
        : baseClass + " hover:bg-white/10";
        
    card.id = `section-${surahNum}-${start}`;
    card.dataset.surah = surahNum;
    card.dataset.start = start;
    card.dataset.end = end;

    // Selection Overlay
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

    // Header
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
        // Share Button
        const shareBtn = document.createElement('button');
        shareBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition";
        shareBtn.innerHTML = '<span class="material-symbols-outlined text-xl">link</span>';
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            const url = `${window.location.origin}${window.location.pathname}#s=${surahNum}&v=${start}-${end}`;
            
            const surahSelect = document.getElementById('surahSelect');
            let namePart = ""; 
            if(surahSelect) {
                const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === surahNum);
                if (option) namePart = option.text.replace(/^\d+\s+/, '');
            }
            if (!namePart) namePart = `Surah ${surahNum}`;
            
            const rangeText = (start === end) ? `Ayah ${start}` : `Ayah ${start} to ${end}`;
            const shareText = `Surah ${surahNum}: ${namePart} - ${rangeText}.\n${url}`;
            
            navigator.clipboard.writeText(shareText);
            if (window.showToast) window.showToast('Link & details copied', 'link');
        };

        const copyTextBtn = document.createElement('button');
        copyTextBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition";
        copyTextBtn.innerHTML = '<span class="material-symbols-outlined text-xl">content_copy</span>';
        copyTextBtn.onclick = (e) => {
            e.stopPropagation();
            let arabicText = "";
            let transText = "";
            const langSelect = document.getElementById('languageSelect');
            const langCode = langSelect ? langSelect.value : 'en';
            const transKey = (langCode === 'ur') ? UI_KEYS.URDU : UI_KEYS.ENGLISH;

            data.forEach(v => {
                arabicText += v[UI_KEYS.ARABIC] + " (" + v[UI_KEYS.AYAH_NO] + ") ";
                transText += "(" + v[UI_KEYS.AYAH_NO] + ") " + (v[transKey] || "") + " ";
            });
            const surahSelect = document.getElementById('surahSelect');
            let surahName = `Surah ${surahNum}`;
            if(surahSelect) {
                const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === surahNum);
                if (option) surahName = option.text;
            }
            const fullText = `${arabicText}\n\n${transText}\n\n${surahName} ${surahNum}:${start}-${end}\nThematicQuran.com`;
            navigator.clipboard.writeText(fullText);
            if (window.showToast) window.showToast('Text copied to clipboard', 'content_copy');
        };

        const downloadBtn = document.createElement('button');
        downloadBtn.className = "text-white/40 hover:text-[#56A3A6] p-2 transition";
        downloadBtn.innerHTML = '<span class="material-symbols-outlined text-xl">download</span>';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            openDownloadModal(surahNum, start, end);
        };

        const playBtn = document.createElement('button');
        playBtn.className = "play-btn ml-2 w-10 h-10 rounded-full bg-[#56A3A6] hover:bg-[#458a8d] text-white flex items-center justify-center transition-colors shadow-md";
        playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
        playBtn.onclick = (e) => {
            handleCardPlayClick(card, surahNum, start, end);
        };

        actionsDiv.appendChild(shareBtn);
        actionsDiv.appendChild(copyTextBtn);
        actionsDiv.appendChild(downloadBtn);
        actionsDiv.appendChild(playBtn);
    }

    header.innerHTML = titleHtml;
    header.appendChild(actionsDiv);

    // Arabic Text
    const fontSelect = document.getElementById('fontSelect');
    const currentFontClass = fontSelect ? fontSelect.value : 'font-amiri';
    const scale = (typeof currentFontScale !== 'undefined') ? currentFontScale : 1.0;

    const arabicDiv = document.createElement('div');
    arabicDiv.className = `${currentFontClass} text-right text-[#F3E4CE] mb-8 dir-rtl`;
    arabicDiv.style.fontSize = `calc(1.875rem * ${scale})`; 
    
    data.forEach(v => {
        const verseNum = v[UI_KEYS.AYAH_NO];
        const span = document.createElement('span');
        span.id = `ayah-ar-${surahNum}-${verseNum}`;
        let badgeHtml = `<span class="text-[#56A3A6] font-sans text-2xl mx-1">۝${verseNum}</span>`;
        if (typeof isEditMode !== 'undefined' && isEditMode) {
            span.className = "cursor-pointer transition hover:opacity-80";
            if (verseNum === start && verseNum !== 1) {
                badgeHtml = `<span class="text-red-400 font-sans text-2xl mx-1 border border-red-500/50 rounded px-1 bg-red-900/30">۝${verseNum}</span>`;
            } else if (verseNum !== 1) {
                badgeHtml = `<span class="text-green-400 font-sans text-2xl mx-1 border border-green-500/50 rounded px-1 bg-green-900/30">۝${verseNum}</span>`;
            }
            span.onclick = (e) => {
                e.stopPropagation();
                if(typeof window.handleVerseBreakToggle === 'function') {
                    window.handleVerseBreakToggle(surahNum, verseNum);
                }
            };
        } else {
            span.className = "verse-span";
            span.onclick = (e) => {
                e.stopPropagation();
                triggerVersePlay(card, surahNum, start, end, verseNum, 'arabic');
            };
        }
        span.innerHTML = `${v[UI_KEYS.ARABIC] || ""} ${badgeHtml} `;
        arabicDiv.appendChild(span);
    });

    // Translation Text
    const selectedLang = document.getElementById('languageSelect') ? document.getElementById('languageSelect').value : 'en';
    const isUrdu = selectedLang === 'ur';
    const textKey = isUrdu ? UI_KEYS.URDU : UI_KEYS.ENGLISH;

    const transDiv = document.createElement('div');
    transDiv.className = isUrdu 
        ? "font-urdu text-right leading-[2.2] text-white/90 dir-rtl" 
        : "font-['Nunito'] text-left leading-relaxed text-white/80 tracking-normal";
    transDiv.style.fontSize = `calc(1.25rem * ${scale})`;

    data.forEach(v => {
        const verseNum = v[UI_KEYS.AYAH_NO];
        const span = document.createElement('span');
        span.id = `ayah-en-${surahNum}-${verseNum}`;
        let badgeHtml = `<span class="align-super text-xs text-[#56A3A6] font-bold mx-1 font-['Nunito']">(${verseNum})</span>`;
        if (typeof isEditMode !== 'undefined' && isEditMode) {
            span.className = "cursor-pointer transition hover:opacity-80";
            if (verseNum === start && verseNum !== 1) {
                badgeHtml = `<span class="align-super text-xs text-red-300 font-bold mx-1 border border-red-500/50 rounded px-1 bg-red-900/30">(${verseNum})</span>`;
            } else if (verseNum !== 1) {
                badgeHtml = `<span class="align-super text-xs text-green-300 font-bold mx-1 border border-green-500/50 rounded px-1 bg-green-900/30">(${verseNum})</span>`;
            }
            span.onclick = (e) => {
                e.stopPropagation();
                if(typeof window.handleVerseBreakToggle === 'function') {
                    window.handleVerseBreakToggle(surahNum, verseNum);
                }
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

// --- HELPER FUNCTIONS ---

function handleCardPlayClick(card, surah, start, end) {
    document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
    card.classList.add('ring-2', 'ring-[#56A3A6]');
    
    const autoToggle = document.getElementById('autoAdvanceToggle');
    if (autoToggle) autoToggle.checked = true;

    if (typeof playSession === 'function') {
        playSession(surah, start, end);
    }

    document.dispatchEvent(new CustomEvent('manual-play-started', { detail: { card: card } }));
}

function triggerVersePlay(card, surah, start, end, verseNum, type) {
    document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
    card.classList.add('ring-2', 'ring-[#56A3A6]');

    // CHANGED: Use playRange (which now supports targeting) to play rest of section
    if (typeof playRange === 'function') {
        playRange(surah, start, end, verseNum, type);
    }
    
    document.dispatchEvent(new CustomEvent('manual-play-started', { detail: { card: card } }));
}

function openDownloadModal(surah, start, end) {
    const modal = document.getElementById('downloadModal');
    const reciterSelect = document.getElementById('reciterSelect');
    const langSelect = document.getElementById('languageSelect');
    const surahSelect = document.getElementById('surahSelect');
    
    const reciterName = reciterSelect.options[reciterSelect.selectedIndex].text;
    const langName = langSelect.options[langSelect.selectedIndex].text;
    
    let surahName = `Surah ${surah}`;
    const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === surah);
    if(option) surahName = option.text;

    document.getElementById('dlModalTitle').textContent = `Surah ${surah}: Verses ${start}-${end}`;
    document.getElementById('dlModalReciter').textContent = reciterName;
    document.getElementById('dlModalLang').textContent = langName;
    
    document.getElementById('dlProgressContainer').classList.add('hidden');
    document.getElementById('dlConfirmBtn').style.display = 'block';
    
    modal.classList.remove('hidden');

    document.getElementById('dlConfirmBtn').onclick = () => {
        document.getElementById('dlProgressContainer').classList.remove('hidden');
        document.getElementById('dlConfirmBtn').style.display = 'none';
        
        const reciterSlug = reciterSelect.value;
        const langCode = langSelect.value;
        
        if (typeof downloadGroupedSection === 'function') {
            downloadGroupedSection(surah, start, end, reciterSlug, langCode, surahName);
        }
    };

    document.getElementById('dlCancelBtn').onclick = closeDownloadModal;
}

function closeDownloadModal() {
    document.getElementById('downloadModal').classList.add('hidden');
}

window.highlightActiveVerseUI = function(surah, verse, type) {
    // 1. Remove old highlight
    document.querySelectorAll('.active-verse').forEach(el => el.classList.remove('active-verse'));
    
    // 2. Add new highlight
    const prefix = (type === 'arabic') ? 'ayah-ar' : 'ayah-en';
    const id = `${prefix}-${surah}-${verse}`;
    const el = document.getElementById(id);
    
    if (el) {
        el.classList.add('active-verse');

        // 3. Smart Scroll Check
        const rect = el.getBoundingClientRect();
        const mainContainer = document.getElementById('mainContainer');
        const containerRect = mainContainer.getBoundingClientRect();

        // Check if element is outside the comfortable middle view
        const isAbove = rect.top < (containerRect.top + 100); // 100px buffer for header
        const isBelow = rect.bottom > (containerRect.bottom - 100); // 100px buffer for footer

        if (isAbove || isBelow) {
            el.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
}

function setSelectionMode(isActive) {
    const cards = document.querySelectorAll('.thematic-card');
    cards.forEach(card => {
        const overlay = card.querySelector('.selection-overlay');
        const actions = card.querySelector('.flex.items-center.gap-2'); 
        if (isActive) {
            card.classList.add('scale-95', 'cursor-pointer'); 
            card.classList.remove('hover:bg-white/10');
            overlay.classList.remove('hidden');
            overlay.classList.add('opacity-30'); 
            actions.style.opacity = '0'; 
            actions.style.pointerEvents = 'none';
        } else {
            card.classList.remove('scale-95', 'cursor-pointer', 'ring-4', 'ring-[#56A3A6]', 'opacity-40', 'pointer-events-none', 'grayscale');
            card.classList.add('hover:bg-white/10');
            overlay.classList.add('hidden');
            overlay.classList.remove('opacity-30', 'opacity-100');
            actions.style.opacity = '1';
            actions.style.pointerEvents = 'auto';
        }
    });
}

// --- GLOBAL TOAST SYSTEM ---
window.showToast = function(message, icon = 'info') {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="material-symbols-outlined text-[#56A3A6]">${icon}</span> ${message}`;
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.remove('toast-visible');
    }, 3000);
};