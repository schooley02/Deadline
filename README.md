# Project Readme

## Overview

This project is a gamified productivity app where tasks and habits are represented as zombie sprites in a game setting. The main objective is to manage tasks effectively while maintaining habits, visualized through engaging game elements.

## Features

- Different zombie sprites represent various tasks and habits.
- Tasks are sorted by category and priority, affecting the appearance of the sprites.
- Habits are recurring exercises that need to be managed similarly to tasks but appear as smaller enemies.
- A visual representation of the base health and player stats which the user must protect by completing tasks and habits on time.
- A high-priority glow effect for tasks of high importance.
- A streak system for habits, encouraging the user to maintain consistency.

## Sprite Classes

### Tasks
- **Zombie Category**: Represents different categories like career, health, creativity, etc.
- **High Priority**: Tasks with high priority will have a glowing effect.
- **Overdue Tasks**: Tasks that are not completed on time move to the base and cause damage.

### Habits
- **Habit Enemies**: Smaller zombies, representing habits to be regularly maintained.
- **Negative Habits**: Visual distinction for habits considered negative if not avoided.
- **Streak Bonuses**: Visual representation and bonuses for maintaining a streak in habits.

## Usage

1. **Navigate the Game Screen**: Use different form inputs to add tasks and habits.
2. **Manage and Create**: Utilize forms to manage existing tasks and habits, or create new ones.
3. **Attack Mode**: Toggle the attack mode to complete tasks and defeat habits.
4. **Visual Feedback**: Observe visual cues for base health, player level, and task/habit status.

## Development

- **JavaScript**: Handles the game logic, task/event management, and dynamic updates.
- **CSS**: Manages visual aspects of the sprites and overall visual effects.
- **HTML**: Main structure for game interface and interaction elements.

