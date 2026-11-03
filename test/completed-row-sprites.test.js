/**
 * Completed rows get the category zombie, in greyscale (2026-11-03).
 *
 * Before: the sprite rules were scoped to `.task-list`, so the Completed list's sprite column was empty (and its
 * name column narrow). The list PNGs (`Assets/Zombies/<cat>-zombie.png`, 128px, and `-64.png`) were also the OLD art;
 * they are now the idle frame of each animated atlas the canvas draws, so a row's zombie matches the board's.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// category id -> list PNG base name (spirituality's file is "spiritual")
const CATEGORY_FILES = {
    career: 'career', creativity: 'creativity', financial: 'financial', health: 'health',
    lifestyle: 'lifestyle', relationships: 'relationships', spirituality: 'spiritual', other: 'other',
};

function pngSize(rel) {
    const buf = fs.readFileSync(path.join(root, rel));
    // PNG signature, then the IHDR chunk: width and height are big-endian uint32 at bytes 16 and 20.
    expect(buf.slice(1, 4).toString('ascii')).toBe('PNG');
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const css = read('css/agendaList.css');

// the block for one selector list: from the selector text to the closing brace
function ruleFor(selectorStart) {
    const i = css.indexOf(selectorStart);
    if (i === -1) return null;
    return css.slice(i, css.indexOf('}', i) + 1);
}

describe('Completed rows draw the category sprite', () => {
    test.each(Object.entries(CATEGORY_FILES))('%s: the completed list shares the active list\'s sprite rule', (cat, file) => {
        const rule = ruleFor(`.task-list li.category-${cat} .item-sprite,\n.completed-tasks-list li.category-${cat} .item-sprite {`);
        expect(rule).not.toBeNull();
        expect(rule).toContain(`url('../Assets/Zombies/${file}-zombie.png')`);
    });

    test('the sprites are greyscale in the completed list only', () => {
        const rule = ruleFor('.completed-tasks-list li .item-sprite {');
        expect(rule).toMatch(/filter:\s*grayscale\(1\)/);
        // the active list keeps its colour
        expect(css).not.toMatch(/\.task-list li[^{]*\.item-sprite[^{]*\{[^}]*grayscale/);
    });

    test('nested completed sub-tasks use the smaller 32px sprite, after the category rules so it wins', () => {
        const sub = css.indexOf('.completed-tasks-list li.completed-sub-item .item-sprite {\n    background-size: 32px 32px;');
        expect(sub).toBeGreaterThan(-1);
        expect(sub).toBeGreaterThan(css.indexOf('.completed-tasks-list li.category-other .item-sprite {'));
    });

    test('the pseudo-element placeholder is hidden in the completed list too', () => {
        expect(css).toMatch(/\.completed-tasks-list li \.item-sprite::before\s*\{\s*display:\s*none/);
    });
});

describe('list sprite files (the idle frame of the animated art)', () => {
    test.each(Object.entries(CATEGORY_FILES))('%s: 128px and 64px PNGs exist at the expected sizes', (cat, file) => {
        expect(pngSize(`Assets/Zombies/${file}-zombie.png`)).toEqual({ w: 128, h: 128 });
        expect(pngSize(`Assets/Zombies/${file}-zombie-64.png`)).toEqual({ w: 64, h: 64 });
    });

    test('the service worker still caches every list sprite', () => {
        const sw = read('sw.js');
        Object.values(CATEGORY_FILES).forEach((file) => {
            expect(sw).toContain(`'Assets/Zombies/${file}-zombie.png'`);
            expect(sw).toContain(`'Assets/Zombies/${file}-zombie-64.png'`);
        });
    });
});
