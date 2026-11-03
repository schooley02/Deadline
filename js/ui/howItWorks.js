/**
 * HowItWorks -- the "How Deadline works" window opened from Settings (2026-11-03; plan docs/HOW_IT_WORKS_PLAN.md).
 *
 * WHY: the game shows points, streaks, hero stars and badges but never said what they are for. Five short topics, each
 * "what it is" and (where Jeremy approved one) "why it is there", in a plain voice.
 *
 * Same pattern as js/pointsInfo.js and js/ui/pushbackHelp.js: the words are built from CONFIG, so a retuned number
 * cannot leave the page lying (test/howItWorks.test.js checks every number against CONFIG). Points reuses
 * `PointsInfo.rulesLines`; Pushbacks reuses `PushbackHelp.hintHtml` (both bare stable globals, required explicitly in
 * tests). The copy only states what the game DOES today: hero healing by completion is decided but NOT built
 * (DECISIONS 2026-11-02), so it is not mentioned here. When it is built, add it to the Hero ranking topic.
 *
 *   HowItWorks.topics(config)          -> [{ id, title, what: string[], list?: string[], html?: string, why?: string }]
 *                                          (`what` and `list` are PLAIN text, escaped on render; `html` is trusted
 *                                          markup from PushbackHelp)
 *   HowItWorks.windowHtml(topics, openId?) -> the overlay markup (pure string)
 *   HowItWorks.open({ topic?, config? })  -> shows it (DOM: Modal.open; one at a time)
 *   HowItWorks.buttonHtml(topicId, label?) -> the inline (i) button markup ('' for an unknown topic id). A document
 *                                          capture listener (installed when this file loads) opens the window on that topic
 *                                          for any `.hiw-info-btn[data-hiw-topic]`, so buttons written by hand in
 *                                          index.html work too. Used on: habit popup + streak notice (streaks), Heroes
 *                                          popup + Routines window (heroes), Stats > Achievements (achievements).
 */
const HowItWorks = (() => {
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // [60, 70] -> "60 and 70"; [60, 70, 80] -> "60, 70 and 80"
    function andList(items) {
        const a = items.map(String);
        if (a.length <= 1) return a.join('');
        return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    }

    function pct(rate) { return Math.round(rate * 100) + '%'; }

    // ---- Points ------------------------------------------------------------------------------------------------
    function pointsTopic(config) {
        return {
            id: 'points',
            title: 'Points',
            list: PointsInfo.rulesLines(config),
            what: ['Slipping on a Break habit costs points and is the only thing that can take you below zero. Debt never hurts your base and has no deadline. It just keeps slips costly.'],
        };
    }

    // ---- Pushbacks ---------------------------------------------------------------------------------------------
    function pushbacksTopic(config) {
        // The base allowance (Clock tower star 1) quoted as-is; the live numbers live in the Shop and popups.
        const allowance = Pushback.allowanceForStar(1, config.PUSHBACK_ALLOWANCE);
        return {
            id: 'pushbacks',
            title: 'Pushbacks',
            what: [],
            html: PushbackHelp.hintHtml({ allowance }),
        };
    }

    // ---- Streaks -----------------------------------------------------------------------------------------------
    function streaksTopic(config) {
        const w = config.HABIT_RATE_WINDOW;
        return {
            id: 'streaks',
            title: 'Streaks',
            what: [
                `A streak is how many days in a row you've done a habit. At ${config.HABIT_STREAK_BONUS_THRESHOLD} days its zombie catches fire, and at ${config.HABIT_STREAK_STRONG_THRESHOLD} it blazes. A miss resets it. Break habits keep their streak while you're away.`,
                `Streaks don't pay points. The bonus comes from your record over the last ${w} times, so one slip doesn't erase what you've built.`,
            ],
            why: `The fire is a nudge to keep the chain going. ${w} repetitions is the commonly cited figure for forming a habit, so the points bonus follows that window and the streak is the day-to-day motivator.`,
        };
    }

    // ---- Hero ranking ------------------------------------------------------------------------------------------
    function heroTopic(config) {
        const w = config.HERO_STAR_RATE_WINDOW;
        const tiers = (config.HERO_STAR_TIERS || []).slice().sort((a, b) => a.stars - b.stars);
        const rates = andList(tiers.map(t => pct(t.minRate)));
        const days = andList(tiers.map(t => t.minDays));
        const ghostClause = config.KO_GHOST_POINTS_FACTOR === 0 ? ' that pay no points' : '';
        const what = [
            `Heroes are your routines. They're listed by level first. If two share a level, the better hit rate over the last ${w} scheduled times goes first, then the name.`,
        ];
        if (tiers.length) {
            what.push(`Stars run from 1 to ${tiers[tiers.length - 1].stars} and come from that same recent hit rate: ${rates}. Each star also needs days on record (${days}), so one lucky completion can't earn five stars.`);
        }
        what.push(`When one of a hero's items is overdue and attacking the base, the hero loses health too. At 0 health the hero is knocked out and its items turn into ghosts${ghostClause}. It can be revived the next day at ${Math.round((config.HERO_REVIVE_HEALTH / config.ROUTINE_MAX_HEALTH) * 100)}% health.`);
        return {
            id: 'heroes',
            title: 'Hero ranking',
            what,
            why: `Hit rate counts your last ${w} scheduled times, the same window as the habit bonus and the commonly cited number of repetitions it takes to form a habit. A hero's rating shows whether the habit has taken hold, not whether you had one good week. The top of the list are the routines holding your defense up, and the bottom is a good place to look for improvements. The days requirement means one lucky completion can't earn 5 stars.`,
        };
    }

    // ---- Achievements ------------------------------------------------------------------------------------------
    // One plain sentence per family id (config-driven numbers are added below). A family with no sentence here (a
    // future badge) still lists with its name and tiers.
    function achievementDescription(familyId, config) {
        switch (familyId) {
            case 'survivor': return 'Nights survived in your best run.';
            case 'task_slayer': return 'Tasks completed.';
            case 'habit_hero': return 'Habits completed. Resisting a Break habit counts.';
            case 'on_fire': return 'Your best habit streak, in days.';
            case 'honor_roll': return `Every day one of your heroes ends on the honor roll (${config.HERO_HONOR_ROLL_STARS} stars or better) counts.`;
            case 'clean_sweep': return 'Every day you finish with something due and nothing missed counts.';
            case 'iron_will': return 'Every time you resist a Break habit counts.';
            case 'back_in_black': return 'Dig out of debt: slip into negative points, then earn your way back to zero or above.';
            default: return '';
        }
    }

    function achievementsTopic(config) {
        const list = (config.ACHIEVEMENTS || []).map((family) => {
            const tiers = family.tiers || [];
            const numbers = tiers.length > 1 ? ` (${tiers.map(t => t.threshold).join(' / ')})` : '';
            const text = achievementDescription(family.id, config);
            return `${family.name}${text ? ': ' + text : ''}${numbers}`;
        });
        return {
            id: 'achievements',
            title: 'Achievements',
            what: ['Badges (Bronze, Silver, Gold and Platinum) for lasting effort, counted across all your runs. They are never taken away, and they are trophies only: no points. The numbers in brackets are what each tier asks for.'],
            list,
            why: 'Badges count your whole history across runs, so a run that ends in game over still adds to them.',
        };
    }

    function topics(config) {
        const cfg = config || (typeof CONFIG !== 'undefined' ? CONFIG : {});
        return [pointsTopic(cfg), pushbacksTopic(cfg), streaksTopic(cfg), heroTopic(cfg), achievementsTopic(cfg)];
    }

    // ---- Markup ------------------------------------------------------------------------------------------------
    function topicHtml(t, openId) {
        const paragraphs = (t.what || []).map(p => `<p>${esc(p)}</p>`).join('');
        const list = (t.list && t.list.length)
            ? `<ul class="hiw-list-items">${t.list.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
        // Points: the rules list reads first, then the extra paragraph; the others lead with their paragraphs.
        const body = t.id === 'points' ? list + paragraphs : paragraphs + list;
        const html = t.html ? `<div class="hiw-html">${t.html}</div>` : '';
        const why = t.why ? `<p class="hiw-why"><strong>Why:</strong> ${esc(t.why)}</p>` : '';
        return `<details class="hiw-topic" data-topic="${esc(t.id)}"${t.id === openId ? ' open' : ''}>` +
            `<summary>${esc(t.title)}</summary><div class="hiw-body">${body}${html}${why}</div></details>`;
    }

    function windowHtml(list, openId) {
        return `
            <div class="modal-overlay hiw-overlay">
                <div class="modal-content hiw-panel" role="dialog" aria-label="How Deadline works">
                    <h3 class="hiw-title">How Deadline works</h3>
                    <p class="hiw-intro">What each part of the game does, and why it is there. Tap a topic.</p>
                    <div class="hiw-topics">${list.map(t => topicHtml(t, openId)).join('')}</div>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    /**
     * Opens the window (one at a time). opts.topic opens that topic first (for the later inline (i) buttons).
     * The Settings button that calls this MUST stopPropagation, or Modal's outside-click dismiss sees the same tap.
     */
    function open(opts) {
        const o = opts || {};
        const overlay = Modal.open(windowHtml(topics(o.config), o.topic), { dedupeSelector: '.hiw-overlay' });
        if (!overlay) return null;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action="close"]') : null;
            if (!btn) return;
            e.stopPropagation();
            overlay.remove();
        });
        return overlay;
    }

    // ---- Inline (i) buttons (2026-11-03) ------------------------------------------------------------------------
    // A small circled i that opens this window on one topic. Markup comes from buttonHtml (dynamic UI) or is written
    // by hand in index.html (static headers); ONE capture-phase listener on the document opens the window for both.
    // Capture + stopPropagation is deliberate: Modal's outside-click dismiss (a bubbling document handler) would
    // otherwise see the same tap and close the popup or window the button sits in, and a row's own tap handler
    // (agenda rows, hero rows) must not fire as well.
    const TOPIC_IDS = ['points', 'pushbacks', 'streaks', 'heroes', 'achievements'];

    function buttonHtml(topicId, label) {
        if (TOPIC_IDS.indexOf(topicId) === -1) return '';
        return `<button type="button" class="hiw-info-btn" data-hiw-topic="${esc(topicId)}" aria-label="${esc(label || 'How this works')}">&#9432;</button>`;
    }

    function onInfoClick(e) {
        const target = e.target;
        const btn = target && target.closest ? target.closest('.hiw-info-btn[data-hiw-topic]') : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        open({ topic: btn.getAttribute('data-hiw-topic') });
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('click', onInfoClick, true);
    }

    return { topics, windowHtml, topicHtml, andList, open, buttonHtml, TOPIC_IDS };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HowItWorks;
}
