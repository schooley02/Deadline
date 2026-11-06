/**
 * enemyRing.js -- family-on-tap for the ground ring (2026-11-06, docs/ENEMY_HIGHLIGHT_PLAN.md "Build A").
 *
 * Tapping a zombie opens its card; while the card is open the zombie wears the bright ring (`.ring-selected`) and
 * its relatives wear the dim still one (`.ring-kin`), so "whose piece is this?" is answered by a tap instead of a
 * permanent tether (start / due times scatter relatives along the road, so any always-on link would be noise).
 * Relatives (kinOf):
 *   - a sub-task        -> its parent and its sibling sub-tasks
 *   - a parent task     -> its open sub-tasks
 *   - a routine member  -> every other open item of the same routine (habit or routine task)
 * A zombie can be several of these at once (a routine task with sub-tasks); the result is the union.
 *
 * Pure part: `kinOf(items, itemId, routineIdOf)` -- ids only, no DOM. DOM part: `show` / `clear` set and strip the
 * two classes on `item.element`; `watch()` clears the ring when no modal is open any more (the card was closed).
 * The ring itself (the `.enemy-ring` child) and its look live in js/spriteAnim.js + css/enemyStatus.css.
 */
const EnemyRing = (() => {
    const SELECTED = 'ring-selected';
    const KIN = 'ring-kin';

    // Ids of the open items related to `itemId`. `routineIdOf(item)` is optional (returns a routine id or null);
    // without it only the parent / sub-task family is found. Never includes the item itself.
    function kinOf(items, itemId, routineIdOf) {
        const list = Array.isArray(items) ? items : [];
        const self = list.find(i => i && i.id === itemId);
        if (!self) return [];
        const out = new Set();
        if (self.parentId != null) {
            list.forEach(i => { if (i && (i.id === self.parentId || i.parentId === self.parentId)) out.add(i.id); });
        }
        list.forEach(i => { if (i && i.parentId === self.id) out.add(i.id); });
        if (typeof routineIdOf === 'function') {
            const rid = routineIdOf(self);
            if (rid != null) list.forEach(i => { if (i && routineIdOf(i) === rid) out.add(i.id); });
        }
        out.delete(self.id);
        return Array.from(out);
    }

    function clear(items) {
        (Array.isArray(items) ? items : []).forEach(i => {
            if (i && i.element && i.element.classList) i.element.classList.remove(SELECTED, KIN);
        });
    }

    // Marks the tapped item and its kin; replaces any earlier marking. Returns the kin ids.
    function show(items, itemId, routineIdOf) {
        clear(items);
        const list = Array.isArray(items) ? items : [];
        const self = list.find(i => i && i.id === itemId);
        if (!self) return [];
        const kin = kinOf(list, itemId, routineIdOf);
        if (self.element && self.element.classList) self.element.classList.add(SELECTED);
        list.forEach(i => {
            if (i && kin.includes(i.id) && i.element && i.element.classList) i.element.classList.add(KIN);
        });
        return kin;
    }

    // Clears the marking once no modal overlay is on screen (the card closed). `getItems` is a getter so the live
    // list is read at clear time. Idempotent: a second call returns the same observer. No-op outside a browser.
    let observer = null;
    function watch(getItems) {
        if (observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined') return observer;
        observer = new MutationObserver(() => {
            if (!document.querySelector('.modal-overlay')) clear(getItems());
        });
        observer.observe(document.body, { childList: true });
        return observer;
    }

    return { SELECTED, KIN, kinOf, show, clear, watch };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnemyRing;
}
