// js/app.js

// --- VERSION DEBUGGER ---
console.log("THEMATIC QURAN - VERSION 2"); 

const CONSTANTS = {
    KEY_SURAH_NO: 'surah_no',
    KEY_AYAH_NO: 'ayah_no_surah',
    KEY_ARABIC: 'ayah_ar',
    KEY_ENGLISH: 'ayah_en',
    KEY_URDU: 'urdu_translation',
    KEY_SURAH_MEANING: 'surah_name_en',
    KEY_SURAH_LATIN: 'surah_name_roman'
};

// Global State
let QURAN_DATA = [];
let THEME_BREAKS = {};

// Settings State
let currentFontScale = 1.0; 
let isEditMode = false;
let currentViewMode = 'surah'; 

// Selection State
let isSelectMode = false;
let selectedItems = new Set(); 
const MAX_SELECTION = 3; 

const STORAGE_KEY_SCALE = 'fontScale_v2'; 

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Initializing App...");
    
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') {
            e.preventDefault(); 
            const playBtn = document.getElementById('globalPlayPauseBtn');
            if (playBtn) playBtn.click();
        }
        if (e.code === 'ArrowRight') {
            e.preventDefault();
            navigateSection('next');
        }
        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            navigateSection('prev');
        }
    });

    let deferredPrompt;
    const installContainer = document.getElementById('installAppContainer');
    const installBtn = document.getElementById('installAppBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installContainer) installContainer.classList.remove('hidden');
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            installContainer.classList.add('hidden');
        });
    }

    const mainContainer = document.getElementById('mainContainer');
    const header = document.getElementById('mainHeader');
    let lastScrollY = 0;

    mainContainer.addEventListener('scroll', () => {
        const currentScrollY = mainContainer.scrollTop;
        if (currentScrollY > 100) {
            if (currentScrollY > lastScrollY) {
                header.classList.add('header-hidden');
            } else {
                header.classList.remove('header-hidden');
            }
        } else {
            header.classList.remove('header-hidden');
        }
        lastScrollY = currentScrollY;
    });

    loadPreferences();

    try {
        const [qResponse, bResponse] = await Promise.all([
            fetch('data/quran_data.json'),
            fetch('data/theme_breaks.json')
        ]);

        if (!qResponse.ok || !bResponse.ok) throw new Error("Could not load data files.");

        QURAN_DATA = await qResponse.json();
        THEME_BREAKS = await bResponse.json();

        setupGlobalEventListeners();

        if (window.location.hash) {
            handleDeepLink();
        } else {
            const savedMode = localStorage.getItem('viewMode');
            if (savedMode) currentViewMode = savedMode;
            
            const viewSelect = document.getElementById('viewModeSelect');
            if(viewSelect) viewSelect.value = currentViewMode;
            
            populateDropdown();

            const savedId = localStorage.getItem('lastContentId') || "1";
            document.getElementById('surahSelect').value = savedId;
            loadContent(parseInt(savedId));
        }

        document.getElementById('loadingMessage').classList.add('hidden');
        document.getElementById('contentArea').classList.remove('hidden');

    } catch (error) {
        console.error("Initialization Error:", error);
        document.getElementById('loadingMessage').textContent = "Error loading data. See console.";
    }
});

function loadPreferences() {
    const savedFont = localStorage.getItem('arabicFont');
    if (savedFont) {
        const fontSelect = document.getElementById('fontSelect');
        if(fontSelect) fontSelect.value = savedFont;
    }
    const savedScale = localStorage.getItem(STORAGE_KEY_SCALE);
    if (savedScale) {
        currentFontScale = parseFloat(savedScale);
    } else {
        if (window.innerWidth < 768) {
            currentFontScale = 0.7; 
        } else {
            currentFontScale = 1.0; 
        }
    }
    updateFontDisplay();
}

function updateFontDisplay() {
    const display = document.getElementById('fontSizeDisplay');
    if(display) {
        display.textContent = Math.round(currentFontScale * 100) + '%';
    }
}

function populateDropdown() {
    const select = document.getElementById('surahSelect');
    select.innerHTML = ''; 

    if (currentViewMode === 'juz') {
        for (let i = 1; i <= 30; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Juz ${i}`;
            select.appendChild(option);
        }
    } else {
        const uniqueSurahs = new Map();
        QURAN_DATA.forEach(row => {
            const num = row[CONSTANTS.KEY_SURAH_NO];
            if (!uniqueSurahs.has(num)) {
                uniqueSurahs.set(num, {
                    meaning: row[CONSTANTS.KEY_SURAH_MEANING],
                    latin: row[CONSTANTS.KEY_SURAH_LATIN]
                });
            }
        });

        uniqueSurahs.forEach((info, num) => {
            const option = document.createElement('option');
            option.value = num;
            const paddedNum = String(num).padStart(2, '0');
            let text = `${paddedNum} `;
            if (info.latin) {
                text += `${info.latin} (${info.meaning})`;
            } else {
                text += info.meaning; 
            }
            option.textContent = text;
            select.appendChild(option);
        });
    }
}

function resetPlayerState() {
    if (typeof stopAllAudio === 'function') stopAllAudio();
    const playBtn = document.getElementById('globalPlayPauseBtn');
    const status = document.getElementById('playerStatus');
    const progressBar = document.getElementById('progressBar');
    const currentTime = document.getElementById('currentTime');

    if (playBtn) playBtn.innerHTML = '<span class="material-symbols-outlined text-5xl">play_arrow</span>';
    if (status) status.textContent = "Ready to Play";
    if (progressBar) progressBar.style.width = '0%';
    if (currentTime) currentTime.textContent = "0:00";
    
    document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
    document.querySelectorAll('.active-verse').forEach(el => el.classList.remove('active-verse'));
}

function loadContent(id) {
    localStorage.setItem('lastContentId', id);
    if (currentViewMode === 'juz') {
        loadJuz(id);
    } else {
        loadSurah(id);
    }
}

function loadSurah(surahId) {
    resetPlayerState();
    if (isSelectMode) toggleSelectionModeUI(false);

    const surahVerses = QURAN_DATA.filter(row => row[CONSTANTS.KEY_SURAH_NO] === surahId);
    
    const customKey = `customBreaks_${surahId}`;
    const customData = localStorage.getItem(customKey);
    const restoreBtn = document.getElementById('restoreDefaultsBtn');
    let activeBreaks = [];

    if (customData) {
        activeBreaks = JSON.parse(customData);
        if (restoreBtn) restoreBtn.classList.remove('hidden');
    } else {
        activeBreaks = THEME_BREAKS[String(surahId)] || [];
        if (restoreBtn) restoreBtn.classList.add('hidden');
    }

    let cleanBreaks = activeBreaks.map(Number).filter(b => b < surahVerses.length).sort((a, b) => a - b);
    if (cleanBreaks.length === 0 || cleanBreaks[0] !== 1) {
        if(cleanBreaks[0] !== 1) cleanBreaks.unshift(1);
    }
    cleanBreaks = [...new Set(cleanBreaks)];

    const select = document.getElementById('surahSelect');
    let surahText = `Surah ${surahId}`;
    if (select.value == surahId && select.selectedIndex >= 0) {
        surahText = select.options[select.selectedIndex].text;
    }
    document.getElementById('playerVerse').textContent = surahText;

    renderThematicSurah(surahId, surahVerses, cleanBreaks);

    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) mainContainer.scrollTop = 0;

    setTimeout(() => {
        const firstCard = document.querySelector('.thematic-card');
        if (firstCard && typeof preloadNextSection === 'function') {
            const s = parseInt(firstCard.dataset.surah);
            const start = parseInt(firstCard.dataset.start);
            const end = parseInt(firstCard.dataset.end);
            console.log(`Preloading first section: ${s}:${start}-${end}`);
            preloadNextSection(s, start, end);
        }
    }, 100);
}

function loadJuz(juzId) {
    resetPlayerState();
    if (isSelectMode) toggleSelectionModeUI(false);

    if (typeof JUZ_META === 'undefined') {
        console.error("JUZ_META not loaded!");
        return;
    }
    const meta = JUZ_META.find(j => j.id === juzId);
    if (!meta) {
        console.error("Juz Data not found for ID:", juzId);
        return;
    }

    const juzVerses = QURAN_DATA.filter(row => {
        const s = row[CONSTANTS.KEY_SURAH_NO];
        const v = row[CONSTANTS.KEY_AYAH_NO];
        if (s > meta.start.s && s < meta.end.s) return true;
        if (s === meta.start.s) {
            if (meta.start.s === meta.end.s) return v >= meta.start.v && v <= meta.end.v;
            return v >= meta.start.v;
        }
        if (s === meta.end.s) return v <= meta.end.v;
        return false;
    });

    document.getElementById('playerVerse').textContent = `Juz ${juzId}`;

    renderThematicJuz(juzId, juzVerses, THEME_BREAKS);

    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) mainContainer.scrollTop = 0;

    setTimeout(() => {
        const firstCard = document.querySelector('.thematic-card');
        if (firstCard && typeof preloadNextSection === 'function') {
            const s = parseInt(firstCard.dataset.surah);
            const start = parseInt(firstCard.dataset.start);
            const end = parseInt(firstCard.dataset.end);
            preloadNextSection(s, start, end);
        }
    }, 100);
}

window.handleVerseBreakToggle = function(surahId, verseNum) {
    if (!isEditMode) return;
    if (currentViewMode === 'juz') {
        alert("Editing is only allowed in Surah Mode for now.");
        return;
    }
    const customKey = `customBreaks_${surahId}`;
    const surahVerses = QURAN_DATA.filter(row => row[CONSTANTS.KEY_SURAH_NO] === surahId);
    
    let currentBreaks = [];
    const saved = localStorage.getItem(customKey);
    if (saved) {
        currentBreaks = JSON.parse(saved);
    } else {
        let defaults = THEME_BREAKS[String(surahId)] || [];
        currentBreaks = defaults.map(Number).filter(b => b < surahVerses.length).sort((a, b) => a - b);
        if (currentBreaks.length === 0 || currentBreaks[0] !== 1) currentBreaks.unshift(1);
    }

    const index = currentBreaks.indexOf(verseNum);
    if (index !== -1) {
        if (verseNum !== 1) currentBreaks.splice(index, 1);
    } else {
        currentBreaks.push(verseNum);
    }
    currentBreaks.sort((a, b) => a - b);
    localStorage.setItem(customKey, JSON.stringify(currentBreaks));
    loadSurah(surahId);
};

function restoreDefaults() {
    const surahId = parseInt(document.getElementById('surahSelect').value);
    const customKey = `customBreaks_${surahId}`;
    localStorage.removeItem(customKey);
    loadSurah(surahId);
}

function handleDeepLink() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const surah = parseInt(params.get('s'));
    const verseParam = params.get('v') || "1";
    const verseStart = parseInt(verseParam.split('-')[0]);

    if (surah && !isNaN(surah)) {
        currentViewMode = 'surah';
        const viewSelect = document.getElementById('viewModeSelect');
        if(viewSelect) viewSelect.value = 'surah';
        populateDropdown();

        document.getElementById('surahSelect').value = surah;
        loadSurah(surah);
        
        setTimeout(() => {
            const cards = Array.from(document.querySelectorAll('.thematic-card'));
            const targetCard = cards.find(card => {
                const s = parseInt(card.dataset.start);
                const e = parseInt(card.dataset.end);
                return verseStart >= s && verseStart <= e;
            });
            if (targetCard) {
                scrollToCard(targetCard);
                targetCard.classList.add('ring-4', 'ring-[#56A3A6]/50');
                setTimeout(() => targetCard.classList.remove('ring-4', 'ring-[#56A3A6]/50'), 2000);
            }
        }, 500); 
    } else {
        loadContent(1);
    }
}

function setupGlobalEventListeners() {
    document.getElementById('surahSelect').addEventListener('change', (e) => {
        loadContent(parseInt(e.target.value));
    });

    const viewSelect = document.getElementById('viewModeSelect');
    if (viewSelect) {
        viewSelect.value = currentViewMode; 
        viewSelect.addEventListener('change', (e) => {
            currentViewMode = e.target.value; 
            localStorage.setItem('viewMode', currentViewMode);
            populateDropdown();
            document.getElementById('surahSelect').value = "1";
            loadContent(1);
        });
    }
    
    document.getElementById('languageSelect').addEventListener('change', () => {
        loadContent(parseInt(document.getElementById('surahSelect').value));
    });

    document.getElementById('fontSelect').addEventListener('change', (e) => {
        localStorage.setItem('arabicFont', e.target.value);
        loadContent(parseInt(document.getElementById('surahSelect').value));
    });

    document.getElementById('increaseFontBtn').addEventListener('click', () => {
        if (currentFontScale < 2.0) {
            currentFontScale += 0.1;
            localStorage.setItem(STORAGE_KEY_SCALE, currentFontScale);
            updateFontDisplay();
            loadContent(parseInt(document.getElementById('surahSelect').value));
        }
    });

    document.getElementById('decreaseFontBtn').addEventListener('click', () => {
        if (currentFontScale > 0.6) {
            currentFontScale -= 0.1;
            localStorage.setItem(STORAGE_KEY_SCALE, currentFontScale);
            updateFontDisplay();
            loadContent(parseInt(document.getElementById('surahSelect').value));
        }
    });

    const editToggle = document.getElementById('editModeToggle');
    editToggle.addEventListener('change', (e) => {
        isEditMode = e.target.checked;
        const banner = document.getElementById('editModeBanner');
        if (isEditMode) banner.classList.remove('hidden'); else banner.classList.add('hidden');
        loadContent(parseInt(document.getElementById('surahSelect').value));
    });

    document.getElementById('exitEditModeBtn').addEventListener('click', () => {
        isEditMode = false;
        document.getElementById('editModeBanner').classList.add('hidden');
        document.getElementById('editModeToggle').checked = false; 
        loadContent(parseInt(document.getElementById('surahSelect').value));
    });

    document.getElementById('restoreDefaultsBtn').addEventListener('click', restoreDefaults);

    const sidebar = document.getElementById('settingsSidebar');
    const backdrop = document.getElementById('settingsBackdrop');
    function openSettings() {
        backdrop.classList.remove('hidden');
        setTimeout(() => { backdrop.classList.remove('opacity-0'); sidebar.classList.remove('translate-x-full'); }, 10);
    }
    function closeSettings() {
        sidebar.classList.add('translate-x-full');
        backdrop.classList.add('opacity-0');
        setTimeout(() => { backdrop.classList.add('hidden'); }, 300); 
    }
    document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
    backdrop.addEventListener('click', closeSettings);

    const audio = document.getElementById('audioElement');
    document.getElementById('globalPlayPauseBtn').addEventListener('click', () => {
        if (typeof window.isPlayerActive === 'function' && window.isPlayerActive()) {
             playerTogglePlayPause();
        } else {
             const activeCard = document.querySelector('.thematic-card.ring-2');
             if (activeCard) {
                 activeCard.querySelector('.play-btn').click();
             } else {
                 const firstCard = document.querySelector('.thematic-card');
                 if (firstCard) {
                     document.getElementById('autoAdvanceToggle').checked = true;
                     firstCard.querySelector('.play-btn').click();
                 }
             }
        }
    });
    if (audio) {
        audio.addEventListener('play', () => toggleWakeLock(true));
        audio.addEventListener('pause', () => toggleWakeLock(false));
        audio.addEventListener('ended', () => toggleWakeLock(false));
    }

    document.getElementById('nextSectionBtn').addEventListener('click', () => navigateSection('next'));
    document.getElementById('prevSectionBtn').addEventListener('click', () => navigateSection('prev'));
    document.addEventListener('section-ended', () => {
        if (document.getElementById('autoAdvanceToggle').checked) navigateSection('next');
    });

    document.addEventListener('manual-play-started', (e) => triggerLookAheadPreload(e.detail.card));
    document.addEventListener('verse-changed', (e) => {
        const { surah, verse, type } = e.detail;
        if (typeof window.highlightActiveVerseUI === 'function') {
            window.highlightActiveVerseUI(surah, verse, type);
        }
    });

    document.getElementById('toggleSelectModeBtn').addEventListener('click', () => {
        isSelectMode = !isSelectMode;
        toggleSelectionModeUI(isSelectMode);
    });

    document.getElementById('exitSelectModeBtn').addEventListener('click', () => {
        toggleSelectionModeUI(false);
    });

    document.addEventListener('card-toggle-select', (e) => {
        const card = e.detail.card;
        const id = card.id;

        if (selectedItems.has(id)) {
            selectedItems.delete(id);
            card.querySelector('.selection-overlay').classList.remove('opacity-100', 'bg-[#56A3A6]/20');
            card.querySelector('.selection-overlay').classList.add('opacity-30');
            card.classList.remove('ring-4', 'ring-[#56A3A6]');
        } else {
            if (selectedItems.size >= MAX_SELECTION) return; 
            if (!isValidSelection(id)) return;
            selectedItems.add(id);
            card.querySelector('.selection-overlay').classList.remove('opacity-30');
            card.querySelector('.selection-overlay').classList.add('opacity-100', 'bg-[#56A3A6]/20');
            card.classList.add('ring-4', 'ring-[#56A3A6]');
        }
        enforceConsecutiveSelection();
        updateBulkBar();
    });

    document.getElementById('btnDownloadBulk').addEventListener('click', () => {
        const sectionsToDownload = Array.from(selectedItems).map(id => {
            const card = document.getElementById(id);
            return {
                surah: parseInt(card.dataset.surah),
                start: parseInt(card.dataset.start),
                end: parseInt(card.dataset.end)
            };
        });
        sectionsToDownload.sort((a, b) => a.start - b.start);
        openBulkDownloadModal(sectionsToDownload);
    });
}

function isValidSelection(targetId) {
    if (selectedItems.size === 0) return true;
    const allCards = Array.from(document.querySelectorAll('.thematic-card'));
    const targetIdx = allCards.findIndex(c => c.id === targetId);
    
    const selectedIndices = [];
    allCards.forEach((card, index) => {
        if (selectedItems.has(card.id)) selectedIndices.push(index);
    });

    const minIdx = Math.min(...selectedIndices);
    const maxIdx = Math.max(...selectedIndices);
    return (targetIdx === minIdx - 1) || (targetIdx === maxIdx + 1);
}

function enforceConsecutiveSelection() {
    const allCards = Array.from(document.querySelectorAll('.thematic-card'));
    if (selectedItems.size === 0) {
        allCards.forEach(card => card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'));
        return;
    }
    if (selectedItems.size >= MAX_SELECTION) {
        allCards.forEach(card => {
            if (!selectedItems.has(card.id)) card.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            else card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
        });
        return;
    }
    const selectedIndices = [];
    allCards.forEach((card, index) => {
        if (selectedItems.has(card.id)) selectedIndices.push(index);
    });
    const minIdx = Math.min(...selectedIndices);
    const maxIdx = Math.max(...selectedIndices);

    allCards.forEach((card, index) => {
        if (selectedItems.has(card.id)) {
            card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
            return;
        }
        if ((index === maxIdx + 1) || (index === minIdx - 1)) {
            card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
        } else {
            card.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
        }
    });
}

function toggleSelectionModeUI(active) {
    const btn = document.getElementById('toggleSelectModeBtn');
    const bulkBar = document.getElementById('bulkDownloadBar');
    if(typeof setSelectionMode === 'function') setSelectionMode(active);

    if (active) {
        isSelectMode = true;
        btn.classList.add('bg-[#56A3A6]', 'text-white');
        btn.classList.remove('text-white/70');
        bulkBar.classList.remove('-bottom-24');
        bulkBar.classList.add('bottom-32');
    } else {
        isSelectMode = false;
        btn.classList.remove('bg-[#56A3A6]', 'text-white');
        btn.classList.add('text-white/70');
        bulkBar.classList.remove('bottom-32');
        bulkBar.classList.add('-bottom-24');
        selectedItems.clear(); 
        document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'));
        updateBulkBar();
    }
}

function updateBulkBar() {
    document.getElementById('selectedCount').textContent = selectedItems.size;
    const dlBtn = document.getElementById('btnDownloadBulk');
    if (selectedItems.size > 0) {
        dlBtn.disabled = false;
        dlBtn.classList.remove('disabled:text-gray-600', 'disabled:cursor-not-allowed');
    } else {
        dlBtn.disabled = true;
        dlBtn.classList.add('disabled:text-gray-600', 'disabled:cursor-not-allowed');
    }
}

function openBulkDownloadModal(sections) {
    const modal = document.getElementById('downloadModal');
    const reciterSelect = document.getElementById('reciterSelect');
    const langSelect = document.getElementById('languageSelect');
    const surahSelect = document.getElementById('surahSelect');
    const surahText = surahSelect.options[surahSelect.selectedIndex].text;
    const surahName = surahText;

    document.getElementById('dlModalTitle').textContent = `Mix: ${sections.length} Consecutive Sections`;
    document.getElementById('dlModalReciter').textContent = reciterSelect.options[reciterSelect.selectedIndex].text;
    document.getElementById('dlModalLang').textContent = langSelect.options[langSelect.selectedIndex].text;
    
    document.getElementById('dlProgressContainer').classList.add('hidden');
    document.getElementById('dlConfirmBtn').style.display = 'block';
    modal.classList.remove('hidden');

    document.getElementById('dlConfirmBtn').onclick = () => {
        document.getElementById('dlProgressContainer').classList.remove('hidden');
        document.getElementById('dlConfirmBtn').style.display = 'none';
        
        if (typeof downloadBulkStitched === 'function') {
            downloadBulkStitched(sections, reciterSelect.value, langSelect.value, surahName);
        }
    };
    document.getElementById('dlCancelBtn').onclick = () => modal.classList.add('hidden');
}

function scrollToCard(card) {
    const container = document.getElementById('mainContainer');
    if (!container || !card) return;
    const cardRect = card.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const relativeTop = cardRect.top - containerRect.top;
    const currentScroll = container.scrollTop;
    const buffer = 100;
    const targetScroll = currentScroll + relativeTop - buffer;
    container.scrollTo({ top: targetScroll, behavior: 'smooth' });
}

// UPDATED: NAVIGATE SECTION (SKIPS HEADERS, SCROLLS TO HEADER, EXTENDED DELAY)
function navigateSection(direction) {
    const currentCard = document.querySelector('.thematic-card.ring-2');
    if (!currentCard) return;

    // SKIP HEADERS LOOP
    let targetCard = null;
    let sibling = direction === 'next' ? currentCard.nextElementSibling : currentCard.previousElementSibling;
    
    while (sibling) {
        if (sibling.classList.contains('thematic-card')) {
            targetCard = sibling;
            break;
        }
        sibling = direction === 'next' ? sibling.nextElementSibling : sibling.previousElementSibling;
    }
    
    if (targetCard) {
        // Logic: If this is start of a Surah, scroll to header and wait longer
        const isSurahStart = targetCard.dataset.start === "1";
        let scrollTarget = targetCard;
        let playDelay = 1000; // Default 1s

        if (isSurahStart) {
            // Find header
            const prev = targetCard.previousElementSibling;
            if (prev && prev.classList.contains('surah-mini-header')) {
                scrollTarget = prev;
            }
            // Add extra pause (1s buffer + 1.5s appreciation = 2.5s total)
            playDelay = 2500; 
        }

        scrollToCard(scrollTarget);
        
        setTimeout(() => {
            targetCard.querySelector('.play-btn').click();
        }, playDelay);
        
        triggerLookAheadPreload(targetCard);
    } else if (direction === 'next') {
        const currentId = parseInt(document.getElementById('surahSelect').value);
        if (currentViewMode === 'juz') {
            const nextJuz = currentId + 1;
            if (nextJuz <= 30) {
                document.getElementById('surahSelect').value = nextJuz;
                loadJuz(nextJuz);
                if (window.showToast) window.showToast(`Loaded Juz ${nextJuz}`, 'library_books');
            }
        } else {
            const nextSurah = currentId + 1;
            if (nextSurah <= 114) {
                document.getElementById('surahSelect').value = nextSurah;
                loadSurah(nextSurah);
                if (window.showToast) window.showToast(`Loaded Surah ${nextSurah}`, 'library_books');
            }
        }
    }
}

function triggerLookAheadPreload(currentCard) {
    const nextCard = currentCard.nextElementSibling;
    if (nextCard && nextCard.classList.contains('thematic-card')) {
        const surah = parseInt(nextCard.dataset.surah);
        const start = parseInt(nextCard.dataset.start);
        const end = parseInt(nextCard.dataset.end);
        if (typeof preloadNextSection === 'function') preloadNextSection(surah, start, end);
    }
}

let wakeLock = null;
async function toggleWakeLock(shouldLock) {
    if ('wakeLock' in navigator) {
        try {
            if (shouldLock && !wakeLock) {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock active');
            } else if (!shouldLock && wakeLock) {
                await wakeLock.release();
                wakeLock = null;
                console.log('Wake Lock released');
            }
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
    }
});