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
// A remembered cookie is not proof of authentication. This becomes true only
// after the live Quran.com profile check succeeds.
window.isLoggedIn = false;
// Thematic labels — exposed on window so ui-renderer.js (separate script) can read them.
window.THEMATIC_TAXONOMY = null;
window.THEMATIC_ASSIGNMENTS = null;
let activeThematicFilters = new Set();
let thematicFilterGroups = [{ id: 1, op: 'or', terms: [] }];
let activeThematicFilterGroupId = 1;
let nextThematicFilterGroupId = 2;
let thematicFilterScope = 'quran';
// Mirrors the active row's op for the existing ANY/ALL buttons.
let thematicFilterMatchMode = 'any';
let thematicResultSortMode = 'mushaf';
// Surah metadata (Makki/Madani + Cairo Edition revelation order) — loaded on init.
window.SURAH_METADATA = null;
let syncPromptDismissTimer = null;
let currentFontScale = 1.0;
let isEditMode = false;
let currentViewMode = 'surah';
let isSelectMode = false;
let selectedItems = new Set();
const MAX_SELECTION = 3;
const STORAGE_KEY_SCALE = 'fontScale_v2';
const CORE_DATA_FETCH_TIMEOUT_MS = 30000;
const OPTIONAL_LABEL_FETCH_TIMEOUT_MS = 5000;

function readResumeState() {
    try {
        const raw = localStorage.getItem('resumeState');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('[resume] Failed to parse saved state', error);
        return null;
    }
}

function saveResumeState(state, options = {}) {
    const previous = readResumeState() || {};
    const shouldTouch = options.touch !== false;
    const nextState = {
        ...state,
        updatedAt: shouldTouch ? Date.now() : (state.updatedAt || previous.updatedAt || Date.now())
    };
    localStorage.setItem('resumeState', JSON.stringify(nextState));
    return nextState;
}

function getQuranSessionTimestampMs(session) {
    const candidates = [
        session.updatedAt,
        session.updated_at,
        session.lastReadAt,
        session.last_read_at,
        session.lastReadTime,
        session.last_read_time,
        session.createdAt,
        session.created_at
    ];

    for (const value of candidates) {
        if (!value) continue;
        const parsed = typeof value === 'number' ? value : Date.parse(value);
        if (Number.isFinite(parsed)) return parsed < 100000000000 ? parsed * 1000 : parsed;
    }
    return null;
}

function dismissQuranSyncPrompt() {
    if (syncPromptDismissTimer) {
        clearTimeout(syncPromptDismissTimer);
        syncPromptDismissTimer = null;
    }
    document.getElementById('syncConflictModal')?.classList.add('translate-x-[150%]');
}

window.dismissQuranSyncPrompt = dismissQuranSyncPrompt;

async function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`${url} returned ${response.status}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

async function loadThematicLabelData() {
    try {
        const [taxonomy, assignments] = await Promise.all([
            fetchJsonWithTimeout('data/thematic_labels/taxonomy.json', OPTIONAL_LABEL_FETCH_TIMEOUT_MS),
            fetchJsonWithTimeout('data/thematic_labels/assignments.json', OPTIONAL_LABEL_FETCH_TIMEOUT_MS)
        ]);

        window.THEMATIC_TAXONOMY = taxonomy;
        window.THEMATIC_ASSIGNMENTS = assignments;
    } catch (error) {
        window.THEMATIC_TAXONOMY = null;
        window.THEMATIC_ASSIGNMENTS = null;
        console.warn('[filter] Thematic labels unavailable; continuing without filters.', error);
    }
}

async function loadSurahMetadata() {
    try {
        const meta = await fetchJsonWithTimeout('data/surah_metadata.json', OPTIONAL_LABEL_FETCH_TIMEOUT_MS);
        window.SURAH_METADATA = meta && meta.surahs ? meta.surahs : null;
    } catch (error) {
        window.SURAH_METADATA = null;
        console.warn('[filter] Surah metadata unavailable; Makki/Madani/revelation scopes will be disabled.', error);
    }
}

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
        const [quranData, themeBreaks] = await Promise.all([
            fetchJsonWithTimeout('data/quran_data.json', CORE_DATA_FETCH_TIMEOUT_MS),
            fetchJsonWithTimeout('data/theme_breaks.json', CORE_DATA_FETCH_TIMEOUT_MS)
        ]);

        QURAN_DATA = quranData;
        THEME_BREAKS = themeBreaks;

        // Thematic labels are optional. The page must still render if they
        // are missing, slow, or temporarily blocked by the local server.
        await Promise.all([loadThematicLabelData(), loadSurahMetadata()]);

        setupGlobalEventListeners();
        setupCustomScrollbar(); // NEW: Custom Scrollbar Init
        setupThematicFilterUI();
        wireHeroWidget();

        const restoredQueryFromUrl = restoreThematicQueryFromUrl();
        if (restoredQueryFromUrl) {
            // Query links own the initial view when present.
        } else if (window.location.hash) {
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
    if (typeof applyFiltersToView === 'function') applyFiltersToView();

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
                saveResumeState({ mode: 'surah', id: surahId, startVerse: start });
            }
        } else {
            const firstCard = document.querySelector('.thematic-card');
            if (firstCard) {
                if (typeof preloadNextSection === 'function') {
                    const s = parseInt(firstCard.dataset.surah);
                    const start = parseInt(firstCard.dataset.start);
                    const end = parseInt(firstCard.dataset.end);
                    preloadNextSection(s, start, end);
                    saveResumeState({ mode: 'surah', id: surahId, startVerse: 1 }, { touch: false });
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
    if (typeof applyFiltersToView === 'function') applyFiltersToView();

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
    const headerTitle = document.getElementById('headerTitleContainer');
    function goToWelcomePage() {
        if (typeof stopAllAudio === 'function') stopAllAudio();
        if (typeof window.closeThemeSearchSidebar === 'function' && isThemeSearchPageOpen()) {
            window.closeThemeSearchSidebar({ skipApply: true });
        }
        const settingsSidebar = document.getElementById('settingsSidebar');
        const settingsBackdrop = document.getElementById('settingsBackdrop');
        if (settingsSidebar) settingsSidebar.classList.add('translate-x-full');
        if (settingsBackdrop) {
            settingsBackdrop.classList.add('opacity-0');
            settingsBackdrop.classList.add('hidden');
        }
        currentViewMode = 'surah';
        const viewSelect = document.getElementById('viewModeSelect');
        if (viewSelect) viewSelect.value = 'surah';
        populateDropdown();
        const surahSelect = document.getElementById('surahSelect');
        if (surahSelect) surahSelect.value = "0";
        loadContent(0);
        sendAnalyticsEvent('ui_interaction', { action: 'header_home' });
    }

    if (headerTitle) {
        headerTitle.addEventListener('click', goToWelcomePage);
        headerTitle.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                goToWelcomePage();
            }
        });
    }

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

    // ============================================================
    // DISPLAY & ACCESSIBILITY CONTROLS (Phase 2.2)
    // ============================================================
    (function initA11yControls() {
        const contentArea = document.getElementById('contentArea');
        const mainContainer = document.getElementById('mainContainer');
        const spacingMap = { normal: '1.6', relaxed: '2.15', loose: '2.6' };
        const widthMap = { narrow: '36rem', 'default': '56rem', wide: '72rem' };

        // =====================================================
        // ASSISTED READING — umbrella toggle
        // =====================================================
        const assistedToggle = document.getElementById('assistedReadingToggle');
        const assistedHint = document.getElementById('assistedReadingHint');
        const ASSISTED_KEY = 'a11y-assisted';

        function setAssistedReading(on, { announce = true, syncSubs = true } = {}) {
            document.body.classList.toggle('a11y-assisted', on);
            localStorage.setItem(ASSISTED_KEY, on);
            if (assistedToggle) assistedToggle.checked = on;
            if (assistedHint) assistedHint.classList.toggle('hidden', !on);

            if (syncSubs) {
                // Activate / deactivate sub-features
                const subs = [
                    { id: 'dyslexiaFontToggle',  key: 'a11y-dyslexia-font',  cls: 'a11y-dyslexia' },
                    { id: 'reduceMotionToggle',   key: 'a11y-reduce-motion',  cls: 'a11y-reduce-motion' },
                    { id: 'focusModeToggle',      key: 'a11y-focus-mode',     cls: 'a11y-focus-mode' },
                    { id: 'sepiaTintToggle',      key: 'a11y-sepia',          cls: 'a11y-sepia' },
                ];
                subs.forEach(({ id, key, cls }) => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.checked = on;
                        localStorage.setItem(key, on);
                        if (cls === 'a11y-focus-mode') {
                            setFocusMode(on);
                        } else {
                            document.body.classList.toggle(cls, on);
                        }
                    }
                });
                // Line spacing → relaxed when on, normal when off
                const spacingVal = on ? 'relaxed' : 'normal';
                localStorage.setItem('a11y-line-spacing', spacingVal);
                applyLineSetting('line-spacing', spacingVal);
                syncA11yBtnGroup('.a11y-spacing-btn', 'spacing', spacingVal);
                const spacingLabel = document.querySelector(`.a11y-spacing-btn[data-spacing="${spacingVal}"]`);
                if (spacingLabel) document.getElementById('lineSpacingValue').textContent = spacingLabel.textContent;

                // Reading width → narrow when on, default when off
                const widthVal = on ? 'narrow' : 'default';
                localStorage.setItem('a11y-reading-width', widthVal);
                applyLineSetting('reading-width', widthVal);
                syncA11yBtnGroup('.a11y-width-btn', 'width', widthVal);
                const widthLabel = document.querySelector(`.a11y-width-btn[data-width="${widthVal}"]`);
                if (widthLabel) document.getElementById('readingWidthValue').textContent = widthLabel.textContent;
            }

            // ARIA announcement
            if (announce) {
                let liveRegion = document.getElementById('a11y-verse-announce');
                if (!liveRegion) {
                    liveRegion = document.createElement('div');
                    liveRegion.id = 'a11y-verse-announce';
                    liveRegion.setAttribute('role', 'status');
                    liveRegion.setAttribute('aria-live', 'polite');
                    liveRegion.setAttribute('aria-atomic', 'true');
                    liveRegion.className = 'sr-only';
                    liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
                    document.body.appendChild(liveRegion);
                }
                liveRegion.textContent = on
                    ? 'Assisted Reading enabled. Layout optimised for accessibility.'
                    : 'Assisted Reading disabled. Default layout restored.';
            }
        }

        // Restore on load
        const assistedSaved = localStorage.getItem(ASSISTED_KEY) === 'true';
        if (assistedSaved) setAssistedReading(true, { announce: false });

        // Toggle listener
        if (assistedToggle) {
            assistedToggle.addEventListener('change', () => {
                setAssistedReading(assistedToggle.checked);
            });
        }

        // Keyboard shortcut: Alt+A / Option+A from anywhere.
        // On macOS, Option can change event.key to a special character, while
        // event.code still reports the physical A key.
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'KeyA' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                setAssistedReading(localStorage.getItem(ASSISTED_KEY) !== 'true');
            }
        });

        // URL parameter: ?assisted=1
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('assisted') === '1' && !assistedSaved) {
                setAssistedReading(true);
            }
        } catch (_) { /* URL parsing unsupported */ }

        // prefers-contrast: more — one-time prompt
        try {
            if (window.matchMedia('(prefers-contrast: more)').matches && !localStorage.getItem(ASSISTED_KEY)) {
                let liveRegion = document.getElementById('a11y-verse-announce');
                if (!liveRegion) {
                    liveRegion = document.createElement('div');
                    liveRegion.id = 'a11y-verse-announce';
                    liveRegion.setAttribute('role', 'status');
                    liveRegion.setAttribute('aria-live', 'polite');
                    liveRegion.setAttribute('aria-atomic', 'true');
                    liveRegion.className = 'sr-only';
                    liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
                    document.body.appendChild(liveRegion);
                }
                liveRegion.textContent = 'This site supports Assisted Reading for enhanced accessibility. Press Alt+A, Option+A on Mac, or open Settings to enable.';
            }
        } catch (_) { /* matchMedia unsupported */ }

        // Verse-change vibration (only when Assisted Reading is on)
        document.addEventListener('verse-changed', () => {
            if (document.body.classList.contains('a11y-assisted') && navigator.vibrate) {
                navigator.vibrate(50);
            }
        });

        // --- Line Spacing ---
        const savedSpacing = localStorage.getItem('a11y-line-spacing') || 'normal';
        applyLineSetting('line-spacing', savedSpacing);

        document.querySelectorAll('.a11y-spacing-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.spacing;
                localStorage.setItem('a11y-line-spacing', val);
                applyLineSetting('line-spacing', val);
                syncA11yBtnGroup('.a11y-spacing-btn', 'spacing', val);
                document.getElementById('lineSpacingValue').textContent = btn.textContent;
            });
        });
        syncA11yBtnGroup('.a11y-spacing-btn', 'spacing', savedSpacing);
        const spacingLabel = document.querySelector(`.a11y-spacing-btn[data-spacing="${savedSpacing}"]`);
        if (spacingLabel) document.getElementById('lineSpacingValue').textContent = spacingLabel.textContent;

        // --- Reading Width ---
        const savedWidth = localStorage.getItem('a11y-reading-width') || 'default';
        applyLineSetting('reading-width', savedWidth);

        document.querySelectorAll('.a11y-width-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.width;
                localStorage.setItem('a11y-reading-width', val);
                applyLineSetting('reading-width', val);
                syncA11yBtnGroup('.a11y-width-btn', 'width', val);
                document.getElementById('readingWidthValue').textContent = btn.textContent;
            });
        });
        syncA11yBtnGroup('.a11y-width-btn', 'width', savedWidth);
        const widthLabel = document.querySelector(`.a11y-width-btn[data-width="${savedWidth}"]`);
        if (widthLabel) document.getElementById('readingWidthValue').textContent = widthLabel.textContent;

        // --- Dyslexia Font ---
        const dyslexiaToggle = document.getElementById('dyslexiaFontToggle');
        const dyslexiaSaved = localStorage.getItem('a11y-dyslexia-font') === 'true';
        dyslexiaToggle.checked = dyslexiaSaved;
        if (dyslexiaSaved) document.body.classList.add('a11y-dyslexia');

        dyslexiaToggle.addEventListener('change', () => {
            const on = dyslexiaToggle.checked;
            localStorage.setItem('a11y-dyslexia-font', on);
            document.body.classList.toggle('a11y-dyslexia', on);
        });

        // --- Reduce Motion toggle ---
        const motionToggle = document.getElementById('reduceMotionToggle');
        const motionSaved = localStorage.getItem('a11y-reduce-motion') === 'true';
        motionToggle.checked = motionSaved || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (motionSaved) document.body.classList.add('a11y-reduce-motion');

        motionToggle.addEventListener('change', () => {
            const on = motionToggle.checked;
            localStorage.setItem('a11y-reduce-motion', on);
            document.body.classList.toggle('a11y-reduce-motion', on);
        });

        // --- Focus Mode ---
        const focusToggle = document.getElementById('focusModeToggle');
        const focusSaved = localStorage.getItem('a11y-focus-mode') === 'true';
        const sepiaSaved = localStorage.getItem('a11y-sepia') === 'true';
        if (sepiaSaved) document.body.classList.add('a11y-sepia');
        focusToggle.checked = focusSaved;
        setFocusMode(focusSaved);

        focusToggle.addEventListener('change', () => {
            const on = focusToggle.checked;
            localStorage.setItem('a11y-focus-mode', on);
            setFocusMode(on);
        });

        // --- Sepia Tint ---
        const sepiaToggle = document.getElementById('sepiaTintToggle');
        sepiaToggle.checked = sepiaSaved;

        sepiaToggle.addEventListener('change', () => {
            const on = sepiaToggle.checked;
            localStorage.setItem('a11y-sepia', on);
            document.body.classList.toggle('a11y-sepia', on);
            setFocusMode(document.body.classList.contains('a11y-focus-mode'));
        });

        // --- Helpers ---
        function applyLineSetting(type, val) {
            if (type === 'line-spacing') {
                const lh = spacingMap[val] || spacingMap.normal;
                if (contentArea) contentArea.style.setProperty('--a11y-line-height', lh);
            }
            if (type === 'reading-width') {
                const mw = widthMap[val] || widthMap['default'];
                if (contentArea) contentArea.style.maxWidth = mw;
            }
        }

        function setFocusMode(on) {
            document.body.classList.toggle('a11y-focus-mode', on);
            const header = document.getElementById('mainHeader');
            if (!header) return;

            if (on) {
                const sepiaOn = document.body.classList.contains('a11y-sepia');
                const headerBg = sepiaOn ? 'rgba(42, 34, 24, 0.96)' : 'rgba(18, 16, 28, 0.96)';
                const headerBorder = sepiaOn ? 'rgba(243, 228, 206, 0.16)' : 'rgba(255, 255, 255, 0.14)';
                header.style.setProperty('opacity', '1', 'important');
                header.style.setProperty('background-color', headerBg, 'important');
                header.style.setProperty('border-bottom-color', headerBorder, 'important');
                header.style.setProperty('box-shadow', '0 14px 40px rgba(0, 0, 0, 0.45)', 'important');
                header.style.setProperty('backdrop-filter', 'blur(24px)', 'important');
                header.style.setProperty('-webkit-backdrop-filter', 'blur(24px)', 'important');
            } else {
                header.style.removeProperty('opacity');
                header.style.removeProperty('background-color');
                header.style.removeProperty('border-bottom-color');
                header.style.removeProperty('box-shadow');
                header.style.removeProperty('backdrop-filter');
                header.style.removeProperty('-webkit-backdrop-filter');
            }
        }

        function syncA11yBtnGroup(selector, dataKey, activeVal) {
            document.querySelectorAll(selector).forEach(b => {
                const isActive = b.dataset[dataKey] === activeVal;
                b.classList.toggle('bg-[#56A3A6]', isActive);
                b.classList.toggle('text-white', isActive);
                b.classList.toggle('border-[#56A3A6]', isActive);
                b.classList.toggle('shadow-lg', isActive);
                b.classList.toggle('bg-white/5', !isActive);
                b.classList.toggle('text-white/60', !isActive);
                b.classList.toggle('border-white/5', !isActive);
            });
        }
    })();

    const sidebar = document.getElementById('settingsSidebar');
    const backdrop = document.getElementById('settingsBackdrop');
    const settingsAuthDock = document.getElementById('settingsAuthDock');
    const settingsScrollArea = document.getElementById('settingsScrollArea');
    function syncSettingsAuthDock() {
        if (!settingsAuthDock || !settingsScrollArea) return;
        settingsAuthDock.classList.toggle('is-compact', settingsScrollArea.scrollTop > 12);
    }
    function openSettings() {
        if (settingsScrollArea) settingsScrollArea.scrollTop = 0;
        syncSettingsAuthDock();
        backdrop.classList.remove('hidden');
        setTimeout(() => { backdrop.classList.remove('opacity-0'); sidebar.classList.remove('translate-x-full'); }, 10);
        sendAnalyticsEvent('ui_interaction', { action: 'open_settings' });
    }
    function closeSettings() { sidebar.classList.add('translate-x-full'); backdrop.classList.add('opacity-0'); setTimeout(() => { backdrop.classList.add('hidden'); }, 300); }
    document.getElementById('openSettingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
    backdrop.addEventListener('click', closeSettings);
    if (settingsScrollArea) settingsScrollArea.addEventListener('scroll', syncSettingsAuthDock, { passive: true });

    const settingsFeedbackLink = document.getElementById('settingsFeedbackLink');
    if (settingsFeedbackLink) {
        settingsFeedbackLink.addEventListener('click', () => {
            settingsFeedbackLink.href = buildFeedbackUrl('settings');
            sendAnalyticsEvent('ui_interaction', { action: 'open_feedback', source: 'settings' });
        });
    }

    const audio = document.getElementById('audioElement');
    document.getElementById('globalPlayPauseBtn').addEventListener('click', () => {
        dismissQuranSyncPrompt();
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
        dismissQuranSyncPrompt();
        saveResumeState({ mode: currentViewMode, id: id, startVerse: startVerse });

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
        saveResumeState({ mode: currentViewMode, id: id, startVerse: verse });

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
        window.currentReadingCoords = { surah: parseInt(surah), verse: parseInt(verse) };
    });

    // Native Background Activity-Days Aggregator (Stopwatch)
    if (!window.activityTrackerRunning) {
        window.activityTrackerRunning = true;
        window.unreportedSeconds = 0;
        window.currentReadingCoords = { surah: 1, verse: 1 };
        
        setInterval(() => {
            let audio = document.getElementById('audioElement');
            if (audio && !audio.paused && window.isLoggedIn) {
                window.unreportedSeconds++;
                if (window.unreportedSeconds >= 15) { // Push heartbeat broadly every 15 active seconds seamlessly
                    let fSec = window.unreportedSeconds;
                    window.unreportedSeconds = 0; 
                    
                    const dy = new Date();
                    const urlFormattedDate = `${dy.getFullYear()}-${String(dy.getMonth()+1).padStart(2,'0')}-${String(dy.getDate()).padStart(2,'0')}`;
                    
                    const payload = {
                        date: urlFormattedDate,
                        type: "QURAN",
                        seconds: fSec,
                        ranges: [`${window.currentReadingCoords.surah}:${window.currentReadingCoords.verse}-${window.currentReadingCoords.surah}:${window.currentReadingCoords.verse}`],
                        mushafId: 1
                    };
                    
                    fetch('/api/qf/auth/v1/activity-days', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).then(r => r.json()).then(j => {
                        let sc = document.getElementById('siratContainer');
                        if (sc && sc.style.opacity === '1') window.initSiratVisualizer(true); // Repaint canvas smoothly
                    }).catch(()=>{});
                }
            }
        }, 1000);
    }

    const bottomLoginBtn = document.getElementById('bottomQuranLoginBtn');
    if (bottomLoginBtn) {
        bottomLoginBtn.addEventListener('click', () => {
            if (window.isLoggedIn) {
                if (window.showToast) window.showToast('Already logged in with Quran.com', 'verified');
                return;
            }
            sendAnalyticsEvent('auth_initiated', { provider: 'quran.com', source: 'bottom_bar' });
            window.location.href = '/auth/login';
        });
    }
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
    const quranLoginBtn = document.getElementById('quranLoginBtn');
    const quranLogoutBtn = document.getElementById('quranLogoutBtn');
    const loggedOutState = document.getElementById('loggedOutState');
    const loggedInState = document.getElementById('loggedInState');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const userInitial = document.getElementById('userInitial');

    const QURAN_PROFILE_URL = '/api/qf/auth/v1/users/profile';
    const SILENT_AUTH_TIMEOUT_MS = 12000;
    let authInitialized = false;

    function hasAccessTokenCookie() {
        return document.cookie.split(';').some(cookie => cookie.trim().startsWith('quran_access_token_'));
    }

    function showLoggedOutState() {
        window.isLoggedIn = false;
        loggedInState.classList.add('hidden');
        loggedOutState.classList.remove('hidden');
        document.body.classList.remove('is-logged-in');
    }

    function renderUserProfile(profile) {
        const fetchedName = profile.firstName || profile.username || profile.name || profile.given_name || profile.first_name;
        const displayName = fetchedName || 'Quran.com user';
        const picture = profile.avatar_url || profile.picture || profile.avatar || profile.photo || profile.avatarUrl || profile.pictureUrl;

        welcomeMessage.textContent = `Assalamu alaikum, ${displayName}`;
        userInitial.replaceChildren();

        if (picture) {
            const image = document.createElement('img');
            image.src = picture;
            image.alt = 'Profile';
            image.className = 'w-full h-full rounded-full object-cover';
            userInitial.appendChild(image);
        } else {
            userInitial.textContent = displayName.charAt(0).toUpperCase();
        }
    }

    async function validateCurrentSession() {
        if (!hasAccessTokenCookie()) {
            return { authenticated: false, reason: 'missing_token' };
        }

        try {
            const response = await fetch(QURAN_PROFILE_URL, {
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            });

            let payload = null;
            try {
                payload = await response.json();
            } catch (error) {
                return { authenticated: false, reason: 'invalid_profile_response' };
            }

            if (!response.ok || !payload || payload.error || payload.type === 'invalid_token') {
                return {
                    authenticated: false,
                    reason: payload?.error || payload?.type || `profile_${response.status}`
                };
            }

            const profile = payload.data || payload;
            if (!profile || typeof profile !== 'object') {
                return { authenticated: false, reason: 'missing_profile' };
            }

            return { authenticated: true, profile };
        } catch (error) {
            console.debug('Quran.com session validation failed:', error);
            return { authenticated: false, reason: 'profile_unavailable' };
        }
    }

    function attemptSilentAuthentication() {
        return new Promise(resolve => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.setAttribute('aria-hidden', 'true');
            iframe.tabIndex = -1;

            let timeoutId;
            let settled = false;

            const finish = result => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                window.removeEventListener('message', handleMessage);
                iframe.remove();
                resolve(result);
            };

            const handleMessage = event => {
                if (event.origin !== window.location.origin || event.source !== iframe.contentWindow) return;
                if (!event.data || event.data.type !== 'QURAN_SILENT_AUTH') return;

                finish({
                    success: event.data.success === true,
                    error: event.data.error || null
                });
            };

            window.addEventListener('message', handleMessage);
            iframe.addEventListener('error', () => finish({ success: false, error: 'iframe_error' }));
            timeoutId = setTimeout(
                () => finish({ success: false, error: 'timeout' }),
                SILENT_AUTH_TIMEOUT_MS
            );

            iframe.src = '/auth/silent-login';
            document.body.appendChild(iframe);
        });
    }

    function initLoggedInState(profile) {
        if (authInitialized) return;
        authInitialized = true;
        window.isLoggedIn = true;
        loggedOutState.classList.add('hidden');
        loggedInState.classList.remove('hidden');
        // Drives the bottom-bar person-icon styling: outline → solid teal.
        document.body.classList.add('is-logged-in');

        renderUserProfile(profile);
        console.log('Active Quran.com session confirmed.');
        if (window.initQfCollectionsSync) window.initQfCollectionsSync();
        if (window.initSiratMiniPreview) window.initSiratMiniPreview();

        // SYNC IN from Quran.com
        fetch('/api/qf/auth/v1/reading-sessions?first=5')
            .then(r => r.text())
            .then(text => {
                if (!text || text.includes('error')) {
                    console.log("SYNC ERROR/EMPTY:", text);
                    return;
                }
                const rawJson = JSON.parse(text);
                const dataArray = rawJson.data ? rawJson.data : rawJson;
                
                if (!dataArray || dataArray.length === 0) {
                     console.log("SYNC: No sessions found in dataArray.");
                } else if (dataArray && dataArray.length > 0) {
                    const latestSession = dataArray[0];
                    const qSurah = parseInt(latestSession.chapterNumber || latestSession.chapter_number);
                    const qVerse = parseInt(latestSession.verseNumber || latestSession.verse_number);
                    const quranReadAt = getQuranSessionTimestampMs(latestSession);

                    let localSurah = null;
                    let localVerse = null;
                    let localReadAt = 0;
                    const localState = readResumeState();
                    if (localState && localState.mode === 'surah') {
                        localSurah = parseInt(localState.id);
                        localVerse = parseInt(localState.startVerse);
                        localReadAt = Number(localState.updatedAt) || 0;
                    }

                    const quranIsNewer = quranReadAt ? quranReadAt > localReadAt : localReadAt === 0;

                    // Prompt only when Quran.com has a different, newer reading point.
                    if (qSurah && qVerse && quranIsNewer && (qSurah !== localSurah || qVerse !== localVerse)) {
                        const modal = document.getElementById('syncConflictModal');
                        const textEl = document.getElementById('syncSurahText');
                        const declineBtn = document.getElementById('declineSyncBtn');
                        const acceptBtn = document.getElementById('acceptSyncBtn');

                        if (modal && textEl) {
                            const surahName = typeof window.getSurahName === 'function' ? window.getSurahName(qSurah) : `Surah ${qSurah}`;
                            textEl.textContent = `${surahName}, Ayah ${qVerse}`;
                            modal.classList.remove('translate-x-[150%]');
                            if (syncPromptDismissTimer) clearTimeout(syncPromptDismissTimer);
                            syncPromptDismissTimer = setTimeout(dismissQuranSyncPrompt, 5000);

                            declineBtn.onclick = () => {
                                dismissQuranSyncPrompt();
                            };

                            acceptBtn.onclick = () => {
                                dismissQuranSyncPrompt();
                                
                                saveResumeState({ mode: 'surah', id: qSurah, startVerse: qVerse });
                                
                                currentViewMode = 'surah';
                                document.getElementById('viewModeSelect').value = 'surah';
                                populateDropdown();
                                document.getElementById('surahSelect').value = qSurah;
                                
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
                                    }, 1200);
                                } else {
                                    window.location.reload();
                                }
                            };
                        }
                    }
                }
            })
            .catch(e => {
                console.debug("Quran.com Sync In Failed", e);
            });
    }

    async function reconcileAuthentication() {
        showLoggedOutState();
        let authenticated = false;

        const acceptValidSession = result => {
            if (result.authenticated && !authenticated) {
                authenticated = true;
                initLoggedInState(result.profile);
            }
            return result;
        };

        // Validate remembered credentials and attempt Quran.com SSO concurrently.
        const rememberedSessionCheck = validateCurrentSession().then(acceptValidSession);
        const quranSsoCheck = attemptSilentAuthentication()
            .then(result => {
                if (!result.success) {
                    console.debug('Quran.com silent authentication did not find a session:', result.error);
                    return { authenticated: false, reason: result.error || 'silent_auth_failed' };
                }
                return validateCurrentSession();
            })
            .then(acceptValidSession);

        await Promise.all([rememberedSessionCheck, quranSsoCheck]);

        if (!authenticated) {
            // Both checks failed. Remove stale app credentials before remaining in generic mode.
            try {
                await fetch('/auth/silent-logout', { cache: 'no-store' });
            } catch (error) {
                console.debug('Could not clear stale Quran.com credentials:', error);
            }
            showLoggedOutState();
        }
    }

    reconcileAuthentication().catch(error => {
        console.debug('Quran.com authentication reconciliation failed:', error);
        showLoggedOutState();
    });

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

// ==============================================================
//   WELCOME HERO — first-listen widget + "Explore themes" doorway
// ==============================================================

function wireHeroWidget() {
    const surahSelect = document.getElementById('heroSurahSelect');
    const playBtn = document.getElementById('heroPlayBtn');
    const themeSelect = document.getElementById('heroThemeSelect');
    const exploreBtn = document.getElementById('heroExploreBtn');
    const welcomeSearchInput = document.getElementById('heroThemeSearchInput');
    const welcomeSearchBtn = document.getElementById('heroThemeSearchBtn');
    const browseThemesBtn = document.getElementById('heroBrowseThemesBtn');
    const advancedSearchBtn = document.getElementById('heroAdvancedSearchBtn');
    const suggestedPathBtns = document.querySelectorAll('[data-hero-template-id]');

    // Welcome HTML may not be on the page (deep-link, resume, etc.).
    if (!surahSelect && !playBtn && !themeSelect && !exploreBtn && !welcomeSearchInput && !welcomeSearchBtn && !browseThemesBtn && !advancedSearchBtn && suggestedPathBtns.length === 0) return;

    function openThemeSearchFromWelcome(query = '') {
        if (typeof window.openThemeSearchSidebar !== 'function') return;
        window.openThemeSearchSidebar({ showConsole: true });
        const searchInput = document.getElementById('filterSearchInput');
        if (searchInput) {
            searchInput.value = query;
            searchInput.focus();
            if (query.trim() && typeof renderThemePredictions === 'function') renderThemePredictions();
        }
        if (typeof startThemeSearchTutorialIfFirstTime === 'function') {
            setTimeout(() => startThemeSearchTutorialIfFirstTime(), 200);
        }
    }

    function wireWelcomeControlOnce(element, key, handler) {
        if (!element || element.dataset[key] === '1') return;
        element.dataset[key] = '1';
        element.addEventListener(key === 'heroKeydownWired' ? 'keydown' : key === 'heroInputWired' ? 'input' : key === 'heroFocusWired' ? 'focus' : 'click', handler);
    }

    if (welcomeSearchInput) {
        wireWelcomeControlOnce(welcomeSearchInput, 'heroFocusWired', () => openThemeSearchFromWelcome(welcomeSearchInput.value));
        wireWelcomeControlOnce(welcomeSearchInput, 'heroInputWired', () => openThemeSearchFromWelcome(welcomeSearchInput.value));
        wireWelcomeControlOnce(welcomeSearchInput, 'heroKeydownWired', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                openThemeSearchFromWelcome(welcomeSearchInput.value);
            }
        });
    }

    if (welcomeSearchBtn) {
        wireWelcomeControlOnce(welcomeSearchBtn, 'heroClickWired', () => openThemeSearchFromWelcome(welcomeSearchInput?.value || ''));
    }

    [browseThemesBtn, advancedSearchBtn].forEach(btn => {
        if (!btn) return;
        wireWelcomeControlOnce(btn, 'heroClickWired', () => openThemeSearchFromWelcome(''));
    });

    suggestedPathBtns.forEach(btn => {
        wireWelcomeControlOnce(btn, 'heroClickWired', () => {
            const templateId = btn.dataset.heroTemplateId;
            openThemeSearchFromWelcome('');
            if (templateId && typeof applyThematicQueryTemplate === 'function') {
                applyThematicQueryTemplate(templateId);
            }
        });
    });

    // ---- Surah dropdown (Listen) -------------------------------------
    // Mirror the surah list from the top-bar dropdown so the user gets the same
    // labels (number + name). Falls back to a 1–114 list if the top dropdown
    // isn't populated yet.
    if (surahSelect) {
        surahSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Choose a surah…';
        placeholder.disabled = true;
        placeholder.selected = true;
        surahSelect.appendChild(placeholder);

        const topSelect = document.getElementById('surahSelect');
        const haveTopOptions = topSelect && topSelect.options && topSelect.options.length > 1;
        if (haveTopOptions) {
            Array.from(topSelect.options).forEach(opt => {
                const v = parseInt(opt.value);
                if (!v || v < 1 || v > 114) return;
                const o = document.createElement('option');
                o.value = String(v);
                o.textContent = opt.textContent;
                surahSelect.appendChild(o);
            });
        } else {
            for (let n = 1; n <= 114; n++) {
                const o = document.createElement('option');
                o.value = String(n);
                o.textContent = (typeof window.getSurahName === 'function') ? window.getSurahName(n) : `Surah ${n}`;
                surahSelect.appendChild(o);
            }
        }
        if (!surahSelect.value) surahSelect.value = '19';  // default: Maryam
    }

    if (playBtn && surahSelect) {
        playBtn.addEventListener('click', () => {
            const n = parseInt(surahSelect.value);
            if (!n || n < 1 || n > 114) { surahSelect.focus(); return; }
            const topSelect = document.getElementById('surahSelect');
            if (topSelect) topSelect.value = String(n);
            if (typeof loadContent === 'function') loadContent(n, null, true);  // autoPlay
            if (typeof sendAnalyticsEvent === 'function') sendAnalyticsEvent('hero_first_listen', { surah: n });
        });
    }

    // ---- Theme dropdown (Explore) ------------------------------------
    // Populate from the taxonomy, grouped by facet via <optgroup>. Only themes
    // that are actually assigned to at least one section are shown, so the user
    // never picks a theme that returns nothing.
    if (themeSelect) {
        const tax = window.THEMATIC_TAXONOMY;
        const assignments = window.THEMATIC_ASSIGNMENTS || {};
        themeSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Choose a theme…';
        placeholder.disabled = true;
        placeholder.selected = true;
        themeSelect.appendChild(placeholder);

        if (tax && tax.labels && tax.facets) {
            // Which label IDs are actually used anywhere in the corpus?
            const usedIds = new Set();
            Object.keys(assignments).forEach(sid => {
                if (sid.startsWith('_')) return;
                (assignments[sid].labels || []).forEach(l => usedIds.add(l));
            });

            Object.keys(tax.facets).forEach(fid => {
                const facet = tax.facets[fid];
                const labels = tax.labels.filter(l => l.facet === fid && usedIds.has(l.id));
                if (!labels.length) return;
                const group = document.createElement('optgroup');
                group.label = (facet.displayName && facet.displayName.en) || fid.replace(/-/g, ' ');
                labels.forEach(l => {
                    const o = document.createElement('option');
                    o.value = l.id;
                    o.textContent = (l.displayName && l.displayName.en) || l.id;
                    group.appendChild(o);
                });
                themeSelect.appendChild(group);
            });

            // Default to a recognisable theme if present (Mary), else first option.
            if (usedIds.has('mary')) themeSelect.value = 'mary';
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Themes unavailable';
            opt.disabled = true;
            themeSelect.appendChild(opt);
        }
    }

    if (exploreBtn && themeSelect) {
        exploreBtn.addEventListener('click', () => {
            const labelId = themeSelect.value;
            if (!labelId) { themeSelect.focus(); return; }

            // Whole-Qur'an scope so the theme acts as a corpus-wide filter, then
            // apply the chosen theme. applyFiltersToView renders the cross-surah
            // results view because scope != 'surah' and a filter is active.
            const topSelect = document.getElementById('surahSelect');
            const seed = (topSelect && parseInt(topSelect.value)) || 1;
            if (topSelect) topSelect.value = String(seed);
            if (typeof loadContent === 'function') loadContent(seed);

            if (typeof setSingleThematicFilter === 'function') {
                setSingleThematicFilter(labelId, 'quran');
                if (typeof syncFilterScopeButtons === 'function') syncFilterScopeButtons();
                if (typeof syncFilterChipStates === 'function') syncFilterChipStates();
                if (typeof renderThematicQueryBuilder === 'function') renderThematicQueryBuilder();
                if (typeof syncFilterMatchModeButtons === 'function') syncFilterMatchModeButtons();
                if (typeof updateFilterCount === 'function') updateFilterCount();
                // Renders the cross-surah results view (scope is whole-Qur'an and
                // a filter is active), populating the matched-theme badges,
                // related-theme suggestions, and the result banner.
                if (typeof applyFiltersToView === 'function') applyFiltersToView();
            }

            // The welcome flow is the beginner doorway into Theme Search, so open
            // the dedicated search surface with the condition the user just started.
            if (typeof window.openThemeSearchSidebar === 'function') {
                window.openThemeSearchSidebar({ showConsole: true });
            }

            // First-timers arriving from the welcome page get a short, 3-step
            // contextual tour. Returning users (or anyone who has skipped or
            // finished it before) are not interrupted. Defer slightly so the
            // page is laid out before we measure its highlight targets.
            if (typeof startThemeSearchTutorialIfFirstTime === 'function') {
                setTimeout(() => startThemeSearchTutorialIfFirstTime(), 200);
            }

            if (typeof sendAnalyticsEvent === 'function') {
                sendAnalyticsEvent('hero_explore_theme', { theme: labelId });
            }
        });
    }
}

// ==============================================================
//   THEME SEARCH WELCOME TUTORIAL  (contextual 3-step coachmark)
// ==============================================================
// Shown the first time a user lands in Theme Search from the welcome page. It
// points at the first query condition, the related-theme suggestions, and the
// "Condition" button. Desktop renders a popover beside each target; narrow
// screens get a bottom sheet. The "seen" flag is persisted ONLY when the user
// skips or finishes (never on a partial dismissal-by-navigation), and the help
// button in the sidebar can replay it any time. No third-party library: this is
// a small self-contained overlay.

const THEME_SEARCH_TUTORIAL_STORAGE_KEY = 'themeSearchWelcomeTutorialSeen';

const themeSearchTutorialState = {
    active: false,
    index: 0,
    steps: [],
    overlay: null,
    popover: null,
    highlightEl: null,
    onReposition: null,
    onKeydown: null
};

function hasSeenThemeSearchTutorial() {
    try {
        return localStorage.getItem(THEME_SEARCH_TUTORIAL_STORAGE_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function markThemeSearchTutorialSeen() {
    try {
        localStorage.setItem(THEME_SEARCH_TUTORIAL_STORAGE_KEY, '1');
    } catch (e) {
        /* private mode / storage disabled — the tutorial simply re-shows later */
    }
}

// Entry point used by the welcome "Start Theme Search" flow. No-op for anyone
// who has already seen (skipped or finished) the tour.
function startThemeSearchTutorialIfFirstTime() {
    if (hasSeenThemeSearchTutorial()) return;
    startThemeSearchTutorial(false);
}

function buildThemeSearchTutorialSteps() {
    // Step 1 copy names the actual first theme so it reads naturally.
    const firstThemeId = (Array.isArray(thematicFilterGroups) && thematicFilterGroups[0]
        && thematicFilterGroups[0].terms[0]) || null;
    const firstThemeName = firstThemeId ? getThematicLabelName(firstThemeId) : 'a theme';

    // Step 2 copy name-drops up to two real related suggestions when available,
    // falling back to a generic example otherwise.
    let relatedExample = 'nearby ideas like Repentance or Guidance';
    try {
        const suggestions = (typeof getRelatedThemeSuggestions === 'function')
            ? getRelatedThemeSuggestions(2)
            : [];
        const names = suggestions.map(s => getThematicLabelName(s.labelId)).filter(Boolean);
        if (names.length >= 2) relatedExample = `nearby ideas like ${names[0]} or ${names[1]}`;
        else if (names.length === 1) relatedExample = `a nearby idea like ${names[0]}`;
    } catch (e) { /* keep the generic copy above */ }

    return [
        {
            title: 'Your first condition',
            body: `You started with ${firstThemeName}. This is your first search condition — every passage shown carries this theme.`,
            target: () => document.getElementById('filterQueryRows')
        },
        {
            title: 'Broaden with related themes',
            body: `Add ${relatedExample} to widen the search and surface more passages.`,
            target: () => {
                const related = document.getElementById('relatedThemeContainer');
                if (related && !related.classList.contains('hidden')) return related;
                // No suggestions in view yet → point at the theme list, which is
                // the other place a reader can add a nearby idea from.
                return document.getElementById('filterTemplateContainer')
                    || document.getElementById('filterFacetsContainer');
            }
        },
        {
            title: 'Combine ideas',
            body: 'Add a condition when you want passages that combine ideas — like Mercy AND Prayer.',
            target: () => document.getElementById('addFilterGroupBtn')
        }
    ];
}

function startThemeSearchTutorial(force = false) {
    if (!force && hasSeenThemeSearchTutorial()) return;
    // If somehow already running, tear down first so we never stack overlays.
    if (themeSearchTutorialState.active) teardownThemeSearchTutorial();

    const steps = buildThemeSearchTutorialSteps();
    if (!steps.length) return;

    themeSearchTutorialState.active = true;
    themeSearchTutorialState.index = 0;
    themeSearchTutorialState.steps = steps;

    // The overlay is a transparent, click-through layer that only hosts the
    // popover. pointer-events stay off so the Theme Search page remains fully
    // interactive while the popover is visible.
    const overlay = document.createElement('div');
    overlay.id = 'themeSearchTutorialOverlay';
    overlay.className = 'theme-tutorial-overlay';
    overlay.innerHTML = `
        <div id="themeSearchTutorialPopover" class="theme-tutorial-popover" role="dialog" aria-modal="false" aria-labelledby="themeSearchTutorialTitle">
            <div class="theme-tutorial-progress" id="themeSearchTutorialProgress"></div>
            <h4 class="theme-tutorial-title" id="themeSearchTutorialTitle"></h4>
            <p class="theme-tutorial-body" id="themeSearchTutorialBody"></p>
            <div class="theme-tutorial-actions">
                <button type="button" class="theme-tutorial-skip" id="themeSearchTutorialSkip">Skip</button>
                <div class="theme-tutorial-nav">
                    <button type="button" class="theme-tutorial-back" id="themeSearchTutorialBack">Back</button>
                    <button type="button" class="theme-tutorial-next" id="themeSearchTutorialNext">Next</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    themeSearchTutorialState.overlay = overlay;
    themeSearchTutorialState.popover = overlay.querySelector('#themeSearchTutorialPopover');

    overlay.querySelector('#themeSearchTutorialSkip').addEventListener('click', () => finishThemeSearchTutorial('skip'));
    overlay.querySelector('#themeSearchTutorialBack').addEventListener('click', () => stepThemeSearchTutorial(-1));
    overlay.querySelector('#themeSearchTutorialNext').addEventListener('click', () => {
        if (themeSearchTutorialState.index >= themeSearchTutorialState.steps.length - 1) {
            finishThemeSearchTutorial('done');
        } else {
            stepThemeSearchTutorial(1);
        }
    });

    // Keep the popover anchored to its target as the layout shifts.
    themeSearchTutorialState.onReposition = () => positionThemeSearchTutorial();
    window.addEventListener('resize', themeSearchTutorialState.onReposition);
    window.addEventListener('scroll', themeSearchTutorialState.onReposition, true);

    // Esc must never trap the user — treat it as "skip" (records seen + closes).
    themeSearchTutorialState.onKeydown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); finishThemeSearchTutorial('escape'); }
    };
    document.addEventListener('keydown', themeSearchTutorialState.onKeydown);

    if (typeof sendAnalyticsEvent === 'function') {
        sendAnalyticsEvent('theme_search_tutorial_start', { forced: !!force });
    }

    renderThemeSearchTutorialStep();
}

function stepThemeSearchTutorial(delta) {
    const next = themeSearchTutorialState.index + delta;
    if (next < 0 || next >= themeSearchTutorialState.steps.length) return;
    themeSearchTutorialState.index = next;
    renderThemeSearchTutorialStep();
}

function renderThemeSearchTutorialStep() {
    const state = themeSearchTutorialState;
    if (!state.active || !state.overlay) return;
    const step = state.steps[state.index];
    const total = state.steps.length;

    const titleEl = state.overlay.querySelector('#themeSearchTutorialTitle');
    const bodyEl = state.overlay.querySelector('#themeSearchTutorialBody');
    const progressEl = state.overlay.querySelector('#themeSearchTutorialProgress');
    const backBtn = state.overlay.querySelector('#themeSearchTutorialBack');
    const nextBtn = state.overlay.querySelector('#themeSearchTutorialNext');

    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) bodyEl.textContent = step.body;
    if (progressEl) progressEl.textContent = `Step ${state.index + 1} of ${total}`;

    // Back is hidden on the first step; Next becomes Done on the last step.
    if (backBtn) backBtn.classList.toggle('is-hidden', state.index === 0);
    if (nextBtn) nextBtn.textContent = (state.index === total - 1) ? 'Done' : 'Next';

    // Move the highlight ring to the new target.
    if (state.highlightEl) state.highlightEl.classList.remove('theme-tutorial-highlight');
    const target = (typeof step.target === 'function') ? step.target() : null;
    state.highlightEl = (target && target.nodeType === 1) ? target : null;
    if (state.highlightEl) {
        state.highlightEl.classList.add('theme-tutorial-highlight');
        try { state.highlightEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* no-op */ }
    }

    // Position now and again after layout settles (scrollIntoView can shift it).
    positionThemeSearchTutorial();
    requestAnimationFrame(() => positionThemeSearchTutorial());
}

function positionThemeSearchTutorial() {
    const state = themeSearchTutorialState;
    if (!state.active || !state.popover) return;
    const pop = state.popover;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    if (isMobile) {
        // Bottom-sheet: CSS docks it; clear any desktop inline coordinates.
        pop.classList.add('is-sheet');
        pop.style.top = '';
        pop.style.left = '';
        return;
    }

    pop.classList.remove('is-sheet');
    const popW = pop.offsetWidth || 320;
    const popH = pop.offsetHeight || 180;
    const gap = 16;
    const margin = 12;
    const target = state.highlightEl;

    if (!target) {
        // No anchor available → center it so instructions are never lost.
        pop.style.left = Math.max(margin, (window.innerWidth - popW) / 2) + 'px';
        pop.style.top = Math.max(margin, (window.innerHeight - popH) / 2) + 'px';
        return;
    }

    const r = target.getBoundingClientRect();
    // Prefer placing the popover to the left of the target; fall back to below
    // (then above) if there isn't room.
    let left = r.left - popW - gap;
    let top = r.top + (r.height / 2) - (popH / 2);

    if (left < margin) {
        left = Math.min(Math.max(margin, r.left), window.innerWidth - popW - margin);
        top = (r.bottom + gap + popH <= window.innerHeight)
            ? r.bottom + gap
            : Math.max(margin, r.top - gap - popH);
    }

    top = Math.min(Math.max(margin, top), window.innerHeight - popH - margin);
    left = Math.min(Math.max(margin, left), window.innerWidth - popW - margin);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
}

// Records "seen" and closes. Used by Skip, Done and Esc — every exit path the
// user can take, so the flag is only ever written on a deliberate dismissal.
function finishThemeSearchTutorial(reason) {
    const step = themeSearchTutorialState.index + 1;
    const total = themeSearchTutorialState.steps.length;
    markThemeSearchTutorialSeen();
    if (typeof sendAnalyticsEvent === 'function') {
        sendAnalyticsEvent('theme_search_tutorial_end', { reason: reason || 'done', step, total });
    }
    teardownThemeSearchTutorial();
}

function teardownThemeSearchTutorial() {
    const state = themeSearchTutorialState;
    if (state.highlightEl) state.highlightEl.classList.remove('theme-tutorial-highlight');
    if (state.onReposition) {
        window.removeEventListener('resize', state.onReposition);
        window.removeEventListener('scroll', state.onReposition, true);
    }
    if (state.onKeydown) document.removeEventListener('keydown', state.onKeydown);
    if (state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    state.active = false;
    state.index = 0;
    state.steps = [];
    state.overlay = null;
    state.popover = null;
    state.highlightEl = null;
    state.onReposition = null;
    state.onKeydown = null;
}

// ==============================================================
//   THEMATIC FILTER UI
// ==============================================================

function syncActiveThematicFiltersFromGroups() {
    activeThematicFilters.clear();
    thematicFilterGroups.forEach(group => {
        (group.terms || []).forEach(labelId => activeThematicFilters.add(labelId));
    });
}

function normalizeThematicFilterGroups() {
    if (!Array.isArray(thematicFilterGroups) || thematicFilterGroups.length === 0) {
        thematicFilterGroups = [{ id: nextThematicFilterGroupId++, op: 'or', terms: [] }];
    }

    const seenGroupIds = new Set();
    thematicFilterGroups = thematicFilterGroups.map(group => {
        const id = group && Number.isFinite(group.id) && !seenGroupIds.has(group.id)
            ? group.id
            : nextThematicFilterGroupId++;
        seenGroupIds.add(id);

        const seenTerms = new Set();
        const terms = [];
        (Array.isArray(group?.terms) ? group.terms : []).forEach(labelId => {
            if (!labelId || seenTerms.has(labelId)) return;
            seenTerms.add(labelId);
            terms.push(labelId);
        });

        return {
            id,
            op: group?.op === 'and' ? 'and' : 'or',
            terms
        };
    });

    if (!thematicFilterGroups.some(group => group.id === activeThematicFilterGroupId)) {
        activeThematicFilterGroupId = thematicFilterGroups[0].id;
    }

    const activeGroup = thematicFilterGroups.find(group => group.id === activeThematicFilterGroupId);
    thematicFilterMatchMode = activeGroup?.op === 'and' ? 'all' : 'any';
    syncActiveThematicFiltersFromGroups();
}

function getActiveThematicFilterGroup() {
    normalizeThematicFilterGroups();
    return thematicFilterGroups.find(group => group.id === activeThematicFilterGroupId) || thematicFilterGroups[0];
}

function getNonEmptyThematicFilterGroups() {
    normalizeThematicFilterGroups();
    return thematicFilterGroups.filter(group => Array.isArray(group.terms) && group.terms.length > 0);
}

function hasActiveThematicQuery() {
    return getNonEmptyThematicFilterGroups().length > 0;
}

function pruneEmptyThematicFilterGroups() {
    if (thematicFilterGroups.length <= 1) return;

    thematicFilterGroups = thematicFilterGroups.filter(group =>
        group.terms.length > 0 || group.id === activeThematicFilterGroupId
    );

    if (thematicFilterGroups.length === 0) {
        thematicFilterGroups = [{ id: nextThematicFilterGroupId++, op: 'or', terms: [] }];
        activeThematicFilterGroupId = thematicFilterGroups[0].id;
    }
}

function setSingleThematicFilter(labelId, scope = thematicFilterScope) {
    const groupId = nextThematicFilterGroupId++;
    thematicFilterGroups = [{ id: groupId, op: 'or', terms: [labelId] }];
    activeThematicFilterGroupId = groupId;
    thematicFilterMatchMode = 'any';
    thematicFilterScope = scope;
    syncActiveThematicFiltersFromGroups();
}

function resetThematicFilterQuery() {
    const groupId = nextThematicFilterGroupId++;
    thematicFilterGroups = [{ id: groupId, op: 'or', terms: [] }];
    activeThematicFilterGroupId = groupId;
    thematicFilterMatchMode = 'any';
    syncActiveThematicFiltersFromGroups();
}

function applyThematicFilterGroups(groups, scope = thematicFilterScope, activeIndex = 0) {
    const knownIds = new Set((window.THEMATIC_TAXONOMY?.labels || []).map(label => label.id));
    const nextGroups = [];

    (Array.isArray(groups) ? groups : []).forEach(group => {
        const terms = [];
        const seenTerms = new Set();
        (Array.isArray(group?.terms) ? group.terms : []).forEach(labelId => {
            if (!labelId || seenTerms.has(labelId)) return;
            if (knownIds.size && !knownIds.has(labelId)) return;
            seenTerms.add(labelId);
            terms.push(labelId);
        });
        if (!terms.length) return;
        nextGroups.push({
            id: nextThematicFilterGroupId++,
            op: group?.op === 'and' ? 'and' : 'or',
            terms
        });
    });

    if (!nextGroups.length) {
        resetThematicFilterQuery();
        return false;
    }

    thematicFilterGroups = nextGroups;
    const safeIndex = Math.max(0, Math.min(activeIndex, thematicFilterGroups.length - 1));
    activeThematicFilterGroupId = thematicFilterGroups[safeIndex].id;
    thematicFilterMatchMode = thematicFilterGroups[safeIndex].op === 'and' ? 'all' : 'any';
    if (SCOPE_LABELS[scope]) thematicFilterScope = scope;
    syncActiveThematicFiltersFromGroups();
    return true;
}

function addThematicFilterGroup() {
    normalizeThematicFilterGroups();
    const groupId = nextThematicFilterGroupId++;
    thematicFilterGroups.push({ id: groupId, op: 'or', terms: [] });
    activeThematicFilterGroupId = groupId;
    syncActiveThematicFiltersFromGroups();
    syncFilterMatchModeButtons();
    renderThematicQueryBuilder();
    updateFilterCount();
}

function removeThematicFilterGroup(groupId) {
    normalizeThematicFilterGroups();
    thematicFilterGroups = thematicFilterGroups.filter(group => group.id !== groupId);
    if (thematicFilterGroups.length === 0) {
        resetThematicFilterQuery();
    } else if (!thematicFilterGroups.some(group => group.id === activeThematicFilterGroupId)) {
        activeThematicFilterGroupId = thematicFilterGroups[0].id;
    }
    syncActiveThematicFiltersFromGroups();
    syncFilterMatchModeButtons();
    renderThematicQueryBuilder();
    syncFilterChipStates();
    updateFilterCount();
    applyFiltersToView();
}

function removeThematicFilterTerm(labelId) {
    normalizeThematicFilterGroups();
    thematicFilterGroups.forEach(group => {
        group.terms = group.terms.filter(term => term !== labelId);
    });
    pruneEmptyThematicFilterGroups();
    normalizeThematicFilterGroups();
}

function getThematicFilterTermCount() {
    normalizeThematicFilterGroups();
    return activeThematicFilters.size;
}

function getThematicLabelFacetColor(labelId) {
    const tax = window.THEMATIC_TAXONOMY;
    const label = tax?.labels?.find(l => l.id === labelId);
    return (tax?.facets?.[label?.facet]?.color) || label?.color || '#56A3A6';
}

function formatThematicFilterGroup(group) {
    const names = (group.terms || []).map(getThematicLabelName);
    if (names.length === 0) return 'Empty row';
    const joiner = group.op === 'and' ? ' AND ' : ' OR ';
    const text = names.join(joiner);
    return names.length > 1 ? `(${text})` : text;
}

function getConditionPhrase(group, index) {
    const mode = group.op === 'and' ? 'Require all of' : 'Include any of';
    return index === 0 ? mode : `Also ${mode.toLowerCase()}`;
}

function getConditionName(index) {
    return index === 0 ? 'First condition' : `Condition ${index + 1}`;
}

function getThematicQueryText() {
    const groups = getNonEmptyThematicFilterGroups();
    if (groups.length === 0) return '';
    return groups.map(formatThematicFilterGroup).join(' AND ');
}

function getThematicSearchTitle() {
    const groups = getNonEmptyThematicFilterGroups();
    const names = [];
    const seen = new Set();

    groups.forEach(group => {
        group.terms.forEach(labelId => {
            if (seen.has(labelId)) return;
            seen.add(labelId);
            names.push(getThematicLabelName(labelId));
        });
    });

    if (names.length === 0) return 'Theme search';
    const visible = names.slice(0, 3).join(' + ');
    const suffix = names.length > 3 ? ` + ${names.length - 3} more` : '';
    return `${visible}${suffix} search`;
}

function encodeThematicQueryState() {
    const groups = getNonEmptyThematicFilterGroups().map(group => ({
        op: group.op,
        terms: group.terms
    }));
    if (!groups.length) return '';

    const state = {
        scope: thematicFilterScope,
        sort: thematicResultSortMode,
        mode: currentViewMode,
        id: parseInt(document.getElementById('surahSelect')?.value) || 1,
        groups
    };
    const encoded = btoa(JSON.stringify(state))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    return encoded;
}

function decodeThematicQueryState(encoded) {
    if (!encoded) return null;
    try {
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
        const state = JSON.parse(atob(padded));
        if (!state || !Array.isArray(state.groups)) return null;
        return state;
    } catch (error) {
        console.warn('[filter] Failed to decode query URL state', error);
        return null;
    }
}

function syncThematicQueryToUrl() {
    const url = new URL(window.location.href);
    const encoded = encodeThematicQueryState();
    if (encoded) {
        url.searchParams.set('tq', encoded);
    } else {
        url.searchParams.delete('tq');
    }
    window.history.replaceState({}, '', url);
}

function restoreThematicQueryFromUrl() {
    const url = new URL(window.location.href);
    const state = decodeThematicQueryState(url.searchParams.get('tq'));
    if (!state) return false;

    const restored = applyThematicFilterGroups(state.groups, state.scope);
    if (!restored) return false;
    if (state.sort) thematicResultSortMode = state.sort;

    currentViewMode = state.mode === 'juz' ? 'juz' : 'surah';
    const viewSelect = document.getElementById('viewModeSelect');
    if (viewSelect) viewSelect.value = currentViewMode;
    populateDropdown();

    const seed = Number.isFinite(parseInt(state.id)) ? parseInt(state.id) : 1;
    const topSelect = document.getElementById('surahSelect');
    if (topSelect && seed > 0) topSelect.value = String(seed);
    if (typeof loadContent === 'function') loadContent(seed > 0 ? seed : 1);

    syncFilterScopeButtons();
    syncFilterMatchModeButtons();
    const sortSelect = document.getElementById('filterSortSelect');
    if (sortSelect) sortSelect.value = thematicResultSortMode;
    renderThematicQueryBuilder();
    renderThematicFilterChips();
    applyFiltersToView();
    return true;
}

async function copyThematicQueryLink() {
    syncThematicQueryToUrl();
    const url = window.location.href;
    try {
        await copyTextWithFallback(url);
        if (window.showToast) window.showToast('Search link copied', 'link');
    } catch (error) {
        console.warn('[filter] Could not copy query link', error);
        if (window.showToast) window.showToast('Could not copy link', 'error');
    }
}

async function copyTextWithFallback(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            // Fall through to the legacy path for local HTTP and embedded browsers.
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('copy command failed');
}

function getLabelCountsForScope() {
    const assignments = window.THEMATIC_ASSIGNMENTS || {};
    const scopedSections = getScopeSectionIds();
    const counts = new Map();

    Object.entries(assignments).forEach(([sectionId, entry]) => {
        if (sectionId.startsWith('_')) return;
        if (!scopedSections.has(sectionId)) return;
        (entry.labels || []).forEach(labelId => {
            counts.set(labelId, (counts.get(labelId) || 0) + 1);
        });
    });

    return counts;
}

function getRelatedThemeSuggestions(limit = 8) {
    const activeIds = new Set(activeThematicFilters);
    if (activeIds.size === 0) return [];

    const assignments = window.THEMATIC_ASSIGNMENTS || {};
    const scopedSections = getScopeSectionIds();
    const counts = new Map();

    Object.entries(assignments).forEach(([sectionId, entry]) => {
        if (sectionId.startsWith('_')) return;
        if (!scopedSections.has(sectionId)) return;

        const labels = entry.labels || [];
        if (!labels.some(labelId => activeIds.has(labelId))) return;

        labels.forEach(labelId => {
            if (activeIds.has(labelId)) return;
            counts.set(labelId, (counts.get(labelId) || 0) + 1);
        });
    });

    return Array.from(counts.entries())
        .map(([labelId, count]) => ({ labelId, count }))
        .sort((a, b) => b.count - a.count || getThematicLabelName(a.labelId).localeCompare(getThematicLabelName(b.labelId)))
        .slice(0, limit);
}

function renderRelatedThemeSuggestions() {
    const container = document.getElementById('relatedThemeContainer');
    const list = document.getElementById('relatedThemeList');
    if (!container || !list) return;

    const suggestions = getRelatedThemeSuggestions();
    container.classList.toggle('hidden', suggestions.length === 0);
    list.innerHTML = '';

    suggestions.forEach(({ labelId, count }) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'related-theme-chip inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition';
        chip.dataset.labelId = labelId;
        const color = getThematicLabelFacetColor(labelId);
        chip.style.borderColor = color + '45';
        chip.style.backgroundColor = color + '10';
        chip.style.color = '#F3E4CE';
        chip.innerHTML = `<span>${getThematicLabelName(labelId)}</span><span class="text-[10px] opacity-60">${count}</span>`;
        chip.addEventListener('click', () => toggleFilter(labelId));
        list.appendChild(chip);
    });
}

function renderThematicQueryBuilder() {
    const rowsContainer = document.getElementById('filterQueryRows');
    const currentRowText = document.getElementById('filterCurrentRowText');
    if (!rowsContainer) return;

    normalizeThematicFilterGroups();
    rowsContainer.innerHTML = '';

    thematicFilterGroups.forEach((group, index) => {
        const row = document.createElement('div');
        row.className = 'filter-query-row rounded-xl border px-3 py-3 transition-colors cursor-pointer';
        row.classList.toggle('active', group.id === activeThematicFilterGroupId);
        row.dataset.groupId = String(group.id);
        row.addEventListener('click', () => {
            activeThematicFilterGroupId = group.id;
            syncFilterMatchModeButtons();
            renderThematicQueryBuilder();
        });

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between gap-2 mb-2';

        const rowTitle = document.createElement('div');
        rowTitle.className = 'flex items-center gap-2 min-w-0';

        if (index > 0) {
            const connector = document.createElement('span');
            connector.className = 'filter-query-connector text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded';
            connector.textContent = 'AND';
            rowTitle.appendChild(connector);
        }

        const label = document.createElement('span');
        label.className = 'text-[11px] font-bold tracking-wide text-white/70';
        label.textContent = getConditionPhrase(group, index);
        rowTitle.appendChild(label);

        header.appendChild(rowTitle);

        if (thematicFilterGroups.length > 1) {
            const removeGroupBtn = document.createElement('button');
            removeGroupBtn.type = 'button';
            removeGroupBtn.className = 'filter-query-remove text-white/35 hover:text-white transition';
            removeGroupBtn.setAttribute('aria-label', `Remove filter row ${index + 1}`);
            removeGroupBtn.innerHTML = '<span class="material-symbols-outlined text-base">close</span>';
            removeGroupBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                removeThematicFilterGroup(group.id);
            });
            header.appendChild(removeGroupBtn);
        }

        row.appendChild(header);

        const terms = document.createElement('div');
        terms.className = 'flex flex-wrap gap-1.5';

        if (group.terms.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'text-xs text-white/35';
            empty.textContent = 'Add themes from below';
            terms.appendChild(empty);
        } else {
            group.terms.forEach(labelId => {
                const term = document.createElement('span');
                term.className = 'filter-query-term inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold';
                const color = getThematicLabelFacetColor(labelId);
                term.style.borderColor = color + '50';
                term.style.backgroundColor = color + '18';
                term.style.color = '#F3E4CE';

                const name = document.createElement('span');
                name.textContent = getThematicLabelName(labelId);
                term.appendChild(name);

                const removeTermBtn = document.createElement('button');
                removeTermBtn.type = 'button';
                removeTermBtn.className = 'text-white/45 hover:text-white leading-none';
                removeTermBtn.setAttribute('aria-label', `Remove ${getThematicLabelName(labelId)}`);
                removeTermBtn.textContent = '×';
                removeTermBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    removeThematicFilterTerm(labelId);
                    renderThematicQueryBuilder();
                    syncFilterChipStates();
                    updateFilterCount();
                    applyFiltersToView();
                });
                term.appendChild(removeTermBtn);
                terms.appendChild(term);
            });
        }

        row.appendChild(terms);
        rowsContainer.appendChild(row);
    });

    if (currentRowText) {
        const activeIndex = thematicFilterGroups.findIndex(group => group.id === activeThematicFilterGroupId);
        currentRowText.textContent = getConditionName(activeIndex);
    }
}

function isThemeSearchPageOpen() {
    const page = document.getElementById('filterSidebar');
    return !!page && !page.classList.contains('hidden');
}

function setThemeSearchMode(mode = 'landing') {
    const showConsole = mode === 'console';
    const landing = document.getElementById('themeSearchLanding');
    const controls = document.getElementById('themeSearchControlsPanel');
    const workspace = document.getElementById('themeSearchGrid');

    if (landing) landing.classList.toggle('hidden', showConsole);
    if (controls) controls.classList.toggle('hidden', !showConsole);
    if (workspace) workspace.classList.toggle('hidden', !showConsole);
}

function syncThemeSearchLayoutOrder() {
    // The redesigned page keeps one stable order across breakpoints:
    // discovery and active search first, then the theme library.
}

function escapeThematicSearchHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function getThemeSearchMatches() {
    if (!hasActiveThematicQuery()) return [];

    const scopeSurahs = getScopeSurahNumbers();
    const sortedSurahs = Array.from(scopeSurahs).map(Number).sort((a, b) => a - b);
    const matches = [];

    sortedSurahs.forEach(surahId => {
        const breaks = THEME_BREAKS[String(surahId)] || [];
        const surahVerses = QURAN_DATA.filter(v => v[CONSTANTS.KEY_SURAH_NO] === surahId);
        if (!surahVerses.length || !breaks.length) return;
        const lastVerse = surahVerses[surahVerses.length - 1][CONSTANTS.KEY_AYAH_NO];

        breaks.forEach((startVerse, idx) => {
            const start = (typeof startVerse === 'object') ? startVerse.start : startVerse;
            const nextRaw = breaks[idx + 1];
            const nextStart = nextRaw ? (typeof nextRaw === 'object' ? nextRaw.start : nextRaw) : null;
            const endVerse = nextStart ? (nextStart - 1) : lastVerse;
            const sectionId = `${surahId}:${start}`;
            if (!sectionMatchesFilters(sectionId)) return;

            const sectionData = surahVerses.filter(v => {
                const vn = v[CONSTANTS.KEY_AYAH_NO];
                return vn >= start && vn <= endVerse;
            });
            if (!sectionData.length) return;

            const matchedIds = getSectionFilterMatchDetails(sectionId);
            matches.push({
                surahId,
                start,
                endVerse,
                data: sectionData,
                matchedIds,
                matchCount: matchedIds.length,
                verseCount: sectionData.length
            });
        });
    });

    return matches.sort(compareCrossSurahMatches);
}

function openThemeSearchResult(match) {
    if (!match) return;
    if (typeof window.closeThemeSearchSidebar === 'function') window.closeThemeSearchSidebar();

    currentViewMode = 'surah';
    const viewSelect = document.getElementById('viewModeSelect');
    if (viewSelect) viewSelect.value = 'surah';
    populateDropdown();
    const surahSelect = document.getElementById('surahSelect');
    if (surahSelect) surahSelect.value = String(match.surahId);

    if (typeof loadContent === 'function') {
        loadContent(match.surahId, match.start);
        setTimeout(() => {
            const card = document.getElementById(`section-${match.surahId}-${match.start}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('ring-2', 'ring-[#56A3A6]');
            }
        }, 350);
    }
}

function renderThemeSearchResultsList() {
    const actionText = document.getElementById('themeSearchActionText');
    const activeSentence = document.getElementById('themeSearchActiveSentence');
    const applyBtn = document.getElementById('themeSearchApplyBtn');
    const clearActionBtn = document.getElementById('themeSearchClearBtn');
    const scopeLabel = SCOPE_LABELS[thematicFilterScope] || 'This surah';
    renderThematicQueryTemplates();

    if (!hasActiveThematicQuery()) {
        if (actionText) actionText.textContent = 'Choose a theme to preview matching sections.';
        if (activeSentence) activeSentence.textContent = 'No active search yet.';
        if (applyBtn) applyBtn.disabled = true;
        if (clearActionBtn) clearActionBtn.disabled = true;
        return;
    }

    const matches = getThemeSearchMatches();
    const matchedSurahs = new Set(matches.map(match => match.surahId));
    const queryText = getThematicQueryText();
    if (actionText) {
        actionText.textContent = matches.length > 0
            ? `${matches.length} matching section${matches.length === 1 ? '' : 's'} will be shown when this search is applied.`
            : 'No matching sections yet. Adjust the search or clear it.';
    }
    if (activeSentence) {
        activeSentence.textContent = `Find passages tagged with ${queryText} across ${scopeLabel.toLowerCase()}.`;
    }
    if (applyBtn) applyBtn.disabled = false;
    if (clearActionBtn) clearActionBtn.disabled = false;
}

function applyThemeSearchToPage() {
    const page = document.getElementById('filterSidebar');
    if (page) page.classList.add('hidden');
    document.body.classList.remove('theme-search-page-open');

    if (hasActiveThematicQuery()) {
        applyFiltersToView();
    } else {
        clearThematicFilters();
    }
}

function setupThematicFilterUI() {
    const filterSidebar = document.getElementById('filterSidebar');
    const filterBackdrop = document.getElementById('filterBackdrop');
    const openBtn = document.getElementById('openFilterBtn');
    const closeBtn = document.getElementById('closeFilterBtn');
    const container = document.getElementById('filterFacetsContainer');
    const scopeSurahBtn = document.getElementById('filterScopeSurahBtn');
    const scopeQuranBtn = document.getElementById('filterScopeQuranBtn');
    const addGroupBtn = document.getElementById('addFilterGroupBtn');

    if (!filterSidebar || !filterBackdrop || !openBtn || !closeBtn || !container) {
        console.warn('[filter] required DOM nodes missing — skipping filter UI setup');
        return;
    }

    function openFilters(options) {
        const showConsole = !!(options && options.showConsole === true);
        filterBackdrop.classList.add('hidden');
        filterSidebar.classList.remove('hidden');
        filterSidebar.scrollTop = 0;
        document.body.classList.add('theme-search-page-open');
        setThemeSearchMode(showConsole ? 'console' : 'landing');
        const templateContainer = document.getElementById('filterTemplateContainer');
        if (templateContainer) templateContainer.removeAttribute('open');
        syncThemeSearchLayoutOrder();
        setTimeout(() => {
            filterSidebar.classList.add('filter-sidebar-open');
        }, 10);
        renderThemeSearchResultsList();
        sendAnalyticsEvent('ui_interaction', { action: 'open_theme_search' });
    }
    function closeFilters(options) {
        const skipApply = !!(options && options.skipApply === true);
        filterSidebar.classList.remove('filter-sidebar-open');
        document.body.classList.remove('theme-search-page-open');
        if (themeSearchTutorialState.active) teardownThemeSearchTutorial();
        setTimeout(() => {
            filterSidebar.classList.add('hidden');
            if (!skipApply && hasActiveThematicQuery()) applyFiltersToView();
        }, 300);
    }

    openBtn.addEventListener('click', openFilters);
    closeBtn.addEventListener('click', closeFilters);
    filterBackdrop.addEventListener('click', closeFilters);
    window.addEventListener('resize', syncThemeSearchLayoutOrder);

    const applyBtn = document.getElementById('themeSearchApplyBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyThemeSearchToPage);
    }

    const clearActionBtn = document.getElementById('themeSearchClearBtn');
    if (clearActionBtn) {
        clearActionBtn.addEventListener('click', clearThematicFilters);
    }

    // Expose a safe wrapper so other entry points (e.g. the welcome "Start Theme
    // Search" flow) can open the dedicated search page without duplicating logic.
    window.openThemeSearchSidebar = openFilters;
    window.closeThemeSearchSidebar = closeFilters;

    // Help button inside the Theme Search header: replay the contextual tutorial
    // on demand (force = ignore the "seen" flag).
    const helpBtn = document.getElementById('themeSearchHelpBtn');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            if (typeof startThemeSearchTutorial === 'function') startThemeSearchTutorial(true);
        });
    }

    // Scope buttons — wire each via data-scope attribute on the button.
    document.querySelectorAll('.filter-scope-btn').forEach(btn => {
        btn.addEventListener('click', () => setThematicFilterScope(btn.dataset.scope));
    });

    // Match-mode toggle for the active query row.
    document.querySelectorAll('.filter-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setThematicFilterMatchMode(btn.dataset.mode));
    });

    if (addGroupBtn) {
        addGroupBtn.addEventListener('click', addThematicFilterGroup);
    }

    const tax = window.THEMATIC_TAXONOMY;
    const assignments = window.THEMATIC_ASSIGNMENTS;
    if (!tax || !tax.labels || !tax.facets || !assignments) {
        container.innerHTML = '<p class="text-white/40 text-sm font-[\'Nunito\']">Themes not loaded.</p>';
        return;
    }

    const searchInput = document.getElementById('filterSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.filter-chip').forEach(chip => {
                chip.style.display = (!q || chip.dataset.searchTerms.includes(q)) ? '' : 'none';
            });
            document.querySelectorAll('.filter-facet-group').forEach(group => {
                const hasVisible = Array.from(group.querySelectorAll('.filter-chip')).some(c => c.style.display !== 'none');
                group.style.display = hasVisible ? '' : 'none';
            });
            renderThemePredictions();
        });
        searchInput.addEventListener('keydown', handleThemePredictionKeydown);
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) renderThemePredictions();
        });
        // Dismiss the dropdown when tapping/clicking outside the input wrapper.
        document.addEventListener('click', (event) => {
            const wrap = searchInput.closest('.theme-search-input-wrap');
            if (wrap && !wrap.contains(event.target)) hideThemePredictions();
        });
    }

    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearThematicFilters);
    }

    const copyQueryBtn = document.getElementById('copyFilterQueryBtn');
    if (copyQueryBtn) {
        copyQueryBtn.addEventListener('click', copyThematicQueryLink);
    }

    const sortSelect = document.getElementById('filterSortSelect');
    if (sortSelect) {
        sortSelect.value = thematicResultSortMode;
        sortSelect.addEventListener('change', (event) => {
            thematicResultSortMode = event.target.value || 'mushaf';
            applyFiltersToView();
        });
    }

    syncFilterScopeButtons();
    syncFilterMatchModeButtons();
    renderThematicQueryBuilder();
    renderThematicQueryTemplates();
    renderRelatedThemeSuggestions();
    renderThematicFilterChips();
}

// Returns the set of surah numbers (as strings) included in the active scope.
// For 'surah' returns just the current surah; for 'juz' returns the surahs in
// the current juz; for makki/madani/quran/revelation returns the relevant set
// across the whole Qur'an. Used both to scope the sidebar chip list and to
// decide whether cross-surah rendering applies.
function getScopeSurahNumbers() {
    const currentSurah = parseInt(document.getElementById('surahSelect')?.value);
    const meta = window.SURAH_METADATA || {};

    switch (thematicFilterScope) {
        case 'surah':
            return new Set([String(currentSurah || 1)]);
        case 'juz': {
            // Resolve the juz containing the currently-viewed surah (or, in juz
            // view, the currently-viewed juz).
            let juzId;
            if (currentViewMode === 'juz') {
                juzId = parseInt(document.getElementById('surahSelect')?.value);
            } else if (typeof window.getJuzForSurah === 'function') {
                juzId = window.getJuzForSurah(currentSurah);
            } else if (Array.isArray(window.JUZ_DATA)) {
                const entry = window.JUZ_DATA.find(j =>
                    (j.surahs || []).includes(currentSurah) ||
                    (j.start && j.start.surah <= currentSurah && j.end && j.end.surah >= currentSurah)
                );
                juzId = entry ? entry.id : null;
            }
            const juzSurahs = (Array.isArray(window.JUZ_DATA) && juzId)
                ? (window.JUZ_DATA.find(j => j.id === juzId)?.surahs || [])
                : [currentSurah];
            return new Set(juzSurahs.map(String));
        }
        case 'makki':
            return new Set(Object.entries(meta).filter(([, v]) => v.type === 'makki').map(([k]) => k));
        case 'madani':
            return new Set(Object.entries(meta).filter(([, v]) => v.type === 'madani').map(([k]) => k));
        case 'quran':
        case 'revelation':
        default:
            // Whole Quran — every surah is in scope (1..114).
            return new Set(Array.from({ length: 114 }, (_, i) => String(i + 1)));
    }
}

// Returns section IDs that fall within the active scope. Used by sidebar chip
// rendering to only show labels actually assigned to in-scope sections.
function getScopeSectionIds() {
    const scopeSurahs = getScopeSurahNumbers();
    const ids = new Set();
    Object.keys(window.THEMATIC_ASSIGNMENTS || {}).forEach(sectionId => {
        if (sectionId.startsWith('_')) return; // skip surah-summary entries
        const surah = sectionId.split(':')[0];
        if (scopeSurahs.has(surah)) ids.add(sectionId);
    });
    return ids;
}

function getAssignedLabelIdsForScope() {
    const assignments = window.THEMATIC_ASSIGNMENTS || {};
    const scopedSections = getScopeSectionIds();
    const assignedIds = new Set();

    Object.entries(assignments).forEach(([sectionId, entry]) => {
        if (sectionId.startsWith('_')) return;
        if (!scopedSections.has(sectionId)) return;
        (entry.labels || []).forEach(labelId => assignedIds.add(labelId));
    });

    return assignedIds;
}

// True when the active scope spans multiple surahs AND we have an active filter
// (i.e. we should render a cross-surah results view instead of the normal
// single-surah/juz view).
function shouldRenderCrossSurahResults() {
    if (!hasActiveThematicQuery()) return false;
    if (thematicFilterScope === 'surah') return false;
    if (thematicFilterScope === 'juz' && currentViewMode === 'juz') return false;
    return true;
}

function renderThematicFilterChips() {
    const container = document.getElementById('filterFacetsContainer');
    const tax = window.THEMATIC_TAXONOMY;
    const assignments = window.THEMATIC_ASSIGNMENTS;
    if (!container || !tax || !tax.labels || !tax.facets || !assignments) return;

    const assignedIds = getAssignedLabelIdsForScope();
    const labelCounts = getLabelCountsForScope();
    const searchValue = document.getElementById('filterSearchInput')?.value.toLowerCase().trim() || '';
    container.innerHTML = '';
    let renderedCount = 0;

    Object.keys(tax.facets).forEach(fid => {
        const facet = tax.facets[fid];
        const labels = tax.labels.filter(label => label.facet === fid && assignedIds.has(label.id));
        if (!labels.length) return;

        const wrap = document.createElement('div');
        wrap.className = 'mb-6 filter-facet-group';
        wrap.dataset.facet = fid;

        const title = document.createElement('h4');
        title.className = 'text-xs font-bold uppercase tracking-widest mb-3 opacity-80';
        title.style.color = facet.color || '#F3E4CE';
        title.textContent = (facet.displayName && facet.displayName.en) || fid.replace(/-/g, ' ');
        wrap.appendChild(title);

        const chips = document.createElement('div');
        chips.className = 'flex flex-wrap gap-2';

        labels.forEach(label => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'filter-chip px-3 py-1.5 rounded-full text-xs border transition-colors duration-200';
            chip.dataset.labelId = label.id;
            const en = (label.displayName && label.displayName.en) || label.id;
            const aliases = (label.aliases || []).join(' ');
            chip.dataset.searchTerms = (en + ' ' + aliases + ' ' + label.id).toLowerCase();
            chip.innerHTML = '';
            const labelText = document.createElement('span');
            labelText.textContent = en;
            chip.appendChild(labelText);
            const count = labelCounts.get(label.id) || 0;
            if (count > 0) {
                const countText = document.createElement('span');
                countText.className = 'ml-1 text-[10px] opacity-60';
                countText.textContent = String(count);
                chip.appendChild(countText);
            }
            chip.addEventListener('click', () => toggleFilter(label.id));
            chips.appendChild(chip);
            renderedCount++;
        });

        wrap.appendChild(chips);
        container.appendChild(wrap);
    });

    if (renderedCount === 0) {
        container.innerHTML = '<p class="text-white/40 text-sm font-[\'Nunito\']">No themes are available for this view yet.</p>';
    }

    syncFilterScopeButtons();
    syncFilterChipStates();
    renderThematicQueryBuilder();
    renderRelatedThemeSuggestions();
    updateFilterCount();

    if (searchValue) {
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.style.display = chip.dataset.searchTerms.includes(searchValue) ? '' : 'none';
        });
        document.querySelectorAll('.filter-facet-group').forEach(group => {
            const hasVisible = Array.from(group.querySelectorAll('.filter-chip')).some(c => c.style.display !== 'none');
            group.style.display = hasVisible ? '' : 'none';
        });
    }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Prediction dropdown — Google-style typeahead under the Theme Search input.
 * Suggests scope-aware themes (with match counts) as the user types, ranked by
 * match quality across display name + aliases. Selecting one adds it to the
 * active query, clears the input, and keeps focus for rapid multi-theme building.
 * ────────────────────────────────────────────────────────────────────────── */
const THEME_PREDICTION_LIMIT = 8;
let themePredictionItems = [];
let themePredictionActiveIndex = -1;

function buildThemePredictions(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return [];
    const tax = window.THEMATIC_TAXONOMY;
    if (!tax || !tax.labels) return [];

    const assignedIds = getAssignedLabelIdsForScope(); // in-scope themes only — every hit returns results
    const counts = getLabelCountsForScope();
    const scored = [];

    tax.labels.forEach(label => {
        if (!assignedIds.has(label.id)) return;
        const name = (label.displayName && label.displayName.en) || label.id;
        const nameLower = name.toLowerCase();
        const aliases = (label.aliases || []).map(a => String(a).toLowerCase());

        let tier = -1;
        if (nameLower.startsWith(q)) tier = 0;
        else if (aliases.some(a => a.startsWith(q))) tier = 1;
        else if (nameLower.includes(q)) tier = 2;
        else if (aliases.some(a => a.includes(q))) tier = 3;
        if (tier === -1) return;

        scored.push({
            labelId: label.id,
            name,
            facet: label.facet,
            count: counts.get(label.id) || 0,
            tier
        });
    });

    scored.sort((a, b) => a.tier - b.tier || b.count - a.count || a.name.localeCompare(b.name));
    return scored.slice(0, THEME_PREDICTION_LIMIT);
}

function highlightThemePredictionMatch(text, query) {
    const safe = escapeThematicSearchHtml(text);
    const q = String(query || '').trim();
    if (!q) return safe;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return safe; // matched via an alias — leave the display name unmarked
    return escapeThematicSearchHtml(text.slice(0, idx))
        + '<mark>' + escapeThematicSearchHtml(text.slice(idx, idx + q.length)) + '</mark>'
        + escapeThematicSearchHtml(text.slice(idx + q.length));
}

function hideThemePredictions() {
    const panel = document.getElementById('themeSearchPredictions');
    const input = document.getElementById('filterSearchInput');
    if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
    if (input) input.setAttribute('aria-expanded', 'false');
    themePredictionItems = [];
    themePredictionActiveIndex = -1;
}

function renderThemePredictions() {
    const input = document.getElementById('filterSearchInput');
    const panel = document.getElementById('themeSearchPredictions');
    if (!input || !panel) return;

    const query = input.value;
    if (!query.trim()) { hideThemePredictions(); return; }

    const items = buildThemePredictions(query);
    themePredictionItems = items;
    themePredictionActiveIndex = -1;
    panel.innerHTML = '';

    if (!items.length) {
        const scopeWord = thematicFilterScope === 'quran'
            ? 'the Qur’an'
            : (SCOPE_LABELS[thematicFilterScope] || 'this scope').toLowerCase();
        const empty = document.createElement('div');
        empty.className = 'theme-search-prediction-empty';
        empty.textContent = `No themes match “${query.trim()}” in ${scopeWord}.`;
        panel.appendChild(empty);
        panel.classList.remove('hidden');
        input.setAttribute('aria-expanded', 'true');
        return;
    }

    const facets = window.THEMATIC_TAXONOMY?.facets || {};
    items.forEach(item => {
        const isSelected = activeThematicFilters.has(item.labelId);
        const facetName = (facets[item.facet]?.displayName?.en) || String(item.facet || '').replace(/-/g, ' ');
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'theme-search-prediction';
        row.dataset.labelId = item.labelId;
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        row.innerHTML =
            `<span class="theme-search-prediction-dot" style="background:${getThematicLabelFacetColor(item.labelId)}"></span>` +
            `<span class="theme-search-prediction-text">` +
                `<span class="theme-search-prediction-name">${highlightThemePredictionMatch(item.name, query)}</span>` +
                `<span class="theme-search-prediction-facet">${escapeThematicSearchHtml(facetName)}</span>` +
            `</span>` +
            (item.count ? `<span class="theme-search-prediction-count">${item.count}</span>` : '') +
            (isSelected ? `<span class="material-symbols-outlined text-base theme-search-prediction-check">check</span>` : '');
        // Use mousedown (not click) so selection runs before the input loses focus.
        row.addEventListener('mousedown', (event) => {
            event.preventDefault();
            selectThemePrediction(item.labelId);
        });
        panel.appendChild(row);
    });

    panel.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
}

function selectThemePrediction(labelId) {
    if (!labelId) return;
    toggleFilter(labelId); // add (or remove if already active), then re-apply the view
    const input = document.getElementById('filterSearchInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    // Reset the parallel chip-library filter so the full library is visible again.
    document.querySelectorAll('.filter-chip').forEach(chip => { chip.style.display = ''; });
    document.querySelectorAll('.filter-facet-group').forEach(group => { group.style.display = ''; });
    hideThemePredictions();
}

function moveThemePredictionActive(delta) {
    const panel = document.getElementById('themeSearchPredictions');
    if (!panel || panel.classList.contains('hidden')) return;
    const rows = Array.from(panel.querySelectorAll('.theme-search-prediction'));
    if (!rows.length) return;
    themePredictionActiveIndex = (themePredictionActiveIndex + delta + rows.length) % rows.length;
    rows.forEach((row, i) => row.classList.toggle('is-active', i === themePredictionActiveIndex));
    const active = rows[themePredictionActiveIndex];
    if (active) active.scrollIntoView({ block: 'nearest' });
}

function handleThemePredictionKeydown(event) {
    const panel = document.getElementById('themeSearchPredictions');
    const open = panel && !panel.classList.contains('hidden');
    switch (event.key) {
        case 'ArrowDown':
            if (!open) { renderThemePredictions(); return; }
            event.preventDefault();
            moveThemePredictionActive(1);
            break;
        case 'ArrowUp':
            if (!open) return;
            event.preventDefault();
            moveThemePredictionActive(-1);
            break;
        case 'Enter':
            if (open && themePredictionActiveIndex >= 0 && themePredictionItems[themePredictionActiveIndex]) {
                event.preventDefault();
                selectThemePrediction(themePredictionItems[themePredictionActiveIndex].labelId);
            }
            break;
        case 'Escape':
            if (open) { event.preventDefault(); hideThemePredictions(); }
            break;
    }
}

const SCOPE_LABELS = {
    surah: 'This surah',
    juz: 'This juz',
    makki: 'Makki surahs',
    madani: 'Madani surahs',
    quran: 'Whole Qur’an',
    revelation: 'Revelation order'
};

const THEMATIC_QUERY_TEMPLATES = [
    {
        id: 'hour-cosmic-signs',
        title: 'The Hour + cosmic signs',
        category: 'Afterlife',
        description: 'End-time imagery where the sun, moon, stars, and heavens become signs.',
        logic: 'Signs of the Hour AND Sun, Moon, Stars',
        icon: 'brightness_6',
        scope: 'quran',
        groups: [
            { op: 'and', terms: ['signs-of-the-hour', 'cosmic-bodies'] }
        ]
    },
    {
        id: 'sulaiman-gratitude',
        title: 'Sulaiman + gratitude',
        category: 'Story',
        description: 'A focused narrative path through kingdom, gifts, and thankfulness.',
        logic: 'Solomon AND Gratitude',
        icon: 'workspace_premium',
        scope: 'quran',
        groups: [
            { op: 'and', terms: ['solomon', 'gratitude'] }
        ]
    },
    {
        id: 'orphan-justice',
        title: 'Orphans + justice',
        category: 'Ethics',
        description: 'Social care where mercy becomes legal and moral responsibility.',
        logic: 'Orphans AND Justice',
        icon: 'volunteer_activism',
        scope: 'quran',
        groups: [
            { op: 'and', terms: ['orphan-care', 'justice-and-witness'] }
        ]
    },
    {
        id: 'interest-hell',
        title: 'Interest + Hell',
        category: 'Real world',
        description: 'A tight search on riba and the afterlife warning attached to it.',
        logic: 'Interest AND Hell',
        icon: 'gavel',
        scope: 'quran',
        groups: [
            { op: 'and', terms: ['interest', 'hell'] }
        ]
    },
    {
        id: 'human-creation-resurrection',
        title: 'Creation + return',
        category: 'Creation',
        description: 'How human origin becomes an argument for resurrection.',
        logic: 'Human creation AND Resurrection',
        icon: 'public',
        scope: 'quran',
        groups: [
            { op: 'and', terms: ['human-creation', 'resurrection'] }
        ]
    }
];

function countMatchesForThematicGroups(groups, scope = 'quran') {
    const originalScope = thematicFilterScope;
    thematicFilterScope = scope;
    const scopedSections = getScopeSectionIds();
    thematicFilterScope = originalScope;

    let count = 0;
    Object.entries(window.THEMATIC_ASSIGNMENTS || {}).forEach(([sectionId, entry]) => {
        if (sectionId.startsWith('_') || !scopedSections.has(sectionId)) return;
        const labels = new Set((entry && entry.labels) || []);
        const matches = groups.every(group => {
            const terms = Array.isArray(group.terms) ? group.terms : [];
            if (!terms.length) return true;
            if (group.op === 'and') return terms.every(labelId => labels.has(labelId));
            return terms.some(labelId => labels.has(labelId));
        });
        if (matches) count++;
    });
    return count;
}

function isCurrentThematicTemplate(template) {
    const activeGroups = getNonEmptyThematicFilterGroups();
    const templateGroups = (template.groups || []).filter(group => group.terms?.length);
    if (activeGroups.length !== templateGroups.length) return false;
    return templateGroups.every((templateGroup, index) => {
        const activeGroup = activeGroups[index];
        if (!activeGroup || activeGroup.op !== templateGroup.op) return false;
        const activeTerms = [...activeGroup.terms].sort().join('|');
        const templateTerms = [...templateGroup.terms].sort().join('|');
        return activeTerms === templateTerms;
    });
}

function renderThematicQueryTemplates() {
    const container = document.getElementById('filterTemplateList');
    if (!container) return;

    const knownIds = new Set((window.THEMATIC_TAXONOMY?.labels || []).map(label => label.id));
    container.innerHTML = '';

    THEMATIC_QUERY_TEMPLATES.forEach(template => {
        const hasRequiredTerms = template.groups.every(group =>
            group.terms.some(labelId => !knownIds.size || knownIds.has(labelId))
        );
        if (!hasRequiredTerms) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-template-btn';
        button.classList.toggle('active-template', isCurrentThematicTemplate(template));
        button.dataset.templateId = template.id;
        const count = countMatchesForThematicGroups(template.groups, template.scope);
        button.innerHTML = `
            <span class="theme-starter-kicker">
                <span>${escapeThematicSearchHtml(template.category || 'Path')}</span>
                <span>${count} section${count === 1 ? '' : 's'}</span>
            </span>
            <span class="theme-starter-title">
                <span class="material-symbols-outlined text-[#56A3A6] align-[-3px] mr-1" aria-hidden="true">${template.icon}</span>
                ${escapeThematicSearchHtml(template.title)}
            </span>
            <span class="theme-starter-description">${escapeThematicSearchHtml(template.description || '')}</span>
            <span class="theme-starter-logic">${escapeThematicSearchHtml(template.logic || '')}</span>
        `;
        button.addEventListener('click', () => applyThematicQueryTemplate(template.id));
        container.appendChild(button);
    });
}

function applyThematicQueryTemplate(templateId) {
    const template = THEMATIC_QUERY_TEMPLATES.find(item => item.id === templateId);
    if (!template) return;

    applyThematicFilterGroups(template.groups, template.scope);
    syncFilterScopeButtons();
    syncFilterMatchModeButtons();
    renderThematicQueryBuilder();
    renderThematicFilterChips();
    applyFiltersToView();
    if (window.showToast) window.showToast(`Started ${template.title}`, 'filter_alt');
}

function syncFilterScopeButtons() {
    document.querySelectorAll('.filter-scope-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.scope === thematicFilterScope);
    });
    const hint = document.getElementById('filterScopeHint');
    if (hint) hint.textContent = SCOPE_LABELS[thematicFilterScope] || 'This surah';
}

function setThematicFilterScope(scope) {
    if (!SCOPE_LABELS[scope]) return;
    // If the user picks a Makki/Madani/etc scope without metadata loaded, fall
    // back to whole-quran semantics with a small console note.
    if ((scope === 'makki' || scope === 'madani' || scope === 'revelation') && !window.SURAH_METADATA) {
        console.warn('[filter] surah_metadata.json not loaded — falling back to whole-quran scope');
        scope = 'quran';
    }
    thematicFilterScope = scope;
    syncFilterScopeButtons();
    renderThematicFilterChips();
    applyFiltersToView();
    renderThemePredictions(); // refresh suggestions/counts for the new scope (no-op if input empty)
}

function syncFilterMatchModeButtons() {
    const activeGroup = getActiveThematicFilterGroup();
    thematicFilterMatchMode = activeGroup?.op === 'and' ? 'all' : 'any';

    document.querySelectorAll('.filter-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === thematicFilterMatchMode);
    });
    const hint = document.getElementById('filterModeHint');
    if (hint) {
        hint.textContent = thematicFilterMatchMode === 'all'
            ? 'Require every selected theme'
            : 'Accept any selected theme';
    }
}

function setThematicFilterMatchMode(mode) {
    if (mode !== 'any' && mode !== 'all') return;
    thematicFilterMatchMode = mode;
    const activeGroup = getActiveThematicFilterGroup();
    activeGroup.op = mode === 'all' ? 'and' : 'or';
    syncActiveThematicFiltersFromGroups();
    syncFilterMatchModeButtons();
    renderThematicQueryBuilder();
    applyFiltersToView();
}

function syncFilterChipStates() {
    const tax = window.THEMATIC_TAXONOMY;
    if (!tax || !tax.labels) return;

    document.querySelectorAll('.filter-chip').forEach(chip => {
        const label = tax.labels.find(l => l.id === chip.dataset.labelId);
        const facetColor = (tax.facets?.[label?.facet]?.color) || label?.color || '#56A3A6';
        const active = activeThematicFilters.has(chip.dataset.labelId);
        chip.classList.toggle('active-filter', active);
        chip.style.backgroundColor = active ? facetColor : 'transparent';
        chip.style.borderColor = active ? facetColor : facetColor + '40';
        chip.style.color = active ? '#fff' : '#F3E4CE';
        // WCAG 1.4.1: pair color with icon so selection is not color-only
        let checkIcon = chip.querySelector('.a11y-check-icon');
        if (active && !checkIcon) {
            checkIcon = document.createElement('span');
            checkIcon.className = 'material-symbols-outlined a11y-check-icon text-[10px] ml-1 leading-none';
            checkIcon.setAttribute('aria-hidden', 'true');
            checkIcon.textContent = 'check';
            chip.appendChild(checkIcon);
        } else if (!active && checkIcon) {
            checkIcon.remove();
        }
    });
}

function toggleFilter(labelId) {
    normalizeThematicFilterGroups();

    if (activeThematicFilters.has(labelId)) {
        removeThematicFilterTerm(labelId);
    } else {
        const activeGroup = getActiveThematicFilterGroup();
        activeGroup.terms.push(labelId);
        syncActiveThematicFiltersFromGroups();
    }

    pruneEmptyThematicFilterGroups();
    normalizeThematicFilterGroups();
    renderThematicQueryBuilder();
    syncFilterChipStates();
    updateFilterCount();
    applyFiltersToView();
}

function clearThematicFilters() {
    const hadCrossSurahResults = !!document.getElementById('crossSurahResults');
    resetThematicFilterQuery();
    renderThematicQueryBuilder();
    syncFilterMatchModeButtons();
    syncFilterChipStates();
    renderRelatedThemeSuggestions();
    updateFilterCount();
    syncThematicQueryToUrl();

    // If cross-surah results were on screen, reload the user's original view.
    if (hadCrossSurahResults) {
        const select = document.getElementById('surahSelect');
        let targetId = parseInt(select?.value);
        if (!Number.isFinite(targetId) || targetId < 1) {
            targetId = 1;
            if (select) select.value = String(targetId);
        }
        if (typeof loadContent === 'function') {
            loadContent(targetId);
            return;
        }
    }
    applyFiltersToView();
}

function getThematicLabelName(labelId) {
    const label = window.THEMATIC_TAXONOMY?.labels?.find(l => l.id === labelId);
    return (label?.displayName && label.displayName.en) || labelId;
}

function updateFilterCount() {
    const count = getThematicFilterTermCount();
    const rowCount = getNonEmptyThematicFilterGroups().length;
    const text = document.getElementById('activeFilterCountText');
    const clearBtn = document.getElementById('clearFiltersBtn');
    const copyBtn = document.getElementById('copyFilterQueryBtn');
    const openBtn = document.getElementById('openFilterBtn');
    if (text) {
        text.textContent = rowCount > 1
            ? `${rowCount} rows · ${count} themes`
            : `${count} selected`;
    }
    if (clearBtn) clearBtn.classList.add('hidden');
    if (copyBtn) copyBtn.classList.toggle('hidden', count === 0);

    // Top-bar Theme Search button: keep it visibly labelled (not icon-only) and
    // make the label communicate the active query. Desktop spells it out; mobile
    // stays compact. Empty mobile label => icon-only when no query is active.
    const hasQuery = count > 0;
    const desktopText = hasQuery
        ? `Edit Theme Search · ${rowCount} condition${rowCount === 1 ? '' : 's'}`
        : 'Theme Search';
    const mobileText = hasQuery ? `Themes · ${count}` : '';
    const desktopLabel = document.getElementById('openFilterBtnLabel');
    const mobileLabel = document.getElementById('openFilterBtnLabelMobile');
    if (desktopLabel) desktopLabel.textContent = desktopText;
    if (mobileLabel) mobileLabel.textContent = mobileText;

    if (openBtn) {
        openBtn.classList.toggle('ring-2', count > 0);
        openBtn.classList.toggle('ring-[#56A3A6]', count > 0);
        openBtn.classList.toggle('bg-white/20', count > 0);
        openBtn.title = desktopText;
        openBtn.setAttribute('aria-label', desktopText);
    }
}

function updateActiveFilterBanner(visibleCount) {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;

    let banner = document.getElementById('activeFilterBanner');
    if (!hasActiveThematicQuery()) {
        banner?.remove();
        return;
    }

    const selectedNames = getThematicQueryText();
    const searchTitle = getThematicSearchTitle();
    const scopeLabel = (SCOPE_LABELS[thematicFilterScope] || 'This surah').toLowerCase();

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'activeFilterBanner';
        banner.className = "active-filter-banner sticky top-0 z-20 mb-6 rounded-xl border border-[#56A3A6]/40 bg-[#12101C]/95 backdrop-blur px-4 py-3 text-[#F3E4CE] shadow-lg font-['Nunito']";
        contentArea.prepend(banner);
    }

    banner.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-[#56A3A6] text-xl mt-0.5">filter_alt</span>
                <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-[#56A3A6]">${searchTitle}</p>
                    <p class="text-sm text-white/80">Showing ${visibleCount} section${visibleCount === 1 ? '' : 's'} matching ${selectedNames} from ${scopeLabel}.</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button id="activeFilterBannerCopyBtn" type="button" class="text-xs font-bold uppercase tracking-wider text-[#56A3A6] hover:text-white transition">Copy link</button>
                <button id="activeFilterBannerClearBtn" type="button" class="text-xs font-bold uppercase tracking-wider text-[#56A3A6] hover:text-white transition">Clear filters</button>
            </div>
        </div>
    `;
    document.getElementById('activeFilterBannerCopyBtn')?.addEventListener('click', copyThematicQueryLink);
    document.getElementById('activeFilterBannerClearBtn')?.addEventListener('click', clearThematicFilters);
}

window.applyThematicLabelFilterFromSection = function(labelId) {
    setSingleThematicFilter(labelId, 'surah');
    renderThematicFilterChips();
    applyFiltersToView();
    if (window.showToast) window.showToast(`Filtered by ${getThematicLabelName(labelId)}`, 'filter_alt');
};

// Returns true if the section's labels satisfy the grouped query. Rows are
// joined by AND; terms inside each row use that row's OR/AND mode.
function sectionMatchesFilters(sectionId) {
    const groups = getNonEmptyThematicFilterGroups();
    if (groups.length === 0) return true;

    const entry = (window.THEMATIC_ASSIGNMENTS || {})[sectionId];
    const labels = new Set((entry && entry.labels) || []);

    return groups.every(group => {
        if (group.op === 'and') {
            return group.terms.every(labelId => labels.has(labelId));
        }
        return group.terms.some(labelId => labels.has(labelId));
    });
}

function getSectionFilterMatchDetails(sectionId) {
    const groups = getNonEmptyThematicFilterGroups();
    const entry = (window.THEMATIC_ASSIGNMENTS || {})[sectionId];
    const labels = new Set((entry && entry.labels) || []);
    const matchedIds = [];
    const seen = new Set();

    groups.forEach(group => {
        group.terms.forEach(labelId => {
            if (!labels.has(labelId) || seen.has(labelId)) return;
            seen.add(labelId);
            matchedIds.push(labelId);
        });
    });

    return matchedIds;
}

function renderFilterMatchExplanationForCard(card, sectionId) {
    card.querySelector('.filter-match-explanation')?.remove();
    if (!hasActiveThematicQuery()) return;

    const matchedIds = getSectionFilterMatchDetails(sectionId);
    if (!matchedIds.length) return;

    const explanation = document.createElement('div');
    explanation.className = "filter-match-explanation mb-6 rounded-2xl border border-[#56A3A6]/20 bg-[#56A3A6]/10 px-3 py-3 font-['Nunito']";

    const header = document.createElement('div');
    header.className = 'flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#56A3A6] mb-2';
    header.innerHTML = '<span class="material-symbols-outlined text-sm" aria-hidden="true">task_alt</span><span>Matched</span>';
    explanation.appendChild(header);

    const chips = document.createElement('div');
    chips.className = 'flex flex-wrap gap-1.5';
    matchedIds.forEach(labelId => {
        const chip = document.createElement('span');
        chip.className = 'filter-match-chip rounded-full border px-2 py-1 text-[11px] font-bold';
        const color = getThematicLabelFacetColor(labelId);
        chip.style.borderColor = color + '55';
        chip.style.backgroundColor = color + '18';
        chip.style.color = '#F3E4CE';
        chip.textContent = getThematicLabelName(labelId);
        chips.appendChild(chip);
    });
    explanation.appendChild(chips);

    const headerNode = card.querySelector('.thematic-header-with-labels') ||
        Array.from(card.children).find(child => child.classList?.contains('border-b'));
    if (headerNode && headerNode.nextSibling) {
        card.insertBefore(explanation, headerNode.nextSibling);
    } else {
        card.appendChild(explanation);
    }
}

function broadenThematicQuery() {
    normalizeThematicFilterGroups();
    const hasStrictRows = thematicFilterGroups.some(group => group.op === 'and' && group.terms.length > 1);

    if (hasStrictRows) {
        thematicFilterGroups.forEach(group => {
            if (group.op === 'and' && group.terms.length > 1) group.op = 'or';
        });
    } else if (thematicFilterGroups.length > 1) {
        const mergedTerms = [];
        const seen = new Set();
        thematicFilterGroups.forEach(group => {
            group.terms.forEach(labelId => {
                if (seen.has(labelId)) return;
                seen.add(labelId);
                mergedTerms.push(labelId);
            });
        });
        thematicFilterGroups = [{ id: nextThematicFilterGroupId++, op: 'or', terms: mergedTerms }];
        activeThematicFilterGroupId = thematicFilterGroups[0].id;
    }

    normalizeThematicFilterGroups();
    syncFilterMatchModeButtons();
    renderThematicQueryBuilder();
    syncFilterChipStates();
    updateFilterCount();
    applyFiltersToView();
}

function attachFilterEmptyStateActions() {
    document.getElementById('emptyStateClearBtn')?.addEventListener('click', clearThematicFilters);
    document.getElementById('emptyStateWholeQuranBtn')?.addEventListener('click', () => {
        thematicFilterScope = 'quran';
        syncFilterScopeButtons();
        renderThematicFilterChips();
        applyFiltersToView();
    });
    document.getElementById('emptyStateBroadenBtn')?.addEventListener('click', broadenThematicQuery);
}

function renderFilterEmptyStateHtml(message) {
    const scopeAction = thematicFilterScope === 'quran'
        ? ''
        : '<button id="emptyStateWholeQuranBtn" class="rounded-full border border-[#56A3A6]/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#56A3A6] hover:text-white hover:bg-[#56A3A6]/15 transition">Whole Qur’an</button>';
    return `
        <span class="material-symbols-outlined text-4xl text-white/20 mb-4 block">filter_list_off</span>
        <p class="text-white/60 font-['Nunito'] text-lg">${message}</p>
        <div class="mt-5 flex flex-wrap items-center justify-center gap-3 font-['Nunito']">
            ${scopeAction}
            <button id="emptyStateBroadenBtn" class="rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#F3E4CE] hover:bg-white/10 transition">Broaden search</button>
            <button id="emptyStateClearBtn" class="rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/10 transition">Clear filters</button>
        </div>
    `;
}

// Filter rendered cards by section ID. Honors the active match mode.
function applyFiltersToView() {
    renderThematicFilterChips();
    syncThematicQueryToUrl();

    if (isThemeSearchPageOpen()) {
        renderThemeSearchResultsList();
        return;
    }

    // Cross-surah results view takes over when scope spans multiple surahs and
    // filters are active. Otherwise we just hide/show cards in the current view.
    if (shouldRenderCrossSurahResults()) {
        renderCrossSurahResults();
        return;
    }

    // Cross-surah view may have run last time; if it's still mounted but no
    // longer applicable, drop it and re-render the original view.
    if (document.getElementById('crossSurahResults')) {
        const surahId = parseInt(document.getElementById('surahSelect')?.value);
        if (typeof loadContent === 'function' && surahId) loadContent(surahId);
        return;
    }

    const cards = document.querySelectorAll('.thematic-card');
    const haveFilters = hasActiveThematicQuery();
    let visibleCount = 0;

    cards.forEach(card => {
        const sectionId = `${card.dataset.surah}:${card.dataset.start}`;
        const show = sectionMatchesFilters(sectionId);
        card.style.display = show ? '' : 'none';
        if (show) {
            visibleCount++;
            renderFilterMatchExplanationForCard(card, sectionId);
        } else {
            card.querySelector('.filter-match-explanation')?.remove();
        }
    });

    updateActiveFilterBanner(visibleCount);

    document.querySelectorAll('.surah-mini-header').forEach(header => {
        let hasVisible = false;
        let next = header.nextElementSibling;
        while (next && !next.classList.contains('surah-mini-header')) {
            if (next.classList.contains('thematic-card') && next.style.display !== 'none') {
                hasVisible = true; break;
            }
            next = next.nextElementSibling;
        }
        header.style.display = hasVisible ? '' : 'none';
    });

    const contentArea = document.getElementById('contentArea');
    let emptyState = document.getElementById('filterEmptyState');
    if (haveFilters && visibleCount === 0) {
        if (!emptyState && contentArea) {
            emptyState = document.createElement('div');
            emptyState.id = 'filterEmptyState';
            emptyState.className = "text-center py-16 w-full";
            emptyState.innerHTML = renderFilterEmptyStateHtml('No sections in this view match the selected themes.');
            contentArea.appendChild(emptyState);
            attachFilterEmptyStateActions();
        } else if (emptyState) {
            emptyState.innerHTML = renderFilterEmptyStateHtml('No sections in this view match the selected themes.');
            emptyState.style.display = '';
            attachFilterEmptyStateActions();
        }
    } else if (emptyState) {
        emptyState.style.display = 'none';
    }
}

// Plays the surah intro mp3 (e.g. "Surah Al-Baqarah"), then runs `next`.
// Uses the R2-hosted intro audio (matching the main player); falls back to
// the local data/audio/intro/NNN.mp3 if R2 is unreachable.
function playSurahIntroThen(surahId, next) {
    if (!surahId || typeof next !== 'function') {
        if (typeof next === 'function') next();
        return;
    }
    const sPad = String(surahId).padStart(3, '0');
    const remoteUrl = `https://audio.thematicquran.com/intro/${sPad}.mp3`;
    const localUrl = `data/audio/intro/${sPad}.mp3`;

    // Stop any existing main-player audio so the intro plays cleanly.
    if (typeof stopAllAudio === 'function') {
        try { stopAllAudio(); } catch (e) { /* no-op */ }
    }

    const player = new Audio(remoteUrl);
    player.preload = 'auto';
    let chained = false;
    const chain = () => { if (chained) return; chained = true; next(); };

    player.addEventListener('ended', chain);
    player.addEventListener('error', () => {
        // Try local fallback once.
        if (player.src.indexOf(remoteUrl) !== -1) {
            player.src = localUrl;
            player.play().catch(chain);
        } else {
            chain();
        }
    });

    // Safety net: never block forever on a broken intro.
    setTimeout(chain, 12000);

    player.play().catch(() => {
        // Autoplay blocked? Just skip the intro and proceed.
        chain();
    });
}

// ==============================================================
//   CROSS-SURAH RESULTS VIEW
// ==============================================================
// When the scope spans multiple surahs and filters are active, this takes
// over the content area: renders every matching section grouped by surah,
// in mushaf order (or revelation order if scope is 'revelation').

function getSurahSortTuple(surahId) {
    const meta = window.SURAH_METADATA || {};
    const surahMeta = meta[String(surahId)] || {};
    const revelationOrder = surahMeta.revelationOrder ?? 999;
    const typeOrder = surahMeta.type === 'makki' ? 0 : surahMeta.type === 'madani' ? 1 : 2;
    return { revelationOrder, typeOrder };
}

function compareCrossSurahMatches(a, b) {
    const aTuple = getSurahSortTuple(a.surahId);
    const bTuple = getSurahSortTuple(b.surahId);

    switch (thematicResultSortMode) {
        case 'revelation':
            return aTuple.revelationOrder - bTuple.revelationOrder || a.surahId - b.surahId || a.start - b.start;
        case 'makki-madani':
            return aTuple.typeOrder - bTuple.typeOrder || a.surahId - b.surahId || a.start - b.start;
        case 'best-match':
            return b.matchCount - a.matchCount || a.verseCount - b.verseCount || a.surahId - b.surahId || a.start - b.start;
        case 'shortest':
            return a.verseCount - b.verseCount || b.matchCount - a.matchCount || a.surahId - b.surahId || a.start - b.start;
        case 'mushaf':
        default:
            return a.surahId - b.surahId || a.start - b.start;
    }
}

function getCrossSurahHeaderHtml(surahId, sectionCount) {
    const meta = window.SURAH_METADATA || {};
    const surahName = (typeof window.getSurahName === 'function')
        ? window.getSurahName(surahId)
        : `Surah ${surahId}`;
    const cleanName = String(surahName).replace(/^\d+\s+/, '');
    const revOrder = meta[String(surahId)]?.revelationOrder;
    const typeBadge = meta[String(surahId)]?.type
        ? `<span class="ml-2 align-middle text-[10px] uppercase tracking-widest text-[#56A3A6]/80">${meta[String(surahId)].type}</span>`
        : '';
    const revBadge = (thematicResultSortMode === 'revelation' && revOrder)
        ? `<span class="ml-2 align-middle text-[10px] uppercase tracking-widest text-white/40">Revealed #${revOrder}</span>`
        : '';

    return `
        <div class="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <span class="material-symbols-outlined text-[#56A3A6] text-base">menu_book</span>
            <span class="font-['Forum'] text-lg text-white tracking-wide">Surah ${cleanName}</span>
            ${typeBadge}
            ${revBadge}
            <span class="ml-2 text-[10px] uppercase tracking-widest text-white/40">${sectionCount} section${sectionCount === 1 ? '' : 's'}</span>
        </div>
    `;
}

function renderCrossSurahResults() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    if (typeof createCard !== 'function') {
        console.warn('[filter] createCard() unavailable — cannot render cross-surah results');
        return;
    }

    const scopeSurahs = getScopeSurahNumbers();
    const sortedSurahs = Array.from(scopeSurahs).map(Number).sort((a, b) => a - b);

    // For each surah in scope, walk its theme_breaks and pick matched sections.
    contentArea.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.id = 'crossSurahResults';
    wrapper.className = 'cross-surah-results';
    contentArea.appendChild(wrapper);

    const matches = [];

    sortedSurahs.forEach(surahId => {
        const breaks = THEME_BREAKS[String(surahId)] || [];
        const surahVerses = QURAN_DATA.filter(v => v[CONSTANTS.KEY_SURAH_NO] === surahId);
        if (!surahVerses.length || !breaks.length) return;
        const lastVerse = surahVerses[surahVerses.length - 1][CONSTANTS.KEY_AYAH_NO];

        breaks.forEach((startVerse, idx) => {
            const start = (typeof startVerse === 'object') ? startVerse.start : startVerse;
            const nextRaw = breaks[idx + 1];
            const nextStart = nextRaw ? (typeof nextRaw === 'object' ? nextRaw.start : nextRaw) : null;
            const endVerse = nextStart ? (nextStart - 1) : lastVerse;
            const sectionId = `${surahId}:${start}`;
            if (!sectionMatchesFilters(sectionId)) return;

            const sectionData = surahVerses.filter(v => {
                const vn = v[CONSTANTS.KEY_AYAH_NO];
                return vn >= start && vn <= endVerse;
            });
            if (!sectionData.length) return;
            const matchedIds = getSectionFilterMatchDetails(sectionId);
            matches.push({
                surahId,
                start,
                endVerse,
                data: sectionData,
                matchCount: matchedIds.length,
                verseCount: sectionData.length
            });
        });
    });

    matches.sort(compareCrossSurahMatches);
    const totalMatches = matches.length;
    const matchedSurahs = Array.from(new Set(matches.map(match => match.surahId)));

    const countsBySurah = new Map();
    matches.forEach(match => {
        countsBySurah.set(match.surahId, (countsBySurah.get(match.surahId) || 0) + 1);
    });

    let lastRenderedSurah = null;
    matches.forEach(match => {
        if (match.surahId !== lastRenderedSurah) {
            const header = document.createElement('div');
            header.className = "surah-mini-header cross-surah-divider mt-4 mb-6 text-center";
            header.innerHTML = getCrossSurahHeaderHtml(match.surahId, countsBySurah.get(match.surahId) || 1);
            wrapper.appendChild(header);
            lastRenderedSurah = match.surahId;
        }
        const card = createCard(match.surahId, match.start, match.endVerse, match.data);
        renderFilterMatchExplanationForCard(card, `${match.surahId}:${match.start}`);
        wrapper.appendChild(card);
    });

    updateActiveFilterBanner(totalMatches);

    if (totalMatches === 0) {
        wrapper.innerHTML = `
            <div class="text-center py-16">
                ${renderFilterEmptyStateHtml('No sections in the selected scope match these themes.')}
            </div>
        `;
        attachFilterEmptyStateActions();
    }

    // Stash a queue on the wrapper for the audio player to walk.
    wrapper.dataset.totalMatches = String(totalMatches);
    wrapper.dataset.matchedSurahs = JSON.stringify(matchedSurahs);

    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) mainContainer.scrollTop = 0;
}

// ... (Helpers) ...
function isValidSelection(targetId) { if (selectedItems.size === 0) return true; const allCards = Array.from(document.querySelectorAll('.thematic-card')); const targetIdx = allCards.findIndex(c => c.id === targetId); const selectedIndices = []; allCards.forEach((card, index) => { if (selectedItems.has(card.id)) selectedIndices.push(index); }); const minIdx = Math.min(...selectedIndices); const maxIdx = Math.max(...selectedIndices); return (targetIdx === minIdx - 1) || (targetIdx === maxIdx + 1); }
function enforceConsecutiveSelection() { const allCards = Array.from(document.querySelectorAll('.thematic-card')); if (selectedItems.size === 0) { allCards.forEach(card => card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale')); return; } if (selectedItems.size >= MAX_SELECTION) { allCards.forEach(card => { if (!selectedItems.has(card.id)) card.classList.add('opacity-40', 'pointer-events-none', 'grayscale'); else card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'); }); return; } const selectedIndices = []; allCards.forEach((card, index) => { if (selectedItems.has(card.id)) selectedIndices.push(index); }); const minIdx = Math.min(...selectedIndices); const maxIdx = Math.max(...selectedIndices); allCards.forEach((card, index) => { if (selectedItems.has(card.id)) { card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'); return; } if ((index === maxIdx + 1) || (index === minIdx - 1)) { card.classList.remove('opacity-40', 'pointer-events-none', 'grayscale'); } else { card.classList.add('opacity-40', 'pointer-events-none', 'grayscale'); } }); }
function toggleSelectionModeUI(active) { const btn = document.getElementById('toggleSelectModeBtn'); const bulkBar = document.getElementById('bulkDownloadBar'); if (typeof setSelectionMode === 'function') setSelectionMode(active); if (active) { isSelectMode = true; btn?.classList.add('bg-[#56A3A6]', 'text-white'); btn?.classList.remove('text-white/70'); bulkBar?.classList.remove('-bottom-24'); bulkBar?.classList.add('bottom-32'); } else { isSelectMode = false; btn?.classList.remove('bg-[#56A3A6]', 'text-white'); btn?.classList.add('text-white/70'); bulkBar?.classList.remove('bottom-32'); bulkBar?.classList.add('-bottom-24'); selectedItems.clear(); document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('opacity-40', 'pointer-events-none', 'grayscale')); updateBulkBar(); } }
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
    const inCrossSurahResults = !!document.getElementById('crossSurahResults');

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
        const prevSurah = parseInt(currentCard.dataset.surah);
        const surahChanged = prevSurah !== s;

        setTimeout(() => {
            document.querySelectorAll('.thematic-card').forEach(c => c.classList.remove('ring-2', 'ring-[#56A3A6]'));
            targetCard.classList.add('ring-2', 'ring-[#56A3A6]');
            // In the cross-surah results view, when we cross a surah boundary
            // mid-queue, play the new surah's intro mp3 first, then start
            // the section. (playSession's own intro logic only fires when
            // start === 1 with no target verse — which usually isn't true
            // for filtered cross-surah results.)
            if (inCrossSurahResults && surahChanged && typeof playSurahIntroThen === 'function') {
                playSurahIntroThen(s, () => {
                    if (typeof playSession === 'function') playSession(s, start, end, null, null, { skipIntro: true });
                });
            } else if (typeof playSession === 'function') {
                playSession(s, start, end);
            }
            document.dispatchEvent(new CustomEvent('manual-play-started', { detail: { card: targetCard } }));
        }, 500);

        triggerLookAheadPreload(targetCard);
    } else if (direction === 'next') {
        if (inCrossSurahResults) {
            if (typeof window.openThemeSearchSidebar === 'function') window.openThemeSearchSidebar();
            if (window.showToast) window.showToast('Finished filtered sections', 'check');
            return;
        }
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

function buildFeedbackUrl(source = 'app') {
    const feedbackUrl = new URL('/feedback.html', window.location.origin);
    feedbackUrl.searchParams.set('source', source);
    feedbackUrl.searchParams.set('url', window.location.href);

    const surahSelect = document.getElementById('surahSelect');
    const surahValue = surahSelect?.value || '';
    if (surahValue) feedbackUrl.searchParams.set('surah', surahValue);

    const viewMode = currentViewMode || document.getElementById('viewModeSelect')?.value || '';
    if (viewMode) feedbackUrl.searchParams.set('view', viewMode);

    if (typeof hasActiveThematicQuery === 'function' && hasActiveThematicQuery()) {
        const queryText = getThematicQueryText();
        if (queryText) feedbackUrl.searchParams.set('theme', queryText);
        if (typeof encodeThematicQueryState === 'function') {
            const token = encodeThematicQueryState();
            if (token) feedbackUrl.searchParams.set('tq', token);
        }
    }

    return feedbackUrl.toString();
}

window.buildFeedbackUrl = buildFeedbackUrl;

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
            const rStartRaw = parseInt(rb.verseNumber || rb.verse_number);
            const rId = rb.id || rbObj.id;

            if (rSurah && rStartRaw) {
                let blockStart = rStartRaw;
                let blockEnd = rStartRaw;
                
                // Natively map mathematically isolated downloaded Ayahs directly into their correct Thematic Quran boundaries 
                if (THEME_BREAKS && THEME_BREAKS[String(rSurah)]) {
                    let breaks = THEME_BREAKS[String(rSurah)].map(Number).sort((a,b)=>a-b);
                    if (breaks.length > 0 && breaks[0] !== 1) breaks.unshift(1);
                    
                    for (let i = 0; i < breaks.length; i++) {
                        if (breaks[i] <= rStartRaw) blockStart = breaks[i];
                        else break;
                    }
                    
                    let bIndex = breaks.indexOf(blockStart);
                    if (bIndex !== -1 && bIndex + 1 < breaks.length) {
                        blockEnd = breaks[bIndex + 1] - 1;
                    } else if (QURAN_DATA && QURAN_DATA.length > 0) { // Resolve end of surah naturally
                        let sv = QURAN_DATA.filter(v => parseInt(v.surah_no) === rSurah);
                        if (sv.length > 0) blockEnd = parseInt(sv[sv.length - 1].ayah_no_surah);
                    }
                }

                let localIdx = localSaved.findIndex(lb => lb.surah === rSurah && lb.start === blockStart);
                if (localIdx === -1) {
                    const surahSelect = document.getElementById('surahSelect');
                    let sName = `Surah ${rSurah}`;
                    if (surahSelect) {
                        const option = Array.from(surahSelect.options).find(opt => parseInt(opt.value) === rSurah);
                        if (option) sName = option.text;
                    }
                    
                    localSaved.push({
                        surah: rSurah,
                        start: blockStart,
                        end: blockEnd,
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
    const bookmarkOpeners = [
        document.getElementById('openBookmarksBtn'),
        document.getElementById('settingsBookmarksBtn')
    ].filter(Boolean);
    bookmarkOpeners.forEach(openBtn => {
        openBtn.addEventListener('click', () => {
            if (window.renderBookmarksGallery) window.renderBookmarksGallery();
            const modal = document.getElementById('bookmarksModal');
            if (modal) modal.classList.remove('hidden');
        });
    });
    
    const closeBtn = document.getElementById('closeBookmarksBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('bookmarksModal');
            if (modal) modal.classList.add('hidden');
        });
    }
});

// ==========================================
// SIRAT-UL-MUSTAQEEM VISUALIZATION ENGINE
// ==========================================

const getLocalYMD = (date) => {
    let y = date.getFullYear();
    let m = String(date.getMonth() + 1).padStart(2, '0');
    let d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

window.calculateDeviations = function(daysArray) {
    let k_drift = 24; // Expanded strictly reflecting broader physical 300px scale bounds natively 
    let points = [];
    let currentBias = 1;

    // Anchor first historical day on baseline natively to begin curve computation
    let prevD = 0; 
    
    // Diagnostic telemetry array
    let mathDiagnostics = [];
    
    // We calculate from historical (index 0) forward to mathematically simulate organic physics physics
    daysArray.forEach((day, index) => {
        let nextD = 0;

        let recovery_rate = k_drift * 1.5; // Physics pull threshold natively back towards zero

        if (day.seconds > 0) {
            // Gradual geometric recentering pulling exactly towards absolute zero
            if (prevD > 0) {
                nextD = Math.max(0, prevD - recovery_rate);
            } else if (prevD < 0) {
                nextD = Math.min(0, prevD + recovery_rate);
            } else {
                nextD = 0;
            }
            if (prevD !== 0 && nextD === 0) currentBias = currentBias === 1 ? -1 : 1; 
        } else {
            // Drift outward — subtle sinusoidal curl makes the path look organic rather than mechanical
            let organicCurl = Math.sin(index * 0.9) * (k_drift * 0.18);
            nextD = prevD + (currentBias * k_drift) + organicCurl;
        }
        
        // Prevent drifting violently off the extended proportional SVG edges natively
        nextD = Math.max(-130, Math.min(130, nextD));
        
        mathDiagnostics.push({
            DayIndex: index,
            Date: day.date || 'N/A',
            ReadSeconds: day.seconds,
            PreviousDeviation: prevD.toFixed(2),
            CalculatedDeviation: nextD.toFixed(2)
        });
        
        points.push(nextD);
        prevD = nextD;
    });
    
    console.groupCollapsed('%c[Path Engine] Mathematical Trajectory Data', 'color: #88FFD1; font-weight: bold;');
    console.table(mathDiagnostics);
    console.groupEnd();
    
    // We physically REVERSE the array natively so that Timeline rendering dynamically mounts 'Today' at the mathematical top `y=0`.
    points.reverse();
    return points;
};

window.generateSiratPathString = function(points, totalRangeNodes = 28) {
    if (!points || points.length === 0) return "";
    
    // Physical Canvas Geometry Padding: Target space spans safely from Y=35 (Top Buffer) to Y=340 (Bottom Buffer)
    const PAD_TOP = 35; 
    const PAD_BOT = 340;
    const BOUNDING_GRID = PAD_BOT - PAD_TOP;
    
    let yStep = BOUNDING_GRID / (totalRangeNodes - 1);
    
    // Anchor oldest Genesis node inherently to the physical layout margin padding
    let activeNodes = points.length;
    let startY = PAD_BOT - ((activeNodes - 1) * yStep); // Dynamic upward root growth offset safely bounded
    
    let path = `M ${points[0]} ${startY}`; 
    
    for (let i = 1; i < activeNodes; i++) {
        let currX = points[i];
        let currY = startY + (i * yStep); 
        
        let prevX = points[i-1];
        let prevY = startY + ((i-1) * yStep);
        
        // Perfectly smoothed monotonic Cubic Bezier curve preventing hard vertical grid flattening natively
        let cp1Y = prevY + (yStep * 0.5);
        let cp2Y = currY - (yStep * 0.5);
        path += ` C ${prevX} ${cp1Y}, ${currX} ${cp2Y}, ${currX} ${currY}`;
    }
    return path;
};

window.simulateUserJourney = function(activeDays = 14) {
    console.log(`%c[Simulator] Bypassing Quran Foundation API! Mocking lifespan of ${activeDays} Days...`, "color: #FF88AA; font-weight: bold;");
    window.initSiratVisualizer(true, activeDays);
};

window.initSiratVisualizer = async function(forceOpen = false, mockDays = 0) {
    let container = document.getElementById('siratContainer');
    let svgPath = document.getElementById('siratPath');
    let loader = document.getElementById('siratLoading');
    let btn = document.getElementById('myPathBtn');
    if (!container || !svgPath) return;
    
    const isOpen = container.style.maxHeight && container.style.maxHeight !== '0px';
    
    if (!isOpen || forceOpen) {
        container.style.maxHeight = '520px';
        container.style.opacity = '1';
        container.style.marginTop = '16px';
        loader.classList.remove('hidden');
        if (btn) btn.classList.add('ring-2', 'ring-white/50');
        
        try {
            let mapObj = {};
            
            if (mockDays === 0) {
                const d = new Date();
                const toStr1 = getLocalYMD(d);
                const dMid = new Date();
                dMid.setDate(dMid.getDate() - 19); 
                const fromStr1 = getLocalYMD(dMid);
                
                const dMidB = new Date();
                dMidB.setDate(dMidB.getDate() - 20);
                const toStr2 = getLocalYMD(dMidB);
                const dPast = new Date();
                dPast.setDate(dPast.getDate() - 27); // Expanding natively to 28 days trailing
                const fromStr2 = getLocalYMD(dPast);
                
                const [res1, res2] = await Promise.all([
                    fetch(`/api/qf/auth/v1/activity-days?from=${fromStr1}&to=${toStr1}&type=QURAN&first=20`),
                    fetch(`/api/qf/auth/v1/activity-days?from=${fromStr2}&to=${toStr2}&type=QURAN&first=20`)
                ]);
                let json1 = await res1.json();
                let json2 = await res2.json();
                
                let dataArr1 = Array.isArray(json1.data) ? json1.data : [];
                let dataArr2 = Array.isArray(json2.data) ? json2.data : [];
                let dataArr = dataArr1.concat(dataArr2);
                
                dataArr.forEach(dItem => {
                    if(dItem && dItem.date) mapObj[dItem.date] = dItem.seconds || 0;
                });
            }
            
            // Build absolute chronological buckets exactly spanning 28 units reliably
            let daysArray = [];
            for(let i=0; i<28; i++) {
                let dt = new Date();
                dt.setDate(dt.getDate() - (27 - i));
                let dtStr = getLocalYMD(dt);
                
                let actualSecs = mapObj[dtStr] || 0;
                if (mockDays > 0) {
                    let histOffset = 27 - i; 
                    // activeDays determines how many days from Today mapping backwards they listened!
                    actualSecs = (histOffset < mockDays) ? 300 : 0;
                    
                    // Procedural heuristic drift injection natively using randomization map matrix correctly dynamically
                    if (actualSecs > 0 && Math.random() < 0.25) {
                        actualSecs = 0; // Simulated missed isolated routine organically 
                    }
                }

                daysArray.push({
                    date: dtStr,
                    seconds: actualSecs
                });
            }
            
            // The Progressive Genesis Matrix:
            let genesisIndex = daysArray.findIndex(d => d.seconds > 0);
            let isCleanSlate = genesisIndex === -1;

            console.groupCollapsed('%c[My Path] 28-day reading history', 'color: #56A3A6; font-weight: bold;');
            console.table(daysArray.map(d => ({
                date: d.date,
                seconds: d.seconds,
                read: d.seconds > 0 ? '✓' : '✗'
            })));
            console.log(`First reading day index: ${genesisIndex === -1 ? 'none (clean slate)' : genesisIndex} | Raw API entries found: ${Object.keys(mapObj).length}`);
            console.groupEnd();

            console.log(`%c[Path Engine] Rendering Matrix. Genesis Node Index: ${genesisIndex} | Total Bounds: ${daysArray.length} Days`, 'color: #8FA8A8;');
            
            // Constrain arrays exactly binding natively to the user's explicit lifespan 
            let activeDaysArray = isCleanSlate ? [] : daysArray.slice(genesisIndex);
            
            let deviations = activeDaysArray.length > 0 ? window.calculateDeviations(activeDaysArray) : [];
            let pathString = activeDaysArray.length > 0 ? window.generateSiratPathString(deviations, 28) : "";
            
            // Visually bind SVG path natively
            if (activeDaysArray.length > 0) svgPath.setAttribute('d', pathString);
            
            // Construct Islamic Month Separators Graphically securely onto exact geometric intersections
            let monthGroup = document.getElementById('islamicMonthLines');
            if (monthGroup) {
                monthGroup.innerHTML = ''; 
                if (activeDaysArray.length > 0) {
                    let islamicFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { month: 'numeric', year: 'numeric' });
                    let prevHijriTag = null;
                    let activeNodes = deviations.length;
                    
                    const PAD_TOP = 35;
                    const PAD_BOT = 340;
                    const BOUNDING_GRID = PAD_BOT - PAD_TOP;
                    
                    let yStep = BOUNDING_GRID / 27; // 28 bounds = 27 physical gaps
                    let startY = PAD_BOT - ((activeNodes - 1) * yStep);
                    
                    activeDaysArray.forEach((dayObj, offsetI) => {
                        let i = (activeNodes - 1) - offsetI; // Geometric inverse correlating array origins structurally
                        let dObj = new Date(dayObj.date);
                        let hijriTag = islamicFormatter.format(dObj);
                        
                        // Inject dividing axis boundary quietly
                        if (prevHijriTag !== null && hijriTag !== prevHijriTag) {
                            let currY = startY + (i * yStep);
                            let monthNameStr = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { month: 'short' }).format(dObj);
                            // Scale line structurally safely binding to mapping x:-150 parameters
                            monthGroup.innerHTML += `<line x1="-150" y1="${currY}" x2="150" y2="${currY}" stroke="#56A3A6" stroke-width="0.3" stroke-dasharray="2,2" class="opacity-40 drop-shadow-[0_0_2px_rgba(86,163,166,0.3)]" />`;
                            monthGroup.innerHTML += `<text x="-148" y="${currY - 2}" fill="#56A3A6" font-size="2.5" class="opacity-50 font-['Forum'] uppercase tracking-widest">${monthNameStr}</text>`;
                        }
                        prevHijriTag = hijriTag;
                    });
                }
            }
            
            // Dynamic Trajectory CSS Rules engine structurally isolating user behaviors
            let last7Days = daysArray.slice(-7);
            let activeDaysCount = last7Days.filter(d => d.seconds > 0).length;
            let lastDay = daysArray[daysArray.length - 1]; // TODAY
            let isDisconnected = activeDaysCount === 0; // Missed entire last 7 days natively!
            
            let badgeText = document.getElementById('siratBadgeText');
            let orbObj = document.getElementById('siratCleanSlateOrb');
            let explanationText = document.getElementById('siratExplanationText');

            let currentDeviation = deviations.length > 0 ? Math.abs(deviations[0]) : 0;
            let recoveryPerDay = 24 * 1.5;
            let daysToCenter = Math.ceil(currentDeviation / recoveryPerDay);
            const plural = n => n === 1 ? 'day' : 'days';

            let orbEl = document.getElementById('siratOrb');
            let topAxisLabel = document.getElementById('timelineAxisTop');
            let bottomAxisLabel = document.getElementById('timelineAxisBottom');

            if (isCleanSlate) {
                svgPath.style.opacity = '0';
                if (orbObj) { orbObj.classList.remove('hidden'); orbObj.classList.add('flex'); }
                if (orbEl) orbEl.classList.add('hidden');
                if (topAxisLabel) topAxisLabel.style.opacity = '0';
                if (bottomAxisLabel) bottomAxisLabel.style.opacity = '0';
                if (badgeText) {
                    badgeText.innerText = 'Begin reading to start your path';
                    badgeText.className = 'text-[#F3E4CE]/70 text-[11px] font-bold font-["Forum"] tracking-wider text-center mt-3 px-2 min-h-[1.4em] transition-colors duration-500';
                }
                if (explanationText) {
                    explanationText.className = 'text-white/30 text-[10px] leading-relaxed mt-1.5 font-["Nunito"] tracking-wide text-center px-2 w-full transition-colors duration-500';
                }
            } else {
                svgPath.style.opacity = '1';
                if (orbObj) { orbObj.classList.add('hidden'); orbObj.classList.remove('flex'); }

                if (isDisconnected) {
                    svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                    svgPath.setAttribute('stroke-opacity', '0.3');
                    svgPath.setAttribute('stroke-dasharray', '3,6');
                    if (badgeText) {
                        badgeText.innerText = daysToCenter > 0
                            ? `${daysToCenter} ${plural(daysToCenter)} of consistent reading will bring you back to the straight path`
                            : 'Begin reading again to return to the straight path';
                        badgeText.className = 'text-[#8FA8A8] text-[11px] font-bold font-["Forum"] tracking-wider text-center mt-3 px-2 min-h-[1.4em] transition-colors duration-500';
                    }
                    if (explanationText) explanationText.className = 'text-white/30 text-[10px] leading-relaxed mt-1.5 font-["Nunito"] tracking-wide text-center px-2 w-full transition-colors duration-500';
                } else if (lastDay.seconds > 0) {
                    svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                    svgPath.removeAttribute('stroke-opacity');
                    svgPath.removeAttribute('stroke-dasharray');
                    if (badgeText) {
                        badgeText.innerText = daysToCenter > 0
                            ? `${daysToCenter} more ${plural(daysToCenter)} of reading returns you to the straight path`
                            : 'You are on the straight path · Keep reading daily';
                        badgeText.className = 'text-[#8FB9AA] text-[11px] font-bold font-["Forum"] tracking-wider text-center mt-3 px-2 min-h-[1.4em] transition-colors duration-500';
                    }
                    if (explanationText) explanationText.className = 'text-white/30 text-[10px] leading-relaxed mt-1.5 font-["Nunito"] tracking-wide text-center px-2 w-full transition-colors duration-500';
                } else {
                    svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                    svgPath.setAttribute('stroke-opacity', '0.65');
                    svgPath.removeAttribute('stroke-dasharray');
                    if (badgeText) {
                        badgeText.innerText = daysToCenter > 0
                            ? `Read daily for ${daysToCenter} more ${plural(daysToCenter)} to return to the straight path`
                            : 'Read today to return to the straight path';
                        badgeText.className = 'text-[#D8C3A5] text-[11px] font-bold font-["Forum"] tracking-wider text-center mt-3 px-2 min-h-[1.4em] transition-colors duration-500';
                    }
                    if (explanationText) explanationText.className = 'text-white/30 text-[10px] leading-relaxed mt-1.5 font-["Nunito"] tracking-wide text-center px-2 w-full transition-colors duration-500';
                }

                // Position the HTML orb at today's point
                if (orbEl && activeDaysArray.length > 0) {
                    const PAD_TOP_V = 35, PAD_BOT_V = 340;
                    const orbY = PAD_BOT_V - ((activeDaysArray.length - 1) * ((PAD_BOT_V - PAD_TOP_V) / 27));
                    const orbX = deviations[0]; // SVG x in range [-130, 130]
                    // Map SVG x [-150,150] → CSS left [0%,100%]
                    const leftPct = ((orbX + 150) / 300 * 100).toFixed(1);
                    orbEl.style.left = `${leftPct}%`;
                    orbEl.style.top = `${orbY}px`;
                    orbEl.classList.remove('hidden');

                    // "Today" label tracks orb Y; sits on the opposite horizontal side to avoid overlap
                    if (topAxisLabel) {
                        topAxisLabel.style.top = `${Math.max(8, orbY - 8)}px`;
                        if (orbX >= 0) {
                            topAxisLabel.style.left = '8px';
                            topAxisLabel.style.removeProperty('right');
                        } else {
                            topAxisLabel.style.right = '8px';
                            topAxisLabel.style.removeProperty('left');
                        }
                        topAxisLabel.style.opacity = '1';
                    }
                }

                if (bottomAxisLabel) bottomAxisLabel.style.opacity = activeDaysArray.length < 28 ? '0' : '1';
            }

        } catch(e) {
            console.error("[Sirat Engine] Error Modeling Journey:", e);
        } finally {
            loader.classList.add('hidden');
        }
    } else {
        container.style.maxHeight = '0px';
        container.style.opacity = '0';
        container.style.marginTop = '0px';
        if (btn) btn.classList.remove('ring-2', 'ring-white/50');
    }
};

// Bind UI triggers safely directly on mount
document.addEventListener('DOMContentLoaded', () => {
    const pBtn = document.getElementById('myPathBtn');
    if (pBtn) pBtn.addEventListener('click', () => window.initSiratVisualizer(false));
    
    const cBtn = document.getElementById('closePathBtn');
    if (cBtn) cBtn.addEventListener('click', () => {
        let container = document.getElementById('siratContainer');
        if (container) {
            container.style.maxHeight = '0px';
            container.style.opacity = '0';
            container.style.marginTop = '0px';
        }
        if (pBtn) pBtn.classList.remove('ring-2', 'ring-white/50');
    });
});
