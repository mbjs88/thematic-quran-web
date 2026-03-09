// js/one-off-projects.js

window.generateCustomOneOffVideo = async function () {
    if (window.VideoExporter && window.VideoExporter.isExporting) {
        console.warn("Already exporting a video.");
        return;
    }

    console.log("Starting custom one-off video generation...");

    const targets = [
        { s: 17, a: 70 },
        { s: 49, a: 13 },
        { s: 2, a: 256 },
        { s: 60, a: 8 },
        { s: 22, a: 40 },
        { s: 21, a: 107 }
    ];

    const reciterSlug = 'Alafasy_128kbps';
    const langCode = 'en';
    const pace = 1.0;

    const VIEWPORT_WIDTH = 720;
    const VIEWPORT_HEIGHT = 1560; // iPhone 19.5:9 aspect ratio

    try {
        if (window.showToast) window.showToast('Preparing custom video...', 'movie');

        // 1. Create a styled container
        const exportContainer = document.createElement('div');
        exportContainer.id = 'custom-video-export-container';
        exportContainer.style.position = 'fixed';
        exportContainer.style.top = '-9999px';
        exportContainer.style.left = '0';
        exportContainer.style.width = `${VIEWPORT_WIDTH}px`;
        exportContainer.style.backgroundColor = '#12101C';
        exportContainer.style.backgroundImage = 'linear-gradient(to bottom, #12101C 0%, #221F2B 50%, #352B39 100%)';
        exportContainer.style.display = 'flex';
        exportContainer.style.flexDirection = 'column';
        exportContainer.style.alignItems = 'center';
        exportContainer.style.zIndex = '-9999';

        // 2. Build Intro Slate
        const introSlate = document.createElement('div');
        introSlate.style.width = '100%';
        introSlate.style.height = `${VIEWPORT_HEIGHT}px`;
        introSlate.style.display = 'flex';
        introSlate.style.flexDirection = 'column';
        introSlate.style.alignItems = 'center';
        introSlate.style.justifyContent = 'center';
        introSlate.style.padding = '0 60px';
        introSlate.innerHTML = `
            <h1 style="color: white; font-family: 'Forum', serif; font-size: 50px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 20px; text-align: center;">Selected Verses</h1>
            <h2 style="color: rgba(255,255,255,0.6); font-family: 'Nunito', sans-serif; font-size: 30px; margin-bottom: 70px; text-align: center;">Custom Compilation</h2>
            <p style="color: white; font-family: 'Amiri Quran', serif; font-size: 80px; margin-bottom: 120px; text-align: center; width: 100%;" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 30px; opacity: 0.8;">
                <img src="assets/icon-512-transparent.svg" alt="Thematic Quran Logo" style="width: 40px; height: 40px; object-fit: contain;">
                <span style="color: white; font-family: 'Forum', serif; font-size: 28px; letter-spacing: 0.1em; transform: translateY(-5px);">ThematicQuran.com</span>
            </div>
        `;
        exportContainer.appendChild(introSlate);

        // 3. Build Verses Container
        const versesContainer = document.createElement('div');
        versesContainer.style.width = '100%';
        versesContainer.style.minHeight = `${VIEWPORT_HEIGHT}px`;
        versesContainer.style.display = 'flex';
        versesContainer.style.flexDirection = 'column';
        versesContainer.style.padding = '0px 30px';

        const topSpacer = document.createElement('div');
        topSpacer.style.height = '60px';
        topSpacer.style.width = '100%';
        topSpacer.style.flexShrink = '0';
        versesContainer.appendChild(topSpacer);

        const headerContainer = document.createElement('div');
        headerContainer.style.width = '100%';
        headerContainer.style.display = 'flex';
        headerContainer.style.flexDirection = 'column';
        headerContainer.style.alignItems = 'flex-start';
        headerContainer.style.paddingBottom = '30px';
        headerContainer.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
        headerContainer.style.marginBottom = '60px';
        headerContainer.innerHTML = `
            <h1 style="color: white; font-family: 'Forum', serif; font-size: 40px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">Selected Verses</h1>
            <h2 style="color: rgba(255,255,255,0.6); font-family: 'Nunito', sans-serif; font-size: 26px; margin-bottom: 30px;">Custom Compilation</h2>
            <div style="display: flex; align-items: center; justify-content: flex-start; gap: 16px; opacity: 0.8;">
                <img src="assets/icon-512-transparent.svg" alt="Thematic Quran Logo" style="width: 24px; height: 24px; object-fit: contain;">
                <span style="color: white; font-family: 'Forum', serif; font-size: 24px; letter-spacing: 0.05em; transform: translateY(-5px);">ThematicQuran.com</span>
            </div>
        `;
        versesContainer.appendChild(headerContainer);

        // Add each target verse as a card
        targets.forEach(t => {
            const row = QURAN_DATA.find(r => r.surah_no === t.s && r.ayah_no_surah === t.a);
            const arText = row ? row.ayah_ar : '';
            const enText = row ? row.ayah_en : '';
            const surahNameLat = row ? row.surah_name_roman : '';

            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.marginBottom = '80px';

            const surahNameEn = row ? row.surah_name_en : '';

            card.innerHTML = `
                <div style="text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="color: #56A3A6; font-family: 'Forum', serif; font-size: 44px; letter-spacing: 0.05em; text-transform: uppercase;">Surah ${surahNameLat}</div>
                    <div style="color: rgba(255,255,255,0.6); font-family: 'Nunito', sans-serif; font-size: 24px; margin-top: 10px;">${surahNameEn} - Verse ${t.a}</div>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 24px;">
                    <div style="flex: 1;">
                        <p dir="rtl" style="color: #F3E4CE; font-family: 'Amiri Quran', serif; font-size: 46px; line-height: 1.8;">${arText}</p>
                    </div>
                    <div style="flex-shrink: 0; display: inline-flex; position: relative; width: 2em; height: 2em; vertical-align: middle; margin-top: 5px;">
                        <span style="font-family: 'Amiri Quran', serif; font-size: 46px; position: absolute; transform: translate(-50%, -100%); left: 50%; top: 50%; color: #F3E4CE; margin-top: -5px;">۝</span>
                        <span style="font-family: 'Amiri', serif; font-size: 16px; position: absolute; transform: translate(-50%, -70%); left: 50%; top: 50%; color: #F3E4CE; z-index: 1; margin-top: 5px;">${t.a}</span>
                    </div>
                </div>
                <p style="color: rgba(255,255,255,0.8); font-family: 'Nunito', sans-serif; font-size: 30px; line-height: 1.6;">${enText}</p>
            `;
            versesContainer.appendChild(card);
        });

        // Add Footer Branding 
        const footerContainer = document.createElement('div');
        footerContainer.style.width = '100%';
        footerContainer.style.display = 'flex';
        footerContainer.style.alignItems = 'center';
        footerContainer.style.justifyContent = 'center';
        footerContainer.style.gap = '20px';
        footerContainer.style.opacity = '0.6';
        footerContainer.style.marginTop = '20px';
        footerContainer.style.paddingTop = '40px';
        footerContainer.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
        footerContainer.innerHTML = `
            <img src="assets/icon-512-transparent.svg" alt="Thematic Quran Logo" style="width: 28px; height: 28px; object-fit: contain;">
            <span style="color: white; font-family: 'Forum', serif; font-size: 24px; letter-spacing: 0.05em; transform: translateY(-5px);">ThematicQuran.com</span>
        `;
        versesContainer.appendChild(footerContainer);

        const bottomSpacer = document.createElement('div');
        bottomSpacer.style.height = '60px';
        bottomSpacer.style.width = '100%';
        bottomSpacer.style.flexShrink = '0';
        versesContainer.appendChild(bottomSpacer);

        exportContainer.appendChild(versesContainer);
        document.body.appendChild(exportContainer);

        // 4. Fetch Audio files
        console.log("Fetching audio components...");
        const audioBuffers = [];
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];

            // Insert a 1.5s silent pause before each new verse (after the first one)
            if (i > 0) {
                const silenceBuffer = audioContext.createBuffer(2, Math.floor(audioContext.sampleRate * 1.5), audioContext.sampleRate);
                audioBuffers.push({ buffer: silenceBuffer, type: 'silence' });
            }

            // Arabic
            const arUrl = window.getAudioUrl('arabic', t.s, t.a, reciterSlug, langCode);
            try {
                const req = await fetch(arUrl);
                const arrBuf = await req.arrayBuffer();
                const audBuf = await audioContext.decodeAudioData(arrBuf);
                audioBuffers.push({ buffer: audBuf, type: 'arabic' });
            } catch (e) { console.error(`Failed to fetch AR audio for ${t.s}:${t.a}`, e); }

            // Translation
            const enUrl = window.getAudioUrl('translation', t.s, t.a, reciterSlug, langCode);
            try {
                const req = await fetch(enUrl);
                const arrBuf = await req.arrayBuffer();
                const audBuf = await audioContext.decodeAudioData(arrBuf);
                audioBuffers.push({ buffer: audBuf, type: 'translation' });
            } catch (e) { console.error(`Failed to fetch EN audio for ${t.s}:${t.a}`, e); }
        }

        console.log("Stitching custom audio buffers...");
        const finalBuffer = await window.stitchStereoBuffers(audioBuffers);
        // Note: bufferToWave is in audio-downloader.js but is not explicitly mapped to window.
        // If it fails, I'll need to extract its functionality here or assume it's global.
        // It's a global function declared via function, so it should be accessible.
        const audioBlob = window.bufferToWave(finalBuffer, finalBuffer.length);

        console.log("Fetching Bismillah...");
        const bismillahResponse = await fetch('https://audio.thematicquran.com/bismillah.mp3');
        const bismillahArrayBuffer = await bismillahResponse.arrayBuffer();
        const bismillahBlob = new Blob([bismillahArrayBuffer], { type: 'audio/mp3' });

        const decodedBismillah = await audioContext.decodeAudioData(bismillahArrayBuffer.slice(0));
        const bismillahDuration = decodedBismillah.duration;

        const audioBuffer = await audioBlob.arrayBuffer();
        const decodedContent = await audioContext.decodeAudioData(audioBuffer);
        const contentDuration = decodedContent.duration / pace;

        const pauseDuration = 0.3;
        const totalDuration = bismillahDuration + pauseDuration + contentDuration;

        // 5. Render Canvas
        console.log("Rendering canvas...");
        await new Promise(r => setTimeout(r, 500));

        const fullCanvas = await html2canvas(exportContainer, {
            width: VIEWPORT_WIDTH,
            scale: 1,
            useCORS: true,
            backgroundColor: null,
            windowHeight: exportContainer.scrollHeight
        });
        const imageData = fullCanvas.toDataURL('image/png'); // Using lossless PNG for much sharper text rendering
        document.body.removeChild(exportContainer);

        const scrollableDistance = Math.max(0, fullCanvas.height - (2 * VIEWPORT_HEIGHT));

        // 6. Initialize FFmpeg
        if (!window.FFmpegWASM) { throw new Error("FFmpeg not loaded on page."); }

        console.log("Loading FFmpeg engine...");
        const { FFmpeg } = window.FFmpegWASM;
        const { fetchFile } = window.FFmpegUtil;
        const ffmpeg = new FFmpeg();

        ffmpeg.on('progress', ({ progress }) => {
            const percent = Math.min(Math.round(progress * 100), 100);
            console.log(`FFmpeg encoding progress: ${percent}%`);
        });

        const baseURL = new URL('vendor/ffmpeg', window.location.href).href;
        await ffmpeg.load({
            coreURL: `${baseURL}/ffmpeg-core.js`,
            wasmURL: 'https://audio.thematicquran.com/ffmpeg-core.wasm',
            workerURL: `${baseURL}/814.ffmpeg.js`
        });

        await ffmpeg.writeFile('image.png', await fetchFile(imageData));
        await ffmpeg.writeFile('bismillah.mp3', await fetchFile(bismillahBlob));
        await ffmpeg.writeFile('audio.wav', await fetchFile(audioBlob));

        console.log("Muxing video via FFmpeg...");
        const fps = 20;
        let ffmpegArgs = [];

        const scrollTime = contentDuration * 0.8;
        const startTime = bismillahDuration + pauseDuration + (contentDuration * 0.1);

        let yFormula;
        if (scrollableDistance > 0) {
            yFormula = `if(lt(t,${bismillahDuration + pauseDuration}),0,${VIEWPORT_HEIGHT}+min(max((t-${startTime})/${scrollTime}*${scrollableDistance},0),${scrollableDistance}))`;
        } else {
            yFormula = `if(lt(t,${bismillahDuration + pauseDuration}),0,${VIEWPORT_HEIGHT})`;
        }

        ffmpegArgs = [
            '-loop', '1',
            '-framerate', String(fps),
            '-i', 'image.png',
            '-i', 'bismillah.mp3',
            '-i', 'audio.wav',
            '-filter_complex', `[0:v]crop=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}:0:'${yFormula}',scale=540:1170[v];[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atempo=1.0[a1];[2:a]aformat=sample_rates=44100:channel_layouts=stereo,atempo=${pace},adelay=300|300[a2];[a1][a2]concat=n=2:v=0:a=1[a]`,
            '-map', '[v]',
            '-map', '[a]',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-pix_fmt', 'yuv420p',
            '-crf', '24',           // High quality video compression
            '-c:a', 'aac',
            '-b:a', '128k',         // High quality audio format
            '-t', String(totalDuration),
            'output.mp4'
        ];

        await ffmpeg.exec(ffmpegArgs);

        console.log("Reading output and downloading...");
        const fileData = await ffmpeg.readFile('output.mp4');
        const mp4Blob = new Blob([fileData.buffer], { type: 'video/mp4' });

        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `ThematicQuran_CustomSelection.mp4`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        if (window.showToast) window.showToast('Custom Video Compiled!', 'done');
        console.log("One-off video export complete!");

    } catch (error) {
        console.error("Custom export failed:", error);
        if (window.showToast) window.showToast('Custom Video Failed. Check console.', 'error');

        const exportContainer = document.getElementById('custom-video-export-container');
        if (exportContainer) document.body.removeChild(exportContainer);
    }
};
