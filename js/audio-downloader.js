// js/audio-downloader.js

const SAFE_VERSE_LIMIT = 50;

async function createStitchedAudioBlob(surah, start, end, reciterSlug, langCode, onProgress) {
    const filesToFetch = [];
    for (let i = start; i <= end; i++) {
        filesToFetch.push({ type: 'arabic', surah, verse: i, reciter: reciterSlug });
    }
    for (let i = start; i <= end; i++) {
        filesToFetch.push({ type: 'translation', surah, verse: i, lang: langCode });
    }

    const totalFiles = filesToFetch.length;
    const audioBuffers = [];
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let skippedTranslations = 0;

    for (let i = 0; i < totalFiles; i++) {
        const file = filesToFetch[i];
        const url = getAudioUrl(file.type, file.surah, file.verse, file.reciter, file.lang);

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Missing audio: ${url}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Store the decoded buffer and its origin type for panning
            audioBuffers.push({ buffer: audioBuffer, type: file.type });

            if (onProgress) {
                const percent = Math.round(((i + 1) / totalFiles) * 80);
                onProgress('fetching', percent, `Processing verse ${file.verse}...`);
            }

        } catch (err) {
            console.warn(`Skipping missing file: ${url}`, err);
            if (file.type === 'translation') skippedTranslations++;
        }
    }

    if (audioBuffers.length === 0) throw new Error("No audio data found.");

    // Surface (rather than silently swallow) dropped translation audio
    if (skippedTranslations > 0 && window.showToast) {
        window.showToast(`${skippedTranslations} translation audio file(s) could not be fetched and were skipped.`, 'warning');
    }

    if (onProgress) onProgress('stitching', 90, "Applying Stereo Pan & Stitching audio...");

    // We await stitchStereoBuffers because OfflineAudioContext.startRendering() is async
    const finalBuffer = await stitchStereoBuffers(audioBuffers);

    if (onProgress) onProgress('encoding', 95, "Encoding WAV...");
    const wavBlob = bufferToWave(finalBuffer, finalBuffer.length);

    return wavBlob;
}

async function downloadGroupedSection(surah, start, end, reciterSlug, langCode, surahName) {
    // 1. Safety Check
    const verseCount = end - start + 1;
    if (verseCount > SAFE_VERSE_LIMIT) {
        const confirmDownload = confirm(
            `⚠️ HIGH MEMORY WARNING ⚠️\n\n` +
            `You are attempting to generate a very large audio file (${verseCount} verses).\n` +
            `This process requires significant device memory and may freeze or crash your browser.\n\n` +
            `Are you sure you want to proceed?`
        );
        if (!confirmDownload) {
            resetDownloadModal();
            return;
        }
    }

    // 2. Start Process
    const statusEl = document.getElementById('dlStatusText');
    const progressEl = document.getElementById('dlProgressBar');
    const percentEl = document.getElementById('dlPercentText');
    const confirmBtn = document.getElementById('dlConfirmBtn');

    try {
        if (window.showToast) window.showToast('Processing Audio Download...', 'downloading');

        statusEl.textContent = "Fetching audio files...";
        progressEl.style.width = '5%';
        percentEl.textContent = '5%';

        const wavBlob = await createStitchedAudioBlob(surah, start, end, reciterSlug, langCode, (stage, percent, message) => {
            progressEl.style.width = `${percent}%`;
            percentEl.textContent = `${percent}%`;
            statusEl.textContent = message;
        });

        const blobUrl = URL.createObjectURL(wavBlob);
        const filename = `ThematicQuran_${surahName}_${start}-${end}.wav`;

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        statusEl.textContent = "Complete!";
        progressEl.style.width = '100%';
        percentEl.textContent = '100%';

        if (window.showToast) window.showToast('Download Complete!', 'check_circle');

        setTimeout(() => {
            closeDownloadModal();
            resetDownloadModal();
        }, 1500);

    } catch (error) {
        console.error("Download failed:", error);
        statusEl.textContent = "Error: " + error.message;
        progressEl.style.backgroundColor = "#EF4444";
    }
}

async function downloadBulkStitched(sections, reciterSlug, langCode, surahNameBase) {
    // 1. Safety Check (Sum of all verses)
    let totalVerses = 0;
    sections.forEach(s => {
        totalVerses += (s.end - s.start + 1);
    });

    if (totalVerses > SAFE_VERSE_LIMIT) {
        const confirmDownload = confirm(
            `⚠️ HIGH MEMORY WARNING ⚠️\n\n` +
            `You are attempting to generate a very large audio file (${totalVerses} verses total).\n` +
            `This process requires significant device memory and may freeze or crash your browser.\n\n` +
            `Are you sure you want to proceed?`
        );
        if (!confirmDownload) {
            resetDownloadModal();
            return;
        }
    }

    const statusEl = document.getElementById('dlStatusText');
    const progressEl = document.getElementById('dlProgressBar');
    const percentEl = document.getElementById('dlPercentText');

    try {
        if (window.showToast) window.showToast('Processing Bulk Download...', 'downloading');

        statusEl.textContent = "Calculating queue...";
        const filesToFetch = [];

        sections.forEach(section => {
            for (let i = section.start; i <= section.end; i++) {
                filesToFetch.push({ type: 'arabic', surah: section.surah, verse: i, reciter: reciterSlug });
            }
        });
        sections.forEach(section => {
            for (let i = section.start; i <= section.end; i++) {
                filesToFetch.push({ type: 'translation', surah: section.surah, verse: i, lang: langCode });
            }
        });

        const totalFiles = filesToFetch.length;
        const audioBuffers = [];
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        for (let i = 0; i < totalFiles; i++) {
            const file = filesToFetch[i];
            const url = getAudioUrl(file.type, file.surah, file.verse, file.reciter, file.lang);

            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                audioBuffers.push({ buffer: audioBuffer, type: file.type });

                const percent = Math.round(((i + 1) / totalFiles) * 80);
                progressEl.style.width = `${percent}%`;
                percentEl.textContent = `${percent}%`;
                statusEl.textContent = `Fetching ${i + 1}/${totalFiles}...`;

            } catch (err) {
                console.warn("Skipping file", url);
            }
        }

        statusEl.textContent = "Stitching & Encoding...";
        const finalBuffer = await stitchStereoBuffers(audioBuffers);
        const wavBlob = bufferToWave(finalBuffer, finalBuffer.length);

        const blobUrl = URL.createObjectURL(wavBlob);
        const filename = `ThematicQuran_Mix_${sections.length}Sections.wav`;

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        statusEl.textContent = "Complete!";
        progressEl.style.width = '100%';
        percentEl.textContent = '100%';

        if (window.showToast) window.showToast('Download Complete!', 'check_circle');

        setTimeout(() => {
            closeDownloadModal();
            resetDownloadModal();
        }, 1500);

    } catch (e) {
        statusEl.textContent = "Error: " + e.message;
        progressEl.style.backgroundColor = "#EF4444";
    }
}

// --- HELPER FUNCTIONS ---

function getAudioUrl(type, surah, verse, reciter, lang) {
    const padSurah = String(surah).padStart(3, '0');
    const padVerse = String(verse).padStart(3, '0');

    if (type === 'arabic') {
        return `https://everyayah.com/data/${reciter}/${padSurah}${padVerse}.mp3`;
    } else {
        const langString = lang === 'ur' ? 'urdu' : 'english';
        // Fetch directly: audio.thematicquran.com serves CORS headers (bismillah.mp3 is
        // already fetched directly elsewhere). The old cors.eu.org proxy is defunct and
        // was silently failing, causing translation audio to be dropped from exports.
        return `https://audio.thematicquran.com/${langString}/${padSurah}${padVerse}.mp3`;
    }
}

async function stitchStereoBuffers(audioBufferObjects) {
    // 1. Calculate the total continuous length across all buffers
    let totalLength = 0;
    // Assuming uniform sample rate across all downloads (usually 44100 or 48000)
    const sampleRate = audioBufferObjects[0].buffer.sampleRate;

    audioBufferObjects.forEach(item => {
        totalLength += item.buffer.length;
    });

    // 2. Initialize an OfflineAudioContext with 2 channels (Stereo)
    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
        2,
        totalLength,
        sampleRate
    );

    // 3. Schedule each buffer sequentially
    let currentTimeOffset = 0;

    audioBufferObjects.forEach(item => {
        // Create source
        const source = offlineCtx.createBufferSource();
        source.buffer = item.buffer;

        // Create Panner
        // Standard Web Audio API uses StereoPannerNode, fallback to createPanner if needed
        let panner;
        if (offlineCtx.createStereoPanner) {
            panner = offlineCtx.createStereoPanner();
            // Arabic panned 25% Right (+0.25), Translation panned 25% Left (-0.25)
            panner.pan.value = (item.type === 'arabic') ? 0.25 : -0.25;
        } else {
            // Legacy Safari Fallback
            panner = offlineCtx.createPanner();
            panner.panningModel = 'equalpower';
            const panValue = (item.type === 'arabic') ? 0.25 : -0.25;
            panner.setPosition(panValue, 0, 1 - Math.abs(panValue));
        }

        // Connect nodes visually: source -> panner -> destination
        source.connect(panner);
        panner.connect(offlineCtx.destination);

        // Schedule playback start time at the current running offset offset
        source.start(currentTimeOffset);

        // Advance the offset by the exact real-world duration of this buffer
        currentTimeOffset += item.buffer.duration;
    });

    // 4. Render the master mix down to a flat audioBuffer
    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer;
}

function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit 

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([buffer], { type: "audio/wav" });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

function resetDownloadModal() {
    const progressEl = document.getElementById('dlProgressBar');
    const statusEl = document.getElementById('dlStatusText');
    const percentEl = document.getElementById('dlPercentText');
    const confirmBtn = document.getElementById('dlConfirmBtn');
    const container = document.getElementById('dlProgressContainer');

    if (progressEl) progressEl.style.width = '0';
    if (progressEl) progressEl.style.backgroundColor = '#56A3A6';
    if (statusEl) statusEl.textContent = 'Initializing...';
    if (percentEl) percentEl.textContent = '0%';
    if (confirmBtn) confirmBtn.style.display = 'block';
    if (container) container.classList.add('hidden');
}