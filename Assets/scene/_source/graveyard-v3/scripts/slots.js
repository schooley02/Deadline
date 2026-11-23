// usage: node slots.js <projectRoot> <canvasW> <canvasH> <baseW> <hillW>
const path = require('path');
const root = process.argv[2];
const CONFIG = require(path.join(root, 'js/config.js'));
const VL = require(path.join(root, 'js/villageLayout.js'));
const [cw, ch, bw, hw] = process.argv.slice(3).map(Number);
const o = VL.fromConfig(CONFIG);
const tiers = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3, habits: 3, bestdays: 3 };
console.log(JSON.stringify(VL.villageSlots(cw, ch, bw, hw, tiers, o)));
