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
 *    -> { data: [{ date, secondsRead, manuallyAddedSeconds, ranges,
 *                  mushafId, pagesRead, versesRead, ... }, ...] }
 *    Total time per day = secondsRead + manuallyAddedSeconds.
 *    The visualizer normalises this into a local `seconds` key.
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
    // 3a. Trajectory engine — rich
    //    Returns { points, trace } in chronological order
    //    (index 0 = oldest active day, last = today).
    //    Each trace entry classifies the *transition into that day*
    //    so the renderer can colour segments accordingly:
    //      'drift'  — moved further from centre this day
    //      'return' — moved closer to / reached centre this day
    //      'rest'   — was already at centre and stayed
    // ---------------------------------------------------------
    function calculateTrajectory(daysArray) {
        let x = 0;
        let polarity = INITIAL_POLARITY;
        const points = [];
        const trace  = [];

        daysArray.forEach((day, i) => {
            const seconds  = day && day.seconds || 0;
            const listened = seconds > 0;
            let nextX, eventType, eventLabel;

            if (listened) {
                if      (x > 0) nextX = Math.max(0, x - REWARD);
                else if (x < 0) nextX = Math.min(0, x + REWARD);
                else            nextX = 0;

                if (x !== 0 && nextX === 0) {
                    polarity = -polarity;
                    eventType = 'return'; eventLabel = 'returned home';
                } else if (nextX === 0) {
                    eventType = 'rest';   eventLabel = 'on the straight path';
                } else {
                    eventType = 'return'; eventLabel = 'returned closer';
                }
            } else {
                nextX = clamp(x + polarity * DRIFT, MIN_DEV, MAX_DEV);
                eventType  = 'drift';
                eventLabel = 'drifted away';
            }

            points.push(nextX);
            trace.push({
                date:     day && day.date || '',
                seconds:  seconds,
                listened: listened,
                fromX:    x,
                toX:      nextX,
                eventType: eventType,
                eventLabel: eventLabel
            });
            x = nextX;
        });

        return { points: points, trace: trace };
    }

    // ---------------------------------------------------------
    // 3b. Trajectory engine — back-compat wrapper
    //    Returns 28 deviations reversed so index 0 = today.
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
        // Used by the legacy (reversed) API. deviations[0] is TODAY,
        // so it must render at the TOP of the canvas.
        const activeCount = deviations.length;
        const startY = PAD_BOT - ((activeCount - 1) * Y_STEP);
        return deviations.map((dev, i) => ({
            x: dev * SVG_X_HALF,
            y: startY + i * Y_STEP
        }));
    }

    /**
     * Chronological → canvas. deviations[0] = oldest (genesis),
     * deviations[N-1] = today. Genesis renders at the BOTTOM of the
     * canvas (PAD_BOT), today renders at the TOP (startY).
     */
    function devsToPointsChrono(deviations) {
        return deviations.map((dev, i) => ({
            x: dev * SVG_X_HALF,
            y: PAD_BOT - i * Y_STEP
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
    // 4b. Per-segment cubic Bezier (Francois Romain)
    //     Returns SVG `d` for ONE segment between two points,
    //     with control points derived from neighbours so adjacent
    //     segments share C1 continuity (visually identical to the
    //     full smoothed polyline).
    // ---------------------------------------------------------
    function buildSegmentD(prev, current, next, afterNext) {
        const line = (a, b) => ({
            length: Math.hypot(b.x - a.x, b.y - a.y),
            angle:  Math.atan2(b.y - a.y, b.x - a.x)
        });
        const cp = (cur, p, n, reverse) => {
            const a = p || cur, b = n || cur;
            const o = line(a, b);
            const angle  = o.angle + (reverse ? Math.PI : 0);
            const length = o.length * SMOOTHING;
            return { x: cur.x + Math.cos(angle) * length,
                     y: cur.y + Math.sin(angle) * length };
        };
        const cps = cp(current, prev,    next,      false);
        const cpe = cp(next,    current, afterNext, true);
        return `M ${current.x.toFixed(2)} ${current.y.toFixed(2)} ` +
               `C ${cps.x.toFixed(2)} ${cps.y.toFixed(2)}, ` +
               `${cpe.x.toFixed(2)} ${cpe.y.toFixed(2)}, ` +
               `${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
    }

    // ---------------------------------------------------------
    // 4c. Multi-segment renderer
    //     Renders one <path class="sirat-segment {drift|return|rest}">
    //     per day-to-day transition, with staggered stroke-dashoffset
    //     animation so the curve "draws itself" from genesis to today.
    // ---------------------------------------------------------
    function renderPathSegments(trajectory, daysArray) {
        const group = document.getElementById('siratPathSegments');
        if (!group) return;
        group.innerHTML = '';

        const points = devsToPointsChrono(trajectory.points); // chronological, oldest -> today
        const total  = points.length;
        if (total < 2) return;

        // We classify each segment by the eventType of its END day —
        // i.e. the segment connecting day i to day i+1 represents
        // "what happened at day i+1".
        const REVEAL_MS  = 1200;
        const PER_SEG_MS = Math.max(220, REVEAL_MS / Math.max(1, total - 1));

        for (let i = 0; i < total - 1; i++) {
            const cls   = trajectory.trace[i + 1].eventType; // drift|return|rest
            const dStr  = buildSegmentD(
                points[i - 1], points[i], points[i + 1], points[i + 2]
            );
            const seg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            seg.setAttribute('d', dStr);
            seg.setAttribute('class', `sirat-segment ${cls}`);
            group.appendChild(seg);

            // Set up dash-offset reveal. We measure on the live element.
            const len = seg.getTotalLength();
            seg.style.strokeDasharray  = len;
            seg.style.strokeDashoffset = len;
            seg.style.transitionDelay  = `${i * (REVEAL_MS / total)}ms`;
            seg.style.transitionDuration = `${PER_SEG_MS}ms`;

            // Force layout, then drop offset to 0 so the transition fires.
            // eslint-disable-next-line no-unused-expressions
            seg.getBoundingClientRect();
            seg.style.strokeDashoffset = '0';
        }
    }

    // ---------------------------------------------------------
    // 4d. Day-dots overlay
    //     HTML divs (so they stay circular under preserveAspect=none).
    //     Filled gold = engaged, hollow = missed. Each dot is clickable
    //     and triggers the inspect tooltip. Births are staggered to
    //     follow the same wavefront as the path reveal.
    // ---------------------------------------------------------
    function renderDayDots(trajectory, activeDays) {
        const dots = document.getElementById('siratDayDots');
        if (!dots) return;
        dots.innerHTML = '';

        const points = devsToPointsChrono(trajectory.points);
        const total  = points.length;
        if (!total) return;

        const REVEAL_MS = 1200;
        const STAGGER   = REVEAL_MS / total;

        points.forEach((p, i) => {
            const day   = activeDays[i];
            const tEnt  = trajectory.trace[i];
            const dot   = document.createElement('div');
            dot.className = 'sirat-day-dot ' + (tEnt.listened ? 'engaged' : 'missed');
            const leftPct = ((p.x + 150) / 300 * 100).toFixed(2);
            dot.style.left = `${leftPct}%`;
            dot.style.top  = `${p.y.toFixed(2)}px`;
            dot.style.animationDelay = `${i * STAGGER}ms`;

            dot.dataset.dayIndex = String(i);
            dot.addEventListener('click', (ev) => {
                ev.stopPropagation();
                showInspectTooltip(dot, day, tEnt);
            });
            dots.appendChild(dot);

            // Trigger the birth animation
            requestAnimationFrame(() => dot.classList.add('born'));
        });

        // Click outside dismisses tooltip
        const container = document.getElementById('siratContainer');
        if (container && !container.dataset.tooltipBound) {
            container.addEventListener('click', () => hideInspectTooltip());
            container.dataset.tooltipBound = '1';
        }
    }

    // ---------------------------------------------------------
    // 4e. Tap-to-inspect tooltip
    // ---------------------------------------------------------
    function showInspectTooltip(dotEl, day, traceEntry) {
        const tip   = document.getElementById('siratTooltip');
        const dateE = document.getElementById('siratTooltipDate');
        const stateE= document.getElementById('siratTooltipState');
        const durE  = document.getElementById('siratTooltipDuration');
        if (!tip) return;

        // Mark the active dot
        document.querySelectorAll('.sirat-day-dot.is-active').forEach(d => d.classList.remove('is-active'));
        dotEl.classList.add('is-active');

        // Date + duration text
        let dateLabel = traceEntry.date;
        try {
            const d = new Date(traceEntry.date);
            dateLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        } catch (e) { /* keep ISO */ }
        if (dateE)  dateE.textContent = dateLabel;

        // State language (deliberately plain English per Maaz's brief)
        let stateText;
        if (!traceEntry.listened) {
            stateText = 'Drifted away';
        } else if (traceEntry.eventType === 'return') {
            stateText = (traceEntry.toX === 0) ? 'Returned to the path' : 'Returned closer';
        } else {
            stateText = 'On the straight path';
        }
        if (stateE) stateE.textContent = stateText;

        // Duration
        if (durE) {
            if (traceEntry.seconds > 0) {
                const mins = Math.floor(traceEntry.seconds / 60);
                const secs = Math.round(traceEntry.seconds % 60);
                durE.textContent = mins > 0
                    ? `Listened ${mins}m ${secs}s`
                    : `Listened ${secs}s`;
            } else {
                durE.textContent = 'No listening recorded';
            }
        }

        // Position the tooltip near the dot but kept inside the canvas
        const container = document.getElementById('siratContainer');
        const cRect = container.getBoundingClientRect();
        const dRect = dotEl.getBoundingClientRect();
        const relX = (dRect.left + dRect.width / 2) - cRect.left;
        const relY = (dRect.top  + dRect.height / 2) - cRect.top;

        tip.classList.remove('hidden');
        // measure tooltip after un-hide
        requestAnimationFrame(() => {
            const tRect = tip.getBoundingClientRect();
            const tw = tRect.width, th = tRect.height;
            // prefer above-and-right; flip if it would clip the canvas
            let left = relX + 10;
            let top  = relY - th - 10;
            if (left + tw > cRect.width - 6) left = relX - tw - 10;
            if (top < 6)                     top  = relY + 14;
            tip.style.left = `${Math.max(6, left)}px`;
            tip.style.top  = `${top}px`;
            tip.classList.add('show');
        });
    }

    function hideInspectTooltip() {
        const tip = document.getElementById('siratTooltip');
        if (tip) { tip.classList.remove('show'); setTimeout(() => tip.classList.add('hidden'), 200); }
        document.querySelectorAll('.sirat-day-dot.is-active').forEach(d => d.classList.remove('is-active'));
    }

    // ---------------------------------------------------------
    // 4f. Ghost "what-if" path
    //     Pure drift from genesis with no engagement, drawn as a
    //     dotted faint trail that fades out after ~2.4s. Makes the
    //     gravitational return effect of engagement visible.
    // ---------------------------------------------------------
    function renderGhostPath(activeDays) {
        const group = document.getElementById('siratGhostPath');
        if (!group) return;
        group.innerHTML = '';
        if (!activeDays.length) return;

        const noEngagement = activeDays.map((d, i) => ({
            date: d.date,
            seconds: i === 0 ? d.seconds : 0  // keep genesis as engagement
        }));
        const ghostTraj = calculateTrajectory(noEngagement);
        const ghostPts  = devsToPointsChrono(ghostTraj.points);
        const dStr      = bezierPath(ghostPts);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', dStr);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#C76B5F');
        path.setAttribute('stroke-width', '1.4');
        path.setAttribute('stroke-dasharray', '3,4');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', '0');
        group.appendChild(path);

        group.classList.remove('show');
        // re-trigger animation
        requestAnimationFrame(() => group.classList.add('show'));
    }

    // ---------------------------------------------------------
    // 4g. Genesis marker — site logo + "First read: <date>"
    // ---------------------------------------------------------
    function renderGenesisMarker(activeDays) {
        const marker = document.getElementById('siratGenesisMarker');
        const dateEl = document.getElementById('siratGenesisDate');
        if (!marker || !dateEl) return;

        if (!activeDays.length) {
            marker.classList.add('hidden');
            return;
        }

        const genesis = activeDays[0];
        // Genesis (oldest) renders at PAD_BOT in chrono mapping; anchor the
        // marker just below that point on the centre line.
        marker.style.top  = `${PAD_BOT + 22}px`;
        marker.style.left = '50%';
        marker.classList.remove('hidden');

        try {
            const d = new Date(genesis.date);
            const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            dateEl.textContent = `First read · ${label}`;
        } catch (e) {
            dateEl.textContent = `First read · ${genesis.date}`;
        }
    }

    // ---------------------------------------------------------
    // 4h. Centre-line glow state — pulses when on path, dims when far
    // ---------------------------------------------------------
    function updateCenterLineState(currentDeviation) {
        const bar = document.getElementById('siratCenterLineBar');
        if (!bar) return;
        bar.classList.remove('is-on-path', 'is-near', 'is-far');
        const dev = Math.abs(currentDeviation || 0);
        if      (dev < 0.05) bar.classList.add('is-on-path');
        else if (dev < 0.40) bar.classList.add('is-near');
        else                 bar.classList.add('is-far');
    }

    // ---------------------------------------------------------
    // 4i. Live mini-preview inside the My Path nav button
    //     Tiny SVG (12 wide × 28 tall in viewBox units) that traces
    //     a compressed version of the user's curve, with the orb at
    //     today. Renders on page load if the user is signed in.
    // ---------------------------------------------------------
    function renderMiniPreview(activeDays, trajectory) {
        const path = document.getElementById('myPathMiniPath');
        const orb  = document.getElementById('myPathMiniOrb');
        if (!path || !orb) return;

        if (!activeDays.length || !trajectory || !trajectory.points.length) {
            path.setAttribute('d', '');
            orb.style.display = 'none';
            return;
        }

        const N = trajectory.points.length;
        // Map to mini SVG coords: x in [-5, +5], y in [28 (oldest) -> 0 (today)]
        const HX = 5, HY = 28;
        const pts = trajectory.points.map((dev, i) => ({
            x: dev * HX,
            y: HY - (i / Math.max(1, N - 1)) * HY
        }));
        // Build a smooth-ish polyline
        let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i], q = pts[i - 1];
            const cy = (p.y + q.y) / 2;
            d += ` C ${q.x.toFixed(2)} ${cy.toFixed(2)}, ${p.x.toFixed(2)} ${cy.toFixed(2)}, ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
        }
        path.setAttribute('d', d);

        // Orb sits at today (last point)
        const last = pts[pts.length - 1];
        orb.setAttribute('cx', last.x.toFixed(2));
        orb.setAttribute('cy', last.y.toFixed(2));
        orb.style.display = '';
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
            // QF returns `secondsRead` for recited time and `manuallyAddedSeconds`
            // for time the user logged by hand. We treat both as engagement.
            const merge = (arr) => {
                if (!Array.isArray(arr)) return;
                arr.forEach(d => {
                    if (!d || !d.date) return;
                    const total = (d.secondsRead || 0) + (d.manuallyAddedSeconds || 0);
                    out[d.date] = (out[d.date] || 0) + total;
                });
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

            // Rich trajectory (chronological, with per-day classification)
            const trajectory = (activeDays.length > 0) ? calculateTrajectory(activeDays) : null;

            // Reversed deviations for the legacy state-overlay code that
            // assumes index 0 = today.
            const deviations = trajectory ? trajectory.points.slice().reverse() : [];

            // Hide the legacy single-path; new renderer uses segments
            if (svgPath) svgPath.setAttribute('d', '');

            // Cosmetic Hijri dividers (uses activeDays only)
            renderHijriDividers(activeDays, deviations);

            // Badge/orb/copy + position the orb at today's deviation
            renderStateOverlay(daysArray, deviations);

            // Update centre-line glow based on today's deviation
            updateCenterLineState(deviations[0] || 0);

            // New visual layers
            if (trajectory) {
                renderPathSegments(trajectory, activeDays);
                renderDayDots(trajectory, activeDays);
                renderGhostPath(activeDays);
                renderGenesisMarker(activeDays);

                // Orb birth animation — replay each open
                const orbEl = document.getElementById('siratOrb');
                if (orbEl && !orbEl.classList.contains('hidden')) {
                    orbEl.classList.remove('born');
                    // delay until path reveal nearly completes
                    setTimeout(() => orbEl.classList.add('born'), 1100);
                }

                // Refresh the mini-preview in the nav button to match
                renderMiniPreview(activeDays, trajectory);
            } else {
                // Clean-slate: clear any prior segments/dots/ghost/marker
                ['siratPathSegments', 'siratDayDots', 'siratGhostPath'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '';
                });
                const marker = document.getElementById('siratGenesisMarker');
                if (marker) marker.classList.add('hidden');
                renderMiniPreview([], null);
            }

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
        const trajectory = activeDays.length ? calculateTrajectory(activeDays) : null;
        const devs       = trajectory ? trajectory.points.slice().reverse() : [];

        if (svgPath) svgPath.setAttribute('d', '');
        renderHijriDividers(activeDays, devs);
        renderStateOverlay(full, devs);
        updateCenterLineState(devs[0] || 0);

        if (trajectory) {
            renderPathSegments(trajectory, activeDays);
            renderDayDots(trajectory, activeDays);
            renderGhostPath(activeDays);
            renderGenesisMarker(activeDays);
            renderMiniPreview(activeDays, trajectory);
            const orbEl = document.getElementById('siratOrb');
            if (orbEl && !orbEl.classList.contains('hidden')) {
                orbEl.classList.remove('born');
                setTimeout(() => orbEl.classList.add('born'), 1100);
            }
        } else {
            ['siratPathSegments','siratDayDots','siratGhostPath'].forEach(id => {
                const el = document.getElementById(id); if (el) el.innerHTML = '';
            });
            const marker = document.getElementById('siratGenesisMarker');
            if (marker) marker.classList.add('hidden');
            renderMiniPreview([], null);
        }
    }

    // ---------------------------------------------------------
    // 9b. Autonomous mini-preview init
    //     If the user is signed in, fetch their data on DOM-ready
    //     and paint the nav button's mini-preview, so the button
    //     reflects their current state without requiring a click.
    // ---------------------------------------------------------
    async function initMiniPreview() {
        if (!isUserLoggedIn()) return;
        try {
            const apiMap = await fetchActivityDays(TOTAL_DAYS);
            const full = [];
            for (let i = 0; i < TOTAL_DAYS; i++) {
                const dt = new Date(); dt.setDate(dt.getDate() - (TOTAL_DAYS - 1 - i));
                const k = getLocalYMD(dt);
                full.push({ date: k, seconds: apiMap[k] || 0 });
            }
            const genesis = full.findIndex(d => d.seconds > 0);
            const activeDays = (genesis === -1) ? [] : full.slice(genesis);
            const trajectory = activeDays.length ? calculateTrajectory(activeDays) : null;
            renderMiniPreview(activeDays, trajectory);
        } catch (e) {
            console.warn('[Sirat] mini-preview init failed', e);
        }
    }

    function isUserLoggedIn() {
        return /(?:^|; )quran_access_token_/.test(document.cookie);
    }

    // ---------------------------------------------------------
    // 10. Publish (overrides any earlier definitions on window)
    // ---------------------------------------------------------
    window.calculateDeviations     = calculateDeviations;
    window.calculateTrajectory     = calculateTrajectory;
    window.generateSiratPathString = generateSiratPathString;
    window.initSiratVisualizer     = initSiratVisualizer;
    window.initSiratMiniPreview    = initMiniPreview;
    window.simulateUserJourney     = simulateUserJourney;
    window.simulatePathPattern     = simulatePathPattern;

    // ---------------------------------------------------------
    // 11. Autonomous boot
    //     The mini-preview should reflect the user's state without
    //     requiring them to open the panel first. We try a few times
    //     because the QF cookie is set asynchronously by the OAuth
    //     return flow, so it may not be ready at DOMContentLoaded.
    // ---------------------------------------------------------
    function bootMiniPreview() {
        let attempts = 0;
        const tick = () => {
            attempts++;
            if (isUserLoggedIn()) {
                initMiniPreview();
                return;
            }
            if (attempts < 6) setTimeout(tick, 1000);
        };
        tick();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootMiniPreview);
    } else {
        bootMiniPreview();
    }
})();
