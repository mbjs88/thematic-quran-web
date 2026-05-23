// js/audio-player.js

let playQueue = [];
let queueIndex = 0;
let isAudioPlaying = false;
let isPlayingIntro = false;
let currentSectionScope = { surah: 0, start: 0, end: 0, totalVerses: 0 };

// DUAL AUDIO PLAYER SYSTEM (Gapless Playback)
const playerA = new Audio();
const playerB = new Audio();
let currentPlayer = playerA; // 'A' or 'B'
let nextPlayer = playerB;

playerA.preload = 'auto';
playerB.preload = 'auto';

// Attach Listeners to BOTH players
[playerA, playerB].forEach(p => {
    p.addEventListener('ended', onTrackEnded);
    p.addEventListener('timeupdate', onTimeUpdate);
    p.addEventListener('error', onPlaybackError);
    // Ensure wake lock is handled
    p.addEventListener('play', () => toggleWakeLock(true));
    p.addEventListener('pause', () => toggleWakeLock(false));
});

document.addEventListener('speed-changed', (e) => {
    const { type, speed } = e.detail;
    if (!playQueue[queueIndex]) return;
    const currentType = playQueue[queueIndex].type;
    let isArabicGroup = (currentType === 'arabic' || currentType === 'intro' || currentType === 'bismillah');

    // Apply speed to BOTH players to be safe
    if (type === 'arabic' && isArabicGroup) {
        playerA.playbackRate = parseFloat(speed);
        playerB.playbackRate = parseFloat(speed);
    } else if (type === 'translation' && currentType === 'translation') {
        playerA.playbackRate = parseFloat(speed);
        playerB.playbackRate = parseFloat(speed);
    }
});

function playSession(surah, start, end, targetVerse = null, targetType = null, options = {}) {
    stopAllAudio();
    window.pendingSession = { surah, start, end };
    playQueue = [];
    currentSectionScope = { surah, start, end, totalVerses: (end - start + 1) };
    const skipIntro = !!options.skipIntro;

    const surahName = (typeof window.getSurahName === 'function') ? window.getSurahName(surah) : `Surah ${surah}`;

    if (!skipIntro && start === 1 && targetVerse === null) {
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

    // TARGET JUMP LOGIC
    if (targetVerse !== null && targetType !== null) {
        const foundIndex = playQueue.findIndex(item => item.verse === targetVerse && item.type === targetType);
        if (foundIndex !== -1) {
            queueIndex = foundIndex;
            const typeLabel = targetType === 'arabic' ? 'Arabic' : 'Translation';
            document.getElementById('playerVerse').textContent = `${surahName} : Verse ${targetVerse} (${typeLabel})`;
        } else {
            queueIndex = 0;
            document.getElementById('playerVerse').textContent = `${surahName} : Verses ${start}-${end}`;
        }
    } else {
        queueIndex = 0;
        document.getElementById('playerVerse').textContent = `${surahName} : Verses ${start}-${end}`;
    }

    updateControlsUI(true);

    // START PLAYBACK CYCLE
    // 1. Set current player src
    // 2. Play current
    // 3. Preload next
    // 3. Preload next
    loadTrackIntoPlayer(currentPlayer, queueIndex);
    enforceCurrentSpeed(currentPlayer);
    currentPlayer.play().then(() => {
        isAudioPlaying = true;
        updateControlsUI(true);
        // Preload next track immediately
        preloadNextTrack();
        // Fire UI event for the *current* track
        emitVerseChanged(queueIndex);
    }).catch(err => {
        console.error("Playback failed", err);
        // Try next if fail
        onTrackEnded();
    });
}

function stopAllAudio() {
    playerA.pause();
    playerB.pause();
    playerA.currentTime = 0;
    playerB.currentTime = 0;
    // Unset src to stop downloading
    playerA.removeAttribute('src');
    playerB.removeAttribute('src');

    isAudioPlaying = false;
    isPlayingIntro = false;
    playQueue = [];
    queueIndex = 0;
    updateControlsUI(false);
}

function getTranslationUrl(surah, verse, langValue) {
    const sPad = String(surah).padStart(3, '0');
    const aPad = String(verse).padStart(3, '0');
    if (langValue === 'mp3quran-french') return `https://mirrors.mp3quran.net/h_du/leclerc_fr/${sPad}${aPad}.mp3`;
    else if (langValue.startsWith('external-')) { const slug = langValue.replace('external-', ''); return `https://everyayah.com/data/${slug}/${sPad}${aPad}.mp3`; }
    else if (langValue === 'ur') return `https://audio.thematicquran.com/urdu/${sPad}${aPad}.mp3`;
    else return `https://audio.thematicquran.com/english/${sPad}${aPad}.mp3`;
}

function loadTrackIntoPlayer(player, index) {
    if (index >= playQueue.length) return false;
    const item = playQueue[index];
    player.src = item.url;

    // Set Speed
    let speed = 1.0;
    if (item.type === 'translation') {
        speed = parseFloat(localStorage.getItem('translationSpeed') || "1.0");
    } else {
        speed = parseFloat(localStorage.getItem('arabicSpeed') || "1.0");
    }
    player.playbackRate = speed;
    return true;
}

function preloadNextTrack() {
    const nextIndex = queueIndex + 1;
    if (nextIndex < playQueue.length) {
        loadTrackIntoPlayer(nextPlayer, nextIndex);
        nextPlayer.load(); // Start buffering
    }
}

function onTrackEnded() {
    // Current track finished.
    // 1. Swap players
    const temp = currentPlayer;
    currentPlayer = nextPlayer;
    nextPlayer = temp;

    // 2. Increment index
    queueIndex++;

    if (queueIndex >= playQueue.length) {
        stopAllAudio();
        document.dispatchEvent(new CustomEvent('section-ended'));
        return;
    }

    // 3. Play the (hopefully preloaded) 'currentPlayer'
    // Ensure we trigger the UI update *before* or *immediately* as playing starts
    emitVerseChanged(queueIndex);

    enforceCurrentSpeed(currentPlayer);
    currentPlayer.play().then(() => {
        isAudioPlaying = true;
        updateControlsUI(true);
        // 4. Preload NEXT NEXT track into 'nextPlayer'
        preloadNextTrack();
    }).catch(err => {
        console.warn("Gapless playback failed or track error, skipping...", err);
        onTrackEnded(); // Recursively skip
    });
}

function onTimeUpdate(e) {
    // Only update UI if event comes from ACTIVE player
    if (e.target !== currentPlayer) return;

    if (currentPlayer.duration) {
        const progressPercent = (currentPlayer.currentTime / currentPlayer.duration) * 100;
        document.getElementById('progressBar').style.width = `${progressPercent}%`;
        const curMins = Math.floor(currentPlayer.currentTime / 60);
        const curSecs = Math.floor(currentPlayer.currentTime % 60).toString().padStart(2, '0');
        document.getElementById('currentTime').textContent = `${curMins}:${curSecs}`;
    }
}

function onPlaybackError(e) {
    if (e.target !== currentPlayer) return;
    console.warn("Playback error", e);
    // Try to skip
    onTrackEnded();
}

function emitVerseChanged(index) {
    if (index >= playQueue.length) return;
    const trackItem = playQueue[index];
    console.log(`Playing [${index}]: ${trackItem.type}`);

    if (trackItem.type === 'arabic' || trackItem.type === 'translation') {
        const event = new CustomEvent('verse-changed', {
            detail: { surah: currentSectionScope.surah, verse: trackItem.verse, type: trackItem.type }
        });
        document.dispatchEvent(event);
    }
}

function playRange(surah, start, end, targetVerse = null, targetType = null) {
    playSession(surah, start, end, targetVerse, targetType);
}

function playerTogglePlayPause() {
    if (isAudioPlaying) {
        currentPlayer.pause();
        isAudioPlaying = false;
        updateControlsUI(false);
    } else {
        if (playQueue.length > 0 && currentPlayer.src) {
            enforceCurrentSpeed(currentPlayer);
            currentPlayer.play().then(() => {
                isAudioPlaying = true;
                updateControlsUI(true);
            });
        } else {
            // Maybe start from beginning if nothing loaded?
            // For now, do nothing or user has to click specific ayah
        }
    }
}

function updateControlsUI(isPlaying) {
    const btn = document.getElementById('globalPlayPauseBtn');
    const icon = btn.querySelector('span');
    const status = document.getElementById('playerStatus');
    if (isPlaying) {
        icon.textContent = 'pause';
        status.textContent = 'Playing';
        btn.classList.remove('animate-glow');
    } else {
        icon.textContent = 'play_arrow';
        status.textContent = 'Paused';
        btn.classList.add('animate-glow');
    }
}

function enforceCurrentSpeed(player) {
    if (queueIndex >= playQueue.length) return;

    // Check if item exists
    if (!playQueue[queueIndex]) return;
    const trackItem = playQueue[queueIndex];

    let speed = 1.0;
    if (trackItem.type === 'translation') {
        speed = parseFloat(localStorage.getItem('translationSpeed') || "1.0");
    } else {
        speed = parseFloat(localStorage.getItem('arabicSpeed') || "1.0");
    }

    // Only set if different to avoid potential stutter
    if (Math.abs(player.playbackRate - speed) > 0.01) {
        player.playbackRate = speed;
        console.log(`[Audio] Enforcing speed: ${speed}x for ${trackItem.type}`);
    }
}

window.isPlayerActive = function () {
    // The player is considered "active" (capable of pausing or resuming)
    // if there is a queue loaded in memory.
    return playQueue && playQueue.length > 0;
};
