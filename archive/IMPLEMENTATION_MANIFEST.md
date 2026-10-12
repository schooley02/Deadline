# Implementation Manifest: Deadline Tower Defense Game

## Overview
This document maps the current implementation of two codebase variants of the Deadline productivity tower defense game:
- **Root Variant**: Advanced version with sophisticated UI and full feature set
- **Deadline-MPE Variant**: Minimal Playable Example with simplified features

---

## Root Variant Implementation

### UI Elements Rendered

#### Main Layout Structure
- **App Container**: Central container with responsive layout (90% width, max 700px)
- **Game Section** (60% height):
  - **Stats Overlay**: Always-visible player dashboard
    - Base Health display
    - XP display  
    - Level display
    - Points display
  - **Attack Button**: Toggle for attack mode (⚔️)
  - **Game Screen**: Canvas area with Church base
  - **Level Up Message**: Animated overlay
  - **Game Over Message**: Animated overlay

#### Task Management Section (40% height)
- **Task Header**: "Today's Deadlines" with task counter
- **Scrollable Task List**: Active items display
- **Floating Action Button (FAB)**: Plus button for quick actions
  - **FAB Menu**: Expandable options (Tasks, Habits, Routines)

#### Management Windows (Modal/Overlay)
- **Tasks Window**: Add new tasks, view active tasks
- **Habits Window**: Add new habits, view defined habits  
- **Routines Window**: Comprehensive routine management

#### Forms (Modal)
- **Task Form**: Name, category, priority, due date/time
- **Habit Form**: Name, category, frequency, time window, positive/negative type
- **Routine Form**: Create and manage routine collections

### Global Constants

#### Game Configuration
```javascript
const GAME_TICK_MS = 50;                    // Game loop frequency
const DAY_DURATION_MS = 60000;              // Virtual day length
const OVERDUE_DAMAGE = 1;                   // Base damage per overdue item
const DAMAGE_INTERVAL_MS = 5 * 60 * 1000;   // Damage frequency
const XP_PER_TASK_DEFEAT = 10;              // Task completion XP
const XP_PER_HABIT_COMPLETE = 5;            // Habit completion XP
const POINTS_PER_TASK = 10;                 // Task completion points
const POINTS_PER_HABIT = 5;                 // Habit completion points
const HABIT_STREAK_BONUS_THRESHOLD = 3;     // Streak bonus trigger
```

#### Progression System
```javascript
const LEVEL_XP_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000];
const ROUTINE_SLOTS_PER_LEVEL = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4 };
const MAX_PLAYER_LEVEL = 8;
```

#### Category Styles
```javascript
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
```

### Game Loop Logic

#### Main Update Cycle
1. **updateGame()**: Called every 50ms
2. **updateActiveItems()**: Updates enemy positions and overdue status
3. **Timeline Position Calculation**: Real-time positioning from current time to 5pm deadline
4. **Damage Processing**: Handles overdue item base damage
5. **Base Visual Updates**: Dynamic base imagery based on health

#### Enemy Movement System
- **Timeline-based positioning**: Enemies move from right to left based on time remaining until due
- **Overdue handling**: Items jump to base when past due time
- **Visual feedback**: Red pulsing for overdue items

### Data Models

#### Task Data Structure
```javascript
{
    id: number,
    type: 'task',
    name: string,
    category: string,
    isHighPriority: boolean,
    dueDateTime: Date,
    creationTime: Date,
    timeToDueAtCreationMs: number,
    x: number,
    isOverdue: boolean,
    lastDamageTickTime: number,
    element: HTMLElement,
    listItemElement: HTMLElement
}
```

#### Habit Data Structure
```javascript
// Habit Definition
{
    id: string,
    name: string,
    category: string,
    frequency: 'daily',
    timeOfDay: 'anytime'|'morning'|'afternoon'|'evening',
    isNegative: boolean,
    streak: number,
    lastCompletionDate: Date
}

// Habit Instance
{
    id: number,
    type: 'habit',
    definitionId: string,
    name: string,
    category: string,
    dueDateTime: Date,
    streak: number,
    isNegative: boolean,
    originalDueDate: Date,
    // ... plus standard item properties
}
```

#### Routine Data Structure
```javascript
{
    id: string,
    name: string,
    habitDefinitionIds: string[],
    taskDefinitionIds: string[],
    isActive: boolean
}
```

### Public Functions

#### Game Management
- `initGame()`: Initialize/restart game state
- `updateGame()`: Main game loop function
- `gameOver()`: Handle game end state
- `damageBase(amount)`: Apply damage to base
- `checkPlayerLevelUp()`: Handle level progression

#### Item Management
- `createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr)`
- `addItemToGame(itemData)`: Add item to active game
- `completeItem(itemId)`: Mark item as completed
- `removeItem(itemId)`: Remove item from game
- `markAsOverdue(item, currentTime)`: Handle overdue items

#### Habit System
- `createHabitDefinition(name, category, frequency, timeOfDay, isNegative)`
- `generateDailyHabitInstances(forWhichGameDay)`: Create daily habit instances
- `getHabitInstanceDueTime(timeOfDayString, referenceDate)`: Calculate habit due times

#### Routine System
- `createRoutineDefinition()`: Create new routine
- `toggleRoutineActive(routineId)`: Activate/deactivate routines
- `addHabitToRoutine(routineId, habitDefId)`: Add habit to routine
- `removeHabitFromRoutine(routineId, habitDefId)`: Remove habit from routine

#### UI Management
- `showFormModal(formType)`: Display creation forms
- `openManagementWindow(type)`: Open management windows
- `closeAllManagementWindows()`: Close all management windows
- `updatePlayerDisplays()`: Update player stat displays

### Runtime Behavior Observations

#### Task Creation & Management
- Tasks appear as enemies moving from right to left
- High-priority tasks have yellow glow and star indicator
- Overdue tasks jump to base and cause periodic damage
- Tasks can be completed by clicking (in attack mode) or via list buttons

#### Enemy Movement & Timeline
- Real-time position calculation based on current time to 5pm deadline
- Smooth movement from creation to due time
- Different enemy sizes for tasks (60px) vs habits (50px)
- Category-based color coding and zombie emojis

#### Base Damage & Visuals
- Base health: 100 → 0
- Dynamic base imagery: base_100.png → base_000.png
- Flash effect on damage
- Game over at 0 health

#### Level Progression
- XP gain: 10 per task, 5 per habit (with streak bonuses)
- Animated level-up messages
- Routine slots unlock with levels
- 8 maximum levels with increasing XP requirements

---

## Deadline-MPE Variant Implementation

### UI Elements Rendered

#### Simplified Layout
- **Header Info**: Game title, basic player stats (health, XP, level, routine slots)
- **Game Screen**: Simple game area with church base
- **Task List Container**: "Today's Deadlines" with active items
- **Input Controls**: Tabbed interface for forms
- **Debug Controls**: Development helpers

#### Form Interface
- **Form Toggle Buttons**: Add Task / Add Habit / Manage Routines
- **Task Form**: Basic task creation (name, category, priority, due date/time)
- **Habit Form**: Basic habit creation (name, category, frequency, time window)
- **Routine Form**: Simple routine management

### Global Constants (Differences from Root)

```javascript
const HABIT_STREAK_BONUS_THRESHOLD = 1;     // Lower threshold for testing
// Note: Missing POINTS system entirely
```

### Game Loop Logic (Simplified)

#### Core Differences
- **No Timeline System**: Enemies move based on elapsed time vs total time to due
- **Simplified Positioning**: Linear interpolation from creation to due time
- **No Attack Mode**: Direct clicking always works
- **Basic Visual Feedback**: Simpler animations and effects

### Data Models (Simplified)

#### Missing Features
- **No Points System**: Only XP tracking
- **No Negative Habits**: Only positive habit support
- **No Task Definitions**: Only routine habits supported
- **Simpler Routine Model**: Only habit collections, no tasks

### Public Functions (Reduced Set)

#### Missing Functionality
- No modal system
- No management windows
- No floating action button
- No comprehensive routine management
- No attack mode toggle

### Runtime Behavior Observations

#### Simplified Interactions
- Direct form interface instead of modals
- Single-click enemy defeat (no attack mode)
- Tabbed form switching
- Basic routine creation and habit assignment

#### Debug Features
- **Advance Day Button**: Simulate day progression
- **Reset Habit Streaks**: Clear all habit progress
- **Damage Base Button**: Manual base damage for testing

#### Visual Differences
- Fixed stats header vs overlay stats
- List-based layout vs sophisticated UI components
- No floating elements or advanced animations
- Simplified enemy sprites and effects

---

## Comparative Analysis

### Feature Completeness

| Feature | Root Variant | MPE Variant | Notes |
|---------|--------------|-------------|-------|
| Task Management | ✅ Full | ✅ Basic | Root has modal forms, advanced UI |
| Habit System | ✅ Full | ✅ Basic | Root has positive/negative habits |
| Routine System | ✅ Advanced | ✅ Basic | Root supports tasks in routines |
| Points System | ✅ Yes | ❌ No | Root has XP + points dual currency |
| Attack Mode | ✅ Yes | ❌ No | Root has toggle-based combat |
| Timeline System | ✅ Advanced | ❌ No | Root has real-time positioning |
| UI Sophistication | ✅ High | ✅ Low | Root has modals, FAB, animations |
| Management Windows | ✅ Yes | ❌ No | Root has dedicated management UI |

### Code Architecture Differences

#### Root Variant Strengths
- Modular modal system
- Sophisticated UI state management
- Timeline-based real-time calculations
- Comprehensive window management system
- Advanced visual feedback and animations

#### MPE Variant Strengths
- Simpler codebase for understanding
- Direct debugging capabilities
- Straightforward form switching
- Minimal dependencies
- Easier to modify and experiment

### Performance Characteristics

#### Root Variant
- More complex DOM manipulation
- Advanced CSS animations and effects
- Real-time position calculations
- Modal overlay management

#### MPE Variant  
- Lighter DOM structure
- Simpler CSS styling
- Basic position interpolation
- Direct element manipulation

---

## Conclusion

The Root variant represents a production-ready implementation with sophisticated UI patterns, comprehensive feature sets, and polished user experience. The Deadline-MPE variant serves as an educational and experimental platform with simplified mechanics that maintain the core game loop while reducing complexity.

Both variants successfully implement the core tower defense productivity concept, with the Root variant offering depth and polish while the MPE variant provides accessibility and clarity for development and learning purposes.
