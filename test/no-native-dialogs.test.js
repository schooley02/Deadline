/**
 * Guard (2026-11-01, Jeremy; docs/DIALOG_PLAN.md): the game draws its own dialogs. No new alert()/confirm()/prompt() calls.
 * ALLOWLIST is EMPTY (Builds 1-3 done 2026-11-01): ANY alert()/confirm()/prompt() in script.js or js/ fails this test. A genuine
 * system-level alert (storage blocked, a crash before the UI exists) would be added here as 'path': count with a one-line reason.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ALLOWLIST = {};

function sourceFiles() {
    const out = ['script.js'];
    (function walk(dir) {
        fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach(e => {
            const rel = `${dir}/${e.name}`;
            if (e.isDirectory()) walk(rel);
            else if (e.name.endsWith('.js')) out.push(rel);
        });
    })('js');
    return out;
}

// bare alert( / confirm( / prompt( or window.alert( etc.; skips comment lines. A `deps.alert(` passthrough is flagged too: it is
// gone (routines.js takes a `notice` dep now), so nothing should bring it back.
const NATIVE = /(^|[^.\w$])(?:window\.)?(alert|confirm|prompt)\(|\bdeps\.alert\(/;
function countNative(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/).filter(line => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        if (/function\s+(alert|confirm|prompt)\s*\(/.test(line)) return false; // a definition (Dialog.confirm), not a call
        return NATIVE.test(line);
    }).length;
}

describe('no native browser dialogs', () => {
    const counts = {};
    sourceFiles().forEach(f => { const n = countNative(f); if (n) counts[f] = n; });

    test('every file is within its allowlisted count, and nothing new appears', () => {
        expect(counts).toEqual(ALLOWLIST);
    });
});
