/**
 * WeatherPanel -- the readouts for the run climate (the sky's weather; Build 2, 2026-11-03; docs/WORLD_FEEDBACK_PLAN.md
 * "Weather badge (the tap target)"). Three surfaces share one view model:
 *   - the BADGE (#weatherBadge in #gameCanvas, beside the moon): a small pixel icon of the band, an arrow when the run is
 *     clearing / worsening; tap = the Weather panel. Landscape / desktop only (hidden in the portrait strip).
 *   - the WEATHER PANEL (a modal): the band, the trend in words, and today so far plus the last days' on-time %, habits kept and church damage,
 *     with an (i) link to the "The sky" topic of How Deadline works.
 *   - the STATS readout (a section in the current-run panel): the same table; this is how the portrait strip, which has no
 *     sky, sees the weather.
 *
 * SKY PICKER (W1c, 2026-11-09; docs/WORLD_FEEDBACK_PLAN.md "W1c Sky picker" + its amendment): when the player has picked a sky the result
 * carries `pick: { band, realBand }` and everything here keeps telling the REAL run -- the badge icon, the panel text, the table -- with a
 * paintbrush on the badge, a "Sky set to X . your run is Y" line + a "Show my real sky" button in the panel, the picker itself (Lv 4 perk;
 * a locked row before), a small toast when the real band moves, and press-and-hold on the badge to peek at the real sky.
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

    // 9x9 paintbrush for the "sky is set" mark (code-drawn placeholder; PixelLab later if wanted): h = wood, g = ferrule, p = paint.
    const BRUSH = ['.......hh', '......hh.', '.....hh..', '....gg...', '...gg....', '..pp.....', '.ppp.....', 'pp.......', '.........'];
    const BRUSH_COLORS = { h: '#c9a26b', g: '#d9d6e6', p: '#e8795f' };
    function brushSvg(size) {
        const px = size || 14;
        let rects = '';
        BRUSH.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const col = BRUSH_COLORS[row[x]];
                if (col) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${col}"/>`;
            }
        });
        return `<svg viewBox="0 0 9 9" width="${px}" height="${px}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
    }

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

    /**
     * A RunClimate result -> what the three surfaces show (null when there is no result). With a sky pick on the result
     * (`result.pick = { band, realBand }`, js/skyPick.js) everything describes the REAL band and `vm.pick` names the picked one.
     */
    function buildViewModel(result, moodFor) {
        if (!result || !BAND_INFO[result.band]) return null;
        const pick = (result.pick && BAND_INFO[result.pick.band] && BAND_INFO[result.pick.realBand]) ? result.pick : null;
        const realBand = pick ? pick.realBand : result.band;
        const info = BAND_INFO[realBand];
        const trend = TREND_INFO[result.trend] || TREND_INFO.steady;
        const recent = Array.isArray(result.recent) ? result.recent : [];
        let note;
        if (result.forced) note = 'Dev preview: this sky was forced (dev tools or ?climate=). It is not your run.';
        else if (!recent.length) note = 'Your first finished day starts moving the sky. Until then a new run stays Hazy.';
        else if (result.usedPrior) note = 'Early in a run the sky leans toward Hazy until a full week of days has been scored.';
        else note = '';
        // Mood (W1b Build B1): `moodFor(dateKey | 'today')` -> the day's mood entries; the column shows only once some day has one.
        const glyphOf = (key) => {
            if (typeof moodFor !== 'function' || typeof Mood === 'undefined') return null;
            const g = Mood.dayGlyph(moodFor(key));
            return g ? { text: g.text, title: g.title } : null;
        };
        const todayMood = result.forced ? null : glyphOf('today');
        const rowMoods = recent.map(r => glyphOf(r.date));
        const hasMood = !!todayMood || rowMoods.some(Boolean);
        return {
            hasMood,
            band: realBand,
            label: info.label,
            pick: pick ? { band: pick.band, label: BAND_INFO[pick.band].label } : null,
            setLine: pick ? `Sky set to ${BAND_INFO[pick.band].label} \u00B7 your run is ${info.label}` : '',
            line: info.line,
            trendKey: TREND_INFO[result.trend] ? result.trend : 'steady',
            trendLabel: trend.label,
            trendLine: trend.line,
            arrow: trend.arrow,
            forced: !!result.forced,
            note,
            // Live sky (2026-11-11): the first table row is TODAY so far (null for a dev-forced sky). `pending` = nothing judged yet.
            today: result.forced ? null : (result.today
                ? { pending: false, onTime: pct(result.today.onTime), habits: pct(result.today.habits), damage: hp(result.today.damage), mood: todayMood }
                : { pending: true, mood: todayMood }),
            rows: recent.map((r, i) => ({
                date: r.date,
                mood: rowMoods[i],
                label: dayLabel(r.date),
                onTime: pct(r.onTime),
                habits: pct(r.habits),
                damage: hp(r.damage),
            })),
        };
    }

    function moodCellHtml(m) {
        return m ? `<td class="wx-mood" title="${esc(m.title)}"><span aria-hidden="true">${esc(m.text)}</span><span class="wx-sr">${esc(m.title)}</span></td>` : '<td class="wx-mood">&mdash;</td>';
    }

    function todayRowHtml(t, withMood) {
        if (!t) return '';
        if (t.pending) {
            // "Nothing judged yet" spans the three score columns; a mood logged today still shows in its own column.
            return `<tr class="wx-row--live"><th scope="row">Today so far</th><td colspan="3" class="wx-pending">Nothing judged yet</td>${withMood ? moodCellHtml(t.mood) : ''}</tr>`;
        }
        return `<tr class="wx-row--live"><th scope="row">Today so far</th><td>${esc(t.onTime)}</td><td>${esc(t.habits)}</td><td>${esc(t.damage)}</td>${withMood ? moodCellHtml(t.mood) : ''}</tr>`;
    }

    function tableHtml(vm) {
        if (!vm.rows.length && !vm.today) return '';
        const wm = !!vm.hasMood;
        const body = todayRowHtml(vm.today, wm) + vm.rows.map(r =>
            `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.onTime)}</td><td>${esc(r.habits)}</td><td>${esc(r.damage)}</td>${wm ? moodCellHtml(r.mood) : ''}</tr>`).join('');
        return `<table class="wx-table"><thead><tr><th scope="col">Day</th><th scope="col">On time</th><th scope="col">Habits kept</th><th scope="col">Church damage</th>${wm ? '<th scope="col">Mood</th>' : ''}</tr></thead><tbody>${body}</tbody></table>`;
    }

    function daysHeadingHtml(vm) {
        if (!vm.rows.length && !vm.today) return '';
        const n = vm.rows.length;
        const text = !n ? 'Today' : (vm.today ? `Today and the last ${n} finished day${n === 1 ? '' : 's'}` : `Last ${n} finished day${n === 1 ? '' : 's'}`);
        return `<h4 class="wx-days-heading">${text}</h4>`;
    }

    function infoButton() {
        return (typeof HowItWorks !== 'undefined' && HowItWorks.buttonHtml) ? HowItWorks.buttonHtml('weather', 'How the sky works') : '';
    }

    /**
     * The picker's rows. info = { unlocked, pick (the pick IN FORCE: null = follow), realBand, unlockLevel, bands }.
     * `bands` (W1d) = [{ band, unlocked, requirement }] for the five skies: an earned sky is a button, a locked one is a disabled button
     * that shows its requirement. Without `bands` every sky is offered. Nothing earned yet -> a locked line instead of options.
     */
    function pickerModel(info) {
        const i = info || {};
        const t = (typeof Theme !== 'undefined' && Theme.strings && Theme.strings.perks) ? Theme.strings.perks.skyPicker : null;
        if (!i.unlocked) {
            const lv = i.unlockLevel || 4;
            return { unlocked: false, lockedLine: t ? `${t.name} unlocks at Lv ${lv}: ${t.tagline}.` : `The sky picker unlocks at Lv ${lv}.`, options: [] };
        }
        const pick = BAND_INFO[i.pick] ? i.pick : null;
        const options = [{ key: 'follow', label: 'Follow my run', selected: !pick, disabled: false }];
        ['clear', 'hazy', 'overcast', 'fog', 'storm'].forEach((b) => {
            const row = Array.isArray(i.bands) ? i.bands.find(x => x && x.band === b) : null;
            const locked = !!row && !row.unlocked;
            const option = { key: b, label: BAND_INFO[b].label, selected: !locked && pick === b, disabled: locked };
            if (locked) { option.locked = true; option.requirement = String(row.requirement || ''); }
            options.push(option);
        });
        return { unlocked: true, title: t ? t.name : 'Your sky', tagline: t ? t.tagline : '', options };
    }

    function pickerHtml(pm) {
        if (!pm) return '';
        if (!pm.unlocked) return `<div class="wx-picker wx-picker--locked"><p class="wx-locked">\uD83D\uDD12 ${esc(pm.lockedLine)}</p></div>`;
        const buttons = pm.options.map((o) => {
            if (o.locked) {
                const req = o.requirement ? `, locked. Unlocks at ${o.requirement}` : ', locked';
                return `<button type="button" class="wx-pick wx-pick--locked" data-sky-pick="${o.key}" aria-pressed="false" aria-label="${esc(o.label + req)}" disabled><span class="wx-pick-name"><span aria-hidden="true">\uD83D\uDD12</span> ${esc(o.label)}</span>${o.requirement ? `<span class="wx-pick-req">${esc(o.requirement)}</span>` : ''}</button>`;
            }
            return `<button type="button" class="wx-pick${o.selected ? ' wx-pick--on' : ''}" data-sky-pick="${o.key}" aria-pressed="${o.selected ? 'true' : 'false'}"${o.disabled ? ' disabled' : ''}>${esc(o.label)}</button>`;
        }).join('');
        return `<div class="wx-picker">
                        <h4 class="wx-picker-heading">${esc(pm.title)}</h4>
                        ${pm.tagline ? `<p class="wx-picker-tag">${esc(pm.tagline)}</p>` : ''}
                        <div class="wx-picks" role="group" aria-label="Pick your sky">${buttons}</div>
                        <p class="wx-picker-rule">Your pick changes the picture only. The weather on the badge and in the table is your real run.</p>
                    </div>`;
    }

    /** The Weather panel overlay markup. `picker` = pickerModel(...) or null (no picker row). */
    function panelHtml(vm, picker) {
        if (!vm) return '';
        return `
            <div class="modal-overlay wx-overlay">
                <div class="modal-content wx-panel" role="dialog" aria-label="Weather">${panelInner(vm, picker)}</div>
            </div>`;
    }

    /** What is INSIDE the panel (re-rendered in place when the player picks a sky). */
    function panelInner(vm, picker, trendRow) {
        const row = trendRow || `<p class="wx-trend wx-trend--${vm.trendKey}"><span class="wx-trend-label">${vm.arrow ? `<span aria-hidden="true">${vm.arrow}</span> ` : ''}${esc(vm.trendLabel)}</span> ${esc(vm.trendLine)}</p>`;
        const setBanner = vm.pick
            ? `<div class="wx-set"><span class="wx-set-brush" aria-hidden="true">${brushSvg(16)}</span><span class="wx-set-text">${esc(vm.setLine)}</span><button type="button" class="wx-real-btn" data-sky-pick="follow">Show my real sky</button></div>`
            : '';
        return `
                    <div class="wx-head">
                        <span class="wx-icon wx-icon--${vm.band}" aria-hidden="true">${iconSvg(vm.band)}</span>
                        <h3>${esc(vm.label)} ${infoButton()}</h3>
                    </div>
                    ${setBanner}
                    <p class="wx-line">${esc(vm.line)}</p>
                    ${row}
                    ${vm.note ? `<p class="wx-note">${esc(vm.note)}</p>` : ''}
                    ${(picker && !vm.forced) ? pickerHtml(picker) : ''}
                    ${daysHeadingHtml(vm)}${tableHtml(vm)}
                    <p class="wx-foot">Today moves the sky as it fills in, and counts extra until it closes.</p>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>`;
    }

    /** The Stats window's section ('' when there is no result). */
    function statsHtml(vm) {
        if (!vm) return '';
        return `
            <div class="stats-weather wx-stats">
                <div class="wx-stats-head"><span class="wx-icon wx-icon--${vm.band}" aria-hidden="true">${iconSvg(vm.band)}</span>
                    <span class="wx-stats-title">Sky: <strong>${esc(vm.label)}</strong>${vm.arrow ? ` <span class="wx-trend wx-trend--${vm.trendKey}">${vm.arrow} ${esc(vm.trendLabel)}</span>` : ''} ${infoButton()}</span></div>
                ${vm.pick ? `<p class="wx-set-stats"><span aria-hidden="true">${brushSvg(12)}</span> ${esc(vm.setLine)}</p>` : ''}
                <p class="wx-line">${esc(vm.line)}</p>
                ${vm.note ? `<p class="wx-note">${esc(vm.note)}</p>` : ''}
                ${tableHtml(vm)}
            </div>`;
    }

    /** The badge's accessible name. */
    function badgeLabel(vm) {
        if (!vm) return 'Weather';
        const t = vm.trendKey === 'steady' ? '' : `, ${vm.trendLabel.toLowerCase()}`;
        const set = vm.pick ? ` Your sky is set to ${vm.pick.label}.` : '';
        return `Weather: ${vm.label}${t}.${set} Tap for details.`;
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
    let getPickerInfo = null; // () => { unlocked, pick, realBand, unlockLevel } -- the picker row (omitted = no picker row)
    let getMood = null;       // (dateKey | 'today') => mood entries, for the Mood column (script.js)
    let onPick = null;        // (key: 'follow' | band) => void -- script.js saves the pick and refreshes the sky
    let onPeek = null;        // (on: boolean) => void -- press-and-hold on the badge: show the REAL sky while held
    let badgeEl = null;
    let toastEl = null;
    let toastTimer = null;
    let lastResult = null;

    const HOLD_MS = 450;   // press-and-hold on the badge (only when a sky is picked) peeks at the real sky
    const TOAST_MS = 5000;

    function currentModels() {
        const vm = buildViewModel(getResult ? getResult() : lastResult, getMood);
        const picker = (vm && getPickerInfo) ? pickerModel(getPickerInfo()) : null;
        return { vm, picker };
    }

    /** The Weather panel (one at a time). Safe to call with no result (does nothing). */
    function open() {
        const { vm, picker } = currentModels();
        if (!vm || typeof Modal === 'undefined') return null;
        const overlay = Modal.open(panelHtml(vm, picker), { dedupeSelector: '.wx-overlay' });
        if (!overlay) return null;
        overlay.addEventListener('click', (e) => {
            const target = e.target && e.target.closest ? e.target : null;
            const btn = target ? target.closest('[data-action="close"]') : null;
            if (btn) {
                e.stopPropagation();
                overlay.remove();
                return;
            }
            const pickBtn = target ? target.closest('[data-sky-pick]') : null;
            if (!pickBtn || pickBtn.disabled) return;
            e.stopPropagation();
            if (onPick) onPick(pickBtn.getAttribute('data-sky-pick'));
            // Re-draw the panel in place (the sky, badge and header all changed).
            const panel = overlay.querySelector('.wx-panel');
            const next = currentModels();
            if (panel && next.vm) panel.innerHTML = panelInner(next.vm, next.picker);
        });
        return overlay;
    }

    /** One small line near the badge, about 5 s (the sky-change notice; css/weatherPanel.css .sky-toast). */
    function showSkyToast(text) {
        if (!text) return;
        if (!toastEl && typeof document !== 'undefined') toastEl = document.getElementById('skyToast');
        if (!toastEl) return;
        toastEl.textContent = text;
        toastEl.hidden = false;
        toastEl.classList.remove('sky-toast--show');
        void toastEl.offsetWidth; // restart the fade if a toast was already up
        toastEl.classList.add('sky-toast--show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastEl.hidden = true; toastEl.classList.remove('sky-toast--show'); toastTimer = null; }, TOAST_MS);
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
        // The "set" mark: a paintbrush in the chip's top-left corner while the sky is the player's pick (the icon stays the REAL band).
        let mark = badgeEl.querySelector('.weather-badge-set');
        const chipBox = badgeEl.querySelector('.weather-badge-chip');
        if (!mark && chipBox) {
            mark = document.createElement('span');
            mark.className = 'weather-badge-set';
            mark.setAttribute('aria-hidden', 'true');
            chipBox.appendChild(mark);
        }
        if (mark) {
            mark.hidden = !vm.pick;
            mark.innerHTML = vm.pick ? brushSvg(14) : '';
        }
        badgeEl.classList.toggle('weather-badge--set', !!vm.pick);
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
        getPickerInfo = (deps && deps.getPickerInfo) || null;
        onPick = (deps && deps.onPick) || null;
        getMood = (deps && deps.getMood) || null;
        onPeek = (deps && deps.onPeek) || null;
        toastEl = document.getElementById('skyToast');
        badgeEl = document.getElementById('weatherBadge');
        if (!badgeEl) return;
        if (!badgeEl.dataset.wired) {
            badgeEl.dataset.wired = '1';
            // Press-and-hold peeks at the REAL sky while a sky is picked (build last; a plain tap still opens the panel). The long-press
            // menu is blocked on the badge only (css: -webkit-touch-callout / user-select, and contextmenu below).
            let holdTimer = null;
            let peeking = false;
            let swallowClick = false;
            const endHold = () => {
                if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
                if (peeking) { peeking = false; badgeEl.classList.remove('weather-badge--peek'); if (onPeek) onPeek(false); }
            };
            badgeEl.addEventListener('pointerdown', () => {
                swallowClick = false;
                const vm = buildViewModel(getResult ? getResult() : lastResult, getMood);
                if (!vm || !vm.pick || !onPeek) return;
                holdTimer = setTimeout(() => {
                    holdTimer = null;
                    peeking = true;
                    swallowClick = true; // the release after a hold must not also open the panel
                    badgeEl.classList.add('weather-badge--peek');
                    onPeek(true);
                }, HOLD_MS);
            });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => badgeEl.addEventListener(ev, endHold));
            badgeEl.addEventListener('contextmenu', (e) => e.preventDefault());
            badgeEl.addEventListener('click', (e) => {
                e.stopPropagation(); // Modal's outside-click dismiss would see the same tap
                if (swallowClick) { swallowClick = false; return; }
                const vm = buildViewModel(getResult ? getResult() : lastResult, getMood);
                if (vm && !(getResult && getResult() && getResult().forced)) writeStored(nextBadgeState(readStored(), vm.band, true).next);
                badgeEl.classList.remove('weather-badge--pulse');
                open();
            });
        }
        updateBadge(lastResult);
    }

    return { BAND_INFO, TREND_INFO, STORAGE_KEY, bandInfo, iconSvg, brushSvg, dayLabel, buildViewModel, pickerModel, panelHtml, statsHtml, badgeLabel, nextBadgeState, init, updateBadge, open, showSkyToast };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherPanel;
}
