// Manual Test Helper - Inject into browser console
// This script creates tasks and habits for all categories to test visual appearance

const CATEGORIES = [
  { name: 'career', description: 'Career task' },
  { name: 'creativity', description: 'Creative project' },
  { name: 'financial', description: 'Financial task' },
  { name: 'health', description: 'Health activity' },
  { name: 'lifestyle', description: 'Lifestyle change' },
  { name: 'relationships', description: 'Social activity' },
  { name: 'spirituality', description: 'Spiritual practice' },
  { name: 'other', description: 'General task' }
];

function createTestTask(category, isHighPriority = false) {
  console.log(`Creating test task for category: ${category.name}`);
  
  // Fill form inputs
  document.getElementById('taskName').value = `Test ${category.description}`;
  document.getElementById('taskCategory').value = category.name;
  document.getElementById('taskHighPriority').checked = isHighPriority;
  
  // Set due date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dueDate').value = today;
  document.getElementById('dueTime').value = '17:00';
  
  // Submit task
  document.getElementById('addTaskButton').click();
  
  console.log(`✓ Created task: ${category.name} (Priority: ${isHighPriority})`);
}

function createTestHabit(category) {
  console.log(`Creating test habit for category: ${category.name}`);
  
  // Fill form inputs
  document.getElementById('habitName').value = `Daily ${category.description}`;
  document.getElementById('habitCategory').value = category.name;
  document.getElementById('habitFrequency').value = 'daily';
  document.getElementById('habitTimeOfDay').value = 'anytime';
  
  // Submit habit
  document.getElementById('addHabitButton').click();
  
  console.log(`✓ Created habit: ${category.name}`);
}

function createAllCategoryTasks() {
  console.log('🚀 Creating tasks for all categories...');
  
  CATEGORIES.forEach((category, index) => {
    setTimeout(() => {
      // Show task form
      if (document.getElementById('showTaskFormButton')) {
        document.getElementById('showTaskFormButton').click();
      } else if (document.getElementById('fabButton')) {
        document.getElementById('fabButton').click();
        setTimeout(() => {
          document.querySelector('[data-type="tasks"]').click();
        }, 100);
      }
      
      setTimeout(() => {
        createTestTask(category, index % 3 === 0); // Make every 3rd task high priority
      }, 200);
    }, index * 1500);
  });
}

function createAllCategoryHabits() {
  console.log('🚀 Creating habits for all categories...');
  
  CATEGORIES.forEach((category, index) => {
    setTimeout(() => {
      // Show habit form
      if (document.getElementById('showHabitFormButton')) {
        document.getElementById('showHabitFormButton').click();
      } else if (document.getElementById('fabButton')) {
        document.getElementById('fabButton').click();
        setTimeout(() => {
          document.querySelector('[data-type="habits"]').click();
        }, 100);
      }
      
      setTimeout(() => {
        createTestHabit(category);
      }, 200);
    }, index * 1500);
  });
}

function validateSprites() {
  console.log('🔍 Validating category sprites...');
  
  const enemies = document.querySelectorAll('.enemy');
  const results = [];
  
  enemies.forEach(enemy => {
    const classList = Array.from(enemy.classList);
    const categoryClass = classList.find(cls => cls.startsWith('category-'));
    
    if (categoryClass) {
      const category = categoryClass.replace('category-', '');
      const computedStyle = window.getComputedStyle(enemy);
      const hasBackground = computedStyle.backgroundImage && computedStyle.backgroundImage !== 'none';
      const rect = enemy.getBoundingClientRect();
      
      results.push({
        category: category,
        hasSprite: hasBackground,
        backgroundImage: computedStyle.backgroundImage,
        size: { width: rect.width, height: rect.height },
        position: { x: rect.left, y: rect.top },
        className: enemy.className
      });
      
      if (hasBackground) {
        console.log(`✓ ${category}: Sprite loaded (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      } else {
        console.log(`✗ ${category}: No sprite background`);
      }
    }
  });
  
  console.log('Sprite validation results:', results);
  return results;
}

function checkFallbackText() {
  console.log('🔍 Checking for fallback text...');
  
  const enemies = document.querySelectorAll('.enemy');
  const fallbackResults = [];
  
  enemies.forEach(enemy => {
    const textContent = enemy.textContent.trim();
    const classList = Array.from(enemy.classList);
    const categoryClass = classList.find(cls => cls.startsWith('category-'));
    
    if (categoryClass && textContent) {
      const category = categoryClass.replace('category-', '');
      fallbackResults.push({
        category: category,
        fallbackText: textContent,
        shouldHaveFallback: false // Sprites should handle display
      });
      
      console.log(`⚠️ ${category}: Has fallback text: "${textContent}"`);
    }
  });
  
  if (fallbackResults.length === 0) {
    console.log('✓ No fallback text found - sprites are working correctly');
  }
  
  return fallbackResults;
}

function runFullCategoryTest() {
  console.log('🧪 Running full category test...');
  
  // Clear existing items first
  if (typeof initGame === 'function') {
    initGame();
  }
  
  // Create all tasks
  createAllCategoryTasks();
  
  // Wait and then create habits
  setTimeout(() => {
    createAllCategoryHabits();
  }, CATEGORIES.length * 1500);
  
  // Wait and then validate
  setTimeout(() => {
    validateSprites();
    checkFallbackText();
    
    console.log('📋 Test Summary:');
    console.log('- All categories tested for tasks and habits');
    console.log('- Sprite validation completed');
    console.log('- Fallback text check completed');
    console.log('- Check console output and visual appearance');
  }, CATEGORIES.length * 3000);
}

// Export functions for manual use
window.testHelpers = {
  createAllCategoryTasks,
  createAllCategoryHabits,
  validateSprites,
  checkFallbackText,
  runFullCategoryTest,
  CATEGORIES
};

console.log('📝 Manual Test Helper loaded!');
console.log('Available functions:');
console.log('- testHelpers.runFullCategoryTest() - Run complete test');
console.log('- testHelpers.createAllCategoryTasks() - Create tasks for all categories');
console.log('- testHelpers.createAllCategoryHabits() - Create habits for all categories');
console.log('- testHelpers.validateSprites() - Check sprite loading');
console.log('- testHelpers.checkFallbackText() - Check for fallback text');
