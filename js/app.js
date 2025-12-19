// js/app.js

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
window.currentBismillahAudio = null;

// Settings State
let currentFontScale = 1.0; 
let isEditMode = false;

// Selection State
let isSelectMode = false;
let selectedItems = new Set(); 
const MAX_SELECTION = 3; 

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Initializing App...");
    
    loadPreferences();

    try {
        const [qResponse, bResponse] = await Promise.all([
            fetch('data/quran_data.json'),
            fetch('data/theme_breaks.json')
        ]);

        if (!qResponse.ok || !bResponse.ok) throw new Error("Could not load data files.");

        QURAN_DATA = await qResponse.json();
        THEME_BREAKS = await bResponse.json();

        populateSurahDropdown();
        setupGlobalEventListeners();

        if (window.location.hash) {
            handleDeepLink();
        } else {
            const savedSurah = localStorage.getItem('lastSurahId');
            if (savedSurah) {
                document.getElementById('surahSelect').value = savedSurah;
                loadSurah(parseInt(savedSurah));
            } else {
                loadSurah(1); 
            }
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

    const savedScale = localStorage.getItem('fontScale');
    if (savedScale) {
        currentFontScale = parseFloat(savedScale);
        updateFontDisplay();
    }
}

function updateFontDisplay() {
    const display = document.getElementById('fontSizeDisplay');
    if(display) {
        display.textContent = Math.round(currentFontScale * 100) + '%';
    }
}

function populateSurahDropdown() {
    const select = document.getElementById('surahSelect');
    select.innerHTML = ''; 

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

    if (!window.location.hash && !localStorage.getItem('lastSurahId')) {
        select.value = "1";
    }
}

function resetPlayerState() {
    const audio = document.getElementById('audioElement');
    const playBtn = document.getElementById('globalPlayPauseBtn');
    const status = document.getElementById('playerStatus');
    const progressBar = document.getElementById('progressBar');
    const currentTime = document.getElementById('currentTime');
    
    audio.pause();
    audio.removeAttribute('src'); 
    audio.load();

    if (window.currentBismillahAudio) {
        window.currentBismillahAudio.pause();
        window.currentBismillahAudio = null;
    }

    if (playBtn) {
        playBtn.innerHTML = '<span class="material-symbols-outlined text-5xl">play_arrow</span>';
    }
    if (status) {
        status.textContent = "Ready to Play";
    }
    if (progressBar) {
        progressBar.style.width = '0%';
    }
    if (currentTime) {
        currentTime.textContent = "0:00";
    }
    
    document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
    document.querySelectorAll('.active-verse').forEach(el => el.classList.remove('active-verse'));
}

function loadSurah(surahId) {
    resetPlayerState();

    if (isSelectMode) toggleSelectionModeUI(false);

    localStorage.setItem('lastSurahId', surahId);

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

    let cleanBreaks = activeBreaks
        .map(Number)
        .filter(b => b < surahVerses.length) 
        .sort((a, b) => a - b);
        
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
}

window.handleVerseBreakToggle = function(surahId, verseNum) {
    if (!isEditMode) return;

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
        if (verseNum !== 1) {
            currentBreaks.splice(index, 1);
        }
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
    const verse = parseInt(params.get('v'));

    if (surah && !isNaN(surah)) {
        document.getElementById('surahSelect').value = surah;
        loadSurah(surah);
        setTimeout(() => {
            const targetId = `section-${surah}-${verse}`;
            const targetCard = document.getElementById(targetId);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetCard.classList.add('ring-4', 'ring-[#56A3A6]/50');
                setTimeout(() => targetCard.classList.remove('ring-4', 'ring-[#56A3A6]/50'), 2000);
            }
        }, 300);
    } else {
        loadSurah(1);
    }
}

function setupGlobalEventListeners() {
    document.getElementById('surahSelect').addEventListener('change', (e) => loadSurah(parseInt(e.target.value)));
    
    document.getElementById('languageSelect').addEventListener('change', () => {
        loadSurah(parseInt(document.getElementById('surahSelect').value));
    });

    document.getElementById('fontSelect').addEventListener('change', (e) => {
        const newFont = e.target.value;
        localStorage.setItem('arabicFont', newFont);
        loadSurah(parseInt(document.getElementById('surahSelect').value));
    });

    document.getElementById('increaseFontBtn').addEventListener('click', () => {
        if (currentFontScale < 2.0) {
            currentFontScale += 0.1;
            localStorage.setItem('fontScale', currentFontScale);
            updateFontDisplay();
            loadSurah(parseInt(document.getElementById('surahSelect').value));
        }
    });

    document.getElementById('decreaseFontBtn').addEventListener('click', () => {
        if (currentFontScale > 0.6) {
            currentFontScale -= 0.1;
            localStorage.setItem('fontScale', currentFontScale);
            updateFontDisplay();
            loadSurah(parseInt(document.getElementById('surahSelect').value));
        }
    });

    // --- EDIT MODE LISTENERS ---
    const editToggle = document.getElementById('editModeToggle');
    const banner = document.getElementById('editModeBanner');
    
    editToggle.addEventListener('change', (e) => {
        isEditMode = e.target.checked;
        if (isEditMode) {
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
        loadSurah(parseInt(document.getElementById('surahSelect').value));
    });

    document.getElementById('exitEditModeBtn').addEventListener('click', () => {
        isEditMode = false;
        banner.classList.add('hidden');
        document.getElementById('editModeToggle').checked = false; 
        loadSurah(parseInt(document.getElementById('surahSelect').value));
    });

    document.getElementById('restoreDefaultsBtn').addEventListener('click', restoreDefaults);

    // --- SIDEBAR ---
    const sidebar = document.getElementById('settingsSidebar');
    const backdrop = document.getElementById('settingsBackdrop');
    
    function openSettings() {
        backdrop.classList.remove('hidden');
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            sidebar.classList.remove('translate-x-full');
        }, 10);
    }

    function closeSettings() {
        sidebar.classList.add('translate-x-full');
        backdrop.classList.add('opacity-0');
        setTimeout(() => {
            backdrop.classList.add('hidden');
        }, 300); 
    }

    document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
    backdrop.addEventListener('click', closeSettings);

    const audio = document.getElementById('audioElement');
    audio.addEventListener('timeupdate', () => {
        const currentTime = document.getElementById('currentTime');
        const progressBar = document.getElementById('progressBar');
        
        if (audio.duration) {
            const minutes = Math.floor(audio.currentTime / 60);
            const seconds = Math.floor(audio.currentTime % 60);
            currentTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            const percent = (audio.currentTime / audio.duration) * 100;
            progressBar.style.width = `${percent}%`;
        }
    });

    document.getElementById('globalPlayPauseBtn').addEventListener('click', () => {
        const playBtn = document.getElementById('globalPlayPauseBtn');
        const audio = document.getElementById('audioElement');
        
        if (window.currentBismillahAudio) {
            if (window.currentBismillahAudio.paused) {
                window.currentBismillahAudio.play();
                playBtn.innerHTML = '<span class="material-symbols-outlined text-5xl">pause</span>';
            } else {
                window.currentBismillahAudio.pause();
                playBtn.innerHTML = '<span class="material-symbols-outlined text-5xl">play_arrow</span>';
            }
            return; 
        }

        if (!audio.paused) {
            if (typeof playerTogglePlayPause === 'function') {
                playerTogglePlayPause();
            } else {
                audio.pause();
            }
            return;
        }

        const activeCard = document.querySelector('.thematic-card.ring-2');
        const fileLoaded = audio.getAttribute('src') && audio.duration > 0; 

        if (fileLoaded) {
            if (typeof playerTogglePlayPause === 'function') {
                playerTogglePlayPause();
            } else {
                audio.play(); 
            }
        } else if (activeCard) {
            activeCard.querySelector('.play-btn').click();
        } else {
            const firstCard = document.querySelector('.thematic-card');
            if (firstCard) {
                document.getElementById('autoAdvanceToggle').checked = true;
                firstCard.querySelector('.play-btn').click();
            }
        }
    });

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
        allCards.forEach(card => {
            card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
        });
        return;
    }

    if (selectedItems.size >= MAX_SELECTION) {
        allCards.forEach(card => {
            if (!selectedItems.has(card.id)) {
                card.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            } else {
                card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
            }
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
        const id = card.id;
        if (selectedItems.has(id)) {
            card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
            return;
        }
        const isNextNeighbor = (index === maxIdx + 1);
        const isPrevNeighbor = (index === minIdx - 1);

        if (isNextNeighbor || isPrevNeighbor) {
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

function navigateSection(direction) {
    const currentCard = document.querySelector('.thematic-card.ring-2');
    if (!currentCard) return;
    const targetCard = direction === 'next' ? currentCard.nextElementSibling : currentCard.previousElementSibling;
    if (targetCard && targetCard.classList.contains('thematic-card')) {
        targetCard.querySelector('.play-btn').click();
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        triggerLookAheadPreload(targetCard);
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