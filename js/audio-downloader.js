// js/audio-downloader.js

const SAFE_VERSE_LIMIT = 50;

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

        const filesToFetch = [];
        for (let i = start; i <= end; i++) {
            filesToFetch.push({ type: 'arabic', surah, verse: i, reciter: reciterSlug });
            filesToFetch.push({ type: 'translation', surah, verse: i, lang: langCode });
        }

        const totalFiles = filesToFetch.length;
        const audioBuffers = [];
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        for (let i = 0; i < totalFiles; i++) {
            const file = filesToFetch[i];
            const url = getAudioUrl(file.type, file.surah, file.verse, file.reciter, file.lang);
            
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Missing audio: ${url}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                audioBuffers.push(audioBuffer);

                const percent = Math.round(((i + 1) / totalFiles) * 80); 
                progressEl.style.width = `${percent}%`;
                percentEl.textContent = `${percent}%`;
                statusEl.textContent = `Processing verse ${file.verse}...`;

            } catch (err) {
                console.warn(`Skipping missing file: ${url}`);
            }
        }

        if (audioBuffers.length === 0) throw new Error("No audio data found.");

        statusEl.textContent = "Stitching audio...";
        progressEl.style.width = '90%';
        percentEl.textContent = '90%';

        const finalBuffer = stitchBuffers(audioContext, audioBuffers);
        
        statusEl.textContent = "Encoding WAV...";
        const wavBlob = bufferToWave(finalBuffer, finalBuffer.length);
        
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
                audioBuffers.push(audioBuffer);

                const percent = Math.round(((i + 1) / totalFiles) * 80); 
                progressEl.style.width = `${percent}%`;
                percentEl.textContent = `${percent}%`;
                statusEl.textContent = `Fetching ${i+1}/${totalFiles}...`;

            } catch (err) {
                console.warn("Skipping file", url);
            }
        }

        statusEl.textContent = "Stitching & Encoding...";
        const finalBuffer = stitchBuffers(audioContext, audioBuffers);
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
        return `https://audio.thematicquran.com/${lang}/${padSurah}${padVerse}.mp3`;
    }
}

function stitchBuffers(context, buffers) {
    const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
    const output = context.createBuffer(
        buffers[0].numberOfChannels,
        totalLength,
        buffers[0].sampleRate
    );

    let offset = 0;
    buffers.forEach(buffer => {
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            output.getChannelData(channel).set(buffer.getChannelData(channel), offset);
        }
        offset += buffer.length;
    });

    return output;
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

    if(progressEl) progressEl.style.width = '0';
    if(progressEl) progressEl.style.backgroundColor = '#56A3A6';
    if(statusEl) statusEl.textContent = 'Initializing...';
    if(percentEl) percentEl.textContent = '0%';
    if(confirmBtn) confirmBtn.style.display = 'block'; 
    if(container) container.classList.add('hidden'); 
}