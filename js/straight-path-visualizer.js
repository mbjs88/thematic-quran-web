/* ============================================================
 *  Straight Path Visualizer  ·  Sirat al-Mustaqim
 *  ------------------------------------------------------------
 *  Renders the user's 28-day engagement with the Qur'an as a
 *  celestial trajectory orbiting the central Straight Path.
 *
 *  Theological model
 *  -----------------
 *    · The vertical centre line is the Straight Path.
 *    · Each missed day causes a small drift away (penalty).
 *    · Each engaged day exerts a strong gravitational pull
 *      back toward the centre (10x the drift -- a 10:1 reward
 *      to penalty ratio, mirroring the hadith on multiplied
 *      reward for good deeds).
 *    · After every clean return to centre, polarity flips so
 *      subsequent drifts alternate sides -- a balanced organic
 *      weave over time rather than a one-sided drift.
 *
 *  Data source
 *  -----------
 *    GET /api/qf/auth/v1/activity-days?from=...&to=...&type=QURAN
 *    -> { data: [{ date: 'YYYY-MM-DD', seconds: <int> }, ...] }
 *
 *  This module replaces the original window.initSiratVisualizer
 *  / calculateDeviations / generateSiratPathString implementation.
 *  It must load AFTER app.js so its window.* assignments win.
 * ============================================================ */

(function () {
    'use strict';

    // ---------------------------------------------------------
    // 1. Tunable constants -- all in normalised units [-1, 1]
    // ---------------------------------------------------------
    const DRIFT  = 0.10;   // penalty per missed day
    const REWARD = 1.00;   // pull toward centre per engaged day (10x DRIFT)
    const MIN_DEV = -1.0;
    const MAX_DEV =  1.0;
    const INITIAL_POLARITY = +1; // first drift goes to the right

    // SVG canvas geometry (mirrors viewBox="-150 0 300 400" in index.html)
    const SVG_X_HALF       = 130; // visual half-width; 20px margin from viewBox edge
    const PAD_TOP          = 35;  // y-coordinate of TODAY (top of trail)
    const PAD_BOT          = 340; // y-coordinate of OLDEST observable day
    const TOTAL_DAYS       = 28;
    const Y_STEP           = (PAD_BOT - PAD_TOP) / (TOTAL_DAYS - 1);

    // Path smoothing tension (Francois Romain method)
    //   0    -> straight polyline
    //   0.22 -> the soft, swooping celestial feel we want
    //   0.3+ -> starts to overshoot
    const SMOOTHING = 0.22;

    // ---------------------------------------------------------
    // 2. Helpers
    // ---------------------------------------------------------
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    const getLocalYMD = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // ---------------------------------------------------------
    // 3. Trajectory engine
    //    Pure function: 28 days in chronological order ->
    //                   28 deviations in [-1, 1].
    //    The returned array is reversed so index 0 is TODAY
    //    (top of canvas), matching the existing renderer.
    // ---------------------------------------------------------
    function calculateDeviations(daysArray) {
        let x = 0;
        let polarity = INITIAL_POLARITY;
        const points  = [];
        const trace   = [];

        daysArray.forEach((day, i) => {
            const listened = !!(day && day.seconds > 0);
            let nextX;
            let event = '';

            if (listened) {
                // Pull toward 0 by REWARD; never overshoot.
                if      (x > 0) nextX = Math.max(0, x - REWARD);
                else if (x < 0) nextX = Math.min(0, x + REWARD);
                else            nextX = 0;

                // Polarity flips ONLY on a clean return to centre,
                // so the next drift cycle uses the opposite side.
                if (x !== 0 && nextX === 0) {
                    polarity = -polarity;
                    event = 'returned + flipped';
                } else if (nextX === 0) {
                    event = 'rest at centre';
                } else {
                    event = 'pulled toward centre';
                }
            } else {
                nextX = clamp(x + polarity * DRIFT, MIN_DEV, MAX_DEV);
                event = (Math.abs(nextX) >= MAX_DEV) ? 'drifted (clamped)' : 'drifted';
            }

            trace.push({
                day:      i,
                date:     day && day.date || '',
                listened: listened ? '\u2713' : '\u00B7',
                seconds:  day && day.seconds || 0,
                fromX:    x.toFixed(2),
                toX:      nextX.toFixed(2),
                polarity: polarity > 0 ? '+1' : '-1',
                event
            });

            points.push(nextX);
            x = nextX;
        });

        if (window.console && console.groupCollapsed) {
            console.groupCollapsed('%c[Sirat] Trajectory model', 'color:#88FFD1;font-weight:bold;');
            console.table(trace);
            console.groupEnd();
        }

        // Reverse so index 0 = today, index N-1 = oldest.
        return points.reverse();
    }

    // ---------------------------------------------------------
    // 4. Path renderer (Francois Romain smoothed cubic Bezier)
    // ---------------------------------------------------------
    function devsToPoints(deviations) {
        const activeCount = deviations.length;
        const startY = PAD_BOT - ((activeCount - 1) * Y_STEP);
        return deviations.map((dev, i) => ({
            x: dev * SVG_X_HALF,
            y: startY + i * Y_STEP
        }));
    }

    function bezierPath(points) {
        if (!points || points.length === 0) return '';
        if (points.length === 1) {
            const p = points[0];
            return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} l 0 0.01`;
        }

        const line = (a, b) => ({
            length: Math.hypot(b.x - a.x, b.y - a.y),
            angle:  Math.atan2(b.y - a.y, b.x - a.x)
        });

        const controlPoint = (current, prev, next, reverse) => {
            const p = prev || current;
            const n = next || current;
            const o = line(p, n);
            const angle  = o.angle + (reverse ? Math.PI : 0);
            const length = o.length * SMOOTHING;
            return {
                x: current.x + Math.cos(angle) * length,
                y: current.y + Math.sin(angle) * length
            };
        };

        let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
        for (let i = 1; i < points.length; i++) {
            const cps = controlPoint(points[i - 1], points[i - 2], points[i],     false);
            const cpe = controlPoint(points[i],     points[i - 1], points[i + 1], true);
            d += ` C ${cps.x.toFixed(2)} ${cps.y.toFixed(2)}, ` +
                 `${cpe.x.toFixed(2)} ${cpe.y.toFixed(2)}, ` +
                 `${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
        }
        return d;
    }

    function generateSiratPathString(deviations /*, totalRangeNodes */) {
        if (!deviations || deviations.length === 0) return '';
        return bezierPath(devsToPoints(deviations));
    }

    // ---------------------------------------------------------
    // 5. Quran-Foundation API fetch
    //    /v1/activity-days has a `first` page-size cap, so we
    //    split the 28-day window into two halves and parallelise.
    // ---------------------------------------------------------
    async function fetchActivityDays(daysBack /* default 28 */) {
        const today  = new Date();
        const splitAt = Math.floor(daysBack / 2);

        const aTo   = getLocalYMD(today);
        const aFrom = getLocalYMD(new Date(today.getTime() - (splitAt - 1) * 86400000));
        const bTo   = getLocalYMD(new Date(today.getTime() - splitAt * 86400000));
        const bFrom = getLocalYMD(new Date(today.getTime() - (daysBack - 1) * 86400000));

        const url = (from, to) =>
            `/api/qf/auth/v1/activity-days?from=${from}&to=${to}&type=QURAN&first=20`;

        try {
            const [r1, r2] = await Promise.all([fetch(url(aFrom, aTo)), fetch(url(bFrom, bTo))]);
            const j1 = await r1.json();
            const j2 = await r2.json();
            const out = {};
            const merge = (arr) => {
                if (!Array.isArray(arr)) return;
                arr.forEach(d => { if (d && d.date) out[d.date] = d.seconds || 0; });
            };
            merge(j1.data);
            merge(j2.data);
            return out;
        } catch (e) {
            console.warn('[Sirat] activity-days fetch failed', e);
            return {};
        }
    }

    // ---------------------------------------------------------
    // 6. Hijri month dividers (cosmetic; preserved from prior UX)
    // ---------------------------------------------------------
    function renderHijriDividers(activeDays, deviations) {
        const monthGroup = document.getElementById('islamicMonthLines');
        if (!monthGroup) return;
        monthGroup.innerHTML = '';
        if (!deviations.length) return;

        let fmtTag, fmtShort;
        try {
            fmtTag   = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { month: 'numeric', year: 'numeric' });
            fmtShort = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { month: 'short' });
        } catch (e) { return; }

        const activeNodes = deviations.length;
        const startY = PAD_BOT - ((activeNodes - 1) * Y_STEP);
        let prevTag = null;

        activeDays.forEach((dayObj, offsetI) => {
            const i = (activeNodes - 1) - offsetI;
            const dObj = new Date(dayObj.date);
            const tag  = fmtTag.format(dObj);
            if (prevTag !== null && tag !== prevTag) {
                const y = startY + (i * Y_STEP);
                const name = fmtShort.format(dObj);
                monthGroup.innerHTML +=
                    `<line x1="-150" y1="${y}" x2="150" y2="${y}" stroke="#56A3A6" stroke-width="0.3" stroke-dasharray="2,2" class="opacity-40" />` +
                    `<text x="-148" y="${y - 2}" fill="#56A3A6" font-size="2.5" class="opacity-50 font-['Forum'] uppercase tracking-widest">${name}</text>`;
            }
            prevTag = tag;
        });
    }

    // ---------------------------------------------------------
    // 7. State -> badge / orb / styling
    // ---------------------------------------------------------
    function renderStateOverlay(daysArray, deviations) {
        const svgPath         = document.getElementById('siratPath');
        const orbEl           = document.getElementById('siratOrb');
        const cleanSlateOrb   = document.getElementById('siratCleanSlateOrb');
        const badgeText       = document.getElementById('siratBadgeText');
        const explanation     = document.getElementById('siratExplanationText');
        const topAxisLabel    = document.getElementById('timelineAxisTop');
        const bottomAxisLabel = document.getElementById('timelineAxisBottom');

        const isCleanSlate    = deviations.length === 0;
        const last7           = daysArray.slice(-7);
        const lastDay         = daysArray[daysArray.length - 1];
        const isDisconnected  = last7.every(d => !d || d.seconds <= 0);

        const currentDeviation = deviations.length > 0 ? Math.abs(deviations[0]) : 0;
        const daysToCenter = Math.ceil(currentDeviation / REWARD);
        const plural = n => n === 1 ? 'day' : 'days';

        if (isCleanSlate) {
            if (svgPath) svgPath.style.opacity = '0';
            if (cleanSlateOrb) { cleanSlateOrb.classList.remove('hidden'); cleanSlateOrb.classList.add('flex'); }
            if (orbEl) orbEl.classList.add('hidden');
            if (topAxisLabel)    topAxisLabel.style.opacity    = '0';
            if (bottomAxisLabel) bottomAxisLabel.style.opacity = '0';
            if (badgeText)   badgeText.textContent   = 'Begin reading to start your path';
            if (explanation) explanation.textContent =
                'The centre line is the Straight Path. Begin reading and your trail will appear here.';
            return;
        }

        if (svgPath) svgPath.style.opacity = '1';
        if (cleanSlateOrb) { cleanSlateOrb.classList.add('hidden'); cleanSlateOrb.classList.remove('flex'); }

        if (isDisconnected) {
            if (svgPath) {
                svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                svgPath.setAttribute('stroke-opacity', '0.3');
                svgPath.setAttribute('stroke-dasharray', '3,6');
            }
            if (badgeText) badgeText.textContent = daysToCenter > 0
                ? `${daysToCenter} ${plural(daysToCenter)} of consistent reading will return you to the straight path`
                : 'Begin reading again to return to the straight path';
        } else if (lastDay && lastDay.seconds > 0) {
            if (svgPath) {
                svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                svgPath.removeAttribute('stroke-opacity');
                svgPath.removeAttribute('stroke-dasharray');
            }
            if (badgeText) badgeText.textContent = daysToCenter > 0
                ? `${daysToCenter} more ${plural(daysToCenter)} of reading returns you to the straight path`
                : 'You are on the straight path \u00B7 Keep reading daily';
        } else {
            if (svgPath) {
                svgPath.setAttribute('stroke', 'url(#siratTrailGradient)');
                svgPath.setAttribute('stroke-opacity', '0.65');
                svgPath.removeAttribute('stroke-dasharray');
            }
            if (badgeText) badgeText.textContent = daysToCenter > 0
                ? `Read daily for ${daysToCenter} more ${plural(daysToCenter)} to return to the straight path`
                : 'Read today to return to the straight path';
        }

        if (explanation) explanation.textContent =
            'The centre line is the Straight Path. Daily reading keeps you close; missed days cause you to drift. The orb marks where you are today.';

        if (orbEl) {
            const orbY = PAD_BOT - ((deviations.length - 1) * Y_STEP);
            const orbX = deviations[0] * SVG_X_HALF;
            const leftPct = ((orbX + 150) / 300 * 100).toFixed(2);
            orbEl.style.left = `${leftPct}%`;
            orbEl.style.top  = `${orbY}px`;
            orbEl.classList.remove('hidden');

            if (topAxisLabel) {
                topAxisLabel.style.top = `${Math.max(8, orbY - 8)}px`;
                if (orbX >= 0) {
                    topAxisLabel.style.left = '8px';
                    topAxisLabel.style.removeProperty('right');
                } else {
                    topAxisLabel.style.right = '8px';
                    topAxisLabel.style.removeProperty('left');
                }
                topAxisLabel.style.opacity = '1';
            }
        }

        if (bottomAxisLabel) {
            bottomAxisLabel.style.opacity = (deviations.length < TOTAL_DAYS) ? '0' : '1';
        }
    }

    // ---------------------------------------------------------
    // 8. Public entry point
    // ---------------------------------------------------------
    async function initSiratVisualizer(forceOpen = false, mockDays = 0) {
        const container = document.getElementById('siratContainer');
        const svgPath   = document.getElementById('siratPath');
        const loader    = document.getElementById('siratLoading');
        const btn       = document.getElementById('myPathBtn');
        if (!container || !svgPath) return;

        const isOpen = container.style.maxHeight && container.style.maxHeight !== '0px';
        if (isOpen && !forceOpen) {
            container.style.maxHeight = '0px';
            container.style.opacity   = '0';
            container.style.marginTop = '0px';
            if (btn) btn.classList.remove('ring-2', 'ring-white/50');
            return;
        }

        container.style.maxHeight = '520px';
        container.style.opacity   = '1';
        container.style.marginTop = '16px';
        if (loader) loader.classList.remove('hidden');
        if (btn)    btn.classList.add('ring-2', 'ring-white/50');

        try {
            const apiMap = (mockDays === 0) ? await fetchActivityDays(TOTAL_DAYS) : {};

            const daysArray = [];
            for (let i = 0; i < TOTAL_DAYS; i++) {
                const dt = new Date();
                dt.setDate(dt.getDate() - (TOTAL_DAYS - 1 - i));
                const dtStr = getLocalYMD(dt);
                let secs = apiMap[dtStr] || 0;

                if (mockDays > 0) {
                    const histOffset = TOTAL_DAYS - 1 - i;
                    secs = (histOffset < mockDays) ? 300 : 0;
                    if (secs > 0 && Math.random() < 0.25) secs = 0;
                }

                daysArray.push({ date: dtStr, seconds: secs });
            }

            const genesisIdx = daysArray.findIndex(d => d.seconds > 0);
            const activeDays = (genesisIdx === -1) ? [] : daysArray.slice(genesisIdx);

            const deviations = (activeDays.length > 0) ? calculateDeviations(activeDays) : [];
            const pathStr    = (deviations.length > 0) ? generateSiratPathString(deviations) : '';
            if (pathStr) svgPath.setAttribute('d', pathStr);

            renderHijriDividers(activeDays, deviations);
            renderStateOverlay(daysArray, deviations);

        } catch (e) {
            console.error('[Sirat] init error', e);
        } finally {
            if (loader) loader.classList.add('hidden');
        }
    }

    // ---------------------------------------------------------
    // 9. Devtools test harnesses
    // ---------------------------------------------------------
    function simulateUserJourney(activeDays = 14) {
        console.log(`%c[Sirat] Simulating ${activeDays} active days`, 'color:#FF88AA;font-weight:bold;');
        initSiratVisualizer(true, activeDays);
    }

    // window.simulatePathPattern([true,false,true,...]) -- exact control for QA
    function simulatePathPattern(boolArray) {
        const arr = boolArray.slice(-TOTAL_DAYS);
        const today = new Date();
        const padCount = TOTAL_DAYS - arr.length;
        const full = [];
        for (let i = 0; i < padCount; i++) {
            const dt = new Date(today.getTime() - ((TOTAL_DAYS - 1 - i)) * 86400000);
            full.push({ date: getLocalYMD(dt), seconds: 0 });
        }
        for (let i = 0; i < arr.length; i++) {
            const dt = new Date(today.getTime() - ((arr.length - 1 - i)) * 86400000);
            full.push({ date: getLocalYMD(dt), seconds: arr[i] ? 300 : 0 });
        }

        const container = document.getElementById('siratContainer');
        const svgPath   = document.getElementById('siratPath');
        if (container) {
            container.style.maxHeight = '520px';
            container.style.opacity   = '1';
            container.style.marginTop = '16px';
        }
        const genesis = full.findIndex(d => d.seconds > 0);
        const activeDays = (genesis === -1) ? [] : full.slice(genesis);
        const devs = activeDays.length ? calculateDeviations(activeDays) : [];
        const path = devs.length ? generateSiratPathString(devs) : '';
        if (svgPath && path) svgPath.setAttribute('d', path);
        renderHijriDividers(activeDays, devs);
        renderStateOverlay(full, devs);
    }

    // ---------------------------------------------------------
    // 10. Publish (overrides any earlier definitions on window)
    // ---------------------------------------------------------
    window.calculateDeviations     = calculateDeviations;
    window.generateSiratPathString = generateSiratPathString;
    window.initSiratVisualizer     = initSiratVisualizer;
    window.simulateUserJourney     = simulateUserJourney;
    window.simulatePathPattern     = simulatePathPattern;
})();
