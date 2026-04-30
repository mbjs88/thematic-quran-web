/* ============================================================
 *  Reading Tracker
 *  ------------------------------------------------------------
 *  Reports the user's listening to the Quran Foundation API so
 *  /activity-days, /streaks, and /reading-sessions can power the
 *  Sirat-al-Mustaqim visualiser.
 *
 *  How it works
 *  ------------
 *    · Hooks the existing `verse-changed` event from
 *      js/audio-player.js (dispatched on the document).
 *    · Times each Arabic recitation while the active player is
 *      not paused. Translation tracks are NOT counted (per the
 *      QF docs, activity is read-time on the Qur'an itself).
 *    · Coalesces consecutive verses into compact range strings,
 *      e.g. ["2:255-2:257", "112:1-112:4"].
 *    · Flushes every FLUSH_INTERVAL_MS, on `pagehide`, and on
 *      manual stop. Flush =
 *        POST /v1/activity-days  { type:'QURAN', seconds, ranges, mushafId, date? }
 *        POST /v1/reading-sessions { chapterNumber, verseNumber }  (last verse only)
 *    · Skips if the user is not signed in (no QF cookie).
 *
 *  API references (from api-docs.quran.foundation):
 *    Add/update activity day  -> body: type, seconds (>=1), ranges,
 *                                       mushafId, [date]
 *    Add/update reading session -> body: chapterNumber, verseNumber
 *
 *  This file is additive; it does not modify audio-player.js.
 * ============================================================ */

(function () {
    'use strict';

    // ---------------------------------------------------------
    // Config
    // ---------------------------------------------------------
    const FLUSH_INTERVAL_MS = 60 * 1000; // every minute while playing
    const MIN_FLUSH_SECONDS = 5;         // don't bother the API for trivial bursts
    const MUSHAF_ID         = 4;         // 4 = UthmaniHafs (matches everyayah audio)
    const ACTIVITY_URL      = '/api/qf/auth/v1/activity-days';
    const SESSION_URL       = '/api/qf/auth/v1/reading-sessions';

    // ---------------------------------------------------------
    // State
    // ---------------------------------------------------------
    // `verses` is an ordered list of { surah, verse } observed since the
    // last successful flush. We add at most one entry per (surah, verse)
    // pair per flush window so range coalescing stays clean.
    const buffer = {
        seconds: 0,           // accumulated listening time (Arabic only)
        verses:  [],          // [{ surah, verse }, ...] in playback order
        seen:    new Set(),   // dedupe key "surah:verse"
        lastVerse: null       // most recent { surah, verse } for /reading-sessions
    };

    let timing = {
        startMs:    0,        // when the current Arabic verse started timing
        currentKey: null      // which verse is being timed
    };

    let flushTimer = null;

    // ---------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------
    function isLoggedIn() {
        // Cookie name is environment-suffixed (`_prelive` or `_production`),
        // so a substring check is the simplest way to detect either.
        return /(?:^|; )quran_access_token_/.test(document.cookie);
    }

    function nowMs() { return Date.now(); }

    /**
     * Coalesce { surah, verse } observations into Quran Foundation range
     * strings: e.g. [{2,1},{2,2},{2,3},{112,1}] -> ["2:1-2:3","112:1-112:1"].
     */
    function buildRanges(verses) {
        if (!verses.length) return [];
        const sorted = verses
            .slice()
            .sort((a, b) => (a.surah - b.surah) || (a.verse - b.verse));

        const ranges = [];
        let start = sorted[0];
        let end   = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            const v = sorted[i];
            const isNext = (v.surah === end.surah) && (v.verse === end.verse + 1);
            if (isNext) {
                end = v;
            } else {
                ranges.push(`${start.surah}:${start.verse}-${end.surah}:${end.verse}`);
                start = v;
                end   = v;
            }
        }
        ranges.push(`${start.surah}:${start.verse}-${end.surah}:${end.verse}`);
        return ranges;
    }

    function bufferIsEmpty() {
        return buffer.seconds < MIN_FLUSH_SECONDS && buffer.verses.length === 0;
    }

    function resetBuffer() {
        buffer.seconds = 0;
        buffer.verses  = [];
        buffer.seen.clear();
        // keep buffer.lastVerse so reading-sessions reflects where we are
    }

    // ---------------------------------------------------------
    // Timing -- driven by the audio player events
    // ---------------------------------------------------------
    function stopTiming() {
        if (timing.currentKey === null) return;
        const elapsed = (nowMs() - timing.startMs) / 1000;
        if (elapsed > 0 && elapsed < 60 * 30) { // ignore wildly long gaps (sleep)
            buffer.seconds += elapsed;
        }
        timing.currentKey = null;
        timing.startMs    = 0;
    }

    function startTiming(surah, verse) {
        const key = `${surah}:${verse}`;
        if (timing.currentKey !== null) stopTiming();
        timing.currentKey = key;
        timing.startMs    = nowMs();

        if (!buffer.seen.has(key)) {
            buffer.seen.add(key);
            buffer.verses.push({ surah, verse });
        }
        buffer.lastVerse = { surah, verse };
    }

    // ---------------------------------------------------------
    // Network -- fire-and-forget, errors are warnings only
    // ---------------------------------------------------------
    async function postActivityDay(seconds, ranges) {
        const body = {
            type:     'QURAN',
            seconds:  Math.max(1, Math.round(seconds)),
            ranges:   ranges,
            mushafId: MUSHAF_ID
            // `date` omitted -> server stamps today using x-timezone
        };
        try {
            const tz = (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
            const r = await fetch(ACTIVITY_URL, {
                method:  'POST',
                headers: Object.assign(
                    { 'Content-Type': 'application/json' },
                    tz ? { 'x-timezone': tz } : {}
                ),
                body: JSON.stringify(body)
            });
            if (!r.ok) console.warn('[ReadingTracker] activity-day flush failed', r.status, await r.text());
        } catch (e) {
            console.warn('[ReadingTracker] activity-day flush error', e);
        }
    }

    async function postReadingSession(surah, verse) {
        try {
            const r = await fetch(SESSION_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chapterNumber: surah, verseNumber: verse })
            });
            if (!r.ok) console.warn('[ReadingTracker] reading-session post failed', r.status, await r.text());
        } catch (e) {
            console.warn('[ReadingTracker] reading-session post error', e);
        }
    }

    // ---------------------------------------------------------
    // Flush -- coalesce + send
    // ---------------------------------------------------------
    async function flush(reason = 'interval') {
        // Roll the in-flight verse into the buffer first.
        if (timing.currentKey !== null) {
            const prevKey = timing.currentKey;
            stopTiming();
            // re-arm timing on the same verse so live playback keeps counting
            const [s, v] = prevKey.split(':').map(Number);
            startTiming(s, v);
        }

        if (!isLoggedIn() || bufferIsEmpty()) return;

        const seconds = buffer.seconds;
        const ranges  = buildRanges(buffer.verses);
        const last    = buffer.lastVerse;
        resetBuffer();

        console.log(`%c[ReadingTracker] flush (${reason}): ${Math.round(seconds)}s, ranges=${ranges.join(',')}`,
                    'color:#56A3A6');

        await postActivityDay(seconds, ranges);
        if (last) await postReadingSession(last.surah, last.verse);
    }

    function startFlushTimer() {
        if (flushTimer) return;
        flushTimer = setInterval(() => flush('interval'), FLUSH_INTERVAL_MS);
    }

    function stopFlushTimer() {
        if (!flushTimer) return;
        clearInterval(flushTimer);
        flushTimer = null;
    }

    // ---------------------------------------------------------
    // Wire up the audio player events
    // ---------------------------------------------------------
    function attach() {
        // Fired by audio-player.js for both Arabic AND translation tracks.
        // We only count Arabic toward QF activity.
        document.addEventListener('verse-changed', (e) => {
            if (!e || !e.detail) return;
            const { surah, verse, type } = e.detail;
            if (type !== 'arabic') {
                // While translation plays, freeze the timer.
                stopTiming();
                return;
            }
            startTiming(surah, verse);
            startFlushTimer();
        });

        // Fired when the play queue completes naturally.
        document.addEventListener('section-ended', () => {
            stopTiming();
            stopFlushTimer();
            flush('section-ended');
        });

        // Tab/window closed or backgrounded -- flush eagerly.
        window.addEventListener('pagehide', () => { stopTiming(); flush('pagehide'); });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                stopTiming();
                flush('hidden');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }

    // ---------------------------------------------------------
    // Public introspection (handy in devtools)
    // ---------------------------------------------------------
    window.ReadingTracker = {
        flushNow:    () => flush('manual'),
        snapshot:    () => ({
            seconds:     buffer.seconds,
            ranges:      buildRanges(buffer.verses),
            lastVerse:   buffer.lastVerse,
            isLoggedIn:  isLoggedIn()
        }),
        // Diagnostic-only: try a no-op POST to verify the endpoint and
        // OAuth scope are wired up correctly.
        ping: () => postActivityDay(1, ['1:1-1:1'])
    };
})();
