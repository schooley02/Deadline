/**
 * Jest setup — runs before each test file (jest.config.js setupFilesAfterEnv).
 *
 * This file existing at all is the point: jest.config.js has referenced it
 * since the original July 2025 setup, but it was never created, so every Jest
 * run failed to start. Sessions worked around it by stubbing the file in a
 * sandbox copy instead of fixing the repo (see HANDOFF 2026-07-17/18).
 *
 * Intentionally near-empty. The modules under test (js/config.js, js/clock.js,
 * js/movement.js, js/spawning.js) are plain CommonJS with no global side
 * effects, and each test file binds whatever globals it needs itself — e.g.
 * movement.test.js does `global.CONFIG = require('../js/config.js')` because
 * js/movement.js reads CONFIG and Clock as globals (they come from <script>
 * tags in the browser). Keeping that wiring in the test files makes each one
 * readable on its own, so don't move it here.
 *
 * Good things to add here later: shared custom matchers, a fake-timer default,
 * or a global console guard. Anything added here affects EVERY test file.
 */

// Keep unhandled promise rejections from being silently swallowed in tests.
process.on('unhandledRejection', (reason) => {
    throw reason;
});
