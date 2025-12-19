// js/audio-player.js

let playQueue = [];
let queueIndex = 0;
let isAudioPlaying = false;
const audioObj = document.getElementById('audioElement');
let preloadCache = []; 

// Tracking current section details
let currentSectionScope = { surah: 0, start: 0, end: 0, totalVerses: 0 };

/**
 * Helper: Determines the URL for the translation audio
 */
function getTranslationUrl(surah, verse, langValue) {
    const sPad = String(surah).padStart(3, '0');
    const aPad = String(verse).padStart(3, '0');

    // 1. French Fix (MP3Quran Mirror)
    if (langValue === 'mp3quran-french') {
        return `https://mirrors.mp3quran.net/h_du/leclerc_fr/${sPad}${aPad}.mp3`;
    } 
    
    // 2. Beta/External Languages (EveryAyah)
    else if (langValue.startsWith('external-')) {
        const slug = langValue.replace('external-', '');
        return `https://everyayah.com/data/${slug}/${sPad}${aPad}.mp3`;
    } 
    
    // 3. Urdu (Your R2 Storage)
    else if (langValue === 'ur') {
        return `https://audio.thematicquran.com/urdu/${sPad}${aPad}.mp3`;
    } 
    
    // 4. English (Your R2 Storage)
    else {
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
    
    // --- BLOCK MODE (All Arabic -> All Translation) ---

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
            // Jump to the start of the translation block + offset
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
        isAudioPlaying = false;
        updateControlsUI();
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
        updateControlsUI();
    }).catch(err => {
        console.warn(`Playback failed for ${trackItem.url}. Skipping...`, err);
        queueIndex++;
        playNextTrack();
    });
}

function playerTogglePlayPause() {
    if (audioObj.paused && audioObj.src && playQueue.length > 0) {
        audioObj.play().then(() => {
             isAudioPlaying = true;
             updateControlsUI();
        });
    } else if (!audioObj.paused) {
        audioObj.pause();
        isAudioPlaying = false;
        updateControlsUI();
    }
}

function preloadNextSection(surah, start, end) {
    const arabicReciter = document.getElementById('reciterSelect').value;
    const arabicBaseURL = `https://everyayah.com/data/${arabicReciter}/`;

    // Preload start of next section (Arabic)
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

function updateControlsUI() {
    const icon = document.querySelector('#globalPlayPauseBtn span');
    const status = document.getElementById('playerStatus');
    const actuallyPlaying = !audioObj.paused; 

    if (actuallyPlaying) {
        icon.textContent = 'pause';
        status.textContent = 'Playing';
    } else {
        icon.textContent = 'play_arrow';
        status.textContent = 'Paused';
    }
}