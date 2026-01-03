// js/audio-player.js

let playQueue = [];
let queueIndex = 0;
let isAudioPlaying = false;
const audioObj = document.getElementById('audioElement');
let preloadCache = []; 
let isPlayingIntro = false;
let currentSectionScope = { surah: 0, start: 0, end: 0, totalVerses: 0 };

document.addEventListener('speed-changed', (e) => {
    const { type, speed } = e.detail;
    if (!playQueue[queueIndex]) return;
    const currentType = playQueue[queueIndex].type;
    let isArabicGroup = (currentType === 'arabic' || currentType === 'intro' || currentType === 'bismillah');
    if (type === 'arabic' && isArabicGroup) audioObj.playbackRate = parseFloat(speed);
    else if (type === 'translation' && currentType === 'translation') audioObj.playbackRate = parseFloat(speed);
});

function playSession(surah, start, end, targetVerse = null, targetType = null) {
    stopAllAudio();
    window.pendingSession = { surah, start, end };
    playQueue = [];
    currentSectionScope = { surah, start, end, totalVerses: (end - start + 1) };

    // Get Name
    const surahName = (typeof window.getSurahName === 'function') ? window.getSurahName(surah) : `Surah ${surah}`;

    if (start === 1 && targetVerse === null) {
        const sPad = String(surah).padStart(3, '0');
        playQueue.push({ url: `https://audio.thematicquran.com/intro/${sPad}.mp3`, verse: 0, type: 'intro' });
    }

    if (start === 1 && surah !== 9 && surah !== 1 && targetVerse === null) {
        playQueue.push({ url: 'https://audio.thematicquran.com/bismillah.mp3', verse: 0, type: 'bismillah' });
    }

    const arabicReciter = document.getElementById('reciterSelect').value;
    const transValue = document.getElementById('languageSelect').value; 
    const arabicBaseURL = `https://everyayah.com/data/${arabicReciter}/`;

    for (let i = start; i <= end; i++) {
        const sPad = String(surah).padStart(3, '0');
        const aPad = String(i).padStart(3, '0');
        playQueue.push({ url: arabicBaseURL + `${sPad}${aPad}.mp3`, verse: i, type: 'arabic' });
    }

    for (let i = start; i <= end; i++) {
        const transUrl = getTranslationUrl(surah, i, transValue);
        playQueue.push({ url: transUrl, verse: i, type: 'translation' });
    }

    if (targetVerse !== null && targetType !== null) {
        const foundIndex = playQueue.findIndex(item => item.verse === targetVerse && item.type === targetType);
        if (foundIndex !== -1) {
            queueIndex = foundIndex;
            const typeLabel = targetType === 'arabic' ? 'Arabic' : 'Translation';
            // UPDATED LABEL
            document.getElementById('playerVerse').textContent = `${surahName} : Verse ${targetVerse} (${typeLabel})`;
        } else {
            queueIndex = 0;
            // UPDATED LABEL
            document.getElementById('playerVerse').textContent = `${surahName} : Verses ${start}-${end}`;
        }
        isPlayingIntro = false; 
    } else {
        queueIndex = 0;
        // UPDATED LABEL
        document.getElementById('playerVerse').textContent = `${surahName} : Verses ${start}-${end}`;
        isPlayingIntro = (start === 1); 
    }

    updateControlsUI(true);
    startPreloading();
    playNextTrack();
}

function stopAllAudio() {
    audioObj.pause();
    audioObj.currentTime = 0;
    isAudioPlaying = false;
    isPlayingIntro = false;
    playQueue = [];
    queueIndex = 0;
}

function getTranslationUrl(surah, verse, langValue) {
    const sPad = String(surah).padStart(3, '0');
    const aPad = String(verse).padStart(3, '0');
    if (langValue === 'mp3quran-french') return `https://mirrors.mp3quran.net/h_du/leclerc_fr/${sPad}${aPad}.mp3`;
    else if (langValue.startsWith('external-')) { const slug = langValue.replace('external-', ''); return `https://everyayah.com/data/${slug}/${sPad}${aPad}.mp3`; }
    else if (langValue === 'ur') return `https://audio.thematicquran.com/urdu/${sPad}${aPad}.mp3`;
    else return `https://audio.thematicquran.com/english/${sPad}${aPad}.mp3`;
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

    if (trackItem.type === 'arabic' || trackItem.type === 'translation') {
        const event = new CustomEvent('verse-changed', { 
            detail: { surah: currentSectionScope.surah, verse: trackItem.verse, type: trackItem.type } 
        });
        document.dispatchEvent(event);
    }

    console.log(`Playing [${queueIndex}]: ${trackItem.type} -> ${trackItem.url}`);

    audioObj.src = trackItem.url;
    
    let speed = 1.0;
    if (trackItem.type === 'translation') {
        speed = parseFloat(localStorage.getItem('translationSpeed') || "1.0");
    } else {
        speed = parseFloat(localStorage.getItem('arabicSpeed') || "1.0");
    }
    audioObj.playbackRate = speed;

    audioObj.play().then(() => {
        isAudioPlaying = true;
        updateControlsUI(true);
    }).catch(err => {
        console.warn(`Playback failed for ${trackItem.url}. Skipping...`, err);
        queueIndex++;
        playNextTrack();
    });
}

function playRange(surah, start, end, targetVerse = null, targetType = null) {
    playSession(surah, start, end, targetVerse, targetType);
}

audioObj.addEventListener('ended', () => { queueIndex++; playNextTrack(); });
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
            audioObj.play().then(() => { isAudioPlaying = true; updateControlsUI(true); });
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
    if (isPlaying) { icon.textContent = 'pause'; status.textContent = 'Playing'; } 
    else { icon.textContent = 'play_arrow'; status.textContent = 'Paused'; }
}

window.isPlayerActive = function() { return (audioObj.src && !audioObj.ended && audioObj.currentTime > 0) || isAudioPlaying; };