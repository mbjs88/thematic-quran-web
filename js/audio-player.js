// js/audio-player.js

let playQueue = [];
let queueIndex = 0;
let isAudioPlaying = false;
const audioObj = document.getElementById('audioElement');
let preloadCache = []; 

// State to track if we are currently playing the Intro (Bismillah)
let isPlayingBismillah = false;

// Tracking current section details
let currentSectionScope = { surah: 0, start: 0, end: 0, totalVerses: 0 };

/**
 * 1. THE MASTER PLAY FUNCTION
 */
function playSession(surah, start, end) {
    // Reset everything
    stopAllAudio();

    // Decide: Play Bismillah first?
    // Rule: Verse 1 of any Surah (except Surah 9) gets Bismillah
    if (start === 1 && surah !== 9) {
        isPlayingBismillah = true;
        
        // Use the MAIN audio object for Bismillah (Crucial for Mobile)
        audioObj.src = 'data/audio/bismillah.mp3';
        
        // Update UI
        document.getElementById('playerVerse').textContent = `Surah ${surah}: Starting...`;
        updateControlsUI(true);

        // Play it
        audioObj.play().then(() => {
            isAudioPlaying = true;
        }).catch(err => {
            console.warn("Bismillah Autoplay blocked, skipping...", err);
            startMainSection(surah, start, end);
        });

    } else {
        // No Bismillah needed, jump straight to verses
        startMainSection(surah, start, end);
    }
}

/**
 * Helper: Generates the Queue and starts the first verse
 */
function startMainSection(surah, start, end) {
    isPlayingBismillah = false;
    playRange(surah, start, end);
}

/**
 * 2. TOGGLE PLAY/PAUSE
 */
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

/**
 * Helper: Stops everything and resets state.
 */
function stopAllAudio() {
    audioObj.pause();
    audioObj.currentTime = 0;
    isAudioPlaying = false;
    isPlayingBismillah = false;
    playQueue = [];
    queueIndex = 0;
}

// --- QUEUE GENERATION ---

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
        playQueue.push({
            url: getTranslationUrl(surah, i, transValue),
            verse: i,
            type: 'translation'
        });
    }

    document.getElementById('playerVerse').textContent = `Surah ${surah} : Verses ${start}-${end}`;
    
    startPreloading();

    // Index Logic
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
    const limit = Math.min(playQueue.length, 5); // Reduced for mobile data safety
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

    // Highlight Verse UI
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

// --- EVENTS ---

// The "Ended" event is the engine that drives the playlist
audioObj.addEventListener('ended', () => {
    // If we just finished Bismillah, start the main section
    if (isPlayingBismillah) {
        const surah = currentSectionScope.surah || parseInt(document.getElementById('surahSelect').value); // Fallback
        // We need the original start/end args here. 
        // Ideally we stored them, but for now we can infer or we need to pass them.
        // A cleaner way: playSession stores these in a global variable? 
        // ACTUALLY: playSession calls startMainSection() directly.
        // But since we are inside an EVENT, we need to call startMainSection from here.
        
        // Wait! currentSectionScope isn't fully populated during Bismillah phase in previous logic.
        // Let's fix that.
        
        // FIX: The easiest mobile way is to pre-calculate the queue even during Bismillah, 
        // but just NOT play it yet.
        // But to keep it simple: We simply call startMainSection using the params from the closure? 
        // No, 'ended' is global.
        
        // BETTER FIX: When playSession is called, we save the "Next Move" in a variable.
        if (window.pendingSession) {
            startMainSection(window.pendingSession.surah, window.pendingSession.start, window.pendingSession.end);
            window.pendingSession = null; // Clear it
        }
        return;
    }

    // Normal Verse Ended
    queueIndex++;
    playNextTrack();
});

// Update playSession to save the pending session
const originalPlaySession = playSession;
playSession = function(surah, start, end) {
    stopAllAudio();
    
    // Save these for the "onended" event to use later
    window.pendingSession = { surah, start, end };

    if (start === 1 && surah !== 9) {
        isPlayingBismillah = true;
        audioObj.src = 'data/audio/bismillah.mp3';
        document.getElementById('playerVerse').textContent = `Surah ${surah}: Starting...`;
        updateControlsUI(true);
        audioObj.play().catch(e => {
            console.warn("Bismillah failed", e);
            startMainSection(surah, start, end);
        });
    } else {
        startMainSection(surah, start, end);
    }
};

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

// Helper for App.js
window.isPlayerActive = function() {
    return (audioObj.src && !audioObj.ended && audioObj.currentTime > 0) || isAudioPlaying || isPlayingBismillah;
};