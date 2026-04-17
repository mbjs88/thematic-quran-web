// js/app.js

console.log("THEMATIC QURAN - VERSION 2.3.0 (Stable + Analytics)");

const CONSTANTS = {
    KEY_SURAH_NO: 'surah_no',
    KEY_AYAH_NO: 'ayah_no_surah',
    KEY_ARABIC: 'ayah_ar',
    KEY_ENGLISH: 'ayah_en',
    KEY_URDU: 'urdu_translation',
    KEY_SURAH_MEANING: 'surah_name_en',
    KEY_SURAH_LATIN: 'surah_name_roman'
};

let QURAN_DATA = [];
let THEME_BREAKS = {};
let currentFontScale = 1.0;
let isEditMode = false;
let currentViewMode = 'surah';
let isSelectMode = false;
let selectedItems = new Set();
const MAX_SELECTION = 3;
const STORAGE_KEY_SCALE = 'fontScale_v2';

document.addEventListener('DOMContentLoaded', async () => {
    // CAPTURE STATIC WELCOME HTML BEFORE ANYTHING ELSE
    const contentArea = document.getElementById('contentArea');
    if (contentArea) {
        window.STATIC_WELCOME_HTML = contentArea.innerHTML;
    }

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

    // PWA Install Logic
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
            sendAnalyticsEvent('pwa_install', { outcome: outcome });
        });
    }

    // Scroll Aware Header
    const mainContainer = document.getElementById('mainContainer');
    const header = document.getElementById('mainHeader');
    let lastScrollY = 0;
    mainContainer.addEventListener('scroll', () => {
        const currentScrollY = mainContainer.scrollTop;
        if (currentScrollY > 100) {
            if (currentScrollY > lastScrollY) header.classList.add('header-hidden');
            else header.classList.remove('header-hidden');
        } else {
            header.classList.remove('header-hidden');
        }
        lastScrollY = currentScrollY;
    });

    loadPreferences();

    // INITIAL POPULATE: Ensure "Welcome" is visible immediately, even if data takes time
    populateDropdown();

    try {
        const [qResponse, bResponse] = await Promise.all([
            fetch('data/quran_data.json'),
            fetch('data/theme_breaks.json')
        ]);

        if (!qResponse.ok || !bResponse.ok) throw new Error("Could not load data files.");

        QURAN_DATA = await qResponse.json();
        THEME_BREAKS = await bResponse.json();

        setupGlobalEventListeners();
        setupCustomScrollbar(); // NEW: Custom Scrollbar Init

        if (window.location.hash) {
            handleDeepLink();
        } else {
            // Check session state
            const savedState = localStorage.getItem('resumeState');
            if (savedState) {
                restoreSessionState();
            } else {
                // DEFAULT TO WELCOME PAGE (No Auto-Load Surah 1)
                populateDropdown();
                document.getElementById('surahSelect').value = "0";

                // Force render the welcome page (since static HTML might be missing/cleared)
                loadContent(0);
            }
        }

        // setupAboutModal(); // REMOVED

        document.getElementById('loadingMessage').classList.add('hidden');
        document.getElementById('contentArea').classList.remove('hidden');

    } catch (error) {
        console.error("Initialization Error:", error);
        document.getElementById('loadingMessage').textContent = "Error loading data. See console.";
    }
});

function loadPreferences() {
    const savedFont = localStorage.getItem('arabicFont');
    if (savedFont && document.getElementById('fontSelect')) document.getElementById('fontSelect').value = savedFont;

    const savedScale = localStorage.getItem(STORAGE_KEY_SCALE);
    if (savedScale) currentFontScale = parseFloat(savedScale);
    else currentFontScale = (window.innerWidth < 768) ? 0.7 : 1.0;

    updateFontDisplay();

    const arSpeed = localStorage.getItem('arabicSpeed') || "1.0";
    const trSpeed = localStorage.getItem('translationSpeed') || "1.0";
    updateSpeedUI('arabicSpeedControls', arSpeed);
    updateSpeedUI('transSpeedControls', trSpeed);

    // Analytics: User Snapshot
    setTimeout(() => {
        sendAnalyticsEvent('user_preferences_snapshot', {
            view_mode: currentViewMode,
            reciter: document.getElementById('reciterSelect')?.value || 'default',
            font: savedFont || 'default',
            speed_arabic: arSpeed,
            speed_translation: trSpeed
        });
    }, 2000);
}

function updateFontDisplay() {
    const display = document.getElementById('fontSizeDisplay');
    if (display) display.textContent = Math.round(currentFontScale * 100) + '%';
}

function restoreSessionState() {
    const savedState = localStorage.getItem('resumeState');
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            currentViewMode = state.mode || 'surah';
            const id = state.id || 1;
            const startVerse = state.startVerse || 1;

            const viewSelect = document.getElementById('viewModeSelect');
            if (viewSelect) viewSelect.value = currentViewMode;
            populateDropdown();
            document.getElementById('surahSelect').value = id;

            loadContent(id, startVerse);
        } catch (e) {
            console.error("Failed to restore session", e);
            fallbackLoad();
        }
    } else {
        fallbackLoad();
    }
}

function fallbackLoad() {
    populateDropdown();
    // Fallback? Load Welcome
    document.getElementById('surahSelect').value = "0";
    if (window.renderWelcomePage) window.renderWelcomePage();
}

function populateDropdown() {
    const select = document.getElementById('surahSelect');
    select.innerHTML = '';
    if (currentViewMode === 'juz') {
        // Add Welcome Option
        const welcome = document.createElement('option');
        welcome.value = 0; welcome.textContent = "Welcome"; select.appendChild(welcome);

        for (let i = 1; i <= 30; i++) {
            const option = document.createElement('option');
            option.value = i; option.textContent = `Juz ${i}`; select.appendChild(option);
        }
    } else {
        // Add Welcome Option
        const welcome = document.createElement('option');
        welcome.value = 0; welcome.textContent = "Welcome"; select.appendChild(welcome);

        const uniqueSurahs = new Map();
        QURAN_DATA.forEach(row => {
            const num = row[CONSTANTS.KEY_SURAH_NO];
            if (!uniqueSurahs.has(num)) uniqueSurahs.set(num, { meaning: row[CONSTANTS.KEY_SURAH_MEANING], latin: row[CONSTANTS.KEY_SURAH_LATIN] });
        });
        uniqueSurahs.forEach((info, num) => {
            const option = document.createElement('option');
            option.value = num;
            const paddedNum = String(num).padStart(2, '0');
            const text = info.latin ? `${paddedNum} ${info.latin} (${info.meaning})` : `${paddedNum} ${info.meaning}`;
            option.textContent = text; select.appendChild(option);
        });
    }
}

function resetPlayerState() {
    if (typeof stopAllAudio === 'function') stopAllAudio();
    const playBtn = document.getElementById('globalPlayPauseBtn');
    if (playBtn) playBtn.innerHTML = '<span class="material-symbols-outlined text-5xl">play_arrow</span>';
    const status = document.getElementById('playerStatus');
    if (status) status.textContent = "Ready to Play";
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '0%';
    const currentTime = document.getElementById('currentTime');
    if (currentTime) currentTime.textContent = "0:00";

    document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
    document.querySelectorAll('.active-verse').forEach(el => el.classList.remove('active-verse'));
}

function loadContent(id, scrollTargetVerse = null, autoPlay = false) {
    if (id === 0) {
        if (window.renderWelcomePage) window.renderWelcomePage();
        // Update URL to root?
        const mainContainer = document.getElementById('mainContainer');
        if (mainContainer) mainContainer.scrollTop = 0;
        return;
    }

    if (currentViewMode === 'juz') loadJuz(id, scrollTargetVerse, autoPlay);
    else loadSurah(id, scrollTargetVerse, autoPlay);
}

function loadSurah(surahId, scrollTargetVerse = null, autoPlay = false) {
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
        if (cleanBreaks[0] !== 1) cleanBreaks.unshift(1);
    }
    cleanBreaks = [...new Set(cleanBreaks)];

    const select = document.getElementById('surahSelect');
    let surahText = `Surah ${surahId}`;
    if (select.value == surahId && select.selectedIndex >= 0) surahText = select.options[select.selectedIndex].text;
    document.getElementById('playerVerse').textContent = surahText;

    renderThematicSurah(surahId, surahVerses, cleanBreaks);

    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) mainContainer.scrollTop = 0;

    setTimeout(() => {
        if (scrollTargetVerse) {
            // Find the active tab's span (either Arabic or English) to scroll precisely to the modified verse
            const isUrdu = document.getElementById('languageSelect')?.value === 'ur';
            const textKey = isUrdu ? 'ayah-en' : 'ayah-en'; // using translation span for scrolling anchor
            const targetSpan = document.getElementById(`${textKey}-${surahId}-${scrollTargetVerse}`) || document.getElementById(`ayah-ar-${surahId}-${scrollTargetVerse}`);

            if (targetSpan) {
                // Ensure the span is visible
                const container = document.getElementById('mainContainer');
                const spanRect = targetSpan.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const relativeTop = spanRect.top - containerRect.top;
                const buffer = 150; // offset for the sticky header
                const targetScroll = container.scrollTop + relativeTop - buffer;
                container.scrollTo({ top: targetScroll, behavior: 'instant' });
            }

            const cards = Array.from(document.querySelectorAll('.thematic-card'));
            const targetCard = cards.find(card => {
                const s = parseInt(card.dataset.start);
                const e = parseInt(card.dataset.end);
                return scrollTargetVerse >= s && scrollTargetVerse <= e;
            });
            if (targetCard) {
                const s = parseInt(targetCard.dataset.surah);
                const start = parseInt(targetCard.dataset.start);
                const end = parseInt(targetCard.dataset.end);
                if (typeof preloadNextSection === 'function') preloadNextSection(s, start, end);
                localStorage.setItem('resumeState', JSON.stringify({ mode: 'surah', id: surahId, startVerse: start }));
            }
        } else {
            const firstCard = document.querySelector('.thematic-card');
            if (firstCard) {
                if (typeof preloadNextSection === 'function') {
                    const s = parseInt(firstCard.dataset.surah);
                    const start = parseInt(firstCard.dataset.start);
                    const end = parseInt(firstCard.dataset.end);
                    preloadNextSection(s, start, end);
                    localStorage.setItem('resumeState', JSON.stringify({ mode: 'surah', id: surahId, startVerse: 1 }));
                }

                // NEW: Auto-Play Next Surah Logic
                if (autoPlay) {
                    console.log(`[AutoPlay] Scheduled for Surah ${surahId}`);
                    // Play after a brief delay to avoid background throttling issues with DOM clicks
                    const s = parseInt(firstCard.dataset.surah);
                    const start = parseInt(firstCard.dataset.start);
                    const end = parseInt(firstCard.dataset.end);

                    setTimeout(() => {
                        document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
                        firstCard.classList.add('ring-2', 'ring-[#56A3A6]');
                        if (typeof playSession === 'function') playSession(s, start, end);
                        document.dispatchEvent(new CustomEvent('manual-play-started', { detail: { card: firstCard } }));
                    }, 500); // 0.5s pause
                }
            }
        }
    }, 100);
}

function loadJuz(juzId, scrollTargetVerse = null, autoPlay = false) {
    resetPlayerState();
    if (isSelectMode) toggleSelectionModeUI(false);

    if (typeof JUZ_META === 'undefined') return;
    const meta = JUZ_META.find(j => j.id === juzId);
    if (!meta) return;

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

    // NEW: Build dynamic breaks mapping combining defaults with custom user breaks
    const unifiedBreaks = {};
    const uniqueSurahsInJuz = [...new Set(juzVerses.map(v => v[CONSTANTS.KEY_SURAH_NO]))];

    uniqueSurahsInJuz.forEach(surahId => {
        const customKey = `customBreaks_${surahId}`;
        const saved = localStorage.getItem(customKey);
        if (saved) {
            unifiedBreaks[String(surahId)] = JSON.parse(saved);
        } else {
            unifiedBreaks[String(surahId)] = THEME_BREAKS[String(surahId)] || [];
        }
    });

    renderThematicJuz(juzId, juzVerses, unifiedBreaks);

    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) mainContainer.scrollTop = 0;

    setTimeout(() => {
        if (scrollTargetVerse) {
            // Find the active tab's span (either Arabic or English) to scroll precisely to the modified verse
            const isUrdu = document.getElementById('languageSelect')?.value === 'ur';
            const textKey = isUrdu ? 'ayah-en' : 'ayah-en';

            // In Juz mode, we might not know the exact Surah ID initially from scrollTargetVerse if it crosses surahs, 
            // but handleVerseBreakToggle operates within a specific Surah, and passes the targeted verse
            // Let's find the active card bounding this verse, and use its Surah ID, or we assume it's the current surah.
            // A more robust approach: find the first element matching `ayah-*-*-scrollTargetVerse`.
            let targetSpan = null;
            const possibleSpans = document.querySelectorAll(`[id$="-${scrollTargetVerse}"]`);
            for (let span of possibleSpans) {
                if (span.id.startsWith(textKey) || span.id.startsWith('ayah-ar')) {
                    targetSpan = span;
                    break;
                }
            }

            if (targetSpan) {
                const container = document.getElementById('mainContainer');
                const spanRect = targetSpan.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const relativeTop = spanRect.top - containerRect.top;
                const buffer = 150;
                const targetScroll = container.scrollTop + relativeTop - buffer;
                container.scrollTo({ top: targetScroll, behavior: 'instant' });
            }
        } else {
            const firstCard = document.querySelector('.thematic-card');
            if (firstCard) {
                if (typeof preloadNextSection === 'function') {
                    const s = parseInt(firstCard.dataset.surah);
                    const start = parseInt(firstCard.dataset.start);
                    const end = parseInt(firstCard.dataset.end);
                    preloadNextSection(s, start, end);
                }

                // NEW: Auto-Play Next Juz Logic
                if (autoPlay) {
                    console.log(`[AutoPlay] Scheduled for Juz ${juzId}`);
                    // Play after a brief delay to avoid background throttling issues with DOM clicks
                    const s = parseInt(firstCard.dataset.surah);
                    const start = parseInt(firstCard.dataset.start);
                    const end = parseInt(firstCard.dataset.end);

                    setTimeout(() => {
                        document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
                        firstCard.classList.add('ring-2', 'ring-[#56A3A6]');
                        if (typeof playSession === 'function') playSession(s, start, end);
                        document.dispatchEvent(new CustomEvent('manual-play-started', { detail: { card: firstCard } }));
                    }, 500); // 0.5s pause
                }
            }
        }
    }, 100);
}

// ... (Edit/Restore Functions) ...
window.handleVerseBreakToggle = function (surahId, verseNum) {
    if (!isEditMode) return;
    const customKey = `customBreaks_${surahId}`;
    const surahVerses = QURAN_DATA.filter(row => row[CONSTANTS.KEY_SURAH_NO] === surahId);
    let currentBreaks = [];
    const saved = localStorage.getItem(customKey);
    if (saved) currentBreaks = JSON.parse(saved);
    else {
        let defaults = THEME_BREAKS[String(surahId)] || [];
        currentBreaks = defaults.map(Number).filter(b => b < surahVerses.length).sort((a, b) => a - b);
        if (currentBreaks.length === 0 || currentBreaks[0] !== 1) currentBreaks.unshift(1);
    }
    const index = currentBreaks.indexOf(verseNum);
    if (index !== -1) { if (verseNum !== 1) currentBreaks.splice(index, 1); }
    else currentBreaks.push(verseNum);
    currentBreaks.sort((a, b) => a - b);
    localStorage.setItem(customKey, JSON.stringify(currentBreaks));

    const currentId = parseInt(document.getElementById('surahSelect').value);
    // Reload UI keeping scroll target focused on the verse clicked
    if (currentViewMode === 'juz') {
        loadJuz(currentId, verseNum);
    } else {
        loadSurah(surahId, verseNum);
    }

    sendAnalyticsEvent('edit_grouping', { surah: surahId, action: index !== -1 ? 'merge' : 'split', view_mode: currentViewMode });
};

function restoreDefaults() {
    const surahId = parseInt(document.getElementById('surahSelect').value);
    const customKey = `customBreaks_${surahId}`;
    localStorage.removeItem(customKey);
    loadSurah(surahId);
    sendAnalyticsEvent('restore_defaults', { surah: surahId });
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
        if (viewSelect) viewSelect.value = 'surah';
        populateDropdown();
        document.getElementById('surahSelect').value = surah;
        loadContent(surah, verseStart);
    } else {
        restoreSessionState();
    }
}

function setupGlobalEventListeners() {
    document.getElementById('surahSelect').addEventListener('change', (e) => {
        loadContent(parseInt(e.target.value));
        sendAnalyticsEvent('content_select', { type: currentViewMode, id: e.target.value });
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
            sendAnalyticsEvent('view_mode_change', { mode: currentViewMode });
        });
    }

    setupSpeedControl('arabicSpeedControls', 'arabic');
    setupSpeedControl('transSpeedControls', 'translation');

    document.getElementById('languageSelect').addEventListener('change', (e) => {
        loadContent(parseInt(document.getElementById('surahSelect').value));
        sendAnalyticsEvent('setting_changed', { category: 'visual', name: 'translation_language', value: e.target.value });
    });

    document.getElementById('reciterSelect').addEventListener('change', (e) => {
        sendAnalyticsEvent('setting_changed', { category: 'audio', name: 'reciter', value: e.target.value });
    });

    document.getElementById('fontSelect').addEventListener('change', (e) => {
        localStorage.setItem('arabicFont', e.target.value);
        loadContent(parseInt(document.getElementById('surahSelect').value));
        sendAnalyticsEvent('setting_changed', { category: 'visual', name: 'arabic_font', value: e.target.value });
    });

    document.getElementById('increaseFontBtn').addEventListener('click', () => { if (currentFontScale < 2.0) { currentFontScale += 0.1; localStorage.setItem(STORAGE_KEY_SCALE, currentFontScale); updateFontDisplay(); loadContent(parseInt(document.getElementById('surahSelect').value)); sendAnalyticsEvent('setting_changed', { category: 'visual', name: 'font_size', value: 'increase' }); } });
    document.getElementById('decreaseFontBtn').addEventListener('click', () => { if (currentFontScale > 0.6) { currentFontScale -= 0.1; localStorage.setItem(STORAGE_KEY_SCALE, currentFontScale); updateFontDisplay(); loadContent(parseInt(document.getElementById('surahSelect').value)); sendAnalyticsEvent('setting_changed', { category: 'visual', name: 'font_size', value: 'decrease' }); } });

    const editToggle = document.getElementById('editModeToggle');
    editToggle.addEventListener('change', (e) => {
        isEditMode = e.target.checked;
        const banner = document.getElementById('editModeBanner');
        if (isEditMode) banner.classList.remove('hidden'); else banner.classList.add('hidden');
        loadContent(parseInt(document.getElementById('surahSelect').value));
        sendAnalyticsEvent('edit_mode_toggle', { active: isEditMode });
    });
    document.getElementById('exitEditModeBtn').addEventListener('click', () => { isEditMode = false; document.getElementById('editModeBanner').classList.add('hidden'); document.getElementById('editModeToggle').checked = false; loadContent(parseInt(document.getElementById('surahSelect').value)); });

    document.getElementById('restoreDefaultsBtn').addEventListener('click', restoreDefaults);

    const sidebar = document.getElementById('settingsSidebar');
    const backdrop = document.getElementById('settingsBackdrop');
    function openSettings() { backdrop.classList.remove('hidden'); setTimeout(() => { backdrop.classList.remove('opacity-0'); sidebar.classList.remove('translate-x-full'); }, 10); sendAnalyticsEvent('ui_interaction', { action: 'open_settings' }); }
    function closeSettings() { sidebar.classList.add('translate-x-full'); backdrop.classList.add('opacity-0'); setTimeout(() => { backdrop.classList.add('hidden'); }, 300); }
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
                // Check for saved resume state first
                const savedState = localStorage.getItem('resumeState');
                if (savedState) {
                    try {
                        const state = JSON.parse(savedState);
                        const surahId = state.id || 1;
                        const startVerse = state.startVerse || 1;
                        const savedMode = state.mode || 'surah';
                        const currentId = parseInt(document.getElementById('surahSelect').value);

                        // Only resume if we are currently viewing the matching Surah/Juz
                        if (currentViewMode === savedMode && currentId === surahId) {
                            const cards = Array.from(document.querySelectorAll('.thematic-card'));
                            const targetCard = cards.find(card => {
                                const s = parseInt(card.dataset.start);
                                const e = parseInt(card.dataset.end);
                                return startVerse >= s && startVerse <= e;
                            });

                            if (targetCard) {
                                document.getElementById('autoAdvanceToggle').checked = true;
                                targetCard.querySelector('.play-btn').click();
                                scrollToCard(targetCard);
                                if (window.showToast) window.showToast("Resumed from last saved verse", "play_arrow");
                                return; // Exit early, we found and played it
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse resume state for global play button", e);
                    }
                }

                // Fallback: Just play the first card on the current screen
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
    document.addEventListener('section-ended', () => { if (document.getElementById('autoAdvanceToggle').checked) navigateSection('next'); });

    // Handle Start Listening (Resume or Default)
    document.addEventListener('start-listening', () => {
        const savedState = localStorage.getItem('resumeState');
        if (savedState) {
            restoreSessionState();
        } else {
            // No saved state? Start at Surah 1
            const sel = document.getElementById('surahSelect');
            sel.value = "1";
            loadContent(1);
            if (window.showToast) window.showToast("Starting from Surah 1", "play_arrow");
        }
    });

    document.addEventListener('manual-play-started', (e) => {
        const card = e.detail.card;
        triggerLookAheadPreload(card);
        const id = parseInt(document.getElementById('surahSelect').value);
        const startVerse = parseInt(card.dataset.start);
        localStorage.setItem('resumeState', JSON.stringify({ mode: currentViewMode, id: id, startVerse: startVerse }));

        // ANALYTICS TRACKING
        sendAnalyticsEvent('playback_start', {
            surah: id,
            verse: startVerse,
            view_mode: currentViewMode
        });
    });

    document.addEventListener('verse-changed', (e) => {
        const { surah, verse, type } = e.detail;
        if (typeof window.highlightActiveVerseUI === 'function') {
            window.highlightActiveVerseUI(surah, verse, type);
        }

        // Save the exact current verse to resumeState so progress is retained perfectly even if user leaves mid-section
        const id = parseInt(document.getElementById('surahSelect').value);
        localStorage.setItem('resumeState', JSON.stringify({ mode: currentViewMode, id: id, startVerse: verse }));

        // SYNC OUT to Quran.com if logged in
        if (window.isLoggedIn) {
            if (window.syncOutTimeout) clearTimeout(window.syncOutTimeout);
            window.syncOutTimeout = setTimeout(() => {
                fetch('/api/qf/auth/v1/reading-sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        chapterNumber: parseInt(surah), 
                        verseNumber: parseInt(verse)
                    })
                })
                .then(r => r.text())
                .then(txt => console.log("SYNC OUT RESPONSE:", txt))
                .catch(err => console.debug("Quran.com Sync Out Failed", err));
            }, 3000);
        }
    });

    document.getElementById('toggleSelectModeBtn').addEventListener('click', () => {
        isSelectMode = !isSelectMode;
        toggleSelectionModeUI(isSelectMode);
        if (isSelectMode) sendAnalyticsEvent('ui_interaction', { action: 'enter_select_mode' });
    });
    document.getElementById('exitSelectModeBtn').addEventListener('click', () => { toggleSelectionModeUI(false); });
    document.addEventListener('card-toggle-select', (e) => {
        const card = e.detail.card; const id = card.id;
        if (selectedItems.has(id)) { selectedItems.delete(id); card.querySelector('.selection-overlay').classList.remove('opacity-100', 'bg-[#56A3A6]/20'); card.querySelector('.selection-overlay').classList.add('opacity-30'); card.classList.remove('ring-4', 'ring-[#56A3A6]'); }
        else { if (selectedItems.size >= MAX_SELECTION) return; if (!isValidSelection(id)) return; selectedItems.add(id); card.querySelector('.selection-overlay').classList.remove('opacity-30'); card.querySelector('.selection-overlay').classList.add('opacity-100', 'bg-[#56A3A6]/20'); card.classList.add('ring-4', 'ring-[#56A3A6]'); }
        enforceConsecutiveSelection(); updateBulkBar();
    });
    document.getElementById('btnDownloadBulk').addEventListener('click', () => {
        const sectionsToDownload = Array.from(selectedItems).map(id => { const card = document.getElementById(id); return { surah: parseInt(card.dataset.surah), start: parseInt(card.dataset.start), end: parseInt(card.dataset.end) }; });
        sectionsToDownload.sort((a, b) => a.start - b.start); openBulkDownloadModal(sectionsToDownload);
        sendAnalyticsEvent('download_initiated', { type: 'bulk', count: sectionsToDownload.length });
    });

    // --- AUTHENTICATION LOGIC ---
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    const quranLoginBtn = document.getElementById('quranLoginBtn');
    const quranLogoutBtn = document.getElementById('quranLogoutBtn');
    const loggedOutState = document.getElementById('loggedOutState');
    const loggedInState = document.getElementById('loggedInState');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const userInitial = document.getElementById('userInitial');

    // Simple base64 URL JWT decoder
    function decodeJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            if (!base64Url) return null;
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    // 1. Check for token on startup
    const tokenCookieStr = document.cookie.split(';').find(c => c.trim().startsWith('quran_access_token_'));
    const hasToken = !!tokenCookieStr;
    if (hasToken) {
        window.isLoggedIn = true;
        loggedOutState.classList.add('hidden');
        loggedInState.classList.remove('hidden');

        welcomeMessage.textContent = "Loading Profile...";
        userInitial.textContent = "?";

        let tokenData = null;
        try {
            const idCookie = document.cookie.split(';').find(c => c.trim().startsWith('quran_id_token_'));
            const tokenToDecode = idCookie ? idCookie : tokenCookieStr;
            const tokenVal = tokenToDecode.split('=')[1];
            tokenData = decodeJWT(tokenVal);
        } catch (e) {
            console.error("JWT Decode error", e);
        }

        if (tokenData && (tokenData.firstName || tokenData.name || tokenData.given_name || tokenData.first_name || tokenData.username)) {
            const fetchedName = tokenData.firstName || tokenData.username || tokenData.name || tokenData.given_name || tokenData.first_name;
            welcomeMessage.textContent = `Assalamu alaikum, ${fetchedName}`;
            
            const pic = tokenData.avatar_url || tokenData.picture || tokenData.avatar || tokenData.photo || tokenData.avatarUrl || tokenData.pictureUrl;
            if (pic) {
                userInitial.innerHTML = `<img src="${pic}" alt="Profile" class="w-full h-full rounded-full object-cover">`;
            } else {
                userInitial.textContent = fetchedName.charAt(0).toUpperCase();
            }
        } else {
            fetch('/api/qf/auth/v1/users/profile').then(r => r.text()).then(text => {
                if (!text || text.includes('error') || text === 'Unauthorized' || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
                    welcomeMessage.textContent = `User (API Error: ${text ? text.substring(0, 40) : 'empty'})`;
                    return;
                }
                try {
                    const rawJson = JSON.parse(text);
                    
                    // Trap expired or invalid access tokens correctly and violently kick them to the structured logout module
                    if (rawJson.type === 'invalid_token' || rawJson.error === 'invalid_token') {
                        console.log("[Auth] Token expired natively. Purging state.");
                        welcomeMessage.textContent = "Session Expired. Logging out...";
                        setTimeout(() => window.location.href = '/auth/logout', 600);
                        return;
                    }

                    const ProfileData = rawJson.data ? rawJson.data : rawJson;

                    const fetchedName = ProfileData.firstName || ProfileData.username || ProfileData.name || ProfileData.given_name;
                    if (fetchedName) {
                        welcomeMessage.textContent = `Assalamu alaikum, ${fetchedName}`;
                        
                        const pic = ProfileData.avatar_url || ProfileData.picture || ProfileData.avatar || ProfileData.photo || ProfileData.avatarUrl || ProfileData.pictureUrl;
                        if (pic) {
                            userInitial.innerHTML = `<img src="${pic}" alt="Profile" class="w-full h-full rounded-full object-cover">`;
                        } else {
                            userInitial.textContent = fetchedName.charAt(0).toUpperCase();
                        }
                    } else {
                        // Expose exactly what JSON keys the API actually sent us back!
                        welcomeMessage.textContent = `User (Keys: ${Object.keys(ProfileData).join(', ')})`;
                    }
                } catch (e) {
                    welcomeMessage.textContent = `User (Invalid JSON: ${text.substring(0, 30)})`;
                }
            }).catch(e => {
                welcomeMessage.textContent = `User (Network Drop: ${e.message})`;
            });
        }
        console.log("Quran.com Access Token Detected.");
        if (window.initQfCollectionsSync) window.initQfCollectionsSync();

        // SYNC IN from Quran.com
        fetch('/api/qf/auth/v1/reading-sessions?first=5')
            .then(r => r.text())
            .then(text => {
                if (!text || text.includes('error')) {
                    console.log("SYNC ERROR/EMPTY:", text);
                    if (text && text.includes('error')) {
                        document.getElementById('welcomeMessage').textContent = `Sync Error: ${text.substring(0, 40)}`;
                    }
                    return;
                }
                const rawJson = JSON.parse(text);
                const dataArray = rawJson.data ? rawJson.data : rawJson;
                
                if (!dataArray || dataArray.length === 0) {
                     console.log("SYNC: No sessions found in dataArray.");
                     // No remote data, do nothing!
                } else if (dataArray && dataArray.length > 0) {
                    const latestSession = dataArray[0];
                    const qSurah = parseInt(latestSession.chapterNumber || latestSession.chapter_number);
                    const qVerse = parseInt(latestSession.verseNumber || latestSession.verse_number);

                    let localSurah = null;
                    let localVerse = null;
                    try {
                        const localState = JSON.parse(localStorage.getItem('resumeState'));
                        if (localState && localState.mode === 'surah') {
                            localSurah = parseInt(localState.id);
                            localVerse = parseInt(localState.startVerse);
                        }
                    } catch(e) {}

                    // Diff Check - Prompt if Quran.com state exists and differs from local ThematicQuran state
                    if (qSurah && qVerse && (qSurah !== localSurah || qVerse !== localVerse)) {
                        const modal = document.getElementById('syncConflictModal');
                        const textEl = document.getElementById('syncSurahText');
                        const declineBtn = document.getElementById('declineSyncBtn');
                        const acceptBtn = document.getElementById('acceptSyncBtn');

                        if (modal && textEl) {
                            const surahName = typeof window.getSurahName === 'function' ? window.getSurahName(qSurah) : `Surah ${qSurah}`;
                            textEl.textContent = `${surahName}, Ayah ${qVerse}`;
                            modal.classList.remove('translate-x-[150%]');

                            declineBtn.onclick = () => {
                                modal.classList.add('translate-x-[150%]');
                            };

                            acceptBtn.onclick = () => {
                                modal.classList.add('translate-x-[150%]');
                                
                                // Overwrite local state with Quran.com state
                                localStorage.setItem('resumeState', JSON.stringify({ mode: 'surah', id: qSurah, startVerse: qVerse }));
                                
                                // Manually change view mode without dispatching the event (which causes loadContent(1) race condition)
                                currentViewMode = 'surah';
                                document.getElementById('viewModeSelect').value = 'surah';
                                populateDropdown();
                                document.getElementById('surahSelect').value = qSurah;
                                
                                // Cleanly load the target content
                                if (typeof window.loadContent === 'function') {
                                    window.loadContent(qSurah, qVerse);
                                    
                                    setTimeout(() => {
                                        if (typeof window.playRange === 'function') {
                                            const allCards = Array.from(document.querySelectorAll('.thematic-card'));
                                            const targetCard = allCards.find(c => parseInt(c.dataset.start) <= qVerse && parseInt(c.dataset.end) >= qVerse);
                                            if(targetCard) {
                                                window.playRange(qSurah, parseInt(targetCard.dataset.start), parseInt(targetCard.dataset.end), qVerse, 'arabic');
                                            } else {
                                                window.playRange(qSurah, qVerse, qVerse, qVerse, 'arabic');
                                            }
                                        }
                                    }, 1200); // give enough time for thematic cards to render
                                } else {
                                    // Fallback if loadContent is somehow unavailable
                                    window.location.reload();
                                }
                            };
                        }
                    }
                }
            })
            .catch(e => {
                console.debug("Quran.com Sync In Failed", e);
                document.getElementById('welcomeMessage').textContent = `Sync Fetch Failed: ${e.message}`;
            });
    }

    if (quranLoginBtn) {
        quranLoginBtn.addEventListener('click', () => {
            sendAnalyticsEvent('auth_initiated', { provider: 'quran.com' });
            // Let the backend handle PKCE and CSRF generation securely
            window.location.href = '/auth/login';
        });
    }

    if (quranLogoutBtn) {
        quranLogoutBtn.addEventListener('click', () => {
            // Let the backend environment delete the explicit cookies linked to it securely
            window.location.href = '/auth/logout';
            sendAnalyticsEvent('auth_logout', {});
        });
    }
}

// ... (Helpers) ...
function isValidSelection(targetId) { if (selectedItems.size === 0) return true; const allCards = Array.from(document.querySelectorAll('.thematic-card')); const targetIdx = allCards.findIndex(c => c.id === targetId); const selectedIndices = []; allCards.forEach((card, index) => { if (selectedItems.has(card.id)) selectedIndices.push(index); }); const minIdx = Math.min(...selectedIndices); const maxIdx = Math.max(...selectedIndices); return (targetIdx === minIdx - 1) || (targetIdx === maxIdx + 1); }
function enforceConsecutiveSelection() { const allCards = Array.from(document.querySelectorAll('.thematic-card')); if (selectedItems.size === 0) { allCards.forEach(card => card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale')); return; } if (selectedItems.size >= MAX_SELECTION) { allCards.forEach(card => { if (!selectedItems.has(card.id)) card.classList.add('opacity-40', 'pointer-events-none', 'grayscale'); else card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'); }); return; } const selectedIndices = []; allCards.forEach((card, index) => { if (selectedItems.has(card.id)) selectedIndices.push(index); }); const minIdx = Math.min(...selectedIndices); const maxIdx = Math.max(...selectedIndices); allCards.forEach((card, index) => { if (selectedItems.has(card.id)) { card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'); return; } if ((index === maxIdx + 1) || (index === minIdx - 1)) { card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'); } else { card.classList.add('opacity-40', 'pointer-events-none', 'grayscale'); } }); }
function toggleSelectionModeUI(active) { const btn = document.getElementById('toggleSelectModeBtn'); const bulkBar = document.getElementById('bulkDownloadBar'); if (typeof setSelectionMode === 'function') setSelectionMode(active); if (active) { isSelectMode = true; btn.classList.add('bg-[#56A3A6]', 'text-white'); btn.classList.remove('text-white/70'); bulkBar.classList.remove('-bottom-24'); bulkBar.classList.add('bottom-32'); } else { isSelectMode = false; btn.classList.remove('bg-[#56A3A6]', 'text-white'); btn.classList.add('text-white/70'); bulkBar.classList.remove('bottom-32'); bulkBar.classList.add('-bottom-24'); selectedItems.clear(); document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('opacity-40', 'pointer-events-none', 'grayscale')); updateBulkBar(); } }
function updateBulkBar() { document.getElementById('selectedCount').textContent = selectedItems.size; const dlBtn = document.getElementById('btnDownloadBulk'); if (selectedItems.size > 0) { dlBtn.disabled = false; dlBtn.classList.remove('disabled:text-gray-600', 'disabled:cursor-not-allowed'); } else { dlBtn.disabled = true; dlBtn.classList.add('disabled:text-gray-600', 'disabled:cursor-not-allowed'); } }
function openBulkDownloadModal(sections) { const modal = document.getElementById('downloadModal'); const reciterSelect = document.getElementById('reciterSelect'); const langSelect = document.getElementById('languageSelect'); const surahSelect = document.getElementById('surahSelect'); const surahText = surahSelect.options[surahSelect.selectedIndex].text; const surahName = surahText; document.getElementById('dlModalTitle').textContent = `Mix: ${sections.length} Consecutive Sections`; document.getElementById('dlModalReciter').textContent = reciterSelect.options[reciterSelect.selectedIndex].text; document.getElementById('dlModalLang').textContent = langSelect.options[langSelect.selectedIndex].text; document.getElementById('dlProgressContainer').classList.add('hidden'); document.getElementById('dlConfirmBtn').style.display = 'block'; modal.classList.remove('hidden'); document.getElementById('dlConfirmBtn').onclick = () => { document.getElementById('dlProgressContainer').classList.remove('hidden'); document.getElementById('dlConfirmBtn').style.display = 'none'; if (typeof downloadBulkStitched === 'function') { downloadBulkStitched(sections, reciterSelect.value, langSelect.value, surahName); } }; document.getElementById('dlCancelBtn').onclick = () => modal.classList.add('hidden'); }

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

function navigateSection(direction) {
    const currentCard = document.querySelector('.thematic-card.ring-2');
    if (!currentCard) return;

    let targetCard = null;
    let sibling = direction === 'next' ? currentCard.nextElementSibling : currentCard.previousElementSibling;
    while (sibling) {
        if (sibling.classList.contains('thematic-card')) { targetCard = sibling; break; }
        sibling = direction === 'next' ? sibling.nextElementSibling : sibling.previousElementSibling;
    }

    if (targetCard) {
        let scrollTarget = targetCard;
        const isSurahStart = targetCard.dataset.start === "1";
        if (isSurahStart) {
            const prev = targetCard.previousElementSibling;
            if (prev && prev.classList.contains('surah-mini-header')) scrollTarget = prev;
        }
        scrollToCard(scrollTarget);

        // brief delay for audio transition
        // Instead of using DOM click which may be throttled in background, directly call the logic.
        const s = parseInt(targetCard.dataset.surah);
        const start = parseInt(targetCard.dataset.start);
        const end = parseInt(targetCard.dataset.end);

        setTimeout(() => {
            document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
            targetCard.classList.add('ring-2', 'ring-[#56A3A6]');
            if (typeof playSession === 'function') playSession(s, start, end);
            document.dispatchEvent(new CustomEvent('manual-play-started', { detail: { card: targetCard } }));
        }, 500);

        triggerLookAheadPreload(targetCard);
    } else if (direction === 'next') {
        const currentId = parseInt(document.getElementById('surahSelect').value);
        if (currentViewMode === 'juz') {
            const nextJuz = currentId + 1;
            if (nextJuz <= 30) {
                document.getElementById('surahSelect').value = nextJuz;
                loadContent(nextJuz, null, true); // autoPlay = true
                if (window.showToast) window.showToast(`Loaded Juz ${nextJuz}`, 'library_books');
            }
        } else {
            const nextSurah = currentId + 1;
            if (nextSurah <= 114) {
                document.getElementById('surahSelect').value = nextSurah;
                loadContent(nextSurah, null, true); // autoPlay = true
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
        } catch (err) { console.error(`${err.name}, ${err.message}`); }
    }
}
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
    }
});

// NEW: Global Helper to get Surah Name for Audio Player
window.getSurahName = function (surahNum) {
    if (!QURAN_DATA.length) return `Surah ${surahNum}`;
    const row = QURAN_DATA.find(r => r[CONSTANTS.KEY_SURAH_NO] === surahNum);
    if (!row) return `Surah ${surahNum}`;
    const latin = row[CONSTANTS.KEY_SURAH_LATIN];
    return `${surahNum} ${latin}`;
};

// --- ANALYTICS HELPER ---
function sendAnalyticsEvent(eventName, params = {}) {
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
        console.log(`[Analytics] Sent: ${eventName}`, params);
    }
}

function setupAboutModal() {
    const modal = document.getElementById('aboutModal');
    const closeBtn = document.getElementById('closeAboutBtn');
    const startBtn = document.getElementById('startExploringBtn');
    const headerTitle = document.getElementById('headerTitleContainer');
    const HAS_VISITED_KEY = 'has_visited_v1';

    function openModal() {
        if (!modal) return;
        modal.classList.remove('hidden');
        sendAnalyticsEvent('view_item', { item_id: 'about_modal', item_name: 'About Modal' });
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.add('hidden');
        localStorage.setItem(HAS_VISITED_KEY, 'true');
    }

    // UPDATE: Header click now goes to Welcome Page (Surah 0)
    if (headerTitle) {
        headerTitle.addEventListener('click', () => {
            document.getElementById('surahSelect').value = "0";
            loadContent(0);
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (startBtn) startBtn.addEventListener('click', closeModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Auto-show on first visit
    if (!localStorage.getItem(HAS_VISITED_KEY)) {
        setTimeout(openModal, 1500);
    }
}

// --- SPEED CONTROL HELPERS ---
function setupSpeedControl(containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const speed = btn.dataset.speed;
            localStorage.setItem(`${type}Speed`, speed);
            updateSpeedUI(containerId, speed);
            document.dispatchEvent(new CustomEvent('speed-changed', { detail: { type: type, speed: speed } }));
            sendAnalyticsEvent('setting_changed', { category: 'audio', name: `speed_${type}`, value: speed });
        });
    });
}

function updateSpeedUI(containerId, activeSpeed) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Update Text Label
    let labelId = '';
    if (containerId === 'arabicSpeedControls') labelId = 'arabicSpeedValue';
    if (containerId === 'transSpeedControls') labelId = 'transSpeedValue';
    const label = document.getElementById(labelId);
    if (label) label.textContent = `(${activeSpeed}x)`;

    container.querySelectorAll('button').forEach(btn => {
        const isSelected = btn.dataset.speed === activeSpeed;
        if (isSelected) {
            // Active State
            btn.classList.remove('bg-white/5', 'hover:bg-white/10', 'text-white/60', 'border-white/5');
            btn.classList.add('bg-[#56A3A6]', 'text-white', 'border-[#56A3A6]', 'shadow-lg');
        } else {
            // Inactive State
            btn.classList.add('bg-white/5', 'hover:bg-white/10', 'text-white/60', 'border-white/5');
            btn.classList.remove('bg-[#56A3A6]', 'text-white', 'border-[#56A3A6]', 'shadow-lg');
        }
    });
}

function setupCustomScrollbar() {
    const thumb = document.getElementById('scrollThumb');
    const progress = document.getElementById('scrollProgress');
    const mainContainer = document.getElementById('mainContainer');
    const trackContainer = document.getElementById('customScrollbar');

    if (!thumb || !progress || !mainContainer || !trackContainer) return;

    // 1. Sync Scroll -> Custom Bar
    const updateCustomScroll = () => {
        const scrollTop = mainContainer.scrollTop;
        const scrollHeight = mainContainer.scrollHeight;
        const clientHeight = mainContainer.clientHeight;

        const scrollableHeight = scrollHeight - clientHeight;
        const percent = scrollableHeight > 0 ? scrollTop / scrollableHeight : 0;

        // Calculate thumb position within the viewport height
        // Thumb should stay within bounds (0% to 100% minus thumb height)
        const thumbHeight = 12; // 3rem = 12px roughly (w-3 h-3)
        const trackHeight = clientHeight;
        const availableHeight = trackHeight - thumbHeight;

        const thumbTop = percent * availableHeight;

        thumb.style.top = `${thumbTop}px`;
        progress.style.height = `${thumbTop + (thumbHeight / 2)}px`; // Trail ends at center of thumb
    };

    mainContainer.addEventListener('scroll', updateCustomScroll);
    window.addEventListener('resize', updateCustomScroll);

    // Initial call
    requestAnimationFrame(updateCustomScroll);

    // 2. Drag Logic
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onDragStart = (e) => {
        isDragging = true;
        thumb.classList.add('cursor-grabbing', 'scale-125');
        thumb.classList.remove('cursor-grab');

        // Get Y position (Mouse or Touch)
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startY = clientY;
        startScrollTop = mainContainer.scrollTop;

        // Prevent text selection while dragging
        document.body.style.userSelect = 'none';

        e.preventDefault(); // Prevent default selection
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Prevent scroll chain

        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - startY;

        // Calculate scroll change
        const trackHeight = mainContainer.clientHeight - 12;
        const scrollableHeight = mainContainer.scrollHeight - mainContainer.clientHeight;

        if (trackHeight > 0) {
            const deltaScroll = (deltaY / trackHeight) * scrollableHeight;
            mainContainer.scrollTop = startScrollTop + deltaScroll;
        }
    };

    const onDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        thumb.classList.remove('cursor-grabbing', 'scale-125');
        thumb.classList.add('cursor-grab');
        document.body.style.userSelect = '';
        thumb.style.transform = ''; // Clear inline transform if any
    };

    thumb.addEventListener('mousedown', onDragStart);
    thumb.addEventListener('touchstart', onDragStart, { passive: false });

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('touchmove', onDragMove, { passive: false });

    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchend', onDragEnd);
}

// ==========================================
// BOOKMARK MANAGEMENT
// ==========================================

window.isBookmarked = function(surah, start, end) {
    const saved = JSON.parse(localStorage.getItem('thematic_bookmarks')) || [];
    return saved.some(b => b.surah === parseInt(surah) && b.start === parseInt(start));
};

window.qfCollectionId = null;

window.initQfCollectionsSync = async function() {
    try {
        let fetchUrl = '/api/qf/auth/v1/collections?first=20&sortBy=recentlyUpdated';
        let found = false;
        let diagnosticList = [];

        // Recursively crawl EVERY page of the user's collections to physically guarantee we don't accidentally skip the folder if they have > 20
        while (fetchUrl && !found) {
            let res = await fetch(fetchUrl);
            if (!res.ok) {
                 console.error("[CloudSync] GET Collections blocked natively. Status:", res.status);
                 return;
            }

            let json = await res.json();
            
            // Defensively extract across multiple known API schema formats natively
            let list = [];
            if (Array.isArray(json.data)) list = json.data;
            else if (json.data && Array.isArray(json.data.collections)) list = json.data.collections;
            else if (Array.isArray(json.collections)) list = json.collections;
            else if (Array.isArray(json)) list = json;
            
            diagnosticList.push(...list.map(c => c.name));

            let target = list.find(c => c.name && c.name.trim().toLowerCase() === "thematic quran saves");
            if (target) {
                window.qfCollectionId = target.id || target.collectionId;
                found = true;
                console.log("[CloudSync] Found Existing Collection cleanly:", window.qfCollectionId);
                break;
            }

            // If we physically survived this page without confirming existence, attempt to safely advance the cursor
            if (json.pagination && json.pagination.hasNextPage && json.pagination.endCursor) {
                fetchUrl = `/api/qf/auth/v1/collections?first=20&sortBy=recentlyUpdated&after=${json.pagination.endCursor}`;
            } else {
                fetchUrl = null; // Kill the traversal loop instantly because we inherently hit rock bottom
            }
        }
        
        // Only if we violently exhausted every single physically available page across their account will we build a new one
        if (!found) {
            console.log("[CloudSync] Target collection naturally hidden or absent. Will bootstrap dynamically on first save.");
            window.qfCollectionId = null;
        }

        if (window.qfCollectionId) {
            await window.execTwoWayBookmarkSync();
        }
    } catch(e) {
        console.error("[CloudSync] Collections Init Error:", e);
    }
};

window.execTwoWayBookmarkSync = async function() {
    try {
        console.log("[CloudSync] Booting Two-Way Merge Engine...");
        let remoteRes = await fetch(`/api/qf/auth/v1/collections/all?first=20`);
        if (!remoteRes.ok) return;
        
        let rJson = await remoteRes.json();
        let remoteList = [];
        if (Array.isArray(rJson.data)) remoteList = rJson.data;
        else if (rJson.data && Array.isArray(rJson.data.bookmarks)) remoteList = rJson.data.bookmarks;
        else if (Array.isArray(rJson.bookmarks)) remoteList = rJson.bookmarks;
        else if (Array.isArray(rJson)) remoteList = rJson;

        let localSaved = JSON.parse(localStorage.getItem('thematic_bookmarks')) || [];
        let didMutateLocal = false;

        // 1. Download missing nodes from Cloud => Local Memory
        remoteList.forEach(rbObj => {
            const rb = rbObj.bookmark || rbObj;
            const rSurah = parseInt(rb.key || rb.chapterNumber || rb.chapter_number);
            const rStart = parseInt(rb.verseNumber || rb.verse_number);
            const rId = rb.id || rbObj.id;

            if (rSurah && rStart) {
                let localIdx = localSaved.findIndex(lb => lb.surah === rSurah && lb.start === rStart);
                if (localIdx === -1) {
                    const surahSelect = document.getElementById('surahSelect');
                    let sName = `Surah ${rSurah}`;
                    if (surahSelect) {
                        const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === rSurah);
                        if (option) sName = option.text;
                    }
                    
                    localSaved.push({
                        surah: rSurah,
                        start: rStart,
                        end: rStart, // Auto-filling the visual range since Quran.com only anchors singular Ayahs natively
                        remoteId: rId,
                        timestamp: Date.now(),
                        surahName: sName
                    });
                    didMutateLocal = true;
                } else if (!localSaved[localIdx].remoteId) {
                    localSaved[localIdx].remoteId = rId;
                    didMutateLocal = true;
                }
            }
        });

        // 2. Upload missing local nodes => Cloud Folder
        for (let i=0; i<localSaved.length; i++) {
            let lb = localSaved[i];
            if (!lb.remoteId) {
                const payload = {
                    key: lb.surah,
                    type: "ayah",
                    verseNumber: lb.start,
                    mushaf: 1
                };
                
                try {
                     let upRes = await fetch(`/api/qf/auth/v1/collections/${window.qfCollectionId}/bookmarks`, {
                         method: 'POST',
                         headers: {'Content-Type': 'application/json'},
                         body: JSON.stringify(payload)
                     });
                     let j = await upRes.json();
                     if (j && j.data && j.data.id) {
                          lb.remoteId = j.data.id;
                          didMutateLocal = true;
                          console.log("[CloudSync] Auto-Pushed Native Local to Cloud:", lb.remoteId);
                     }
                } catch(e) {}
            }
        }

        if (didMutateLocal) {
            localStorage.setItem('thematic_bookmarks', JSON.stringify(localSaved));
            if (window.renderBookmarksGallery) window.renderBookmarksGallery();
        }

    } catch (e) {
        console.error("[CloudSync] Two-way sync engine failure:", e);
    }
};

window.toggleBookmark = async function(surah, start, end, data) {
    let saved = JSON.parse(localStorage.getItem('thematic_bookmarks')) || [];
    const s = parseInt(surah); 
    const st = parseInt(start); 
    const e = parseInt(end);
    let idx = saved.findIndex(b => b.surah === s && b.start === st);
    
    if (idx >= 0) {
        const deletedObj = saved[idx];
        saved.splice(idx, 1);
        localStorage.setItem('thematic_bookmarks', JSON.stringify(saved));
        if (window.renderBookmarksGallery) window.renderBookmarksGallery();
        
        // Cloud Delete Execution
        if (window.qfCollectionId) {
            if (deletedObj.remoteId) {
                fetch(`/api/qf/auth/v1/collections/${window.qfCollectionId}/bookmarks/${deletedObj.remoteId}`, {
                    method: 'DELETE'
                }).then(r => {
                    if (r.ok) {
                        console.log("[CloudSync] Destroyed remote anchor.");
                        if (saved.length === 0) {
                            fetch(`/api/qf/auth/v1/collections/${window.qfCollectionId}`, { method: 'DELETE' }).catch(()=>{});
                            console.log("[CloudSync] Local array natively empty. Erased native Cloud Folder.");
                            window.qfCollectionId = null;
                        }
                    }
                }).catch(()=>{});
            } else {
                console.log("[CloudSync] Deletion skipped explicitly: No Remote ID localized.");
            }
        }
        return false;
    } else {
        const surahSelect = document.getElementById('surahSelect');
        let surahName = `Surah ${s}`;
        if (surahSelect) {
            const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === s);
            if (option) surahName = option.text;
        }
        
        const newObj = {
            surah: s,
            surahName: surahName,
            start: st,
            end: e,
            timestamp: Date.now()
        };
        saved.push(newObj);
        localStorage.setItem('thematic_bookmarks', JSON.stringify(saved));
        if (window.showToast) window.showToast("Bookmark saved", "bookmark_added");
        if (window.renderBookmarksGallery) window.renderBookmarksGallery();
        
        // Cloud Write Execution
        if (!window.qfCollectionId) {
             try {
                 let upRes = await fetch('/api/qf/auth/v1/collections', {
                     method: 'POST',
                     headers: {'Content-Type': 'application/json'},
                     body: JSON.stringify({ name: "Thematic Quran Saves" })
                 });
                 let upJson = await upRes.json();
                 if (upJson.data && upJson.data.id) {
                     window.qfCollectionId = upJson.data.id;
                     console.log("[CloudSync] Late-bootstrapped Native Collection:", window.qfCollectionId);
                 }
             } catch(e) {}
        }
        
        if (window.qfCollectionId) {
            const payload = {
                key: s,             // The Surah number
                type: "ayah",       // The bookmark type
                verseNumber: st,    // The verse number
                mushaf: 1           // 1 = QCFV2
            };
            
            const writeEp = `/api/qf/auth/v1/collections/${window.qfCollectionId}/bookmarks`;
            fetch(writeEp, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            }).then(r => r.json()).then(async j => {
                 if (j.success !== false) {
                      // Because POST physically refuses to return the generated bookmark ID in the successful body {}, 
                      // we rapidly trigger the TwoWayMerge Engine quietly in the background to instantaneously fetch it globally!
                      if (window.execTwoWayBookmarkSync) await window.execTwoWayBookmarkSync();
                 }
            }).catch(e => console.error("[CloudSync] Network Write failed", e));
        }
        return true; 
    }
};

window.renderBookmarksGallery = function() {
    const container = document.getElementById('bookmarksContainer');
    if (!container) return;
    
    let saved = JSON.parse(localStorage.getItem('thematic_bookmarks')) || [];
    if (saved.length === 0) {
        container.innerHTML = '<div class="text-white/40 text-center mt-20 font-[\'Nunito\']">You haven\'t saved any bookmarks yet.</div>';
        return;
    }
    
    // Sort ascending by Surah, then Start Ayah
    saved.sort((a, b) => {
        if (a.surah !== b.surah) return a.surah - b.surah;
        return a.start - b.start;
    });
    
    container.innerHTML = '';
    
    saved.forEach(b => {
        const item = document.createElement('div');
        item.className = "bg-white/5 hover:bg-[#56A3A6]/10 transition duration-300 rounded-2xl p-6 border border-white/10 hover:border-[#56A3A6]/30 flex items-center justify-between cursor-pointer group";
        
        item.innerHTML = `
            <div>
                <h4 class="text-white font-bold font-['Forum'] text-xl md:text-2xl mb-1 group-hover:text-[#56A3A6] transition">${b.surahName}</h4>
                <p class="text-[#56A3A6] text-xs font-bold uppercase tracking-widest font-['Nunito']">Verses ${b.start} - ${b.end}</p>
            </div>
            <div class="flex items-center gap-2 md:gap-4">
                <button class="bookmark-delete-btn text-white/30 hover:text-red-400 p-2 rounded-full hover:bg-red-400/10 transition z-10" aria-label="Delete Bookmark">
                    <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
                <button class="bookmark-play-btn bg-[#56A3A6] w-12 h-12 rounded-full flex items-center justify-center text-white shadow-[0_5px_15px_rgba(86,163,166,0.3)] hover:scale-105 active:scale-95 transition focus:outline-none z-10">
                    <span class="material-symbols-outlined">play_arrow</span>
                </button>
            </div>
        `;
        
        // Navigate Only (Row Click)
        item.onclick = (e) => {
            const modal = document.getElementById('bookmarksModal');
            if (modal) modal.classList.add('hidden');
            
            const surahSelect = document.getElementById('surahSelect');
            if (surahSelect && surahSelect.value !== b.surah.toString()) {
                surahSelect.value = b.surah;
                surahSelect.dispatchEvent(new Event('change'));
                
                setTimeout(() => {
                    const cardId = `section-${b.surah}-${b.start}`;
                    const card = document.getElementById(cardId);
                    if (card) { 
                        card.scrollIntoView({behavior: 'smooth', block: 'center'}); 
                    }
                }, 800);
            } else {
                const cardId = `section-${b.surah}-${b.start}`;
                const card = document.getElementById(cardId);
                if (card) { 
                    card.scrollIntoView({behavior: 'smooth', block: 'center'}); 
                }
            }
        };

        // Delete Logic
        const deleteBtn = item.querySelector('.bookmark-delete-btn');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            window.toggleBookmark(b.surah, b.start, b.end, null);
            
            // Sync with physical UI card if currently loaded
            const cardBtn = document.querySelector(`.bookmark-toggle-btn[data-surah="${b.surah}"][data-start="${b.start}"]`);
            if (cardBtn) {
                cardBtn.innerHTML = `<span class="material-symbols-outlined text-xl" aria-hidden="true">bookmark_border</span>`;
                cardBtn.classList.remove('text-[#56A3A6]');
            }
        };

        // Play Logic
        const playBtn = item.querySelector('.bookmark-play-btn');
        playBtn.onclick = (e) => {
            e.stopPropagation();
            const modal = document.getElementById('bookmarksModal');
            if (modal) modal.classList.add('hidden');
            
            const surahSelect = document.getElementById('surahSelect');
            if (surahSelect && surahSelect.value !== b.surah.toString()) {
                surahSelect.value = b.surah;
                surahSelect.dispatchEvent(new Event('change'));
                
                setTimeout(() => {
                    const cardId = `section-${b.surah}-${b.start}`;
                    const card = document.getElementById(cardId);
                    if (card) { 
                        card.scrollIntoView({behavior: 'smooth', block: 'center'}); 
                        if(window.handleCardPlayClick) window.handleCardPlayClick(card, b.surah, b.start, b.end); 
                    }
                }, 800);
            } else {
                const cardId = `section-${b.surah}-${b.start}`;
                const card = document.getElementById(cardId);
                if (card) { 
                    card.scrollIntoView({behavior: 'smooth', block: 'center'}); 
                    if(window.handleCardPlayClick) window.handleCardPlayClick(card, b.surah, b.start, b.end); 
                }
            }
        };

        container.appendChild(item);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const openBtn = document.getElementById('openBookmarksBtn');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            if (window.renderBookmarksGallery) window.renderBookmarksGallery();
            const modal = document.getElementById('bookmarksModal');
            if (modal) modal.classList.remove('hidden');
        });
    }
    
    const closeBtn = document.getElementById('closeBookmarksBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('bookmarksModal');
            if (modal) modal.classList.add('hidden');
        });
    }
});