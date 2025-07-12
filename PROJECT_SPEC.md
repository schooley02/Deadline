Deadline App - Project Specification
Elevator Pitch
Deadline transforms productivity into an addictive tower-defense game where your tasks and habits become zombie enemies marching toward your sacred base. Miss deadlines and watch your church crumble—complete them and level up your defenses. It's productivity gaming that makes procrastination impossible.
Problem Statement
Traditional productivity apps fail because they lack emotional engagement and immediate consequences. Users abandon task lists when motivation wanes, leading to guilt cycles and decreased productivity. People need visceral, visual feedback that makes incomplete tasks feel urgent and completed tasks feel rewarding.
Target Audience
Primary: Productivity enthusiasts and gamers (ages 18-35) who struggle with motivation and consistency Secondary: Students, remote workers, and habit-building enthusiasts who want visual progress tracking
USP
The only productivity app that creates genuine emotional stakes through base destruction—where your procrastination literally crumbles your virtual world, making task completion feel heroic rather than mundane.
Target Platforms
* Phase 1: Web-first approach with mobile optimization
* Phase 2: Native mobile apps (iOS/Android) for enhanced notifications
* Phase 3: Cross-platform sync and desktop optimization
Features List
Core Gamification Engine
* As a user, I can see my tasks and habits represented as category-specific zombie enemies advancing toward my country church base so that different areas of life are visually distinct
* As a user, I can watch enemies accelerate as deadlines approach so that urgency feels tangible and increasing
* As a user, I can "defeat" enemies by clicking Attack button then clicking the enemy so that task completion provides immediate satisfaction
* Enemy movement speed correlates with time remaining until deadline with visual intensity increasing (glowing, faster animations)
* Base health depletes when overdue tasks/habits reach the base (1 HP every 5 minutes for first hour)
* Base visual states: Pristine → Weathered → Damaged → Smoking → Engulfed in Flames → Destroyed
* Base shakes with animated hits when taking damage
* Up to 20 enemies visible on screen with horizontal scrolling for additional enemies
* Isometric view with y-axis spreading for overlapping deadline zombies
* Explosion effects and particle systems for enemy defeats
* Offline catch-up: paused zombies animate quickly (max 5 seconds) to current time position when app reopens
Task Management System
* As a user, I can create tasks with names, due dates, and specific due times so that I can organize my responsibilities
* As a user, I can assign tasks to categories which determine zombie appearance so that different life areas are visually recognizable
   * Career: Zombie in business suit with briefcase
   * Creativity: Zombie dressed as artist
   * Financial: Zombie that looks wealthy
   * Health: Zombie dressed like nurse
   * Lifestyle: Generic stylish zombie
   * Relationships: Well-dressed zombie with present
   * Spirituality: Zombie nun
   * Other: Standard zombie
* As a user, I can mark tasks as High Priority so they receive bright glowing outlines for emphasis
* As a user, I can create sub-tasks that make parent tasks appear larger so complex projects are properly represented
* Sub-tasks shrink parent enemy size as they're completed
* Sub-task due dates are dependent on parent task due date for simplified scheduling
* Tasks generate XP and points/currency when completed with explosion animations
* Larger/more complex tasks award more points based on difficulty
Habit System & Streak Mechanics
* As a user, I can define habits with names, categories, and flexible scheduling so that I can track various behavioral patterns
   * Daily habits (every day)
   * Variable frequency habits (every other day, 3x per week, etc.)
   * Specific day habits (Monday/Wednesday/Friday, weekends only, etc.)
   * Time-of-day windows (Morning, Afternoon, Evening, Anytime)
* As a user, I can distinguish between Positive habits (complete to earn points) and Negative habits (avoid to earn points) so that I can track both building and breaking behaviors
* As a user, I can see habit instances as smaller enemies compared to tasks so they're visually distinct
* As a user, I can build streaks by consistently completing positive habits so that consistency feels rewarding
* High-streak habits appear "on fire" with special visual effects
* High-streak habits have higher chance of earning double points when completed
* Completing negative habits or missing positive habits removes points (can go negative)
* Negative habit streaks of 3+ days freeze associated routine slots until habit modification or 3-day avoidance streak
* Frozen routine slot recovery requires either habit detail edits (any change counts, with detailed change tracking) or successfully avoiding negative habit completion for 3 consecutive days while habit remains active
* Frozen routine slots appear greyed out with user notifications explaining freeze status and recovery options
* Frozen routines remain viewable to help users identify needed adjustments
* Daily check-in prompts (morning or first login) ask individual confirmations for each incomplete negative habit for avoidance streak validation
* Habit modification history tracked with timestamps, old vs. new values, and optional user notes for impact measurement and reflection
* Time-of-day completion tracking to identify behavioral patterns
* Intelligent scheduling automatically generates appropriate habit instances
Routine System (Heroes)
* As a user, I can create named routines that appear as "Heroes" stationed at my base so that routine completion feels like summoning allies
* As a user, I can add existing habits to routines or create new habits directly within routine management so that setup is streamlined
* As a user, I can assign habits to only one routine at a time so that accountability and tracking remain clear
* As a user, I can transfer habits directly between routines with confirmation prompts so that routine optimization is streamlined while preventing accidental moves
* As a user, I can name and save multiple routine configurations so that I can experiment with different approaches within a single run
* As a user, I can swap between different saved routine configurations during a run so that I can adapt and optimize my approach dynamically
* As a user, I can manage routines through a dedicated library screen with category sorting so that routine organization scales with complexity
* Routines start at level 1 with 1 habit slot and 1 task slot, unlocking more slots as they gain experience
* Routines gain experience when their associated tasks/habits are completed
* Routines have health that gets damaged when enemies breach the base after 1 hour of continuous damage
* Users can activate/deactivate routines for vacation or seasonal use
* Routine performance tracking for optimization and A/B testing
* Heroes are purely visual representations of routine progress (no active base defense)
* Hero visual progression: different outfits and star ratings based on routine completion rates since routine creation within current run:
   * 1 star: 60% completion rate
   * 2 stars: 70% completion rate
   * 3 stars: 80% completion rate
   * 4 stars: 90% completion rate
   * 5 stars: 95%+ completion rate
* Real-time completion percentage display with notifications when star rating thresholds are crossed
* New runs reset routine completion rates and streaks for fresh evaluation
* Multiple named routine configurations can be tested and swapped within single runs
* Routine names have character limits for consistency
* Heroes positioned both integrated into base structure and around perimeter behind fence
* Fence represents the actual "Deadline" boundary (purely visual indicator) that enemies must cross
Base Health & Recovery System
* As a user, I want my base to heal gradually over time so that minor setbacks don't feel permanent
* As a user, I want to purchase repair kits with my points so that I have active recovery options
* As a user, I want a midnight deadline when my base hits zero so that base destruction has stakes but recovery is possible
* Base starts each run with 100 hit points maximum
* Gradual healing: 1 health point every 5 minutes (constant rate)
* Gradual healing mechanic disabled when base health reaches zero
* Base destruction triggers "emergency mode" until midnight deadline
* Emergency mode: dramatic red overlay, urgent music, prominent midnight countdown timer
* During emergency mode, zombies advance but cannot cause additional damage until base has health to damage
* Manual repair via repair kits required to re-enable gradual healing after base destruction (minimum 25 health points)
Player Progression & Currency System
* As a user, I earn XP and points/currency for completing tasks and habits so that productivity feels like character development
* As a user, I can level up and unlock additional routine slots for my base so that advancement brings tangible benefits
* As a user, I can spend points/currency in the shop so that I have strategic resource management options
* XP determines routine slot unlocks (persists through base destruction)
* Points/currency earned from task/habit completion (larger tasks = more points)
* Points persist through base destruction for strategic resource banking (can go negative)
* Repair kit tiers: 25, 50, and 100 health points restored
* Shop items with exponential pricing based on inventory (base cost × 1.5^quantity):
   * Repair kits: 25/50/100 points base cost (instant health restoration)
   * Enemy Pushback tokens: 50/100/300 points base cost (1hr/2hr/1day durations) - unlimited stacking allowed
   * Habit Cheat Day tokens: 200 points base cost (1 day coverage for negative habit indulgence)
   * Sick Day tokens: 200 points base cost (1 day coverage for habit suspension)
   * Skip Day tokens: 200 points base cost (1 day coverage for temporary habit pause)
* Unlimited exponential scaling encourages routine optimization over token dependency
* Base token costs designed for weekly affordability with exponential scaling for challenge maintenance
* Achievement system for milestone celebrations
* Level-up animations and sound effects
Run-Based Gameplay
* As a user, I can start new runs when my base is destroyed so that failure feels like a fresh start rather than permanent loss
* As a user, I can review what went wrong in failed runs so that I can make improvements
* As a user, I can start new runs with the same active tasks, habits, and routines so that core productivity systems remain intact
* Run history tracking with performance analytics
* Base destruction ends current run at midnight deadline
* XP and routine slots carry over between runs
* Tasks, habits, and routines remain active between runs
UX/UI Considerations
* Main Game Screen: Top 60% tower-defense canvas with country church base and advancing zombie enemies
* Dynamic Task List: Bottom 40% scrollable list sorted by proximity to base with edit icons
* Time Slider: 24-hour slider at canvas/list boundary showing current time with fast-forward/rewind enemy position preview (preview only, no actual time manipulation)
* Time Scale Options: Today/This Week/This Month view modes
* Floating Plus Button: Bottom-left corner for adding tasks/routines, switching views, accessing inventory/store
* Attack Mode: Click attack button, then click enemy to defeat with undo functionality via recently defeated enemies list
* Shop Interface: Repair kit and token purchasing with clear point costs and effects
* Player Stats Dashboard: Always-visible health, XP, level, points balance, and routine slots
* Smooth transitions between all game states
* Particle effects for task completion and base damage
* Color-coded urgency system (green → yellow → red → critical → emergency)
* Haptic feedback for critical events (base damage, level up, emergency mode)
* Pixel art/cartoonish aesthetic with playful, encouraging tone
* Visual feedback: screen shake, explosion animations, level-up celebrations
Non-Functional Requirements
* Performance: 60fps gameplay with smooth enemy movement and animations during peak loads
* Real-time Progression: Game continues advancing when app is closed with enemies moving and base taking damage based on actual time passage
* Scalability: Support for 100+ concurrent active tasks/habits without performance degradation
* Storage: Local data storage with timestamp tracking for offline progression calculations
* Accessibility: Mobile-responsive design, touch-friendly controls, clear visual hierarchy, VoiceOver support
* Cross-Platform: Web-first with mobile optimization, future native app support
Monetization
Freemium Model:
* Free tier: Core functionality, limited routine slots, standard features
* Premium tier: Unlimited routine slots, premium zombie skins, advanced analytics, cloud sync, exclusive tokens
In-App Purchases:
* Token bundles (Pushback, Cheat Day, Sick Day, Skip Day tokens)
* Cosmetic upgrades (base themes, enemy skins, particle effects)
* Seasonal content and exclusive achievements
Development Phases
Phase 1: Minimum Playable Experience (MPE)
* Basic game canvas with country church base
* Generic zombie enemies that move based on due dates
* Simple task input (name, due date, due time)
* Click-to-defeat enemy mechanics
* Basic base health system with game over state
Phase 2: Enhanced MVP
* Category-specific zombie visuals
* Priority system with visual cues
* Basic XP and currency system
* Habit system with positive/negative mechanics
* Visual base degradation states
* Sub-task functionality
Phase 3: Full Feature Set
* Complete routine system with heroes
* Time slider and advanced UI
* Token store and progression system
* Achievement system and run analytics
* Visual polish and animations
Complete Project Specification Summary
This specification outlines a sophisticated gamified productivity application that transforms task management and habit building into an engaging tower-defense experience. The system uses behavioral psychology principles to create genuine motivation through visual consequences (base degradation), progressive rewards (hero advancement), and self-correcting mechanisms (exponential token pricing).
Core Innovation: Unlike traditional productivity apps, Deadline creates emotional stakes through base destruction while providing clear recovery paths, making procrastination feel genuinely consequential and task completion feel heroic.
Key Behavioral Mechanics:
* Run-based progression with meaningful persistence (XP/routine slots) and fresh starts (completion rates)
* Exponential token pricing that naturally guides users toward routine optimization over quick fixes
* Frozen routine slots for negative habit patterns with dual recovery paths (modification or avoidance)
* Real-time feedback through completion percentages and star rating notifications
Technical Implementation Ready: All major systems, user flows, progression mechanics, and behavioral triggers are defined with sufficient detail for development planning.
Next Steps for Implementation
1. Phase 1 MVP: Basic game canvas, generic zombies, simple task management, click-to-defeat mechanics
2. Phase 2 Enhancement: Category-specific visuals, habit system, XP/currency, visual base states
3. Phase 3 Full Feature: Complete routine system, token shop, advanced UI, analytics and polish


High Level Overview
Features (MVP)
Core Game Engine & Rendering
Real-time tower defense gameplay with zombie enemies advancing toward a base, featuring smooth 60fps animations, particle effects, and responsive click-to-defeat mechanics. Uses hybrid Canvas/DOM approach with simple viewport culling for optimal performance.
Tech Involved
* Single HTML file with embedded CSS/JS for Claude Code simplicity
* HTML5 Canvas for game world rendering with responsive scaling
* DOM elements for UI overlays and controls
* JavaScript ES6 modules organized by feature
* Web Audio API for sound effects
* Unified Pointer Events API for cross-platform input
Main Requirements
* 60fps performance with simple bounding box viewport culling
* Object pooling for sprites and particles
* Mobile-responsive canvas scaling for common screen sizes
* Loading screen during asset preload phase
* Hybrid rendering: Canvas for game world, DOM for UI elements
* Simple spatial optimization for enemy management
* Unified touch/mouse interaction handling
Task & Habit Management System
Complete CRUD operations for tasks and habits with category assignment, priority levels, sub-task hierarchies, and flexible scheduling patterns. Uses minimal custom state store with get/set/subscribe API.
Tech Involved
* Lightweight custom state store (get/set/subscribe only)
* Event emitter system for reactive updates
* Native JavaScript Date objects with utility functions
* Simple JSON validation for data integrity
* Feature-based code organization (tasks/, habits/, routines/)
Main Requirements
* Complex scheduling algorithms for habit instance generation
* Parent-child relationships for tasks and sub-tasks
* Real-time deadline calculations with simple optimization
* Category-based sprite asset mapping with preloading
* Streak tracking and completion rate calculations
* Automatic state backup every 5 minutes with recovery
Progression & Currency System
XP tracking, level progression, point economy with exponential pricing, and shop functionality. Includes achievement tracking and run-based progression with selective data persistence.
Tech Involved
* Centralized progression state management
* Mathematical calculation engines with basic caching
* Event-driven achievement system
* Simple versioned LocalStorage (version number + reset on breaking changes)
* Basic performance monitoring (FPS, memory, enemy count)
Main Requirements
* Complex pricing algorithms (base cost × 1.5^quantity) with caching
* XP calculation based on task complexity and streaks
* Achievement trigger detection and notification system
* Run-based data reset with selective persistence
* Real-time balance tracking including negative values
* 5-minute interval state backups with user notification on recovery
Time Management & Offline Progression
Real-time progression system with 3-day maximum offline duration, featuring client-side catch-up calculations and 5-second animation sequences.
Tech Involved
* Client-side timestamp tracking and calculation
* Mathematical progression algorithms
* Animation interpolation systems
* Focus/blur event handling for tab synchronization
* Memory-threshold-based garbage collection (simple approach)
Main Requirements
* Maximum 3-day offline progression support
* Client-side catch-up calculations on app open
* Complex progression logic for all game systems
* 5-second maximum catch-up animation constraint
* Focus-based cross-tab state refresh
* Garbage collection triggered when enemy count exceeds 150
Debug & Development Tools
Comprehensive debugging system integrated into UI with toggleable debug panel (keyboard shortcut) for testing time-dependent features and state manipulation.
Tech Involved
* Toggleable debug UI panel (keyboard shortcut: 'D' key)
* State manipulation utilities
* Time simulation controls
* Simple performance monitoring (FPS, memory usage, enemy count)
* Memory cleanup triggers
Main Requirements
* Toggleable debug panel with keyboard shortcut
* Game state reset and export functionality
* Day/time advancement simulation
* Manual completion rate and streak adjustment
* Real-time performance metrics (FPS, memory, enemies)
* Manual garbage collection trigger
System Diagram## Development Implementation Plan
File Structure (Single HTML Approach)
* deadline-app/
* ├── index.html (Contains all code)
* ├── assets/
* │   ├── sprites/
* │   │   ├── zombies/
* │   │   ├── heroes/
* │   │   └── effects/
* │   └── audio/
* └── README.md


Code Organization Within index.html
* <!DOCTYPE html>
* <html>
* <head>
*     <!-- Responsive meta tags and CSS -->
* </head>
* <body>
*     <!-- Game UI structure -->
*     
*     <script type="module">
*         // Feature modules organized as inline classes
*         class TaskSystem { /* tasks logic */ }
*         class HabitSystem { /* habits logic */ }
*         class RoutineSystem { /* routines logic */ }
*         class GameEngine { /* core game logic */ }
*         class StateStore { /* simple get/set/subscribe */ }
*         
*         // Main app initialization
*         class DeadlineApp { /* app orchestration */ }
*         new DeadlineApp().init();
*     </script>
* </body>
* </html>


State Store API Design
* class StateStore {
*     get(key) { /* return value */ }
*     set(key, value) { /* set and notify */ }
*     subscribe(key, callback) { /* listen for changes */ }
*     backup() { /* create checkpoint */ }
*     restore() { /* load last checkpoint */ }
* }


Performance Monitoring Metrics
* FPS: Frame rate tracking with 1-second averages
* Memory: Estimated object count (enemies, particles, UI elements)
* Enemy Count: Active enemies on screen vs total enemies
* Render Time: Canvas draw time per frame
Mobile Responsive Strategy
* Canvas Scaling: Dynamic sizing based on viewport with maintained aspect ratio
* Touch Targets: Minimum 44px touch targets for mobile
* Viewport Settings: viewport meta tag for proper mobile scaling
* Common Breakpoints:
   * Mobile: 320px - 768px
   * Tablet: 768px - 1024px
   * Desktop: 1024px+
Error Recovery & State Management
* Auto Backup: Every 5 minutes with user notification on recovery
* Version Detection: Simple version number check, reset on mismatch
* Graceful Degradation: Fallback to default state if corruption detected
* User Notification: Clear messaging when state recovery occurs
Debug Panel Features (Toggle with 'D' Key)
* Time Controls: Skip 1 hour, 1 day, advance to midnight
* State Management: Reset game, export/import data
* Performance Metrics: Real-time FPS, memory usage, enemy count
* Manual Triggers: Force garbage collection, create test enemies
* Completion Simulation: Set habit streaks, adjust completion rates
This architecture prioritizes simplicity and Claude Code compatibility while maintaining the sophisticated gameplay mechanics. The single-file approach makes iteration easier, while the modular class structure keeps code organized and maintainable.


Feature Stories
Features List
Core Gamification Engine
Visual Game World
* As a productivity enthusiast, I want to see my tasks as zombie enemies so that my to-do list feels engaging rather than overwhelming
* As a gamer, I want category-specific zombie appearances so that I can instantly recognize different life areas
* As a visual learner, I want enemies to accelerate and glow as deadlines approach so that urgency feels tangible
UX/UI Considerations
Core Experience
* Initial Loading State: Smooth fade-in revealing the isometric church base with gentle ambient lighting, establishing peaceful starting atmosphere
* Enemy Spawning Animation: Zombies emerge from screen edge with subtle ground-shake effect, category-specific spawn animations (business zombie straightens tie, artist zombie picks up paintbrush)
* Movement Choreography: Physics-based acceleration curves with enemies starting slow and smoothly ramping to urgent speeds, visual intensity scaling through subtle glow effects and faster walk cycles
* Deadline Urgency System: Color temperature shift from cool blues/greens to warm oranges/reds as enemies approach, pulsing glow effects with increasing frequency
* Visual Hierarchy: Larger enemies for complex tasks draw immediate attention, high-priority tasks get golden outline treatment, sub-tasks appear as smaller companions to parent enemies
Advanced Users & Edge Cases
* Overwhelming Enemy Count: When 20+ enemies approach, implement horizontal scrolling with subtle parallax, off-screen enemy indicator with count badges
* Performance Optimization: Graceful degradation for lower-end devices, reducing particle effects while maintaining core visual feedback
* Accessibility Considerations: High contrast mode option, enemy identification through patterns for color-blind users, screen reader compatibility for zombie descriptions
Interactive Combat System
* As a user seeking immediate gratification, I want satisfying click-to-defeat mechanics so that task completion feels rewarding
* As a mobile user, I want responsive touch targets so that defeating enemies feels precise and intentional
UX/UI Considerations
Core Experience
* Attack Mode Toggle: Large, thumb-friendly attack button with subtle pulsing animation when enemies are in range, clear visual state change when activated
* Target Selection: Enemy highlighting on hover/touch with satisfying tactile feedback, clear targeting reticle with smooth follow animation
* Defeat Animation: Explosive particle effects with screen shake calibrated for impact without disorientation, XP/points counter animation with smooth number transitions
* Undo Functionality: Recently defeated enemies list slides up from bottom with restore buttons, 10-second window with countdown indicator
Advanced Users & Edge Cases
* Rapid Completion Mode: Gesture-based multi-select for power users completing multiple tasks, swipe patterns for batch operations
* Precision Targeting: Zoom functionality for dense enemy clusters, alternative input methods for users with motor difficulties
Task Management System
Task Creation & Organization
* As a busy professional, I want quick task entry so that capturing responsibilities doesn't interrupt my workflow
* As an organized individual, I want category-based visual organization so that different life areas remain distinct
* As a project manager, I want sub-task hierarchies so that complex projects are properly represented
UX/UI Considerations
Core Experience
* Quick Add Interface: Floating action button with smooth scale animation, slide-up form with smart defaults and auto-focus, one-handed mobile optimization
* Category Selection: Visual category picker with zombie preview, smooth transitions between category states, immediate visual feedback
* Sub-task Management: Parent-child visual relationship with connecting lines, smooth size transitions as sub-tasks complete, drag-and-drop reordering
* Priority System: Toggle switch with immediate golden glow effect, clear visual hierarchy between priority levels
* Smart Scheduling: Intelligent due date suggestions based on task complexity and user patterns, calendar integration with conflict detection
Advanced Users & Edge Cases
* Bulk Operations: Multi-select mode with batch editing capabilities, template system for recurring complex tasks
* Import/Export: CSV import with intelligent field mapping, integration with popular task management tools
* Offline Functionality: Local storage with sync indicators, conflict resolution interface for simultaneous edits
Due Date & Deadline Management
* As a deadline-driven person, I want clear time visualization so that I understand when tasks become urgent
* As someone who struggles with time management, I want automatic urgency indicators so that priorities are obvious
UX/UI Considerations
Core Experience
* Time Slider Interface: 24-hour timeline with smooth scrubbing, enemy position preview with ghosted states, clear current time indicator
* Deadline Visualization: Color-coded timeline with smooth gradient transitions, deadline flags with clear labeling
* Emergency States: Progressive visual escalation from green to red with accompanying audio cues, emergency mode overlay with clear recovery actions
* Time Scale Switching: Smooth transitions between day/week/month views with appropriate zoom animations
Advanced Users & Edge Cases
* Timezone Handling: Automatic timezone detection with manual override options, travel mode for frequent travelers
* Complex Scheduling: Recurring task patterns with intelligent conflict detection, dependency management for linked tasks
Habit System & Streak Mechanics
Habit Definition & Tracking
* As someone building positive habits, I want flexible scheduling options so that habits fit my lifestyle
* As someone breaking negative habits, I want visual streak tracking so that progress feels tangible
* As a behavior change enthusiast, I want detailed tracking so that I can identify patterns
UX/UI Considerations
Core Experience
* Habit Creation Flow: Progressive disclosure form with smart defaults, visual scheduling calendar with touch-friendly date selection
* Positive/Negative Toggle: Clear visual distinction with color coding and iconography, immediate enemy appearance preview
* Streak Visualization: Fire effects for high streaks with increasing intensity, streak counter with celebration animations at milestones
* Daily Check-in Flow: Morning notification with individual habit confirmation, swipe gestures for quick logging
* Pattern Recognition: Visual behavior charts with trend indicators, insights panel with actionable recommendations
Advanced Users & Edge Cases
* Complex Scheduling: Advanced repeat patterns with exception handling, seasonal habit activation/deactivation
* Habit Modification: Change tracking with before/after comparison, impact measurement with statistical significance indicators
* Recovery Mechanisms: Frozen routine visual feedback with clear recovery path instructions, motivational messaging during streak breaks
Streak Recovery & Frozen Routines
* As someone who occasionally fails, I want recovery paths so that setbacks don't feel permanent
* As a perfectionist, I want understanding of why routines freeze so that I can make informed adjustments
UX/UI Considerations
Core Experience
* Freeze State Visualization: Greyed-out routine with clear explanation overlay, progress bar showing recovery requirements
* Recovery Path Selection: Two clear options (modify habit vs. 3-day avoidance) with progress tracking for each path
* Modification Interface: Simple edit form with change tracking, before/after comparison with save confirmation
* Avoidance Tracking: Daily confirmation flow with streak progress indicator, motivational messaging for consecutive days
Advanced Users & Edge Cases
* Multiple Frozen Routines: Prioritized recovery queue with estimated completion times, batch recovery options for related habits
* Historical Analysis: Freeze pattern recognition with personalized insights, predictive warnings before potential freezes
Routine System (Heroes)
Hero Creation & Management
* As a routine-oriented person, I want visual representation of my systems so that progress feels like character development
* As an optimizer, I want multiple routine configurations so that I can experiment with different approaches
* As someone who travels, I want routine activation controls so that I can adapt to different contexts
UX/UI Considerations
Core Experience
* Hero Creation Flow: Character customization interface with outfit previews, name input with character limit indicator
* Routine Library Interface: Grid layout with routine cards showing completion rates and star ratings, search and filter functionality
* Routine Swapping: Smooth transition animations between configurations, confirmation dialog with impact preview
* Visual Progression: Outfit changes with smooth transitions, star rating animations with celebration effects
* Performance Dashboard: Real-time completion percentage with smooth number transitions, threshold crossing notifications
Advanced Users & Edge Cases
* Routine Templates: Shareable routine configurations with community features, import/export functionality
* A/B Testing Interface: Side-by-side routine comparison with statistical analysis, automated switching based on performance
* Seasonal Routines: Calendar-based activation with automatic switching, holiday and vacation mode presets
Hero Positioning & Visual Feedback
* As a visual person, I want heroes positioned meaningfully so that the base feels populated and protected
* As someone motivated by progress, I want clear visual advancement so that improvement is obvious
UX/UI Considerations
Core Experience
* Base Integration: Heroes seamlessly integrated into church architecture with contextual positioning, fence boundary clearly defining deadline area
* Star Rating Display: Prominent star visualization with smooth filling animations, threshold crossing celebrations
* Health Visualization: Hero health bars during base attacks with damage animations, recovery effects when routines improve
* Activity Indicators: Subtle idle animations for active heroes, dormant state for deactivated routines
Advanced Users & Edge Cases
* Dense Hero Management: Automatic positioning algorithms for multiple heroes, zoom controls for detailed inspection
* Customization Options: Hero appearance customization with earned cosmetics, base decoration unlocks
Base Health & Recovery System
Base Degradation & Emergency Mode
* As someone motivated by consequences, I want visible base degradation so that neglect feels impactful
* As someone who recovers from setbacks, I want emergency mode to feel urgent but not hopeless
UX/UI Considerations
Core Experience
* Degradation Progression: Smooth visual transitions between base states with contextual damage effects, particle systems for smoking and fire
* Emergency Mode Activation: Dramatic red overlay with pulsing effects, urgent music with clear midnight countdown timer
* Damage Feedback: Screen shake calibrated for impact without disorientation, haptic feedback for critical moments
* Recovery Interface: Clear repair kit selection with immediate effect preview, healing animations with satisfying visual feedback
Advanced Users & Edge Cases
* Damage Prediction: Visual warnings before base health reaches critical levels, projected timeline based on current enemy approach
* Recovery Planning: Strategic repair kit usage calculator, optimal timing recommendations for maximum efficiency
Gradual Healing & Repair Systems
* As someone seeking balance, I want automatic healing so that minor setbacks don't feel permanent
* As a strategic player, I want repair options so that I can actively manage crises
UX/UI Considerations
Core Experience
* Healing Visualization: Subtle base repair animations with masonry and restoration effects, health bar with smooth filling transitions
* Shop Interface: Clear pricing display with inventory-based cost scaling, immediate purchase confirmation with effect preview
* Token Usage Flow: Simple selection interface with stacking preview, confirmation dialog showing total effect
* Emergency Recovery: Minimum repair threshold clearly indicated, re-enabling of gradual healing with visual confirmation
Advanced Users & Edge Cases
* Bulk Purchasing: Volume discount calculations with break-even analysis, subscription options for regular users
* Strategic Planning: Repair scheduling with optimal timing recommendations, crisis prediction with prevention strategies
Player Progression & Currency System
XP & Leveling System
* As a gamer, I want character progression so that productivity feels like advancing in an RPG
* As someone building habits, I want unlockable features so that improvement brings tangible benefits
UX/UI Considerations
Core Experience
* XP Visualization: Smooth progress bar animations with milestone celebrations, particle effects for level advancement
* Level-up Celebration: Full-screen celebration with new routine slot reveal, satisfying sound design with haptic feedback
* Progression Dashboard: Clear visualization of current level and next unlock, progress toward next milestone with estimated completion
* Achievement Notifications: Contextual celebrations for milestone achievements, badge collection interface with progress tracking
Advanced Users & Edge Cases
* Prestige System: Post-max-level progression with cosmetic rewards, leaderboard integration for competitive users
* Achievement Hunting: Detailed achievement browser with hint system, progress tracking for complex multi-step achievements
Currency & Shop System
* As a strategic player, I want resource management so that I make meaningful choices about purchases
* As someone who sometimes struggles, I want emergency options so that temporary setbacks don't feel permanent
UX/UI Considerations
Core Experience
* Currency Display: Always-visible balance with smooth number transitions, clear distinction between XP and spendable points
* Shop Interface: Clean product grid with clear pricing and effect descriptions, inventory-based price scaling clearly indicated
* Purchase Confirmation: Clear preview of purchase effects with before/after comparison, confirmation dialog with impact summary
* Exponential Pricing Feedback: Visual indicators showing why prices increase, strategic guidance for optimal purchasing patterns
Advanced Users & Edge Cases
* Bulk Operations: Volume purchasing with discount calculations, subscription models for frequent purchasers
* Strategic Analytics: Purchase history with effectiveness analysis, recommendation engine for optimal token usage
* Negative Balance Management: Clear visualization of debt state with recovery plan suggestions, gradual recovery interface
Run-Based Gameplay
Run Management & Analytics
* As someone learning from failure, I want run analysis so that I can understand what went wrong
* As an optimizer, I want fresh starts that preserve learning so that improvement feels continuous
UX/UI Considerations
Core Experience
* Run Summary Interface: Visual timeline of run events with key decision points highlighted, failure analysis with actionable insights
* Fresh Start Celebration: New run initiation with preserved progression clearly shown, motivational messaging for fresh beginning
* Persistence Visualization: Clear indication of what carries over between runs, progress preservation with celebration of maintained achievements
* Analytics Dashboard: Visual charts showing run duration trends, pattern recognition with improvement suggestions
Advanced Users & Edge Cases
* Historical Comparison: Multi-run analysis with trend identification, seasonal pattern recognition with adaptive recommendations
* Export Analytics: Data export for external analysis, integration with personal productivity tracking systems
* Coaching Integration: AI-powered insights based on run patterns, personalized improvement recommendations with implementation guidance
This comprehensive feature breakdown prioritizes user experience through progressive disclosure, clear visual feedback, and accessibility considerations while maintaining the sophisticated gamification mechanics that make productivity feel genuinely engaging rather than burdensome.


Feature State / Style Design Brief
Core Gamification Engine
Main Game Screen
Initial Launch State
* Canvas Area (Top 60%): Pristine church base centered in Canvas Mist (#F8F6F4) background with subtle gradient from Sanctuary Light to Canvas Mist
* Base Health Bar: Full green (#4CAF50) 8dp height bar positioned 16dp from top edge, smoothly animated fill with corner radius 4dp
* Heroes: 1-2 starter heroes positioned behind wooden fence perimeter, idle animations with 2-second cycles
* Time Indicator: Clean 24-hour slider with Sacred Stone (#8B7D74) handle, positioned at canvas/list boundary
* Loading Animation: 3-second fade-in revealing base with gentle camera zoom from wide to standard view
* Audio: Gentle ambient church bells and peaceful countryside sounds at 20% volume
Active Gameplay State
* Enemy Sprites: Category-specific zombies advancing left-to-right with variable speeds, each 32dp × 32dp with 2dp high contrast outlines
* Movement Animation: Linear interpolation with physics-based acceleration curves, faster walk cycles as deadlines approach
* Visual Hierarchy: High-priority tasks get Holy Gold (#E6B800) glowing outline, 2dp thickness with 50% opacity pulse every 1.5 seconds
* Attack Mode: Large Attack Button (56dp height) with Deadline Red to Warning Amber gradient, positioned bottom-right with pulse animation when enemies targetable
* Particle Systems: Enemy defeat explosions with 15-20 white/gold particles, 500ms duration with ease-out curve
* Screen Shake: 200ms damped oscillation when base takes damage, 3dp maximum displacement
Emergency State
* Overlay Effect: Emergency Overlay rgba(211, 47, 47, 0.15) covers entire canvas with subtle pulsing opacity 10-20%
* Base Visual: Smoking/flames particles emanating from damaged base structure, dramatic lighting shift to orange/red
* Countdown Timer: Prominent midnight deadline display in Emergency State Card styling, 24px Bold Nunito Sans
* Audio Escalation: Urgent background music with increased tempo, warning sound effects for critical events
* Health Bar: Flashing Base Health Red (#F44336) with 1-second pulse cycle
* User Guidance: Clear recovery instructions in floating tooltip with Sacred Stone (#8B7D74) background
Offline Catch-up State
* Transition Animation: 5-second maximum catch-up sequence showing enemy movement acceleration
* Time Compression Indicator: Speed lines effect behind moving enemies, 150% faster walk cycles
* Progress Summary: Overlay card showing "While you were away..." with key events, using Progress Card styling
* Smooth Integration: Gentle deceleration as enemies reach real-time positions, no jarring stops
* Visual Feedback: Subtle trail effects behind fast-moving enemies during catch-up phase
Dynamic Task List (Bottom 40%)
Standard View State
* List Container: Pristine White (#FFFFFF) background with 16dp padding, smooth scrolling with momentum
* Task Cards: Game Entity Card styling, sorted by proximity to base (urgency), 12dp spacing between cards
* Priority Visualization: High-priority tasks show Holy Gold (#E6B800) left border accent, 4dp width
* Category Icons: 24dp × 24dp category-specific icons in Sacred Stone (#8B7D74), positioned left of task title
* Due Date Display: Game Stats typography for time remaining, color-coded green→yellow→red based on urgency
* Edit Affordance: Subtle edit icon (16dp) appears on card hover/touch, positioned top-right corner
Empty State
* Illustration: Peaceful church scene with empty battlefield, soft Sacred Stone (#8B7D74) line art
* Primary CTA: Large Primary Action Button "Add Your First Task" centered below illustration
* Supporting Text: Body text explaining game mechanics, positioned below CTA with 24dp spacing
* Tutorial Hint: Subtle animation pointing to Floating Action Button with dotted line guide
Filtered/Search State
* Search Bar: Search Input styling at top of list, pill-shaped with magnifying glass icon
* Filter Indicators: Colored chips showing active filters, using category colors with 8dp corner radius
* Results Counter: Caption text showing "X tasks found" below search bar
* Clear Action: Text button to reset filters, positioned right of results counter
Task Management System
Task Creation Screen
Initial Form State
* Modal Overlay: Semi-transparent background (rgba(0,0,0,0.4)) with 400ms fade-in animation
* Form Container: Progress Card styling, centered with 32dp margins, slide-up animation from bottom
* Input Fields: Standard Input styling for task name, due date, and time fields
* Category Picker: Horizontal scroll of category cards with zombie previews, 8dp spacing
* Priority Toggle: Switch component with Holy Gold (#E6B800) active state, positioned prominently
* Smart Defaults: Intelligent due date suggestions based on task type and user patterns
Validation State
* Error Indicators: Error Damage (#C62828) 2dp border on invalid fields with subtle shake animation
* Helper Text: Caption text below fields explaining requirements, color-coded for clarity
* Form Progress: Subtle progress indicator showing completion percentage at form top
* Save Button: Disabled state when form invalid, uses Neutral Stone (#78716C) with 60% opacity
Sub-task Management State
* Hierarchy Visualization: Indented sub-task cards with connecting lines, Sacred Stone (#8B7D74) 1dp lines
* Parent Preview: Real-time enemy size preview showing impact of sub-task additions
* Drag Handles: Reorder affordance with grip icons, 16dp × 16dp dotted pattern
* Add Sub-task: Secondary Button positioned below parent task with plus icon
Success State
* Confirmation Animation: 800ms celebration sequence with particle burst and scale animation
* Task Preview: Preview card showing how new task will appear in game world
* Quick Actions: Options to add another task or return to game, positioned as text buttons
* XP Reward: If applicable, show estimated XP gain with Game Stats typography
Task Detail/Edit Screen
View Mode State
* Header Area: Task title in H2 Section styling, category icon positioned left with 12dp spacing
* Metadata Section: Due date, priority, and creation details in organized card layout
* Sub-task List: Nested view showing completion status with checkboxes and progress bar
* Action Strip: Edit, delete, and complete buttons in horizontal layout at bottom
* Completion Button: Prominent Attack Button styling for task completion action
Edit Mode State
* Inline Editing: Form fields replace static text with smooth 250ms transitions
* Change Tracking: Visual indicators showing modified fields with subtle Sacred Stone (#8B7D74) accent
* Auto-save: Progress indicator showing save status, positioned top-right of form
* Cancel/Save: Clear action buttons with confirmation for destructive changes
Sub-task Detail State
* Parent Context: Breadcrumb navigation showing parent task relationship
* Individual Controls: Full editing capabilities for each sub-task with its own form
* Impact Visualization: Preview showing how changes affect parent enemy size
* Dependency Mapping: Visual connections between related sub-tasks if applicable
Habit System & Streak Mechanics
Habit Creation Screen
Basic Setup State
* Type Selection: Large toggle between Positive/Negative habits with clear visual distinction
* Positive Habits: Zombie Green (#4A7C44) accent with plus icon and "Complete to earn points" label
* Negative Habits: Warning Amber (#F57C00) accent with minus icon and "Avoid to earn points" label
* Name Input: Standard Input with smart autocomplete suggestions from common habits
* Category Assignment: Same picker as tasks but with habit-specific icon overlays
Scheduling Configuration State
* Frequency Picker: Card-based selection for Daily, Variable, or Specific Days with visual calendars
* Time Window: Four chip selectors for Morning/Afternoon/Evening/Anytime with icons
* Visual Calendar: Interactive calendar showing habit instances with dot indicators
* Preview Timeline: 7-day preview showing when habit instances will appear as enemies
* Advanced Options: Collapsible section for complex scheduling patterns
Review & Confirm State
* Habit Summary: Complete overview card showing all selected options with edit affordances
* Enemy Preview: Real-time preview of how habit will appear in game world
* Streak Potential: Visualization showing streak rewards and fire effects when achieved
* Routine Assignment: Optional section to immediately add habit to existing routine
Daily Check-in Flow
Morning Prompt State
* Gentle Notification: Soft background with sunrise imagery, Sanctuary Light (#FDFCFB) gradient
* Habit List: Individual confirmation cards for each incomplete negative habit from previous day
* Binary Choice: Large checkmark/X buttons for "Successfully avoided" vs "I indulged"
* Progress Indicators: Streak counters showing current avoidance streaks with fire effects
* Skip Option: Subtle text link to "I'll check this later" with 4-hour snooze
Individual Confirmation State
* Habit Context: Large habit icon and name with category color accent
* Question Format: Clear "Did you successfully avoid [habit name] yesterday?" text
* Visual Feedback: Immediate animation response to selection with appropriate success/failure colors
* Streak Impact: Real-time preview of how choice affects current streak count
* Notes Option: Optional text field for reflection on challenging moments
Completion Celebration State
* Success Animation: 350ms spring animation with Success Heal (#388E3C) particle effects
* Streak Milestone: Special celebration for streak achievements with larger particle burst
* Point Summary: Game Stats display showing points earned/lost with smooth counter animation
* Routine Impact: Preview of how check-in affects routine hero visual progression
Habit Modification Interface
Current Status State
* Habit Overview: Complete habit card showing current settings, streak, and performance data
* Modification History: Timeline of previous changes with timestamps and impact analysis
* Performance Charts: Visual graphs showing completion rates before/after changes
* Quick Actions: Common modification shortcuts like adjusting frequency or time windows
Edit Mode State
* Side-by-side Comparison: Current settings on left, proposed changes on right
* Impact Prediction: Estimated effect on completion rates based on historical data
* Change Tracking: Detailed log of what's being modified with user note field
* Validation: Real-time feedback on whether changes will unfreeze routine slots
Frozen Routine Recovery State
* Recovery Paths: Clear visualization of two options - modify habit or 3-day avoidance
* Progress Tracking: Visual progress bar for avoidance streak with daily check-in reminders
* Modification Option: Streamlined edit form focused on meaningful changes
* Encouragement: Motivational messaging with Success Heal (#388E3C) accent colors
Routine System (Heroes)
Routine Library Screen
Grid View State
* Library Header: H1 Game Title "Your Routine Library" with routine count and filter options
* Routine Cards: Grid layout with 16dp spacing, each card showing hero avatar, name, and star rating
* Category Filters: Horizontal chip bar with routine categories, Sacred Stone (#8B7D74) for active
* Search Functionality: Search Input at top with real-time filtering of routine names
* Create New: Prominent Floating Action Button for adding new routines
* Sort Options: Dropdown for sorting by performance, creation date, or alphabetical
Routine Card Details State
* Hero Visualization: Large hero avatar showing current star rating and outfit progression
* Performance Summary: Completion percentage with visual progress bar and trend indicators
* Habit/Task Slots: Visual representation of filled vs. available slots with plus icons
* Quick Actions: Edit, activate/deactivate, and duplicate buttons in horizontal layout
* Status Indicators: Active/inactive state with appropriate color coding
Empty Library State
* Onboarding Illustration: Hero characters in various poses with Sacred Stone (#8B7D74) line art
* Primary CTA: Large Primary Action Button "Create Your First Routine"
* Feature Explanation: Body text explaining routine benefits with bullet points
* Template Options: Secondary buttons for common routine templates (Morning, Work, etc.)
Routine Creation Flow
Basic Information State
* Routine Name: Standard Input with character counter (max 50 characters)
* Category Selection: Card picker for routine categories with visual icons
* Hero Customization: Avatar builder with outfit and appearance options
* Description Field: Optional multi-line input for routine notes and goals
* Template Option: Toggle to start from template vs. build from scratch
Habit Assignment State
* Available Habits: Scrollable list of user's existing habits with category groupings
* Assignment Interface: Drag-and-drop or tap-to-add interaction with smooth animations
* Slot Visualization: Visual representation of routine slots filling up as habits are added
* Conflict Detection: Warning indicators for habits already assigned to other routines
* Create New Habit: Quick creation option without leaving routine setup flow
Task Integration State
* Task Categories: Filtered view of user's tasks by category with assignment options
* Recurring Tasks: Special section for tasks that should be associated with routine
* Schedule Alignment: Calendar view showing how routine tasks align with habit timing
* Workload Preview: Estimated daily/weekly commitment visualization
Review & Launch State
* Complete Routine Preview: Summary card showing all assigned habits and tasks
* Hero Appearance: Final hero visualization with starting outfit and star rating
* Performance Predictions: Estimated completion rates based on historical data
* Activation Options: Choice to activate immediately or save as template
Hero Progression Interface
Star Rating Display State
* Visual Star System: Five-star display with partial fills showing current progress
* Completion Percentage: Large percentage display with Game Stats typography
* Progress Bar: Smooth animated bar showing progress to next star level
* Achievement Notifications: Popup celebrations when star thresholds are crossed
* Historical Tracking: Timeline showing star progression over time
Outfit Progression State
* Before/After Preview: Side-by-side view of current vs. next outfit unlock
* Unlock Requirements: Clear explanation of what's needed for next outfit tier
* Customization Options: Available outfit modifications based on current star level
* Preview Mode: Interactive preview allowing users to see potential outfit upgrades
Performance Analytics State
* Completion Trend Chart: Visual graph showing routine performance over time
* Habit Breakdown: Individual habit performance within the routine
* Optimization Suggestions: AI-powered recommendations for routine improvements
* Comparison Mode: Side-by-side analysis of different routine configurations
Base Health & Recovery System
Health Monitoring Interface
Healthy Base State
* Base Visualization: Pristine church with clean stonework and bright Sacred Stone (#8B7D74) accents
* Health Bar: Full Base Health Green (#4CAF50) with subtle pulse animation every 3 seconds
* Hero Positioning: Heroes actively positioned around base perimeter with confident poses
* Ambient Effects: Gentle particle effects like floating leaves and warm lighting
* Status Indicator: "Base Healthy" text with Success Heal (#388E3C) checkmark icon
Moderate Damage State
* Visual Degradation: Weathered stone texture with small cracks and Weathered Stone (#A89588) color shifts
* Health Bar: Base Health Yellow (#FFC107) with slightly faster pulse (2-second intervals)
* Healing Indicator: Small green plus icons floating upward to show gradual healing
* Hero Behavior: Heroes show concern animations with more alert postures
* Warning Text: "Base taking damage" with Warning Amber (#F57C00) accent
Critical Damage State
* Heavy Weathering: Large cracks, missing stones, and Base Health Orange (#FF9800) color dominance
* Smoke Effects: Dark particle streams rising from damaged sections
* Health Bar: Flashing Base Health Red (#F44336) with urgent 1-second pulse
* Hero Distress: Heroes show worried animations and defensive postures
* Critical Alert: "Base critically damaged!" with Error Damage (#C62828) emphasis
Emergency Mode State
* Destruction Visualization: Flames, heavy smoke, and crumbling architecture
* Red Overlay: Emergency Overlay rgba(211, 47, 47, 0.15) with pulsing opacity
* Countdown Timer: Large midnight deadline counter with dramatic typography
* Disabled Healing: Clear indicator that automatic healing is stopped
* Recovery CTA: Prominent repair shop button with Holy Gold (#E6B800) emphasis
Shop Interface
Main Shop State
* Currency Display: Prominent points balance with Game Stats typography and Holy Gold (#E6B800) coin icon
* Product Grid: Repair kits and tokens in organized grid with clear pricing
* Exponential Pricing: Visual indicators showing why prices increase with inventory count
* Inventory Counter: Current token quantities displayed on each product card
* Purchase Preview: Hover/tap shows effect preview before purchase confirmation
Repair Kit Selection State
* Kit Comparison: Three tiers (25/50/100 HP) in side-by-side cards with clear value proposition
* Health Restoration Preview: Visual preview showing health bar fill after repair
* Affordability Indicators: Green/red pricing based on current point balance
* Bulk Purchase: Options for buying multiple kits with volume calculations
* Immediate Effect: Clear explanation that repair is instantaneous
Token Store State
* Token Categories: Organized sections for Pushback, Cheat Day, Sick Day, and Skip Day tokens
* Duration Options: Clear duration indicators (1hr/2hr/1day) with clock icons
* Stacking Explanation: Visual guide showing how tokens can be combined
* Strategic Guidance: Hints about optimal token usage patterns
* Emergency Stock: Highlighted section for emergency purchases during crisis
Purchase Confirmation State
* Effect Preview: Before/after visualization showing impact of purchase
* Cost Breakdown: Detailed pricing explanation including exponential scaling
* Balance Impact: New balance preview after purchase completion
* Confirmation Dialog: Standard confirmation with clear cancel/proceed options
* Success Animation: 250ms celebration with particle effects on successful purchase
Player Progression & Currency System
Progression Dashboard
Current Level State
* XP Progress Bar: Large progress bar with Game Stats typography showing current/next level
* Level Display: Prominent level number with Extra Bold Nunito Sans and Holy Gold (#E6B800) accent
* Routine Slots: Visual representation of unlocked vs. total slots with lock icons
* Achievement Gallery: Grid of earned achievements with completion percentages
* Point Balance: Large currency display with smooth counting animations
Level Up Celebration State
* Full-Screen Animation: 800ms celebration sequence with particle burst and screen flash
* New Level Announcement: Large level number with scaling animation and sound effects
* Reward Reveal: Dramatic unveiling of new routine slot with unlock animation
* Feature Unlock: If applicable, announcement of newly available features
* Continue Button: Primary Action Button to return to game after celebration
Achievement System State
* Achievement Cards: Progress cards showing completed and in-progress achievements
* Progress Tracking: Visual progress bars for multi-step achievements
* Milestone Celebrations: Special animations for significant achievement unlocks
* Social Sharing: Options to share achievements with accompanying success messaging
* Reward Claims: Clear indication of unclaimed achievement rewards
Currency Management Interface
Positive Balance State
* Point Display: Clean Game Stats typography with Holy Gold (#E6B800) emphasis
* Earning History: Timeline showing recent point gains with task/habit sources
* Spending Power: Visual indicators showing what's affordable in current shop state
* Savings Goals: Optional goal-setting for major purchases
* Trend Indicators: Arrow icons showing earning velocity trends
Negative Balance State
* Debt Indicator: Error Damage (#C62828) color scheme with negative sign emphasis
* Recovery Path: Clear explanation of how to return to positive balance
* Earning Opportunities: Highlighted list of available tasks/habits for quick points
* Restriction Notice: Clear explanation of what's unavailable during negative balance
* Progress Tracking: Visual progress bar showing path back to zero balance
Transaction History State
* Chronological List: Recent transactions with clear source/destination labeling
* Filtering Options: Ability to filter by transaction type (earnings, purchases)
* Transaction Details: Tap-to-expand for detailed information about each transaction
* Export Options: For users who want external tracking of their productivity data
* Analytics Summary: Weekly/monthly summaries of earning and spending patterns
Run-Based Gameplay
Run Summary Interface
Active Run State
* Run Duration: Prominent timer showing current run length with Game Stats typography
* Performance Metrics: Real-time stats showing completion rates and base health trends
* Current Challenges: List of active enemies and their proximity to base
* Resource Status: Quick overview of current points, tokens, and repair kit inventory
* Emergency Indicators: If applicable, warnings about critical situations
Run End State
* Final Summary: Complete run statistics with visual charts and graphs
* Failure Analysis: If run ended in base destruction, clear explanation of contributing factors
* Learning Insights: AI-generated suggestions for improvement in future runs
* Carry-Over Preview: Clear indication of what transfers to next run (XP, routine slots)
* New Run CTA: Primary Action Button to start fresh run with same configuration
Run History State
* Historical Grid: Past runs displayed as cards with key metrics and duration
* Trend Analysis: Visual charts showing improvement patterns over time
* Best Performance: Highlighted cards showing personal records and achievements
* Comparison Tools: Side-by-side comparison of different run configurations
* Export Options: Data export for external analysis and record keeping
New Run Initialization State
* Configuration Transfer: Clear indication of which settings carry over from previous run
* Fresh Start Celebration: Positive messaging about clean slate opportunities
* Base Restoration: Animation showing base returning to pristine condition
* Hero Reset: Heroes return to starting positions with optimistic poses
* Tutorial Reminders: For users returning after time away, gentle reminder of core mechanics
* * As a user, I can click to defeat enemies and complete tasks with satisfying feedback
* As a user, I can watch my base degrade visually when tasks become overdue
Technical Requirements
* 60fps performance with up to 100 concurrent enemies
* Viewport culling for off-screen entities
* Object pooling for sprites and particles
* Mobile-responsive canvas scaling
* Smooth catch-up animations (max 5 seconds)
Implementation Approach
class GameEngine {
  constructor(canvas, stateStore) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stateStore = stateStore;
    this.entityPool = new ObjectPool();
    this.viewport = new Viewport();
    this.animationId = null;
  }


  start() {
    this.gameLoop();
  }


  gameLoop() {
    this.update();
    this.render();
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }


  update() {
    this.updateEnemies();
    this.updateParticles();
    this.updateBase();
    this.checkCollisions();
  }


  render() {
    this.clearCanvas();
    this.renderBackground();
    this.renderBase();
    this.renderEnemies();
    this.renderParticles();
    this.renderUI();
  }
}


Data Models
const Enemy = {
  id: String,
  taskId: String,
  type: String, // category-based appearance
  position: { x: Number, y: Number },
  speed: Number,
  health: Number,
  priority: Boolean,
  createdAt: Date,
  dueDate: Date
};


const Particle = {
  id: String,
  position: { x: Number, y: Number },
  velocity: { x: Number, y: Number },
  life: Number,
  maxLife: Number,
  color: String,
  size: Number
};


Performance Considerations
* Object pooling prevents garbage collection spikes
* Viewport culling reduces render calls by 60-80%
* Sprite batching minimizes draw calls
* Delta time ensures consistent animation speeds
3.2 Task Management System
User Stories
* As a user, I can create tasks with due dates and categories
* As a user, I can organize tasks with sub-tasks and priority levels
* As a user, I can edit and delete tasks with immediate visual feedback
Technical Requirements
* Real-time form validation with visual feedback
* Parent-child relationship management for sub-tasks
* Category-based sprite assignment
* Smart scheduling suggestions
* Undo/redo functionality for task operations
Implementation Approach
class TaskSystem {
  constructor(stateStore) {
    this.stateStore = stateStore;
    this.validator = new TaskValidator();
  }


  createTask(taskData) {
    const task = this.validator.validate(taskData);
    const id = this.generateId();
    
    const newTask = {
      id,
      ...task,
      createdAt: new Date(),
      subtasks: [],
      completed: false
    };


    this.stateStore.set(`tasks.${id}`, newTask);
    this.generateEnemy(newTask);
    return newTask;
  }


  updateTask(id, updates) {
    const task = this.stateStore.get(`tasks.${id}`);
    const updatedTask = { ...task, ...updates, updatedAt: new Date() };
    
    this.stateStore.set(`tasks.${id}`, updatedTask);
    this.updateEnemy(id, updatedTask);
    return updatedTask;
  }


  deleteTask(id) {
    this.stateStore.delete(`tasks.${id}`);
    this.removeEnemy(id);
  }


  completeTask(id) {
    const task = this.stateStore.get(`tasks.${id}`);
    this.updateTask(id, { completed: true });
    this.awardPoints(task);
    this.triggerAnimation('taskComplete', task);
  }
}


Data Models
const Task = {
  id: String,
  name: String,
  description: String,
  dueDate: Date,
  dueTime: String,
  category: String, // 'career', 'health', 'creativity', etc.
  priority: Boolean,
  completed: Boolean,
  parentId: String | null,
  subtasks: Array<String>, // task IDs
  estimatedPoints: Number,
  tags: Array<String>,
  createdAt: Date,
  updatedAt: Date,
  completedAt: Date | null
};


Error Handling
* Validation errors shown inline with specific field highlighting
* Optimistic updates with rollback on server errors
* Auto-save with conflict resolution
* Data corruption recovery from backups
3.3 Habit System & Streak Mechanics
User Stories
* As a user, I can create positive and negative habits with flexible scheduling
* As a user, I can track streaks with visual fire effects for high performers
* As a user, I can recover from broken streaks through habit modification
Technical Requirements
* Complex scheduling algorithm supporting various patterns
* Streak calculation with time-zone awareness
* Daily check-in flow with individual habit confirmation
* Habit modification tracking with impact analysis
* Frozen routine recovery mechanics
Implementation Approach
class HabitSystem {
  constructor(stateStore, timeSystem) {
    this.stateStore = stateStore;
    this.timeSystem = timeSystem;
    this.scheduler = new HabitScheduler();
  }


  createHabit(habitData) {
    const habit = {
      id: this.generateId(),
      ...habitData,
      streak: 0,
      longestStreak: 0,
      completionRate: 0,
      createdAt: new Date(),
      instances: []
    };


    this.stateStore.set(`habits.${habit.id}`, habit);
    this.generateInstances(habit);
    return habit;
  }


  generateInstances(habit) {
    const instances = this.scheduler.generateInstances(
      habit,
      this.timeSystem.getCurrentDate(),
      7 // days ahead
    );
    
    instances.forEach(instance => {
      this.stateStore.set(`habitInstances.${instance.id}`, instance);
    });
  }


  completeHabitInstance(instanceId) {
    const instance = this.stateStore.get(`habitInstances.${instanceId}`);
    const habit = this.stateStore.get(`habits.${instance.habitId}`);
    
    this.updateInstance(instanceId, { completed: true });
    this.updateStreak(habit.id);
    this.awardPoints(habit, instance);
  }


  updateStreak(habitId) {
    const habit = this.stateStore.get(`habits.${habitId}`);
    const recentInstances = this.getRecentInstances(habitId, 7);
    const streak = this.calculateStreak(recentInstances);
    
    this.stateStore.set(`habits.${habitId}.streak`, streak);
    
    if (streak > habit.longestStreak) {
      this.stateStore.set(`habits.${habitId}.longestStreak`, streak);
    }
  }
}


Data Models
const Habit = {
  id: String,
  name: String,
  type: String, // 'positive' | 'negative'
  category: String,
  schedule: {
    frequency: String, // 'daily', 'weekly', 'custom'
    daysOfWeek: Array<Number>, // [0,1,2,3,4,5,6]
    timesPerWeek: Number,
    timeWindows: Array<String> // ['morning', 'afternoon', 'evening', 'anytime']
  },
  streak: Number,
  longestStreak: Number,
  completionRate: Number,
  routineId: String | null,
  active: Boolean,
  createdAt: Date,
  modificationHistory: Array<Object>
};


const HabitInstance = {
  id: String,
  habitId: String,
  scheduledDate: Date,
  timeWindow: String,
  completed: Boolean,
  completedAt: Date | null,
  skipped: Boolean,
  notes: String
};


3.4 Routine System (Heroes)
User Stories
* As a user, I can create named routines that appear as heroes at my base
* As a user, I can assign habits to routines and see visual progression
* As a user, I can swap between routine configurations during runs
Technical Requirements
* Hero visual progression based on completion rates
* Routine library with search and filtering
* Habit assignment with conflict detection
* Performance analytics and optimization suggestions
* Template system for common routines
Implementation Approach
class RoutineSystem {
  constructor(stateStore, habitSystem) {
    this.stateStore = stateStore;
    this.habitSystem = habitSystem;
    this.analytics = new RoutineAnalytics();
  }


  createRoutine(routineData) {
    const routine = {
      id: this.generateId(),
      name: routineData.name,
      category: routineData.category,
      habits: [],
      level: 1,
      experience: 0,
      completionRate: 0,
      starRating: 0,
      active: true,
      createdAt: new Date(),
      hero: {
        outfit: 'default',
        position: this.getNextHeroPosition()
      }
    };


    this.stateStore.set(`routines.${routine.id}`, routine);
    return routine;
  }


  addHabitToRoutine(routineId, habitId) {
    const routine = this.stateStore.get(`routines.${routineId}`);
    const habit = this.stateStore.get(`habits.${habitId}`);
    
    // Check for conflicts
    if (habit.routineId && habit.routineId !== routineId) {
      throw new Error('Habit already assigned to another routine');
    }


    // Update relationships
    this.stateStore.set(`habits.${habitId}.routineId`, routineId);
    this.stateStore.set(`routines.${routineId}.habits`, [...routine.habits, habitId]);
    
    this.recalculateRoutineStats(routineId);
  }


  updateRoutineProgress(routineId) {
    const routine = this.stateStore.get(`routines.${routineId}`);
    const habits = routine.habits.map(id => this.stateStore.get(`habits.${id}`));
    
    const completionRate = this.analytics.calculateCompletionRate(habits);
    const starRating = this.calculateStarRating(completionRate);
    
    this.stateStore.set(`routines.${routineId}.completionRate`, completionRate);
    this.stateStore.set(`routines.${routineId}.starRating`, starRating);
    
    this.updateHeroAppearance(routineId, starRating);
  }
}


Data Models
const Routine = {
  id: String,
  name: String,
  description: String,
  category: String,
  habits: Array<String>, // habit IDs
  level: Number,
  experience: Number,
  completionRate: Number,
  starRating: Number, // 0-5 stars
  active: Boolean,
  hero: {
    outfit: String,
    position: { x: Number, y: Number },
    animations: Object
  },
  createdAt: Date,
  analytics: {
    totalCompletions: Number,
    averageCompletionTime: Number,
    bestStreak: Number
  }
};


3.5 Time Management & Offline Progression
User Stories
* As a user, I can close the app and return to accurate progression
* As a user, I can see a quick catch-up animation showing what happened
* As a user, I can trust that my streaks and deadlines are calculated correctly
Technical Requirements
* Maximum 3-day offline progression support
* Client-side time calculations with timezone handling
* 5-second maximum catch-up animation
* Cross-tab synchronization
* Accurate deadline progression during offline periods
Implementation Approach
class TimeSystem {
  constructor(stateStore) {
    this.stateStore = stateStore;
    this.lastActiveTime = Date.now();
    this.maxOfflineDays = 3;
  }


  handleAppResume() {
    const now = Date.now();
    const offlineTime = now - this.lastActiveTime;
    const offlineDays = offlineTime / (1000 * 60 * 60 * 24);


    if (offlineDays > this.maxOfflineDays) {
      this.handleLongOfflinePeriod();
    } else {
      this.processOfflineProgression(offlineTime);
    }


    this.lastActiveTime = now;
  }


  processOfflineProgression(offlineTime) {
    const progressionData = {
      enemies: this.calculateEnemyMovement(offlineTime),
      baseHealth: this.calculateBaseDamage(offlineTime),
      habitInstances: this.generateMissedHabitInstances(offlineTime),
      healingAmount: this.calculateHealing(offlineTime)
    };


    this.playCatchUpAnimation(progressionData);
    this.updateGameState(progressionData);
  }


  calculateEnemyMovement(offlineTime) {
    const enemies = this.stateStore.get('enemies') || [];
    const movementData = [];


    enemies.forEach(enemy => {
      const timeToDeadline = enemy.dueDate - this.lastActiveTime;
      const speed = this.calculateEnemySpeed(timeToDeadline);
      const distance = speed * (offlineTime / 1000);
      
      movementData.push({
        id: enemy.id,
        oldPosition: enemy.position,
        newPosition: Math.min(enemy.position + distance, 100), // 100 = base position
        reachedBase: enemy.position + distance >= 100
      });
    });


    return movementData;
  }


  playCatchUpAnimation(progressionData) {
    return new Promise(resolve => {
      const duration = Math.min(5000, progressionData.enemies.length * 200);
      const startTime = performance.now();


      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);


        this.renderCatchUpFrame(progressionData, progress);


        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };


      requestAnimationFrame(animate);
    });
  }
}


4. Data Architecture
4.1 Data Models
Task Entity
const TaskSchema = {
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, maxLength: 200 },
  description: { type: String, maxLength: 1000 },
  dueDate: { type: Date, required: true },
  dueTime: { type: String, pattern: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
  category: { 
    type: String, 
    enum: ['career', 'creativity', 'financial', 'health', 'lifestyle', 'relationships', 'spirituality', 'other'],
    default: 'other'
  },
  priority: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  parentId: { type: String, nullable: true },
  subtasks: { type: Array, items: { type: String } },
  estimatedPoints: { type: Number, min: 1, max: 1000 },
  tags: { type: Array, items: { type: String, maxLength: 50 } },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() },
  completedAt: { type: Date, nullable: true }
};


Habit Entity
const HabitSchema = {
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, maxLength: 200 },
  type: { type: String, enum: ['positive', 'negative'], required: true },
  category: { type: String, enum: [...], required: true },
  schedule: {
    frequency: { type: String, enum: ['daily', 'weekly', 'custom'] },
    daysOfWeek: { type: Array, items: { type: Number, min: 0, max: 6 } },
    timesPerWeek: { type: Number, min: 1, max: 21 },
    timeWindows: { type: Array, items: { type: String, enum: ['morning', 'afternoon', 'evening', 'anytime'] } }
  },
  streak: { type: Number, default: 0, min: 0 },
  longestStreak: { type: Number, default: 0, min: 0 },
  completionRate: { type: Number, default: 0, min: 0, max: 100 },
  routineId: { type: String, nullable: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() },
  modificationHistory: { 
    type: Array, 
    items: {
      timestamp: Date,
      field: String,
      oldValue: 'Any',
      newValue: 'Any',
      notes: String
    }
  }
};


Game State Entity
const GameStateSchema = {
  baseHealth: { type: Number, min: 0, max: 100, default: 100 },
  currentRun: {
    id: String,
    startTime: Date,
    active: Boolean,
    baseDestroyedAt: { type: Date, nullable: true }
  },
  player: {
    level: { type: Number, min: 1, default: 1 },
    experience: { type: Number, min: 0, default: 0 },
    points: { type: Number, default: 0 }, // can be negative
    unlockedRoutineSlots: { type: Number, min: 1, default: 1 }
  },
  enemies: { type: Array, items: 'EnemySchema' },
  inventory: {
    repairKits: { small: Number, medium: Number, large: Number },
    tokens: { 
      pushback1h: Number, 
      pushback2h: Number, 
      pushback1d: Number,
      cheatDay: Number,
      sickDay: Number,
      skipDay: Number
    }
  },
  lastActiveTime: { type: Date, default: () => new Date() },
  version: { type: Number, default: 1 }
};


4.2 Data Storage
LocalStorage Strategy
class PersistenceManager {
  constructor() {
    this.storageKey = 'deadline-game-data';
    this.version = 1;
    this.backupInterval = 5 * 60 * 1000; // 5 minutes
    this.maxBackups = 10;
  }


  save(state) {
    const data = {
      version: this.version,
      timestamp: Date.now(),
      state: this.serialize(state)
    };


    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      this.createBackup(data);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        this.cleanupOldBackups();
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      }
    }
  }


  load() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey));
      
      if (!data || data.version !== this.version) {
        return this.migrate(data);
      }


      return this.deserialize(data.state);
    } catch (error) {
      console.warn('Failed to load game data:', error);
      return this.loadFromBackup();
    }
  }


  createBackup(data) {
    const backupKey = `${this.storageKey}-backup-${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify(data));
  }


  loadFromBackup() {
    const backupKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(`${this.storageKey}-backup-`))
      .sort()
      .reverse();


    for (const key of backupKeys) {
      try {
        const backup = JSON.parse(localStorage.getItem(key));
        return this.deserialize(backup.state);
      } catch (error) {
        console.warn('Backup corrupted:', key);
      }
    }


    return this.getDefaultState();
  }
}


Data Validation
class DataValidator {
  validate(schema, data) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`Field ${field} is required`);
        continue;
      }


      if (value !== undefined && value !== null) {
        errors.push(...this.validateField(field, value, rules));
      }
    }


    if (errors.length > 0) {
      throw new ValidationError(errors);
    }


    return data;
  }


  validateField(field, value, rules) {
    const errors = [];


    if (rules.type && typeof value !== rules.type) {
      errors.push(`Field ${field} must be of type ${rules.type}`);
    }


    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`Field ${field} must be one of: ${rules.enum.join(', ')}`);
    }


    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`Field ${field} exceeds maximum length of ${rules.maxLength}`);
    }


    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`Field ${field} does not match required pattern`);
    }


    return errors;
  }
}


5. API Specifications
5.1 Internal APIs
Since this is a client-side application, "APIs" refer to the public interfaces of core system classes:
StateStore API
class StateStore {
  // Get value by key path (e.g., 'user.level' or 'tasks.123.name')
  get(keyPath) {
    return this.getNestedValue(this.state, keyPath);
  }


  // Set value by key path with automatic change notifications
  set(keyPath, value) {
    this.setNestedValue(this.state, keyPath, value);
    this.notifySubscribers(keyPath, value);
    this.scheduleBackup();
  }


  // Subscribe to changes on specific key paths
  subscribe(keyPath, callback) {
    if (!this.subscribers[keyPath]) {
      this.subscribers[keyPath] = [];
    }
    this.subscribers[keyPath].push(callback);
    
    return () => this.unsubscribe(keyPath, callback);
  }


  // Batch operations for performance
  batch(operations) {
    this.batchMode = true;
    const results = operations.map(op => op());
    this.batchMode = false;
    this.notifyBatchedChanges();
    return results;
  }


  // State persistence
  backup() {
    this.persistenceManager.save(this.state);
  }


  restore() {
    this.state = this.persistenceManager.load();
    this.notifyAll();
  }
}


GameEngine API
class GameEngine {
  // Core lifecycle methods
  start() { /* Initialize and start game loop */ }
  pause() { /* Pause game loop and timers */ }
  resume() { /* Resume from pause state */ }
  stop() { /* Stop and cleanup resources */ }


  // Entity management
  addEnemy(enemyData) { /* Create enemy from task/habit */ }
  removeEnemy(enemyId) { /* Remove and cleanup enemy */ }
  updateEnemy(enemyId, updates) { /* Update enemy properties */ }


  // Rendering controls
  setViewport(x, y, width, height) { /* Update viewport bounds */ }
  setCameraPosition(x, y) { /* Move camera focus */ }
  toggleDebugRendering(enabled) { /* Show/hide debug info */ }


  // Performance monitoring
  getPerformanceMetrics() {
    return {
      fps: this.fpsCounter.getAverage(),
      frameTime: this.frameTimer.getAverage(),
      entityCount: this.entities.length,
      memoryUsage: this.getEstimatedMemoryUsage()
    };
  }


  // Event handling
  on(eventType, callback) { /* Subscribe to game events */ }
  off(eventType, callback) { /* Unsubscribe from events */ }
  emit(eventType, data) { /* Emit game event */ }
}


TaskSystem API
class TaskSystem {
  // CRUD operations
  async createTask(taskData) {
    const task = this.validator.validate(TaskSchema, taskData);
    const saved = await this.repository.save(task);
    this.gameEngine.addEnemy(this.createEnemyFromTask(saved));
    return saved;
  }


  async updateTask(id, updates) {
    const task = await this.repository.update(id, updates);
    this.gameEngine.updateEnemy(id, this.createEnemyFromTask(task));
    return task;
  }


  async deleteTask(id) {
    await this.repository.delete(id);
    this.gameEngine.removeEnemy(id);
  }


  async completeTask(id) {
    const task = await this.updateTask(id, { 
      completed: true,
completedAt: new Date() }); this.progressionSystem.awardTaskCompletion(task); this.gameEngine.triggerExplosion(id); return task; }
// Query operations async getTasks(filters = {}) { return this.repository.findAll(filters); }
async getTasksByCategory(category) { return this.repository.findByCategory(category); }
async getOverdueTasks() { const now = new Date(); return this.repository.findWhere(task => !task.completed && new Date(task.dueDate) < now ); }
// Sub-task management async addSubtask(parentId, subtaskData) { const subtask = await this.createTask({ ...subtaskData, parentId }); await this.updateTask(parentId, { subtasks: [...(await this.getTask(parentId)).subtasks, subtask.id] }); return subtask; }
async getTaskHierarchy(taskId) { const task = await this.getTask(taskId); const subtasks = await Promise.all( task.subtasks.map(id => this.getTask(id)) ); return { ...task, subtasks }; } }


### 5.2 External Integrations


This application is designed to be fully client-side with no external dependencies. However, future integrations could include:


#### Browser APIs
```javascript
// Notification API for daily check-ins
class NotificationManager {
  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }


  scheduleNotification(title, body, scheduledTime) {
    const delay = scheduledTime - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        new Notification(title, { body, icon: '/favicon.ico' });
      }, delay);
    }
  }
}


// Web Share API for achievement sharing
class ShareManager {
  async shareAchievement(achievement) {
    if (navigator.share) {
      await navigator.share({
        title: 'Deadline Achievement Unlocked!',
        text: `I just earned "${achievement.name}" in Deadline!`,
        url: window.location.href
      });
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(
        `I just earned "${achievement.name}" in Deadline! ${window.location.href}`
      );
    }
  }
}


6. Security & Privacy
6.1 Authentication & Authorization
Since this is a client-side only application, traditional authentication is not applicable. However, we implement data protection measures:
class SecurityManager {
  constructor() {
    this.encryptionKey = this.generateEncryptionKey();
  }


  // Generate encryption key from browser fingerprint
  generateEncryptionKey() {
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      // Add other stable browser characteristics
    ].join('|');
    
    return this.hashString(fingerprint);
  }


  // Encrypt sensitive data before localStorage
  encrypt(data) {
    const jsonString = JSON.stringify(data);
    return this.simpleEncrypt(jsonString, this.encryptionKey);
  }


  // Decrypt data from localStorage
  decrypt(encryptedData) {
    const jsonString = this.simpleDecrypt(encryptedData, this.encryptionKey);
    return JSON.parse(jsonString);
  }


  // Simple XOR-based encryption (suitable for local storage)
  simpleEncrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(result);
  }


  simpleDecrypt(encryptedText, key) {
    const text = atob(encryptedText);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  }
}


6.2 Data Security
Input Sanitization
class InputSanitizer {
  sanitizeText(input, maxLength = 1000) {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }


  sanitizeHTML(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }


  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }


  validateDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
}


Content Security Policy
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  media-src 'self';
  connect-src 'self';
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
">


6.3 Application Security
Error Handling
class ErrorHandler {
  constructor() {
    this.setupGlobalErrorHandling();
  }


  setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
      this.logError('JavaScript Error', event.error);
      this.showUserFriendlyMessage('Something went wrong. Your progress has been saved.');
    });


    window.addEventListener('unhandledrejection', (event) => {
      this.logError('Unhandled Promise Rejection', event.reason);
      event.preventDefault();
    });
  }


  logError(type, error) {
    const errorInfo = {
      type,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };


    // Store locally for debugging (don't send to external servers)
    this.storeErrorLocally(errorInfo);
  }


  storeErrorLocally(errorInfo) {
    try {
      const errors = JSON.parse(localStorage.getItem('deadline-errors') || '[]');
      errors.push(errorInfo);
      
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }
      
      localStorage.setItem('deadline-errors', JSON.stringify(errors));
    } catch (e) {
      console.warn('Failed to store error locally:', e);
    }
  }
}


7. User Interface Specifications
7.1 Design System
Color System Implementation
:root {
  /* Primary Colors */
  --color-primary-white: #F8F9FA;
  --color-primary-dark-green: #0A5F55;
  
  /* Secondary Colors */
  --color-secondary-green-light: #4CAF94;
  --color-secondary-green-pale: #E6F4F1;
  
  /* Accent Colors */
  --color-accent-teal: #00BFA5;
  --color-accent-yellow: #FFD54F;
  
  /* Functional Colors */
  --color-success: #43A047;
  --color-error: #E53935;
  --color-warning: #F57C00;
  --color-neutral: #9E9E9E;
  --color-text-primary: #424242;
  
  /* Background Colors */
  --color-bg-white: #FFFFFF;
  --color-bg-light: #F5F7F9;
  --color-bg-dark: #263238;
  
  /* Game-specific Colors */
  --color-base-health-full: #4CAF50;
  --color-base-health-moderate: #FFC107;
  --color-base-health-low: #FF9800;
  --color-base-health-critical: #F44336;
  --color-emergency-overlay: rgba(229, 57, 53, 0.15);
}


/* Dark mode variants */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary: #121212;
    --color-bg-surface: #1E1E1E;
    --color-primary-green: #26A69A;
    --color-text-primary: #EEEEEE;
    --color-text-secondary: #B0BEC5;
  }
}


Typography System
/* Font Loading */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');


:root {
  /* Font Families */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
  
  /* Font Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* Type Scale */
  --text-h1: 28px;
  --text-h2: 24px;
  --text-h3: 20px;
  --text-body-large: 17px;
  --text-body: 15px;
  --text-body-small: 13px;
  --text-caption: 12px;
  --text-button: 16px;
  
  /* Line Heights */
  --line-height-h1: 32px;
  --line-height-h2: 28px;
  --line-height-h3: 24px;
  --line-height-body-large: 24px;
  --line-height-body: 20px;
  --line-height-body-small: 18px;
  --line-height-caption: 16px;
  --line-height-button: 24px;
}


/* Typography Classes */
.text-h1 {
  font-size: var(--text-h1);
  line-height: var(--line-height-h1);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.2px;
}


.text-h2 {
  font-size: var(--text-h2);
  line-height: var(--line-height-h2);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.2px;
}


.text-body {
  font-size: var(--text-body);
  line-height: var(--line-height-body);
  font-weight: var(--font-weight-regular);
}


.text-game-stats {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 16px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.5px;
}


Spacing System
:root {
  /* Base unit: 4px */
  --space-1: 4px;   /* Micro spacing */
  --space-2: 8px;   /* Small spacing */
  --space-4: 16px;  /* Default spacing */
  --space-6: 24px;  /* Medium spacing */
  --space-8: 32px;  /* Large spacing */
  --space-12: 48px; /* Extra large spacing */
  
  /* Component-specific spacing */
  --space-card-padding: var(--space-4);
  --space-section-gap: var(--space-6);
  --space-page-margin: var(--space-12);
}


/* Spacing utility classes */
.p-1 { padding: var(--space-1); }
.p-2 { padding: var(--space-2); }
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }


.m-1 { margin: var(--space-1); }
.m-2 { margin: var(--space-2); }
.m-4 { margin: var(--space-4); }
.m-6 { margin: var(--space-6); }


.gap-2 { gap: var(--space-2); }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }


7.2 Component Specifications
Button Components
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 20px;
  border: none;
  border-radius: 8px;
  font-size: var(--text-button);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-button);
  letter-spacing: 0.1px;
  cursor: pointer;
  transition: all 200ms ease-out;
  text-decoration: none;
  user-select: none;
  min-height: 48px;
}


.btn-primary {
  background-color: var(--color-primary-dark-green);
  color: var(--color-primary-white);
  box-shadow: 0 2px 6px rgba(10, 95, 85, 0.2);
}


.btn-primary:hover {
  background-color: #0a5f55;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(10, 95, 85, 0.3);
}


.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(10, 95, 85, 0.2);
}


.btn-secondary {
  background-color: transparent;
  color: var(--color-primary-dark-green);
  border: 1.5px solid var(--color-primary-dark-green);
}


.btn-attack {
  background: linear-gradient(135deg, #E53935 0%, #F57C00 100%);
  color: white;
  min-height: 56px;
  padding: 0 24px;
  border-radius: 16px;
  font-weight: var(--font-weight-bold);
  animation: pulse-ready 2s infinite;
}


@keyframes pulse-ready {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}


.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}


.btn-floating {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--color-accent-yellow);
  color: var(--color-primary-dark-green);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  padding: 0;
}


Card Components
.card {
  background-color: var(--color-bg-white);
  border: 1px solid var(--color-secondary-green-pale);
  border-radius: 12px;
  padding: var(--space-4);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: all 200ms ease-out;
}


.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}


.card-task {
  position: relative;
  border-left: 4px solid transparent;
}


.card-task.priority {
  border-left-color: var(--color-accent-yellow);
}


.card-task.overdue {
  border-left-color: var(--color-error);
  background-color: rgba(229, 57, 53, 0.05);
}


.card-progress {
  background-color: var(--color-bg-light);
  border: 2px solid;
  border-image: linear-gradient(135deg, var(--color-primary-dark-green), var(--color-secondary-green-light)) 1;
  border-radius: 16px;
  padding: var(--space-6);
}


.card-emergency {
  background-color: var(--color-bg-white);
  border: 2px solid var(--color-error);
  box-shadow: 0 0 20px rgba(229, 57, 53, 0.2);
  animation: emergency-pulse 1s infinite;
}


@keyframes emergency-pulse {
  0%, 100% { border-color: var(--color-error); }
  50% { border-color: rgba(229, 57, 53, 0.5); }
}


Input Components
.input {
  width: 100%;
  height: 52px;
  padding: 14px 16px;
  border: 1.5px solid var(--color-neutral);
  border-radius: 10px;
  background-color: var(--color-bg-white);
  font-size: var(--text-body);
  color: var(--color-text-primary);
  transition: all 200ms ease-out;
}


.input:focus {
  outline: none;
  border-color: var(--color-primary-dark-green);
  border-width: 2px;
  box-shadow: 0 0 0 3px rgba(10, 95, 85, 0.1);
}


.input::placeholder {
  color: var(--color-neutral);
}


.input-search {
  height: 44px;
  border-radius: 22px;
  background-color: var(--color-bg-light);
  border: none;
  padding-left: 44px;
  background-image: url("data:image/svg+xml,..."); /* Search icon */
  background-repeat: no-repeat;
  background-position: 16px center;
}


.input-error {
  border-color: var(--color-error);
  animation: shake 300ms ease-in-out;
}


@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}


.input-group {
  position: relative;
}


.input-group .input-helper {
  font-size: var(--text-caption);
  color: var(--color-neutral);
  margin-top: var(--space-1);
}


.input-group .input-helper.error {
  color: var(--color-error);
}


7.3 Responsive Design System
Breakpoint System
:root {
  --breakpoint-sm: 320px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1200px;
}


/* Mobile First Approach */
.container {
  width: 100%;
  max-width: var(--breakpoint-xl);
  margin: 0 auto;
  padding: 0 var(--space-4);
}


@media (min-width: 768px) {
  .container {
    padding: 0 var(--space-6);
  }
}


/* Game Canvas Responsive Scaling */
.game-canvas-container {
  position: relative;
  width: 100%;
  height: 60vh;
  min-height: 300px;
  max-height: 600px;
}


.game-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
  background: var(--color-bg-light);
}


/* Task List Responsive Layout */
.task-list-container {
  height: 40vh;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}


@media (min-width: 1024px) {
  .game-layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: var(--space-6);
    height: 100vh;
  }
  
  .game-canvas-container {
    height: 100%;
    max-height: none;
  }
  
  .task-list-container {
    height: 100%;
    max-height: none;
  }
}


Animation System
/* Standard Transitions */
.transition-standard {
  transition: all 200ms ease-out;
}


.transition-emphasis {
  transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}


.transition-micro {
  transition: all 150ms ease-in-out;
}


.transition-page {
  transition: all 350ms cubic-bezier(0.2, 0.8, 0.2, 1);
}


/* Loading Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}


@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}


@keyframes scaleIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}


@keyframes levelUpCelebration {
  0% { transform: scale(1); }
  25% { transform: scale(1.2) rotate(5deg); }
  50% { transform: scale(1.1) rotate(-5deg); }
  75% { transform: scale(1.15) rotate(3deg); }
  100% { transform: scale(1) rotate(0deg); }
}


/* Animation Classes */
.animate-fade-in {
  animation: fadeIn 400ms ease-out;
}


.animate-slide-up {
  animation: slideUp 350ms ease-out;
}


.animate-scale-in {
  animation: scaleIn 250ms ease-out;
}


.animate-level-up {
  animation: levelUpCelebration 800ms ease-out;
}


/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}


8. Infrastructure & Deployment
8.1 Infrastructure Requirements
Hosting Environment
# Static Site Hosting Requirements
environment:
  type: "Static Site Hosting"
  providers: 
    - "GitHub Pages"
    - "Netlify"
    - "Vercel"
    - "Firebase Hosting"
  
requirements:
  storage: "< 50MB" # Single HTML file + assets
  bandwidth: "Minimal" # Client-side only
  compute: "None" # No server-side processing
  cdn: "Recommended" # For global asset delivery


files:
  - "index.html" # ~2-5MB (includes all code)
  - "assets/sprites/*.png" # ~10-20MB total
  - "assets/audio/*.mp3" # ~5-10MB total
  - "favicon.ico"
  - "manifest.json" # PWA support


Browser Requirements
browser_support:
  minimum:
    chrome: "80+"
    firefox: "75+"
    safari: "13+"
    edge: "80+"
  
  required_features:
    - "HTML5 Canvas"
    - "Web Audio API"
    - "LocalStorage"
    - "Pointer Events"
    - "requestAnimationFrame"
    - "ES6 Classes"
    - "CSS Grid"
    - "CSS Custom Properties"
  
  optional_features:
    - "Notifications API"
    - "Web Share API"
    - "Service Workers"
    - "Fullscreen API"


8.2 Deployment Strategy
Build Process
// No traditional build process required
// Single HTML file deployment strategy


const deploymentChecklist = {
  // Pre-deployment validation
  validate: [
    'Minify embedded CSS/JS for production',
    'Optimize sprite assets (PNG compression)',
    'Validate HTML structure',
    'Test on target browsers',
    'Verify localStorage functionality',
    'Check mobile responsiveness'
  ],
  
  // Asset optimization
  optimize: [
    'Compress sprite sheets (lossy PNG compression)',
    'Convert audio to optimal format/bitrate',
    'Inline critical CSS',
    'Remove debug code and console.logs',
    'Minify JavaScript (optional for single file)'
  ],
  
  // Deployment steps
  deploy: [
    'Upload index.html to hosting provider',
    'Upload assets/ directory',
    'Configure cache headers',
    'Test deployed version',
    'Verify HTTPS enforcement'
  ]
};


Environment Configuration
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deadline - Productivity Tower Defense</title>
  
  <!-- Production optimizations -->
  <meta http-equiv="cache-control" content="public, max-age=31536000">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline';">
  
  <!-- PWA Configuration -->
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#0A5F55">
  
  <!-- Preload critical assets -->
  <link rel="preload" href="assets/sprites/base.png" as="image">
  <link rel="preload" href="assets/audio/ambient.mp3" as="audio">
  
  <style>
    /* Embedded CSS here */
  </style>
</head>
<body>
  <!-- Game HTML structure -->
  
  <script>
    // Production configuration
    const CONFIG = {
      isDevelopment: false,
      enableDebugPanel: false,
      enablePerformanceLogging: false,
      assetPath: './assets/',
      version: '1.0.0'
    };
    
    // All JavaScript code embedded here
  </script>
</body>
</html>


CI/CD Pipeline (GitHub Actions Example)
name: Deploy Deadline Game


on:
  push:
    branches: [ main ]


jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Validate HTML
      run: |
        npm install -g html-validate
        html-validate index.html
    
    - name: Optimize Assets
      run: |
        # Compress PNG sprites
        for file in assets/sprites/*.png; do
          optipng -o7 "$file"
        done
        
        # Optimize audio files
        for file in assets/audio/*.mp3; do
          ffmpeg -i "$file" -b:a 128k "optimized_$(basename "$file")"
          mv "optimized_$(basename "$file")" "$file"
        done
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./


Performance Monitoring
class ProductionMonitor {
  constructor() {
    this.metrics = {
      loadTime: 0,
      firstPaint: 0,
      errors: [],
      performance: []
    };
    
    this.initialize();
  }


  initialize() {
    // Measure initial load performance
    window.addEventListener('load', () => {
      this.recordLoadMetrics();
    });


    // Monitor runtime performance
    this.startPerformanceMonitoring();
    
    // Track errors for debugging
    this.setupErrorTracking();
  }


  recordLoadMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0];
    this.metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
    
    const paint = performance.getEntriesByType('paint');
    this.metrics.firstPaint = paint.find(entry => 
      entry.name === 'first-contentful-paint'
    )?.startTime || 0;
    
    this.sendMetrics();
  }


  startPerformanceMonitoring() {
    setInterval(() => {
      const metrics = {
        timestamp: Date.now(),
        memory: this.getMemoryUsage(),
        fps: this.getCurrentFPS(),
        entityCount: this.getEntityCount()
      };
      
      this.metrics.performance.push(metrics);
      
      // Keep only last 100 measurements
      if (this.metrics.performance.length > 100) {
        this.metrics.performance.shift();
      }
    }, 5000);
  }


  sendMetrics() {
    // Store metrics locally for debugging
    localStorage.setItem('deadline-performance', JSON.stringify(this.metrics));
    
    // In a full production app, you might send to analytics service
    // analytics.track('performance', this.metrics);
  }
}


This technical specification provides comprehensive guidance for implementing the Deadline productivity game, covering all aspects from system architecture to deployment. The single HTML file approach ensures Claude Code compatibility while maintaining professional development practices and scalability considerations.


Revised Technical Specification
1. Project Overview
Deadline is a web-based application that gamifies productivity by transforming tasks and habits into tangible enemies in a tower-defense setting. It aims to solve the problem of waning motivation in traditional productivity apps by creating immediate, visual consequences for procrastination and rewarding accomplishment heroically. The application is built as a client-side-only, single-file web app to ensure simplicity, privacy, and ease of deployment.
* UX/UI Considerations:
   * The core UX loop is built on creating emotional stakes: anxiety from approaching enemies (urgency) and satisfaction from defeating them (accomplishment).
2. System Architecture & Dependencies
The application follows a modular architecture where distinct systems manage different domains of logic. A central StateStore serves as the single source of truth, with systems subscribing to changes and emitting events to communicate.
* UX/UI Considerations:
   * This decoupled architecture ensures the UI remains fast and responsive, as state changes in one system don't block rendering in another.
________________


3. Core Systems & Gameplay Mechanics
3.1. Game Engine
The Game Engine is the central controller responsible for rendering the game world, managing the main loop, and translating data into visual feedback.
* Dependencies: StateStore.
* Responsibilities: Manages the HTML5 Canvas, calculates enemy positions, handles damage logic, and renders all visual effects using the requestAnimationFrame loop for smoothness.
* UX/UI Considerations:
   * Provides constant, non-intrusive visual feedback (subtle animations, particle effects) to make the application feel alive and responsive to user actions.
3.2. Task Management System
This system governs the creation, modification, and completion of tasks, which are represented as the primary "enemy" units.
* Dependencies: StateStore, GameEngine, ProgressionSystem.
* Implementation: The TaskSystem class handles all CRUD operations. When a task is completed, it notifies the GameEngine to trigger a satisfying explosion animation and the ProgressionSystem to award points.
* UX/UI Considerations:
   * Task creation should be frictionless, ideally in a modal that doesn't navigate the user away from the main game screen, maintaining context.
3.3. Habit System & Streak Mechanics
This system manages recurring actions and user consistency through streaks.
* Dependencies: StateStore, TimeSystem, RoutineSystem.
* Implementation: The HabitSystem uses a HabitScheduler to generate HabitInstance entities. It's responsible for calculating streak counts and identifying when a routine should be frozen.
* UX/UI Considerations:
   * Celebrates consistency by making high-streak habits visually distinct ("on fire") and explains a "Frozen Routine" clearly with a non-judgmental tooltip or modal, focusing on the path to recovery.
3.4. Routine System (Heroes)
Routines are collections of habits represented by "Heroes" at the user's base.
* Dependencies: StateStore, HabitSystem.
* Implementation: The RoutineSystem manages routines, their associated habits, and their visual progression based on completionRate. A conflict check prevents a single habit from being assigned to multiple routines.
* UX/UI Considerations:
   * Hero progression provides a long-term visual goal, giving users a sense of building and investment that persists beyond individual tasks.
3.5. Time Management & Offline Progression
This system ensures the game state remains accurate when the application is closed.
* Dependencies: StateStore, GameEngine.
* Implementation: The TimeSystem calculates the offlineTime and generates a progressionData object. A brief, non-interactive playCatchUpAnimation visualizes the changes before returning control to the user.
* UX/UI Considerations:
   * The catch-up animation respects the user's time (max 5s) while providing crucial context for why the base health or enemy positions have changed, preventing confusion.
________________


4. User Interface & States
4.1. UI Design System
The UI is built on a robust design system defined in CSS, using Custom Properties (variables) for theming and consistency.
* Colors: A full palette (--color-primary-dark-green, --color-error) allows for dynamic, state-driven color changes.
* Typography: Uses the 'Inter' font with a defined type scale (--text-h1, .text-body) for clear visual hierarchy and readability.
* Spacing: A 4px-based scale (--space-4, --space-6) ensures a balanced and visually organized layout.
* UX/UI Considerations:
   * A consistent design system reduces cognitive load, allowing users to understand and predict how UI elements will behave.
4.2. UI States & Scenarios
The main game view can exist in several distinct states, each with a unique UI representation.
* Default Gameplay State: A calm, focused state. Overdue tasks are highlighted with the .card-task.overdue class to draw attention without causing alarm.
* Attack Mode Active: The cursor changes to a crosshair, providing clear feedback that the app is in a special interaction mode.
* Emergency Mode (Base Health at 0): Uses the --color-emergency-overlay and emergency-pulse animation to create a sense of urgency and high stakes, motivating the user to take restorative action.
* Input/Form States: The .input-error class uses a shake animation, providing immediate, non-verbal feedback that an input is invalid before the user even reads the helper text.
* UX/UI Considerations:
   * Each state is designed to be immediately recognizable, using a combination of color, animation, and layout changes to communicate the application's status to the user at a glance.
________________


5. Data & Persistence
* Data Models: The application's state is described by formal schemas (TaskSchema, GameStateSchema, etc.) that define the structure and constraints for all data.
* Data Storage: The PersistenceManager class uses LocalStorage for all data persistence, with built-in backup and recovery logic.
* UX/UI Considerations:
   * All data saving and loading is handled automatically in the background, providing a seamless experience with no need for the user to perform manual "save" actions.
________________


6. Deployment & Infrastructure
* Hosting: The application will be deployed on a static site host (e.g., GitHub Pages, Netlify).
* Build Process: A simple CI/CD pipeline automates asset optimization and deployment.
* Performance: A ProductionMonitor class tracks key metrics to ensure the application remains fast and responsive.
* UX/UI Considerations:
   * The choice of a static, client-side architecture ensures near-instant load times and full offline functionality (after the initial load), leading to a highly accessible and reliable user experience.