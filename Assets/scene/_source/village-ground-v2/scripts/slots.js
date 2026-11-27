const path = process.argv[2];
const CONFIG = require(path + '/js/config.js');
global.CONFIG = CONFIG;
const VL = require(path + '/js/villageLayout.js');
const o = VL.fromConfig(CONFIG);
const tiers = { punctuality: 3, defense: 3, slain: 3, nights: 3, lurkers: 3, heroes: 3, habits: 3, bestdays: 3, goals: 3 };
const c = JSON.parse(process.argv[3]);
console.log(JSON.stringify(VL.villageSlots(c.W, c.H, c.baseW, 120, tiers, o)));
