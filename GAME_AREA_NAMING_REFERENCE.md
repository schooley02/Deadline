# Game Area Naming Reference

This document establishes the official naming conventions for all areas within the Deadline game to ensure consistent communication and documentation.

## Main Game Areas

### 1. **Game Canvas** (Entire Game Area)
- **HTML Element**: `#gameCanvas`
- **CSS Classes**: `.game-section`
- **Description**: The complete top 60% visual gaming area where all gameplay occurs
- **Usage**: "The enemy sprites appear randomly across the Game Canvas"
- **Alternative names**: Game Screen, Game World, Battle Arena

### 2. **Base Zone** (Base Area)
- **HTML Element**: `#base`
- **CSS Classes**: `#base`
- **Description**: The leftmost 120px area containing the church base building
- **Usage**: "Heroes are positioned within the Base Zone perimeter"
- **Alternative names**: Church Area, Base Perimeter, Safe Zone
- **Key Features**: 
  - Church building visualization
  - Hero positioning
  - Base health visualization
  - Fence boundary (the actual "Deadline" visual indicator)

### 3. **Deadline Boundary** (The Dead Line)
- **Visual Element**: Fence behind heroes in Base Zone
- **Description**: The visual line that enemies must cross to damage the base
- **Usage**: "Enemies become critical when they cross the Deadline Boundary"
- **Alternative names**: Deadline Fence, Defense Line, Critical Line
- **Key Features**:
  - Visual fence/barrier representation
  - No actual collision detection (purely visual)
  - Represents the conceptual "deadline" of the game

### 4. **Combat Field** (Enemy Area)
- **Description**: The remaining Game Canvas area where enemies spawn and move (right of Base Zone)
- **Usage**: "New zombies spawn at the right edge of the Combat Field"
- **Alternative names**: Battle Zone, Enemy Territory, Approach Area
- **Key Features**:
  - Enemy spawning area (right edge)
  - Enemy movement paths
  - Click-to-attack interactions
  - Particle effects and animations
  - Approximately 80% of Game Canvas width

### 5. **Stats Overlay** (Game Stats Area)
- **HTML Element**: `.stats-overlay`
- **CSS Classes**: `.stats-overlay`, `.resource-panel`, `.attack-button`
- **Description**: The transparent overlay showing player stats and attack button
- **Usage**: "Player health is displayed in the Stats Overlay"
- **Alternative names**: HUD, Player Dashboard, Stats Panel
- **Key Features**:
  - Player stats (Health, XP, Level, Points)
  - Attack button
  - Transparent overlay design
  - Always visible during gameplay

## Quick Reference Table

| Official Name | HTML/CSS Reference | Location | Primary Function |
|---------------|-------------------|----------|------------------|
| **Game Canvas** | `#gameCanvas`, `.game-section` | Top 60% of app | Complete gameplay area |
| **Base Zone** | `#base` | Left 120px of Game Canvas | Church, heroes, base health |
| **Deadline Boundary** | Fence visual in Base Zone | Behind heroes | Visual deadline indicator |
| **Combat Field** | Game Canvas minus Base Zone | Right ~80% of Game Canvas | Enemy spawning and movement |
| **Stats Overlay** | `.stats-overlay` | Overlaid on Game Canvas | Player stats and controls |

## Usage Guidelines

### When giving instructions about:
- **Enemy behavior**: Use "Combat Field" for spawning/movement, "Deadline Boundary" for critical transitions
- **Base mechanics**: Use "Base Zone" for church/hero interactions, "Base Zone" for health/damage
- **UI elements**: Use "Stats Overlay" for player information and controls
- **General gameplay**: Use "Game Canvas" when referring to the entire game area
- **Boundaries**: Use "Deadline Boundary" for the conceptual line enemies cross

### Example Usage:
- ✅ "The zombie enemies spawn at the right edge of the Combat Field"
- ✅ "Heroes are positioned around the Base Zone perimeter"  
- ✅ "The attack button is located in the Stats Overlay"
- ✅ "When enemies cross the Deadline Boundary, the base takes damage"
- ❌ "The zombies appear in the base area" (confusing)
- ❌ "The game area shows the stats" (too vague)

## Implementation Notes

These names should be used consistently in:
- Code comments and documentation
- CSS class names (where applicable)
- Issue tracking and bug reports
- Feature discussions and specifications
- User-facing help text and tutorials

---

*This naming convention was established to eliminate confusion between different game areas and ensure clear communication during development and gameplay discussions.*
