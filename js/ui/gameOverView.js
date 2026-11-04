/**
 * GameOverView — the game-over review card (RUN_HISTORY_PLAN.md sub-session
 * 4, 2026-07-19/20 session 55). Replaces the old one-line "GAME OVER! Your
 * Base Survived X Days." text with a card: the encouraging framing copy
 * GAME_DESIGN.md/UI_UX.md have specified since the original spec but that
 * was never actually wired in ("What adjustments can you make to have a
 * stronger Base in your life?"), the run totals, and the top-5 blame list
 * for the run that just ended.
 *
 * Sibling js/ui/ module — calls StatsView.buildBlameList directly as a bare
 * global (same convention managementWindows.js already uses for ShopView/
 * StatsView: both load well before any game-over can fire, so there's no
 * forward-reference risk). What IS forward-reference-sensitive is the other
 * direction — js/damage.js's gameOver() calling INTO this file — since
 * damage.js loads before js/ui/*.js in index.html. That's why script.js
 * threads this in as an injected `renderGameOverReview` dep (buildDamageDeps
 * passthrough) rather than damage.js bare-global-referencing GameOverView,
 * matching the existing damageRoutineForItem/recordRunDamage/
 * heroesCompletionRate precedent in that file. Damage.gameOver() still does
 * its own plain-text fallback when the dep is omitted (every existing damage
 * test), so this module has zero coupling back into damage.js's tests.
 */
const GameOverView = (() => {

    // How many blame rows to show — more generous than the Stats window's
    // live/past-run panels (3) since this is a single, high-attention,
    // once-per-run screen rather than a scannable list.
    const BLAME_DISPLAY_LIMIT = 5;

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

    // Run-end carryover (2026-11-03, docs/RUN_CARRYOVER_PLAN.md): two short lists so the player knows,
    // before they press Restart, what the next run keeps and what it loses. `carry` is
    // RunCarryover.summary(...) from script.js; '' when it is absent (older callers, damage tests).
    function buildCarryoverHtml(carry) {
        if (!carry || typeof carry !== 'object') return '';
        const kept = [];
        kept.push('Your habits, routines and heroes (their levels too)');
        if (carry.openTasks > 0) {
            const subs = carry.openSubTasks > 0 ? ` and ${carry.openSubTasks} ${plural(carry.openSubTasks, 'sub-task')}` : '';
            kept.push(`${carry.openTasks} open ${plural(carry.openTasks, 'task')}${subs}, with their due dates`);
        } else {
            kept.push('Any open tasks you add before restarting');
        }
        kept.push(`${carry.routineSlots} routine ${plural(carry.routineSlots, 'slot')}: you never start a run with fewer than your best`);
        (carry.keptItems || []).forEach(k => kept.push(`${k.name} x${k.count} (kept until you use it)`));
        kept.push('Run history, achievements and your daily records');

        const lost = [];
        lost.push('Church health, level, XP and points');
        lost.push(carry.resetItems > 0
            ? `${carry.resetItems} held ${plural(carry.resetItems, 'item')} from this run's points, level perks and village stars`
            : 'Items from points, level perks and village stars (you hold none)');
        lost.push('Level perks, pushback charges, the village and the sky');

        const list = (rows) => `<ul class="game-over-carry-list">${rows.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`;
        return `
            <div class="game-over-carry">
                <div class="game-over-carry-heading">Next run</div>
                <div class="game-over-carry-col"><div class="game-over-carry-label game-over-carry-label--kept">You keep</div>${list(kept)}</div>
                <div class="game-over-carry-col"><div class="game-over-carry-label game-over-carry-label--lost">Starts over</div>${list(lost)}</div>
            </div>`;
    }

    // record: the just-finalized runRecord (RunStats.finalizeRun shape), or
    // null/undefined if run-history deps weren't wired (defensive — mirrors
    // every other optional-collaborator fallback in this codebase).
    // carry: optional RunCarryover.summary (see buildCarryoverHtml).
    function buildReviewCardHtml(record, daysSurvived, carry) {
        const dayLabel = daysSurvived === 1 ? 'Night' : 'Nights';
        const blameRows = (record && record.blame) || [];
        const totals = record && record.totals;

        const totalsLine = totals
            ? `<div class="game-over-totals">${totals.tasksCompleted} tasks · ${totals.subtasksCompleted ? `${totals.subtasksCompleted} sub-tasks · ` : ''}${totals.habitsCompleted} habits · ${totals.pointsEarned} pts earned${totals.reschedules ? ` · ${totals.reschedules} rescheduled` : ''}</div>`
            : '';

        // Level-perk title (2026-10-23): a run that reached max level ends with
        // its Steward title on the card. '' for everyone else.
        const titleBadge = record ? StatsView.buildTitleBadge(record, 'game-over-title-badge') : '';
        const titleLine = titleBadge ? `<div class="game-over-title">${titleBadge}</div>` : '';

        // Village Build 3 (2026-10-30): the village at its peak. '' for older records / no village module.
        const villageStrip = (record && record.peakVillageTiers && typeof VillagePanel !== 'undefined')
            ? VillagePanel.peakStripHtml(record.peakVillageTiers)
            : '';

        return `
            <div class="game-over-heading">GAME OVER! Your Base Survived ${daysSurvived} ${dayLabel}.</div>
            ${titleLine}
            <div class="game-over-prompt">What adjustments can you make to have a stronger Base in your life?</div>
            ${totalsLine}
            ${villageStrip}
            <div class="game-over-blame-heading">What hit hardest</div>
            ${StatsView.buildBlameList(blameRows, BLAME_DISPLAY_LIMIT)}
            ${buildCarryoverHtml(carry)}
        `;
    }

    // deps: { gameOverMessage, record, daysSurvived, carry? }
    function renderReviewCard(deps) {
        if (!deps.gameOverMessage) return;
        deps.gameOverMessage.innerHTML = buildReviewCardHtml(deps.record, deps.daysSurvived, deps.carry);
        // Sizing/layout hook — .message-overlay's base styling (big centered
        // bold one-liner) doesn't fit a card with lists; this class is the
        // CSS override (css/gameOverReview.css).
        deps.gameOverMessage.classList.add('game-over-review-active');
        deps.gameOverMessage.classList.remove('hidden');
    }

    return {
        buildReviewCardHtml,
        buildCarryoverHtml,
        renderReviewCard,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameOverView;
}
