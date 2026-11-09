/**
 * @jest-environment jsdom
 */
/** Notice art (2026-11-09, Jeremy: a level-up window must show the thing it is about): village rewards, Clock tower, achievements, streaks. */
const fs = require('fs');
const path = require('path');
global.Modal = { open: jest.fn((html) => { document.body.insertAdjacentHTML('beforeend', html); }) };
const FrozenNotice = require('../js/ui/frozenNotice.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

beforeEach(() => { jest.useFakeTimers(); document.body.innerHTML = ''; Modal.open.mockClear(); });
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

describe('pure helpers', () => {
    test('headstoneUrl: stages 0..4 only, nothing for anything else', () => {
        expect(FrozenNotice.headstoneUrl(0)).toBe('Assets/scene/headstone-0.png');
        expect(FrozenNotice.headstoneUrl(4)).toBe('Assets/scene/headstone-4.png');
        [5, -1, NaN, 'x', null, undefined, ''].forEach((v) => expect(FrozenNotice.headstoneUrl(v)).toBe(''));
    });

    test('zombieUrl: the category zombie, spirituality uses the older file name, unknown = other', () => {
        expect(FrozenNotice.zombieUrl('career')).toBe('Assets/Zombies/career-zombie-64.png');
        expect(FrozenNotice.zombieUrl('spirituality')).toBe('Assets/Zombies/spiritual-zombie-64.png');
        expect(FrozenNotice.zombieUrl('nonsense')).toBe('Assets/Zombies/other-zombie-64.png');
        expect(FrozenNotice.zombieUrl(undefined)).toBe('Assets/Zombies/other-zombie-64.png');
    });

    test('artHtml: no path = no picture; a path is escaped', () => {
        expect(FrozenNotice.artHtml('')).toBe('');
        expect(FrozenNotice.artHtml(null, 'x')).toBe('');
        expect(FrozenNotice.artHtml('a"b.png', 'notice-art--thumb')).toContain('src="a&quot;b.png"');
    });

    test('every picture the helpers can name exists on disk', () => {
        ['other', 'career', 'creativity', 'financial', 'health', 'lifestyle', 'relationships', 'spirituality']
            .forEach((c) => expect(fs.existsSync(path.join(root, FrozenNotice.zombieUrl(c)))).toBe(true));
        [0, 1, 2, 3, 4].forEach((n) => expect(fs.existsSync(path.join(root, FrozenNotice.headstoneUrl(n)))).toBe(true));
    });
});

describe('village rewards window', () => {
    test('each row shows its building at the star it reached', () => {
        FrozenNotice.showVillageRewardNotice([
            { building: 'Command Post', star: 3, label: 'A ×1', spriteUrl: 'Assets/Village/slain_t3.png' },
            { building: 'Hospital', star: 2, label: 'B ×1', spriteUrl: 'Assets/Village/habits_t2.png' },
        ]);
        jest.advanceTimersByTime(10);
        const imgs = document.body.querySelectorAll('li.notice-art-row img.notice-art--thumb');
        expect(imgs).toHaveLength(2);
        expect(imgs[0].getAttribute('src')).toBe('Assets/Village/slain_t3.png');
        expect(document.body.innerHTML).toContain('Command Post ★★★: A ×1');
    });

    test('a row without a picture still lists as plain text', () => {
        FrozenNotice.showVillageRewardNotice([{ building: 'Hospital', star: 2, label: 'B ×1' }]);
        jest.advanceTimersByTime(10);
        expect(document.body.querySelector('img')).toBeNull();
        expect(document.body.innerHTML).toContain('Hospital ★★: B ×1');
    });
});

describe('Clock tower star-up window', () => {
    test('shows the Clock tower picture above the heading', () => {
        FrozenNotice.showClockTowerStarUpNotice(2, ['+1 Short pushback a day'], 'Assets/Village/punctuality_t2.png');
        jest.advanceTimersByTime(10);
        const img = document.body.querySelector('img.notice-art--building');
        expect(img.getAttribute('src')).toBe('Assets/Village/punctuality_t2.png');
        expect(img.compareDocumentPosition(document.body.querySelector('h3')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    test('stars earned together batch into one window showing the HIGHEST star', () => {
        document.body.innerHTML = '<div class="modal-overlay" id="other"></div>';
        FrozenNotice.showClockTowerStarUpNotice(2, ['a'], 'Assets/Village/punctuality_t2.png');
        FrozenNotice.showClockTowerStarUpNotice(3, ['b'], 'Assets/Village/punctuality_t3.png');
        document.getElementById('other').remove();
        jest.advanceTimersByTime(500);
        expect(Modal.open).toHaveBeenCalledTimes(1);
        expect(document.body.querySelector('img.notice-art--building').getAttribute('src')).toBe('Assets/Village/punctuality_t3.png');
    });

    test('no picture given = the old window, unchanged', () => {
        FrozenNotice.showClockTowerStarUpNotice(2, ['+1 Short pushback a day']);
        jest.advanceTimersByTime(10);
        expect(document.body.querySelector('img')).toBeNull();
        expect(document.body.innerHTML).toContain('Clock tower ★★');
    });
});

describe('achievement unlock window', () => {
    test('a family with a headstone shows the stone it reached; one without shows text only', () => {
        FrozenNotice.showAchievementUnlockNotice([
            { tierId: 'task_slayer_2', label: 'Silver', familyId: 'task_slayer', familyName: 'Task Slayer', headstoneStage: 2 },
            { tierId: 'back_in_black_1', label: null, familyId: 'back_in_black', familyName: 'Back in Black', headstoneStage: 0 },
        ]);
        jest.advanceTimersByTime(10);
        const imgs = document.body.querySelectorAll('img.notice-art--thumb');
        expect(imgs).toHaveLength(1); // stage 0 = "this family has no headstone" (the wooden cross is never a level-up)
        expect(imgs[0].getAttribute('src')).toBe('Assets/scene/headstone-2.png');
        expect(document.body.querySelectorAll('li')).toHaveLength(2);
    });

    test('an unlock with no stage at all (older caller) is still plain text', () => {
        FrozenNotice.showAchievementUnlockNotice([{ tierId: 't', label: 'Bronze', familyId: 'f', familyName: 'Fam' }]);
        jest.advanceTimersByTime(10);
        expect(document.body.querySelector('img')).toBeNull();
        expect(document.body.innerHTML).toContain('Achievement unlocked: Fam (Bronze)');
    });
});

describe('streak window', () => {
    test("shows the habit's category zombie with the fire glow", () => {
        FrozenNotice.showStreakMilestoneNotice('Run', 3, 'fire', 'health');
        jest.advanceTimersByTime(10);
        const img = document.body.querySelector('img.notice-art--zombie');
        expect(img.getAttribute('src')).toBe('Assets/Zombies/health-zombie-64.png');
        expect(img.classList.contains('notice-art--fire')).toBe(true);
    });

    test('blazing is hotter, and a spirituality habit uses the spiritual zombie file', () => {
        FrozenNotice.showStreakMilestoneNotice('Pray', 7, 'blazing', 'spirituality');
        jest.advanceTimersByTime(10);
        const img = document.body.querySelector('img.notice-art--zombie');
        expect(img.getAttribute('src')).toBe('Assets/Zombies/spiritual-zombie-64.png');
        expect(img.classList.contains('notice-art--blazing')).toBe(true);
    });

    test('a habit with no category falls back to the Other zombie', () => {
        FrozenNotice.showStreakMilestoneNotice('Walk', 3, 'fire');
        jest.advanceTimersByTime(10);
        expect(document.body.querySelector('img.notice-art--zombie').getAttribute('src')).toBe('Assets/Zombies/other-zombie-64.png');
    });
});

describe('wiring (source checks, like villageDrops-wiring)', () => {
    const script = read('script.js');
    const items = read('js/items.js');

    test('items.js hands the habit category to onStreakMilestone; script.js passes it on', () => {
        expect(items).toMatch(/deps\.onStreakMilestone\(habitDef\.name, habitDef\.streak, tier, habitDef\.category\)/);
        expect(script).toMatch(/onStreakMilestone: \(habitName, streak, tier, category\) =>/);
        expect(script).toMatch(/showStreakMilestoneNotice\(habitName, streak, tier, category\)/);
    });

    test('script.js gives the Clock tower, village reward and achievement windows their pictures', () => {
        expect(script).toMatch(/showClockTowerStarUpNotice\(star, gains, villageSpriteFor\('punctuality', star\)\.url\)/);
        expect(script).toMatch(/spriteUrl: villageSpriteFor\(g\.kind, g\.star\)\.url/);
        expect(script).toMatch(/headstoneStage: family \? MilestoneMarkers\.stageOf\(family, \{ \[u\.tierId\]: true \}\) : 0/);
    });

    test('the sprite for the Clock tower is the punctuality building, which exists at every star', () => {
        [1, 2, 3, 4, 5].forEach((n) => expect(fs.existsSync(path.join(root, `Assets/Village/punctuality_t${n}.png`))).toBe(true));
    });
});
