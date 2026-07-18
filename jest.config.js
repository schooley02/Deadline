/**
 * Jest config for the unit suite (`npm test`).
 *
 * Deliberately minimal — see the 2026-07-18 DECISIONS.md entry:
 *
 * - **No `transform` override.** This previously forced `'babel-jest'`, which
 *   made it look like @babel/core + @babel/preset-env had to be devDependencies
 *   (they never got added, so the suite couldn't run). babel-jest IS Jest's
 *   default transform and ships with Jest, so the override was both redundant
 *   and the source of the confusion. Everything here is plain CommonJS
 *   (`require`/`module.exports`) running on modern Node — no preset needed.
 *
 * - **Coverage is opt-in** (`npm run test:coverage`), not part of `npm test`.
 *   It used to be on by default with 80% global thresholds, which would fail
 *   `npm test` even when every assertion passed: some extracted code is
 *   deliberately not unit-tested (e.g. `Spawning.addItemToGame` is DOM
 *   orchestration, verified by live playtest instead — see ARCHITECTURE.md).
 *   Re-introduce thresholds once Milestone 2 has pulled more logic out of
 *   script.js and the numbers can be met honestly.
 */
module.exports = {
  testEnvironment: 'node',

  // Only *.test.js / *.spec.js — keeps the puppeteer visual tests and helper
  // scripts in test/ (visual-tests.js, run-subtask-tests.js, manual-test-helper.js)
  // out of the unit run. Those have their own script: `npm run test:visual`.
  testMatch: [
    '<rootDir>/test/**/*.test.js',
    '<rootDir>/test/**/*.spec.js'
  ],

  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  moduleDirectories: ['node_modules', 'test'],

  clearMocks: true,
  verbose: true,
  testTimeout: 10000
};
