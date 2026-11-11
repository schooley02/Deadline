/**
 * HowItWorks -- the "How Deadline works" window opened from Settings (2026-11-03; plan docs/HOW_IT_WORKS_PLAN.md).
 *
 * WHY: the game shows points, streaks, hero stars and badges but never said what they are for. Short topics, each
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
            what: ['Slipping on a Break Habit costs points and is the only thing that can take you below zero. Debt never hurts your base and has no deadline. It just keeps slips costly.'],
        };
    }

    // ---- Priorities --------------------------------------------------------------------------------------------
    // Priority slots (2026-11-04; docs/PRIORITY_SLOTS_PLAN.md). Every number comes from CONFIG.PRIORITY_SLOTS_PER_DAY.
    function prioritiesTopic(config) {
        const n = config.PRIORITY_SLOTS_PER_DAY != null ? config.PRIORITY_SLOTS_PER_DAY : 3;
        return {
            id: 'priorities',
            title: `${n === 3 ? 'Three' : n} priorities a day`,
            what: [
                `Each day has ${n} priority ${n === 1 ? 'slot' : 'slots'}. A priority task pays double points and glows gold. You can put a priority on a task due today, or on a task due tomorrow or later (that day has its own ${n}).`,
                `Marking a task uses a slot for good. Unmarking it takes away the glow and the double points but does not give the slot back, so pick the tasks that matter.`,
                `Finish all ${n} priorities for a day and ${n} more open up for that day.`,
                `A priority task covers its sub-tasks for one slot. You can also mark a single sub-task on its own.`,
                `Moving a task to another day, by a pushback or an edit, drops its priority. Mark it again on the new day if it is still a big one.`,
            ],
            why: `Naming a few big things for the day keeps you from calling everything important.`,
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
                `A streak is how many days in a row you've done a habit. At ${config.HABIT_STREAK_BONUS_THRESHOLD} days its zombie catches fire, and at ${config.HABIT_STREAK_STRONG_THRESHOLD} it blazes. A miss resets it. Break Habits keep their streak while you're away.`,
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
            case 'habit_hero': return 'Habits completed. Resisting a Break Habit counts.';
            case 'on_fire': return 'Your best habit streak, in days.';
            case 'honor_roll': return `Every day one of your heroes ends on the honor roll (${config.HERO_HONOR_ROLL_STARS} stars or better) counts.`;
            case 'clean_sweep': return 'Every day you finish with something due and nothing missed counts.';
            case 'iron_will': return 'Every time you resist a Break Habit counts.';
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

    // ---- The sky (run climate, 2026-11-03) ---------------------------------------------------------------------
    function weatherTopic(config) {
        const c = config.CLIMATE || {};
        const w = c.weights || {};
        const days = c.windowDays || 7;
        return {
            id: 'weather',
            title: 'The sky',
            what: [
                `The sky shows how your run has been going lately, all of it together. It scores each of the last ${days} finished days of this run: finishing on time counts ${pct(w.onTime || 0)} (a late finish counts half), keeping your habits ${pct(w.habits || 0)}, and keeping the church healthy ${pct(w.church || 0)} (${c.damageCap || 25} HP of damage in one day scores zero). Recent days count more than older ones.`,
                `There are five skies, best to worst: Clear, Hazy, Overcast, Fog and Storm. A new run starts Hazy, and several strong days in a row clear it. The finished days set the sky, and today moves it as it goes: once ${c.liveFullAt || 4} things have been finished or have gone overdue, today counts extra, so a rough afternoon can darken the sky and a strong day can lift it. When the day closes it settles to its normal weight, so the morning sky is the report on how things have gone. The arrow and the sky-change notice follow finished days only.`,
                'The small icon beside the moon shows the sky, with an arrow when the run is clearing or worsening. Tap it to see the last days. The same readout is in Stats.',
            ],
            why: 'Base health, overdue zombies and missed habits already show what is happening right now. The sky shows the direction of the whole run: it is slow to change: one bad day dims it without ruining it, and one good day lifts it without fixing it. As it worsens, decoration fades (stars, the moon, far buildings), but the things that help you recover (zombies, the church, your numbers) always stay readable.',
        };
    }

    // ---- When a run ends (run-end carryover, 2026-11-03; docs/RUN_CARRYOVER_PLAN.md) ------------------------------
    function runsTopic(config) {
        const table = config.ROUTINE_SLOTS_PER_LEVEL || {};
        const levels = Object.keys(table).map(Number).filter(l => l > 1 && table[l] > (table[l - 1] || 0)).sort((a, b) => a - b);
        const unlockLine = levels.length
            ? ` Routine slots normally unlock at ${andList(levels.map(l => 'level ' + l))}.`
            : '';
        return {
            id: 'runs',
            title: 'When a run ends',
            what: [
                'When the church falls, the run is over. The game-over card shows what the run came to, what hit hardest, and what the next run keeps.',
                'You keep your habits, routines and heroes (with their levels), your open tasks and sub-tasks with their due dates, your run history, achievements and daily records, and your routine slots: a new run never starts with fewer slots than the most you have ever earned.' + unlockLine,
                'The run itself starts over: church health, level, XP and points, level perks, pushback charges, the village and the sky. Held items earned in the run (bought with its points, or gifted by a level perk or a village star) go with it; an item that cannot be earned again by playing is kept until you use it.',
                'An overdue task carried into a new run starts it at the church with a fresh clock, so the new run is not hit for the old run\'s unpaid time.',
            ],
            why: 'A fallen church should cost you the run, not your real to-do list or the routines you spent weeks building. Level, perks and items reset so each run is a fresh climb; slots stay because a routine you can no longer switch on is a routine you stop using.',
        };
    }

    // ---- Timers and Time Logged (Timer sessions Build C, 2026-11-04) -------------------------------------------
    function timersTopic(config) {
        const factor = config.WORK_TIMER_DAMAGE_FACTOR;
        const pct = Math.round(factor * 100);
        const checkMin = Math.round(config.WORK_TIMER_CHECK_MS / 60000);
        const stopMin = Math.round(config.WORK_TIMER_AUTO_STOP_MS / 60000);
        // 1 HP per the damage a running timer skips: the damage interval / (1 - factor) (js/timerSessions.js chargeIntervalMs).
        const takeBackMin = Math.round(config.DAMAGE_INTERVAL_MS / (1 - factor) / 60000);
        // Ice (docs/ICE_PLAN.md, 2026-11-10): the budget and the pause grace come from CONFIG.ICE_MAX_MS / ICE_GRACE_MS.
        const iceMin = Math.round((config.ICE_MAX_MS || 60 * 60000) / 60000);
        const graceMin = Math.round((config.ICE_GRACE_MS || 5 * 60000) / 60000);
        return {
            id: 'timers',
            title: 'Timers and Time Logged',
            what: [
                `Tap the stopwatch on a task or Build Habit to time it. While the timer runs, that zombie's damage to the church is cut to ${pct}% and its hero stands guard in front of the church. After ${checkMin} minutes the game asks "Still working?"; if nobody answers for ${stopMin} minutes the timer stops itself, counting time only up to the check.`,
                `A zombie already at the church is iced while you time it: it can't hit the church while the timer runs, for up to ${iceMin} minutes of ice per task in total. Then it hits at the reduced rate while the timer is still running. Pause keeps the ice for ${graceMin} more minutes; Stop thaws it at once. Only one timer runs at a time, so only one zombie is iced at a time.`,
                'Every Stop, Pause or auto-stop saves a session: when it started, when it stopped and how long. Time Logged is the total of your sessions. Open a task and look under Sessions to fix a start or stop time, delete a session, or add one you forgot (a session that crosses midnight counts toward both days). Time with no start and stop, such as a total you typed or time logged before sessions existed, shows as "No start/stop recorded".',
                'You can also type a Time Logged total, but never below your timed sessions. To remove timed time, edit its session.',
                `Shortening or deleting a session takes back the halved damage for the minutes it was running while its zombie was attacking: 1 HP for every ${takeBackMin} minutes (rounded down), never below 1 HP of church health. Making a session longer or adding one never gives HP back. Editing sessions never changes points, XP, or whether something was on time.`,
            ],
            why: 'Time Logged should match your real day, so your goals and daily records stay honest. Halved damage is a reward for working: it is taken back for time you did not really work, but never handed out for time you add.',
        };
    }

    // ---- Goals -------------------------------------------------------------------------------------------------
    // Goals (Build A-B2, 2026-11-05; docs/GOALS_PLAN.md). The slot ladder comes from CONFIG.GOAL_SLOTS_PER_LEVEL. The reward line is the
    // approved wording with NO numbers: the reward numbers are a balance pass before Goals Build C (DECISIONS), so none are quoted here.
    function slotLadder(table) {
        const levels = Object.keys(table || {}).map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
        if (!levels.length) return { start: 0, unlockLevels: [], cap: 0 };
        const start = Math.floor(table[levels[0]]);
        const unlockLevels = [];
        let top = start;
        levels.forEach((lv) => {
            const n = Math.floor(table[lv]);
            if (n > top) { unlockLevels.push(lv); top = n; }
        });
        return { start, unlockLevels, cap: top };
    }

    function levelWords(levels) {
        if (levels.length === 0) return '';
        if (levels.length === 1) return `Lv ${levels[0]}`;
        return `Lv ${levels.slice(0, -1).join(', ')} and ${levels[levels.length - 1]}`;
    }

    function goalsTopic(config) {
        const ladder = slotLadder(config.GOAL_SLOTS_PER_LEVEL);
        const themeTitle = (typeof Theme !== 'undefined' && Theme.strings && Theme.strings.goals && Theme.strings.goals.paneTitle) || '';
        const slotWord = ladder.start === 1 ? 'slot' : 'slots';
        const slotLine = ladder.unlockLevels.length
            ? `Start with ${ladder.start} ${slotWord}. More open up at ${levelWords(ladder.unlockLevels)}, up to ${ladder.cap}. A slot you unlock is yours for good, even after a run ends.`
            : `You have ${ladder.start} ${slotWord}.`;
        return {
            id: 'goals',
            title: 'Goals',
            what: [
                `Open the flag button${themeTitle ? ` to see your goals in ${themeTitle}` : ' to see your goals'}. Each goal sits in a slot. A goal has one or more targets: a number you move, a yes or no, tasks and Build Habits you finish, or a total from your days.`,
                `Repeating goals run every day, week or month. Meet the target in a period and the goal climbs a stage and your streak grows. Miss it and the goal slips one stage, never more than one at a time.`,
                `One-time goals climb as you make progress and finish when every target is full. A deadline is a pace marker, not a penalty: the dot shows whether you are ahead or behind, and nothing is lost if you run late.`,
                slotLine,
                `Goals, their streaks and your list of finished goals belong to you, not to the base. A lost run never touches them.`,
                ...(config && config.GOAL_REWARDS ? [PointsInfo.goalRewardLine(config), `Each goal can carry a reward you write yourself, such as a dinner out. The game does not give it: you claim it when you have earned it. A change to a repeating goal's targets starts with the next period.`] : []),
            ],
            why: `A goal gives the daily work a direction, and the stages make progress something you can see.`,
        };
    }

    // ---- Nights and momentum (Momentum Build B, 2026-11-11; docs/MOMENTUM_PLAN.md) ---------------------------------------------
    // Every number comes from CONFIG.MOMENTUM. Anything built against cheating is explained here (Jeremy): none of these rules depend on
    // secrecy.
    function momentumTopic(config) {
        const m = config.MOMENTUM || {};
        const windowNights = m.WINDOW_NIGHTS || 7;
        const minAge = Math.round((m.MIN_PRIORITY_AGE_MS != null ? m.MIN_PRIORITY_AGE_MS : 600000) / 60000);
        const states = (m.BARRICADE_STATES || []).slice().sort((a, b) => a.min - b.min);
        const stateLine = states.length
            ? `The barricade has ${states.length} states by momentum: ${states.map((s, i) => {
                const next = states[i + 1];
                const range = next ? (next.min - 1 > s.min ? `${s.min} to ${next.min - 1}` : `${s.min}`) : `${s.min}`;
                return `${s.name} (${range})`;
            }).join(', ')}.` : '';
        return {
            id: 'momentum',
            title: 'Nights and momentum',
            what: [
                `A night counts only when you defended it. A day is defended when you finish at least 1 priority task or fully complete at least 1 routine. A priority task has to be at least ${minAge} minutes old when you finish it, so making a task and finishing it at once does not count. It still pays its points. Finishing late still counts.`,
                `Nights Survived, the Radio tower, the Survivor badge and the tree count defended nights. A night you were away, or did nothing, adds nothing.`,
                `Momentum is how many of your last ${windowNights} nights you defended. Today counts as soon as you secure it, and a day you have not secured yet never lowers it. Days away count as missed, so momentum slides while you are gone and you rebuild it when you come back.`,
                `A Sick Day is skipped: it is not missed, and the count looks one night further back. Skip Day and Cheat Day cover one habit and do not change momentum.`,
                stateLine,
                `Tap the mark on Today in the week strip to open the Barricade.`,
            ].filter(Boolean),
            why: `Nights should show that you kept showing up, not that time passed. Counting a night only when you did something, and measuring the last ${windowNights}, rewards steady use without punishing a few off days.`,
        };
    }

    function topics(config) {
        const cfg = config || (typeof CONFIG !== 'undefined' ? CONFIG : {});
        return [pointsTopic(cfg), prioritiesTopic(cfg), pushbacksTopic(cfg), streaksTopic(cfg), heroTopic(cfg), achievementsTopic(cfg), weatherTopic(cfg), timersTopic(cfg), runsTopic(cfg), momentumTopic(cfg), goalsTopic(cfg)];
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
    const TOPIC_IDS = ['points', 'priorities', 'pushbacks', 'streaks', 'heroes', 'achievements', 'weather', 'timers', 'runs', 'momentum', 'goals'];

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
