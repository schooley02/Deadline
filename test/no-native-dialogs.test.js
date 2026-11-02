/**
 * Guard (2026-11-01, Jeremy; docs/DIALOG_PLAN.md): the game draws its own dialogs. No new alert()/confirm()/prompt() calls.
 * ALLOWLIST = calls still to be migrated (Build 2: inline form validation; Build 3: errors), counted per file. The count must
 * match EXACTLY, so converting a call without lowering the number here also fails -- the list can only shrink. A genuine
 * system-level alert would be added here with a one-line reason.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ALLOWLIST = {
    'js/TaskManager.js': 1,        // D: error creating sub-task
    'js/ui/forms.js': 7,           // A: create-form validation
    'js/ui/popups.js': 8,          // A/D: edit / sub-task validation, parent not found
    'js/ui/routineViews.js': 19,   // A/D: routine create/edit validation, add/move pickers, move failure
    'script.js': 2,                // A/D: routine name, habit-already-in-routine
};

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

// bare alert( / confirm( / prompt( or window.alert( etc.; skips comment lines. `deps.alert(` is a passthrough that script.js
// routes to Dialog.notice, so it is not a native call.
const NATIVE = /(^|[^.\w$])(?:window\.)?(alert|confirm|prompt)\(/;
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
