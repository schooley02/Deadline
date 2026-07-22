/**
 * sw.js — PWA installable-shell service worker (2026-07-20,
 * MOBILE_PWA_PLAN.md sub-session 3). Installable-shell scope only, per
 * Jeremy's call (see DECISIONS.md session 74): cache the app shell for
 * offline load + "Add to Home Screen." NO background sync, NO game-state
 * caching/reconciliation — the game is already localStorage-only
 * client-side, so real save data is never touched by this file.
 *
 * Strategy: cache-first for every shell asset (this app has no backend API
 * to go stale against — script.js/css/js are the whole "backend"), with a
 * network fallback + install-time cache so first load online still works
 * offline afterward.
 *
 * BUMP CACHE_NAME on any shell-file change (new/removed <script>/<link>,
 * edited CSS/JS) so returning users pick up the update instead of serving a
 * stale cached shell forever — the whole point of a version string here.
 */
const CACHE_NAME = 'deadline-shell-v2';

const APP_SHELL = [
    './',
    'index.html',
    'manifest.json',
    'script.js',

    // css/*.css — exact list from index.html's <link> tags (2026-07-20).
    'css/base.css',
    'css/gameCanvas.css',
    'css/enemySprites.css',
    'css/enemyStatus.css',
    'css/agendaList.css',
    'css/fabMenu.css',
    'css/managementWindows.css',
    'css/forms.css',
    'css/routineViews.css',
    'css/modal.css',
    'css/popups.css',
    'css/checkIn.css',
    'css/frozenNotice.css',
    'css/shop.css',
    'css/stats.css',
    'css/settings.css',
    'css/gameOverReview.css',
    'css/heroes.css',
    'css/timeSlider.css',
    'css/dayPager.css',
    'css/responsive.css',

    // js/*.js + js/ui/*.js — exact list from index.html's <script> tags
    // (2026-07-20). Keep in sync if index.html's load order ever changes.
    'js/config.js',
    'js/settings.js',
    'js/runStats.js',
    'js/achievements.js',
    'js/schedule.js',
    'js/dayRollover.js',
    'js/persistence.js',
    'js/clock.js',
    'js/movement.js',
    'js/timeSlider.js',
    'js/spawning.js',
    'js/damage.js',
    'js/progression.js',
    'js/heroes.js',
    'js/economy.js',
    'js/shop.js',
    'js/frozenSlots.js',
    'js/habits.js',
    'js/routines.js',
    'js/dayPager.js',
    'js/items.js',
    'js/state.js',
    'js/loop.js',
    'js/ui/modal.js',
    'js/ui/hud.js',
    'js/ui/fabMenu.js',
    'js/ui/managementWindows.js',
    'js/ui/shopView.js',
    'js/ui/statsView.js',
    'js/ui/settingsView.js',
    'js/ui/gameOverView.js',
    'js/ui/forms.js',
    'js/ui/popups.js',
    'js/ui/checkIn.js',
    'js/ui/frozenNotice.js',
    'js/ui/agendaList.js',
    'js/ui/routineViews.js',
    'js/ui/heroes.js',
    'js/ui/timeSliderView.js',
    'js/ui/dayPagerView.js',
    'js/IdCounter.js',
    'js/TaskManager.js',

    // Runtime art actually used by the game (Zombies + Base sprite states +
    // the PWA icons). Deliberately NOT a blanket Assets/* cache — the
    // Assets/ folder also holds .psd/reference files (see CLAUDE.md
    // "Never open .pdf/.psd/..." rule) that are never fetched at runtime
    // and shouldn't be shipped to every installed client.
    'Assets/Base/base_000.png',
    'Assets/Base/base_025.png',
    'Assets/Base/base_050.png',
    'Assets/Base/base_075.png',
    'Assets/Base/base_100.png',
    'Assets/Zombies/career-zombie.png',
    'Assets/Zombies/career-zombie-64.png',
    'Assets/Zombies/creativity-zombie.png',
    'Assets/Zombies/creativity-zombie-64.png',
    'Assets/Zombies/financial-zombie.png',
    'Assets/Zombies/financial-zombie-64.png',
    'Assets/Zombies/health-zombie.png',
    'Assets/Zombies/health-zombie-64.png',
    'Assets/Zombies/lifestyle-zombie.png',
    'Assets/Zombies/lifestyle-zombie-64.png',
    'Assets/Zombies/other-zombie.png',
    'Assets/Zombies/other-zombie-64.png',
    'Assets/Zombies/relationships-zombie.png',
    'Assets/Zombies/relationships-zombie-64.png',
    'Assets/Zombies/spiritual-zombie.png',
    'Assets/Zombies/spiritual-zombie-64.png',
    'Assets/icons/icon-192.png',
    'Assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle same-origin GETs — anything else (POST, cross-origin,
    // devtools requests) passes straight through to the network untouched.
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cache-as-you-go for anything not in the install-time list
                // (e.g. a future asset), so a SECOND offline visit after a
                // successful online one still finds it. Only cache OK
                // responses to avoid poisoning the cache with 404s.
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline + not cached + it's a navigation request: fall
                // back to the shell so the app still boots (it reads its
                // own save from localStorage once script.js runs).
                if (event.request.mode === 'navigate') {
                    return caches.match('index.html');
                }
                return undefined;
            });
        })
    );
});
