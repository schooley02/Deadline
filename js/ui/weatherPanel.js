/**
 * WeatherPanel -- the readouts for the run climate (the sky's weather; Build 2, 2026-11-03; docs/WORLD_FEEDBACK_PLAN.md
 * "Weather badge (the tap target)"). Three surfaces share one view model:
 *   - the BADGE (#weatherBadge in #gameCanvas, beside the moon): a small pixel icon of the band, an arrow when the run is
 *     clearing / worsening; tap = the Weather panel. Landscape / desktop only (hidden in the portrait strip).
 *   - the WEATHER PANEL (a modal): the band, the trend in words, and the last days' on-time %, habits kept and church damage,
 *     with an (i) link to the "The sky" topic of How Deadline works.
 *   - the STATS readout (a section in the current-run panel): the same table; this is how the portrait strip, which has no
 *     sky, sees the weather.
 *
 * PURE / DOM split like basePanel.js: iconSvg, buildViewModel, panelHtml, statsHtml, nextBadgeState and badgeLabel are pure
 * and unit-tested (test/weatherPanel.test.js); open() and updateBadge() are DOM. Globals read at call time: Modal, HowItWorks.
 *
 * FIRST-CHANGE PULSE: the first time the band changes after the player has seen the badge, it pulses softly until it is tapped
 * once, so the player learns it is tappable. The tiny state ({ band, pending, learned }) lives in localStorage under
 * `deadline.weatherBadge` (a per-device hint, like Settings' timerHintSeen -- not game state, not exported); the dev override
 * (?climate=) never touches it. Any storage failure just means no pulse.
 */
const WeatherPanel = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    const STORAGE_KEY = 'deadline.weatherBadge';

    // What each band says, in the player's words (no numbers: those come from the rows below).
    const BAND_INFO = {
        clear: { label: 'Clear', line: 'The run is going well.' },
        hazy: { label: 'Hazy', line: 'A steady run with room to improve. Every new run starts here.' },
        overcast: { label: 'Overcast', line: 'Things are slipping. A few good days will lift it.' },
        fog: { label: 'Fog', line: 'The run is struggling. Far-off scenery is fading, but everything you need stays in view.' },
        storm: { label: 'Storm', line: 'The run is in trouble. Good days will start to clear it.' },
    };

    const TREND_INFO = {
        up: { label: 'Clearing', line: 'Recent days are better than the days before.', arrow: '▲', cls: 'up' },
        down: { label: 'Worsening', line: 'Recent days are worse than the days before.', arrow: '▼', cls: 'down' },
        steady: { label: 'Holding steady', line: 'About the same as a few days ago.', arrow: '', cls: 'steady' },
    };

    // 13x13 pixel icons from the approved mockup (docs/mockups/run-climate/): c = cream, g = light grey, d = dark grey,
    // y = lightning yellow, b = rain blue, '.' = empty.
    const ICONS = {
        clear: ['......cc.....', '....cccc...c.', '...ccc......', '..ccc.....c..', '..ccc........', '..ccc...c....', '..cccc.......', '...ccccc..c..', '....ccccc....', '......cc.....', '.c...........', '......c......', '.............'],
        hazy: ['.....cc......', '...cccc......', '..ccc........', '..ccc........', '..ccc..ggg...', '..ccc.ggggg..', '...cgggggggg.', '....ggggggggg', '.....ggggggg.', '.............', '.............', '.............', '.............'],
        overcast: ['.............', '....ggg......', '...ggggg.....', '..gggggggg...', '.ggggggggggg.', 'ggggggggggggg', '..ddddd......', '.ddddddddd...', 'ddddddddddddd', 'ddddddddddddd', '.............', '.............', '.............'],
        fog: ['.............', '.............', 'ggggggggg....', '.............', '...gggggggggg', '.............', 'gggggggggg...', '.............', '..ggggggggggg', '.............', 'gggggggg.....', '.............', '.............'],
        storm: ['....ddddd....', '..ddddddddd..', '.ddddddddddd.', 'ddddddddddddd', 'ddddddddddddd', '.dddddyyddd..', '......yy.....', '.b...yy...b..', '....yyyyy....', '..b...yy...b.', '......y......', '....b....b...', '.............'],
    };
    const COLORS = { c: '#f6f0d4', g: '#a8a6bf', d: '#6e6c86', y: '#f2d36b', b: '#8fb4cf' };

    // ---- pure ---------------------------------------------------------------

    function bandInfo(band) { return BAND_INFO[band] || null; }

    /** The pixel icon as an inline <svg> string ('' for an unknown band). */
    function iconSvg(band) {
        const grid = ICONS[band];
        if (!grid) return '';
        let rects = '';
        grid.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const col = COLORS[row[x]];
                if (col) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${col}"/>`;
            }
        });
        return `<svg viewBox="0 0 13 13" width="26" height="26" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
    }

    // 'YYYY-MM-DD' -> 'Mon Nov 2' (calendar parts only, no time zone maths)
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function dayLabel(dateKey) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));
        if (!m) return String(dateKey || '');
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
    }

    function pct(v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v * 100) + '%' : '—'; }
    function hp(v) {
        const n = Number(v) || 0;
        return (Math.round(n * 10) / 10) + ' HP';
    }

    /** A RunClimate result -> what the three surfaces show (null when there is no result). */
    function buildViewModel(result) {
        if (!result || !BAND_INFO[result.band]) return null;
        const info = BAND_INFO[result.band];
        const trend = TREND_INFO[result.trend] || TREND_INFO.steady;
        const recent = Array.isArray(result.recent) ? result.recent : [];
        let note;
        if (result.forced) note = 'Dev preview: this sky was forced with ?climate=. It is not your run.';
        else if (!recent.length) note = 'Your first finished day starts moving the sky. Until then a new run stays Hazy.';
        else if (result.usedPrior) note = 'Early in a run the sky leans toward Hazy until a full week of days has been scored.';
        else note = '';
        return {
            band: result.band,
            label: info.label,
            line: info.line,
            trendKey: TREND_INFO[result.trend] ? result.trend : 'steady',
            trendLabel: trend.label,
            trendLine: trend.line,
            arrow: trend.arrow,
            forced: !!result.forced,
            note,
            rows: recent.map(r => ({
                date: r.date,
                label: dayLabel(r.date),
                onTime: pct(r.onTime),
                habits: pct(r.habits),
                damage: hp(r.damage),
            })),
        };
    }

    function tableHtml(vm) {
        if (!vm.rows.length) return '';
        const body = vm.rows.map(r =>
            `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.onTime)}</td><td>${esc(r.habits)}</td><td>${esc(r.damage)}</td></tr>`).join('');
        return `<table class="wx-table"><thead><tr><th scope="col">Day</th><th scope="col">On time</th><th scope="col">Habits kept</th><th scope="col">Church damage</th></tr></thead><tbody>${body}</tbody></table>`;
    }

    function infoButton() {
        return (typeof HowItWorks !== 'undefined' && HowItWorks.buttonHtml) ? HowItWorks.buttonHtml('weather', 'How the sky works') : '';
    }

    /** The Weather panel overlay markup. */
    function panelHtml(vm) {
        if (!vm) return '';
        const trendRow = `<p class="wx-trend wx-trend--${vm.trendKey}"><span class="wx-trend-label">${vm.arrow ? `<span aria-hidden="true">${vm.arrow}</span> ` : ''}${esc(vm.trendLabel)}</span> ${esc(vm.trendLine)}</p>`;
        return `
            <div class="modal-overlay wx-overlay">
                <div class="modal-content wx-panel" role="dialog" aria-label="Weather">
                    <div class="wx-head">
                        <span class="wx-icon wx-icon--${vm.band}" aria-hidden="true">${iconSvg(vm.band)}</span>
                        <h3>${esc(vm.label)} ${infoButton()}</h3>
                    </div>
                    <p class="wx-line">${esc(vm.line)}</p>
                    ${trendRow}
                    ${vm.note ? `<p class="wx-note">${esc(vm.note)}</p>` : ''}
                    ${vm.rows.length ? `<h4 class="wx-days-heading">Last ${vm.rows.length} finished day${vm.rows.length === 1 ? '' : 's'}</h4>${tableHtml(vm)}` : ''}
                    <p class="wx-foot">The sky changes once a day, when a day closes.</p>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    /** The Stats window's section ('' when there is no result). */
    function statsHtml(vm) {
        if (!vm) return '';
        return `
            <div class="stats-weather wx-stats">
                <div class="wx-stats-head"><span class="wx-icon wx-icon--${vm.band}" aria-hidden="true">${iconSvg(vm.band)}</span>
                    <span class="wx-stats-title">Sky: <strong>${esc(vm.label)}</strong>${vm.arrow ? ` <span class="wx-trend wx-trend--${vm.trendKey}">${vm.arrow} ${esc(vm.trendLabel)}</span>` : ''} ${infoButton()}</span></div>
                <p class="wx-line">${esc(vm.line)}</p>
                ${vm.note ? `<p class="wx-note">${esc(vm.note)}</p>` : ''}
                ${tableHtml(vm)}
            </div>`;
    }

    /** The badge's accessible name. */
    function badgeLabel(vm) {
        if (!vm) return 'Weather';
        const t = vm.trendKey === 'steady' ? '' : `, ${vm.trendLabel.toLowerCase()}`;
        return `Weather: ${vm.label}${t}. Tap for details.`;
    }

    /**
     * The first-change pulse. `stored` = the saved { band, pending, learned } (or null), `band` = the band now, `tapped` = the
     * player just tapped the badge. Returns { pulse, next } -- next is what to save (null = nothing to save).
     */
    function nextBadgeState(stored, band, tapped) {
        const s = (stored && typeof stored === 'object') ? stored : null;
        if (tapped) return { pulse: false, next: { band, pending: false, learned: true } };
        if (!s) return { pulse: false, next: { band, pending: false, learned: false } };
        if (s.learned) return { pulse: false, next: s.band === band ? null : { band, pending: false, learned: true } };
        if (s.pending) return { pulse: true, next: s.band === band ? null : { band, pending: true, learned: false } };
        if (s.band !== band) return { pulse: true, next: { band, pending: true, learned: false } };
        return { pulse: false, next: null };
    }

    // ---- DOM ----------------------------------------------------------------

    function readStored() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function writeStored(v) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch (e) { /* a hint only */ }
    }

    let getResult = null;
    let badgeEl = null;
    let lastResult = null;

    /** The Weather panel (one at a time). Safe to call with no result (does nothing). */
    function open() {
        const vm = buildViewModel(getResult ? getResult() : lastResult);
        if (!vm || typeof Modal === 'undefined') return null;
        const overlay = Modal.open(panelHtml(vm), { dedupeSelector: '.wx-overlay' });
        if (!overlay) return null;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action="close"]') : null;
            if (!btn) return;
            e.stopPropagation();
            overlay.remove();
        });
        return overlay;
    }

    /** Called by ClimateView whenever the result changes (and once at start). */
    function updateBadge(result) {
        lastResult = result || null;
        if (!badgeEl) return;
        const vm = buildViewModel(result);
        if (!vm) { badgeEl.hidden = true; return; }
        badgeEl.hidden = false;
        badgeEl.dataset.band = vm.band;
        badgeEl.setAttribute('aria-label', badgeLabel(vm));
        badgeEl.title = `${vm.label}${vm.arrow ? ' ' + vm.arrow : ''}`;
        const chip = badgeEl.querySelector('.weather-badge-icon');
        if (chip) chip.innerHTML = iconSvg(vm.band);
        const arrow = badgeEl.querySelector('.weather-badge-trend');
        if (arrow) {
            arrow.textContent = vm.arrow;
            arrow.className = `weather-badge-trend weather-badge-trend--${vm.trendKey}`;
        }
        if (result.forced) { badgeEl.classList.remove('weather-badge--pulse'); return; } // a dev preview never uses up the hint
        const d = nextBadgeState(readStored(), vm.band, false);
        if (d.next) writeStored(d.next);
        badgeEl.classList.toggle('weather-badge--pulse', d.pulse);
    }

    function init(deps) {
        getResult = (deps && deps.getResult) || null;
        badgeEl = document.getElementById('weatherBadge');
        if (!badgeEl) return;
        if (!badgeEl.dataset.wired) {
            badgeEl.dataset.wired = '1';
            badgeEl.addEventListener('click', (e) => {
                e.stopPropagation(); // Modal's outside-click dismiss would see the same tap
                const vm = buildViewModel(getResult ? getResult() : lastResult);
                if (vm && !(getResult && getResult() && getResult().forced)) writeStored(nextBadgeState(readStored(), vm.band, true).next);
                badgeEl.classList.remove('weather-badge--pulse');
                open();
            });
        }
        updateBadge(lastResult);
    }

    return { BAND_INFO, TREND_INFO, STORAGE_KEY, bandInfo, iconSvg, dayLabel, buildViewModel, panelHtml, statsHtml, badgeLabel, nextBadgeState, init, updateBadge, open };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherPanel;
}
