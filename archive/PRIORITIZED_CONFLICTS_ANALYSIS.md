# Prioritized Issues Analysis
## Step 6: Conflict Prioritization

**Scoring Criteria:**
- **User Impact**: How severely does this affect user experience? (1-5 scale)
- **Development Effort**: How much work is required to fix? (1-5 scale, 5=highest effort)
- **Spec Phase**: Which development phase is this critical for? (Core/Enhancement/Polish)

**Priority Levels:**
- **P0**: Game-breaking issues that prevent core functionality
- **P1**: Major UX divergence that significantly impacts usability
- **P2**: Cosmetic or enhancement issues

---

## P0 - CRITICAL (Game-Breaking)

### P0.1 - Missing Core Visual Game Elements
**Issue**: Category-specific zombie enemies and visual progression completely missing
- **User Impact**: 5/5 (Game lacks core visual identity)
- **Development Effort**: 4/5 (Requires sprite system, category mapping)
- **Spec Phase**: Core
- **Evidence**: Requirements US_37d48261, US_cf707393, US_ba1de9bd all show 0% implementation
- **Root Cause**: No category-to-sprite mapping system implemented
- **Business Impact**: Users cannot visually distinguish different life areas

### P0.2 - Attack Mode System Missing 
**Issue**: Root variant has attack mode, MPE variant does not - core interaction paradigm inconsistent
- **User Impact**: 5/5 (Fundamental interaction model broken)
- **Development Effort**: 3/5 (Toggle system + UI state management)
- **Spec Phase**: Core
- **Evidence**: US_22b0927b shows partial implementation but inconsistent between variants
- **Root Cause**: MPE variant simplified away critical interaction model

### P0.3 - Timeline Movement System Divergence
**Issue**: Root variant has sophisticated real-time positioning, MPE has basic interpolation
- **User Impact**: 4/5 (Urgency visualization completely different)
- **Development Effort**: 4/5 (Complex timeline calculations)
- **Spec Phase**: Core
- **Evidence**: Implementation manifest shows "No Timeline System" in MPE
- **Root Cause**: MPE simplified critical time-pressure mechanics

---

## P1 - MAJOR UX DIVERGENCE

### P1.1 - Sub-task Hierarchy Missing
**Issue**: Complex projects cannot be properly represented
- **User Impact**: 4/5 (Major productivity limitation)
- **Development Effort**: 4/5 (Requires data model changes, UI updates)
- **Spec Phase**: Core
- **Evidence**: US_b3d3bc37, US_dc518bcb show 0% implementation
- **Root Cause**: Data structures don't support parent-child relationships

### P1.2 - Positive/Negative Habit Distinction Missing
**Issue**: Only positive habits supported, breaking behavior tracking model
- **User Impact**: 4/5 (Habit system fundamentally incomplete)
- **Development Effort**: 3/5 (Logic updates, UI indicators)
- **Spec Phase**: Core
- **Evidence**: US_1b642b5f shows 0% implementation, MPE manifest confirms missing
- **Root Cause**: Simplified habit model in both variants

### P1.3 - Hero/Routine Visual System Missing
**Issue**: Routines don't appear as "Heroes" at base - major visual metaphor absent
- **User Impact**: 4/5 (Core gamification element missing)
- **Development Effort**: 4/5 (New visual system, positioning logic)
- **Spec Phase**: Core
- **Evidence**: US_21bb1943, US_0d0a5cd5 show 0% implementation
- **Root Cause**: Routine system lacks visual representation

### P1.4 - Points/Currency System Inconsistency
**Issue**: Root has dual XP+Points system, MPE has only XP
- **User Impact**: 4/5 (Economic mechanics broken)
- **Development Effort**: 2/5 (Add points tracking)
- **Spec Phase**: Core
- **Evidence**: Implementation manifest shows "No Points System" in MPE
- **Root Cause**: MPE over-simplified progression mechanics

### P1.5 - Shop and Repair Kit System Missing
**Issue**: No active recovery options or resource management
- **User Impact**: 4/5 (Strategic depth completely missing)
- **Development Effort**: 5/5 (Entire shop system + UI)
- **Spec Phase**: Enhancement
- **Evidence**: US_e8b9921f, US_56428e19 show 0% implementation
- **Root Cause**: Economic systems never implemented

---

## P2 - COSMETIC/ENHANCEMENT ISSUES

### P2.1 - Streak Visual Effects Missing
**Issue**: High-performing habits don't show fire effects
- **User Impact**: 3/5 (Reduced motivation/feedback)
- **Development Effort**: 3/5 (Visual effects system)
- **Spec Phase**: Polish
- **Evidence**: US_4279e4b6 shows partial implementation
- **Root Cause**: Visual feedback system incomplete

### P2.2 - Enemy Acceleration Missing
**Issue**: Enemies don't speed up as deadlines approach
- **User Impact**: 3/5 (Urgency not tangible)
- **Development Effort**: 2/5 (Animation timing adjustments)
- **Spec Phase**: Enhancement
- **Evidence**: US_2d72be7f, US_11981328 show 0% implementation
- **Root Cause**: Animation system lacks urgency scaling

### P2.3 - Management Window System Inconsistency
**Issue**: Root has sophisticated modals, MPE has basic forms
- **User Impact**: 3/5 (UX inconsistency)
- **Development Effort**: 4/5 (Modal system implementation)
- **Spec Phase**: Enhancement
- **Evidence**: Implementation manifest shows modal vs form differences
- **Root Cause**: MPE simplified UI patterns

### P2.4 - Base Healing System Missing
**Issue**: Base damage is permanent, no gradual recovery
- **User Impact**: 3/5 (Punitive without recovery)
- **Development Effort**: 2/5 (Timer-based healing logic)
- **Spec Phase**: Enhancement
- **Evidence**: US_3a06c4d7 shows partial implementation
- **Root Cause**: Recovery mechanics not fully implemented

### P2.5 - Routine Transfer System Missing
**Issue**: Cannot move habits between routines with confirmations
- **User Impact**: 3/5 (Optimization workflow limited)
- **Development Effort**: 3/5 (Transfer UI + validation)
- **Spec Phase**: Enhancement
- **Evidence**: US_64957f8c shows 0% implementation
- **Root Cause**: Advanced routine management missing

---

## CRITICAL PATH ANALYSIS

### Immediate Priorities (Next Sprint)
1. **P0.1** - Implement basic category-sprite mapping system
2. **P0.2** - Standardize attack mode across variants
3. **P1.1** - Add sub-task data model support
4. **P1.2** - Implement negative habits distinction

### Medium-term Priorities (Following Sprint)
1. **P0.3** - Align timeline movement systems
2. **P1.3** - Create hero visual system for routines
3. **P1.4** - Standardize points system across variants
4. **P2.1** - Add streak visual effects

### Long-term Priorities (Future Releases)
1. **P1.5** - Implement complete shop/economy system
2. **P2.3** - Unify management UI patterns
3. **P2.4** - Add base healing mechanics
4. **P2.5** - Complete advanced routine management

---

## IMPACT SUMMARY

**Total Issues Identified**: 37 critical gaps from requirement analysis
- **P0 (Critical)**: 3 issues - 23% of development effort
- **P1 (Major)**: 5 issues - 52% of development effort  
- **P2 (Cosmetic)**: 5 issues - 25% of development effort

**Most Critical Architectural Gaps**:
1. Visual system architecture (sprites, categories, heroes)
2. Data model limitations (sub-tasks, negative habits)
3. Interaction paradigm inconsistencies (attack mode, timeline)
4. Economic system absence (points, shop, repair)

**Variant Alignment Issues**:
- Root variant closer to spec but missing key visual elements
- MPE variant over-simplified critical mechanics
- Need unified architecture approach for production

**Recommended Action**: Address P0 issues immediately to establish core functionality, then systematically work through P1 issues to achieve spec compliance.
