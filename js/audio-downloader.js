// js/audio-downloader.js

const AudioContext = window.AudioContext || window.webkitAudioContext;

function getDownloadTransUrl(surah, verse, langValue) {
    const sPad = String(surah).padStart(3, '0');
    const aPad = String(verse).padStart(3, '0');

    // --- FIX FOR DOWNLOADER ---
    if (langValue === 'mp3quran-french') {
         return `https://mirrors.mp3quran.net/h_du/leclerc_fr/${sPad}${aPad}.mp3`;
    }
    // --------------------------

    else if (langValue.startsWith('external-')) {
        const slug = langValue.replace('external-', '');
        return `https://everyayah.com/data/${slug}/${sPad}${aPad}.mp3`;
    } else if (langValue === 'ur') {
        return `data/audio/urdu/${sPad}${aPad}.mp3`;
    } else {
        return `data/audio/english/${sPad}${aPad}.mp3`;
    }
}

// ... (Rest of the file remains exactly the same as the previous Block Mode version)
async function downloadGroupedSection(surah, start, end, reciterSlug, langCode, surahName) {
    await downloadBulkStitched([{surah, start, end}], reciterSlug, langCode, surahName);
}

async function downloadBulkStitched(sectionsArray, reciterSlug, langCode, surahName) {
    console.log(`Starting Download for ${surahName}...`);
    
    const ctx = new AudioContext();
    const urls = [];

    sectionsArray.forEach(sec => {
        // 1. Arabic Block
        for (let i = sec.start; i <= sec.end; i++) {
            const sPad = String(sec.surah).padStart(3, '0');
            const aPad = String(i).padStart(3, '0');
            urls.push(`https://everyayah.com/data/${reciterSlug}/${sPad}${aPad}.mp3`);
        }
        
        // 2. Translation Block
        for (let i = sec.start; i <= sec.end; i++) {
            urls.push(getDownloadTransUrl(sec.surah, i, langCode));
        }
    });

    updateDownloadProgress(5, `Queueing ${urls.length} files...`);

    const audioBuffers = [];
    for (let i = 0; i < urls.length; i++) {
        try {
            const response = await fetch(urls[i]);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            audioBuffers.push(audioBuffer);
            
            const percent = 5 + Math.round(((i + 1) / urls.length) * 55);
            updateDownloadProgress(percent, `Fetching ${i+1}/${urls.length}`);
        } catch (e) {
            console.warn("Skipping failed track:", urls[i]);
        }
    }

    if (audioBuffers.length === 0) {
        alert("No audio found.");
        closeDownloadModal();
        return;
    }

    updateDownloadProgress(70, "Stitching audio...");
    const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const outputBuffer = ctx.createBuffer(audioBuffers[0].numberOfChannels, totalLength, audioBuffers[0].sampleRate);

    let offset = 0;
    for (const buf of audioBuffers) {
        for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
            const inputData = buf.getChannelData(channel < buf.numberOfChannels ? channel : 0);
            outputBuffer.getChannelData(channel).set(inputData, offset);
        }
        offset += buf.length;
    }

    updateDownloadProgress(90, "Encoding...");
    const wavBlob = bufferToWave(outputBuffer, totalLength);
    const url = URL.createObjectURL(wavBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const sorted = sectionsArray.sort((a,b) => a.start - b.start);
    const globalStart = sorted[0].start;
    const globalEnd = sorted[sorted.length - 1].end;

    link.download = `${surahName}, ${globalStart}-${globalEnd} - Thematic Quran.wav`;
    
    link.click();
    updateDownloadProgress(100, "Done!");
    setTimeout(closeDownloadModal, 1500);
}

function updateDownloadProgress(percent, text) {
    const bar = document.getElementById('dlProgressBar');
    const txt = document.getElementById('dlStatusText');
    const per = document.getElementById('dlPercentText');
    if (bar) bar.style.width = `${percent}%`;
    if (txt) txt.textContent = text;
    if (per) per.textContent = `${percent}%`;
}

function closeDownloadModal() {
    document.getElementById('downloadModal').classList.add('hidden');
}

function bufferToWave(abuffer, len) {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); 
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4); 
    for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
    while (pos < len) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
            view.setInt16(44 + offset, sample, true);
            offset += 2;
        }
        pos++;
    }
    return new Blob([buffer], { type: "audio/wav" });
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
}