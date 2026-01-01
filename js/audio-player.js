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
 * Called by the Section Play Buttons.
 * Restores "Grouped" playback: All Arabic first, then all Translation.
 */
function playSession(surah, start, end) {
    // 1. Reset everything
    stopAllAudio();

    // 2. Save session globally
    window.pendingSession = { surah, start, end };

    // 3. Initialize Queue
    playQueue = [];
    currentSectionScope = { surah, start, end, totalVerses: (end - start + 1) };

    // --- A. ADD SURAH INTRO (Name Announcement) ---
    // If we are at the start of a Surah, play the intro file (e.g. intro/001.mp3)
    if (start === 1) {
        const sPad = String(surah).padStart(3, '0');
        playQueue.push({
            url: `https://audio.thematicquran.com/intro/${sPad}.mp3`,
            verse: 0,
            type: 'intro'
        });
    }

    // --- B. ADD BISMILLAH ---
    // Logic: Play Bismillah if start is 1, EXCEPT for Surah 9 (Tawbah) and Surah 1 (Fatihah)
    if (start === 1 && surah !== 9 && surah !== 1) {
        playQueue.push({
            url: 'https://audio.thematicquran.com/bismillah.mp3',
            verse: 0,
            type: 'bismillah'
        });
    }

    // --- C. ADD VERSES (Thematic Grouping Fix) ---
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

    // 4. Start Playback
    document.getElementById('playerVerse').textContent = `Surah ${surah} : Verses ${start}-${end}`;
    updateControlsUI(true);
    
    isPlayingIntro = (start === 1); 
    
    queueIndex = 0;
    startPreloading();
    playNextTrack();
}

/**
 * 2. SINGLE ITEM PLAYER
 * Called when clicking a specific verse text
 */
function playSingleItem(surah, verse, type) {
    stopAllAudio();

    // Set scope so highlighting works
    currentSectionScope = { surah: surah, start: verse, end: verse, totalVerses: 1 };
    
    const arabicReciter = document.getElementById('reciterSelect').value;
    const transValue = document.getElementById('languageSelect').value; 
    const arabicBaseURL = `https://everyayah.com/data/${arabicReciter}/`;

    let url = "";
    if (type === 'arabic') {
        const sPad = String(surah).padStart(3, '0');
        const aPad = String(verse).padStart(3, '0');
        url = arabicBaseURL + `${sPad}${aPad}.mp3`;
        document.getElementById('playerVerse').textContent = `Surah ${surah} : Verse ${verse} (Arabic)`;
    } else {
        url = getTranslationUrl(surah, verse, transValue);
        document.getElementById('playerVerse').textContent = `Surah ${surah} : Verse ${verse} (Translation)`;
    }

    // Queue of 1 item
    playQueue = [{
        url: url,
        verse: verse,
        type: type
    }];

    queueIndex = 0;
    updateControlsUI(true);
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

function playRange(surah, start, end) {
    // Wrapper to maintain compatibility if called externally
    playSession(surah, start, end);
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