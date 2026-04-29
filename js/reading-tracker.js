/**
 * Reading Tracker
 * ----------------------------------------------------------------------
 * Reports the user's listening activity to the Quran Foundation API so
 * that /activity-days, /streaks, and /reading-sessions return non-empty
 * data for this user — which is what the Sirat-al-Mustaqim visualizer
 * relies on.
 *
 * Strategy:
 *   • Listen for the existing `verse-changed` event dispatched by
 *     audio-player.js whenever a new Arabic or translation track starts.
 *   • Listen for the `section-ended` event when a queue completes.
 *   • Track the start time of each verse and accumulate seconds while
 *     the audio is actively playing (pause/resume aware).
 *   • Batch-flush a "reading session" payload every FLUSH_MS, on user
 *     pause, and on `pagehide` / `visibilitychange:hidden` so we don't
 *     lose data if the tab closes.
 *   • Only fire when there's an authenticated session — guarded by the
 *     same cookie check the rest of the app uses.
 *
 * IMPORTANT — Schema confirmation needed:
 *   The shape of the POST body for /auth/v1/reading-sessions is not yet
 *   verified against the live docs (docs domain blocked at fetch time).
 *   The body below is the most-likely shape based on how the QF API is
 *   structured elsewhere. After you verify against:
 *     https://api-docs.quran.foundation/docs/user-related-apis/reading-sessions-vs-activity-days/
 *   adjust the `buildSessionBody()` mapping below. The endpoint path
 *   is also a single constant — easy to swap.
 */
(function () {
    'use strict';

    // -----------------------------------------------------------------
    // Config — tweak these once the docs are confirmed.
    // -----------------------------------------------------------------
    const READING_SESSIONS_ENDPOINT = '/api/qf/auth/v1/reading-sessions';
    const ACTIVITY_DAY_ENDPOINT     = '/api/qf/auth/v1/activity-days';   // fallback bump
    const FLUSH_INTERVAL_MS         = 60_000;   // flush every minute while playing
    const MIN_SECONDS_PER_FLUSH     = 5;        // don't bother with sub-5s flushes
    const SESSION_TYPE              = 'QURAN';

    // -----------------------------------------------------------------
    // Auth gate — same cookie pattern used elsewhere in the app.
    // -----------------------------------------------------------------
    function isLoggedIn() {
        return /(?:^|; )quran_access_token_(?:prelive|production)=/.test(document.cookie || '');
    }

    // -----------------------------------------------------------------
    // Listening accumulator
    // -----------------------------------------------------------------
    /** @type {{ surah:number, verse:number, type:string, start:number, accumulated:number }|null} */
    let current = null;
    /** @type {Array<{ surah:number, verse:number, seconds:number, started_at:string }>} */
    let pendingVerses = [];
    let pendingSeconds = 0;
    let lastResumeAt = 0;
    let isPlaying = false;
    let flushTimerId = null;

    function nowSec() { return Math.floor(performance.now() / 1000); }
    function isoNow() { return new Date().toISOString(); }

    function startVerse(detail) {
        // Close out any verse we were already tracking.
        finalizeVerse();
        current = {
            surah: detail.surah,
            verse: detail.verse,
            type:  detail.type,
            start: nowSec(),
            accumulated: 0,
            started_at: isoNow()
        };
        lastResumeAt = nowSec();
        isPlaying = true;
    }

    function finalizeVerse() {
        if (!current) return;
        if (isPlaying) {
            current.accumulated += Math.max(0, nowSec() - lastResumeAt);
            lastResumeAt = nowSec();
        }
        if (current.accumulated > 0) {
            pendingVerses.push({
                surah: current.surah,
                verse: current.verse,
                seconds: current.accumulated,
                started_at: current.started_at
            });
            pendingSeconds += current.accumulated;
        }
        current = null;
    }

    function pauseAccumulation() {
        if (!isPlaying || !current) return;
        current.accumulated += Math.max(0, nowSec() - lastResumeAt);
        isPlaying = false;
    }

    function resumeAccumulation() {
        if (isPlaying || !current) return;
        lastResumeAt = nowSec();
        isPlaying = true;
    }

    // -----------------------------------------------------------------
    // Network — POST a reading-session, fall back to bumping activity-day.
    // -----------------------------------------------------------------

    /**
     * ADJUST PER DOCS — the body shape below is the conservative best-guess.
     * The QF API page name "reading-sessions-vs-activity-days" implies a
     * granular event POST; common shapes in similar APIs are:
     *
     *   { type: 'QURAN', duration: 73, started_at, ended_at,
     *     verses: [{ surah, verse, seconds }, ...] }
     *
     * If the docs specify `verse_key: "2:255"` instead of {surah, verse},
     * change the .map below; everything else stays the same.
     */
    function buildSessionBody() {
        return {
            type: SESSION_TYPE,
            duration: pendingSeconds,
            started_at: pendingVerses[0] && pendingVerses[0].started_at || isoNow(),
            ended_at:   isoNow(),
            verses: pendingVerses.map(v => ({
                // verse_key: `${v.surah}:${v.verse}`,    // ← uncomment if docs use verse_key
                surah:   v.surah,
                verse:   v.verse,
                seconds: v.seconds
            }))
        };
    }

    /**
     * Best-effort fallback in case /reading-sessions isn't accepted: bump
     * the activity-day total by `seconds`. Many APIs accept a POST/PATCH
     * here with `{ date, seconds, type }`.
     */
    function buildActivityDayBody(seconds) {
        return {
            date: new Date().toISOString().slice(0, 10),
            seconds,
            type: SESSION_TYPE
        };
    }

    async function flush(reason) {
        // Make sure the in-flight verse contributes too.
        if (current) finalizeVerse();
        if (pendingSeconds < MIN_SECONDS_PER_FLUSH) return;
        if (!isLoggedIn()) {
            // No user — discard rather than queueing forever.
            pendingVerses = []; pendingSeconds = 0;
            return;
        }
        const body = buildSessionBody();
        const drainSeconds = pendingSeconds;
        pendingVerses = []; pendingSeconds = 0;

        try {
            const r = await fetch(READING_SESSIONS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body),
                keepalive: reason === 'pagehide'      // critical for tab-close flush
            });
            if (!r.ok) {
                console.warn(`[ReadingTracker] reading-sessions POST → ${r.status}; falling back to activity-day bump`);
                await fetch(ACTIVITY_DAY_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(buildActivityDayBody(drainSeconds)),
                    keepalive: reason === 'pagehide'
                }).catch(() => {});
            } else {
                console.log(`%c[ReadingTracker] +${drainSeconds}s flushed (${reason})`,
                    'color:#88FFD1');
            }
        } catch (e) {
            console.warn('[ReadingTracker] flush failed', e);
        }
    }

    function ensureFlushTimer() {
        if (flushTimerId) return;
        flushTimerId = setInterval(() => flush('interval'), FLUSH_INTERVAL_MS);
    }
    function clearFlushTimer() {
        if (!flushTimerId) return;
        clearInterval(flushTimerId);
        flushTimerId = null;
    }

    // -----------------------------------------------------------------
    // Wire up to the existing audio-player events.
    // -----------------------------------------------------------------
    document.addEventListener('verse-changed', (e) => {
        if (!e.detail) return;
        // Only count Arabic recitation toward listening time. Translation
        // tracks are educational but not "reading the Quran". Comment the
        // next line out to count both.
        if (e.detail.type !== 'arabic') {
            // still close out any prior verse so seconds are flushed cleanly
            finalizeVerse();
            return;
        }
        startVerse(e.detail);
        ensureFlushTimer();
    });

    document.addEventListener('section-ended', () => {
        finalizeVerse();
        flush('section-ended');
        clearFlushTimer();
    });

    // The audio-player keeps `isAudioPlaying` global; we shadow with our own
    // play/pause state observed from the play/pause button on the document.
    document.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest && e.target.closest('#globalPlayPauseBtn');
        if (!btn) return;
        // Defer one tick so the audio-player's internal state has flipped.
        setTimeout(() => {
            const status = document.getElementById('playerStatus');
            if (status && status.textContent.trim().toLowerCase() === 'playing') {
                resumeAccumulation();
                ensureFlushTimer();
            } else {
                pauseAccumulation();
                flush('user-pause');
            }
        }, 30);
    });

    // Page hide / tab close: best-effort flush via fetch keepalive.
    window.addEventListener('pagehide', () => flush('pagehide'));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush('hidden');
    });

    // Expose for manual flushing / debugging.
    window.flushReadingTracker = (reason = 'manual') => flush(reason);
    window.__readingTrackerState = () => ({
        current, pendingVerses, pendingSeconds, isPlaying
    });

    console.log('%c[ReadingTracker] active', 'color:#56A3A6');
})();
