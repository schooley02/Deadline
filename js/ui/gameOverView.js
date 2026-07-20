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

    // record: the just-finalized runRecord (RunStats.finalizeRun shape), or
    // null/undefined if run-history deps weren't wired (defensive — mirrors
    // every other optional-collaborator fallback in this codebase).
    function buildReviewCardHtml(record, daysSurvived) {
        const dayLabel = daysSurvived === 1 ? 'Day' : 'Days';
        const blameRows = (record && record.blame) || [];
        const totals = record && record.totals;

        const totalsLine = totals
            ? `<div class="game-over-totals">${totals.tasksCompleted} tasks · ${totals.habitsCompleted} habits · ${totals.pointsEarned} pts earned</div>`
            : '';

        return `
            <div class="game-over-heading">GAME OVER! Your Base Survived ${daysSurvived} ${dayLabel}.</div>
            <div class="game-over-prompt">What adjustments can you make to have a stronger Base in your life?</div>
            ${totalsLine}
            <div class="game-over-blame-heading">What hit hardest</div>
            ${StatsView.buildBlameList(blameRows, BLAME_DISPLAY_LIMIT)}
        `;
    }

    // deps: { gameOverMessage, record, daysSurvived }
    function renderReviewCard(deps) {
        if (!deps.gameOverMessage) return;
        deps.gameOverMessage.innerHTML = buildReviewCardHtml(deps.record, deps.daysSurvived);
        // Sizing/layout hook — .message-overlay's base styling (big centered
        // bold one-liner) doesn't fit a card with lists; this class is the
        // CSS override (css/gameOverReview.css).
        deps.gameOverMessage.classList.add('game-over-review-active');
        deps.gameOverMessage.classList.remove('hidden');
    }

    return {
        buildReviewCardHtml,
        renderReviewCard,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameOverView;
}
