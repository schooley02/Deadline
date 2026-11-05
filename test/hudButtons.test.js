const HudButtons = require('../js/ui/hudButtons');

describe('HudButtons.openButtons', () => {
    const showing = (...selectors) => (sel) => selectors.includes(sel);

    test('nothing open -> no buttons pressed', () => {
        expect(HudButtons.openButtons(showing())).toEqual([]);
    });

    test('each window maps to the button that opens it', () => {
        expect(HudButtons.openButtons(showing('.base-panel-overlay'))).toEqual(['baseHealthButton']);
        expect(HudButtons.openButtons(showing('.level-panel-overlay'))).toEqual(['levelButton']);
        expect(HudButtons.openButtons(showing('#heroTray.open'))).toEqual(['heroesButton']);
        expect(HudButtons.openButtons(showing('#goalsPane.open'))).toEqual(['goalsButton']);
        expect(HudButtons.openButtons(showing('#shopWindow:not(.hidden)'))).toEqual(['playerPointsStat']);
    });

    test('the village panel and its building cards both keep the village button pressed', () => {
        expect(HudButtons.openButtons(showing(HudButtons.WINDOWS.villageButton))).toEqual(['villageButton']);
    });

    test('every selector in the map is used for exactly one button', () => {
        const sels = Object.values(HudButtons.WINDOWS);
        expect(new Set(sels).size).toBe(sels.length);
        expect(Object.keys(HudButtons.WINDOWS).sort()).toEqual(['baseHealthButton', 'goalsButton', 'heroesButton', 'levelButton', 'playerPointsStat', 'villageButton']);
    });
});
