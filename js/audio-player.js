// js/audio-player.js

let playQueue = [];
let queueIndex = 0;
let isAudioPlaying = false;
const audioObj = document.getElementById('audioElement');
let preloadCache = []; 

// State to track if we are currently playing the Intro/Bismillah
let isPlayingIntro = false;

// Tracking current section details
let currentSectionScope = { surah: 0, start: 0, end: 0, totalVerses: 0 };

/**
 * 1. THE MASTER PLAY FUNCTION
 * Called by Section Play Buttons OR Verse Clicks.
 * Builds the full queue, then jumps to the specific verse if requested.
 */
function playSession(surah, start, end, targetVerse = null, targetType = null) {
    // 1. Reset everything
    stopAllAudio();

    // 2. Save session globally
    window.pendingSession = { surah, start, end };

    // 3. Initialize Queue
    playQueue = [];
    currentSectionScope = { surah, start, end, totalVerses: (end - start + 1) };

    // --- A. ADD SURAH INTRO (Name Announcement) ---
    // If we are at the start of a Surah, add intro (unless we are jumping to a specific mid-section verse)
    if (start === 1 && targetVerse === null) {
        const sPad = String(surah).padStart(3, '0');
        playQueue.push({
            url: `https://audio.thematicquran.com/intro/${sPad}.mp3`,
            verse: 0,
            type: 'intro'
        });
    }

    // --- B. ADD BISMILLAH ---
    // Logic: Play Bismillah if start is 1, EXCEPT for Surah 9 & 1. 
    // Skip if jumping to specific verse.
    if (start === 1 && surah !== 9 && surah !== 1 && targetVerse === null) {
        playQueue.push({
            url: 'https://audio.thematicquran.com/bismillah.mp3',
            verse: 0,
            type: 'bismillah'
        });
    }

    // --- C. ADD VERSES (Grouped: All Arabic -> All Translation) ---
    const arabicReciter = document.getElementById('reciterSelect').value;
    const transValue = document.getElementById('languageSelect').value; 
    const arabicBaseURL = `https://everyayah.com/data/${arabicReciter}/`;

    // LOOP 1: Add ALL Arabic Verses for this section
    for (let i = start; i <= end; i++) {
        const sPad = String(surah).padStart(3, '0');
        const aPad = String(i).padStart(3, '0');
        playQueue.push({
            url: arabicBaseURL + `${sPad}${aPad}.mp3`,
            verse: i,
            type: 'arabic'
        });
    }

    // LOOP 2: Add ALL Translation Verses for this section
    for (let i = start; i <= end; i++) {
        const transUrl = getTranslationUrl(surah, i, transValue);
        playQueue.push({
            url: transUrl,
            verse: i,
            type: 'translation'
        });
    }

    // 4. Determine Start Index
    if (targetVerse !== null && targetType !== null) {
        // Find the specific item requested
        const foundIndex = playQueue.findIndex(item => item.verse === targetVerse && item.type === targetType);
        if (foundIndex !== -1) {
            queueIndex = foundIndex;
            // Update Title to reflect jump
            const typeLabel = targetType === 'arabic' ? 'Arabic' : 'Translation';
            document.getElementById('playerVerse').textContent = `Surah ${surah} : Verse ${targetVerse} (${typeLabel})`;
        } else {
            queueIndex = 0; // Fallback
            document.getElementById('playerVerse').textContent = `Surah ${surah} : Verses ${start}-${end}`;
        }
        isPlayingIntro = false; 
    } else {
        // Start from beginning
        queueIndex = 0;
        document.getElementById('playerVerse').textContent = `Surah ${surah} : Verses ${start}-${end}`;
        isPlayingIntro = (start === 1); 
    }

    // 5. Start Playback
    updateControlsUI(true);
    startPreloading();
    playNextTrack();
}

/**
 * Helper: Stops everything and resets state.
 */
function stopAllAudio() {
    audioObj.pause();
    audioObj.currentTime = 0;
    isAudioPlaying = false;
    isPlayingIntro = false;
    playQueue = [];
    queueIndex = 0;
}

// --- QUEUE GENERATION HELPERS ---

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

function startPreloading() {
    const limit = Math.min(playQueue.length, 5);
    for(let i=0; i<limit; i++) {
        // Simple preload cache logic
        const audio = new Audio();
        audio.src = playQueue[i].url;
        audio.preload = 'auto';
        preloadCache.push(audio);
    }
}

function playNextTrack() {
    if (queueIndex >= playQueue.length) {
        stopAllAudio();
        updateControlsUI(false);
        document.dispatchEvent(new CustomEvent('section-ended'));
        return;
    }

    const trackItem = playQueue[queueIndex];

    // Only highlight UI if it's an actual verse (not intro/bismillah)
    if (trackItem.type === 'arabic' || trackItem.type === 'translation') {
        const event = new CustomEvent('verse-changed', { 
            detail: { surah: currentSectionScope.surah, verse: trackItem.verse, type: trackItem.type } 
        });
        document.dispatchEvent(event);
    }

    console.log(`Playing [${queueIndex}]: ${trackItem.type} -> ${trackItem.url}`);

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

// Updated wrapper to accept target args
function playRange(surah, start, end, targetVerse = null, targetType = null) {
    playSession(surah, start, end, targetVerse, targetType);
}

// --- EVENTS ---

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

function playerTogglePlayPause() {
    if (audioObj.src) {
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
    }
}

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

// Global Helper
window.isPlayerActive = function() {
    return (audioObj.src && !audioObj.ended && audioObj.currentTime > 0) || isAudioPlaying;
};