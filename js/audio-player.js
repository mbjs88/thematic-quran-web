// js/audio-player.js

let playQueue = [];
let queueIndex = 0;
let isAudioPlaying = false;
const audioObj = document.getElementById('audioElement');
let preloadCache = []; 

// Bismillah Handling
let currentBismillah = null;
let isBismillahPlaying = false;

// Tracking current section details
let currentSectionScope = { surah: 0, start: 0, end: 0, totalVerses: 0 };

/**
 * 1. THE MASTER PLAY FUNCTION
 * Called by the Section Play Buttons.
 * Decides if we need Bismillah, then starts the queue.
 */
function playSession(surah, start, end) {
    // Stop anything currently running (Bismillah or Verses)
    stopAllAudio();

    // Logic: Play Bismillah if it's Verse 1, but NOT for Surah 9 (Tawbah)
    if (start === 1 && surah !== 9) {
        playBismillahThenRange(surah, start, end);
    } else {
        playRange(surah, start, end);
    }
}

/**
 * 2. TOGGLE PLAY/PAUSE
 * Called by the Global Play Button.
 * Handles both Bismillah state and Main Verse state.
 */
function playerTogglePlayPause() {
    // SCENARIO A: Bismillah is active
    if (currentBismillah) {
        if (currentBismillah.paused) {
            currentBismillah.play();
            isBismillahPlaying = true;
            updateControlsUI(true);
        } else {
            currentBismillah.pause();
            isBismillahPlaying = false;
            updateControlsUI(false);
        }
        return;
    }

    // SCENARIO B: Main Verse Audio is active
    if (audioObj.src && playQueue.length > 0) {
        if (audioObj.paused) {
            audioObj.play().then(() => {
                isAudioPlaying = true;
                updateControlsUI(true);
            });
        } else {
            audioObj.pause();
            isAudioPlaying = false;
            updateControlsUI(false);
        }
        return;
    }
    
    // SCENARIO C: Nothing loaded? (Resume last known or start top)
    // This is handled in app.js fallbacks, but ideally we shouldn't get here without state.
}

/**
 * Helper: Stops everything and resets state.
 */
function stopAllAudio() {
    // Kill Bismillah
    if (currentBismillah) {
        currentBismillah.pause();
        currentBismillah = null;
        isBismillahPlaying = false;
    }

    // Kill Main Audio
    audioObj.pause();
    audioObj.currentTime = 0;
    isAudioPlaying = false;
    
    // Reset Queue
    playQueue = [];
    queueIndex = 0;
}

// --- INTERNAL HELPERS ---

function playBismillahThenRange(surah, start, end) {
    // Load Bismillah
    currentBismillah = new Audio('data/audio/bismillah.mp3');
    
    // Update UI immediately
    isBismillahPlaying = true;
    updateControlsUI(true);
    
    // Update Text to show "Bismillah..."
    document.getElementById('playerVerse').textContent = `Surah ${surah}: Starting...`;

    currentBismillah.onended = () => {
        currentBismillah = null;
        isBismillahPlaying = false;
        // Automatically start the verses
        playRange(surah, start, end);
    };

    currentBismillah.play().catch(e => {
        console.error("Bismillah failed", e);
        // If fail, just skip to verses
        playRange(surah, start, end);
    });
}

function getTranslationUrl(surah, verse, langValue) {
    const sPad = String(surah).padStart(3, '0');
    const aPad = String(verse).padStart(3, '0');

    if (langValue === 'mp3quran-french') {
        return `https://mirrors.mp3quran.net/h_du/leclerc_fr/${sPad}${aPad}.mp3`;
    } else if (langValue.startsWith('external-')) {
        const slug = langValue.replace('external-', '');
        return `https://everyayah.com/data/${slug}/${sPad}${aPad}.mp3`;
    } else if (langValue === 'ur') {
        return `https://audio.thematicquran.com/urdu/${sPad}${aPad}.mp3`;
    } else {
        return `https://audio.thematicquran.com/english/${sPad}${aPad}.mp3`;
    }
}

function playRange(surah, start, end, startVerse = null, startType = null) {
    const arabicReciter = document.getElementById('reciterSelect').value;
    const transValue = document.getElementById('languageSelect').value; 
    const arabicBaseURL = `https://everyayah.com/data/${arabicReciter}/`;

    playQueue = [];
    preloadCache = []; 
    currentSectionScope = { surah, start, end, totalVerses: (end - start + 1) };
    
    // 1. Add all Arabic Verses
    for (let i = start; i <= end; i++) {
        const sPad = String(surah).padStart(3, '0');
        const aPad = String(i).padStart(3, '0');
        playQueue.push({
            url: arabicBaseURL + `${sPad}${aPad}.mp3`,
            verse: i,
            type: 'arabic'
        });
    }

    // 2. Add all Translation Verses
    for (let i = start; i <= end; i++) {
        const url = getTranslationUrl(surah, i, transValue);
        playQueue.push({
            url: url,
            verse: i,
            type: 'translation'
        });
    }

    // Update UI Title
    document.getElementById('playerVerse').textContent = `Surah ${surah} : Verses ${start}-${end}`;
    
    startPreloading();

    // Start Index Logic
    if (startVerse) {
        const offset = startVerse - start;
        if (startType === 'arabic') {
            queueIndex = offset;
        } else {
            queueIndex = currentSectionScope.totalVerses + offset;
        }
    } else {
        queueIndex = 0;
    }

    playNextTrack();
}

function startPreloading() {
    const limit = Math.min(playQueue.length, 10);
    for(let i=0; i<limit; i++) {
        const audio = new Audio();
        audio.src = playQueue[i].url;
        audio.preload = 'auto';
        preloadCache.push(audio);
    }
}

function playNextTrack() {
    if (queueIndex >= playQueue.length) {
        stopAllAudio(); // Clean up
        updateControlsUI(false);
        document.dispatchEvent(new CustomEvent('section-ended'));
        return;
    }

    const trackItem = playQueue[queueIndex];

    const event = new CustomEvent('verse-changed', { 
        detail: { surah: currentSectionScope.surah, verse: trackItem.verse, type: trackItem.type } 
    });
    document.dispatchEvent(event);

    console.log(`Playing [${queueIndex}]: ${trackItem.url}`);

    audioObj.src = trackItem.url;
    audioObj.play().then(() => {
        isAudioPlaying = true;
        updateControlsUI(true);
    }).catch(err => {
        console.warn(`Playback failed for ${trackItem.url}. Skipping...`, err);
        queueIndex++;
        playNextTrack();
    });
}

// --- GLOBAL HELPERS FOR PRELOADING NEXT SECTION ---
function preloadNextSection(surah, start, end) {
    const arabicReciter = document.getElementById('reciterSelect').value;
    const arabicBaseURL = `https://everyayah.com/data/${arabicReciter}/`;

    for (let i = start; i <= Math.min(end, start+2); i++) {
        const sPad = String(surah).padStart(3, '0');
        const aPad = String(i).padStart(3, '0');
        new Audio(arabicBaseURL + `${sPad}${aPad}.mp3`).preload = 'auto';
    }
}

// Events
audioObj.addEventListener('ended', () => {
    queueIndex++;
    playNextTrack();
});

audioObj.addEventListener('timeupdate', () => {
    if(audioObj.duration) {
        const progressPercent = (audioObj.currentTime / audioObj.duration) * 100;
        document.getElementById('progressBar').style.width = `${progressPercent}%`;
        const curMins = Math.floor(audioObj.currentTime / 60);
        const curSecs = Math.floor(audioObj.currentTime % 60).toString().padStart(2, '0');
        document.getElementById('currentTime').textContent = `${curMins}:${curSecs}`;
    }
});

function updateControlsUI(isPlaying) {
    const icon = document.querySelector('#globalPlayPauseBtn span');
    const status = document.getElementById('playerStatus');

    if (isPlaying) {
        icon.textContent = 'pause';
        status.textContent = 'Playing';
    } else {
        icon.textContent = 'play_arrow';
        status.textContent = 'Paused';
    }
}