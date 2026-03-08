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

            const VIEWPORT_WIDTH = 720;
            const VIEWPORT_HEIGHT = 1560; // iPhone 19.5:9 aspect ratio

            // 1. Create a styled container optimized for vertical video
            const exportContainer = document.createElement('div');
            exportContainer.id = 'video-export-container';
            exportContainer.style.position = 'fixed';
            exportContainer.style.top = '-9999px'; // Hide off-screen
            exportContainer.style.left = '0';
            exportContainer.style.width = `${VIEWPORT_WIDTH}px`;
            exportContainer.style.backgroundColor = '#12101C';
            exportContainer.style.backgroundImage = 'linear-gradient(to bottom, #12101C 0%, #221F2B 50%, #352B39 100%)';
            exportContainer.style.display = 'flex';
            exportContainer.style.flexDirection = 'column';
            exportContainer.style.alignItems = 'center';
            exportContainer.style.zIndex = '-9999';

            // 2. Build Intro Slate
            const surahInfo = data && data.length > 0 ? data[0] : null;
            const englishNameStr = surahInfo ? surahInfo.surah_name_en : '';
            const romanNameStr = surahInfo ? surahInfo.surah_name_roman : `Surah ${surahNum}`;
            const subTitleText = englishNameStr ? `${surahNum} ${romanNameStr} (${englishNameStr})` : `${surahNum} ${romanNameStr}`;
            const verseText = `Verses ${start} - ${end}`;

            const introSlate = document.createElement('div');
            introSlate.style.width = '100%';
            introSlate.style.height = `${VIEWPORT_HEIGHT}px`;
            introSlate.style.display = 'flex';
            introSlate.style.flexDirection = 'column';
            introSlate.style.alignItems = 'center';
            introSlate.style.justifyContent = 'center';
            introSlate.style.padding = '0 60px'; // Side padding
            introSlate.innerHTML = `
                <h1 style="color: white; font-family: 'Forum', serif; font-size: 50px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 20px; text-align: center;">${subTitleText}</h1>
                <h2 style="color: rgba(255,255,255,0.6); font-family: 'Nunito', sans-serif; font-size: 30px; margin-bottom: 70px; text-align: center;">${verseText}</h2>
                <p style="color: white; font-family: 'Amiri Quran', serif; font-size: 80px; margin-bottom: 120px; text-align: center; width: 100%;" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
                <div style="display: flex; align-items: center; justify-content: center; gap: 30px; opacity: 0.8;">
                    <img src="assets/icon-512-transparent.svg" alt="Thematic Quran Logo" style="width: 40px; height: 40px; object-fit: contain;">
                    <span style="color: white; font-family: 'Forum', serif; font-size: 28px; letter-spacing: 0.1em;">ThematicQuran.com</span>
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
            topSpacer.style.height = '60px'; // Symmetrical breathing room
            topSpacer.style.width = '100%';
            topSpacer.style.flexShrink = '0';
            versesContainer.appendChild(topSpacer);

            // 3.1. Add Header Container back inside verses
            const headerContainer = document.createElement('div');
            headerContainer.style.width = '100%';
            headerContainer.style.display = 'flex';
            headerContainer.style.flexDirection = 'column';
            headerContainer.style.alignItems = 'flex-start';
            headerContainer.style.paddingBottom = '30px';
            headerContainer.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
            headerContainer.style.marginBottom = '0';
            headerContainer.innerHTML = `
                <h1 style="color: white; font-family: 'Forum', serif; font-size: 40px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">${subTitleText}</h1>
                <h2 style="color: rgba(255,255,255,0.6); font-family: 'Nunito', sans-serif; font-size: 26px; margin-bottom: 30px;">${verseText}</h2>
                <div style="display: flex; align-items: center; justify-content: flex-start; gap: 16px; opacity: 0.8;">
                    <img src="assets/icon-512-transparent.svg" alt="Thematic Quran Logo" style="width: 24px; height: 24px; object-fit: contain;">
                    <span style="color: white; font-family: 'Forum', serif; font-size: 24px; letter-spacing: 0.05em;">ThematicQuran.com</span>
                </div>
            `;
            versesContainer.appendChild(headerContainer);

            // 3. Clone the thematic card
            const clonedCard = card.cloneNode(true);
            clonedCard.style.margin = '0';
            clonedCard.style.width = '100%';
            // Expand width and remove borders/background to look clean on the gradient
            clonedCard.style.maxWidth = '100%'; // Maximize width usage based on container
            clonedCard.style.boxShadow = 'none';
            clonedCard.style.border = 'none';
            clonedCard.style.backgroundColor = 'transparent';
            clonedCard.style.backdropFilter = 'none';
            clonedCard.style.maxHeight = 'none';
            clonedCard.style.padding = '0'; // Remove internal padding to maximize space

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
                    num.style.transform = 'translate(-50%, -70%)';
                    num.style.marginTop = '5px';
                    num.style.margin = '0';
                    num.style.zIndex = '1';
                }
            });

            // Make the text larger to improve readability in the video, 
            // relying on reduced margins/padding to avoid scrolling.
            const arabicDiv = clonedCard.querySelector('.text-\\[\\#F3E4CE\\]');
            if (arabicDiv) {
                arabicDiv.style.fontSize = '40px';
                arabicDiv.style.lineHeight = '1.6';
                arabicDiv.style.marginBottom = '24px';
            }
            // translation div is typically the last element
            const transDiv = clonedCard.lastElementChild;
            if (transDiv && transDiv !== arabicDiv) {
                transDiv.style.fontSize = '30px';
                transDiv.style.lineHeight = '1.6';
            }

            versesContainer.appendChild(clonedCard);

            // 3.2 Add Footer Branding 
            const footerContainer = document.createElement('div');
            footerContainer.style.width = '100%';
            footerContainer.style.display = 'flex';
            footerContainer.style.alignItems = 'center';
            footerContainer.style.justifyContent = 'center';
            footerContainer.style.gap = '20px';
            footerContainer.style.opacity = '0.6';
            footerContainer.style.marginTop = '60px'; // Breathing room from translation
            footerContainer.style.paddingTop = '40px';
            footerContainer.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
            footerContainer.innerHTML = `
                <img src="assets/icon-512-transparent.svg" alt="Thematic Quran Logo" style="width: 28px; height: 28px; object-fit: contain;">
                <span style="color: white; font-family: 'Forum', serif; font-size: 24px; letter-spacing: 0.05em;">ThematicQuran.com</span>
            `;
            versesContainer.appendChild(footerContainer);

            // Add a bottom spacer to guarantee html2canvas captures the bottom padding
            const bottomSpacer = document.createElement('div');
            bottomSpacer.style.height = '60px'; // Symmetrical with top padding
            bottomSpacer.style.width = '100%';
            bottomSpacer.style.flexShrink = '0';
            versesContainer.appendChild(bottomSpacer);

            exportContainer.appendChild(versesContainer);
            document.body.appendChild(exportContainer);

            // MANUALLY CENTER CONTENT IF SHORT
            // We use 120 because of the 60 top + 60 bottom spacer
            const innerContentHeight = topSpacer.offsetHeight + clonedCard.scrollHeight + bottomSpacer.offsetHeight;
            if (innerContentHeight < VIEWPORT_HEIGHT) {
                // Short content: add margin to the top spacer to vertically center it mathematically
                const remainingSpace = VIEWPORT_HEIGHT - innerContentHeight;
                topSpacer.style.height = `${60 + Math.floor(remainingSpace / 2)}px`;
            }

            // 3. Fetch Bismillah Audio & Content Audio
            if (progressText) progressText.textContent = 'Fetching High Quality Audio...';

            const bismillahResponse = await fetch('https://audio.thematicquran.com/bismillah.mp3');
            const bismillahArrayBuffer = await bismillahResponse.arrayBuffer();
            const bismillahBlob = new Blob([bismillahArrayBuffer], { type: 'audio/mp3' });

            const audioBlob = await createStitchedAudioBlob(surahNum, start, end, reciterSlug, langCode, (stage, percent, msg) => { });

            // Get audio durations
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const decodedBismillah = await audioContext.decodeAudioData(bismillahArrayBuffer.slice(0)); // slice to copy
            const bismillahDuration = decodedBismillah.duration;

            const audioBuffer = await audioBlob.arrayBuffer();
            const decodedContent = await audioContext.decodeAudioData(audioBuffer);
            const contentDuration = decodedContent.duration / pace;

            const totalDuration = bismillahDuration + contentDuration;

            // 4. Prepare Image Canvas
            await new Promise(r => setTimeout(r, 500)); // wait for fonts

            // Render the full scrolling image
            const fullCanvas = await html2canvas(exportContainer, {
                width: VIEWPORT_WIDTH,
                scale: 1,
                useCORS: true,
                backgroundColor: null,
                windowHeight: exportContainer.scrollHeight
            });
            const imageData = fullCanvas.toDataURL('image/jpeg', 0.85); // JPEG compression is more lightweight for FFmpeg than PNG
            document.body.removeChild(exportContainer);

            // Calculate exact scrolling distance. 
            // Intro takes up the first VIEWPORT_HEIGHT exactly.
            // Total canvas height is VIEWPORT_HEIGHT + VersesBlockHeight.
            // The scrollable distance is thus fullCanvas.height - 2*VIEWPORT_HEIGHT.
            const scrollableDistance = Math.max(0, fullCanvas.height - (2 * VIEWPORT_HEIGHT));

            // 5. Initialize FFmpeg
            if (!window.FFmpegWASM) { throw new Error("FFmpeg not loaded on page."); }

            if (progressText) progressText.textContent = 'Loading Video Engine...';
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile } = window.FFmpegUtil;
            this.ffmpeg = new FFmpeg();

            this.ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.min(Math.round(progress * 100), 100);
                if (progressBar) progressBar.style.width = `${percent}% `;
                if (progressPercent) progressPercent.textContent = `${percent}% `;
                if (progressText) progressText.textContent = 'Rendering Video...';
            });

            const baseURL = new URL('vendor/ffmpeg', window.location.href).href;
            await this.ffmpeg.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: 'https://audio.thematicquran.com/ffmpeg-core.wasm',
                workerURL: `${baseURL}/814.ffmpeg.js`
            });

            await this.ffmpeg.writeFile('image.jpg', await fetchFile(imageData));
            await this.ffmpeg.writeFile('bismillah.mp3', await fetchFile(bismillahBlob));
            await this.ffmpeg.writeFile('audio.wav', await fetchFile(audioBlob));

            // 7. Run FFmpeg command
            if (progressText) progressText.textContent = 'Muxing Streams...';

            const fps = 20;
            let ffmpegArgs = [];

            // We construct the crop formula to hold on Intro (Y=0), then snap to verses (Y=VIEWPORT_HEIGHT) and scroll.
            // Scroll duration = contentDuration * 0.8
            // Scroll start time = bismillahDuration + (contentDuration * 0.1)
            const scrollTime = contentDuration * 0.8;
            const startTime = bismillahDuration + (contentDuration * 0.1);

            let yFormula;
            if (scrollableDistance > 0) {
                // If t < bismillahDuration, stay at y=0. Else, jump to y=VIEWPORT_HEIGHT + scroll.
                yFormula = `if(lt(t,${bismillahDuration}),0,${VIEWPORT_HEIGHT}+min(max((t-${startTime})/${scrollTime}*${scrollableDistance},0),${scrollableDistance}))`;
            } else {
                // Intro for Bismillah, then static verses.
                yFormula = `if(lt(t,${bismillahDuration}),0,${VIEWPORT_HEIGHT})`;
            }

            ffmpegArgs = [
                '-loop', '1',
                '-framerate', String(fps),
                '-i', 'image.jpg',
                '-i', 'bismillah.mp3',
                '-i', 'audio.wav',
                '-filter_complex', `[0:v]crop=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}:0:'${yFormula}',scale=540:1170[v];[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atempo=1.0[a1];[2:a]aformat=sample_rates=44100:channel_layouts=stereo,atempo=${pace}[a2];[a1][a2]concat=n=2:v=0:a=1[a]`,
                '-map', '[v]',
                '-map', '[a]',
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-pix_fmt', 'yuv420p',
                '-crf', '28',
                '-c:a', 'aac',
                '-b:a', '64k',
                '-t', String(totalDuration),
                'output.mp4'
            ];

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
