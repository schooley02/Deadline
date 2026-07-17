/**
 * Clock — timeline positioning + midnight line (Milestone 2 extraction, 2026-07-17).
 *
 * Pure time/position math extracted from script.js (calculateTimelinePosition,
 * updateMidnightLine). Deliberately excludes offline catch-up, even though
 * docs/ARCHITECTURE.md's target layout lists it under clock.js — that logic
 * is tangled with damage application and DOM animation state
 * (offlineCatchUpActive, .catching-up class, applyOfflineDamage) and is
 * staying in script.js until the damage extraction instead of splitting a
 * freshly-playtested feature across two files. See docs/DECISIONS.md.
 *
 * script.js previously closed over GAME_SCREEN_WIDTH/BASE_WIDTH/ENEMY_WIDTH/
 * HABIT_ENEMY_WIDTH — module-scoped `let`s computed from the DOM in
 * initGame(). Extracted functions take them as an explicit `dims` object
 * instead of relying on a shared closure, matching persistence.js's pattern
 * of explicit inputs (dims = { gameScreenWidth, baseWidth, enemyWidth,
 * habitEnemyWidth }).
 *
 * Usage (see script.js):
 *   Clock.calculateTimelinePosition(item, currentTime, dims)
 *   Clock.updateMidnightLine(currentTime, dims, midnightLineElement?)
 */
const Clock = (() => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

    // Calculate position based on timeline system with 2-hour and 4-hour marks
    function calculateTimelinePosition(item, currentTime, dims) {
        const { gameScreenWidth, baseWidth, enemyWidth, habitEnemyWidth } = dims;
        const currentItemWidth = (item.type === 'habit') ? habitEnemyWidth : enemyWidth;
        const currentTimeMs = currentTime.getTime();
        const taskDueMs = item.dueDateTime.getTime();

        // Calculate next midnight from the task's due date, not current time
        const taskDueDate = new Date(item.dueDateTime);
        const nextMidnight = new Date(taskDueDate);
        nextMidnight.setDate(taskDueDate.getDate() + 1);
        nextMidnight.setHours(0, 0, 0, 0);

        // Available screen width for positioning (from base to right edge)
        const totalWidth = gameScreenWidth - baseWidth - currentItemWidth;

        if (taskDueMs <= currentTimeMs) {
            // Task is overdue - position at base
            return baseWidth;
        } else if (taskDueMs >= nextMidnight.getTime()) {
            // Task is due next day or later - initial position off-screen right
            return gameScreenWidth;
        } else {
            // Calculate position based on time remaining until due
            const timeToDue = taskDueMs - currentTimeMs;
            const timeUntilMidnight = nextMidnight.getTime() - currentTimeMs;

            if (timeToDue <= TWO_HOURS_MS) {
                // Within 2 hours: Position linearly from base (0%) to 50% of screen
                const progress = timeToDue / TWO_HOURS_MS; // 1 = due in 2 hours, 0 = due now
                return baseWidth + (totalWidth * 0.5 * progress);
            } else if (timeToDue <= FOUR_HOURS_MS) {
                // Between 2-4 hours: Position linearly from 50% to 75% of screen
                const progress = (timeToDue - TWO_HOURS_MS) / TWO_HOURS_MS; // 0 = due in 2 hours, 1 = due in 4 hours
                return baseWidth + (totalWidth * 0.5) + (totalWidth * 0.25 * progress);
            } else {
                // More than 4 hours: Position linearly from 75% to 100% of screen
                const remainingTime = timeUntilMidnight - FOUR_HOURS_MS;
                const progress = remainingTime > 0 ? (timeToDue - FOUR_HOURS_MS) / remainingTime : 0;
                return baseWidth + (totalWidth * 0.75) + (totalWidth * 0.25 * progress);
            }
        }
    }

    // Pure position math for the 8pm+ "midnight approaching" line.
    function calculateMidnightLinePosition(currentTime, dims) {
        const { gameScreenWidth, baseWidth } = dims;
        const midnight = new Date(currentTime);
        midnight.setHours(24, 0, 0, 0);
        const currentTimeMs = currentTime.getTime();
        const timeUntilMidnight = midnight.getTime() - currentTimeMs;
        const totalWidth = gameScreenWidth - baseWidth;

        if (timeUntilMidnight <= TWO_HOURS_MS) {
            // Within 2 hours: Position linearly from base to 50% of screen
            const progress = timeUntilMidnight / TWO_HOURS_MS;
            return baseWidth + (totalWidth * 0.5 * progress);
        } else if (timeUntilMidnight <= FOUR_HOURS_MS) {
            // Between 2-4 hours: Position linearly from 50% to 75% of screen
            const progress = (timeUntilMidnight - TWO_HOURS_MS) / TWO_HOURS_MS;
            return baseWidth + (totalWidth * 0.5) + (totalWidth * 0.25 * progress);
        } else {
            // More than 4 hours: Already off-screen right
            return gameScreenWidth;
        }
    }

    function shouldShowMidnightLine(currentTime) {
        return currentTime.getHours() >= 20;
    }

    // DOM side-effect wrapper — script.js calls this directly from the game loop.
    function updateMidnightLine(currentTime, dims, midnightLineElement) {
        const el = midnightLineElement || document.getElementById('midnightLine');
        if (!el) return;

        if (shouldShowMidnightLine(currentTime)) {
            el.style.display = 'block';
            el.style.left = calculateMidnightLinePosition(currentTime, dims) + 'px';
        } else {
            el.style.display = 'none';
        }
    }

    return {
        calculateTimelinePosition,
        calculateMidnightLinePosition,
        shouldShowMidnightLine,
        updateMidnightLine
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Clock;
}
