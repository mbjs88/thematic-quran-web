/**
 * Straight Path Visualizer  ·  Sirat al-Mustaqim
 * ------------------------------------------------
 * Renders a 28-day journey of the user's engagement with the Quran as a
 * celestial-orbit curve around a vertical center line.
 *
 *   Center line  →  the Straight Path
 *   Drift        →  days without engagement push the orb away from center
 *   Return       →  any day with engagement pulls the orb back, 10× stronger
 *   Polarity     →  flips on each clean return so the next drift is on the
 *                    opposite side, weaving an organic, balanced shape
 *
 * The 10:1 ratio is enforced exactly:
 *     DRIFT  = 0.10  (penalty per missed day, in normalized units)
 *     REWARD = 1.00  (pull toward 0 per active day)
 *
 * The curve is rendered with a François Romain–style smoothed Bézier (a
 * tension-controlled cousin of centripetal Catmull-Rom). It is short, fast,
 * and produces the swooping celestial feel without the cusps that strict
 * monotonic curves create.
 *
 * Public API (kept on window for drop-in compatibility with the previous
 * inline implementation):
 *   window.calculateDeviations(daysArray)            → number[]   (today first)
 *   window.generateSiratPathString(deviations, n)    → string     (SVG path "d")
 *   window.initSiratVisualizer(forceOpen, mockDays)  → Promise<void>
 *   window.simulateUserJourney(activeDays)           → void
 *   window.simulatePathPattern(boolArray)            → void  (debug helper)
 *
 * SVG geometry contract (do not change without updating index.html):
 *   viewBox             "-150 0 300 400"   preserveAspectRatio="none"
 *   PAD_TOP / PAD_BOT   35 (today)         340 (28 days ago)
 *   X half-range        130                (deviation = ±1.0 → x = ±130)
 */
(function () {
    'use strict';

    // ---------------------------------------------------------------------
    // Geometry & math constants
    // ---------------------------------------------------------------------
    const TOTAL_DAYS    = 28;
    const PAD_TOP       = 35;
    const PAD_BOT       = 340;
    const Y_STEP        = (PAD_BOT - PAD_TOP) / (TOTAL_DAYS - 1);
    const X_HALF_RANGE  = 130;          // viewBox x clamp; viewBox half-width = 150

    const DRIFT         = 0.10;         // penalty per missed day  (10× weaker)
    const REWARD        = 1.00;         // pull per listened day   (10× stronger)
    const MIN_DEV       = -1.0;
    const MAX_DEV       =  1.0;
    const SMOOTHING     = 0.20;         // 0.15–0.25 looks best; higher = swoopier
    const INITIAL_POLARITY = 1;         // first drift goes right; flips on each return

    const getLocalYMD = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // ---------------------------------------------------------------------
    // Deviation engine
    // ---------------------------------------------------------------------
    /**
     * Walk forward through days (oldest → newest) applying the 10:1 reward
     * model with polarity flipping. Returns an array of deviations in
     * **today-first** order (index 0 = today) so the renderer can map index
     * directly onto Y from PAD_TOP downward.
     *
     * Each entry in `daysArray` is { date: 'YYYY-MM-DD', seconds: number }.
     */
    function calculateDeviations(daysArray) {
        if (!daysArray || daysArray.length === 0) return [];

        let x = 0;
        let polarity = INITIAL_POLARITY;
        const out = [];
        const trace = [];

        for (let i = 0; i < daysArray.length; i++) {
            const day = daysArray[i];
            const listened = day.seconds > 0;
            const prevX = x;
            let event = '·';

            if (listened) {
                if (x === 0) {
                    // Already centered → stay centered, no flip.
                    event = 'hold';
                } else if (x > 0) {
                    x = Math.max(0, x - REWARD);
                    event = 'pull←';
                } else {
                    x = Math.min(0, x + REWARD);
                    event = 'pull→';
                }
                // Polarity flips ONLY when we cleanly cross back to exact 0.
                if (prevX !== 0 && x === 0) {
                    polarity = -polarity;
                    event += ' ⟲flip';
                }
            } else {
                x = clamp(x + polarity * DRIFT, MIN_DEV, MAX_DEV);
                event = polarity > 0 ? 'drift→' : 'drift←';
            }

            out.push(x);
            trace.push({
                day: day.date,
                listened: listened ? '✓' : '✗',
                seconds: day.seconds,
                prev: prevX.toFixed(2),
                next: x.toFixed(2),
                polarity,
                event
            });
        }

        // eslint-disable-next-line no-console
        console.groupCollapsed('%c[Sirat] deviation trace (oldest → newest)', 'color:#88FFD1;font-weight:bold;');
        console.table(trace);
        console.groupEnd();

        // Flip so today is at index 0 (matches SVG Y orientation).
        out.reverse();
        return out;
    }

    // ---------------------------------------------------------------------
    // Path generation  ·  smoothed cubic Bezier ("François Romain" style)
    // ---------------------------------------------------------------------
    /**
     * Convert a list of deviations (today-first, normalized [-1, +1]) into an
     * SVG cubic-Bezier path string. Anchors today at PAD_TOP; if there are
     * fewer than TOTAL_DAYS active days, the curve grows up from the bottom.
     */
    function generateSiratPathString(deviations) {
        if (!deviations || deviations.length === 0) return '';

        const n = deviations.length;
        // startY = y-coordinate of the FIRST point we draw (= today, at top of canvas).
        // When n < TOTAL_DAYS the curve floats so its bottom touches PAD_BOT.
        const startY = PAD_BOT - (n - 1) * Y_STEP;

        // deviations is today-first → pts[0] = today at the top of the canvas,
        // pts[n-1] = oldest at PAD_BOT (bottom). The stroke gradient is defined
        // in user-space so the rendering direction doesn't change appearance.
        const pts = [];
        for (let i = 0; i < n; i++) {
            pts.push({
                x: deviations[i] * X_HALF_RANGE,
                y: startY + i * Y_STEP
            });
        }

        if (pts.length === 1) return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;

        // Smoothed cubic Bezier: each segment uses neighbours to estimate tangents.
        const line = (a, b) => ({
            length: Math.hypot(b.x - a.x, b.y - a.y),
            angle:  Math.atan2(b.y - a.y, b.x - a.x)
        });
        const ctrl = (curr, prev, next, reverse) => {
            const p = prev || curr;
            const q = next || curr;
            const o = line(p, q);
            const angle  = o.angle + (reverse ? Math.PI : 0);
            const length = o.length * SMOOTHING;
            return { x: curr.x + Math.cos(angle) * length, y: curr.y + Math.sin(angle) * length };
        };

        let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
        for (let i = 1; i < pts.length; i++) {
            const start = ctrl(pts[i - 1], pts[i - 2], pts[i],   false);
            const end   = ctrl(pts[i],     pts[i - 1], pts[i + 1], true);
            d += ` C ${start.x.toFixed(2)} ${start.y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}, ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
        }
        return d;
    }

    // ---------------------------------------------------------------------
    // Data fetch  ·  Quran Foundation /activity-days
    // ---------------------------------------------------------------------
    /**
     * The QF activity-days API caps `to - from` at ~20 days, so we make two
     * range calls in parallel and merge them. Returns `{ date → seconds }`.
     */
    async function fetchActivitySecondsByDate() {
        const today = new Date();
        const split = new Date(); split.setDate(split.getDate() - 19);
        const splitB = new Date(); splitB.setDate(splitB.getDate() - 20);
        const past = new Date(); past.setDate(past.getDate() - 27);

        const url = (from, to) =>
            `/api/qf/auth/v1/activity-days?from=${from}&to=${to}&type=QURAN&first=20`;

        const responses = await Promise.all([
            fetch(url(getLocalYMD(split), getLocalYMD(today))),
            fetch(url(getLocalYMD(past),  getLocalYMD(splitB)))
        ]);

        const map = {};
        for (const r of responses) {
            if (!r.ok) {
                console.warn(`[Sirat] activity-days fetch failed: ${r.status}`);
                continue;
            }
            const json = await r.json().catch(() => ({}));
            const arr  = Array.isArray(json.data) ? json.data : [];
            for (const item of arr) {
                if (item && item.date) map[item.date] = item.seconds || 0;
            }
        }
        return map;
    }

    // ---------------------------------------------------------------------
    // Streak (optional embellishment) — soft-failing
    // ---------------------------------------------------------------------
    async function fetchCurrentStreakDays() {
        try {
            const r = await fetch('/api/qf/auth/v1/streaks/current?type=QURAN');
            if (!r.ok) return 0;
            const json = await r.json();
            // Tolerate a few common shapes the API might return.
            if (typeof json.days === 'number') return json.days;
            if (json.data && typeof json.data.days === 'number') return json.data.days;
            if (Array.isArray(json.data)) return json.data.length;
            return 0;
        } catch (_) {
            return 0;
        }
    }

    // ---------------------------------------------------------------------
    // 28-day window assembly
    // ---------------------------------------------------------------------
    function buildDaysArray(secondsByDate, mockDays) {
        const days = [];
        for (let i = 0; i < TOTAL_DAYS; i++) {
            const dt = new Date();
            dt.setDate(dt.getDate() - (TOTAL_DAYS - 1 - i));
            const ymd = getLocalYMD(dt);
            let seconds = secondsByDate[ymd] || 0;

            // Mock mode: simulate an "activeDays" trailing streak with sporadic misses.
            if (mockDays > 0) {
                const offsetFromToday = (TOTAL_DAYS - 1) - i;
                seconds = (offsetFromToday < mockDays) ? 300 : 0;
                if (seconds > 0 && Math.random() < 0.25) seconds = 0;
            }
            days.push({ date: ymd, seconds });
        }
        return days;
    }

    // ---------------------------------------------------------------------
    // Hijri month divider lines
    // ---------------------------------------------------------------------
    function renderHijriMonthLines(activeDaysArray, deviationsTodayFirst) {
        const monthGroup = document.getElementById('islamicMonthLines');
        if (!monthGroup) return;
        monthGroup.innerHTML = '';
        if (activeDaysArray.length === 0) return;

        const fmtMonthYear = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
            month: 'numeric', year: 'numeric'
        });
        const fmtMonthShort = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
            month: 'short'
        });

        const n = deviationsTodayFirst.length;
        const startY = PAD_BOT - (n - 1) * Y_STEP;
        let prevTag = null;

        // activeDaysArray is chronological (oldest → newest).
        activeDaysArray.forEach((dayObj, offsetI) => {
            const renderIndex = (n - 1) - offsetI; // 0 = bottom (oldest)
            const dObj = new Date(dayObj.date);
            const tag  = fmtMonthYear.format(dObj);
            if (prevTag !== null && tag !== prevTag) {
                const y = startY + renderIndex * Y_STEP;
                const monthName = fmtMonthShort.format(dObj);
                monthGroup.insertAdjacentHTML('beforeend',
                    `<line x1="-150" y1="${y}" x2="150" y2="${y}" stroke="#56A3A6" stroke-width="0.3" stroke-dasharray="2,2" class="opacity-40 drop-shadow-[0_0_2px_rgba(86,163,166,0.3)]" />` +
                    `<text x="-148" y="${y - 2}" fill="#56A3A6" font-size="2.5" class="opacity-50 font-['Forum'] uppercase tracking-widest">${monthName}</text>`
                );
            }
            prevTag = tag;
        });
    }

    // ---------------------------------------------------------------------
    // Main entry: open the panel + render
    // ---------------------------------------------------------------------
    async function initSiratVisualizer(forceOpen = false, mockDays = 0) {
        const container = document.getElementById('siratContainer');
        const svgPath   = document.getElementById('siratPath');
        const loader    = document.getElementById('siratLoading');
        const btn       = document.getElementById('myPathBtn');
        if (!container || !svgPath) return;

        const isOpen = container.style.maxHeight && container.style.maxHeight !== '0px';

        if (!(isOpen) || forceOpen) {
            container.style.maxHeight = '520px';
            container.style.opacity   = '1';
            container.style.marginTop = '16px';
            if (loader) loader.classList.remove('hidden');
            if (btn) btn.classList.add('ring-2', 'ring-white/50');

            try {
                const secondsByDate = (mockDays === 0)
                    ? await fetchActivitySecondsByDate()
                    : {};
                const daysArray = buildDaysArray(secondsByDate, mockDays);

                const genesisIndex = daysArray.findIndex(d => d.seconds > 0);
                const isCleanSlate = genesisIndex === -1;

                console.groupCollapsed('%c[Sirat] 28-day window', 'color:#56A3A6;font-weight:bold;');
                console.table(daysArray.map(d => ({
                    date: d.date,
                    seconds: d.seconds,
                    read: d.seconds > 0 ? '✓' : '·'
                })));
                console.log(`Genesis day index: ${isCleanSlate ? 'none' : genesisIndex} | Raw API entries: ${Object.keys(secondsByDate).length}`);
                console.groupEnd();

                const activeDaysArray = isCleanSlate ? [] : daysArray.slice(genesisIndex);
                const deviations = activeDaysArray.length > 0
                    ? calculateDeviations(activeDaysArray)
                    : [];
                const pathString = generateSiratPathString(deviations);
                if (pathString) svgPath.setAttribute('d', pathString);

                renderHijriMonthLines(activeDaysArray, deviations);

                // ---------- Status badge & orb placement --------------------
                const last7 = daysArray.slice(-7);
                const last7Active = last7.filter(d => d.seconds > 0).length;
                const today = daysArray[daysArray.length - 1];
                const isDisconnected = last7Active === 0;

                const badgeText  = document.getElementById('siratBadgeText');
                const cleanOrb   = document.getElementById('siratCleanSlateOrb');
                const explainTxt = document.getElementById('siratExplanationText');
                const orbEl      = document.getElementById('siratOrb');
                const topAxis    = document.getElementById('timelineAxisTop');
                const bottomAxis = document.getElementById('timelineAxisBottom');

                // Days of consistent reading needed to reach center, given current deviation.
                const currentDev = deviations.length > 0 ? Math.abs(deviations[0]) : 0;
                const daysToCenter = Math.ceil(currentDev / REWARD);  // 1.0 unit per active day → almost always 1
                const plural = (n) => (n === 1 ? 'day' : 'days');

                if (isCleanSlate) {
                    svgPath.style.opacity = '0';
                    if (cleanOrb) { cleanOrb.classList.remove('hidden'); cleanOrb.classList.add('flex'); }
                    if (orbEl) orbEl.classList.add('hidden');
                    if (topAxis)    topAxis.style.opacity = '0';
                    if (bottomAxis) bottomAxis.style.opacity = '0';
                    if (badgeText) {
                        badgeText.innerText = 'Begin reading to start your path';
                        badgeText.className = "text-[#F3E4CE]/70 text-[11px] font-bold font-['Forum'] tracking-wider text-center mt-3 px-2 min-h-[1.4em] transition-colors duration-500";
                    }
                } else {
                    svgPath.style.opacity = '1';
                    if (cleanOrb) { cleanOrb.classList.add('hidden'); cleanOrb.classList.remove('flex'); }

                    if (isDisconnected) {
                        svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                        svgPath.setAttribute('stroke-opacity', '0.3');
                        svgPath.setAttribute('stroke-dasharray', '3,6');
                        if (badgeText) {
                            badgeText.innerText = daysToCenter > 0
                                ? `One day of reading returns you to the straight path`
                                : 'Begin reading again to return to the straight path';
                            badgeText.className = "text-[#8FA8A8] text-[11px] font-bold font-['Forum'] tracking-wider text-center mt-3 px-2 min-h-[1.4em] transition-colors duration-500";
                        }
                    } else if (today.seconds > 0) {
                        svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                        svgPath.removeAttribute('stroke-opacity');
                        svgPath.removeAttribute('stroke-dasharray');
                        if (badgeText) {
                            badgeText.innerText = currentDev === 0
                                ? 'You are on the straight path · Keep reading daily'
                                : `One more day returns you to the straight path`;
                            badgeText.className = "text-[#8FB9AA] text-[11px] font-bold font-['Forum'] tracking-wider text-center mt-3 px-2 min-h-[1.4em] transition-colors duration-500";
                        }
                    } else {
                        svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                        svgPath.setAttribute('stroke-opacity', '0.65');
                        svgPath.removeAttribute('stroke-dasharray');
                        if (badgeText) {
                            badgeText.innerText = 'Read today to return to the straight path';
                            badgeText.className = "text-[#D8C3A5] text-[11px] font-bold font-['Forum'] tracking-wider text-center mt-3 px-2 min-h-[1.4em] transition-colors duration-500";
                        }
                    }
                    if (explainTxt) {
                        explainTxt.className = "text-white/30 text-[10px] leading-relaxed mt-1.5 font-['Nunito'] tracking-wide text-center px-2 w-full transition-colors duration-500";
                    }

                    // Position the HTML orb on TODAY (top-of-curve point).
                    if (orbEl && deviations.length > 0) {
                        const orbY  = PAD_BOT - (deviations.length - 1) * Y_STEP;
                        const orbX  = deviations[0] * X_HALF_RANGE;       // signed SVG x
                        const leftPct = ((orbX + 150) / 300 * 100).toFixed(2);
                        orbEl.style.left = `${leftPct}%`;
                        orbEl.style.top  = `${orbY}px`;
                        orbEl.classList.remove('hidden');

                        if (topAxis) {
                            topAxis.style.top = `${Math.max(8, orbY - 8)}px`;
                            if (orbX >= 0) {
                                topAxis.style.left = '8px';
                                topAxis.style.removeProperty('right');
                            } else {
                                topAxis.style.right = '8px';
                                topAxis.style.removeProperty('left');
                            }
                            topAxis.style.opacity = '1';
                        }
                    }
                    if (bottomAxis) bottomAxis.style.opacity = (activeDaysArray.length < TOTAL_DAYS) ? '0' : '1';
                }

                // Optional: pull streak as decorative info; failure is silent.
                fetchCurrentStreakDays().then(streak => {
                    if (streak > 0) console.log(`%c[Sirat] current streak: ${streak} days`, 'color:#88FFD1;');
                });

            } catch (err) {
                console.error('[Sirat] render failed:', err);
            } finally {
                if (loader) loader.classList.add('hidden');
            }
        } else {
            // Toggle closed
            container.style.maxHeight = '0px';
            container.style.opacity   = '0';
            container.style.marginTop = '0px';
            if (btn) btn.classList.remove('ring-2', 'ring-white/50');
        }
    }

    // ---------------------------------------------------------------------
    // Debug helpers
    // ---------------------------------------------------------------------
    function simulateUserJourney(activeDays = 14) {
        console.log(`%c[Sirat] mocking ${activeDays} listened days (with sporadic misses)`,
            'color:#FF88AA;font-weight:bold;');
        return initSiratVisualizer(true, activeDays);
    }

    /**
     * Drive the visualizer with an explicit boolean array (length 28; index 0
     * = oldest, last = today). Useful for reproducing exact patterns.
     */
    function simulatePathPattern(boolArray) {
        if (!Array.isArray(boolArray) || boolArray.length !== TOTAL_DAYS) {
            console.warn(`[Sirat] simulatePathPattern expects exactly ${TOTAL_DAYS} booleans`);
            return;
        }
        const container = document.getElementById('siratContainer');
        if (container) {
            container.style.maxHeight = '520px';
            container.style.opacity = '1';
            container.style.marginTop = '16px';
        }
        const svgPath = document.getElementById('siratPath');
        const days = boolArray.map((b, i) => {
            const d = new Date(); d.setDate(d.getDate() - (TOTAL_DAYS - 1 - i));
            return { date: getLocalYMD(d), seconds: b ? 300 : 0 };
        });
        const genesis = days.findIndex(d => d.seconds > 0);
        const active = genesis === -1 ? [] : days.slice(genesis);
        const dev = calculateDeviations(active);
        const path = generateSiratPathString(dev);
        if (svgPath && path) svgPath.setAttribute('d', path);

        const orbEl = document.getElementById('siratOrb');
        if (orbEl && dev.length > 0) {
            const orbY = PAD_BOT - (dev.length - 1) * Y_STEP;
            const orbX = dev[0] * X_HALF_RANGE;
            orbEl.style.left = `${((orbX + 150) / 300 * 100).toFixed(2)}%`;
            orbEl.style.top  = `${orbY}px`;
            orbEl.classList.remove('hidden');
        }
        renderHijriMonthLines(active, dev);
    }

    // ---------------------------------------------------------------------
    // Expose on window — these win over any older definitions in app.js
    // because this file loads AFTER app.js.
    // ---------------------------------------------------------------------
    window.calculateDeviations      = calculateDeviations;
    window.generateSiratPathString  = generateSiratPathString;
    window.initSiratVisualizer      = initSiratVisualizer;
    window.simulateUserJourney      = simulateUserJourney;
    window.simulatePathPattern      = simulatePathPattern;
})();
