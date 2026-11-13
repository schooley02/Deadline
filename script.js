document.addEventListener('DOMContentLoaded', () => {

    // Nights Survived cache (Momentum Build A): declared FIRST because GraveyardView.init below reads the tree stage (-> nightsSurvivedNow) on its
    // first render, before the rest of this file's consts exist (a later declaration threw a TDZ error, caught, and fell back to calendar nights).
    const nightsCache = { daysKey: null, days: null, key: null, value: 0 };

    // --- DOM Elements ---
    const gameCanvas = document.getElementById('gameCanvas');
    const baseElement = document.getElementById('base');
    // Portrait glance strip (V3b-1, 2026-10-13): applies body.glance-strip NOW,
    // before initGame() measures the canvas/base, and re-measures on every
    // resize/rotation (onChange -> refreshLayoutDims, a hoisted function below;
    // it only runs on a later event, after the lets it touches are initialized).
    Layout.init({ onChange: (isStrip, modeChanged) => refreshLayoutDims(isStrip, modeChanged) });
    // Graveyard zone (V7 W0, 2026-10-28): the right-hand hill + past-run graves. Initialised right
    // after Layout so its width is known BEFORE initGame() measures the canvas; the zombie field
    // ends where the hill starts (zoneWidth() is 0 in the portrait strip). Deps are lazy closures.
    GraveyardView.init({
        getRunHistory: () => State.getRunHistory(),
        getMemorialStage: () => memorialStageNow(),
        getTreeStage: () => treeStageNow(),
        onOpenMemorial: () => openMemorialPanel(),
        onOpenTree: () => openTreePanel(),
        getMarkers: () => markersNow(),
        onOpenMarkers: (id) => openMarkerPanel(id),
        onOpenStats: () => openManagementWindow('stats'),
    });
    // Achievement village (V7 W2): eight buildings on the horizon hill. Build 2 (2026-10-30): each building's tier is
    // the REAL per-run tier from VillageProgress (a new game = a T1 village); the DEV URL params (?villageTier=,
    // ?jailTier=, ?armoryTier=, ?radioTier=, ?gymTier=, ?schoolTier=, ?hospitalTier=, ?windmillTier= = 1..5 | off)
    // still override it for art checks. Tapping a building opens its card (js/ui/villageCard.js).
    // The tier maths is cached: it re-runs only when a counter it reads changes (VillageView.render runs every tick).
    const villageCache = { key: null, progress: null, daysKey: null, days: null };
    // Nights Survived (Momentum Build A, 2026-11-11; js/momentum.js, docs/MOMENTUM_PLAN.md): the ONE number the moon, game over, the Radio
    // tower, the tree and the run stats read = the nights the run DEFENDED (a priority finished, old enough, or a routine fully done), plus the
    // calendar nights a save already had before the rule started on it. The closed days are read once per open day / run change; the sum is
    // cached by the calendar date (a night only ever counts at a rollover).
    function nightsSurvivedNow(nowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        try {
            const today = State.getToday();
            const runNumber = (State.getRunHistory() || []).length + 1;
            const daysKey = (today && today.date ? today.date : '') + '|' + runNumber;
            if (nightsCache.daysKey !== daysKey) {
                nightsCache.days = State.getClosedDays();
                nightsCache.daysKey = daysKey;
                nightsCache.key = null;
            }
            const fromDay = State.getMomentumFromDay();
            const key = [Momentum.keyOf(now), State.getRunStartedAtMs(), fromDay].join('|');
            if (nightsCache.key !== key) {
                nightsCache.value = Momentum.nights({ runStartMs: State.getRunStartedAtMs(), nowMs: now, days: nightsCache.days, runNumber, fromDay });
                nightsCache.key = key;
            }
            return nightsCache.value;
        } catch (err) {
            console.error('Deadline: nights survived failed', err);
            return Damage.computeDaysSurvived(State.getRunStartedAtMs(), now, CONFIG.MS_PER_REAL_DAY);
        }
    }
    // Momentum (Build B, 2026-11-11): defended nights among the last 7 + the barricade state (Momentum.momentum). Today counts the moment it is
    // secured; a pending today never lowers it. Feeds the week strip's mark and the Barricade window.
    function momentumNow(nowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        try {
            const m = CONFIG.MOMENTUM || {};
            return Momentum.momentum({
                nowMs: now, runStartMs: State.getRunStartedAtMs(), runNumber: (State.getRunHistory() || []).length + 1,
                days: State.getClosedDays(), todayRec: State.getToday(),
                windowNights: m.WINDOW_NIGHTS, maxLookbackDays: m.MAX_LOOKBACK_DAYS, states: m.BARRICADE_STATES,
            });
        } catch (err) {
            console.error('Deadline: momentum failed', err);
            return null;
        }
    }
    // Barricade damage cut (Build C, 2026-11-11): the share of zombie damage the barricade takes right now (0 at None / Partial, 0.1 Solid, 0.2
    // Reinforced; CONFIG.MOMENTUM.BARRICADE_STATES `damageCut`). Live loop only. Momentum reads the closed days, so it is cached for a few
    // seconds; the cut is asked only on a tick where a zombie could hit.
    const barricadeCutCache = { at: 0, cut: 0 };
    function barricadeDamageCut() {
        const now = Date.now();
        if (now - barricadeCutCache.at < 5000) return barricadeCutCache.cut;
        const info = momentumNow(now);
        barricadeCutCache.cut = info ? Momentum.damageCut(info.state.id, (CONFIG.MOMENTUM || {}).BARRICADE_STATES) : 0;
        barricadeCutCache.at = now;
        return barricadeCutCache.cut;
    }
    // The barricade on the canvas (Build C): follows the momentum state, redrawn only when the state id changes. Called from the game tick,
    // at most every 2 s (momentum reads the closed days). The tap opens the same window as the week-strip mark.
    let barricadeViewAt = 0;
    let barricadeDevPick = null; // DEV panel preview (2026-11-12): a barricade state id to SHOW, picture only (set through DevPanel's onBarricade)
    function refreshBarricadeView(force) {
        const now = Date.now();
        if (!force && now - barricadeViewAt < 2000) return;
        barricadeViewAt = now;
        let info = momentumNow(now);
        // DEV preview (visual only, like ?armoryTier=): ?barricade=none|partial|solid|reinforced shows that picture. It changes nothing else:
        // the damage cut, the window and momentum still use the real state.
        try {
            const want = barricadeDevPick || new URLSearchParams(window.location.search).get('barricade');
            const row = want && ((CONFIG.MOMENTUM || {}).BARRICADE_STATES || []).find((r) => r.id === want);
            if (row && info) info = Object.assign({}, info, { state: { id: row.id, name: row.name, min: row.min }, count: row.min });
        } catch (err) { /* no preview */ }
        if (info) BarricadeView.render(info);
    }
    function openBarricadeWindow() {
        const info = momentumNow();
        if (info) BarricadeWindow.open(info);
    }
    function villageContext() {
        const runStats = State.getCurrentRunStats() || {};
        const today = State.getToday() || null;
        const runNumber = (State.getRunHistory() || []).length + 1;
        const daysKey = (today && today.date ? today.date : '') + '|' + runNumber;
        // The closed-days store only changes at a day rollover or a game over, so read it once per such change.
        if (villageCache.daysKey !== daysKey) {
            villageCache.days = Persistence.loadDays();
            villageCache.daysKey = daysKey;
        }
        return {
            runStats,
            nightsSurvived: nightsSurvivedNow(),
            // Jailhouse (Momentum Build A): a night the church held only counts when the day was defended too (days before the rule are exempt).
            countsAsNight: (rec) => Momentum.countsAsNight(rec, State.getMomentumFromDay()),
            days: villageCache.days,
            today,
            runNumber,
            maxHp: CONFIG.MAX_BASE_HEALTH,
        };
    }
    function villageProgressNow() {
        try {
            const ctx = villageContext();
            const key = [ctx.nightsSurvived, ctx.runStats.tasksCompleted, ctx.runStats.subtasksCompleted, ctx.runStats.habitsCompleted, ctx.runStats.goodHabitsCompleted,
                villageCache.daysKey, JSON.stringify(ctx.today && ctx.today.done)].join('|');
            if (villageCache.key !== key) {
                villageCache.progress = VillageProgress.compute(ctx);
                villageCache.key = key;
            }
            return villageCache.progress;
        } catch (err) {
            console.error('Deadline: village progress failed', err);
            return villageCache.progress; // last good value, or null = every building at T1
        }
    }
    // Village Build 3: every building's real tier now ({ kind: tier }), computed fresh (not from the cache) and never
    // overridden by the ?xTier= URL params -- this is what a run record stores as its peak.
    function realVillageTiers() {
        try {
            const progress = VillageProgress.compute(villageContext());
            const out = {};
            VillageProgress.KINDS.forEach((k) => { out[k] = progress[k] ? progress[k].tier : 1; });
            return out;
        } catch (err) {
            console.error('Deadline: village tiers for the run record failed', err);
            return undefined;
        }
    }
    // While the game is over the village keeps showing the run's PEAK (the live maths would drop to T1 the moment the
    // run joins history); Restart starts the next run and the real tiers take over again.
    function peakTierWhileOver(kind) {
        if (!State.isGameOver()) return null;
        const last = (State.getRunHistory() || [])[0];
        const t = last && last.peakVillageTiers ? last.peakVillageTiers[kind] : null;
        return Number.isInteger(t) ? t : null;
    }
    function villageTierDep(kind, param) {
        return () => {
            const p = villageProgressNow();
            const peak = peakTierWhileOver(kind);
            const real = peak != null ? peak : ((p && p[kind]) ? p[kind].tier : 1);
            // Dev tools (2026-11-03): a star picked in the DEV panel wins over the ?xTier= params and the real tier. In memory only,
            // and ONLY this scene read sees it: drops, the run record's peak tiers and the cards all use the real tiers.
            const demoTier = DevDemo.villageTier();
            if (demoTier != null) return VillageLayout.resolveTier('', param, demoTier, VillageLayout.fromConfig(CONFIG).tiers);
            return VillageLayout.resolveTier(window.location.search, param, real, VillageLayout.fromConfig(CONFIG).tiers);
        };
    }
    // Memorial obelisk (2026-11-08, js/memorial.js): the stage the graveyard draws = floor of the average of the 8 buildings' ALL-TIME best
    // tiers (State.getBestVillageTiers, a saved high-water mark: the village tiers themselves are per-run and fall back to T1 on a new run).
    // The dev tools win over the real stage the way they do for the buildings: the DEV panel's star, then `?memorialTier=1..5|off`.
    function memorialStageNow() {
        const tiers = VillageLayout.fromConfig(CONFIG).tiers;
        const real = Memorial.stage(State.getBestVillageTiers());
        const demoMemorial = DevDemo.memorialStage(); // its own DEV chips (2026-11-08); beats the star below
        if (demoMemorial != null) return VillageLayout.resolveTier('', 'memorialTier', demoMemorial, tiers);
        const demoTier = DevDemo.villageTier();
        if (demoTier != null) return VillageLayout.resolveTier('', 'memorialTier', demoTier, tiers);
        return VillageLayout.resolveTier(window.location.search, 'memorialTier', real, tiers);
    }
    // Growing tree (2026-11-08, js/treeGrowth.js): sapling / young / giant by LIFETIME nights = the banked nights of finished runs
    // (lifetimeStats.nightsSurvived) + the run in progress, counted like the moon's number (0 once the game is over: that run is already
    // banked). `?treeStage=1..3|off` overrides it for art checks. Read-only: nothing here saves or pays.
    function treeStageNow() {
        const demoTree = DevDemo.treeStage(); // the DEV panel's Graveyard tree chips (2026-11-08) win over ?treeStage= and the real stage
        if (demoTree != null) return demoTree;
        const stats = State.getLifetimeStats() || {};
        const current = nightsSurvivedNow();
        const nights = TreeGrowth.total(stats.nightsSurvived, current, State.isGameOver());
        return TreeGrowth.resolve(window.location.search, TreeGrowth.stage(nights, CONFIG.TREE_STAGE_NIGHTS));
    }
    // The Tree's own window (js/ui/treePanel.js, 2026-11-08): the REAL banked + live nights, never the DEV tree chip or ?treeStage=, so it always
    // tells the truth about the save. Read-only.
    function realTreeNights() {
        const stats = State.getLifetimeStats() || {};
        const current = nightsSurvivedNow();
        return { banked: stats.nightsSurvived, current, gameOver: State.isGameOver() };
    }
    function realTreeStage() {
        const n = realTreeNights();
        return TreeGrowth.stage(TreeGrowth.total(n.banked, n.current, n.gameOver), CONFIG.TREE_STAGE_NIGHTS);
    }
    function openTreePanel() {
        TreePanel.open(Object.assign(realTreeNights(), { thresholds: CONFIG.TREE_STAGE_NIGHTS }));
    }
    // Milestone markers (2026-11-08, js/milestoneMarkers.js): one small stone per all-time achievement family (CONFIG.MARKER_FAMILIES), its picture
    // chosen by the highest unlocked tier. The DEV panel's Headstones chips win, then `?markers=0..4|off`, then the real unlocked tiers. Read-only.
    function markersNow() {
        const demo = DevDemo.markerStage();
        const url = demo != null ? demo : MilestoneMarkers.override(window.location.search);
        if (url === 'off') return null;
        return MilestoneMarkers.build({
            catalog: CONFIG.ACHIEVEMENTS, ids: CONFIG.MARKER_FAMILIES,
            unlocked: State.getAchievements(), stats: State.getLifetimeStats() || {},
            forced: typeof url === 'number' ? url : undefined,
        });
    }
    // The markers' own window (js/ui/markerPanel.js): the REAL tiers and stats, never the dev overrides. `selected` = the tapped marker (or null).
    function markerPanelContext(selected) {
        return {
            catalog: CONFIG.ACHIEVEMENTS, ids: CONFIG.MARKER_FAMILIES,
            unlocked: State.getAchievements(), stats: State.getLifetimeStats() || {}, selected: selected || null,
        };
    }
    function openMarkerPanel(selected) {
        MarkerPanel.open(markerPanelContext(selected));
    }
    function realMarkerCounts() {
        const built = MilestoneMarkers.build(markerPanelContext(null));
        return { earned: built.filter(m => m.stage >= 1).length, total: built.length };
    }
    // The Memorial's own window (js/ui/memorialPanel.js): the REAL stage and tiers, never the dev overrides, so it always tells the truth about the save.
    function openMemorialPanel() {
        MemorialPanel.open({ best: State.getBestVillageTiers(), current: realVillageTiers() || {} });
    }
    // Raise the saved all-time best tiers once a second from the REAL tiers (never the dev overrides). Skipped while the game is over (the
    // run's peak is on its history record and is merged back in on load) and during offline catch-up (the first tick afterwards covers it).
    let bestTiersCheckedMs = 0;
    function trackBestVillageTiers(nowMs) {
        if (nowMs - bestTiersCheckedMs < 1000) return;
        bestTiersCheckedMs = nowMs;
        if (State.isGameOver() || offlineCatchUpActive) return;
        try {
            const p = villageProgressNow();
            if (!p) return; // progress not computable yet: unknown is not "tier 1 reached"
            const tiers = {};
            VillageProgress.KINDS.forEach((k) => { if (p[k]) tiers[k] = p[k].tier; });
            if (State.setBestVillageTiers(tiers)) saveGame();
        } catch (err) {
            console.error('Deadline: best village tiers failed', err);
        }
    }
    // The Add Habit form, same as the Habits window's "+ Add New Habit" (2026-11-04: also opened from the Boxing gym
    // card's "Break Habit" link with { isNegative: true }). Closes the Habits window first if it happens to be open.
    function openAddHabitForm(opts) {
        ManagementWindows.closeManagementWindow('habitsWindow', { managementWindows });
        Forms.showFormModal('habit', formsDeps(), opts);
    }

    function openVillageCard(hit) {
        const ctx = villageContext();
        const progress = VillageProgress.compute(ctx);
        VillageCard.open({
            kind: hit.kind,
            progress: progress[hit.kind],
            extras: VillageProgress.extras(ctx),
            hasBadHabit: (State.getDefinedHabits() || []).some(h => h && !h.archivedAt && h.isNegative),
            hasRoutine: (State.getDefinedRoutines() || []).length > 0,
            // Boxing gym empty line (2026-11-04): its "Break Habit" words open Add Habit with Break Habit picked.
            onAddBreakHabit: () => openAddHabitForm({ isNegative: true }),
            // Clock tower "Your reward" (pushback charges, Build C): the free allowance at this star + what the next adds.
            reward: hit.kind === 'punctuality' && progress.punctuality
                ? Object.assign(PushbackHelp.rewardModel({ star: progress.punctuality.tier, table: CONFIG.PUSHBACK_ALLOWANCE }),
                    // Anytime morning on-time credits (2026-11-02): how many are left and when the next one returns.
                    { credit: 'Anytime morning card. ' + AnytimeCheck.creditText(anytimeCreditInfo()) }) : null,
            // Village tier drops (2026-11-03): the item the NEXT star pays, shown as the card's "Next item" line.
            nextDrop: (() => {
                const d = VillageDrops.nextDrop(hit.kind, progress[hit.kind] ? progress[hit.kind].tier : 1, CONFIG.VILLAGE_TIER_DROPS);
                return d ? { star: d.star, label: VillageDrops.label(d, CONFIG.SHOP_ITEMS) } : null;
            })(),
            // High school v2 report card (2026-10-31): one row per routine.
            reportRows: Heroes.reportRows(State.getDefinedRoutines(), State.getDefinedHabits(), CONFIG, State.getRunStartedAtMs()),
            spriteUrl: hit.url,
            spriteW: hit.width,
            spriteH: hit.height,
            spriteFlip: hit.flip,
        });
    }
    VillageView.init({
        getHillWidth: () => GraveyardView.zoneWidth(),
        getClockTier: villageTierDep('punctuality', 'villageTier'),
        getJailTier: villageTierDep('defense', 'jailTier'),
        getArmoryTier: villageTierDep('slain', 'armoryTier'),
        getRadioTier: villageTierDep('nights', 'radioTier'),
        getGymTier: villageTierDep('lurkers', 'gymTier'),
        getSchoolTier: villageTierDep('heroes', 'schoolTier'),
        getHospitalTier: villageTierDep('habits', 'hospitalTier'),
        getWindmillTier: villageTierDep('bestdays', 'windmillTier'),
        onOpenBuilding: openVillageCard,
    });
    // Run climate (2026-11-03, docs/WORLD_FEEDBACK_PLAN.md "W1 Run climate"): the sky's weather from how the last ~7 CLOSED days
    // of THIS run went (js/runClimate.js, pure). It changes only at a day rollover / game over / load, so the closed-days
    // store is read once per such change (same cache idea as villageContext above) and climateView.refresh() can run every tick.
    // Dev override: ?climate=clear|hazy|overcast|fog|storm (+ &trend=up|down). On any failure: no result = the sky looks as before.
    const climateCache = { key: null, result: null };
    // Live sky (2026-11-11, docs/LIVE_SKY_PLAN.md): while the day is open, today's score so far moves the sky on top of the cached closed-day
    // result (RunClimate.withToday). Rebuilt only when a counter it reads changes, so the same object comes back otherwise (the sky and
    // the badge compare results by identity). Off during game over, and when the open day belongs to another run.
    const liveClimateCache = { closed: null, sig: null, result: null };
    function liveClimate(closed, runNumber, over) {
        const today = State.getToday();
        if (over || !closed || closed.forced || !today || today.run !== runNumber) return closed;
        const d = today.done || {}, m = today.missed || {}, l = today.lurk || {}, g = today.dmg || {};
        const sig = [d.task, d.habit, d.late, m.task, m.habit, l.avoided, l.slipped, g.taken, g.offline].join('|');
        if (liveClimateCache.closed !== closed || liveClimateCache.sig !== sig) {
            liveClimateCache.closed = closed;
            liveClimateCache.sig = sig;
            liveClimateCache.result = RunClimate.withToday(closed, today, CONFIG.CLIMATE);
        }
        return liveClimateCache.result;
    }
    const climateOverride = ClimateView.parseOverride(window.location.search);
    // realClimateNow() = the REAL sky (dev panel sky > ?climate= > the run's own climate). climateNow() below = what the canvas WEARS: the same
    // thing with the player's Lv 4 sky pick on top (W1c, js/skyPick.js; view-only, so only the canvas, rain, badge and panel ever see it).
    function realClimateNow() {
        const demoSky = DevDemo.weather(); // Dev tools (2026-11-03): a band picked in the DEV panel (null = none); wins over ?climate=
        if (demoSky) return demoSky;
        if (climateOverride) return RunClimate.forced(climateOverride.band, climateOverride.trend);
        try {
            const today = State.getToday() || null;
            const over = State.isGameOver();
            const finished = (State.getRunHistory() || []).length;
            const runNumber = over ? finished : finished + 1; // while game over the run that just ended is the last in history
            const key = (today && today.date ? today.date : '') + '|' + runNumber + '|' + (over ? 'over' : 'live');
            if (climateCache.key !== key) {
                climateCache.result = RunClimate.compute(Persistence.loadDays(), runNumber, CONFIG.CLIMATE);
                climateCache.key = key;
            }
            return liveClimate(climateCache.result, runNumber, over);
        } catch (err) {
            console.error('Deadline: run climate failed', err);
            return climateCache.result; // last good value, or null = no climate class
        }
    }
    const skyCache = { real: null, pick: null, unlocked: null, out: null };
    // W1d sky unlocks (docs/WORLD_FEEDBACK_PLAN.md "W1d Sky unlocks"): every sky is its own LIFETIME unlock (CONFIG.SKY_UNLOCKS), read from
    // the all-time bests (best player level, best village stars), so a new run or a game over never takes one back.
    function skyBest() { return { level: State.getBestPlayerLevel(), tiers: State.getBestVillageTiers() }; }
    function skyUnlockedBands() { return SkyPick.unlockedBands(CONFIG.SKY_UNLOCKS, skyBest()); }
    function skyNow() { // { result, active, pick }; recomputed only when the real sky, the pick or the earned skies changed
        const real = realClimateNow();
        const pick = State.getSkyPick();
        const unlocked = skyUnlockedBands().join(',');
        if (!skyCache.out || skyCache.real !== real || skyCache.pick !== pick || skyCache.unlocked !== unlocked) {
            skyCache.real = real; skyCache.pick = pick; skyCache.unlocked = unlocked;
            skyCache.out = SkyPick.resolve(real, pick, unlocked ? unlocked.split(',') : []);
        }
        return skyCache.out;
    }
    function climateNow() { return skyNow().result; }
    // Picking a sky (the Weather panel's picker): save, repaint. 'follow' / null = follow my run. Every band is allowed, Clear too (2026-11-09).
    function setSkyPick(band) {
        const next = band === 'follow' ? null : SkyPick.sanitize(band);
        if (next && skyUnlockedBands().indexOf(next) < 0) return; // a sky you have not earned cannot be picked
        State.setSkyPick(next);
        saveGame();
        ClimateView.refresh();
    }
    // The sky-change toast (W1c amendment): when the REAL band moves while a pick is in force, say so once. Armed only after the saved
    // game is restored (the first refresh runs on a blank state and would see a "change"); a dev / ?climate= sky never toasts.
    const skyWatch = { armed: false, last: null };
    function watchRealSky(result) {
        if (!skyWatch.armed) return;
        if (!result || result.forced) { skyWatch.last = null; return; }
        const prev = skyWatch.last;
        const next = result.closedBand || SkyPick.realBandOf(result); // the toast follows FINISHED days only (the live sky moves all day)
        skyWatch.last = next;
        if (prev === null || prev === next) return;
        const text = SkyPick.changeNotice(prev, next, State.getSkyPick(), skyUnlockedBands());
        if (text) WeatherPanel.showSkyToast(text);
    }
    function armSkyWatch() {
        skyWatch.armed = true;
        const r = climateNow();
        skyWatch.last = (r && !r.forced) ? (r.closedBand || SkyPick.realBandOf(r)) : null;
    }
    WeatherPanel.init({
        getResult: climateNow,
        getMood: moodForDay,
        getPickerInfo: () => {
            const s = skyNow();
            const earned = skyUnlockedBands();
            return {
                unlocked: earned.length > 0,
                bands: SkyPick.BANDS.map(b => ({ band: b, unlocked: earned.indexOf(b) >= 0, requirement: Theme.skyRequirement(CONFIG.SKY_UNLOCKS[b]) })),
                pick: s.active ? s.pick : null,
                realBand: SkyPick.realBandOf(s.result),
                unlockLevel: Progression.unlockLevel(CONFIG.LEVEL_PERKS, SkyPick.UNLOCK_KEY),
            };
        },
        onPick: setSkyPick,
        onPeek: (on) => ClimateView.peek(on),
    });
    ClimateView.init({ getResult: climateNow, getRealResult: realClimateNow, onChange: (r) => { WeatherPanel.updateBadge(r); watchRealSky(r); } });
    RainFx.init({ getResult: climateNow, isFrozen: () => typeof TimeSliderView !== 'undefined' && TimeSliderView.isAway() }); // Storm rain (canvas in each .rain host); starts / stops itself from the climate-storm class (2026-11-07)
    const baseHealthDisplay = document.getElementById('baseHealthDisplay');
    const playerXpDisplay = document.getElementById('playerXpDisplay');
    const playerLevelDisplay = document.getElementById('playerLevelDisplay');
    const playerPointsDisplay = document.getElementById('playerPointsDisplay');
    // [P1-DATA-005] sub-session 3, 2026-07-19 — negative-balance red styling + nudge.
    const playerPointsStat = document.getElementById('playerPointsStat');
    const playerPointsNudge = document.getElementById('playerPointsNudge');
    const gameOverMessage = document.getElementById('gameOverMessage');
    const levelUpMessage = document.getElementById('levelUpMessage');
    const activeItemsListUL = document.getElementById('activeItemsList');
    const taskCountDisplay = document.getElementById('taskCountDisplay');
    // [P1-UI-006] sub-session 3, 2026-07-19 — hero chips container over the base.
    const heroTabEl = document.getElementById('heroesButton');
    const baseScrimEl = document.getElementById('baseScrim');
    const heroSpotlightEl = document.getElementById('heroSpotlight');
    // Time slider (Milestone 4, 2026-07-20) — canvas/list seam, Today scope.
    const timeSliderEl = document.getElementById('timeSlider');
    const timeSliderLabelEl = document.getElementById('timeSliderLabel');
    const timeSliderNowBtn = document.getElementById('timeSliderNow');
    // Day pager (Week scope sub-session 2, 2026-07-20).
    const dayPagerPrevBtn = document.getElementById('dayPagerPrev');
    const dayPagerNextBtn = document.getElementById('dayPagerNext');
    const dayPagerLabelEl = document.getElementById('dayPagerLabel');
    const taskSectionTitleEl = document.getElementById('taskSectionTitle');
    // Week strip (sub-session 4, phase 2, 2026-07-20).
    const weekStripRowEl = document.getElementById('weekStripRow');

    // Routine elements
    const routineNameInput = document.getElementById('routineName');
    const createRoutineButton = document.getElementById('createRoutineButton');
    const definedRoutinesListUL = document.getElementById('definedRoutinesList');
    const activeRoutineCountDisplay = document.getElementById('activeRoutineCountDisplay');
    const playerXpBar = document.getElementById('playerXpBar');
    const levelButton = document.getElementById('levelButton');
    // Base Health panel (docs/BASE_PANEL_PLAN.md steps 3-4, 2026-10-26): HUD ring + chip button.
    const baseHealthButton = document.getElementById('baseHealthButton');
    const baseHealthRing = document.getElementById('baseHealthRing');
    const baseHealthArc = document.getElementById('baseHealthArc');
    const baseHealthChipEl = document.getElementById('baseHealthChip');
    
    // Control buttons
    const attackButton = document.getElementById('attackButton');
    const restartButton = document.getElementById('restartButton');

    // Category styling configuration
    const categoryStyles = {
        "other": { bgColor: "#90ee90", textColorClass: "category-other-text" },
        "career": { bgColor: "#4a90e2" },
        "creativity": { bgColor: "#f5a623" },
        "financial": { bgColor: "#50e3c2" },
        "health": { bgColor: "#e91e63" },
        "lifestyle": { bgColor: "#bd10e0" },
        "relationships": { bgColor: "#f8e71c", textColorClass: "category-relationships-text" },
        "spirituality": { bgColor: "#7ed321" }
    };

    // (The old SUBTASK CREATION CALL CHAIN MAP comment lived here 2025-07 →
    // 2026-07-18. Every line number and location in it was stale — the code it
    // described now lives in js/items.js, js/spawning.js, and js/ui/popups.js.
    // See docs/ARCHITECTURE.md for the current module map.)

    // [P2-UI-009] session 59: user preference, NOT part of the game save —
    // loaded from js/settings.js's separate `deadline.settings` key at boot
    // and applied to <body> immediately (see DOMContentLoaded below), so it
    // survives a dev Reset / fresh run the same as any other browser setting.
    let effectsIntensity = Settings.load().effectsIntensity;
    // script.js loads at the end of <body> (index.html), so document.body
    // already exists here — no need to wait for DOMContentLoaded.
    Settings.applyEffectsIntensity(effectsIntensity);
    // Ownership of baseHealth, playerXP, playerLevel, playerPoints,
    // routineSlots, playerInventory, sickDayDate, currentRunStats,
    // runHistory, lifetimeStats, achievements, activeItems, completedItems,
    // definedHabits, definedRoutines, itemIdCounter, gameIsOver,
    // daysSurvived, currentGameDate, runStartedAtMs, lastLoopTickMs, and
    // lastRegenTickMs moved to js/state.js (State.getX/State.setX) —
    // Sub-session 1, docs/STATE_OWNERSHIP_PLAN.md, 2026-07-20. Every deps
    // builder below now sources those keys from State.* directly instead of
    // closing over a local `let`.
    let gameLoopInterval;
    let attackMode = false;
    // [P1-UI-006] sub-session 3, 2026-07-19 — ephemeral (NOT persisted, no
    // schema bump this session) per-routine star-rating memory for
    // HeroesView's star-threshold-crossed notice. See js/ui/heroes.js header.
    let heroStarMemory = {};
    // Clock tower star-up notice memory (Build C; see observeClockStar). Declared up here: initGame resets it.
    let clockStarSeen = null;
    let clockStarCheckedMs = 0;
    // Hero spotlight / tray lazy-init flags live up here (not beside their functions) because
    // renderHeroesAtBase can run during boot, before those function bodies' lines are reached.
    let heroSpotlightReady = false;
    let heroTrayReady = false;
    let goalsPaneReady = false; // Goals Build B1: same reason as the hero flags above (renderGoals can run during boot)
    let goalBadgeSig = null; // Goals Build B2: the last badge signature applied to the agenda rows (renderGoals)


    // --- Game Settings ---
    // Values live in js/config.js (CONFIG) — never hardcode a balance number here.
    const XP_PER_TASK_DEFEAT = CONFIG.XP_PER_TASK_DEFEAT;
    const XP_PER_HABIT_COMPLETE = CONFIG.XP_PER_HABIT_COMPLETE;
    const POINTS_PER_TASK = CONFIG.POINTS_PER_TASK;
    const POINTS_PER_HABIT = CONFIG.POINTS_PER_HABIT;
    const HABIT_STREAK_BONUS_THRESHOLD = CONFIG.HABIT_STREAK_BONUS_THRESHOLD;
    const HABIT_STREAK_STRONG_THRESHOLD = CONFIG.HABIT_STREAK_STRONG_THRESHOLD;
    const LEVEL_XP_THRESHOLDS = CONFIG.LEVEL_XP_THRESHOLDS;
    const ROUTINE_SLOTS_PER_LEVEL = CONFIG.ROUTINE_SLOTS_PER_LEVEL;
    const MAX_PLAYER_LEVEL = LEVEL_XP_THRESHOLDS.length;

    let GAME_SCREEN_WIDTH, BASE_WIDTH, ENEMY_WIDTH, HABIT_ENEMY_WIDTH;

    // BASE_WIDTH is the FRONT LINE: where a zombie stops (the due line, the timeline's left end, the overdue pile, offline catch-up).
    // It is the church's width plus a gap for the barricade to stand in (Momentum Build C, 2026-11-12), so the village and graveyard,
    // which sit to the right of the CHURCH, get churchWidth() instead. Half-size gap in the portrait strip.
    function churchWidth() { return baseElement.offsetWidth; }
    function frontLineGap() { return Layout.isActive() ? CONFIG.FRONT_LINE_GAP_STRIP_PX : CONFIG.FRONT_LINE_GAP_PX; }
    function frontLineX() { return churchWidth() + frontLineGap(); }

    // In glance-strip mode enemies are small dots, so the TIMELINE math uses
    // CONFIG.STRIP_MARKER_WIDTH as the enemy width (otherwise 128px would be
    // reserved at the right edge and the strip's resolution cut by ~40%).
    // Sprite/box sizing is overridden in css/glanceStrip.css, not here.
    function enemyWidthForMode(configWidth) {
        return Layout.isActive() ? CONFIG.STRIP_MARKER_WIDTH : configWidth;
    }

    // Re-measure after the layout mode flips or the viewport resizes. Positions
    // themselves refresh on the next game-loop tick (loop.js recomputes x for
    // every non-preview item every tick).
    // Per-item random ground-band fraction (0..1), kept in memory only (not in the
    // save) so re-placing after a rotation is stable instead of reshuffling.
    const groundBandFrac = new WeakMap();

    // Vertical placement is computed ONCE, at spawn, against the canvas height at
    // that moment (Movement.getItemTopPosition). Spawned in portrait the canvas is
    // the ~76px glance strip, so a 128px character clamps to top:0 — and rotating
    // to landscape (full battlefield) left every character jammed at the top
    // (Jeremy's phone report 2026-10-13). So when the layout leaves strip mode,
    // re-place every item against the real canvas height. Parents first, so subs
    // can bottom-align to their parent's new top.
    function replaceItemTops() {
        const items = State.getActiveItems();
        const canvasHeight = gameCanvas.offsetHeight;
        const place = (item) => {
            const el = item.element;
            if (!el) return;
            const h = parseFloat(el.style.height) || el.offsetHeight;
            if (!groundBandFrac.has(item)) groundBandFrac.set(item, Math.random());
            el.style.top = Movement.getItemTopPosition(item, h, {
                activeItems: items,
                canvasHeight,
                randomFn: () => groundBandFrac.get(item)
            }) + 'px';
        };
        items.filter(i => !i.parentId).forEach(place);
        items.filter(i => i.parentId).forEach(place);
    }

    function refreshLayoutDims(isStrip, modeChanged) {
        GAME_SCREEN_WIDTH = gameCanvas.offsetWidth - GraveyardView.zoneWidth();
        BASE_WIDTH = frontLineX();
        GraveyardView.render(churchWidth());
        VillageView.render(churchWidth());
        ClimateView.refresh();
        ENEMY_WIDTH = enemyWidthForMode(CONFIG.ENEMY_WIDTH);
        HABIT_ENEMY_WIDTH = enemyWidthForMode(CONFIG.HABIT_ENEMY_WIDTH);
        // Overdue items camp at the base edge and are only re-positioned when
        // they take a damage tick, so after the base width changes (56px strip
        // <-> 120px church) re-snap them now — found live 2026-10-13: after
        // rotating back to landscape an overdue zombie sat on top of the church.
        State.getActiveItems().forEach(item => {
            if (!item.isOverdue || !item.element || Items.isNonThreatening(item)) return;
            item.x = BASE_WIDTH + getSubTaskClusterOffset(item);
            item.element.style.left = Math.max(BASE_WIDTH, item.x) + 'px';
        });
        // Items keep the INLINE width they were spawned with. Spawned/restored in
        // portrait that is the 32px strip marker, so after rotating to landscape
        // a habit stayed a 32px-wide (quarter-size) sprite until reload, and a
        // task until the next loop tick (Jeremy's phone report 2026-10-13). Re-size
        // every top-level item to the CURRENT mode's width now; the loop keeps
        // refining parent-task growth from there. Sub-tasks use a fixed width in
        // every mode (the strip restyles them in CSS), so they are left alone.
        if (modeChanged) {
            State.getActiveItems().forEach(item => {
                if (!item.element || item.parentId) return;
                const w = item.type === 'habit' ? HABIT_ENEMY_WIDTH : ENEMY_WIDTH;
                item.element.style.width = w + 'px';
                if (typeof SpriteAnim !== 'undefined') SpriteAnim.syncScale(item.element, w);
            });
        }
        if (modeChanged && !isStrip) replaceItemTops();
    }

    // Real implementation lives in js/state.js (Milestone 2 extraction,
    // session 11, 2026-07-18) — thin wrapper so this call site is unchanged.
    // Storage for the state it touches stays in script.js (see stateDeps()
    // and js/state.js's header for why ownership didn't move this session).
    function initGame() {
        // [P1-UI-006] sub-session 3, 2026-07-19 — a fresh/reset run starts
        // with no crossing history (the dev Reset button re-calls initGame
        // without a full page reload, so this can't rely on module-load init
        // alone).
        heroStarMemory = {};
        clockStarSeen = null; // a new run starts at star 1 with no crossing history (no star-up notice for it)
        HeroTray.resetMemory();
        State.initGame(stateDeps());
    }

    // (computeDaysSurvived wrapper inlined at its one call site sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/damage.js, Milestone 2 extraction #3, 2026-07-18.)

    // (updatePlayerDisplays/updateTaskCountDisplay wrappers inlined at their
    // call sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real
    // implementations live in js/ui/hud.js, Milestone 2 UI extraction
    // session 2, 2026-07-18.)

    // --- Persistence (js/persistence.js) ---
    // schemaVersion 1 persists the CURRENT in-memory shapes as-is; see
    // docs/DATA_SCHEMA.md + DECISIONS.md (2026-07-17). Call saveGame() after
    // every state mutation — Persistence debounces the actual write.

    // (getPersistableState wrapper was dead code — no call sites in script.js,
    // state.js's own saveGame/rollover call their local getPersistableState
    // directly — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    function saveGame() {
        State.saveGame(stateDeps());
    }

    // Safety net: some edit paths (routine editors, task edit modal) don't call
    // saveGame() directly yet — a periodic save bounds any loss to a few seconds.
    let lastAutosaveMs = 0;

    // True while the offline catch-up animation owns enemy positions;
    // updateActiveItems() skips position/damage work until it finishes.
    let offlineCatchUpActive = false;

    // True while the time slider is being scrubbed (Milestone 4, 2026-07-20)
    // — same "one owner at a time" contract as offlineCatchUpActive above.
    // updateActiveItems() skips position/damage/regen work until release;
    // js/ui/timeSliderView.js owns element.style.left directly while this
    // flag is set.
    let timePreviewActive = false;
    // Started marker state (2026-11-04; refreshStartedMarkers): declared up here so a boot-time timer refresh can't hit the TDZ.
    let startedPrevIds = null;  // ids in a work window on the last live pass; null = next pass is a baseline
    let startedGroupKey = null; // StartedMarker.groupKey on the last pass: the list re-renders when it changes

    // --- Damage / base health (js/damage.js) ---
    // Milestone 2 extraction #3 (2026-07-18). js/damage.js is the only module so
    // far that WRITES script.js-owned state (baseHealth, gameIsOver), so it gets
    // accessors rather than raw values; see the header comment in js/damage.js
    // for why ownership didn't move. Rebuilt per call because BASE_WIDTH and the
    // DOM handles aren't resolved until initGame() runs.
    function damageDeps() {
        return State.buildDamageDeps(stateDeps());
    }

    // (restoreGameState wrapper inlined at its one call site sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — runs ONCE on boot, right after
    // initGame() has reset to a fresh state; see the call site near the
    // bottom of this file.)

    // Builds the deps object for js/state.js's initGame/restoreGameState/
    // getPersistableState/saveGame/buildDamageDeps (Milestone 2 extraction,
    // session 11, 2026-07-18). Rebuilt per call, same reasoning as
    // itemsDeps()/damageDeps(): BASE_WIDTH/GAME_SCREEN_WIDTH aren't resolved
    // until initGame() runs, and several fields (completedItems,
    // definedHabits, currentGameDate, etc.) are REASSIGNED elsewhere
    // (new-game reset, restoreGameState itself), so they're threaded through
    // as get/set accessor pairs rather than plain values — extending the
    // js/damage.js precedent for script.js-owned state a module needs to
    // both read and write.
    // Achievements sub-session 2 (session 65, docs/ACHIEVEMENTS_PLAN.md):
    // the single owner-side seam every live lifetime-stats bump funnels
    // through. Mutate → evaluate → record → toast, in that order, so an
    // unlock can never be persisted without having fired its one-time
    // notice (and vice versa). Callers (completeItem/uncompleteItem/
    // resolvePendingCheckIn/gameOver) all call saveGame() themselves after
    // their seam fires, so the mutated lifetimeStats/achievements are
    // picked up by the very next collectGameState — no save call here.
    // FrozenNotice called as a bare stable global (loads before script.js),
    // same pattern as onRoutineFrozen/onStreakMilestone below.
    function applyLifetimeProgress(mutator) {
        const lifetimeStats = State.getLifetimeStats();
        mutator(lifetimeStats);
        const newlyCrossed = Achievements.evaluateAll(CONFIG.ACHIEVEMENTS, lifetimeStats, State.getAchievements());
        if (newlyCrossed.length) {
            State.setAchievements(Achievements.recordUnlocks(State.getAchievements(), newlyCrossed, new Date().toISOString()));
            // Each unlock also carries the headstone stage it reached (2026-11-09) so the window can show the stone; a family with no
            // headstone (Back in Black) gets 0 = no picture. The stage is read from the tier's position, not saved.
            const stoneFamilies = MilestoneMarkers.families(CONFIG.ACHIEVEMENTS, CONFIG.MARKER_FAMILIES);
            FrozenNotice.showAchievementUnlockNotice(newlyCrossed.map(u => {
                const family = stoneFamilies.find(f => f.id === u.familyId);
                return Object.assign({}, u, { headstoneStage: family ? MilestoneMarkers.stageOf(family, { [u.tierId]: true }) : 0 });
            }));
        }
    }

    // The items.js-facing dispatcher (see completeItem's deps doc for the
    // event vocabulary). Counters clamp at 0 on symmetric decrements;
    // bestHabitStreak is a high-water mark and never rolls back.
    function recordLifetime(event, value) {
        applyLifetimeProgress((stats) => {
            if (event === 'taskCompleted') {
                stats.tasksCompleted = Math.max(0, (stats.tasksCompleted || 0) + value);
            } else if (event === 'subtaskCompleted') {
                stats.subtasksCompleted = Math.max(0, (stats.subtasksCompleted || 0) + value);
            } else if (event === 'habitCompleted') {
                stats.habitsCompleted = Math.max(0, (stats.habitsCompleted || 0) + value);
            } else if (event === 'streakReached') {
                stats.bestHabitStreak = Math.max(stats.bestHabitStreak || 0, value || 0);
            } else if (event === 'pointsRecovered') {
                stats.pointsRecoveries = (stats.pointsRecoveries || 0) + 1;
            } else if (event === 'breakResisted') {
                // Iron Will (2026-11-03): +1 per resisted Break habit, -1 on undo; clamps at 0.
                stats.breaksResisted = Math.max(0, (stats.breaksResisted || 0) + value);
            }
        });
    }

    function stateDeps() {
        return {
            // DOM
            gameCanvas, baseElement, baseHealthDisplay, gameOverMessage,
            levelUpMessage, restartButton, activeItemsListUL, attackButton,

            // state getters (State.* — ownership moved to js/state.js,
            // Sub-session 1, docs/STATE_OWNERSHIP_PLAN.md, 2026-07-20)
            getBaseHealth: State.getBaseHealth,
            getPlayerXP: State.getPlayerXP,
            getPlayerLevel: State.getPlayerLevel,
            getPlayerPoints: State.getPlayerPoints,
            getRoutineSlots: State.getRoutineSlots,
            getPlayerInventory: State.getPlayerInventory,
            getSickDayDate: State.getSickDayDate,
            getCurrentRunStats: State.getCurrentRunStats,
            getRunHistory: State.getRunHistory,
            getLifetimeStats: State.getLifetimeStats,
            getAchievements: State.getAchievements,
            // Run history sub-session 2 (session 53) — Heroes loads AFTER
            // damage.js in index.html, so gameOver's finalize step reaches
            // Heroes' math through these pre-bound functions rather than a
            // bare-global reference (same reasoning as every other
            // "collaborator from a later-loading module" in damage.js).
            heroesCompletionRate: (routine, habits, windowStartMs) =>
                Heroes.completionRate(routine, habits, windowStartMs, CONFIG.HERO_STAR_RATE_WINDOW),
            heroesStarRating: (rate, distinctDays) => Heroes.starRating(rate, distinctDays, CONFIG.HERO_STAR_TIERS),
            // High school v2 (2026-10-31): the stars each routine banks at day close (DailyRecord v3 `stars`).
            routineStarsNow: () => Heroes.bankedStars(State.getDefinedRoutines(), State.getDefinedHabits(), CONFIG, State.getRunStartedAtMs()),
            // Game-over review card (Run history sub-session 4, session 55):
            // GameOverView (js/ui/gameOverView.js) loads after js/damage.js,
            // so it's reached through this pre-bound function — same
            // forward-reference reasoning as heroesCompletionRate/
            // heroesStarRating above.
            // Run-end carryover (2026-11-03): the card also says what the next run keeps and what it
            // loses, from the live state (js/runCarryover.js summary; the items are still on the canvas
            // when the church falls, Restart is what carries them).
            renderGameOverReview: (deps) => GameOverView.renderReviewCard(Object.assign({}, deps, {
                carry: RunCarryover.summary({
                    activeItems: State.getActiveItems(),
                    routineSlots: State.getRoutineSlots(),
                    inventory: State.getPlayerInventory(),
                    catalog: CONFIG.SHOP_ITEMS,
                }),
            })),
            // Village Build 3: the run's real tiers, read by Damage.gameOver just before the record joins history.
            getVillageTiers: () => realVillageTiers(),
            // Momentum Build A (2026-11-11): the run's nights at death are its defended nights (see nightsSurvivedNow).
            getNightsSurvived: () => nightsSurvivedNow(),
            // Achievements sub-session 2 (session 65): run-end lifetime bump,
            // called by js/damage.js's gameOver ONLY on a real death (never
            // on an alreadyOver restore -- gating lives at the call site).
            // Steady Hands was retired 2026-11-03 (achievements swap), so the
            // run end only raises the best-run high-water mark now.
            recordLifetimeRunEnd: (record, days) => applyLifetimeProgress((stats) => {
                stats.bestRunDaysSurvived = Math.max(stats.bestRunDaysSurvived || 0, days || 0);
                // Growing tree (2026-11-08): bank the run's nights so the lifetime total never goes down when a new run starts.
                stats.nightsSurvived = (stats.nightsSurvived || 0) + Math.max(0, days || 0);
            }),
            // Achievements swap (2026-11-03): State.closeDailyRecord hands over each CLOSED day (after the days store
            // saved) so Honor Roll (hero-days at >= CONFIG.HERO_HONOR_ROLL_STARS) and Clean Sweep (a clean day) grow
            // live. Iron Will is counted at the resist seams in items.js, not here.
            recordLifetimeDayClose: (closedDay) => applyLifetimeProgress((stats) => {
                const d = Achievements.dayDeltas(closedDay, CONFIG.HERO_HONOR_ROLL_STARS);
                stats.heroHonorDays = (stats.heroHonorDays || 0) + d.honor;
                stats.cleanDays = (stats.cleanDays || 0) + d.clean;
            }),
            getItemIdCounter: State.getItemIdCounter,
            getDaysSurvived: State.getDaysSurvived,
            getRunStartedAtMs: State.getRunStartedAtMs,
            getCurrentGameDate: State.getCurrentGameDate,
            getActiveItems: State.getActiveItems,
            getCompletedItems: State.getCompletedItems,
            getDefinedHabits: State.getDefinedHabits,
            getDefinedRoutines: State.getDefinedRoutines,
            getGameLoopInterval: () => gameLoopInterval,
            isGameOver: State.isGameOver,
            baseWidth: BASE_WIDTH,
            gameScreenWidth: GAME_SCREEN_WIDTH,

            // state setters (State.* — see getters comment above)
            setGameScreenWidth: (n) => { GAME_SCREEN_WIDTH = n - GraveyardView.zoneWidth(); }, // n = canvas width; the graveyard hill is not walkable field
            setBaseWidth: (n) => { BASE_WIDTH = n + frontLineGap(); },
            setEnemyWidth: (n) => { ENEMY_WIDTH = enemyWidthForMode(n); },
            setHabitEnemyWidth: (n) => { HABIT_ENEMY_WIDTH = enemyWidthForMode(n); },
            setPlayerXP: State.setPlayerXP,
            setPlayerLevel: State.setPlayerLevel,
            setPlayerPoints: State.setPlayerPoints,
            setRoutineSlots: State.setRoutineSlots,
            setPlayerInventory: State.setPlayerInventory,
            setSickDayDate: State.setSickDayDate,
            setCurrentRunStats: State.setCurrentRunStats,
            setRunHistory: State.setRunHistory,
            setLifetimeStats: State.setLifetimeStats,
            setAchievements: State.setAchievements,
            setBaseHealth: State.setBaseHealth,
            setActiveItems: State.setActiveItems,
            setCompletedItems: State.setCompletedItems,
            setDefinedHabits: State.setDefinedHabits,
            setDefinedRoutines: State.setDefinedRoutines,
            setItemIdCounter: State.setItemIdCounter,
            setGameIsOver: State.setGameIsOver,
            setGameOver: State.setGameOver,
            setDaysSurvived: State.setDaysSurvived,
            setRunStartedAtMs: State.setRunStartedAtMs,
            setLastLoopTickMs: State.setLastLoopTickMs,
            getLastRegenTickMs: State.getLastRegenTickMs,
            setLastRegenTickMs: State.setLastRegenTickMs,
            setAttackMode: (v) => { attackMode = v; },
            setCurrentGameDate: State.setCurrentGameDate,
            setGameLoopInterval: (id) => { gameLoopInterval = id; },
            setOfflineCatchUpActive: (v) => { offlineCatchUpActive = v; },

            // collaborators
            updatePlayerDisplays: () => Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge }),
            updateTaskCountDisplay,
            updateRoutineDisplay,
            updateBaseVisuals: () => Damage.updateBaseVisuals(damageDeps()),
            generateDailyHabitInstances: (forWhichGameDay) => Habits.generateDailyHabitInstances(forWhichGameDay, habitInstanceDeps()),
            generateDailyRoutineTaskInstances: (forWhichGameDay) => Routines.generateDailyRoutineTaskInstances(forWhichGameDay, routineTaskInstanceDeps()),
            // Day-advance mechanism (2026-07-19): restore-path day rollover.
            settleStaleRecurringInstance: (item) => Items.settleStaleRecurringInstance(item, itemsDeps()),
            // Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): the
            // check-in-eligible counterpart, called instead for the single
            // most-recent prior day's negative-habit lurker.
            markPendingCheckIn: (item) => Items.markPendingCheckIn(item, itemsDeps()),
            // Sub-session 5 (Cheat Day token, 2026-07-19): checked FIRST,
            // ahead of the check-in-eligible fork above.
            isCheatDayExcusedForItem,
            settleExcusedCheatDay: (item) => Items.settleExcusedCheatDay(item, itemsDeps()),
            // KO ghosts (2026-10-25): re-apply the fade + badge to restored ghosts.
            syncGhostLook: (item) => Items.syncGhostLook(item),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => handleEnemyClick(itemId), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay, sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()),
            renderDefinedRoutines: () => RoutineViews.renderDefinedRoutines(routineViewsDeps()),
            renderCompletedItems: () => AgendaList.renderCompletedItems(agendaListDeps()),
            sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()),
            gameOver: (alreadyOver) => Damage.gameOver(damageDeps(), alreadyOver),
            runOfflineCatchUp: (entries, offlineMs) => Damage.runOfflineCatchUp(entries, offlineMs, damageDeps()),
            updateGame,

            // damage-deps passthrough
            markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()),
            getSubTaskClusterOffset,
            calculateTimelineXWithClustering,
            enableFormControls,
            saveGame,
            // [P1-DATA-005] session 27 — negative-habit lurker exclusion
            isNonThreatening: Items.isNonThreatening,
            // [P1-UI-006] sub-session 2, 2026-07-19 — routine health damage/KO
            damageRoutineForItem: (item, amount) => Items.damageRoutineForItem(item, amount, itemsDeps()),
            // Run history sub-session 2, 2026-07-19 session 53 — blame
            // attribution for both offline/live-gap catch-up paths.
            recordRunDamage: (item, amount, nowMs) => {
                Items.recordRunDamageForItem(item, amount, nowMs, itemsDeps());
                // Daily record (D2): offline / live-gap back-charge. Kept apart
                // from live ticks (hour of day is meaningless for a batch).
                State.bumpToday('offline', { amount, hp: Math.max(0, State.getBaseHealth() - amount) });
            },
        };
    }

    // (computeOfflineOverdueDamage's own wrapper was dead code — no call
    // sites in script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.
    // applyOfflineDamage/runOfflineCatchUp wrappers were ALSO dead code — every
    // real call site is the inlined arrow in stateDeps() above — deleted
    // sub-session 3, docs/STATE_OWNERSHIP_PLAN.md. Math/animation live in
    // js/damage.js, Milestone 2 extraction #3, 2026-07-18.)

    // Level-up math lives in js/progression.js (Milestone 2 extraction,
    // 2026-07-18) — thin wrapper so this call site is unchanged. A single
    // completion can cross more than one threshold; Progression.checkLevelUp
    // walks all of them in one call instead of the old recursive self-call.
    // No-op since the 2026-07-18 legacy-inline-form deletion (see DECISIONS.md)
    // removed the only elements this ever disabled — a hidden, unreachable
    // form div, never the live FAB/modal buttons. Kept only because
    // js/damage.js's gameOver() still calls deps.enableFormControls(false)
    // unconditionally; real behavior (disabling creation on game over, if
    // wanted at all) belongs to the future UI extraction, not this cleanup.
    function enableFormControls(enabled) {}

    // Level-perk shop discount (0..1), DERIVED from the current level on every
    // call — never persisted, so it can't drift from the level (LEVEL_PERKS_PLAN.md).
    function currentShopDiscount() {
        return Progression.shopDiscount(CONFIG.LEVEL_PERKS, State.getPlayerLevel());
    }

    // ---- Pushback charges (Build B, 2026-11-02; docs/PUSHBACK_CHARGES_PLAN.md) ----
    // ONE system behind both doors (the zombie popup's size buttons and the edit form's due-time change)
    // and the Base Health panel. All the rules live in the pure js/pushback.js (quote / quoteFixed / apply);
    // these adapters only read live state and write the result back.
    function localDayStartMs(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

    // Clock tower stars (= the building's tier in THIS run, 1..5) set the free allowance. Real tier, never the
    // ?punctualityTier= style URL override; 1 until the first progress compute succeeds.
    function clockTowerStar() {
        const p = villageProgressNow();
        const t = p && p.punctuality ? p.punctuality.tier : 1;
        return t >= 1 ? t : 1;
    }

    // Everything Pushback.quote needs besides the move itself.
    function pushbackInputs(now) {
        const inv = State.getPlayerInventory();
        const discount = currentShopDiscount();
        const held = {};
        const prices = {};
        CONFIG.PUSHBACK_SIZES.forEach((z) => {
            held[z.id] = Shop.heldCount(inv, 'pushback_' + z.id);
            // Overflow price in points: the level discount applies; the 1.5^held curve is for BUYING a token only.
            prices[z.id] = Economy.shopPrice(z.baseCost, 0, discount);
        });
        return {
            now, graceMs: CONFIG.RESCHEDULE_GRACE_MS, paidZoneMs: CONFIG.PUSHBACK_PAID_ZONE_MS,
            sizes: CONFIG.PUSHBACK_SIZES,
            allowance: Pushback.allowanceForStar(clockTowerStar(), CONFIG.PUSHBACK_ALLOWANCE),
            uses: State.getPushbackUses(), dayStartMs: localDayStartMs(now),
            held, prices, points: State.getPlayerPoints(),
        };
    }

    // Edit form door: what saving this new due time would use, priced against the item's CURRENT due (the distance
    // is measured from the later of that due and now). Returns Pushback.quote's result (kind 'free' for
    // earlier / calm / grace moves); r.canAfford is false only when points can't cover it.
    function reschedulePricingFor(item, newDue) {
        return Pushback.quote(Object.assign(pushbackInputs(new Date()), {
            currentDue: item.dueDateTime, newDue, createdAt: Pushback.graceCreatedAt(item),
        }));
    }

    // Pays for / records a move that was quoted by reschedulePricingFor or Pushback.quoteFixed. Call only once
    // the new due time is being applied. Free moves (earlier / calm / grace) only count as a reschedule; a
    // paid-zone move also spends the charge / held token / points, flags the item `pushedLate` (the Clock tower
    // skips it when completed) and lands in the daily record's `pb` tally.
    function commitReschedule(item, r) {
        if (!r || !r.later) return;
        const now = new Date();
        if (!r.free && r.ok) {
            const a = Pushback.apply(r, { now, sizes: CONFIG.PUSHBACK_SIZES, uses: State.getPushbackUses() });
            if (a.ok) {
                State.setPushbackUses(a.uses);
                Object.keys(a.tokensUsed).forEach((sizeId) => {
                    let inv = State.getPlayerInventory();
                    for (let i = 0; i < a.tokensUsed[sizeId]; i++) {
                        const used = Shop.consume('pushback_' + sizeId, inv);
                        if (used.ok) inv = used.newInventory;
                    }
                    State.setPlayerInventory(inv);
                });
                if (a.pointsSpent > 0) {
                    State.setPlayerPoints(Economy.subtractPoints(State.getPlayerPoints(), a.pointsSpent));
                    State.bumpToday('spend', { points: a.pointsSpent }); // daily record (D2)
                }
                State.bumpToday('pushback', { size: r.size, charges: r.charges, tokens: r.tokens, points: r.pointUnits }); // daily record (v6)
                if (a.pushedLate) item.pushedLate = true;
            }
        }
        State.bumpToday('reschedule', {});
        item.rescheduleCount = (item.rescheduleCount || 0) + 1;
        RunStats.recordReschedule(State.getCurrentRunStats());
        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge });
    }

    // Popup door: the buttons for one item, { sizeId, label, kind, left, cost } per size it may use. Habits get
    // Short and Medium only (a 1-day push would land on tomorrow's spawn); negative habits and KO ghosts never
    // show the section, so they are not asked about here.
    // Clock tower star-up notice (Build C): the tier is only ever read, never stored, so the "last star seen" lives in
    // memory. The first reading after boot / a new run / game over / offline catch-up only records it (no notice for
    // stars earned before this session looked); a later increase shows what each new star added.
    function observeClockStar(nowMs) {
        if (nowMs - clockStarCheckedMs < 1000) return;
        clockStarCheckedMs = nowMs;
        if (State.isGameOver()) { clockStarSeen = null; return; }
        const p = villageProgressNow();
        if (!p || !p.punctuality) return; // progress not computed yet: don't treat "unknown" as star 1
        const star = Math.max(1, p.punctuality.tier);
        const prev = clockStarSeen;
        clockStarSeen = star;
        if (prev === null || star <= prev || offlineCatchUpActive) return;
        const gains = [];
        for (let s = prev + 1; s <= star; s++) {
            const g = PushbackHelp.starGain(s, CONFIG.PUSHBACK_ALLOWANCE);
            if (g) gains.push(g.text);
        }
        FrozenNotice.showClockTowerStarUpNotice(star, gains, villageSpriteFor('punctuality', star).url);
    }

    // Village tier drops (2026-11-03; js/villageDrops.js, CONFIG.VILLAGE_TIER_DROPS, docs/ECONOMY.md "Village tier drops"): once a second,
    // pay every star a building has reached that the ledger (currentRunStats.villageDropsPaid) has not paid yet. Uses the REAL tiers
    // (realVillageTiers: fresh, never the ?xTier= dev overrides). Does nothing while the game is over (the scene shows the PEAK then, and
    // a restart rebuilds the ledger with the run) or during offline catch-up (the first tick after it pays everything owed in one batch,
    // so the player sees one notice, not one per star). The first check on a run that predates the feature pays every star it already
    // has (Jeremy, 2026-11-03). The pure maths -- what is owed, the once-per-star ledger -- is VillageDrops.settle.
    let villageDropsCheckedMs = 0;
    function payVillageDrops(nowMs) {
        if (nowMs - villageDropsCheckedMs < 1000) return;
        villageDropsCheckedMs = nowMs;
        if (State.isGameOver() || offlineCatchUpActive) return;
        try {
            const tiers = realVillageTiers();
            const stats = State.getCurrentRunStats();
            if (!tiers || !stats) return; // progress not computable yet: unknown is not "star 1 reached"
            const res = VillageDrops.settle({
                tiers,
                paid: stats.villageDropsPaid,
                inventory: State.getPlayerInventory(),
                catalog: CONFIG.SHOP_ITEMS,
                table: CONFIG.VILLAGE_TIER_DROPS,
                grant: Shop.grant,
            });
            if (!res.changed) return;
            stats.villageDropsPaid = res.newPaid;
            res.failed.forEach(row => console.error('Deadline: village drop could not be granted (check CONFIG.VILLAGE_TIER_DROPS)', row));
            if (res.granted.length > 0) {
                State.setPlayerInventory(res.newInventory);
                State.bumpToday('drop', {
                    count: res.granted.reduce((n, g) => n + g.count, 0),
                    value: res.granted.reduce((n, g) => n + g.value, 0),
                });
            }
            saveGame();
            FrozenNotice.showVillageRewardNotice(res.granted.map(g => ({
                building: (VillageCard.KINDS[g.kind] || {}).name || g.kind,
                star: g.star,
                label: g.label,
                spriteUrl: villageSpriteFor(g.kind, g.star).url,
            })));
        } catch (err) {
            console.error('Deadline: village drops failed', err);
        }
    }

    // Live numbers for the (i) help panels (popup, edit form, Shop): Clock tower star, free allowance, charges left, tokens held.
    // Same inputs the quotes use, so the panel can never disagree with the buttons.
    function pushbackHelpCtx() {
        const now = new Date();
        const inputs = pushbackInputs(now);
        const left = Pushback.chargesLeft(inputs.uses, now.getTime(), inputs.allowance, inputs.dayStartMs, CONFIG.PUSHBACK_SIZES);
        return { star: clockTowerStar(), allowance: inputs.allowance, left, held: inputs.held };
    }

    function pushbackOptionsFor(item) {
        const now = new Date();
        const inputs = pushbackInputs(now);
        const habit = item.type === 'habit';
        return CONFIG.PUSHBACK_SIZES
            .filter(z => !(habit && z.id === 'long'))
            .map((z) => {
                const q = Pushback.quoteFixed(z.id, Object.assign({}, inputs, {
                    currentDue: item.dueDateTime, createdAt: Pushback.graceCreatedAt(item),
                }));
                if (!q) return null;
                return { sizeId: z.id, label: Pushback.plusLabel(z.ms), kind: q.kind, left: q.left[z.id], total: inputs.allowance[z.id], cost: q.cost };
            })
            .filter(Boolean);
    }

    function checkPlayerLevelUp() {
        const levelBefore = State.getPlayerLevel();
        const result = Progression.checkLevelUp(
            { level: State.getPlayerLevel(), xp: State.getPlayerXP(), slots: State.getRoutineSlots() },
            LEVEL_XP_THRESHOLDS, ROUTINE_SLOTS_PER_LEVEL, MAX_PLAYER_LEVEL
        );

        if (!result.leveledUp) return false;

        State.setPlayerLevel(result.level);
        // Goals (Build A): the goal-slot high-water mark catches up with the new level (a lost run never takes a slot back).
        State.syncGoalSlots();
        saveGame();

        // Level perks (docs/LEVEL_PERKS_PLAN.md): every level crossed pays out —
        // a big XP award can jump several. Item perks go into HELD inventory
        // (Shop.grant refuses non-held ids, so a bad table row is a no-op); a
        // perk is only named in the toast if it was actually applied. Level
        // never decreases in a run, so complete/uncomplete oscillation can't
        // re-fire a payout. Discount / slot / title perks are derived from the
        // level, nothing to apply here.
        const perkLabels = [];
        let inventoryChanged = false;
        Progression.perksForLevels(CONFIG.LEVEL_PERKS, levelBefore, result.level).forEach(perk => {
            if (perk.type === 'item') {
                const gift = Shop.grant(perk.itemId, perk.count, CONFIG.SHOP_ITEMS, State.getPlayerInventory());
                if (!gift.ok) return;
                State.setPlayerInventory(gift.newInventory);
                inventoryChanged = true;
            }
            const perkLine = perk.label || Theme.perkLabel(perk);
            if (perkLine) perkLabels.push(perkLine);
        });
        LevelPanel.goalSlotPerks(CONFIG.GOAL_SLOTS_PER_LEVEL, levelBefore, result.level).forEach(perk => perkLabels.push(perk.label));
        if (inventoryChanged) saveGame();

        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge });
        Hud.showLevelUpMessage({ playerLevel: State.getPlayerLevel(), levelUpMessage, perkLabels });

        if (result.slotsUnlocked) {
            State.setRoutineSlots(result.slots);
            Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge });
            updateRoutineDisplay();
        }

        return true;
    }

    // (showLevelUpMessage wrapper inlined at its one call site sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/ui/hud.js, Milestone 2 UI extraction session 2, 2026-07-18.)

    // --- Items (js/items.js) ---
    // Milestone 2 extraction session 10, 2026-07-18 — see js/items.js's header
    // comment for the full rationale (this was never part of the UI extraction
    // plan; found during session 10's scoping, see docs/DECISIONS.md/ROADMAP.md).
    //
    // activeItems is a plain reference (agendaListDeps() precedent).
    // completedItems/definedHabits are GETTERS (reassigned elsewhere — new-game
    // reset, restoreGameState). gameIsOver is a GETTER for the same reason
    // js/spawning.js uses one (handlers can outlive the call). playerXP/
    // playerPoints get get/set accessor pairs, matching js/damage.js's
    // baseHealth/gameIsOver precedent for script.js-owned state a module needs
    // to WRITE. gameScreenWidth/baseWidth/enemyWidth/habitEnemyWidth are plain
    // values rebuilt fresh on every call (not resolved until initGame() runs —
    // same reasoning as damageDeps()). Habits/CONFIG are called as bare stable
    // globals inside js/items.js itself, not threaded through here.
    // definedRoutines is a GETTER too (added "Frozen routine slots" sub-session
    // 1, 2026-07-19) — same reassignment reason as definedHabits. FrozenSlots
    // is called as a bare stable global inside js/items.js, same as Habits/CONFIG.
    // Daily record (D2, 2026-10-27): every Timer.stop reports the span it banked.
    // A span that crossed local midnight is split (Jeremy, 2026-11-04): the part inside today lands in today's record, the
    // earlier part(s) go to those closed days (State.adjustDayTimer leaves a day that has no record alone).
    Timer.onSpan((item, spanMs, fromMs, toMs) => {
        const kind = Timer.isLimit(item) ? 'limit' : 'work';
        const parts = (typeof TimerSessions !== 'undefined' && typeof fromMs === 'number' && typeof toMs === 'number')
            ? TimerSessions.splitByDay(fromMs, toMs) : null;
        const keys = parts ? Object.keys(parts) : [];
        if (keys.length < 2) { State.bumpToday('timer', { kind, minutes: spanMs / 60000 }); return; }
        const todayKey = TimerSessions.dayKey(toMs);
        keys.forEach((k) => {
            if (k === todayKey) State.bumpToday('timer', { kind, minutes: parts[k] / 60000 });
            else State.adjustDayTimer(k, kind, parts[k] / 60000);
        });
    });

    // High school v2 step 0 (2026-10-31): routine TASKS count toward a
    // routine's hero star rate. Heroes.completionRate reads task definitions
    // from this source whenever a caller doesn't pass them, so every star
    // display uses one rate. Getter, because window.definedTasks is
    // reassigned on restore/restart.
    Heroes.setTaskDefsSource(() => window.definedTasks || []);

    function itemsDeps() {
        return {
            activeItems: State.getActiveItems(),
            completedItems: () => State.getCompletedItems(),
            definedHabits: () => State.getDefinedHabits(),
            // Routine task occurrence history (2026-10-31): items.js records
            // success/miss on the task definition. Getter for the same
            // reassignment reason as definedHabits.
            definedTasks: () => window.definedTasks || [],
            // Frozen routine slots ("Frozen routine slots + recovery" ticket,
            // sub-session 1, 2026-07-19): items.js looks up a negative
            // habit's owning routine to check/clear frozenState. GETTER for
            // the same reassignment reason as definedHabits above.
            definedRoutines: () => State.getDefinedRoutines(),
            // Sub-session 3 (2026-07-19): notifies the player exactly once
            // when a routine freezes. FrozenNotice is a small dedicated UI
            // module (js/ui/frozenNotice.js), same "module called as a bare
            // stable global from inside a script.js wrapper" pattern as
            // CheckIn.showCheckInModal above.
            onRoutineFrozen: (routine, habitDef) => {
                FrozenNotice.showFrozenRoutineNotice(routine.name, habitDef.name);
            },
            // Routine health damage + KO ([P1-UI-006] sub-session 2,
            // 2026-07-19): the recall machinery a KO reuses, and the
            // one-time notice, same "module called as a bare stable global
            // from inside a script.js wrapper" pattern as onRoutineFrozen.
            clearActiveInstancesForRoutine,
            // KO ghosts (2026-10-25): a KO keeps the routine's items as inert
            // completable ghosts instead of recalling them.
            ghostifyActiveInstancesForRoutine,
            onRoutineKo: (routine) => {
                FrozenNotice.showRoutineKoNotice(routine.name);
            },
            // Completion (2026-10-26): the item's hero plays its `attack` row once.
            // Screen thump (2026-11-09): the whole canvas gives a small jolt as the hit lands (js/ui/canvasThump.js; visual only).
            // The item sizes the buzz (2026-11-11): had sub-tasks / 30+ min logged = heavy, 60+ min = massive.
            onItemDefeated: (item) => { heroAttackOnDefeat(item); CanvasThump.onDefeat(gameCanvas, item); },
            // Daily record (D2, 2026-10-27): every gameplay seam bumps through here.
            recordDaily: State.bumpToday,
            // Goals (Build A, 2026-11-05): a finished / un-finished task or habit counts toward any linked goal target.
            onGoalProgress: (info, dir) => { State.applyGoalCompletion(info, dir); renderGoals(); },
            // Priority slots (2026-11-04): the spent-marks map per due day, read and written by Items.setPriority.
            getPriorityMarks: () => State.getPriorityMarks(),
            setPriorityMarks: (m) => State.setPriorityMarks(m),
            onPriorityChanged: () => refreshPrioritySlots(),
            // Habit Goals Build 2c: an edited logged time corrects the daily record of the item's own day.
            adjustDayTimer: (when, kind, deltaMin) => State.adjustDayTimer(DailyRecord.dateKey(when), kind, deltaMin),
            // Habit Goals Build 3 (daily record v5): an edited logged time refreshes the habit's recorded goal `actual` on that day.
            updateDayGoalActual: (when, habitId, actual) => State.updateDayGoalActual(DailyRecord.dateKey(when), habitId, actual),
            onRoutineDamaged: (routine) => {
                // Hero spotlight `hurt` row: only plays on a hero that is already on screen.
                if (heroSpotlightReady) HeroSpotlight.react(routine.id, 'hurt');
            },
            // Hero spotlight `levelup` row (may open the spotlight; CONFIG.HERO_LEVELUP_AUTO_SHOW).
            onRoutineLevelUp: (routine) => {
                if (!baseScrimEl || !heroSpotlightEl) return;
                ensureHeroSpotlight();
                HeroSpotlight.react(routine.id, 'levelup');
            },
            isGameOver: State.isGameOver,
            getPlayerXP: State.getPlayerXP,
            setPlayerXP: State.setPlayerXP,
            getPlayerPoints: State.getPlayerPoints,
            setPlayerPoints: State.setPlayerPoints,
            // Run history (session 53, docs/RUN_HISTORY_PLAN.md sub-session
            // 2): recordRunDamageForItem/completion-counter call sites read
            // the live accumulator through this getter (same "owned in
            // script.js, reached via accessor" pattern as everything else
            // here — the object itself is mutated in place, no setter needed).
            getCurrentRunStats: State.getCurrentRunStats,
            // Timer sessions Build B (2026-11-04): a session edit that takes halved damage back hits the church through the normal path.
            getBaseHealth: State.getBaseHealth,
            damageBase: (amount) => Damage.damageBase(amount, damageDeps()),
            // Frozen-slots sub-session 5 (2026-07-19): Items.useSickDayGlobally
            // writes the global Sick Day marker through this setter.
            setSickDayDate: State.setSickDayDate,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH,
            habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD,
            habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD,
            // [P2-UI-009] session 59: fires a one-time toast the moment a
            // habit's streak crosses a visual tier (3 = on-fire, 7 =
            // blazing). Optional dep — tests that don't pass it simply skip
            // the notification (items.js guards with typeof === 'function').
            onStreakMilestone: (habitName, streak, tier, category) => {
                FrozenNotice.showStreakMilestoneNotice(habitName, streak, tier, category);
            },
            // Achievements sub-session 2 (session 65): the lifetime-stats
            // dispatcher (see recordLifetime above / completeItem's deps doc).
            recordLifetime,
            xpPerTaskDefeat: XP_PER_TASK_DEFEAT,
            xpPerHabitComplete: XP_PER_HABIT_COMPLETE,
            pointsPerTask: POINTS_PER_TASK,
            pointsPerHabit: POINTS_PER_HABIT,
            getNextId: () => {
                const n = State.getItemIdCounter();
                State.setItemIdCounter(n + 1);
                return n;
            },
            gameCanvas,
            handleEnemyClick, createListItem, sortAndRenderActiveList,
            resetAllSubTaskCheckboxes, updateTaskCountDisplay, renderCompletedItems,
            updatePlayerDisplays: () => Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge }), checkPlayerLevelUp, saveGame,
            calculateTimelineXWithClustering, getSubTaskClusterOffset, getItemTopPosition
        };
    }

    // (createTaskItemData/damageRoutineForItem/recordRunDamage wrappers
    // inlined at their call sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md
    // — real implementations live in js/items.js.)

    // (addItemToGame wrapper inlined at its call sites sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/spawning.js, Milestone 2 extraction, 2026-07-17.)

    // Thin wrappers — real implementations live in js/ui/agendaList.js
    // (Milestone 2 UI extraction sessions 6-7, 2026-07-18). Call sites
    // unchanged.
    //
    // isGameOver is passed as a GETTER, not a boolean: createListItem attaches
    // click handlers that outlive this call (the "+ Sub-task" button reads the
    // flag when clicked), so a snapshotted value would go stale after game
    // over. Same reason js/spawning.js passes `isGameOver: () => gameIsOver`.
    // activeItems and categoryStyles are stable bindings, so plain references
    // are correct for those. completedItems and definedHabits are GETTERS
    // (session 7) because both are REASSIGNED elsewhere (new-game reset,
    // restoreGameState) rather than only mutated in place.
    function agendaListDeps() {
        return {
            activeItems: State.getActiveItems(), categoryStyles,
            // Timer sessions Build B (2026-11-04): a completed entry's editor shows its Sessions list.
            changeSession, getBaseHealth: State.getBaseHealth,
            // V3c-2: the owning routine's chip beside the category label.
            routineChipFor: (item) => {
                const routine = Items.findRoutineForItem(item, { definedHabits: () => State.getDefinedHabits(), definedRoutines: () => State.getDefinedRoutines() });
                if (!routine) return null;
                return HeroesView.buildRoutineChip(routine, {
                    config: CONFIG, definedHabits: State.getDefinedHabits(), runStartedAtMs: State.getRunStartedAtMs(),
                    // 2026-10-21 (HERO_SPOTLIGHT_PLAN): the row avatar now spotlights
                    // the hero in front of the church; management stays in the
                    // Routines window until the hero tray lands.
                    onTap: (r) => spotlightRoutine(r.id, { bringCanvasIntoView: true }),
                });
            },
            completeItem: (itemId, opts) => Items.completeItem(itemId, itemsDeps(), opts),
            // Row-body tap: hero only, no popup (2026-10-26).
            onRowTap: (itemId) => { if (!State.isGameOver()) toggleHeroSelection(itemId); },
            indulgeHabit: (itemId, opts) => Items.indulgeHabit(itemId, itemsDeps(), opts),
            isGameOver: State.isGameOver,
            showEditTaskModal: (item) => Popups.showEditTaskModal(item, popupsDeps()),
            toggleWorkTimer,
            // opts { fromCompleted, completedItemId } (completed-list edit icon) reach the Edit Habit form, whose Save then
            // asks where the change applies (this entry / all following / both).
            showEditHabitInstanceModal: (itemData, opts) => AgendaList.showEditHabitInstanceModal(itemData, agendaListDeps(), opts),
            createSubTaskPrompt: (parentId) => Popups.createSubTaskPrompt(parentId, popupsDeps()),
            activeItemsListUL,
            completedItems: () => State.getCompletedItems(),
            // "Completed Today" lists only today's finishes (2026-11-03); tapping over to Yesterday swaps in
            // yesterday's, read-only. The day pager owns which day is on screen.
            currentGameDate: State.getCurrentGameDate,
            completedView: () => {
                if (typeof DayPagerView === 'undefined' || DayPagerView.getViewedDayOffset() !== -1) return null;
                const yesterday = new Date(State.getCurrentGameDate());
                yesterday.setDate(yesterday.getDate() - 1);
                return { day: yesterday, readOnly: true, heading: 'Completed Yesterday' };
            },
            uncompleteItem: (itemId) => Items.uncompleteItemWithDuePrompt(itemId, Object.assign({}, itemsDeps(), {
                promptNewDueTime: (item, cb) => Popups.promptNewDueTime(item, popupsDeps(), cb)
            })),
            definedHabits: () => State.getDefinedHabits(),
            showEditHabitForm: (routineId, habitDef, opts) => RoutineViews.showEditHabitForm(routineId, habitDef, opts),
            // Milestone 5 first-run/onboarding pass (2026-07-20): definedRoutines
            // completes the "has the player ever engaged with the app" check
            // (AgendaList.isFirstRunEmpty); openManagementWindow lets the
            // onboarding empty state's CTA button jump straight to the Tasks
            // window (same window the FAB menu opens), one tap closer than
            // routing through the FAB menu itself.
            definedRoutines: () => State.getDefinedRoutines(),
            openManagementWindow: (type) => openManagementWindow(type),
            // List-order reorder (2026-10-13): swap with the same-group neighbor,
            // re-render (re-stamps ranks, z-index, button visibility) and save.
            moveListItem: (itemId, dir) => {
                if (ListOrder.move(State.getActiveItems(), itemId, dir)) {
                    AgendaList.sortAndRenderActiveList(agendaListDeps());
                    saveGame();
                }
            },
        };
    }

    // (createListItem/showEditHabitInstanceModal wrappers inlined at their
    // call sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real
    // implementations live in js/ui/agendaList.js, Milestone 2 UI extraction
    // sessions 6-7, 2026-07-18.)

    // Thin wrappers — real implementations live in js/ui/popups.js
    // (Milestone 2 UI extraction session 5, 2026-07-18). Call sites
    // unchanged. Two dead local `today` variables (computed, never used)
    // were dropped during the move — zero behavior effect, verified by
    // Grep before removing.
    function popupsDeps() {
        return {
            gameIsOver: State.isGameOver(), activeItems: State.getActiveItems(),
            completedItems: () => State.getCompletedItems(), // the sub-task list's finished rows (2026-11-11)
            definedHabits: () => State.getDefinedHabits(), // habit popup 'Points:' line (PointsInfo)
            // Goals Build B2: the details popup's goal badge (a task linked to a goal) and its tap.
            goalBadgeHtml: (item) => { const b = GoalsPane.badgeFor(item, (State.getGoals() || {}).active); return b ? GoalsPane.badgeHtml(b) : ''; },
            onOpenGoal: (goalId) => GoalCard.open(goalId, goalCardDeps()),
            completeItem: (itemId, opts) => Items.completeItem(itemId, itemsDeps(), opts),
            indulgeHabit: (itemId, opts) => Items.indulgeHabit(itemId, itemsDeps(), opts),
            createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()),
            sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()),
            updateTaskCountDisplay, // week strip (2026-11-02): Edit Task can move a due date to another day
            // Priority slots (Build B): the forms mark / unmark through these, never by writing the flag.
            setPriority: (id, on) => Items.setPriority(id, on, itemsDeps()),
            syncPriorityOnMove: (item, oldDue) => Items.syncPriorityOnMove(item, oldDue, itemsDeps()),
            priorityRowDeps,
            saveGame, recomputeOverdueStateAfterEdit: (item) => Items.recomputeOverdueStateAfterEdit(item, itemsDeps()),
            createTaskItemData: (name, category, isHighPriority, dueDateStr, dueTimeStr, parentId, startTimeStr, anytime) => Items.createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId, itemsDeps(), startTimeStr, anytime),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => handleEnemyClick(itemId), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay, sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            // Pushback charges (Build B): the size buttons for an item (free / charge / token / points),
            // a live points getter, and the handler that pays + shifts the target's due date.
            pushbackOptionsFor,
            pushbackHelpCtx,
            getPlayerPoints: State.getPlayerPoints,
            onPushback: handlePushback,
            reschedulePricingFor,
            commitReschedule,
            toggleWorkTimer,
            setLoggedTime,
            changeSession,
            getBaseHealth: State.getBaseHealth,
            // Cheat Day targeting ([P1-DATA-005] sub-session 5, 2026-07-19):
            // held count for the popup's "Use Cheat Day (N held)" button,
            // whether THIS lurker's day already has one active (shows the
            // "active" note instead), and the handler that consumes a token
            // + sets the target habit definition's cheatDayDate.
            getCheatDayHeldCount: () => Shop.heldCount(State.getPlayerInventory(), 'cheat_day'),
            isCheatDayActiveForItem: (item) => {
                const habitDef = State.getDefinedHabits().find(def => def.id === item.definitionId);
                return !!habitDef && Items.isCheatDayExcused(habitDef, item.originalDueDate);
            },
            onUseCheatDay: handleUseCheatDay,
            // Skip Day targeting (frozen-slots sub-session 5, 2026-07-19):
            // held count for the popup's "Use Skip Day (N held)" button
            // (shown for ANY habit type, not just negative — see popups.js's
            // buildSkipDaySectionHtml) and the handler that consumes a token
            // + excuses + removes the targeted instance.
            getSkipDayHeldCount: () => Shop.heldCount(State.getPlayerInventory(), 'skip_day'),
            onUseSkipDay: handleUseSkipDay,
            // Dependent due dates ([P1-DATA-004] sub-session 2): after a
            // PARENT's deadline is edited, re-clamp any children now due
            // later than it (Jeremy's clamp model — earlier allowed, later
            // never; parent-pull re-clamps, parent-push leaves children).
            clampSubTaskDueDates: (parentItem) => Items.clampSubTasksToParentDeadline(parentItem, itemsDeps())
        };
    }

    // (handleEnemyClick/showEditTaskModal wrappers inlined at their call
    // sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    // (completeItem/indulgeHabit/removeItem wrappers inlined at their call
    // sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real
    // implementations live in js/items.js, Milestone 2 extraction
    // session 10, 2026-07-18 / sub-session 2b, 2026-07-19.)

    // (settleStaleRecurringInstance wrapper inlined at its call site
    // sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real implementation
    // lives in js/items.js, day-advance mechanism, 2026-07-19.)

    // (markPendingCheckIn/resolvePendingCheckIn wrappers inlined at their
    // call sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real
    // implementations live in js/items.js, sub-session 4, [P1-DATA-005],
    // 2026-07-19, check-in prompt.)

    // Thin wrappers — real implementations live in js/items.js (sub-session 5,
    // [P1-DATA-005], 2026-07-19, Cheat Day token). Called by state.js's
    // restoreGameState (stateDeps()) ahead of the check-in-eligible fork.
    function isCheatDayExcusedForItem(item) {
        const habitDef = State.getDefinedHabits().find(def => def.id === item.definitionId);
        return !!habitDef && Items.isCheatDayExcused(habitDef, item.originalDueDate);
    }

    // (settleExcusedCheatDay wrapper inlined at its call site sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md.)

    // Builds the deps object for js/ui/checkIn.js's showCheckInModal
    // (sub-session 4, [P1-DATA-005], 2026-07-19). definedHabits is a GETTER
    // (reassigned on new-game reset / restoreGameState), matching the
    // itemsDeps() precedent.
    function checkInDeps() {
        return {
            getDefinedHabits: State.getDefinedHabits,
            // Habit Goals Build 3: `opts` = the card's optional How much? ({ actual } for an Amount goal, { loggedMinutes } for a
            // Time goal). A typed time is applied to the entry the answer just kept, through the normal logged-time edit.
            resolvePendingCheckIn: (habitDefId, outcome, opts) => {
                const deps = itemsDeps();
                const result = Items.resolvePendingCheckIn(habitDefId, outcome, deps, opts);
                if (result && result.entryId != null && opts && typeof opts.loggedMinutes === 'number') {
                    Items.setLoggedTime(result.entryId, opts.loggedMinutes * 60000, deps, { collapse: true });
                }
            },
        };
    }

    // ---- Evening check (Habit Goals Build 3, plan Decision 7) ----------------------------------------------------------
    // At the player's evening time (Settings, default 9 PM) the game asks about every Break habit still unanswered today whose
    // time has arrived. In-app only: it shows while the app is open, polled from afterTick. "Later" / closing it with habits left
    // hides it until the next app open (boot, or the app coming back to the foreground); the next-morning check-in stays the backstop.
    let eveningDismissedFor = null;   // local dateKey the player closed tonight's check for (in memory only, on purpose)
    let lastEveningPollMs = 0;

    function eveningCheckDeps() {
        return {
            getCandidates: () => GoalCheck.eveningCandidates(State.getActiveItems(), State.getDefinedHabits(), Date.now()),
            completeItem: (id, opts) => Items.completeItem(id, itemsDeps(), opts),
            indulgeHabit: (id, opts) => Items.indulgeHabit(id, itemsDeps(), opts),
            setLoggedMinutes: (id, minutes) => Items.setLoggedTime(id, minutes * 60000, itemsDeps(), { collapse: true }),
            onDismiss: () => { eveningDismissedFor = DailyRecord.dateKey(Date.now()); },
            // Anytime tasks (Anytime Build 2, 2026-11-02; DECISIONS 2026-11-02 night): the same modal lists open "Anytime today"
            // tasks. Done = an ordinary on-time completion; Tomorrow = a move to tomorrow 11:59 PM through the pushback quote
            // (free before ~8 PM, a Long charge inside the last 4 hours); Leave it = answered for tonight (stamp).
            getTaskCandidates: () => AnytimeCheck.eveningCandidates(State.getActiveItems(), Date.now()),
            completeTask: (id) => Items.completeItem(id, itemsDeps()),
            leaveTask: (id) => {
                const task = State.getActiveItems().find(i => i.id === id && i.type === 'task');
                if (!task) return;
                AnytimeCheck.stampEvening(task, Date.now());
                saveGame();
            },
            describeTomorrow: (task) => Popups.pushbackNoteText(reschedulePricingFor(task, AnytimeCheck.tomorrowDue(Date.now())), State.getPlayerPoints()),
            moveTaskToTomorrow: moveAnytimeTaskToTomorrow,
        };
    }

    // The evening card's "Tomorrow": prices and applies a move of an anytime task to tomorrow 11:59 PM. Same steps as the Edit
    // Task save and the popup pushback (quote -> commitReschedule -> new due -> overdue re-check -> row refresh), so the daily
    // record, the Clock tower `pushedLate` flag and the charge / token / points payment all behave exactly as there. Returns
    // { ok: false } and changes nothing when the move can't be paid for.
    function moveAnytimeTaskToTomorrow(itemId) {
        return moveAnytimeTaskTo(itemId, AnytimeCheck.tomorrowDue(Date.now()));
    }

    // The morning card's "Today": the same move to 11:59 PM today (an overdue pushback, priced by the same quote).
    function moveAnytimeTaskToToday(itemId) {
        return moveAnytimeTaskTo(itemId, AnytimeCheck.morningDue(Date.now()));
    }

    function moveAnytimeTaskTo(itemId, newDue) {
        const task = State.getActiveItems().find(i => i.id === itemId && i.type === 'task');
        if (!task || State.isGameOver()) return { ok: false };
        const quote = reschedulePricingFor(task, newDue);
        if (!quote || !quote.ok) return { ok: false };
        commitReschedule(task, quote);
        const oldDue = task.dueDateTime;
        task.dueDateTime = newDue;
        Items.syncAnytimeFlag(task); // still 23:59, so it stays an anytime task
        Items.syncPriorityOnMove(task, oldDue, itemsDeps()); // "Tomorrow" is another day: priority does not carry over
        Items.recomputeOverdueStateAfterEdit(task, itemsDeps());
        if (task.listItemElement) {
            task.listItemElement.remove();
            if (!task.parentId) createListItem(task);
        }
        sortAndRenderActiveList();
        updateTaskCountDisplay(); // the week strip: the task changed days
        saveGame();
        return { ok: true };
    }

    // ---- Next-morning card (Anytime Build 3, 2026-11-02; widened 2026-11-09, DECISIONS) ------------------------------------------
    // On the first open after midnight (and on the poll, if the app stayed open) the game asks about every open one-off task due
    // on an earlier day, anytime or timed, once per morning for as long as it stays open. Done counts as ON TIME for the Clock
    // tower only for an anytime task due 11:59 PM yesterday, while a credit is left (the overnight damage stays); every other
    // Done is an ordinary late completion. Today moves it to 11:59 PM today through the pushback quote; Leave it answers it for
    // this morning only. Closing it with cards left hides it until the next app open.
    let morningTaskDismissed = false;

    // The player's on-time credits for the morning card's Done: { left, max, nextBackAt } (rolling window, CONFIG).
    function anytimeCreditInfo() {
        return AnytimeCheck.creditInfo(State.getAnytimeCreditUses(), Date.now(), CONFIG.ANYTIME_MORNING_CREDITS, CONFIG.ANYTIME_MORNING_CREDIT_WINDOW_MS);
    }

    function morningTaskDeps() {
        const findTask = (id) => State.getActiveItems().find(i => i.id === id && i.type === 'task');
        return {
            getTaskCandidates: () => AnytimeCheck.morningCandidates(State.getActiveItems(), Date.now()),
            // Done counts as on time only for an anytime task due yesterday (AnytimeCheck.onTimeEligible) and only while an
            // on-time credit is left (CONFIG.ANYTIME_MORNING_CREDITS per rolling 7 days); otherwise it is an ordinary late
            // completion. The credit is spent first so completeItem's own save keeps it, and handed back if the completion is
            // refused (open sub-tasks).
            completeTask: (id) => {
                const task = findTask(id);
                if (!task) return;
                const eligible = AnytimeCheck.onTimeEligible(task, Date.now());
                AnytimeCheck.stampMorning(task, Date.now());
                const before = State.getAnytimeCreditUses();
                const useCredit = eligible && anytimeCreditInfo().left > 0;
                if (useCredit) State.setAnytimeCreditUses(AnytimeCheck.spendCredit(before, Date.now(), CONFIG.ANYTIME_MORNING_CREDIT_WINDOW_MS));
                const res = Items.completeItem(id, itemsDeps(), useCredit ? { onTime: true } : undefined);
                if (res && res.ok === false) State.setAnytimeCreditUses(before);
            },
            getCredit: () => { const info = anytimeCreditInfo(); return { left: info.left, text: AnytimeCheck.creditText(info) }; },
            isOnTimeEligible: (task) => AnytimeCheck.onTimeEligible(task, Date.now()),
            leaveTask: (id) => {
                const task = findTask(id);
                if (!task) return;
                AnytimeCheck.stampMorning(task, Date.now());
                saveGame();
            },
            describeMove: (task) => Popups.pushbackNoteText(reschedulePricingFor(task, AnytimeCheck.morningDue(Date.now())), State.getPlayerPoints()),
            moveTaskToToday: moveAnytimeTaskToToday,
            onDismiss: () => { morningTaskDismissed = true; },
        };
    }

    function maybeShowMorningTaskCheck() {
        if (typeof CheckIn === 'undefined' || typeof AnytimeCheck === 'undefined' || State.isGameOver()) return;
        if (morningTaskDismissed || timePreviewActive || offlineCatchUpActive) return;
        // Never stack on another dialog (the morning check-in, the evening check, a form): the next poll tries again.
        if (document.querySelector('.modal-overlay')) return;
        CheckIn.showMorningTaskModal(morningTaskDeps());
    }

    // ---- Mood check-in + avatar (W1b Build A, 2026-11-13; docs/WORLD_FEEDBACK_PLAN.md "W1b Mood check-in", DECISIONS 2026-11-13) ----
    // The player's avatar face sits on the HUD level button and shows today's latest mood; the mood picker lives in the Level panel and
    // in a once-a-day morning card. Mood is informational only: it earns nothing and never touches the scene. Entries are the day's
    // `mood` list (DailyRecord v15), written through State.bumpToday like every other daily-record seam.
    let currentAvatar = Settings.load().avatar; // 'male' | 'female' | null (not chosen yet); changes go through setAvatar
    let moodCardShownFor = null; // the local day key the morning card (or the avatar question) was shown this session: never twice a day

    function moodDeps() {
        return {
            getEntries: () => { const t = State.getToday(); return t && Array.isArray(t.mood) ? t.mood : []; },
            onLog: (c) => {
                State.bumpToday('mood', { at: Date.now(), level: c.level, feelings: Mood.packFeelings(c.feelings), context: Mood.packContext(c.context) });
                saveGame();
                refreshAvatarFace();
            },
            // Build B2 (2026-11-13): the help card after a Bad / Awful tap (once a day) and the run-of-lows line on the morning card
            // (at most once a week). Both stamps live under their own per-device key, not in the save or the exported settings.
            helpAllowed: () => moodStamps().help !== DailyRecord.dateKey(Date.now()),
            onHelpShown: () => setMoodStamp('help', DailyRecord.dateKey(Date.now())),
            onHelpAction: (id) => {
                if (id === 'add10') addFigureItOutTask();
                else if (id === 'agenda') { const list = document.getElementById('activeItemsList'); if (list && list.scrollIntoView) list.scrollIntoView({ block: 'start' }); }
            },
            getLows: () => {
                if (typeof MoodHelp === 'undefined') return null;
                const key = DailyRecord.dateKey(Date.now());
                return MoodHelp.lowsCardDue(MoodHelp.lowStreak(key, moodForDay), moodStamps().lows, key) ? MoodHelp.LOWS_LINE : null;
            },
            onLowsShown: () => setMoodStamp('lows', DailyRecord.dateKey(Date.now())),
        };
    }
    const MOOD_STAMPS_KEY = 'deadline.moodStamps';
    function moodStamps() {
        try {
            const v = JSON.parse(localStorage.getItem(MOOD_STAMPS_KEY) || '{}');
            return v && typeof v === 'object' ? v : {};
        } catch (e) { return {}; }
    }
    function setMoodStamp(name, dayKey) {
        try { localStorage.setItem(MOOD_STAMPS_KEY, JSON.stringify(Object.assign(moodStamps(), { [name]: dayKey }))); } catch (e) { /* best effort */ }
    }
    // The help card's "Add a 10-minute task" button: an Anytime task for today, added the same way the Add Task form does.
    function addFigureItOutTask() {
        const fd = formsDeps();
        const due = PrioritySlots.dayKey(State.getCurrentGameDate());
        const data = fd.createTaskItemData('Figure out what\u2019s behind this (10 min)', 'other', false, due, '23:59', undefined, undefined, true);
        fd.addItemToGame(data);
        fd.sortAndRenderActiveList();
        fd.updateTaskCountDisplay();
        saveGame();
    }

    // The face is redrawn only when it changes (renderAvatarFace compares), so this is cheap enough for the per-tick call in updateGame.
    // A day's mood entries for the Weather table and Stats (W1b Build B1): 'today' or the open day's date = the open record, else a closed day.
    function moodForDay(key) {
        const t = State.getToday();
        if (key === 'today' || (t && key === t.date)) return t && Array.isArray(t.mood) ? t.mood : [];
        const days = State.getClosedDays();
        const rec = days && days[key];
        return rec && Array.isArray(rec.mood) ? rec.mood : [];
    }
    function refreshAvatarFace() {
        if (typeof MoodView === 'undefined') return;
        const t = State.getToday();
        MoodView.renderAvatarFace(document.getElementById('playerAvatarFace'), MoodView.faceModel(currentAvatar, t && t.mood, CONFIG.MOOD.AVATAR_ART_READY));
    }

    function setAvatar(id) {
        if (!Mood.isAvatar(id)) return;
        currentAvatar = id;
        Settings.save({ avatar: id });
        refreshAvatarFace();
    }

    function openMoodCardNow(todayKey) {
        Settings.save({ moodCardDay: todayKey });
        MoodView.openMoodCard({ title: 'How are you starting?', deps: moodDeps() });
    }

    // First open of a local day: ask "Who's playing?" if no avatar is chosen yet, then "How are you starting?". One card per day, never
    // stacked on another dialog (the next poll tries again), never during a time preview or the offline catch-up, never after a mood was
    // already logged today from the Level panel. Closing the avatar question without choosing asks again on the NEXT open, not this one.
    function maybeShowMoodCard() {
        if (typeof MoodView === 'undefined' || typeof Mood === 'undefined' || State.isGameOver()) return;
        if (timePreviewActive || offlineCatchUpActive) return;
        if (document.querySelector('.modal-overlay')) return;
        const todayKey = DailyRecord.dateKey(Date.now());
        if (moodCardShownFor === todayKey) return;
        if (moodDeps().getEntries().length > 0) { moodCardShownFor = todayKey; return; }
        if (Settings.load().moodCardDay === todayKey && currentAvatar) { moodCardShownFor = todayKey; return; }
        moodCardShownFor = todayKey;
        if (!currentAvatar) {
            MoodView.openAvatarPicker({
                onPick: (id) => {
                    setAvatar(id);
                    if (Settings.load().moodCardDay !== todayKey && moodDeps().getEntries().length === 0) openMoodCardNow(todayKey);
                },
            });
            return;
        }
        openMoodCardNow(todayKey);
    }

    // True while the evening check is the thing that will ask about a Break habit right now: the evening time has arrived and
    // the player has not closed tonight's check. The same-day "Time's up" arrival popup stands down in that window (it would ask
    // the same question a moment earlier, on top of the evening modal). It skips WITHOUT using its once-per-day stamp, so a habit
    // that arrives after the player closed tonight's check still gets its own arrival prompt.
    function eveningCheckCovers(nowMs) {
        if (typeof CheckIn === 'undefined' || typeof GoalCheck === 'undefined' || State.isGameOver()) return false;
        if (eveningDismissedFor === DailyRecord.dateKey(nowMs)) return false;
        return GoalCheck.isEveningTime(nowMs, Settings.load().eveningCheckTime);
    }

    function maybeShowEveningCheck() {
        if (typeof CheckIn === 'undefined' || typeof GoalCheck === 'undefined' || State.isGameOver()) return;
        if (timePreviewActive || offlineCatchUpActive) return;
        const nowMs = Date.now();
        if (!eveningCheckCovers(nowMs)) return;
        // Never stack on another dialog (a form, a popup, the morning check-in): try again on the next poll.
        if (document.querySelector('.modal-overlay')) return;
        CheckIn.showEveningModal(eveningCheckDeps());
    }

    // Throttled poll for afterTick (the settings read hits localStorage, so not every frame).
    function pollEveningCheck(nowMs) {
        if (nowMs - lastEveningPollMs < 15000) return;
        lastEveningPollMs = nowMs;
        maybeShowEveningCheck();
        maybeShowMorningTaskCheck();
        maybeShowMoodCard();
    }

    // Negative-habit "time has arrived" prompt (2026-10-21, Jeremy). Once per habit per
    // occurrence day: the stamp is saved on the habit definition, so a reload or a later
    // re-time never asks twice; "Later" just closes it (the next-morning check-in still
    // settles the day).
    function promptLurkerArrival(item) {
        if (typeof CheckIn === 'undefined' || !item || item.type !== 'habit') return;
        const def = State.getDefinedHabits().find(d => d.id === item.definitionId);
        if (!def || !def.isNegative) return;
        // Habit Goals Build 3: after the evening time the evening check asks instead (see eveningCheckCovers).
        if (eveningCheckCovers(Date.now())) return;
        const day = Habits.toOccurrenceDate(item.originalDueDate || item.dueDateTime);
        if (def.arrivalPromptedFor === day) return;
        def.arrivalPromptedFor = day;
        saveGame();
        CheckIn.queueArrivalPrompt(item, {
            completeItem: (id) => Items.completeItem(id, itemsDeps()),
            indulgeHabit: (id) => Items.indulgeHabit(id, itemsDeps()),
        });
    }

    // Shows the check-in modal if restoring the save left any pendingCheckIn
    // markers (state.js's rollover routing). Safe to call unconditionally —
    // CheckIn.showCheckInModal no-ops when nothing is pending.
    function showCheckInIfPending() {
        if (typeof CheckIn !== 'undefined') {
            CheckIn.showCheckInModal(checkInDeps());
        }
    }

    // (createSubTaskPrompt/uncompleteItem/resetAllSubTaskCheckboxes/
    // renderCompletedItems wrappers inlined at their call sites sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md.)

    // The following wrappers are kept as REAL functions (NOT inlined,
    // sub-session 3, docs/STATE_OWNERSHIP_PLAN.md) — each is referenced as a
    // bare identifier (object-shorthand deps entry, e.g. `{ createListItem }`,
    // not just a direct call) at multiple deps-builder sites, so inlining
    // would mean rewriting every one of those into an arrow (increases line
    // count, same reasoning saveGame was left alone for). A first attempt
    // this sub-session deleted these wrappers but missed the bare-reference
    // call sites, leaving real ReferenceErrors that only surfaced live in
    // Chrome (Jest never loads script.js) — a systematic re-check of every
    // "inlined at call sites" claim found 6 total broken this way (this one
    // plus createListItem, handleEnemyClick, removeItem, renderCompletedItems,
    // resetAllSubTaskCheckboxes below); all restored + verified live before
    // commit.
    function sortAndRenderActiveList() {
        AgendaList.sortAndRenderActiveList(agendaListDeps());
    }

    function createListItem(itemData) {
        return AgendaList.createListItem(itemData, agendaListDeps());
    }

    // Hero spotlight (docs/HERO_SPOTLIGHT_PLAN.md sub-session 2, 2026-10-21).
    // Lazy init so boot order is untouched. A tapped zombie that belongs to a
    // routine (a sub-task counts for its parent's routine) shows that routine's
    // hero in front of the church AND opens its usual popup (plan answer 1).
    function ensureHeroSpotlight() {
        if (heroSpotlightReady) return;
        HeroSpotlight.init({
            scrimEl: baseScrimEl,
            heroEl: heroSpotlightEl,
            config: CONFIG,
            getRoutine: (routineId) => State.getDefinedRoutines().find(r => r.id === routineId) || null,
            onDismiss: () => clearHeroSelection(),
        });
        heroSpotlightReady = true;
    }

    // Hero lane (2026-10-26): the hero stands on the feet line (= bottom edge of the element) of one of
    // its zombies, so it shares that zombie's lane in landscape and in the portrait strip.
    // Focus: the zombie tapped, else the one the work timer runs on, else the pick in
    // HeroSpotlight.pickLaneItem (attacker first, then soonest due).
    let heroFocusItemId = null;
    let heroWorkItemId = null;
    // Selected row (2026-10-26): tapping a row / canvas zombie HOLDS its hero up (no 5 s timeout) and
    // outlines the row; tapping the row again, the hero or the scrim lets it go. Avatar taps do not select.
    let heroSelectedItemId = null;
    function syncHeroSelectionRows() {
        State.getActiveItems().forEach(i => {
            const el = i.listItemElement;
            if (el && el.classList) el.classList.toggle('hero-selected-list-item', heroSelectedItemId !== null && i.id === heroSelectedItemId);
        });
    }
    function clearHeroSelection() {
        if (heroSelectedItemId === null) return;
        heroSelectedItemId = null;
        syncHeroSelectionRows();
    }
    function toggleHeroSelection(itemId) {
        if (heroSelectedItemId === itemId && HeroSpotlight.getCurrentRoutineId() !== null) { HeroSpotlight.dismiss(); return; }
        spotlightHeroForItem(itemId, { hold: true, bringCanvasIntoView: true });
    }
    function laneFeetBottomFor(item) {
        const el = item && item.element;
        if (!el || !gameCanvas || !el.getBoundingClientRect || !gameCanvas.getBoundingClientRect) return null;
        if (el.classList && el.classList.contains('strip-hidden')) return null;
        const er = el.getBoundingClientRect();
        if (!er.height) return null;
        const cr = gameCanvas.getBoundingClientRect();
        // absolute `bottom` is measured from the padding box's bottom edge
        const padBottom = cr.top + (gameCanvas.clientTop || 0) + gameCanvas.clientHeight;
        const px = padBottom - er.bottom;
        return (isFinite(px) && px > -2 && px < gameCanvas.clientHeight) ? Math.round(px * 2) / 2 : null;
    }
    // A category edit can change which hero an item stands for (resolveHeroForItem follows the item's own
    // category). When the hero on screen came from tapping an item, re-resolve it and swap in the new hero
    // (keeping a held selection held). Runs from refreshHeroLane, i.e. within ~500 ms of the edit.
    let reconcilingHero = false; // spotlightRoutine -> refreshHeroLane re-enters here before the new hero is shown
    function reconcileTappedHero() {
        if (reconcilingHero || heroFocusItemId === null) return;
        const currentId = HeroSpotlight.getCurrentRoutineId();
        if (currentId === null) return;
        const item = State.getActiveItems().find(i => i.id === heroFocusItemId);
        if (!item) return;
        const hero = HeroSpotlight.resolveHeroForItem(item, State.getActiveItems(), findRoutineForItemDeps, CONFIG.HERO_CATEGORIES);
        if (!hero || String(hero.id) === String(currentId)) return;
        reconcilingHero = true;
        try { spotlightRoutine(hero.id, { itemId: item.id, hold: heroSelectedItemId !== null }); }
        finally { reconcilingHero = false; }
    }
    function refreshHeroLane() {
        if (!heroSpotlightReady) return;
        reconcileTappedHero();
        if (heroSelectedItemId !== null) {
            // the selected task was completed / removed (or the run ended): let its hero go; else keep the outline on rebuilt rows
            if (State.isGameOver() || !State.getActiveItems().some(i => i.id === heroSelectedItemId)) HeroSpotlight.dismiss();
            else syncHeroSelectionRows();
        }
        const vid = HeroSpotlight.getVisibleRoutineId();
        if (vid === null || vid === undefined) { HeroSpotlight.setLaneBottom(null); return; }
        const tapped = HeroSpotlight.getCurrentRoutineId() !== null;
        const item = HeroSpotlight.pickLaneItem(vid, State.getActiveItems(), findRoutineForItemDeps, CONFIG.HERO_CATEGORIES,
            tapped ? heroFocusItemId : heroWorkItemId, Items.isNonThreatening);
        HeroSpotlight.setLaneBottom(item ? laneFeetBottomFor(item) : null);
    }

    // Heroes whose zombies are attacking loop the hurt row (2026-10-26). Same rule as the church pulse:
    // overdue and not Items.isNonThreatening. Blank while the time slider previews or after game over.
    let heroAttackLastMs = 0;
    function refreshHeroAttack(force) {
        if (!heroSpotlightReady) return;
        const now = Date.now();
        if (!force && now - heroAttackLastMs < 500) return;
        heroAttackLastMs = now;
        // A just-completed zombie stays in the list while its death animation plays: it no longer attacks.
        const ids = (timePreviewActive || State.isGameOver()) ? []
            : HeroSpotlight.attackedHeroIds(State.getActiveItems().filter(i => !i.completedAt), findRoutineForItemDeps, CONFIG.HERO_CATEGORIES, Items.isNonThreatening, (it) => Ice.stateIn(it, State.getActiveItems(), now).iced);
        HeroSpotlight.setAttackedHeroes(ids);
        refreshHeroLane();
    }

    // Completing a task / habit (2026-10-26): the item's hero (its routine's, else its category's;
    // a sub-task uses its parent's) comes up in the defeated zombie's lane and plays `attack` once, then
    // stays for the normal HERO_SPOTLIGHT_MS. It replaces any hero already up and releases a selected row
    // (the hold would otherwise outlive the item). Called from Items.completeItem before the death animation.
    function heroAttackOnDefeat(item) {
        if (!item || !baseScrimEl || !heroSpotlightEl) return;
        if (CONFIG.HERO_ATTACK_ON_COMPLETE === false) return;
        const hero = HeroSpotlight.resolveHeroForItem(item, State.getActiveItems(), findRoutineForItemDeps, CONFIG.HERO_CATEGORIES);
        if (!hero) return;
        ensureHeroSpotlight();
        heroFocusItemId = item.id;
        clearHeroSelection();
        if (!HeroSpotlight.react(hero.id, 'attack')) return;
        refreshHeroLane(); // the hero is visible now: put its feet on the defeated zombie's feet line at once
    }

    function spotlightRoutine(routineId, opts) {
        ensureHeroSpotlight();
        heroFocusItemId = (opts && opts.itemId !== undefined) ? opts.itemId : null;
        const hold = !!(opts && opts.hold && opts.itemId !== undefined);
        heroSelectedItemId = hold ? opts.itemId : null;
        refreshHeroAttack(true);
        if (!HeroSpotlight.show(routineId, { hold })) { heroSelectedItemId = null; syncHeroSelectionRows(); return; }
        syncHeroSelectionRows();
        refreshHeroLane(); // the hero is the visible one now: measure its lane at once, so it never jumps in later
        // Portrait: the strip scrolls away with the page, so a tap deep in the
        // list brings it back into view (only when it is fully off-screen).
        if (opts && opts.bringCanvasIntoView && gameCanvas && gameCanvas.getBoundingClientRect) {
            const r = gameCanvas.getBoundingClientRect();
            if (r.bottom <= 0 || r.top >= window.innerHeight) {
                gameCanvas.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        }
    }

    function findRoutineForItemDeps(it) {
        return Items.findRoutineForItem(it, { definedHabits: () => State.getDefinedHabits(), definedRoutines: () => State.getDefinedRoutines() });
    }

    // Any item has a hero: its routine's, else its own category's (2026-10-26).
    function spotlightHeroForItem(itemId, opts) {
        const item = State.getActiveItems().find(i => i.id === itemId);
        if (!item) return;
        const hero = HeroSpotlight.resolveHeroForItem(item, State.getActiveItems(), findRoutineForItemDeps, CONFIG.HERO_CATEGORIES);
        if (hero) spotlightRoutine(hero.id, Object.assign({}, opts, { itemId }));
    }

    // ---- Work timer (Build 3, 2026-10-25; docs/DESIGN_QUESTIONS_KO_EDIT_TIMER.md Q3) ----
    // Pure rules live in js/timer.js; this is the wiring. One timer at a time; the
    // owning routine's hero (pseudo "Other" hero for standalone items) attacks, with no
    // scrim, while it runs.
    let workHeroKey = null;
    let lastTimerLabelMs = 0;

    function resolveWorkHero(item) {
        return HeroSpotlight.resolveHeroForItem(item, State.getActiveItems(), findRoutineForItemDeps, CONFIG.HERO_CATEGORIES);
    }

    function syncWorkHero(runningAny) {
        // Limit timers (negative habits) have no hero.
        const running = (runningAny && !Timer.isLimit(runningAny)) ? runningAny : null;
        heroWorkItemId = running ? running.id : null;
        if (!running) {
            if (workHeroKey !== null) { workHeroKey = null; HeroSpotlight.setWork(null); }
            return;
        }
        const routine = resolveWorkHero(running);
        if (workHeroKey === routine.id) return;
        ensureHeroSpotlight();
        refreshHeroAttack(true);
        workHeroKey = routine.id;
        HeroSpotlight.setWork(routine);
        refreshHeroLane();
    }

    function updateTimerButtons(nowMs) {
        const activeList = State.getActiveItems();
        activeList.forEach(item => {
            // A sub-task has no row of its own (it renders inside its parent's), so its controls are found in the parent's row
            // (2026-11-09, timers on sub-tasks). Every timer control carries data-item-id, so a parent never picks up a
            // sub-task's button or icons (or the reverse).
            const rowEl = item.listItemElement
                || (item.parentId != null ? ((activeList.find(p => p.id === item.parentId) || {}).listItemElement || null) : null);
            if (!rowEl) return;
            const idSel = '[data-item-id="' + item.id + '"]';
            const btn = rowEl.querySelector('.work-timer-btn' + idSel);
            if (!btn) return;
            const running = Timer.isRunning(item);
            btn.classList.toggle('running', running);
            const overLimit = Timer.isOverLimit(item, nowMs); // Break limit passed: timer + Pause/Play/Stop turn red
            btn.classList.toggle('over-limit', overLimit);
            const limitCaption = item.listItemElement ? item.listItemElement.querySelector('.timer-limit-caption') : null;
            if (limitCaption) limitCaption.classList.toggle('over', overLimit);
            const html = Timer.buttonHtml(item, nowMs);
            if (btn.dataset.html !== html) { btn.innerHTML = html; btn.dataset.html = html; } // skip the per-second rebuild while idle
            const nudge = !State.isGameOver() && Timer.shouldNudge(item);
            btn.classList.toggle('attacking', nudge);
            const planned = !State.isGameOver() && !nudge && Timer.shouldPrompt(item, nowMs);
            btn.classList.toggle('planned', planned);
            btn.title = nudge ? Timer.NUDGE_TITLE : planned ? Timer.PROMPT_TITLE : Timer.buttonTitle(item);
            btn.setAttribute('aria-label', btn.title);
            // Pause / Play (resume) / Stop icons beside the timer.
            const controls = Timer.controlState(item);
            rowEl.querySelectorAll('.timer-ctl-btn' + idSel).forEach(c => {
                const action = c.classList.contains('timer-ctl-play') ? 'play' : c.classList.contains('timer-ctl-stop') ? 'stop' : 'pause';
                c.hidden = !controls[action];
                c.classList.toggle('over-limit', overLimit);
            });
        });
        refreshStartedMarkers(nowMs);
    }

    // Started marker (2026-11-04, Jeremy; js/startedMarker.js, css/startedMarker.css, DECISIONS 2026-11-04 (started
    // marker)). Runs with the timer labels (once a second, and right after any timer change). Inside an item's
    // Start -> Due window its zombie gets a stopwatch badge + amber glow (breathing / quiet / working), its row the
    // "Started ..." / "Working ..." chip, and the row moves into the list's "Started (N)" group. A live Start crossing
    // plays a one-time ring burst + row flash. Skipped (and re-baselined, so nothing bursts for what a preview or the
    // catch-up skipped past) while the time slider / another day or offline catch-up owns the board.
    // (startedPrevIds / startedGroupKey are declared near timePreviewActive, before any boot call can reach here.)
    function refreshStartedMarkers(nowMs) {
        if (typeof StartedMarker === 'undefined') return;
        if (timePreviewActive || offlineCatchUpActive) { startedPrevIds = null; return; }
        const items = State.getActiveItems();
        const gameOver = State.isGameOver();
        const nowIds = [];
        items.forEach(item => {
            const state = gameOver ? 'none' : StartedMarker.stateFor(item, nowMs, { isRunning: Timer.isRunning });
            if (state !== 'none') nowIds.push(item.id);
            applyStartedState(item, state);
            if (!item.parentId && item.listItemElement) applyStartedRow(item, items, nowMs, gameOver);
        });
        StartedMarker.arrivals(startedPrevIds, nowIds).forEach(id => {
            const item = items.find(i => i.id === id);
            if (item) playStartedArrival(item, items);
        });
        startedPrevIds = nowIds;
        const key = gameOver ? '' : StartedMarker.groupKey(items, nowMs);
        if (startedGroupKey !== null && key !== startedGroupKey) sortAndRenderActiveList();
        startedGroupKey = key;
    }
    function applyStartedState(item, state) {
        const el = item.element;
        if (!el || !el.classList || (el.dataset.started || 'none') === state) return;
        el.dataset.started = state;
        el.classList.toggle('started-marker', state !== 'none');
        el.classList.toggle('started-breathe', state === 'started');
        el.classList.toggle('started-quiet', state === 'quiet');
        el.classList.toggle('started-working', state === 'working');
        if (state !== 'none' && !el.querySelector('.started-badge')) {
            const badge = document.createElement('span');
            badge.className = 'started-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.innerHTML = Timer.ICON_SVG;
            el.appendChild(badge);
        }
    }
    function applyStartedRow(row, items, nowMs, gameOver) {
        const li = row.listItemElement;
        const note = li.querySelector('.started-note');
        const text = gameOver ? '' : StartedMarker.rowNote(row, items, nowMs, {
            isRunning: Timer.isRunning,
            elapsed: (w) => Timer.formatElapsed(Timer.elapsedMs(w, nowMs)),
        });
        if (note && note.textContent !== text) {
            note.innerHTML = text ? `${Timer.ICON_SVG}<span></span>` : '';
            if (text) note.lastChild.textContent = text;
            note.hidden = !text;
        }
        li.classList.toggle('started-list-item', !!text);
        li.classList.toggle('started-working-list-item', !!text && text.indexOf('Working') === 0);
    }
    function playStartedArrival(item, items) {
        const ms = (typeof CONFIG.STARTED_ARRIVAL_MS === 'number') ? CONFIG.STARTED_ARRIVAL_MS : 2800;
        const el = item.element;
        if (el && el.classList) {
            if (!el.querySelector('.started-ring')) {
                const ring = document.createElement('span');
                ring.className = 'started-ring';
                ring.setAttribute('aria-hidden', 'true');
                el.appendChild(ring);
            }
            el.classList.remove('started-arrive');
            void el.offsetWidth; // restart the CSS animation if it was mid-play
            el.classList.add('started-arrive');
            setTimeout(() => el.classList.remove('started-arrive'), ms);
        }
        const rowItem = item.parentId ? items.find(i => i.id === item.parentId) : item;
        const li = rowItem && rowItem.listItemElement;
        if (li && li.classList) {
            li.classList.remove('started-arrive-row');
            void li.offsetWidth;
            li.classList.add('started-arrive-row');
            setTimeout(() => li.classList.remove('started-arrive-row'), ms);
        }
    }

    // action: undefined = the main timer button (start / resume when idle, pause when running);
    // 'pause' holds a running timer (resumable); 'play' resumes a paused one; 'stop' ends the session
    // (the time stays logged either way).
    function toggleWorkTimer(itemId, action) {
        if (State.isGameOver()) return { ok: false };
        const items = State.getActiveItems();
        const item = items.find(i => i.id === itemId);
        if (!item) return { ok: false };
        const now = Date.now();
        if (Timer.isRunning(item)) {
            if (action === 'play') return { ok: true, running: true };
            // Pause / Stop only bank the time. A Break habit's limit timer is a "logged so far" helper
            // (Habit Goals Build 2): it never answers Resisted / Slipped for the player.
            if (action === 'stop') Timer.stop(item, now); else Timer.pause(item, now);
        } else {
            if (action === 'stop') {
                // Stop on a paused timer: its time is already banked, so just end the session.
                if (!Timer.endPaused(item)) return { ok: false };
                updateTimerButtons(now);
                saveGame();
                return { ok: true, running: false };
            }
            if ((action && action !== 'play') || !Timer.canTimer(item)) return { ok: false };
            // One timer at a time (Jeremy, 2026-11-10): Timer.startExclusive stops the timer running on any other item (its time
            // is kept), ends every other item's ice grace (never two zombies iced at once) and starts this one.
            Timer.startExclusive(items, item, now);
        }
        syncWorkHero(Timer.findRunning(items));
        updateTimerButtons(now);
        saveGame();
        return { ok: true, running: Timer.isRunning(item) };
    }

    // Logged-time edit (Habit Goals Build 2c): active or completed item; refuses while the timer runs.
    // Returns Items.setLoggedTime's { ok, deltaMin, completed } | { ok:false, reason }.
    // Timer sessions Build B (2026-11-04): a typed total changes only the untimed entry and is refused below the recorded sessions
    // ({ ok:false, reason:'below-timed' }); the auto-stop notice and the answer cards pass { collapse: true } (no message to show).
    function setLoggedTime(itemId, ms, opts) {
        const r = Items.setLoggedTime(itemId, ms, itemsDeps(), opts);
        if (r.ok) updateTimerButtons(Date.now());
        return r;
    }
    // Edit / delete / add one timer session (Items.changeSession): charges back halved damage when a session is shortened
    // over minutes its zombie was attacking, with the 1 HP floor. Returns { ok, deltaMin, chargedHp, ... } | { ok:false, reason }.
    function changeSession(itemId, change) {
        const r = Items.changeSession(itemId, change, itemsDeps());
        if (r.ok) updateTimerButtons(Date.now());
        return r;
    }

    // Goal reached (Habit Goals Build 2): the 4-button popup. One popup per timer run: if the player
    // dismisses it (tap outside / Esc) it does not re-open every tick; the timer keeps running and it
    // asks again on the next app open (goalAcked is only set by a real answer).
    let goalPopupKey = null;
    function showGoalReachedPopup(item, nowMs) {
        const key = item.id + ':' + (item.timer && item.timer.startedAt);
        if (goalPopupKey === key) return;
        goalPopupKey = key;
        const refresh = () => { syncWorkHero(Timer.findRunning(State.getActiveItems())); updateTimerButtons(Date.now()); saveGame(); };
        TimerView.showGoalReached(item, {
            goalMinutes: item.timerMinutes,
            loggedMinutes: Timer.loggedMinutes(item, nowMs),
            hasOpenSubTasks: item.type === 'task' && Array.isArray(item.subTasks) && item.subTasks.length > 0,
        }, {
            onMarkDone: () => {
                Timer.stop(item, Date.now());
                Items.completeItem(item.id, itemsDeps());
                const completed = !State.getActiveItems().includes(item);
                refresh();
                if (!completed) TimerView.showGoalBlocked(item);
            },
            onKeepGoing: () => { Timer.acknowledgeGoal(item); saveGame(); },
            onPause: () => { Timer.pause(item, Date.now()); Timer.acknowledgeGoal(item); refresh(); },
            onMistake: () => { Timer.discardSession(item, Date.now()); refresh(); },
        });
    }

    // Break limit passed (Habit Goals Build 2b): same once-per-run guard as the goal popup. Slipped / Resisted answer
    // the habit through the same paths as the Slipped / Resisted buttons (both stop the timer and keep its time);
    // Started by mistake drops this session's time; Keep going stops further asking. Dismissing asks again next open.
    let limitPopupKey = null;
    function showLimitPassedPopup(item, nowMs) {
        const key = item.id + ':' + (item.timer && item.timer.startedAt);
        if (limitPopupKey === key) return;
        limitPopupKey = key;
        const refresh = () => { syncWorkHero(Timer.findRunning(State.getActiveItems())); updateTimerButtons(Date.now()); saveGame(); };
        TimerView.showLimitPassed(item, {
            limitMinutes: item.timerMinutes,
            loggedMinutes: Timer.loggedMinutes(item, nowMs),
        }, {
            onSlipped: () => { Items.indulgeHabit(item.id, itemsDeps()); refresh(); },
            // "I stayed within it" = Resisted, the timer stops, then the real time spent is asked (Build 2c): the field
            // starts at the limit; "Keep ... logged" leaves the timer's own total.
            onWithin: () => {
                const limitMs = item.timerMinutes * 60000;
                Items.completeItem(item.id, itemsDeps());
                refresh();
                // One tick later: this click is still bubbling, and the dismiss handler must not see the new overlay.
                const loggedMinutes = Timer.loggedMinutes(item, Date.now());
                setTimeout(() => TimerView.showLoggedTimeEditor(item, {
                    loggedMinutes,
                    prefillMs: limitMs,
                }, { onSave: (ms) => { setLoggedTime(item.id, ms, { collapse: true }); } }), 0);
            },
            onMistake: () => { Timer.discardSession(item, Date.now()); refresh(); },
            onKeepGoing: () => { Timer.acknowledgeGoal(item); saveGame(); },
        });
    }

    // Per-tick (afterTick): keeps the hero in step with whatever is running (also after a
    // reload), updates row labels once a second, and fires the prompt / auto-stop / target.
    function processTimers(nowMs) {
        const items = State.getActiveItems();
        const running = Timer.findRunning(items);
        // Idle too (2026-10-31): a row turns overdue while NO timer runs, and that is exactly when its button must start pulsing.
        if (!running) { syncWorkHero(null); if (nowMs - lastTimerLabelMs >= 1000) { lastTimerLabelMs = nowMs; updateTimerButtons(nowMs); } return; }
        if (running.koGhost) { Timer.stop(running, nowMs); syncWorkHero(null); updateTimerButtons(nowMs); saveGame(); return; }
        syncWorkHero(running);
        if (nowMs - lastTimerLabelMs >= 1000) { lastTimerLabelMs = nowMs; updateTimerButtons(nowMs); }
        const action = Timer.pendingAction(running, nowMs);
        if (!action) return;
        if (action === 'goal-reached') {
            showGoalReachedPopup(running, nowMs);
        } else if (action === 'limit-passed') {
            showLimitPassedPopup(running, nowMs);
        } else if (action === 'prompt') {
            Timer.markPrompted(running, Timer.promptDueAt(running));
            saveGame();
            // Normally due "now". If the app was closed past the whole window, the next tick
            // auto-stops (banking only up to the moment the prompt was due) -- no modal.
            if (Timer.pendingAction(running, nowMs) !== 'autostop') {
                TimerView.showStillWorking(running, {
                    onContinue: () => { Timer.confirmStillWorking(running, Date.now()); saveGame(); },
                    onStop: () => { Timer.stop(running, Date.now()); syncWorkHero(null); updateTimerButtons(Date.now()); saveGame(); },
                });
            }
        } else if (action === 'autostop') {
            const sessionMs = Timer.autoStop(running, nowMs);
            TimerView.closeStillWorking();
            syncWorkHero(null);
            updateTimerButtons(nowMs);
            saveGame();
            showAutoStoppedNotice(running, sessionMs);
        }
    }

    // Auto-stop notice (2026-11-04): says what this run banked and the task's total, then lets the player fix the run.
    // Keep = leave as banked (also what dismissing does); Delete = take this run's time back out; Edit = fix that run.
    // Build C (2026-11-04): the run the auto-stop just recorded is a session, so Edit opens ITS row (start / stop / Delete, with the
    // halved-damage take-back and the 1 HP floor) and Delete removes that session. A run under a second leaves no row; then the
    // typed-total editor (collapsing) is the fallback.
    function showAutoStoppedNotice(item, sessionMs) {
        const totalMs = Timer.elapsedMs(item, Date.now());
        const last = (typeof TimerSessions !== 'undefined') ? TimerSessions.latest(item) : null;
        const run = (last && Math.abs((last.end - last.start) - sessionMs) < 1500) ? last : null;
        TimerView.showAutoStopped(item, { sessionMs, totalMs }, {
            onEdit: () => {
                // One tick later: this click is still bubbling, and the dismiss handler must not see the new overlay.
                setTimeout(() => {
                    if (run) {
                        TimerView.showSessionEditor(item, { index: run.index, sessionMs }, { changeSession: (id, change) => changeSession(id, change), getBaseHealth: State.getBaseHealth, onChange: () => updateTimerButtons(Date.now()) });
                        return;
                    }
                    const now = Date.now();
                    const total = Timer.elapsedMs(item, now);
                    TimerView.showLoggedTimeEditor(item, {
                        loggedMinutes: Timer.loggedMinutes(item, now),
                        prefillMs: total,
                        message: `The timer stopped with ${TimerView.formatMinutes(sessionMs / 60000)} logged, so the total for this task is `
                            + `${TimerView.formatMinutes(total / 60000)}. How much time did you actually spend in total?`,
                    }, { onSave: (ms) => { setLoggedTime(item.id, ms, { collapse: true }); } });
                }, 0);
            },
            onKeep: () => {},
            onDelete: () => {
                if (run) { changeSession(item.id, { type: 'delete', index: run.index }); return; }
                setLoggedTime(item.id, Math.max(0, Timer.elapsedMs(item, Date.now()) - sessionMs), { collapse: true });
            },
        });
    }

    function handleEnemyClick(itemId) {
        if (!State.isGameOver()) spotlightHeroForItem(itemId, { hold: true });
        Popups.handleEnemyClick(itemId, popupsDeps());
        showEnemyRing(itemId);
    }

    // Ground ring on tap (2026-11-06, docs/ENEMY_HIGHLIGHT_PLAN.md): the tapped zombie wears the bright ring and its
    // relatives (parent / siblings / sub-tasks / routine mates) the dim one while its card is open; EnemyRing.watch
    // clears both when the last modal closes. If the tap opened no card at all (game over, a stale click) the
    // marking is dropped on the next tick so a ring can never stick.
    function showEnemyRing(itemId) {
        if (State.isGameOver() || typeof EnemyRing === 'undefined') return;
        const getItems = () => State.getActiveItems();
        EnemyRing.watch(getItems);
        EnemyRing.show(getItems(), itemId, (item) => {
            try { const r = Items.findRoutineForItem(item, itemsDeps()); return r ? r.id : null; } catch (e) { return null; }
        });
        setTimeout(() => { if (!document.querySelector('.modal-overlay')) EnemyRing.clear(getItems()); }, 100);
    }

    function removeItem(itemId) {
        Items.removeItem(itemId, itemsDeps());
    }

    function renderCompletedItems() {
        AgendaList.renderCompletedItems(agendaListDeps());
    }

    function resetAllSubTaskCheckboxes() {
        AgendaList.resetAllSubTaskCheckboxes();
    }

    // Single choke point (2026-07-20, Milestone 5 UX batch — playtest
    // finding #1): every deps.updateTaskCountDisplay() call site across
    // items.js/spawning.js/state.js resolves here. Previously two separate
    // inline closures called Hud.updateTaskCountDisplay directly and never
    // touched the week strip, so completing/creating a task left the strip's
    // per-day counts stale until the next pager navigation. DayPagerView's
    // refreshWeekStrip() is a no-op if weekStripRowEl isn't wired (module
    // not yet init'd) or the row itself is absent, matching renderWeekStrip's
    // own guard.
    function updateTaskCountDisplay() {
        Hud.updateTaskCountDisplay({ activeItems: State.getActiveItems(), taskCountDisplay });
        DayPagerView.refreshWeekStrip();
        refreshPrioritySlots();
    }

    // Priority slots (Build B, 2026-11-04): the pips in the list header show the slots of the VIEWED day (Today, a later
    // day on the pager, or Yesterday read-only). Cheap: one lookup + a few spans, so every count refresh may call it.
    function priorityRowDeps() {
        return {
            prioritySlotsFor: (due) => Items.prioritySlotsFor(due, itemsDeps()),
            perDay: CONFIG.PRIORITY_SLOTS_PER_DAY,
            todayKey: PrioritySlots.dayKey(State.getCurrentGameDate()),
        };
    }
    function refreshPrioritySlots() {
        const el = document.getElementById('prioritySlots');
        if (!el || typeof PrioritySlotsView === 'undefined') return;
        const rowDeps = priorityRowDeps();
        const offset = DayPagerView.getViewedDayOffset();
        const viewStart = DayPagerView.getViewedDayStart();
        const due = viewStart || State.getCurrentGameDate();
        const slots = Items.prioritySlotsFor(due, itemsDeps());
        const word = PrioritySlotsView.dayWord(slots.key, rowDeps.todayKey);
        PrioritySlotsView.render(el, slots, {
            perDay: rowDeps.perDay, word, readOnly: offset < 0,
            onTap: (s) => Dialog.notice(PrioritySlotsView.explainerText(s, rowDeps.perDay, word), { title: 'Priority slots' }),
        });
    }

    // (markAsOverdue wrapper inlined at its one call site (loopDeps) sub-session
    // 3, docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/items.js, Milestone 2 extraction session 10, 2026-07-18.)

    // Re-derives isOverdue from the item's CURRENT dueDateTime — call after any
    // edit that changes an item's due date, since isOverdue is otherwise only
    // ever set forward by Items.markAsOverdue/updateActiveItems and never
    // re-checked. Without this, editing an overdue task's deadline into the
    // future left it camped at the base still taking damage (see
    // showEditTaskModal save handler, DECISIONS.md 2026-07-17).
    // (Wrapper inlined at its two call sites (popupsDeps, handlePushback)
    // sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    // Sub-task cluster offset + visible-edge math live in js/movement.js
    // (Milestone 2 extraction, 2026-07-17). Thin wrapper — call site unchanged.
    function getSubTaskClusterOffset(item) {
        return Movement.getSubTaskClusterOffset(item, {
            activeItems: State.getActiveItems(),
            enemyWidth: ENEMY_WIDTH,
            glanceStrip: Layout.isActive()
        });
    }

    // Growing/shrinking parent visuals ([P1-DATA-004] sub-session 4,
    // 2026-07-19) — pure math lives in js/movement.js. Thin wrapper, called
    // per tick from loopDeps().
    function getParentRenderWidth(item) {
        return Movement.getParentRenderWidth(item, ENEMY_WIDTH);
    }

    // Sub-task clustering vs own-urgency logic lives in js/movement.js
    // (Milestone 2 extraction, 2026-07-17). Thin wrapper — call site unchanged.
    function calculateTimelineXWithClustering(item, currentTime) {
        return Movement.calculateTimelineXWithClustering(item, currentTime, {
            activeItems: State.getActiveItems(),
            glanceStrip: Layout.isActive(),
            dims: {
                gameScreenWidth: GAME_SCREEN_WIDTH,
                baseWidth: BASE_WIDTH,
                enemyWidth: ENEMY_WIDTH,
                habitEnemyWidth: HABIT_ENEMY_WIDTH
            }
        });
    }

    // Sub-task-vs-parent vertical alignment lives in js/movement.js (Milestone 2
    // extraction, 2026-07-17). Wrapper reads the live canvas height (DOM) here;
    // call site unchanged.
    function getItemTopPosition(item, itemHeight) {
        return Movement.getItemTopPosition(item, itemHeight, {
            activeItems: State.getActiveItems(),
            canvasHeight: gameCanvas.offsetHeight
        });
    }

    // Timeline position math lives in js/clock.js (Milestone 2 extraction,
    // 2026-07-17) — thin wrapper so every existing call site is unchanged.
    function calculateTimelinePosition(item, currentTime) {
        return Clock.calculateTimelinePosition(item, currentTime, {
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH
        });
    }

    // --- Game loop (js/loop.js) ---
    // Milestone 2 extraction session 12, 2026-07-18 — the per-tick loop
    // (updateGame/updateActiveItems) was the last real game logic in this
    // file. Thin wrappers so all call sites (setInterval in state.js's
    // initGame via stateDeps().updateGame, offline catch-up) are unchanged.
    function loopDeps() {
        return {
            // Per-tick lanes + "+N" badges for the portrait glance strip
            // (V3b-1 sub badges, V3b-2 lanes / collision + overdue-pile badges).
            afterTick: () => {
                // Church flash + shake every few seconds while attackers are at the base (visual only).
                Damage.pulseIfUnderAttack(Date.now(), {
                    baseElement,
                    getActiveItems: State.getActiveItems,
                    isGameOver: State.isGameOver,
                    isNonThreatening: Items.isNonThreatening,
                    isIced: (it) => Ice.stateIn(it, State.getActiveItems(), Date.now()).iced,
                });
                processTimers(Date.now());
                pollEveningCheck(Date.now());
                observeClockStar(Date.now());
                payVillageDrops(Date.now());
                trackBestVillageTiers(Date.now());
                refreshBaseChip();
                GraveyardView.render(churchWidth());
                VillageView.render(churchWidth());
                ClimateView.refresh();
                refreshHeroAttack();
                maybeShowTimerHint();
                const canvasItems = State.getActiveItems().filter(i => !Clock.isDueAfterDay(i, new Date()));
                Layout.applyStripLayout(canvasItems, { baseWidth: BASE_WIDTH });
                // Landscape/desktop: ground lanes in list order, overlap-avoiding (no-op in strip mode).
                if (!Layout.isActive()) Layout.applyGroundLanes(canvasItems, gameCanvas.offsetHeight, { baseWidth: BASE_WIDTH, fieldRight: GAME_SCREEN_WIDTH });
            },
            isGameOver: State.isGameOver,
            isOfflineCatchUpActive: () => offlineCatchUpActive,
            // Time slider (Milestone 4, 2026-07-20) — REQUIRED, same
            // "one owner at a time" contract as isOfflineCatchUpActive above.
            isTimePreviewActive: () => timePreviewActive,
            activeItems: State.getActiveItems(),
            baseWidth: BASE_WIDTH,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            getLastLoopTickMs: State.getLastLoopTickMs,
            setLastLoopTickMs: State.setLastLoopTickMs,
            getLastRegenTickMs: State.getLastRegenTickMs,
            setLastRegenTickMs: State.setLastRegenTickMs,
            getLastAutosaveMs: () => lastAutosaveMs,
            setLastAutosaveMs: (n) => { lastAutosaveMs = n; },
            markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()),
            getSubTaskClusterOffset,
            calculateTimelineXWithClustering,
            damageBase: (amount) => Damage.damageBase(amount, damageDeps()),
            damageRoutineForItem: (item, amount) => Items.damageRoutineForItem(item, amount, itemsDeps()),
            // Run history sub-session 2, 2026-07-19 session 53 — live-tick
            // blame attribution (loop.js's own overdue-damage call site).
            recordRunDamage: (item, amount, nowMs) => {
                Items.recordRunDamageForItem(item, amount, nowMs, itemsDeps());
                // Daily record (D2): a live overdue tick. hp = base HP AFTER the hit.
                State.bumpToday('damage', {
                    amount, category: item.category, at: nowMs,
                    hp: Math.max(0, State.getBaseHealth() - amount)
                });
            },
            // Ice (docs/ICE_PLAN.md, 2026-11-10): one daily-record entry per stretch of ice, at its end (ms = how long it lasted).
            recordIce: (p) => State.bumpToday('ice', { ms: p.ms }),
            healBase: (amount) => Damage.healBase(amount, damageDeps()),
            updateMidnightLine,
            runLiveGapCatchUp: () => Damage.runLiveGapCatchUp(damageDeps()),
            saveGame,
            getBarricadeDamageCut: barricadeDamageCut,
            // [P1-DATA-005] session 27 — negative-habit lurker exclusion
            isNonThreatening: Items.isNonThreatening,
            // Negative habit's time arrived: once-per-day indulged/avoided prompt (2026-10-21)
            onLurkerArrived: (item) => promptLurkerArrival(item),
            // [P1-DATA-004] sub-session 4, 2026-07-19 — growing parent visuals
            getParentRenderWidth,
            // Time slider (Milestone 4, 2026-07-20) — keeps the handle/label
            // creeping forward with live time when nobody's scrubbing it.
            // OPTIONAL in loop.js (omitted = no-op) so loop.test.js's
            // existing deps objects don't need updating for this alone.
            updateTimeSliderHandle: (time) => TimeSliderView.syncHandle(time),
            // Day pager (Week scope sub-session 2, 2026-07-20) — MUST run
            // even while previewing (see js/loop.js's updateGame comment for
            // why); OPTIONAL so loop.test.js's existing deps objects don't
            // need updating for this alone.
            checkDayPagerRollover: () => { DayPagerView.checkRolloverReset(); TimeSliderView.checkParkedRollover(); TimeSliderView.checkIdleReturn(); TimeSliderView.holdAnimations(); },
            // LIVE mid-session day rollover (2026-07-20) — stateDeps()
            // already carries every field State.checkLiveDayRollover needs
            // (it's the same deps shape restoreGameState's rollover branch
            // uses), so this reuses the existing builder rather than
            // duplicating fields here. See js/loop.js's updateGame comment.
            checkLiveDayRollover: () => State.checkLiveDayRollover(stateDeps()),
        };
    }

    // (updateActiveItems wrapper was dead code — no call sites in script.js
    // — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    // Midnight-line math lives in js/clock.js (Milestone 2 extraction,
    // 2026-07-17) — thin wrapper so the call site is unchanged.
    function updateMidnightLine(currentTime) {
        Clock.updateMidnightLine(currentTime, {
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH
        });
    }

    // Time slider (Milestone 4, 2026-07-20) — deps for js/ui/timeSliderView.js.
    // dims is a FUNCTION, not a plain object, because GAME_SCREEN_WIDTH/
    // BASE_WIDTH/HABIT_ENEMY_WIDTH aren't resolved until initGame() runs
    // (same reasoning as loopDeps()'s baseWidth/gameScreenWidth rebuild —
    // here it has to be re-evaluated on every scrub event too, not just once
    // at init time, since a window resize between events would otherwise go
    // stale).
    function timeSliderDeps() {
        return {
            sliderEl: timeSliderEl,
            labelEl: timeSliderLabelEl,
            getActiveItems: State.getActiveItems,
            isNonThreatening: Items.isNonThreatening,
            calculateTimelineXWithClustering,
            updateMidnightLine,
            dims: () => ({
                gameScreenWidth: GAME_SCREEN_WIDTH,
                baseWidth: BASE_WIDTH,
                habitEnemyWidth: HABIT_ENEMY_WIDTH,
            }),
            setTimePreviewActive: (v) => { timePreviewActive = v; },
            // While the day pager shows a future day, the slider belongs to that day: it slides that day's ghosts
            // (2026-11-03). Both are null/no-ops on Today.
            getViewedDayStart: () => (typeof DayPagerView !== 'undefined' ? DayPagerView.getViewedDayStart() : null),
            onOtherDayScrub: (time) => { if (typeof DayPagerView !== 'undefined') DayPagerView.previewGhostsAt(time); },
            // The handle stays where it is released (2026-11-04); the Now button returns it (and goes back to Today
            // when another day is on screen).
            nowButtonEl: timeSliderNowBtn,
            getViewedDayOffset: () => (typeof DayPagerView !== 'undefined' ? DayPagerView.getViewedDayOffset() : 0),
            goToToday: () => { if (typeof DayPagerView !== 'undefined') DayPagerView.goToOffset(0); },

            // Damage/routine-HP projection (2026-07-20, same session —
            // Jeremy's follow-up: "the preview also needs to show base
            // damage and freezes"). One optional-collaborator group, see
            // timeSliderView.js's header for the full contract.
            getBaseHealth: State.getBaseHealth,
            getLastRegenTickMs: State.getLastRegenTickMs,
            baseElement,
            baseHealthDisplayEl: baseHealthDisplay,
            resolveBaseImage: Damage.resolveBaseImage,
            applyBaseArt: Damage.applyBaseArt,
            getDefinedRoutines: State.getDefinedRoutines,
            getRoutineIdForItem: (item) => {
                const routine = Items.findRoutineForItem(item, {
                    definedHabits: State.getDefinedHabits,
                    definedRoutines: State.getDefinedRoutines,
                });
                return routine ? routine.id : null;
            },
            renderHeroesAtBase,
        };
    }

    // Day pager (Week scope sub-session 2, 2026-07-20) — deps for
    // js/ui/dayPagerView.js. Every def/item collection arrives as a GETTER
    // (definedHabits/definedRoutines/completedItems are REASSIGNED on
    // restore/reset; activeItems is a getter here too for symmetry, though
    // it's actually a stable reference — matches agendaListDeps()'s own
    // getter-vs-plain-reference split reasoning).
    function dayPagerViewDeps() {
        return {
            prevBtn: dayPagerPrevBtn,
            nextBtn: dayPagerNextBtn,
            labelEl: dayPagerLabelEl,
            taskSectionTitleEl,
            gameCanvasEl: gameCanvas,
            activeItemsListEl: activeItemsListUL,
            timeSliderEl,
            weekStripRowEl,
            // Momentum Build B (2026-11-11): today's mark on the week strip (secured / not yet) and its tap -> the Barricade window.
            getMomentum: () => momentumNow(),
            onMomentumTap: openBarricadeWindow,
            // 2026-07-20 Milestone 5 UX batch (playtest finding #3): the
            // header count previously always showed Hud's global activeItems
            // count regardless of viewed day. taskCountDisplayEl lets
            // dayPagerView set a day-scoped count on ghost/snapshot pages;
            // updateTaskCountDisplay restores the real global count on
            // return to Today (Today itself must keep counting activeItems
            // directly — same convention DayPager.weekStripSummary already
            // uses for Today, see js/dayPager.js).
            taskCountDisplayEl: taskCountDisplay,
            updateTaskCountDisplay,
            onViewedDayRendered: () => refreshPrioritySlots(),
            completedTasksSectionEl: document.getElementById('completedTasksSection'),
            // Point the hour slider at a time (a viewed day's first minute, or now on Today).
            syncSlider: (time) => TimeSliderView.syncHandle(time),
            renderCompletedItems: () => AgendaList.renderCompletedItems(agendaListDeps()),
            // Today on screen: back from another day returns the slider to now; a parked handle on Today stays put.
            onTodayShown: (fromOtherDay) => TimeSliderView.onTodayShown(fromOtherDay),
            // Ghost card "Open task" (2026-11-04): the real one-off task's card, same path as tapping its zombie.
            openItemCard: (itemId) => handleEnemyClick(itemId),
            // 2026-11-03: the scrolling list box (continuous day list, see dayPagerView.js).
            listScrollEl: document.querySelector('.task-list-container'),
            getCurrentGameDate: State.getCurrentGameDate,
            getDefinedHabits: State.getDefinedHabits,
            getDefinedRoutines: State.getDefinedRoutines,
            getDefinedTasks: () => window.definedTasks || [],
            getCompletedItems: State.getCompletedItems,
            getActiveItems: State.getActiveItems,
            getSickDayDate: State.getSickDayDate,
            dims: () => ({
                gameScreenWidth: GAME_SCREEN_WIDTH,
                baseWidth: BASE_WIDTH,
                enemyWidth: ENEMY_WIDTH,
                habitEnemyWidth: HABIT_ENEMY_WIDTH,
            }),
            setTimePreviewActive: (v) => { timePreviewActive = v; },
            renderTodayAgenda: () => sortAndRenderActiveList(),
        };
    }

    // Base sprite / damage / game-over all live in js/damage.js (Milestone 2
    // extraction #3, 2026-07-18).
    // (updateBaseVisuals's own wrapper was dead code — every real call site
    // is the inlined arrow in stateDeps() above — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md. damageBase/healBase/runLiveGapCatchUp
    // wrappers inlined at their call sites — loopDeps() and handleShopUse's
    // repair-kit branch — same session.)

    // (gameOver's own wrapper was dead code — every real call site is the
    // inlined arrow in stateDeps() above (`gameOver: (alreadyOver) =>
    // Damage.gameOver(damageDeps(), alreadyOver)`) — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md. alreadyOver (sub-session 4, session 55):
    // forwarded from State.restoreGameState's restore-time re-call — see
    // js/damage.js's gameOver() header for why this distinction exists.)

    function updateGame() {
        Loop.updateGame(loopDeps());
        refreshBarricadeView(false);
        // [P1-UI-006] sub-session 3, 2026-07-19 — hero chips render from
        // state only, so a per-tick call keeps them live across every event
        // that can change a routine's health/XP/level/star rate/frozen/KO/
        // active state, without new render hooks inside the pure modules.
        renderHeroesAtBase();
        renderGoals();
        refreshAvatarFace();
    }

    // Habit system functions
    // One-time teaching notice (2026-11-02, Jeremy): the first time a timer item is overdue and attacking, say what the
    // pulsing timer button does. Flag lives in Settings (timerHintSeen); the session flag keeps the per-tick check
    // to a cheap scan until then.
    let timerHintHandled = false;
    function maybeShowTimerHint() {
        if (timerHintHandled || State.isGameOver()) return;
        if (!State.getActiveItems().some(i => Timer.shouldNudge(i))) return;
        timerHintHandled = true;
        if (Settings.load().timerHintSeen) return;
        Settings.save({ timerHintSeen: true });
        Dialog.notice('A zombie is attacking the church! Tap the pulsing timer on its row and work on it: the damage is halved while the timer runs. Only one timer can run at a time, and starting a new one keeps the time on the old one.', { title: 'Slow the damage', okLabel: 'Got it' });
    }

    function createHabitDefinition(name, category, scheduleOrFrequency, timeOfDay, isNegative = false, timerMinutes = null, startTime = null, endTime = null, goal = null) {
        const customTimes = Habits.normalizeCustomTimes(timeOfDay, isNegative, startTime, endTime);
        const newHabitDef = {
            id: `habitDef_${State.getDefinedHabits().length}_${Date.now()}`,
            name,
            category,
            // Recurrence is a `schedule` object as of schemaVersion 3 (2026-07-18).
            // Schedule.normalize accepts either a full schedule object (the
            // scheduling UI, session 15) or a legacy bare frequency string
            // (any older caller), so this one call handles both.
            schedule: Schedule.normalize(scheduleOrFrequency),
            timeOfDay: customTimes.timeOfDay,
            // Custom window (Build B, 2026-11-01): "HH:MM" or null; only for a Build habit with timeOfDay 'custom'.
            startTime: customTimes.startTime,
            endTime: customTimes.endTime,
            isNegative,
            goal: null, // Habit Goal (2026-11-01): set by applyGoalToDef below (also sets timerMinutes/timerMode)
            timerMode: null,
            timerMinutes: null,
            // null = standalone (not owned by any routine), so it spawns daily
            // regardless of routine state. See docs/DATA_SCHEMA.md's Habit shape
            // and Habits.selectHabitDefsToSpawn.
            routineId: null,
            streak: 0,
            lastCompletionDate: null,
            // Seeded empty; the rate-based points bonus (future session) records
            // into this. See DECISIONS.md 2026-07-18.
            occurrenceHistory: [],
            // [P1-DATA-005] sub-session 5 (Cheat Day token, 2026-07-19,
            // schemaVersion 5): null = no active excused day. Only meaningful
            // for negative habits, but seeded on every habit for shape
            // consistency with the persisted/migrated form.
            cheatDayDate: null,
            // Frozen routine slots (schemaVersion 6, 2026-07-19): recovery
            // path 1 (edit-to-unfreeze) appends to this. See js/frozenSlots.js.
            // Only meaningful for routine-owned negative habits, seeded on
            // every habit for shape consistency (same reasoning as cheatDayDate).
            modificationHistory: [],
            // Frozen-slots sub-session 5 (Sick/Skip Day tokens, 2026-07-19,
            // schemaVersion 7): null = no active excused day for THIS habit.
            // Seeded on every habit (not just negative ones — Skip Day
            // applies to any habit type). See js/items.js's useSkipDayOnItem.
            skipDayDate: null
        };

        Habits.applyGoalToDef(newHabitDef, goal, timerMinutes);
        State.getDefinedHabits().push(newHabitDef);
        generateDailyHabitInstances(State.getCurrentGameDate());
        // Week strip (2026-11-02): a habit that isn't due today spawns nothing, so
        // no spawn-time refresh runs, yet its day's count just changed.
        updateTaskCountDisplay();
        saveGame();
    }

    // Habit instance creation, daily spawn selection, and streak math live in
    // js/habits.js (Milestone 2 extraction, 2026-07-18) — the functions below
    // are thin wrappers so every existing call site is unchanged. See
    // js/habits.js's header comment for the deps shape and the one
    // deliberately-preserved pre-existing bug (streak-bonus asymmetry).
    function habitInstanceDeps() {
        return {
            getNextId: () => {
                const n = State.getItemIdCounter();
                State.setItemIdCounter(n + 1);
                return n;
            },
            calculateTimelinePosition,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH,
            // [P1-DATA-005] session 27, repositioned session 29 — a negative
            // habit's fixed lurk x anchors to the far right of the canvas
            // (gameScreenWidth above), not the base.
            negativeLurkRightMarginPx: CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX,
            definedHabits: State.getDefinedHabits(),
            definedRoutines: State.getDefinedRoutines(),
            activeItems: State.getActiveItems(),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => handleEnemyClick(itemId), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay, sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            sortAndRenderActiveList,
            // Frozen-slots sub-session 5 (2026-07-19): the global Sick Day
            // spawn gate — see Habits.selectHabitDefsToSpawn.
            sickDayDate: State.getSickDayDate()
        };
    }

    // (getHabitInstanceDueTime/createHabitInstanceData wrappers were dead
    // code — no call sites in script.js — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md.)
    function generateDailyHabitInstances(forWhichGameDay) {
        Habits.generateDailyHabitInstances(forWhichGameDay, habitInstanceDeps());
    }

    // --- Routine task instances (2026-07-18) ---
    // Routine TASKS previously had no spawn path at all: createNewTaskInRoutine
    // stored a definition in definedTasks and nothing ever turned it into a live
    // item, so a task added through a routine could never appear on the board or
    // in the agenda (see docs/DECISIONS.md). Routine tasks recur DAILY, the same
    // as routine habits — decided with Jeremy 2026-07-18.

    // Routine task instance helpers now live in js/routines.js (Milestone 2
    // extraction #6, 2026-07-18) — thin wrappers so every call site is
    // unchanged. See docs/ARCHITECTURE.md / DECISIONS.md.
    function routineTaskInstanceDeps() {
        return {
            getNextId: () => {
                const n = State.getItemIdCounter();
                State.setItemIdCounter(n + 1);
                return n;
            },
            gameScreenWidth: GAME_SCREEN_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            calculateTimelineXWithClustering,
            definedTasks: window.definedTasks || (window.definedTasks = []),
            definedRoutines: State.getDefinedRoutines(),
            activeItems: State.getActiveItems(),
            completedItems: State.getCompletedItems(),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => handleEnemyClick(itemId), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay, sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            sortAndRenderActiveList
        };
    }

    // (getRoutineTaskInstanceDueTime/createRoutineTaskInstanceData wrappers
    // were dead code — no call sites in script.js — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md.)
    // Daily spawn pass for routine tasks, mirroring generateDailyHabitInstances.
    function generateDailyRoutineTaskInstances(forWhichGameDay) {
        Routines.generateDailyRoutineTaskInstances(forWhichGameDay, routineTaskInstanceDeps());
    }

    // Routine management functions
    function createRoutineDefinition() {
        const result = Routines.createRoutineDefinition(routineNameInput.value, State.getDefinedRoutines());
        if (!result.ok) {
            Forms.showFormError(result.reason === 'empty' ? "Please enter a routine name." : "Routine name already exists.", routineNameInput, { before: createRoutineButton });
            return;
        }

        State.getDefinedRoutines().push(result.routine);
        routineNameInput.value = '';
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
        saveGame();
    }

    async function deleteRoutine(routineId) {
        const routine = State.getDefinedRoutines().find(r => r.id === routineId);
        if (!routine) return;

        // In-game confirm (2026-11-01, docs/DIALOG_PLAN.md), not the browser's box.
        if (await Dialog.confirm(`Are you sure you want to delete the routine "${routine.name}"?`, { title: 'Delete routine?', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true })) {
            // Close the Manage Routine modal only once the delete is confirmed (the inline onclick used to close it before the answer).
            Modal.closeModal();
            // Recalls active habit/task instances before removing the routine
            // — see js/routines.js's deleteRoutine for the bugfix rationale
            // and DECISIONS.md.
            Routines.deleteRoutine(routineId, { definedRoutines: State.getDefinedRoutines(), activeItems: State.getActiveItems(), removeItem, definedHabits: State.getDefinedHabits() });
            // Week strip (2026-11-02): the routine's habits are released as standalone ones, so later-day counts change.
            updateTaskCountDisplay();
            saveGame();

            // Update routines window if open
            setTimeout(() => {
                if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                    populateRoutinesWindow();
                }
            }, 100);
        }
    }
    // Pre-existing bug (found live 2026-07-18, right after the routines
    // extraction): showRoutineManagement's Delete Routine button uses an
    // inline onclick="deleteRoutine(...)" string, which runs in GLOBAL scope
    // — but deleteRoutine was only ever a closure-scoped function inside this
    // DOMContentLoaded wrapper, never attached to window like its siblings
    // (window.closeModal, window.saveNewHabit, window.saveNewTask,
    // window.saveEditedHabit, window.saveEditedTask). The click silently
    // failed to find the function. Not introduced by the routines.js
    // extraction — the function body moved, but its scope didn't change.
    window.deleteRoutine = deleteRoutine;
    
    // (attachRoutineManagementListeners wrapper was dead code — no call
    // sites in script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    function removeHabitFromRoutine(routineId, habitDefId) {
        if (Routines.removeHabitFromRoutine(routineId, habitDefId, State.getDefinedRoutines(), State.getDefinedHabits())) {
            updateTaskCountDisplay(); // week strip (2026-11-02): the habit may now be standalone (or gone) on later days
            RoutineViews.renderDefinedRoutines(routineViewsDeps());
            saveGame();
        }
    }

    function createNewHabitInRoutine(routineId, habitData) {
        const newHabit = Routines.createNewHabitInRoutine(routineId, habitData, State.getDefinedRoutines(), State.getDefinedHabits());
        if (!newHabit) return;

        generateDailyHabitInstances(State.getCurrentGameDate());
        updateTaskCountDisplay(); // week strip (2026-11-02): later-day counts change even when nothing spawns today
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
        saveGame();
    }

    function createNewTaskInRoutine(routineId, taskData) {
        if (!window.definedTasks) window.definedTasks = [];
        const newTaskDef = Routines.createNewTaskInRoutine(routineId, taskData, State.getDefinedRoutines(), definedTasks);
        if (!newTaskDef) return;

        // Spawn today's instance immediately, matching createNewHabitInRoutine.
        // Without this the definition existed but never became a live enemy —
        // the task appeared in the routine window only. See DECISIONS.md.
        generateDailyRoutineTaskInstances(State.getCurrentGameDate());
        updateTaskCountDisplay(); // week strip (2026-11-02)
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
        saveGame();
    }

    // Sub-session 4 (2026-07-19): passes definedRoutines + an
    // onRoutineUnfrozen notifier so a real edit to the habit that froze its
    // routine clears frozenState and shows the one-time unfreeze notice
    // (recovery path 1, docs/FROZEN_SLOTS_PLAN.md). Same
    // "module called as bare stable global" pattern as itemsDeps()'s
    // onRoutineFrozen.
    function editHabitInRoutine(habitId, updatedData) {
        if (Routines.editHabitInRoutine(habitId, updatedData, State.getDefinedHabits(), State.getDefinedRoutines(), {
            onRoutineUnfrozen: (routine, habitDef) => {
                FrozenNotice.showRoutineUnfrozenNotice(routine.name, habitDef.name);
            }
        })) {
            updateTaskCountDisplay(); // week strip (2026-11-02): a schedule edit moves ghosts between days
            RoutineViews.renderDefinedRoutines(routineViewsDeps());

            // Update the FAB->Routines popup if open — same staleness fix as
            // deleteRoutine (it's a separate windowing system from Modal's
            // overlays, so renderDefinedRoutines() alone doesn't touch it).
            // See docs/ROADMAP.md Known bugs / DECISIONS.md session 38/40.
            setTimeout(() => {
                if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                    populateRoutinesWindow();
                }
            }, 100);
        }
    }

    function editTaskInRoutine(taskId, updatedData) {
        if (Routines.editTaskInRoutine(taskId, updatedData, definedTasks)) {
            updateTaskCountDisplay(); // week strip (2026-11-02)
            RoutineViews.renderDefinedRoutines(routineViewsDeps());
        }
    }

    function removeTaskFromRoutine(routineId, taskId) {
        Routines.removeTaskFromRoutine(routineId, taskId, State.getDefinedRoutines());
        updateTaskCountDisplay(); // week strip (2026-11-02)
    }

    // ------------------------------------------------------------------
    // Routine transfer ([P2-UI-013], session 62). Pure move lives in
    // js/routines.js; these wrappers own the board reconciliation:
    //
    // 1. If the DESTINATION wouldn't spawn the definition (inactive, frozen,
    //    KO'd), its live instances are recalled — same pure-removal
    //    semantics as deactivation's recall (no XP/streak/damage change),
    //    via the same removeItem path. Habits use isRoutineUsableForHabit
    //    (a frozen dest still spawns its own offender's lurker); tasks use
    //    the no-exception isRoutineSuspended.
    // 2. Then BOTH daily generators run — if the destination IS active and
    //    the source wasn't, today's due instance should appear now, the
    //    same immediate-spawn courtesy toggleRoutineActive gives
    //    reactivation. Both generators dedupe per day, so this is safe to
    //    call unconditionally.
    // ------------------------------------------------------------------
    function recallInstancesIfRoutineUnusable(destRoutineId, definitionId, type) {
        const dest = State.getDefinedRoutines().find(r => r.id === destRoutineId);
        if (!dest) return;
        const usable = type === 'habit'
            ? FrozenSlots.isRoutineUsableForHabit(dest, definitionId)
            : !FrozenSlots.isRoutineSuspended(dest);
        if (usable) return;
        Routines.selectActiveInstanceIdsForDefinition(State.getActiveItems(), definitionId, type)
            .forEach(id => removeItem(id));
    }

    function transferHabitBetweenRoutines(sourceRoutineId, destRoutineId, habitDefId) {
        const result = Routines.transferHabitBetweenRoutines(
            sourceRoutineId, destRoutineId, habitDefId, State.getDefinedRoutines(), State.getDefinedHabits());
        if (result.ok) {
            recallInstancesIfRoutineUnusable(destRoutineId, habitDefId, 'habit');
            generateDailyHabitInstances(State.getCurrentGameDate());
            updateTaskCountDisplay(); // week strip (2026-11-02): the new routine may be inactive
            RoutineViews.renderDefinedRoutines(routineViewsDeps());
            saveGame();
        }
        return result;
    }

    function transferTaskBetweenRoutines(sourceRoutineId, destRoutineId, taskId) {
        const result = Routines.transferTaskBetweenRoutines(
            sourceRoutineId, destRoutineId, taskId, State.getDefinedRoutines());
        if (result.ok) {
            recallInstancesIfRoutineUnusable(destRoutineId, taskId, 'task');
            generateDailyRoutineTaskInstances(State.getCurrentGameDate());
            updateTaskCountDisplay(); // week strip (2026-11-02): the new routine may be inactive
            RoutineViews.renderDefinedRoutines(routineViewsDeps());
            saveGame();
        }
        return result;
    }

    // Thin wrappers — real implementations live in js/ui/routineViews.js
    // (Milestone 2 UI extraction sessions 8-9, 2026-07-18). Call sites
    // unchanged.
    //
    // definedRoutines/definedHabits cross in as GETTERS (reassigned
    // elsewhere in script.js — new-game reset, restoreGameState), matching
    // agendaList.js part 2's precedent (session 7). definedTasks has no
    // local declaration at all (always `window.definedTasks`), so the
    // module reads it as a bare global directly — no dep needed. activeItems
    // is a plain reference, matching agendaListDeps()'s established
    // precedent (see that function's comment above).
    // definedRoutinesListUL/activeRoutineCountDisplay/managementWindows are
    // stable const DOM refs.
    //
    // Session 9 moved cluster F's form half into the module — the six
    // formerly-passed function refs (showEditHabitForm,
    // populateHabitSelectDropdown, showCreateHabitForm, showEditTaskForm,
    // showCreateTaskForm, attachRoutineManagementListeners) are now
    // module-internal calls and no longer appear here. Added instead:
    // managementWindows/populateRoutinesWindow (routine-status-toggle
    // refresh), saveGame, createNewHabitInRoutine/createNewTaskInRoutine/
    // editHabitInRoutine/editTaskInRoutine (the four save* handlers),
    // activeItems/createListItem/sortAndRenderActiveList (saveEditedHabit's
    // live-instance sync).
    function routineViewsDeps() {
        return {
            definedRoutinesListUL, activeRoutineCountDisplay, managementWindows,
            definedRoutines: State.getDefinedRoutines,
            definedHabits: State.getDefinedHabits,
            toggleRoutineActive, deleteRoutine, removeHabitFromRoutine, removeTaskFromRoutine,
            addHabitToRoutine, populateRoutinesWindow, saveGame,
            // [P2-UI-013] session 62 — transfer wrappers (recall/spawn/save
            // reconciliation lives up in the wrappers, not the modal).
            transferHabitBetweenRoutines, transferTaskBetweenRoutines,
            createNewHabitInRoutine, createNewTaskInRoutine, editHabitInRoutine, editTaskInRoutine,
            activeItems: State.getActiveItems(), createListItem, sortAndRenderActiveList,
            updateTaskCountDisplay, // week strip (2026-11-02): the Add Selected picker changes routine membership itself
            // 2026-11-01: Edit Habit from the Completed list edits one completed entry (name/category/goal) and re-renders the list.
            completedItems: State.getCompletedItems,
            renderCompletedItems: () => AgendaList.renderCompletedItems(agendaListDeps()),
            // Habit Goals Build 2c: the completed entry's logged time is part of its entry edit.
            setLoggedTime,
            changeSession, // Timer sessions Build B: the Sessions list in the completed-entry editor
            getBaseHealth: State.getBaseHealth,
            // 2026-10-21: saveEditedHabit retimes today's instance, then re-evaluates overdue state.
            recomputeOverdueStateAfterEdit: (item) => Items.recomputeOverdueStateAfterEdit(item, itemsDeps()),
            // [P1-UI-006] sub-session 4, 2026-07-19 — star-rating window start
            // for the Manage modal's hero stats block (buildHeroStatsHtml).
            runStartedAtMs: State.getRunStartedAtMs()
        };
    }

    // (renderDefinedRoutines wrapper inlined at its call sites sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/ui/routineViews.js.)
    // (populateHabitSelectDropdown wrapper was dead code — no call sites in
    // script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    function addHabitToRoutine(routineId, habitDefId) {
        const result = Routines.addHabitToRoutine(routineId, habitDefId, State.getDefinedRoutines(), State.getDefinedHabits());
        if (!result.ok) {
            Dialog.notice(result.reason === 'not-found' ? 'Error finding routine or habit.' : 'Habit already in routine.', { title: 'Couldn\'t add the habit' });
            return;
        }

        updateTaskCountDisplay(); // week strip (2026-11-02): an inactive routine hides the habit on later days
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
    }

    // selectActiveItemIdsToClearForRoutine/clearActiveInstancesForRoutine/
    // toggleRoutineActive now live in js/routines.js (Milestone 2 extraction
    // #6, 2026-07-18) — thin wrappers so every call site is unchanged. See
    // docs/ARCHITECTURE.md / DECISIONS.md.
    // (selectActiveItemIdsToClearForRoutine wrapper was dead code — no call
    // sites in script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    function clearActiveInstancesForRoutine(routineId) {
        Routines.clearActiveInstancesForRoutine(routineId, { definedRoutines: State.getDefinedRoutines(), activeItems: State.getActiveItems(), removeItem });
    }

    // ---- KO ghosts (2026-10-25; docs/DESIGN_QUESTIONS_KO_EDIT_TIMER.md) ----
    // Re-style a ghost/revived item's sprite + agenda row from its koGhost flag.
    // Top-level rows are rebuilt (their due line + edit pencil depend on it);
    // sub-tasks render inside their parent's row, so the parent rebuild covers them.
    function refreshGhostLook(items) {
        items.forEach(item => Items.syncGhostLook(item));
        items.forEach(item => {
            if (item.parentId) return;
            if (item.listItemElement) item.listItemElement.remove();
            AgendaList.createListItem(item, agendaListDeps());
        });
        AgendaList.sortAndRenderActiveList(agendaListDeps());
        updateTaskCountDisplay();
    }

    function ghostifyActiveInstancesForRoutine(routineId) {
        const flagged = [];
        Routines.ghostifyActiveInstancesForRoutine(routineId, {
            definedRoutines: State.getDefinedRoutines(),
            activeItems: State.getActiveItems(),
            onGhostified: (item) => flagged.push(item)
        });
        refreshGhostLook(flagged);
    }

    // Revive: ghosts come back to life. Recurring ones whose time passed re-derive
    // overdue with a clean clock and NO miss (recomputeOverdueStateAfterEdit);
    // stale one-off tasks/sub-tasks each open "When is this due now?" first
    // (parents before their sub-tasks, so a sub-task's ceiling is the new parent
    // time). Dismissing a picker = keep the original (overdue, clean clock).
    function handleGhostsRevived(revivedItems, result) {
        refreshGhostLook(revivedItems);
        // Everything whose time already passed becomes overdue NOW with a clean
        // damage clock and no miss -- one-offs too, so dismissing a picker (ESC)
        // can never leave an un-ticked past-due item to be back-charged by the loop.
        result.recurring.concat(result.staleOneOffs).forEach(item => Items.recomputeOverdueStateAfterEdit(item, itemsDeps()));
        const queue = result.staleOneOffs.slice().sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
        const next = () => {
            const item = queue.shift();
            if (!item) { refreshGhostLook([]); saveGame(); return; }
            Popups.promptNewDueTime(item, popupsDeps(), (res) => {
                if (res && res.dueDateTime instanceof Date && res.dueDateTime.getTime() > Date.now()) {
                    const oldDue = item.dueDateTime;
                    item.dueDateTime = res.dueDateTime;
                    Items.syncAnytimeFlag(item); // not 23:59 any more -> an ordinary timed task
                    Items.syncPriorityOnMove(item, oldDue, itemsDeps()); // another day: priority does not carry over
                    // A new future time un-overdues it (and re-positions it).
                    Items.recomputeOverdueStateAfterEdit(item, itemsDeps());
                }
                refreshGhostLook([item]);
                // "Keep original for all remaining": drop the rest of the queue --
                // they already came back overdue with a clean clock above.
                if (res && res.skipAll) queue.length = 0;
                next();
            }, { remaining: queue.length });
        };
        // Deferred: the revive click may still be bubbling out of a modal.
        setTimeout(next, 0);
    }

    function toggleRoutineActive(routineId) {
        const revivedItems = [];
        Routines.toggleRoutineActive(routineId, {
            onGhostRevived: (item) => revivedItems.push(item),
            onGhostsRevived: (result) => handleGhostsRevived(revivedItems, result),
            recordDaily: State.bumpToday, // daily record (D2)
            definedRoutines: State.getDefinedRoutines(),
            routineSlots: State.getRoutineSlots(),
            activeItems: State.getActiveItems(),
            removeItem,
            notice: (message) => Dialog.notice(message),
            generateDailyHabitInstances,
            generateDailyRoutineTaskInstances,
            currentGameDate: State.getCurrentGameDate(),
            saveGame
        });
        // Week strip (2026-11-02): turning a routine on/off adds or removes its habits and tasks on later days, and
        // nothing refreshes when none of them is due today.
        updateTaskCountDisplay();
    }
    
    // (showAddItemToRoutineModal wrapper was dead code — no call sites in
    // script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    function updateRoutineDisplay() {
        RoutineViews.updateRoutineDisplay(routineViewsDeps());
        // [P1-UI-006] sub-session 3, 2026-07-19 — paint hero chips immediately
        // whenever routine displays refresh (init/restore/level-up); the
        // per-tick call in updateGame() keeps them live the rest of the time.
        renderHeroesAtBase();
    }

    // Thin wrapper over js/ui/heroes.js — renders from state only, no new
    // mechanics. Called once per game-loop tick (see updateGame() below) so
    // hero chips reflect completion/damage/freeze/KO/deactivate within one
    // 50ms tick without threading a UI dependency through items.js/routines.js/
    // damage.js (see js/ui/heroes.js header for the full rationale).
    // routinesOverride (Milestone 4 time slider, 2026-07-20, optional):
    // lets js/ui/timeSliderView.js draw PROJECTED per-routine health during
    // a scrub by passing a shallow-cloned routines array with `health`
    // patched — HeroesView itself is unchanged, it just renders whatever
    // array it's given. Omitted (every existing call site) renders the real
    // live definedRoutines, unchanged behavior.
    // Hero tab + tray (docs/HERO_SPOTLIGHT_PLAN.md sub-session 3, 2026-10-21) replaced the
    // base chips. `renderHeroesAtBase` keeps its name because the game loop and the time
    // slider already call it; it now renders the Heroes tab (status dots / spotlit hero),
    // keeps the open tray's rows current, and still detects star-rating thresholds for the
    // star-up notice. DOM is touched only when a signature changes (js/ui/heroTray.js), so
    // the 50ms call is cheap. routinesOverride (time slider scrub) draws PROJECTED health.
    // Tap a tray row -> that routine's management window (the old chip tap).
    // Level panel (LEVEL_PERKS_PLAN.md sub-session B): one renderer for the HUD level button and the
    // Hero tray's "Routines 3/4" summary line. Everything is derived from State on each call.
    function levelPanelContext() {
        return {
            level: State.getPlayerLevel(), xp: State.getPlayerXP(), thresholds: CONFIG.LEVEL_XP_THRESHOLDS,
            slotsTable: CONFIG.ROUTINE_SLOTS_PER_LEVEL, perksTable: CONFIG.LEVEL_PERKS, goalSlotsTable: CONFIG.GOAL_SLOTS_PER_LEVEL,
            routines: State.getDefinedRoutines(), definedHabits: State.getDefinedHabits(),
            config: CONFIG, runStartedAtMs: State.getRunStartedAtMs(),
        };
    }
    function openLevelPanel() {
        LevelPanel.open(Object.assign(levelPanelContext(), {
            mood: moodDeps(),
            onManage: (routineKey) => {
                const routine = State.getDefinedRoutines().find(r => String(r.id) === routineKey);
                if (routine) showRoutineManagement(routine.id);
            },
            onCreate: () => openManagementWindow('routines'),
        }));
    }
    if (levelButton) levelButton.addEventListener('click', openLevelPanel);

    // ---- Village panel (2026-10-30): the HUD village button lists all eight buildings (tier + progress); a row opens
    // that building's card on top. Works on every screen, including the portrait strip where the scene hides the village.
    const villageButton = document.getElementById('villageButton');
    function villageSpriteFor(kind, tier) {
        const size = VillageLayout.sizeOf(kind, VillageLayout.fromConfig(CONFIG));
        return { url: VillageLayout.spriteUrl(kind, tier), width: size[0], height: size[1] };
    }
    function openVillagePanel() {
        const progress = VillageProgress.compute(villageContext());
        VillagePanel.open({
            progress,
            spriteFor: villageSpriteFor,
            memorial: { stage: Memorial.stage(State.getBestVillageTiers()) },
            onOpenMemorial: () => openMemorialPanel(),
            tree: { stage: realTreeStage() },
            onOpenTree: () => openTreePanel(),
            markers: realMarkerCounts(),
            onOpenMarkers: () => openMarkerPanel(null),
            onOpenBuilding: (kind) => {
                const sprite = villageSpriteFor(kind, progress[kind] ? progress[kind].tier : 1);
                const placement = (CONFIG.VILLAGE_PLACEMENT || {})[kind] || {};
                openVillageCard({ kind, url: sprite.url, width: sprite.width, height: sprite.height, flip: !!placement.flip });
            },
        });
    }
    if (villageButton) villageButton.addEventListener('click', openVillagePanel);
    // Keep each HUD button looking pressed while its window is open (js/ui/hudButtons.js).
    HudButtons.init();
    // The first draw waits for the restored save (see the call after State.restoreGameState below): drawing it here read an empty state and
    // showed the bottom tier for a second before the first tick corrected it (found on the phone 2026-11-12).
    BarricadeView.init(document.getElementById('barricade'), { onTap: () => openBarricadeWindow() });

    // ---- Base Health panel (docs/BASE_PANEL_PLAN.md steps 3-4, 2026-10-26) ----
    // Everything the panel and the HUD chip show is derived from live state on each call
    // (never cached): attackers are the overdue items that actually hit the base
    // (Items.isNonThreatening excludes lurkers and KO ghosts), with their own tick length
    // (a running work timer stretches it) and last-hit clock, exactly as js/loop.js uses them.
    function baseHealthContext() {
        const nowMs = Date.now();
        const items = State.getActiveItems();
        const attackers = items
            .filter(i => i.isOverdue && !Items.isNonThreatening(i))
            .map(i => ({
                id: i.id, name: i.name, dueMs: i.dueDateTime.getTime(),
                // The barricade's cut (Momentum Build C) stretches the live hit interval, so the panel's countdown and ETA match the loop.
                tickMs: Momentum.cutIntervalMs(Family.intervalMs(i, items, CONFIG.DAMAGE_INTERVAL_MS, {
                    timers: true, isLurker: Items.isNonThreatening, isIced: (m) => Ice.stateIn(m, items, nowMs).iced }), barricadeDamageCut()),
                // Ice (docs/ICE_PLAN.md): an iced attacker deals nothing for iceMs; the panel counts down to the thaw.
                iceMs: Ice.leftMsIn(i, items, nowMs), iceThawing: Ice.stateIn(i, items, nowMs).thawing,
                lastDamageTickMs: typeof i.lastDamageTickTime === 'number' ? i.lastDamageTickTime : nowMs,
            }));
        let nextDue = null;
        items.forEach(i => {
            if (i.isOverdue || Items.isNonThreatening(i)) return;
            const dueMs = i.dueDateTime.getTime();
            if (dueMs > nowMs && (!nextDue || dueMs < nextDue.dueMs)) nextDue = { name: i.name, dueMs };
        });
        // The panel's push-back button is a Medium (+2 hr) for an overdue attacker: it clears the zombie and
        // draws on the same charges as the popup. Quoted for a just-overdue item, so the price/note is the same
        // for every row; handlePushback re-quotes the real item when tapped.
        const medium = CONFIG.PUSHBACK_SIZES.find(z => z.id === 'medium');
        const pbIn = pushbackInputs(new Date(nowMs));
        const mq = medium ? Pushback.quoteFixed('medium', Object.assign({}, pbIn, {
            currentDue: new Date(nowMs - 1), createdAt: null,
        })) : null;
        // Two different counts, named plainly (2026-11-09, Jeremy: the church and the Shop "don't match"): FREE pushbacks left
        // today (Clock tower allowance, refills daily) vs TOKENS held (bought in the Shop, used only once the free ones run out).
        const pbTokens = pbIn.held.medium || 0;
        const pbTotal = (pbIn.allowance && pbIn.allowance.medium) || 0;
        let pushbackNote = null;
        if (mq && mq.kind === 'charge') pushbackNote = `free \u00B7 ${mq.left.medium} of ${pbTotal} today`;
        else if (mq && mq.kind === 'token') pushbackNote = `uses a token \u00B7 ${pbTokens} held`;
        return {
            health: State.getBaseHealth(), nowMs, lastRegenTickMs: State.getLastRegenTickMs(),
            attackers, inventory: State.getPlayerInventory(), shopItems: CONFIG.SHOP_ITEMS, config: CONFIG,
            points: State.getPlayerPoints(),
            pushbackPrice: mq ? mq.cost : null,
            pushbackLabel: medium ? Pushback.plusLabel(medium.ms).replace('+', '') : '2 hr', pushbackNote, nextDue,
            pushbackTokens: pbTokens, pushbackSizeName: 'Medium',
            // The Barricade card (Build C): state name and damage cut, from the same momentum read as the loop.
            barricade: (() => { const mi = momentumNow(nowMs); return mi && mi.state ? { name: mi.state.name, cut: Momentum.damageCut(mi.state.id, (CONFIG.MOMENTUM || {}).BARRICADE_STATES) } : null; })(),
        };
    }

    // HUD chip: ring (state color, HP fraction) + "+1 in 3m" / "\u2212N / 5m" / "Full". Throttled to
    // twice a second from the loop's afterTick; the DOM is touched only when the signature
    // changes. Hidden while the time slider previews a projected health.
    const BH_RING_C = 50.27; // 2 * PI * r(8)
    let baseChipSig = '';
    let baseChipLastMs = 0;
    function refreshBaseChip(force) {
        if (!baseHealthChipEl || typeof BasePanel === 'undefined') return;
        const now = Date.now();
        if (!force && now - baseChipLastMs < 500) return;
        baseChipLastMs = now;
        baseHealthChipEl.hidden = !!timePreviewActive;
        if (timePreviewActive) return;
        const chip = BasePanel.chipModel(baseHealthContext());
        const sig = [chip.state, chip.color, Math.round(chip.pct), chip.text].join('|');
        if (sig === baseChipSig) return;
        baseChipSig = sig;
        baseHealthChipEl.textContent = chip.text;
        baseHealthChipEl.className = 'bh-chip bh-chip--' + chip.state;
        if (baseHealthRing) baseHealthRing.setAttribute('class', 'bh-ring bh-ring--' + chip.color);
        if (baseHealthArc) baseHealthArc.setAttribute('stroke-dasharray', (chip.pct / 100 * BH_RING_C).toFixed(2) + ' ' + BH_RING_C);
        if (baseHealthButton) baseHealthButton.setAttribute('aria-label', chip.aria);
    }
    function openBasePanel() {
        if (State.isGameOver()) return;
        refreshBaseChip(true);
        BasePanel.open({
            getContext: baseHealthContext,
            onPushback: (attackerId) => {
                const item = State.getActiveItems().find(i => String(i.id) === String(attackerId));
                if (item) handlePushback('medium', item);
                refreshBaseChip(true);
            },
            onUseKit: (kitId) => { handleShopUse(kitId); refreshBaseChip(true); },
            // Opens the Barricade window on top of this panel (Build C).
            onBarricade: () => openBarricadeWindow(),
        });
    }
    if (baseHealthButton) baseHealthButton.addEventListener('click', openBasePanel);
    // The church itself opens the same panel (Jeremy 2026-11-01). stopPropagation: Modal's document click handler
    // would otherwise treat this tap as an outside click and close the panel at once.
    if (baseElement) {
        baseElement.setAttribute('role', 'button');
        baseElement.setAttribute('aria-label', 'Church. Open base health panel');
        baseElement.tabIndex = 0;
        baseElement.addEventListener('click', (e) => { e.stopPropagation(); openBasePanel(); });
        baseElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBasePanel(); }
        });
    }

    // HUD points button opens the Shop (2026-10-27). Same path as the FAB's
    // Shop item, so the shop renders through ManagementWindows as usual.
    // stopPropagation: Modal's document click handler would otherwise see a
    // click outside .management-window and close the shop right away.
    if (playerPointsStat) playerPointsStat.addEventListener('click', (e) => {
        e.stopPropagation();
        openManagementWindow('shop');
    });

    function ensureHeroTray() {
        if (heroTrayReady) return;
        HeroTray.init({
            tabEl: heroTabEl,
            trayEl: document.getElementById('heroTray'),
            backdropEl: document.getElementById('heroTrayBackdrop'),
            listEl: document.getElementById('heroTrayList'),
            closeEl: document.getElementById('heroTrayClose'),
            summaryEl: document.getElementById('heroTraySummary'),
            getSlotsSummary: () => LevelPanel.slotsSummary(LevelPanel.slotsModel(levelPanelContext())),
            getSlots: () => LevelPanel.slotsModel(levelPanelContext()),
            onOpenLevelPanel: openLevelPanel,
            config: CONFIG,
            onManage: (routineKey) => {
                // dataset round-trips ids as strings; resolve the real id.
                const routine = State.getDefinedRoutines().find(r => String(r.id) === routineKey);
                if (routine) showRoutineManagement(routine.id);
            },
            onOpenRoutines: () => openManagementWindow('routines'),
            getSpotlitId: () => (heroSpotlightReady ? HeroSpotlight.getCurrentRoutineId() : null),
            dismissSpotlight: () => { if (heroSpotlightReady) HeroSpotlight.dismiss(); },
            isModalOpen: () => !!document.querySelector('.modal-overlay'),
        });
        heroTrayReady = true;
    }

    // Goals pane (Build B1, 2026-11-05): HUD flagpole button + popup (js/ui/goalsPane.js) and the goal card (js/ui/goalCard.js).
    // Same shape as ensureHeroTray: a lazy init, then a per-tick refresh (signature-based, so the DOM only moves when something changed).
    function goalCardDeps() {
        return {
            getView: (goalId) => State.getGoalViews(Date.now()).find(v => String(v.id) === String(goalId)) || null,
            nowMs: () => Date.now(),
            weekStartsOn: CONFIG.GOAL_WEEK_STARTS_ON,
            updateTarget: (goalId, targetId, patch) => State.updateGoalTarget(goalId, targetId, patch, Date.now()),
            retire: (goalId) => State.retireGoal(goalId, Date.now()),
            remove: (goalId) => State.deleteGoal(goalId),
            afterChange: () => renderGoals(),
            onEdit: (goalId) => openGoalForm(goalId),
            onKeep: (goalId) => State.keepGoal(goalId),
        };
    }

    // Add / Edit goal form (Build B2, 2026-11-05; js/ui/goalForm.js). `goal` = the goal being edited, null for a new one. Saves go through
    // State.addGoal / State.editGoal (they also move the one-off task links); a cancelled or saved Edit hands the player back to the card.
    function goalFormDeps(goal) {
        return {
            goal: goal || null,
            linkedIds: goal ? State.getGoalLinkedItemIds(goal.id) : {},
            getContext: () => ({
                metrics: CONFIG.GOAL_METRICS,
                options: State.getGoalLinkOptions(),
                todayKey: Goals.dateKey(Date.now()),
            }),
            save: (fields, links) => (goal ? State.editGoal(goal.id, fields, links, Date.now()) : State.addGoal(fields, links, Date.now())),
            onDone: (saved) => {
                renderGoals();
                if (goal && saved) GoalCard.open(saved.id, goalCardDeps());
            },
            onCancel: () => { if (goal) GoalCard.open(goal.id, goalCardDeps()); },
        };
    }

    function openGoalForm(goalId) {
        const goal = goalId != null ? ((State.getGoals() || {}).active || []).find(g => String(g.id) === String(goalId)) || null : null;
        GoalForm.open(goalFormDeps(goal));
    }

    function ensureGoalsPane() {
        if (goalsPaneReady) return true;
        const tabEl = document.getElementById('goalsButton');
        const paneEl = document.getElementById('goalsPane');
        if (!tabEl || !paneEl) return false;
        GoalsPane.init({
            tabEl,
            paneEl,
            backdropEl: document.getElementById('goalsPaneBackdrop'),
            bodyEl: document.getElementById('goalsPaneBody'),
            titleEl: document.getElementById('goalsPaneTitle'),
            subEl: document.getElementById('goalsPaneSub'),
            closeEl: document.getElementById('goalsPaneClose'),
            rosterBtnEl: document.getElementById('goalsPaneRosterBtn'),
            getViews: () => State.getGoalViews(Date.now()),
            getSlotInfo: () => State.getGoalSlotInfo(),
            getRoster: () => (State.getGoals() || {}).done || [],
            onOpenGoal: (goalId) => { GoalCard.open(goalId, goalCardDeps()); },
            onNewGoal: () => openGoalForm(null),
            onClaim: (recordId, claimed) => State.claimGoalReward(recordId, claimed),
        });
        goalsPaneReady = true;
        return true;
    }

    function renderGoals() {
        if (!ensureGoalsPane()) return;
        try {
            // Notices first: a goal finished by a linked completion (or a period close) is announced once, then the pane redraws.
            const events = State.takeGoalEvents();
            const done = events.filter(ev => ev && ev.type === 'complete');
            if (done.length) {
                FrozenNotice.showGoalCompleteNotice(done.map(ev => ({
                    name: ev.record && ev.record.name, item: ev.item, itemStatus: ev.itemStatus,
                    reward: ev.record && ev.record.reward, onTime: ev.record ? ev.record.onTime : null,
                })));
            }
            // A met repeating period (pays a bonus, maybe a monthly item) and an owed item that finally arrived.
            const met = events.filter(ev => ev && ev.type === 'period' && ev.met);
            if (met.length) {
                FrozenNotice.showGoalPeriodNotice(met.map(ev => ({
                    name: ev.name, period: ev.period, pts: ev.pts, streak: ev.streak, item: ev.item, itemStatus: ev.itemStatus, reward: ev.reward,
                })));
            }
            const owed = events.filter(ev => ev && ev.type === 'owed' && ev.item);
            if (owed.length) FrozenNotice.showGoalOwedNotice(owed.map(ev => ({ name: 'Earned item', item: ev.item, itemStatus: 'paid' })));
            GoalsPane.refresh();
            // Badges on the agenda rows: only touched when a link, a goal name or the set of rows changed.
            const active = (State.getGoals() || {}).active || [];
            const items = State.getActiveItems();
            const sig = GoalsPane.badgeSignature(items, active);
            const openGoalFromBadge = (goalId) => GoalCard.open(goalId, goalCardDeps());
            if (sig !== goalBadgeSig) {
                goalBadgeSig = sig;
                GoalsPane.applyBadges(items, active, openGoalFromBadge);
            } else {
                // Same links, but an Edit Task can rebuild a row: re-apply to the linked rows only (idempotent, a handful of items).
                const linked = items.filter(i => i.goalId != null);
                if (linked.length) GoalsPane.applyBadges(linked, active, openGoalFromBadge);
            }
        } catch (err) {
            console.error('Goals pane refresh failed', err);
        }
    }

    function renderHeroesAtBase(routinesOverride) {
        ensureHeroTray();
        HeroTray.render({
            definedRoutines: routinesOverride || State.getDefinedRoutines(),
            definedHabits: State.getDefinedHabits(),
            definedTasks: window.definedTasks || [],
            config: CONFIG,
            runStartedAtMs: State.getRunStartedAtMs(),
            starMemory: heroStarMemory,
            onStarThresholdCrossed: (routine, stars) => {
                FrozenNotice.showHeroStarUpNotice(routine.name, stars, Heroes.heroCategoryFor(routine, CONFIG.HERO_CATEGORIES));
            },
        });
    }

    // Thin wrappers — real implementations live in js/ui/routineViews.js
    // (Milestone 2 UI extraction session 9, 2026-07-18.)
    // showCreateHabitForm/showCreateTaskForm/showEditTaskForm wrappers were
    // dead code — no call sites in script.js — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md. showEditHabitForm was inlined at its one
    // real call site (agendaListDeps(), passed through to js/ui/agendaList.js)
    // — same session.

    // Global functions for modal interactions — thin wrappers, real
    // implementations live in js/ui/routineViews.js (session 9, 2026-07-18).
    // Kept as window.* (not plain functions) because the create/edit form
    // HTML's inline onclick="saveNewHabit(...)" etc. needs the window-level
    // name, same reasoning as window.closeModal/window.deleteRoutine above.
    window.saveNewHabit = function(routineId) {
        RoutineViews.saveNewHabit(routineId, routineViewsDeps());
    };

    window.saveNewTask = function(routineId) {
        RoutineViews.saveNewTask(routineId, routineViewsDeps());
    };

    window.saveEditedHabit = function(habitId, completedItemId) {
        RoutineViews.saveEditedHabit(habitId, routineViewsDeps(), completedItemId);
    };

    // "Delete Habit" button in the Edit Habit modal (2026-10-16). Archives
    // rather than hard-deletes — see Routines.archiveHabit. window-exposed
    // because the modal button is an inline onclick string (same contract as
    // window.deleteRoutine / window.saveEditedHabit).
    window.archiveHabit = async function(habitId) {
        const habitDef = State.getDefinedHabits().find(h => h.id === habitId);
        if (!habitDef) return;
        if (!(await Dialog.confirm(`Delete the habit "${habitDef.name}"? It will be removed from the board and from any routine.`, { title: 'Delete habit?', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true }))) return;

        Routines.archiveHabit(habitId, {
            definedHabits: State.getDefinedHabits(),
            definedRoutines: State.getDefinedRoutines(),
            activeItems: State.getActiveItems(),
            removeItem
        });
        Modal.closeModal();
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
        sortAndRenderActiveList();
        // Re-render the week strip AFTER the def is archived: removeItem's
        // own refresh ran while the habit was still live, so the future-day
        // ghost counts were stale (found live 2026-10-16).
        updateTaskCountDisplay();
        saveGame();

        setTimeout(() => {
            if (managementWindows.habits && !managementWindows.habits.classList.contains('hidden')) {
                populateHabitsWindow();
            }
            if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                populateRoutinesWindow();
            }
        }, 100);
    };

    window.saveEditedTask = function(taskId) {
        RoutineViews.saveEditedTask(taskId, routineViewsDeps());
    };

    // Thin wrapper — real implementation lives in js/ui/modal.js
    // (Milestone 2 UI extraction session 1, 2026-07-18). Call site unchanged.
    window.closeModal = Modal.closeModal;
    // closeTopmost is for stacked-context Cancel buttons (e.g. the routine
    // addItemModal, which sits ON TOP of the routine management modal —
    // closeModal() there killed both). [P2-UI-011] Stage 1, session 61.
    window.closeTopmost = Modal.closeTopmost;

    // ESC / backdrop-click / Tab-trap / focus handling all live in
    // js/ui/modal.js now ([P2-UI-011] Stage 1, session 61) — wired below,
    // after managementWindows/closeFabMenu are defined (see
    // Modal.initDismissHandlers call near the event-listener block).

    // Floating Action Button and Window Management
    const fabButton = document.getElementById('fabButton');
    const fabMenu = document.getElementById('fabMenu');
    console.log('FAB Button found:', fabButton);
    console.log('FAB Menu found:', fabMenu);
    const managementWindows = {
        tasks: document.getElementById('tasksWindow'),
        habits: document.getElementById('habitsWindow'),
        routines: document.getElementById('routinesWindow'),
        shop: document.getElementById('shopWindow'),
        stats: document.getElementById('statsWindow'),
        settings: document.getElementById('settingsWindow')
    };
    
    // Thin wrappers — real implementations live in js/ui/fabMenu.js and
    // js/ui/managementWindows.js (Milestone 2 UI extraction session 3,
    // 2026-07-18). toggleFabMenu's 6 debug console.log lines were removed as
    // pure noise during the move — see fabMenu.js header.
    // (toggleFabMenu wrapper inlined at its one call site (fabButton's click
    // listener) sub-session 3, docs/STATE_OWNERSHIP_PLAN.md. closeFabMenu is
    // NOT inlined — one of its three call sites is a bare reference inside
    // openManagementWindow(), an explicitly-protected orchestrator; left
    // alone rather than partially retiring it, see report.)
    function closeFabMenu() {
        FabMenu.closeFabMenu({ fabMenu, fabButton });
    }

    function openManagementWindow(type) {
        ManagementWindows.openManagementWindow(type, {
            managementWindows, closeFabMenu, activeItems: State.getActiveItems(), definedHabits: State.getDefinedHabits(),
            definedRoutines: State.getDefinedRoutines(), routineSlots: State.getRoutineSlots(), showRoutineManagement, toggleRoutineActive,
            runStartedAtMs: State.getRunStartedAtMs(),
            shopCatalog: CONFIG.SHOP_ITEMS, playerInventory: State.getPlayerInventory(), playerPoints: State.getPlayerPoints(), baseHealth: State.getBaseHealth(),
            onShopBuy: handleShopPurchase, onShopUse: handleShopUse, shopDiscount: currentShopDiscount(), pushbackHelpCtx,
            weatherHtml: WeatherPanel.statsHtml(WeatherPanel.buildViewModel(climateNow(), moodForDay)), // Stats > the sky readout (run climate Build 2)
            moodFor: moodForDay, currentRunStats: State.getCurrentRunStats(), runHistory: State.getRunHistory(), daysSurvivedSoFar: nightsSurvivedNow(),
            achievementsCatalog: CONFIG.ACHIEVEMENTS, lifetimeStats: State.getLifetimeStats(), achievements: State.getAchievements(),
            goals: State.getGoals(), // Stats > Goals row + roster (Goals Build B2)
            // D2 step 5: closed days + today's open record for Stats best/worst day.
            days: Persistence.loadDays(), todayRecord: State.getToday(), scoreWeights: CONFIG.DAILY_SCORE_WEIGHTS,
            currentEffectsIntensity: effectsIntensity,
            onChangeEffectsIntensity: handleEffectsIntensityChange,
            // Evening check time (Habit Goals Build 3): read fresh each time the Settings window opens.
            currentEveningTime: Settings.load().eveningCheckTime,
            onChangeEveningTime: handleEveningCheckTimeChange,
            // Developer tools switch (2026-11-03): read fresh each time the Settings window opens.
            currentDevTools: Settings.load().devTools === true,
            onChangeDevTools: handleDevToolsChange,
            // Buzz switch (2026-11-10): per device, read fresh each time the Settings window opens.
            currentScreenBuzz: Settings.load().screenBuzz !== false,
            onChangeScreenBuzz: handleScreenBuzzChange,
            // Avatar (Mood Build A, 2026-11-13): saved with the settings, so it survives a Reset and rides along in Backup & Transfer.
            currentAvatar,
            onChangeAvatar: setAvatar,
            // Export/Import (Milestone 5 first item, 2026-07-20) — see
            // js/exportImport.js header + handleConfirmImport below.
            buildExportEnvelope: () => ExportImport.buildEnvelope({
                getPersistableState: () => State.getPersistableState(),
                getSettings: () => { const st = Settings.load(); delete st.devTools; delete st.screenBuzz; delete st.moodCardDay; return st; }, // Developer tools, the buzz and the once-a-day mood card stamp are per device: never exported
                // D2 (2026-10-27): closed daily records ride along in the export.
                getDays: () => Persistence.loadDays(),
            }),
            currentSummary: ExportImport.buildSummary(State.getPersistableState()),
            onConfirmImport: handleConfirmImport,
            // Reset Game (moved from a floating corner button into Settings,
            // 2026-07-21) — see handleConfirmReset below.
            onConfirmReset: handleConfirmReset,
        });
    }

    // [Milestone 5, 2026-07-20] SettingsView's onConfirmImport — the one
    // truly stateful step of export/import (everything else in
    // js/exportImport.js/js/ui/settingsView.js is pure build/validate/DOM).
    // Full replace, no merge (Jeremy's call, see js/exportImport.js header):
    // back up whatever's currently on this device first (one-shot, not
    // rotated — a second import overwrites the previous backup, which is
    // fine for "oops, wrong file" recovery, not a version history), write
    // the imported save/settings RAW (NOT re-run through
    // Persistence.serialize, which would re-stamp the CURRENT schemaVersion
    // and defeat importing an older export through the normal migration
    // chain on load), then hard-reload so restoreGameState/migrate/offline
    // catch-up/achievements-sweep all run exactly as they do on any other
    // page load — no separate hot-swap code path to maintain or trust.
    function handleConfirmImport(envelope) {
        try {
            const currentSaveRaw = localStorage.getItem(Persistence.SAVE_KEY);
            const currentSettingsRaw = localStorage.getItem(Settings.SETTINGS_KEY);
            localStorage.setItem('deadline.backup.preImport', JSON.stringify({
                backedUpAt: new Date().toISOString(),
                save: currentSaveRaw,
                settings: currentSettingsRaw,
                days: localStorage.getItem(Persistence.DAYS_KEY),
            }));
        } catch (e) {
            console.error('Deadline: pre-import backup failed (continuing with import anyway)', e);
        }

        // Found live in Chrome (2026-07-20): window.location.reload() is
        // ASYNC — JS keeps running for a few more ms, long enough for a
        // pending debounced Persistence.requestSave, the 5s
        // CONFIG.PERSISTENCE_AUTOSAVE_MS safety net, or the beforeunload/
        // visibilitychange flush hook to fire and re-serialize the LIVE
        // (pre-import) in-memory state right over our just-written import —
        // the save silently reverted to the old data every time. Same class
        // of hazard as the session-52 "stub flush/requestSave before a
        // direct localStorage edit" trick documented in CLAUDE.md; applying
        // it here too. Module state is thrown away by the reload regardless,
        // so neutering these is safe.
        Persistence.requestSave = function () {};
        Persistence.flush = function () {};

        localStorage.setItem(Persistence.SAVE_KEY, JSON.stringify(envelope.save));
        { // devTools is per device: an import neither turns it on nor off (Settings.save keeps the stored value when the key is missing)
            const importedSettings = Object.assign({}, envelope.settings || Settings.DEFAULTS);
            delete importedSettings.devTools;
            delete importedSettings.screenBuzz; // the buzz is per device too
            delete importedSettings.moodCardDay; // and so is the once-a-day mood card stamp
            if (!importedSettings.avatar) delete importedSettings.avatar; // a backup with no avatar must not wipe the one chosen here
            Settings.save(importedSettings);
        }
        // D2 (2026-10-27): daily records are LIFETIME data, so they MERGE by
        // date (a day that already has data on this device is never
        // overwritten) instead of following the full-replace rule above.
        try {
            if (envelope.days && typeof DailyRecord !== 'undefined') {
                const merged = DailyRecord.mergeStores(Persistence.loadDays(), envelope.days);
                Persistence.saveDays(merged.store);
            }
        } catch (e) {
            console.error('Deadline: daily records import failed (save import continues)', e);
        }
        window.location.reload();
    }

    // [2026-07-21] SettingsView's onConfirmReset — the confirm dialog itself
    // now lives in settingsView.js (in-app Modal, replacing the old floating
    // button's native confirm()); this callback runs only after the player
    // has already confirmed. Logic unchanged from the retired resetTestButton
    // handler: wipes definedHabits/definedRoutines too (unlike the restart
    // button, which keeps definitions and re-seeds today's habit instances
    // via initGame) so the next generateDailyHabitInstances() has nothing to
    // re-create. Also wipes run history (session 52, RUN_HISTORY_PLAN: a
    // full wipe means everything, not just the abandoned live run) and
    // lifetime achievements data (session 64, ACHIEVEMENTS_PLAN.md) — both
    // deliberately preserved by restart, wiped only here. Clears the save and
    // persists the empty state, so no reload or flush-guard needed.
    function handleConfirmReset() {
        State.setDefinedHabits([]);
        State.setDefinedRoutines([]);
        window.definedTasks = [];
        State.setRunHistory([]);
        State.setLifetimeStats(Achievements.freshLifetimeStats());
        State.setAchievements(Achievements.freshUnlocked());
        State.setBestRoutineSlots(0); // run-end carryover: a dev Reset forgets the best slot count too
        State.resetBestVillageTiers(); // ...and the Memorial's all-time best tiers (its stage is derived from them)
        State.resetBestPlayerLevel(); // ...and the best player level (the sky unlocks read it)
        State.setGoals(null); // ...and every goal, streak and goal slot (initGame then seeds the suggested starters again)
        if (typeof Persistence !== 'undefined') Persistence.clear();
        initGame();
        saveGame();
    }

    // [P2-UI-009] session 59: SettingsView's onChangeIntensity callback —
    // persist (js/settings.js, separate key from the game save), apply to
    // the live DOM immediately, and update the in-memory var so the next
    // openManagementWindow('settings') re-render shows the right radio
    // checked without needing a page reload.
    function handleEffectsIntensityChange(intensity) {
        effectsIntensity = intensity;
        Settings.save({ effectsIntensity: intensity });   // Settings.save keeps the other stored fields (eveningCheckTime)
        Settings.applyEffectsIntensity(intensity);
    }

    // Church damage preview (Jeremy, 2026-11-03; ART ONLY). While a church state is picked in the DEV panel, #base shows that damage picture
    // and its idle animation, and NOTHING else changes: the stand-in number below goes only to Damage.applyBaseArt (it picks a png + an
    // animation key), never to State, the HUD, a save, a record, damage or healing. Real damage / healing / the time-slider preview keep
    // running and redraw #base from the real health; the observer puts the demo picture back (and only writes when it differs, so it can
    // never loop). Clearing the demo restores the picture from the real health (a read).
    let churchPreviewWatcher = null;
    function churchPreviewMatches(standIn) {
        return baseElement.style.backgroundImage === 'url("' + Damage.resolveBaseImage(standIn) + '")'
            && (baseElement.dataset.baseAnim || '') === Damage.resolveBaseAnimKey(standIn);
    }
    function applyChurchPreview() {
        const standIn = DevDemo.churchHealth();
        if (standIn == null) {
            if (churchPreviewWatcher) { churchPreviewWatcher.disconnect(); churchPreviewWatcher = null; }
            Damage.applyBaseArt(baseElement, State.getBaseHealth()); // back to the real picture (read only)
            return;
        }
        if (!churchPreviewWatcher && typeof MutationObserver !== 'undefined') {
            churchPreviewWatcher = new MutationObserver(() => {
                const now = DevDemo.churchHealth();
                if (now != null && !churchPreviewMatches(now)) Damage.applyBaseArt(baseElement, now);
            });
            churchPreviewWatcher.observe(baseElement, { attributes: true, attributeFilter: ['style', 'data-base-anim'] });
        }
        if (!churchPreviewMatches(standIn)) Damage.applyBaseArt(baseElement, standIn);
    }
    // The Hit button: the same flash + shake a real hit plays (css/gameCanvas.css), once, regardless of the 3 s shake cooldown.
    let churchHitTimer = null;
    function previewChurchHit() {
        baseElement.classList.remove('base-hit-flash', 'base-hit-shake');
        void baseElement.offsetWidth; // restart the animations if a previous hit is still playing
        baseElement.classList.add('base-hit-flash', 'base-hit-shake');
        clearTimeout(churchHitTimer);
        churchHitTimer = setTimeout(() => { baseElement.classList.remove('base-hit-flash', 'base-hit-shake'); }, Math.max(300, CONFIG.BASE_SHAKE_DURATION_MS) + 50);
    }

    // The Buzz buttons (2026-11-11): the completion thump + vibration at one size, right now, nothing saved (CanvasThump.preview).
    function previewBuzz(tier) { CanvasThump.preview(gameCanvas, tier); }

    // Developer tools (2026-11-03): the Settings switch. Saved per device (js/settings.js), then the DEV button shows / hides right away;
    // turning it off also clears any demo (DevPanel.setEnabled -> DevDemo.setEnabled(false)), which redraws the real sky, village and church picture.
    function handleDevToolsChange(on) {
        Settings.save({ devTools: on === true });
        DevPanel.setEnabled(on === true);
    }

    // Buzz switch (2026-11-10): the Settings "Screen Thump" checkbox. Saved per device; turning it on gives one sample buzz (the tap that
    // flipped it is the user gesture the browser needs).
    function handleScreenBuzzChange(on) {
        Settings.save({ screenBuzz: on === true });
        if (on === true) CanvasThump.sampleBuzz();
    }

    // Habit Goals Build 3: the Settings "Evening check" time. A new time re-arms tonight's check (the player may have just moved it
    // earlier on purpose); an empty / invalid input falls back to the default.
    function handleEveningCheckTimeChange(value) {
        Settings.save({ eveningCheckTime: GoalCheck.normalizeEveningTime(value, CONFIG.EVENING_CHECK_DEFAULT) });
        eveningDismissedFor = null;
    }

    // (closeAllManagementWindows wrapper inlined at its one call site
    // (Modal.initDismissHandlers) sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    // (closeManagementWindow wrapper inlined at its call sites sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/ui/managementWindows.js.)

    function populateTasksWindow() {
        ManagementWindows.populateTasksWindow({ activeItems: State.getActiveItems() });
    }

    function populateHabitsWindow() {
        ManagementWindows.populateHabitsWindow({ definedHabits: State.getDefinedHabits() });
    }

    function populateRoutinesWindow() {
        ManagementWindows.populateRoutinesWindow({
            definedRoutines: State.getDefinedRoutines(), definedHabits: State.getDefinedHabits(), routineSlots: State.getRoutineSlots(), showRoutineManagement, toggleRoutineActive,
            runStartedAtMs: State.getRunStartedAtMs()
        });
    }

    // Shop ([P1-UI-008] SHOP_PLAN.md session 2, 2026-07-18). populateShopWindow
    // mirrors the populateTasksWindow/populateHabitsWindow wrappers above, but
    // calls ShopView (a different module) directly rather than routing back
    // through ManagementWindows, since ShopView owns no per-type dispatch logic
    // of its own to reuse.
    function populateShopWindow() {
        ShopView.renderShopWindow({
            catalog: CONFIG.SHOP_ITEMS, inventory: State.getPlayerInventory(), playerPoints: State.getPlayerPoints(), baseHealth: State.getBaseHealth(),
            discount: currentShopDiscount(), pushbackHelpCtx,
            onBuy: handleShopPurchase, onUse: handleShopUse
        });
    }

    // Buy-one-unit handler wired to every catalog card's Buy button (session 2).
    // Shop.purchase is pure — this applies its result to state, persists, and
    // re-renders both the shop grid (new price/held count) and the points HUD.
    // Pushback targeting is session 4 — buying only fills playerInventory
    // today; repair-kit USE (below) closes the loop for repair kits.
    function handleShopPurchase(itemId) {
        const result = Shop.purchase(itemId, CONFIG.SHOP_ITEMS, State.getPlayerInventory(), State.getPlayerPoints(), currentShopDiscount());
        if (!result.ok) {
            // Buy button is disabled whenever unaffordable, so this is a
            // defensive no-op guard (e.g. a stale render) rather than the
            // expected path — still give feedback if it happens.
            ShopView.showShopMessage('Not enough points for that.');
            return;
        }

        State.bumpToday('spend', { points: State.getPlayerPoints() - result.newPoints }); // daily record (D2)
        State.setPlayerPoints(result.newPoints);
        State.setPlayerInventory(result.newInventory);
        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge });
        saveGame();

        // Deferred, not synchronous: populateShopWindow() replaces
        // #shopWindowList's innerHTML, which DETACHES the very Buy button
        // that's still bubbling this click event up to document's "click
        // outside closes windows" listener (script.js, ~line 1086). That
        // listener does `e.target.closest('.management-window')` — on a
        // button already removed from the DOM this returns null, so it reads
        // as an outside click and closes the window immediately after every
        // purchase. Found live-testing this session (see DECISIONS.md).
        // setTimeout(0) lets the click finish bubbling before the rebuild.
        setTimeout(populateShopWindow, 0);
    }

    // Use-one-held-unit handler wired to each repair-kit card's Use button
    // (session 3, SHOP_PLAN.md, 2026-07-19; extended sub-session 5, 2026-07-19
    // to Sick Day — same card-Use shape, different category branch). Shop.consume
    // is pure — decrements the held count (never below zero); the actual effect
    // branches on category:
    //   - repair (healAmount): existing healBase(amount) wrapper (script.js,
    //     ~line 569 — built for base regen [P2-GAME-012]), which clamps at
    //     CONFIG.MAX_BASE_HEALTH, updates the health display/sprite, and
    //     calls saveGame() internally.
    //   - sickDay: handleUseSickDay() (global excuse-and-sweep, see its own
    //     comment) — no per-item effect payload, just the category check.
    // playerInventory is updated BEFORE calling either effect so its internal
    // save (repair) or the explicit saveGame() (sick day) already captures the
    // decremented count.
    function handleShopUse(itemId) {
        const item = Shop.getItem(itemId, CONFIG.SHOP_ITEMS);
        if (!item || !item.consumable) return;
        const isRepairKit = item.effect && typeof item.effect.healAmount === 'number';
        const isSickDay = item.category === 'sickDay';
        if (!isRepairKit && !isSickDay) return;

        const result = Shop.consume(itemId, State.getPlayerInventory());
        if (!result.ok) {
            // Use button is only rendered when held > 0, so this is a
            // defensive no-op guard rather than the expected path.
            ShopView.showShopMessage("You don't have one of those to use.");
            return;
        }

        State.setPlayerInventory(result.newInventory);
        if (isRepairKit) {
            State.bumpToday('token', { kind: 'kit' }); // daily record (D2)
            Damage.healBase(item.effect.healAmount, damageDeps());
        } else {
            handleUseSickDay();
        }

        // Same event-bubbling hazard as handleShopPurchase (see its comment
        // above, and SHOP_PLAN.md's hazards list) — defer the rebuild so the
        // click finishes bubbling with its target still attached.
        setTimeout(populateShopWindow, 0);
    }

    // Pushback handler wired to each enemy popup's size buttons and the Base Health panel (session 4;
    // rebuilt for pushback charges in Build B, docs/PUSHBACK_CHARGES_PLAN.md). Called with a size id
    // ('short' | 'medium' | 'long') + the TARGET enemy. Quotes the move (Pushback.quoteFixed: free when the
    // zombie is more than 4 hours away, else a free charge, a held token, then points), shifts the target's
    // due date later by the size (pure Shop.pushedBackDueDate, counted from the later of now and the current
    // due), pays through commitReschedule (which also flags the item `pushedLate` for paid-zone moves),
    // re-derives overdue state (un-camps + repositions the zombie if it crossed into the future) and
    // re-renders the agenda row. Returns { ok } so the popup can refresh its UI in place. Stacking is
    // allowed -- repeated calls just push the same item further (each one uses another charge).
    function handlePushback(sizeId, targetItem) {
        const size = CONFIG.PUSHBACK_SIZES.find(z => z.id === sizeId);
        if (!size || !targetItem) return { ok: false };
        // Habits get Short/Medium only (a Long would land on tomorrow's instance); negative habits and
        // KO ghosts keep no pushback at all.
        if (targetItem.type === 'habit' && sizeId === 'long') return { ok: false };
        if (targetItem.koGhost || Items.isNonThreatening(targetItem)) return { ok: false };

        const now = new Date();
        const q = Pushback.quoteFixed(sizeId, Object.assign(pushbackInputs(now), {
            currentDue: targetItem.dueDateTime, createdAt: Pushback.graceCreatedAt(targetItem),
        }));
        // Buttons are disabled when blocked, so this is a defensive guard rather than the expected path.
        if (!q || !q.ok) return { ok: false };

        commitReschedule(targetItem, q);
        const dueBeforePush = targetItem.dueDateTime;
        // Counts from the later of now and the current due (2026-10-26, Jeremy): an
        // overdue zombie is pushed to now + size, so even a Short clears it.
        targetItem.dueDateTime = Shop.pushedBackDueDate(targetItem.dueDateTime, size.ms, now.getTime());

        // Dependent due dates ([P1-DATA-004] sub-session 2): a SUB-TASK can't
        // be pushed past its parent's deadline — the pushed date clamps to the
        // parent's (pure Items.clampedSubTaskDueDate). Pushing a PARENT later
        // never touches its children (they're then "earlier", which is legal).
        if (targetItem.parentId) {
            const pushParent = State.getActiveItems().find(i => i.id === targetItem.parentId && i.type === 'task');
            if (pushParent) {
                targetItem.dueDateTime = Items.clampedSubTaskDueDate(targetItem.dueDateTime, pushParent);
            }
        }
        // Anytime (2026-11-02): the flag survives a pushback only while the due time is still exactly 23:59 (e.g. a Long
        // from a not-yet-overdue task); a Short / Medium, or any push from an overdue task, makes it an ordinary timed task.
        Items.syncAnytimeFlag(targetItem);
        // Priority slots: a push onto another local day strips priority (the old day's slot stays spent).
        Items.syncPriorityOnMove(targetItem, dueBeforePush, itemsDeps());

        // Re-derive overdue state from the NEW due date — same reasoning as the
        // Edit Task save path (js/ui/popups.js showEditTaskModal): without this
        // a pushed-back overdue zombie stays camped at the base ticking damage.
        // A non-overdue item pushed further out just gets repositioned by the
        // next 50ms game-loop tick (Loop.updateActiveItems).
        Items.recomputeOverdueStateAfterEdit(targetItem, itemsDeps());

        // Refresh the target's agenda row (its due time changed) + re-sort.
        if (targetItem.listItemElement) {
            targetItem.listItemElement.remove();
            if (!targetItem.parentId) createListItem(targetItem);
        }
        sortAndRenderActiveList();
        saveGame();

        return { ok: true, newPoints: State.getPlayerPoints() };
    }

    // Cheat Day targeting handler ([P1-DATA-005] sub-session 5, 2026-07-19),
    // wired to a negative-habit lurker popup's "Use Cheat Day" button
    // (js/ui/popups.js). Mirrors handlePushback's shape (called with the shop
    // item id + the TARGET instance), but Cheat Day is a HELD consumable —
    // the button only renders once you already hold one, so this goes
    // through Shop.consume (decrement), not Shop.purchase (buy). Sets the
    // target habit definition's `cheatDayDate` to the lurker's occurrence
    // date (Habits.toOccurrenceDate) — items.js's indulgeHabit/
    // resolvePendingCheckIn check this to excuse that day's indulgence for
    // free (no debit, no occurrence, streak untouched — session 26, Fable).
    // Returns { ok } so the popup can rebuild itself (deferred via
    // setTimeout(0) — see popups.js's comment on why in-place isn't safe here).
    function handleUseCheatDay(cheatDayItemId, targetItem) {
        const item = Shop.getItem(cheatDayItemId, CONFIG.SHOP_ITEMS);
        if (!item || item.category !== 'cheatDay') return { ok: false };
        if (!targetItem || targetItem.type !== 'habit' || !targetItem.isNegative) return { ok: false };

        const habitDef = State.getDefinedHabits().find(def => def.id === targetItem.definitionId);
        if (!habitDef) return { ok: false };

        const result = Shop.consume(cheatDayItemId, State.getPlayerInventory());
        if (!result.ok) {
            // Button is only rendered when held > 0, so this is a defensive
            // guard rather than the expected path.
            return { ok: false };
        }

        State.setPlayerInventory(result.newInventory);
        State.bumpToday('token', { kind: 'cheat' }); // daily record (D2)
        habitDef.cheatDayDate = Habits.toOccurrenceDate(targetItem.originalDueDate);

        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge });
        saveGame();

        return { ok: true };
    }

    // Skip Day targeting handler (frozen-slots sub-session 5, 2026-07-19),
    // wired to ANY habit instance's popup "Use Skip Day" button (js/ui/
    // popups.js) — not restricted to negative lurkers, unlike Cheat Day.
    // Same held-consumable shape as handleUseCheatDay (Shop.consume, not
    // Shop.purchase), but the actual excuse-and-remove logic lives in
    // Items.useSkipDayOnItem ("clear immediately" model, Jeremy's call,
    // 2026-07-19) since — unlike Cheat Day — there's no later indulge/
    // complete/rollover branch to also wire; the instance is gone the
    // moment the token lands.
    function handleUseSkipDay(skipDayItemId, targetItem) {
        const item = Shop.getItem(skipDayItemId, CONFIG.SHOP_ITEMS);
        if (!item || item.category !== 'skipDay') return { ok: false };
        if (!targetItem || targetItem.type !== 'habit') return { ok: false };

        const result = Shop.consume(skipDayItemId, State.getPlayerInventory());
        if (!result.ok) {
            // Button is only rendered when held > 0, so this is a defensive
            // guard rather than the expected path.
            return { ok: false };
        }

        State.setPlayerInventory(result.newInventory);
        State.bumpToday('token', { kind: 'skip' }); // daily record (D2)
        Items.useSkipDayOnItem(targetItem, itemsDeps());

        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge });
        saveGame();

        return { ok: true };
    }

    // Sick Day GLOBAL apply handler (frozen-slots sub-session 5, 2026-07-19),
    // wired to the Sick Day shop card's own "Use" button (js/ui/shopView.js's
    // handleShopUse sick-day branch) — untargeted, unlike Cheat/Skip Day.
    // Sets the global sickDayDate marker + sweeps every currently active
    // habit instance for today off the board (Items.useSickDayGlobally,
    // "clear immediately" model). Routine tasks are untouched (fork 4,
    // docs/FROZEN_SLOTS_PLAN.md — Sick Day is habits-only).
    function handleUseSickDay() {
        State.bumpToday('token', { kind: 'sick' }); // daily record (D2)
        Items.useSickDayGlobally(State.getCurrentGameDate(), itemsDeps());
        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, playerXpBar, levelButton, xpThresholds: CONFIG.LEVEL_XP_THRESHOLDS, playerPointsStat, playerPointsNudge });
        saveGame();
    }

    function showRoutineManagement(routineId) {
        RoutineViews.showRoutineManagement(routineId, routineViewsDeps());
    }

    // (populateRoutineHabits/populateRoutineTasks wrappers were dead code —
    // no call sites in script.js, js/ui/routineViews.js does this
    // internally now — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    // Thin wrappers — real implementations live in js/ui/forms.js
    // (Milestone 2 UI extraction session 4, 2026-07-18). Call sites
    // unchanged. The routine-creation branch was reconciled to call
    // Routines.createRoutineDefinition (adds a previously-missing
    // saveGame() call) — see js/ui/forms.js header and DECISIONS.md.
    function formsDeps() {
        return {
            createTaskItemData: (name, category, isHighPriority, dueDateStr, dueTimeStr, parentId, startTimeStr, anytime) => Items.createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId, itemsDeps(), startTimeStr, anytime),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => handleEnemyClick(itemId), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay, sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            sortAndRenderActiveList,
            // Priority slots (Build B): Add Task marks after the task exists, so the slot rules apply.
            setPriority: (id, on) => Items.setPriority(id, on, itemsDeps()),
            priorityRowDeps,
            updateTaskCountDisplay,
            managementWindows, populateTasksWindow,
            createHabitDefinition, populateHabitsWindow,
            definedRoutines: State.getDefinedRoutines(), saveGame, populateRoutinesWindow, openManagementWindow
        };
    }

    // Note: createTaskFormHtml/createHabitFormHtml/createRoutineFormHtml had
    // no callers outside showFormModal's old switch statement (verified by
    // Grep before removing them here) — Forms.showFormModal now calls its
    // own module-scoped copies internally, so no script.js wrapper is
    // needed for them. (attachModalEventListeners wrapper was dead code —
    // no call sites in script.js — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md. showFormModal was inlined at its three
    // call sites below — same session.)

    // Forms are now handled through dedicated modal functions above
    
    // Event Listeners
    if (fabButton) {
        fabButton.addEventListener('click', () => FabMenu.toggleFabMenu({ fabMenu, fabButton }));
    } else {
        console.error('FAB button not found — creation UI unavailable');
    }
    
    // FAB menu item listeners
    document.querySelectorAll('.fab-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            openManagementWindow(type);
        });
    });
    
    // Close window listeners
    document.querySelectorAll('.close-window').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const windowId = e.target.dataset.window;
            ManagementWindows.closeManagementWindow(windowId, { managementWindows });
        });
    });
    
    // Unified dismiss + focus behavior ([P2-UI-011] Stage 1, session 61):
    // ESC (topmost overlay first, then windows/FAB), backdrop click
    // (clicked overlay only), Tab trap, focus return, role/aria on open —
    // all centralized in js/ui/modal.js. Replaces the previous inline ESC
    // keydown + click-outside handlers here and the per-popup backdrop
    // listeners in popups.js.
    Modal.initDismissHandlers({
        closeAllManagementWindows: () => ManagementWindows.closeAllManagementWindows({ managementWindows }),
        closeFabMenu,
        isAnyManagementWindowOpen: () => Object.values(managementWindows).some(w =>
            w && !w.classList.contains('hidden')
        ),
    });
    Modal.initFocusManagement();
    
    // Add new item button listeners
    const addNewTaskButton = document.getElementById('addNewTaskButton');
    const addNewHabitButton = document.getElementById('addNewHabitButton');
    const addNewRoutineButton = document.getElementById('addNewRoutineButton');
    
    if (addNewTaskButton) {
        addNewTaskButton.addEventListener('click', () => {
            ManagementWindows.closeManagementWindow('tasksWindow', { managementWindows });
            Forms.showFormModal('task', formsDeps());
        });
    }
    
    if (addNewHabitButton) {
        addNewHabitButton.addEventListener('click', () => {
            ManagementWindows.closeManagementWindow('habitsWindow', { managementWindows });
            Forms.showFormModal('habit', formsDeps());
        });
    }
    
    if (addNewRoutineButton) {
        addNewRoutineButton.addEventListener('click', () => {
            ManagementWindows.closeManagementWindow('routinesWindow', { managementWindows });
            Forms.showFormModal('routine', formsDeps());
        });
    }
    
    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.fab-container')) {
            closeFabMenu();
        }
    });

    if (createRoutineButton) {
        createRoutineButton.addEventListener('click', createRoutineDefinition);
    }

    if (attackButton) {
        attackButton.addEventListener('click', () => {
            attackMode = !attackMode;
            attackButton.classList.toggle('active', attackMode);
            gameCanvas.style.cursor = attackMode ? 'crosshair' : 'default';
        });
    }

    if (restartButton) {
        restartButton.addEventListener('click', startNextRun);
    }

    // Run-end carryover (2026-11-03, js/runCarryover.js, docs/RUN_CARRYOVER_PLAN.md). Restart
    // abandons the dead run (its save is cleared so a reload before the first new mutation
    // doesn't resurrect it), but three things ride into the next run: the player's open one-off
    // tasks (with their sub-tasks and due dates), their best-ever routine slot count (State keeps
    // it; initGame reads it), and any held item flagged `keptAcrossRuns` in CONFIG.SHOP_ITEMS
    // (none today). Habit / routine instances are regenerated from their definitions by initGame.
    function startNextRun() {
        const carried = RunCarryover.openTasksToCarry(State.getActiveItems()).map(RunCarryover.detachForNewRun);
        const keptInventory = RunCarryover.inventoryToKeep(State.getPlayerInventory(), CONFIG.SHOP_ITEMS);
        // Carried tasks keep their ids, so the counter must not restart below them (sub-tasks point
        // at their parent by id, and a reused id would collide with a new item).
        const idCounter = State.getItemIdCounter();
        if (typeof Persistence !== 'undefined') Persistence.clear();
        initGame();
        if (carried.length) State.setItemIdCounter(idCounter);
        State.setPlayerInventory(keptInventory);
        const deps = stateDeps();
        carried.forEach(item => {
            deps.addItemToGame(item);
            // Same as restoreGameState: an already-overdue task re-enters at the base with a FRESH
            // damage clock -- the old run's unpaid ticks are gone with it, no catch-up here.
            if (item.isOverdue) {
                if (item.element) item.element.classList.add('enemy-at-base');
                if (item.listItemElement) item.listItemElement.classList.add('overdue-list-item');
                item.lastDamageTickTime = Date.now();
            }
        });
        // Parents' list items were built before their sub-tasks were back -- rebuild them (restore does the same).
        State.getActiveItems().forEach(item => {
            if (!item.parentId && item.subTasks && item.subTasks.length > 0 && item.listItemElement) {
                item.listItemElement.remove();
                deps.createListItem(item);
            }
        });
        updateTaskCountDisplay();
        deps.sortAndRenderActiveList(); // restore ends the same way: the rebuilt parent rows need re-placing in the list
        saveGame();
    }

    // Initialize definedTasks array
    if (!window.definedTasks) window.definedTasks = [];
    
    // (showDebugInfo wrapper was dead code — unreferenced anywhere in
    // script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.
    // Hud.showDebugInfo itself is untouched, still exported for future use.)

    // Initialize the game
    initGame();
    State.restoreGameState(stateDeps());
    refreshBarricadeView(true); // the barricade for the restored run (BarricadeView.init above ran before the state was restored)
    ClimateView.refresh(); // the sky for the restored run (ClimateView.init above ran before the state was restored)
    armSkyWatch(); // from here on a real-band change under a sky pick gets its toast
    // Dev tools (2026-11-03): the DEV button + demo panel (js/ui/devPanel.js), shown only while the Settings "Developer tools" switch is
    // on (per device). A demo change redraws the sky and the village at once (the church's live width = what BASE_WIDTH holds).
    DevPanel.init({
        onDemoChange: () => { VillageView.render(baseElement.offsetWidth); ClimateView.refresh(); applyChurchPreview(); },
        onHit: previewChurchHit,
        onBuzz: previewBuzz,
        onBarricade: (id) => { barricadeDevPick = id || null; barricadeViewAt = 0; refreshBarricadeView(); }, // picture only, like ?barricade= (resetting the 2 s throttle redraws now)
    });
    DevPanel.setEnabled(Settings.load().devTools === true);
    // Time slider (Milestone 4, 2026-07-20) — after initGame() so
    // GAME_SCREEN_WIDTH/BASE_WIDTH/HABIT_ENEMY_WIDTH are resolved (deps.dims()
    // is still a live function, so a later resize is fine too; this ordering
    // only matters for the initial syncHandle() call inside init()).
    TimeSliderView.init(timeSliderDeps());
    // Day pager (Week scope sub-session 2, 2026-07-20) — after
    // restoreGameState() so getCurrentGameDate()/getDefinedHabits() etc.
    // read POST-restore state on their first render, not fresh-boot
    // defaults (mirrors TimeSliderView.init's own ordering note above).
    DayPagerView.init(dayPagerViewDeps());
    // Nights Survived on the moon (2026-10-26) — after restoreGameState() so it
    // reads the restored run start; the view self-refreshes (own interval).
    NightsSurvivedView.init({
        getRunStartedAtMs: State.getRunStartedAtMs,
        isGameOver: State.isGameOver,
        getNights: nightsSurvivedNow, // Momentum Build A (2026-11-11): defended nights, not calendar midnights
    });
    // Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): if the
    // rollover just ran (above) and left any negative-habit pendingCheckIn
    // markers, prompt for them now.
    showCheckInIfPending();
    // Evening check (Habit Goals Build 3): an app open at or after the evening time asks right away (the poll covers the rest).
    maybeShowEveningCheck();
    // Anytime tasks that attacked overnight (Anytime Build 3): ask right away on the first open (waits behind any dialog above).
    maybeShowMorningTaskCheck();
    // Mood (Build A): the avatar face from today's record, and the once-a-day "How are you starting?" card (waits behind any dialog above).
    refreshAvatarFace();
    maybeShowMoodCard();

    // Daily record `active` window (D2, 2026-10-27): any pointer interaction
    // counts as a touch, throttled so `active.touches` is roughly "half-minutes
    // the player was actually using the app" and the hot path stays cheap.
    // Capture phase so a handler that stopPropagation()s (see CLAUDE.md) can't hide it.
    let lastDailyTouchMs = 0;
    document.addEventListener('pointerdown', () => {
        const nowMs = Date.now();
        if (nowMs - lastDailyTouchMs < 30000) return;
        lastDailyTouchMs = nowMs;
        State.bumpToday('touch', { at: nowMs });
    }, { capture: true, passive: true });

    // Flush any pending debounced save when the page hides or closes.
    // visibilitychange covers mobile Chrome, where beforeunload is unreliable.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && typeof Persistence !== 'undefined') {
            Persistence.flush();
        }
        // Coming back to the app counts as opening it: a "Later" from earlier tonight is forgotten and the check asks again.
        if (document.visibilityState === 'visible') {
            eveningDismissedFor = null;
            morningTaskDismissed = false;
            maybeShowEveningCheck();
            maybeShowMorningTaskCheck();
            maybeShowMoodCard();
        }
    });
    window.addEventListener('beforeunload', () => {
        if (typeof Persistence !== 'undefined') Persistence.flush();
    });
});
