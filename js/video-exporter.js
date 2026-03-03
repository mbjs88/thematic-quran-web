// js/video-exporter.js
// Handles client-side video generation using html2canvas and ffmpeg.wasm (offline rendering)

const VideoExporter = {
    isExporting: false,
    ffmpeg: null,

    async exportCardToVideo(card, surahNum, start, end, data, reciterSlug = 'Alafasy_128kbps', langCode = 'en', pace = 1.0) {
        if (this.isExporting) {
            if (window.showToast) window.showToast('Already exporting a video.', 'warning');
            return;
        }

        this.isExporting = true;

        // Setup Progress UI
        const toast = document.getElementById('videoProgressToast');
        const progressBar = document.getElementById('vidProgressBar');
        const progressPercent = document.getElementById('vidProgressPercent');
        const progressText = document.getElementById('vidProgressText');
        const cancelBtn = document.getElementById('cancelVideoExportBtn');

        if (toast) {
            toast.classList.remove('translate-y-full');
            progressBar.style.width = '0%';
            progressPercent.textContent = '0%';
            progressText.textContent = 'Preparing audio...';

            // Displace the bottom control bar to sit directly above the toast
            // The toast is approx 72px high based on its padding/text contents
            const playerBar = document.getElementById('playerBar');
            if (playerBar) {
                playerBar.style.transform = 'translateY(-72px)';
                playerBar.style.transition = 'transform 300ms ease-in-out';
            }
        }

        cancelBtn.onclick = () => {
            if (this.isExporting) this.stopVideoExport(true);
        };

        const resetUI = () => {
            this.isExporting = false;
            if (toast) toast.classList.add('translate-y-full');

            const playerBar = document.getElementById('playerBar');
            if (playerBar) playerBar.style.transform = 'translateY(0)';
        };

        try {
            if (window.showToast) window.showToast('Preparing video export...', 'movie');

            // 1. Create a styled container optimized for vertical video (9:16 aspect ratio, e.g., 1080x1920)
            const exportContainer = document.createElement('div');
            exportContainer.id = 'video-export-container';
            exportContainer.style.width = '720px';
            exportContainer.style.minHeight = '1280px';
            exportContainer.style.position = 'fixed';
            exportContainer.style.top = '-9999px'; // Hide off-screen
            exportContainer.style.left = '0';
            exportContainer.style.backgroundColor = '#12101C';
            exportContainer.style.backgroundImage = 'linear-gradient(to bottom, #12101C 0%, #221F2B 50%, #352B39 100%)';
            exportContainer.style.display = 'flex';
            exportContainer.style.flexDirection = 'column';
            exportContainer.style.justifyContent = 'center';
            exportContainer.style.alignItems = 'center';
            exportContainer.style.padding = '60px';
            exportContainer.style.zIndex = '-9999';

            // 2. Add Custom Video Header
            const headerContainer = document.createElement('div');
            headerContainer.style.width = '100%';
            headerContainer.style.maxWidth = '680px';
            headerContainer.style.display = 'flex';
            headerContainer.style.flexDirection = 'column';
            headerContainer.style.alignItems = 'flex-start';
            headerContainer.style.paddingBottom = '30px';
            headerContainer.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
            headerContainer.style.marginBottom = '40px';

            // Get Surah Info from the passed verse data
            const surahInfo = data && data.length > 0 ? data[0] : null;

            // Expected format: "61 As-Saf (The Ranks)"
            const englishNameStr = surahInfo ? surahInfo.surah_name_en : '';
            const romanNameStr = surahInfo ? surahInfo.surah_name_roman : `Surah ${surahNum}`;
            const subTitleText = englishNameStr ? `${surahNum} ${romanNameStr} (${englishNameStr})` : `${surahNum} ${romanNameStr}`;

            const verseText = `Verses ${start} - ${end}`;

            headerContainer.innerHTML = `
                <h1 style="color: white; font-family: 'Forum', serif; font-size: 40px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">${subTitleText}</h1>
                <h2 style="color: rgba(255,255,255,0.6); font-family: 'Nunito', sans-serif; font-size: 26px; margin-bottom: 50px;">${verseText}</h2>
                <div style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 48px; opacity: 0.8;">
                    <img src="assets/icon-512-transparent.svg" alt="Thematic Quran Logo" style="width: 32px; height: 32px; object-fit: contain;">
                    <span style="color: white; font-family: 'Forum', serif; font-size: 24px; letter-spacing: 0.1em;">thematicQuran.com</span>
                </div>
            `;
            exportContainer.appendChild(headerContainer);

            // 3. Clone the thematic card
            const clonedCard = card.cloneNode(true);
            clonedCard.style.margin = '0';
            clonedCard.style.width = '100%';
            // Expand width and remove borders/background to look clean on the gradient
            clonedCard.style.maxWidth = '680px';
            clonedCard.style.boxShadow = 'none';
            clonedCard.style.border = 'none';
            clonedCard.style.backgroundColor = 'transparent';
            clonedCard.style.backdropFilter = 'none';
            clonedCard.style.maxHeight = 'none';

            // Remove interactive elements and redundant structural headers
            const actionsDiv = clonedCard.querySelector('.flex.items-center.gap-2');
            if (actionsDiv) actionsDiv.remove();

            // Remove the internal header that says "Verses X - Y" and its bounding boxes/dividers
            // In ui-renderer, the internal header is usually the first child or marked by border-b
            const internalHeader = clonedCard.querySelector('.border-b.border-white\\/10');
            if (internalHeader) internalHeader.remove();

            // Fix ayah numbers styling for html2canvas
            clonedCard.querySelectorAll('.ayah-badge').forEach(badge => {
                badge.style.position = 'relative';
                badge.style.display = 'inline-block';
                badge.style.width = '2em';
                badge.style.height = '2em';
                badge.style.margin = '0 0.2em';
                badge.style.verticalAlign = 'middle';

                const symbol = badge.querySelector('.ayah-symbol');
                const num = badge.querySelector('.ayah-number');

                if (symbol) {
                    symbol.style.position = 'absolute';
                    symbol.style.top = '50%';
                    symbol.style.left = '50%';
                    symbol.style.transform = 'translate(-50%, -100%)';
                    symbol.style.marginTop = '-5px';
                    symbol.style.margin = '0';
                    symbol.style.lineHeight = '1';
                }

                if (num) {
                    num.style.position = 'absolute';
                    num.style.top = '50%';
                    num.style.left = '50%';
                    num.style.transform = 'translate(-50%, -60%)';
                    num.style.marginTop = '5px';
                    num.style.margin = '0';
                    num.style.zIndex = '1';
                }
            });

            exportContainer.appendChild(clonedCard);
            document.body.appendChild(exportContainer);

            // 3. Extract Audio processing
            if (progressText) progressText.textContent = 'Fetching High Quality Audio...';

            const audioBlob = await createStitchedAudioBlob(surahNum, start, end, reciterSlug, langCode, (stage, percent, msg) => { });

            // Get audio duration to calculate scroll speed
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioBlob.arrayBuffer();
            const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
            // Adjusted duration based on pace
            const audioDuration = decodedAudio.duration / pace;

            // 4. Prepare Image Canvas
            await new Promise(r => setTimeout(r, 500)); // wait for fonts

            // Render the full scrolling image once
            const fullCanvas = await html2canvas(exportContainer, {
                width: 720,
                scale: 1,
                useCORS: true,
                backgroundColor: null,
                windowHeight: exportContainer.scrollHeight
            });
            const imageData = fullCanvas.toDataURL('image/png', 0.8); // slight jpeg compression to save memory
            document.body.removeChild(exportContainer);

            const viewportHeight = 1280;
            const contentHeight = fullCanvas.height;
            const scrollableDistance = Math.max(0, contentHeight - viewportHeight);

            // 5. Initialize FFmpeg
            if (!window.FFmpegWASM) { throw new Error("FFmpeg not loaded on page."); }

            if (progressText) progressText.textContent = 'Loading Video Engine...';
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile } = window.FFmpegUtil;
            this.ffmpeg = new FFmpeg();

            this.ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.min(Math.round(progress * 100), 100);
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressPercent) progressPercent.textContent = `${percent}%`;
                if (progressText) progressText.textContent = 'Rendering Video...';
            });

            const baseURL = new URL('vendor/ffmpeg', window.location.href).href;
            await this.ffmpeg.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg-core.wasm`,
                workerURL: `${baseURL}/814.ffmpeg.js`
            });

            await this.ffmpeg.writeFile('image.png', await fetchFile(imageData));
            await this.ffmpeg.writeFile('audio.wav', await fetchFile(audioBlob));

            // 7. Run FFmpeg command
            if (progressText) progressText.textContent = 'Muxing Streams...';

            const fps = 20; // Lowered to 20fps for faster rendering
            let ffmpegArgs = [];

            if (scrollableDistance > 0) {
                // We have a tall image requiring scrolling
                // We use FFmpeg's `crop` filter to animate the window panning down
                // t is time in seconds. We pause for 10% of duration at start, 10% at end.
                // Scroll duration = audioDuration * 0.8
                // Scroll start time = audioDuration * 0.1
                const scrollTime = audioDuration * 0.8;
                const startTime = audioDuration * 0.1;

                // Max Y offset is scrollableDistance
                // Equation for Y offset during scroll: (t - startTime) / scrollTime * scrollableDistance
                // Bound it between 0 and scrollableDistance
                const yFormula = `min(max((t-${startTime})/${scrollTime}*${scrollableDistance}, 0), ${scrollableDistance})`;

                // Apply crop then scale down to 540x960 for much faster encoding
                // Also apply the atempo audio filter for pace adjustments
                ffmpegArgs = [
                    '-loop', '1',
                    '-framerate', String(fps),
                    '-i', 'image.png',
                    '-i', 'audio.wav',
                    '-filter_complex', `[0:v]crop=720:1280:0:'${yFormula}',scale=540:960[v];[1:a]atempo=${pace}[a]`,
                    '-map', '[v]',
                    '-map', '[a]',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-pix_fmt', 'yuv420p',
                    '-crf', '28', // Higher compression for video stream
                    '-c:a', 'aac',
                    '-b:a', '64k', // heavily compress audio for much smaller file footprint
                    '-t', String(audioDuration), // exact length of audio
                    'output.mp4'
                ];
            } else {
                // Static image fits entirely in the 1280px tall viewport
                // Apply scale down to 540x960 for faster encoding
                // Also apply the atempo audio filter for pace adjustments
                ffmpegArgs = [
                    '-loop', '1',
                    '-framerate', '2', // very slow framerate since it doesn't move
                    '-i', 'image.png',
                    '-i', 'audio.wav',
                    '-filter_complex', `[0:v]scale=540:960[v];[1:a]atempo=${pace}[a]`,
                    '-map', '[v]',
                    '-map', '[a]',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-tune', 'stillimage',
                    '-c:a', 'aac',
                    '-crf', '28', // Higher compression
                    '-b:a', '64k', // half bitrate
                    '-pix_fmt', 'yuv420p',
                    '-t', String(audioDuration),
                    'output.mp4'
                ];
            }

            await this.ffmpeg.exec(ffmpegArgs);

            // 8. Read output and download
            const fileData = await this.ffmpeg.readFile('output.mp4');
            const mp4Blob = new Blob([fileData.buffer], { type: 'video/mp4' });

            const url = URL.createObjectURL(mp4Blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `ThematicQuran_Surah${surahNum}_${start}-${end}.mp4`;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            if (window.showToast) window.showToast('Video Export Complete!', 'done');
            resetUI();

        } catch (error) {
            console.error("Export Failed or Cancelled", error);
            if (this.isExporting) { // Only show error if it wasn't intentionally cancelled
                if (window.showToast) window.showToast('Export failed. Check console.', 'error');
            }
            resetUI();

            const exportContainer = document.getElementById('video-export-container');
            if (exportContainer) document.body.removeChild(exportContainer);
        }
    },

    stopVideoExport(cancel = false) {
        if (this.isExporting) {
            this.isExporting = false;
            if (this.ffmpeg) {
                try {
                    this.ffmpeg.terminate();
                } catch (e) { }
            }

            const toast = document.getElementById('videoProgressToast');
            if (toast) toast.classList.add('translate-y-full');

            const playerBar = document.getElementById('playerBar');
            if (playerBar) playerBar.style.transform = 'translateY(0)';

            if (cancel && window.showToast) window.showToast('Video export cancelled.', 'info');

            const exportContainer = document.getElementById('video-export-container');
            if (exportContainer) document.body.removeChild(exportContainer);
        }
    }
};

window.VideoExporter = VideoExporter;
