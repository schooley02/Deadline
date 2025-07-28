# Actionable Development Tickets
## Step 8: Requirement-to-Code Alignment Tickets

Based on the comprehensive requirement analysis, the following tickets have been generated to address critical gaps and align the codebase with project specifications.

---

## P0 - CRITICAL (Game-Breaking Issues)

### [P0-UI-001] ✅ COMPLETED: Category-Specific Zombie Enemy System
**Component:** UI  
**Priority:** Critical  
**Estimate:** 8 points (4 weeks) - **COMPLETED**

**Description:**
Implement a comprehensive category-to-sprite mapping system to replace current emoji-based enemy representations with distinct visual zombie types for each life category.

**Acceptance Criteria:**
- [x] Create CategorySpriteManager class with sprite mapping for all 8 categories
- [x] Replace emoji system in createEnemyElement() function
- [x] Implement sprite loading and rendering pipeline
- [x] Add category-specific visual properties (size, animations)
- [x] Ensure cross-variant compatibility (Root & MPE)
- [x] Update enemy creation to use new sprite system

**Implementation Notes:**
- Files to modify: `script.js:69-81`, `03_main_script.js:200+`
- Requires sprite assets: 8 unique zombie types (64x64px with 4-frame walk cycles)
- Must maintain 60fps performance with 100+ concurrent enemies

---

### [P0-UI-002] ✅ COMPLETED: Implement Click-to-Complete Task Functionality with Checkbox Interface
**Component:** UI  
**Priority:** Critical  
**Estimate:** 5 points (2 weeks) - **COMPLETED**

**Description:**
Implement consistent task completion interface using checkbox toggles across Root and MPE variants to enable direct click-to-defeat enemy functionality.

**Acceptance Criteria:**
- [x] Add checkbox interface for task completion in MPE variant
- [x] Implement consistent click-to-complete behavior for enemy sprites
- [x] Add visual feedback for completable vs non-completable states
- [x] Ensure consistent behavior: direct enemy clicking to complete tasks
- [x] Update UI state management for completion tracking
- [x] Add completion indicators in both variants

**Implementation Notes:**
- Files to modify: `06_MPE_script.js`, UI state management systems
- Reference Root variant implementation for patterns
- Must maintain backward compatibility

---

### [P0-GAME-003] ✅ COMPLETED: Align Timeline Movement System Between Variants
**Component:** Game Engine  
**Priority:** Critical  
**Estimate:** 8 points (4 weeks) - **COMPLETED**

**Description:**
Implement sophisticated real-time timeline positioning in MPE variant to match Root variant's time-pressure mechanics.

**Acceptance Criteria:**
- [x] Replace basic interpolation with real-time positioning calculations
- [x] Implement timeline-based enemy movement from current time to 5pm deadline
- [x] Add urgency visualization (enemy acceleration as deadlines approach)
- [x] Ensure consistent movement behavior across variants
- [x] Maintain smooth 60fps animations
- [x] Add overdue item handling with base-jump mechanics

**Implementation Notes:**
- Reference Root variant timeline calculation logic
- Files to modify: `06_MPE_script.js` movement systems
- Performance critical: optimize for multiple concurrent enemies

---

## P1 - MAJOR (Core Feature Gaps)

### [P1-DATA-004] Implement Sub-task Hierarchy System
**Component:** Data Model  
**Priority:** High  
**Estimate:** 8 points (4 weeks)

**Description:**
Extend data model to support parent-child task relationships enabling complex project breakdown and hierarchical task management.

**Acceptance Criteria:**
- [ ] Extend createTaskItemData() to support parentId parameter
- [ ] Add subTasks array to task data structure
- [ ] Implement parent-child relationship cascade rules
- [ ] Create sub-task creation UI in task management forms
- [ ] Add sub-task visualization in enemy representation (proportional sizing)
- [ ] Implement deletion cascade (parent deletion removes children)
- [ ] Add due date inheritance logic for sub-tasks

**Implementation Notes:**
- Files to modify: `createTaskItemData()`, task management UI components
- Database schema changes required for persistent storage
- Impact on completion mechanics: sub-task completion affects parent

---

### [P1-DATA-005] Add Positive/Negative Habit Distinction
**Component:** Data Model  
**Priority:** High  
**Estimate:** 5 points (3 weeks)

**Description:**
Implement complete habit type system supporting both positive habits (to complete) and negative habits (to avoid) with distinct UI indicators and logic.

**Acceptance Criteria:**
- [ ] Add isNegative boolean field to habit data structure
- [ ] Extend habit creation forms with positive/negative toggle
- [ ] Implement distinct visual indicators for negative habits (red coloring)
- [ ] Add inverted completion logic for negative habits
- [ ] Update streak calculation for negative habit avoidance
- [ ] Ensure both variants support negative habits consistently

**Implementation Notes:**
- Files to modify: habit creation functions, habit management UI
- Existing MPE limitation: currently only supports positive habits
- UI impact: distinct styling and interaction patterns needed

---

### [P1-UI-006] Create Hero/Routine Visual System
**Component:** UI  
**Priority:** High  
**Estimate:** 8 points (4 weeks)

**Description:**
Implement visual representation of active routines as "Heroes" positioned at the base to provide strategic depth and visual gamification.

**Acceptance Criteria:**
- [ ] Create RoutineHeroManager class for hero positioning and rendering
- [ ] Add hero sprites/avatars for different routine types
- [ ] Implement hero positioning system at base area
- [ ] Add hero-enemy interaction visualization
- [ ] Display active routine status through hero appearance
- [ ] Create hero management UI for routine assignment
- [ ] Add hero level progression visual indicators

**Implementation Notes:**
- New visual system requiring hero sprite assets
- Files to modify: routine management systems, base rendering logic
- Must integrate with existing routine activation mechanics

---

### [P1-DATA-007] Standardize Points/Currency System
**Component:** Data Model  
**Priority:** High  
**Estimate:** 3 points (2 weeks)

**Description:**
Implement consistent dual-currency system (XP + Points) across both Root and MPE variants to enable economic mechanics.

**Acceptance Criteria:**
- [ ] Add points tracking to MPE variant (currently missing)
- [ ] Implement points calculation: 10 per task, 5 per habit
- [ ] Add points display to MPE variant UI
- [ ] Ensure consistent points earning across both variants
- [ ] Update completion functions to award both XP and points
- [ ] Add points persistence to local storage

**Implementation Notes:**
- MPE currently has "No Points System" - requires implementation from scratch
- Reference Root variant points mechanics
- Foundation for future shop/economy features

---

### [P1-UI-008] Implement Shop and Repair Kit System
**Component:** UI  
**Priority:** High  
**Estimate:** 13 points (6 weeks)

**Description:**
Build complete economic system with shop interface, repair kits, and currency management to enable strategic resource management.

**Acceptance Criteria:**
- [ ] Create shop modal/window with item categories
- [ ] Implement repair kit purchasing system (points-based)
- [ ] Add repair kit inventory management
- [ ] Create base healing mechanics using repair kits
- [ ] Add shop item categories: repair kits, power-ups, cosmetics
- [ ] Implement transaction validation and error handling
- [ ] Add shop accessibility from main game interface

**Implementation Notes:**
- Large feature requiring new UI systems and economic logic
- Depends on standardized points system (P1-DATA-007)
- Files to create: shop management system, inventory UI

---

## P2 - ENHANCEMENT (Polish & Optimization)

### [P2-UI-009] Add Streak Visual Effects System
**Component:** UI  
**Priority:** Medium  
**Estimate:** 5 points (3 weeks)

**Description:**
Implement visual feedback system for high-performing habits with fire effects and achievement animations.

**Acceptance Criteria:**
- [ ] Create fire effect animation system for high-streak habits
- [ ] Add threshold-based visual effects (3+ streak = fire effects)
- [ ] Implement particle system for visual enhancement
- [ ] Add streak achievement notifications
- [ ] Ensure performance optimization for multiple concurrent effects
- [ ] Add user preference toggle for visual effects intensity

**Implementation Notes:**
- Currently shows partial implementation at 38.1%
- Files to modify: habit visual rendering, animation systems
- Performance consideration: optimize for mobile devices

---

### [P2-GAME-010] Implement Enemy Acceleration Mechanics
**Component:** Game Engine  
**Priority:** Medium  
**Estimate:** 3 points (2 weeks)

**Description:**
Add urgency-based enemy acceleration as deadlines approach to enhance time pressure visualization.

**Acceptance Criteria:**
- [ ] Implement acceleration calculation based on time-to-deadline
- [ ] Add smooth animation transitions for speed changes
- [ ] Create urgency scaling algorithm (faster movement as deadline approaches)
- [ ] Add visual indicators for accelerated enemies (blur effects, speed lines)
- [ ] Ensure consistent acceleration across both variants
- [ ] Add configurable acceleration parameters

**Implementation Notes:**
- Enhancement to existing movement system
- Files to modify: enemy movement calculations, animation systems
- Must maintain smooth 60fps performance

---

### [P2-UI-011] Implement Management Window System Unification
**Component:** UI  
**Priority:** Medium  
**Estimate:** 8 points (4 weeks)

**Description:**
Standardize management interface patterns between Root (sophisticated modals) and MPE (basic forms) variants.

**Acceptance Criteria:**
- [ ] Implement modal system in MPE variant to match Root sophistication
- [ ] Create unified management window component architecture
- [ ] Add consistent modal behavior: backdrop click, ESC key closing
- [ ] Implement window stacking and focus management
- [ ] Add responsive modal sizing and positioning
- [ ] Ensure accessibility compliance (ARIA labels, keyboard navigation)

**Implementation Notes:**
- Large UI architecture change for MPE variant
- Files to modify: MPE UI management systems, modal components
- Reference Root variant modal patterns

---

### [P2-GAME-012] Add Base Healing System
**Component:** Game Engine  
**Priority:** Medium  
**Estimate:** 3 points (2 weeks)

**Description:**
Implement gradual base recovery mechanics to balance punitive overdue damage with positive reinforcement.

**Acceptance Criteria:**
- [ ] Add timer-based healing logic (1 HP per hour of no overdue items)
- [ ] Create healing rate configuration parameters
- [ ] Add visual feedback for base healing process
- [ ] Implement healing interruption on new overdue damage
- [ ] Add healing status indicator in UI
- [ ] Ensure healing persistence across game sessions

**Implementation Notes:**
- Currently shows 29.4% partial implementation
- Files to modify: game loop, base damage systems
- Enhancement to existing base damage mechanics

---

### [P2-UI-013] Implement Routine Transfer System
**Component:** UI  
**Priority:** Medium  
**Estimate:** 5 points (3 weeks)

**Description:**
Add advanced routine management with habit transfer capabilities and confirmation workflows.

**Acceptance Criteria:**
- [ ] Create habit transfer interface between routines
- [ ] Add drag-and-drop functionality for habit reassignment
- [ ] Implement transfer confirmation dialogs
- [ ] Add bulk habit transfer operations
- [ ] Create routine optimization suggestions based on habit performance
- [ ] Add transfer history tracking and undo functionality

**Implementation Notes:**
- Advanced routine management feature
- Files to modify: routine management UI, habit management systems
- Requires sophisticated drag-and-drop implementation

---

## DOCUMENTATION TICKETS

### [P2-DOCS-014] Create Visual Asset Specifications
**Component:** Docs  
**Priority:** Medium  
**Estimate:** 2 points (1 week)

**Description:**
Document detailed sprite sheet specifications and visual asset requirements for consistent implementation.

**Acceptance Criteria:**
- [ ] Create sprite sheet specification document (64x64px base, 32px animation frames)
- [ ] Document 8 zombie category designs with visual descriptions
- [ ] Add file format specifications (PNG with transparency)
- [ ] Create animation frame requirements (4-frame walk cycles)
- [ ] Document hero sprite requirements and positioning
- [ ] Add visual effect specifications (fire effects, particles)

---

### [P2-DOCS-015] Update Data Model Documentation
**Component:** Docs  
**Priority:** Medium  
**Estimate:** 2 points (1 week)

**Description:**
Document extended data structures and parent-child relationship schemas with cascade rules.

**Acceptance Criteria:**
- [ ] Document sub-task data model extensions
- [ ] Create parent-child relationship diagrams
- [ ] Document cascade rules (deletion, completion, due dates)
- [ ] Add negative habit data structure documentation
- [ ] Create routine-hero association documentation
- [ ] Update API documentation for extended functions

---

## IMPLEMENTATION SUMMARY

**Total Tickets:** 15 (3 completed ✅)  
**Remaining Story Points:** 62 points (~31 weeks estimated effort)  
**Critical Path Duration:** 6-10 weeks with parallel development

### Component Breakdown:
- **UI:** 8 tickets (53 points) - 58% of effort
- **Game Engine:** 3 tickets (14 points) - 15% of effort  
- **Data Model:** 3 tickets (16 points) - 18% of effort
- **Docs:** 2 tickets (4 points) - 4% of effort

### Priority Distribution:
- **P0 (Critical):** 3 tickets - Address immediately for core functionality
- **P1 (Major):** 5 tickets - Essential for specification compliance
- **P2 (Enhancement):** 7 tickets - Polish and optimization features

### Recommended Sprint Planning:
1. **Sprint 1-2:** P0 tickets (visual system, attack mode, timeline alignment)
2. **Sprint 3-4:** P1 data model extensions (sub-tasks, negative habits)
3. **Sprint 5-6:** P1 UI systems (heroes, points, shop foundation)
4. **Sprint 7-8:** P2 polish features and documentation

### Success Metrics:
- **Requirement Completion:** Target 85% by implementation completion
- **Code Coverage:** Maintain 80% for core game loop
- **Performance:** Sustain 60fps with 100+ concurrent enemies
- **Variant Consistency:** <5% functional differences between Root and MPE variants

---

**Status:** Ready for Development  
**Next Action:** Stakeholder review and resource allocation for P0 tickets
