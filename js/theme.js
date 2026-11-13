/**
 * Theme -- the ONE place Deadline's words and art paths for the Baseline engine's features live (Jeremy, 2026-11-04;
 * docs/GOALS_PLAN.md "Baseline seam", CLAUDE.md "Baseline vs Deadline").
 *
 * Baseline is the engine; Deadline (zombies, a church, a village, a lab) is the first game/theme built on it. New engine code
 * (goals so far) says "goal / slot / stage / subject / container" and reads every player-facing theme word and every sprite path
 * through here, so a second theme only has to supply another copy of this table plus the sprites it names. Theme words (zombie,
 * cure, survivor, vat, lab, church, patient) must NOT appear in js/goals*.js, js/ui/goal*.js or css/goal*.css -- the second scan in
 * test/wording-rule.test.js fails if they do. The rest of the engine is not migrated yet (its own session after pre-alpha).
 *
 * Pure data + two tiny helpers: no DOM, no State, no CONFIG reads.
 */
const Theme = (() => {
    const strings = {
        // Journal (Build B, 2026-11-13): the game's own name, used where a note is about the game itself ("Note about Deadline").
        journal: { gameName: 'Deadline' },
        goals: {
            paneTitle: 'The Lab',
            subject: 'Patient',
            subjectPlural: 'Patients',
            finished: 'Survivor',
            finishedPlural: 'Survivors',
            verb: 'Cure',
            completeLine: 'Cured.',
            // "{name}" is replaced by fill().
            completeJoin: '{name} is now one of your survivors.',
            retireNote: 'moves to your survivors list with its streak',
            // "{level}" is replaced by fill().
            lockedLine: 'Unlocks at Lv {level}',
        },
        // Level-perk names that are theme words (2026-11-09): CONFIG.LEVEL_PERKS keeps an empty label for these, Theme.perkLabel
        // supplies it. The tagline is the honesty line: the pick changes the picture, never the run's real climate (Jeremy, "for now").
        perks: {
            skyPicker: { name: 'Geo Storm', tagline: 'You control the weather (visuals only)' },
        },
        // Sky unlock requirements (W1d, 2026-11-09): the line under a locked sky in the Weather panel. Building names are theme words,
        // so they live here and never in SkyPick or the panel. Placeholders: {level}, {building}, {tier}.
        skyUnlocks: {
            level: 'Player Lv {level}',
            star: '{building} star {tier}',
            buildings: { nights: 'Radio tower', defense: 'Jailhouse', bestdays: 'Windmill' },
        },
        // Milestone markers (2026-11-08; js/milestoneMarkers.js, js/ui/markerPanel.js): the small stones on the graveyard hill that show the
        // all-time achievements. Placeholders: {name}, {tier}, {value}, {threshold}, {unit}.
        markers: {
            paneTitle: 'Headstones',
            rule: 'Each stone marks one of your all-time records. It gets nicer as you earn Bronze, Silver, Gold and Platinum, and it never goes back. Only Reset Game starts them over.',
            noBadge: 'No badge yet',
            openLabel: '{name}, {tier}. Open',
            progress: '{value} of {threshold} {unit} to reach {tier}.',
            maxed: '{tier} reached. This is the top tier.',
            // The picture for a family's stage 0 is a plain wooden cross.
            linkSummary: '{earned} of {total} earned',
            linkLabel: 'Headstones, {earned} of {total} earned. Open',
        },
    };

    // Sprite paths for the Goals pane. One footprint, six subject stages (T0 = the start, T5 = finished) and an exit strip
    // (a horizontal frame strip played once when a goal completes). exitFrames / exitFps are placeholders until the art lands.
    const assets = {
        goals: {
            root: 'Assets/Goals',
            container: 'container.png',
            containerLocked: 'container_locked.png',
            containerEmpty: 'container_empty.png',
            subjectStages: ['subject_T0.png', 'subject_T1.png', 'subject_T2.png', 'subject_T3.png', 'subject_T4.png', 'subject_T5.png'],
            exit: 'subject_exit_anim.png',
            exitFrames: 8,
            exitFps: 8,
        },
        // Barricade (Momentum Build C, 2026-11-11): one picture per barricade state id (CONFIG.MOMENTUM.BARRICADE_STATES), 80x48 drawn at 2x (it wraps the church, front-left end to the back of the lane).
        // A second theme supplies its own four files (a palisade, wards ...) under its own root.
        barricade: {
            root: 'Assets/Barricade',
            file: 'barricade_{id}.png',
        },
    };

    /** Replaces {name} placeholders in a theme string. */
    function fill(text, vars) {
        return String(text == null ? '' : text).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? String(vars[k]) : m));
    }

    /** Full path of a Goals-pane sprite: kind = 'container' | 'containerLocked' | 'containerEmpty' | 'exit' | 'subject' (stage 0..5). */
    function goalAsset(kind, stage) {
        const a = assets.goals;
        let file;
        if (kind === 'subject') {
            const n = Math.max(0, Math.min(a.subjectStages.length - 1, Math.floor(Number(stage)) || 0));
            file = a.subjectStages[n];
        } else {
            file = a[kind];
        }
        return file ? a.root + '/' + file : '';
    }

    /** Full path of the barricade picture for a state id ('none' | 'partial' | 'solid' | 'reinforced'); '' for a missing id. */
    function barricadeAsset(stateId) {
        const a = assets.barricade;
        const id = String(stateId == null ? '' : stateId).replace(/[^a-z0-9_-]/gi, '');
        return id ? a.root + '/' + fill(a.file, { id }) : '';
    }

    /** A level perk's player-facing line: its own label, else the theme's "Name: tagline" for its unlock key ('' when neither). */
    function perkLabel(perk) {
        if (!perk) return '';
        if (perk.label) return String(perk.label);
        const t = perk.unlock && strings.perks[perk.unlock];
        return t ? t.name + ': ' + t.tagline : '';
    }

    /** A SKY_UNLOCKS rule ({ level } or { kind, tier }) -> its player-facing requirement ('' for a malformed rule). */
    function skyRequirement(rule) {
        const t = strings.skyUnlocks;
        if (!rule || typeof rule !== 'object') return '';
        if (Number.isFinite(rule.level)) return fill(t.level, { level: rule.level });
        const building = t.buildings[rule.kind];
        if (building && Number.isFinite(rule.tier)) return fill(t.star, { building, tier: rule.tier });
        return '';
    }

    return { strings, assets, fill, goalAsset, barricadeAsset, perkLabel, skyRequirement };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Theme;
}
