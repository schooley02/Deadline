/**
 * Routine level-up modal shows the routine's category hero `levelup` animation (2026-10-26).
 * js/ui/frozenNotice.js showHeroStarUpNotice(name, stars, heroCategory) -> HeroSpotlight.levelUpArtHtml.
 */
const fs = require('fs');
const path = require('path');
global.Heroes = require('../js/heroes.js');
global.CONFIG = require('../js/config.js');
const HeroSpotlight = require('../js/ui/heroSpotlight.js');
global.HeroSpotlight = HeroSpotlight;
const FrozenNotice = require('../js/ui/frozenNotice.js');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css/heroSpotlight.css'), 'utf8');
const ART = CONFIG.HERO_ART_CATEGORIES;

describe('HeroSpotlight.levelUpArtHtml', () => {
    test.each(ART)('%s: a looping levelup sprite for its category', (cat) => {
        const html = HeroSpotlight.levelUpArtHtml(cat, CONFIG);
        expect(html).toContain(`class="hero-notice-art" data-category="${cat}"`);
        expect(html).toContain('data-anim="levelup"');
        expect(html).toContain('hero-sprite-sheet');
    });
    test('a category without hero art gets no art (text-only notice)', () => {
        expect(HeroSpotlight.levelUpArtHtml('other', { ...CONFIG, HERO_ART_CATEGORIES: [] })).toBe('');
        expect(HeroSpotlight.levelUpArtHtml('nonsense', CONFIG)).toBe('');
    });
});

describe('css for the notice art', () => {
    test.each(ART)('%s: the notice wrapper has the same sprite sheet as the spotlight hero', (cat) => {
        expect(css).toMatch(new RegExp(`\\.hero-notice-art\\[data-category="${cat}"\\] \\.hero-sprite-sheet \\{ background-image: url\\('\\.\\./Assets/Heroes/anim/${cat}\\.png'\\); \\}`));
        expect(css).toMatch(new RegExp(`\\.hero-spotlight\\[data-category="${cat}"\\] \\.hero-sprite-sheet \\{ background-image: url\\('\\.\\./Assets/Heroes/anim/${cat}\\.png'\\); \\}`));
    });
    test('the levelup row is looped in the modal and still uses row 3', () => {
        expect(css).toMatch(/\.hero-notice-art \.hero-sprite\[data-anim="levelup"\] \.hero-sprite-sheet \{\s*animation-iteration-count: infinite;/);
        expect(css).toMatch(/\.hero-sprite\[data-anim="levelup"\] \{ --hero-row: 3; \}/);
    });
});

describe('showHeroStarUpNotice', () => {
    let opened;
    beforeEach(() => { opened = []; global.Modal = { open: (html, opts) => opened.push({ html, opts }) }; });
    afterEach(() => { delete global.Modal; });

    test.each(ART)('%s: the modal carries that routine\'s level-up hero above the heading', (cat) => {
        FrozenNotice.showHeroStarUpNotice('Study', 3, cat);
        expect(opened).toHaveLength(1);
        const html = opened[0].html;
        expect(html).toContain(`data-category="${cat}"`);
        expect(html.indexOf('hero-notice-art')).toBeLessThan(html.indexOf('<h3>'));
        expect(html).toContain('★★★ Study leveled up its rating');
    });
    test('without a hero category it is the old text-only notice', () => {
        FrozenNotice.showHeroStarUpNotice('Study', 1);
        expect(opened[0].html).not.toContain('hero-notice-art');
        expect(opened[0].html).toContain('Study is now rated 1 star');
    });
});
