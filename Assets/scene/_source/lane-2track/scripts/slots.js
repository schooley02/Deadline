const path = process.argv[2];
const CONFIG = require(path + '/js/config.js');
global.CONFIG = CONFIG;
const VL = require(path + '/js/villageLayout.js');
const o = VL.fromConfig(CONFIG);
const tiers = { punctuality:3, defense:3, slain:3, nights:3, lurkers:3, heroes:3, habits:3, bestdays:3 };
const cases = JSON.parse(process.argv[3]);
const out = {};
for (const c of cases) {
  const oo = Object.assign({}, o, { floorHeightPx: c.floorH });
  out[c.name] = VL.villageSlots(c.W, c.H, c.baseW, 140, tiers, oo);
}
console.log(JSON.stringify({ slots: out, feetInset: CONFIG.ZOMBIE_FEET_INSET, clear: CONFIG.FEET_LINE_CLEARANCE_PX, margins: CONFIG.ZOMBIE_VISIBLE_MARGINS, gap: CONFIG.FRONT_LINE_GAP_PX, hillH: CONFIG.GRAVEYARD_HILL_HEIGHT_PX, defaults: {floor:o.floorHeightPx, feetAbove:o.feetAboveFloorPx, drop:o.feetMaxDropPx, clockArtH:o.clockArtHeightPx} }));
