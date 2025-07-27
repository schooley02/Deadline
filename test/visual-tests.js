const puppeteer = require('puppeteer');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const VIEWPORT_SIZE = { width: 1280, height: 720 };
const ROOT_URL = 'file:///' + __dirname.replace(/\\/g, '/') + '/../index.html';
const MPE_URL = 'file:///' + __dirname.replace(/\\/g, '/') + '/../Deadline-MPE/index.html';
const CATEGORIES = [
  { name: 'career', icon: '💼', description: 'Career task' },
  { name: 'creativity', icon: '💡', description: 'Creative project' },
  { name: 'financial', icon: '💰', description: 'Financial task' },
  { name: 'health', icon: '❤️', description: 'Health activity' },
  { name: 'lifestyle', icon: '🏠', description: 'Lifestyle change' },
  { name: 'relationships', icon: '🤝', description: 'Social activity' },
  { name: 'spirituality', icon: '🙏', description: 'Spiritual practice' },
  { name: 'other', icon: '📁', description: 'General task' }
];

const TEST_RESULTS = {
  passed: [],
  failed: [],
  errors: []
};

async function createTaskInCategory(page, category) {
  console.log(`Creating task for category: ${category.name}`);
  
  try {
    // Wait for page to load
    await page.waitForSelector('#fabButton', { timeout: 5000 });
    
    // Click FAB button (Root build) or show task form (MPE build)
    const fabButton = await page.$('#fabButton');
    if (fabButton) {
      // Root build - click FAB, then tasks
      await page.click('#fabButton');
      await page.waitForTimeout(500);
      await page.click('[data-type="tasks"]');
    } else {
      // MPE build - click show task form button
      await page.waitForSelector('#showTaskFormButton', { timeout: 2000 });
      await page.click('#showTaskFormButton');
    }
    
    // Fill in task form
    await page.waitForSelector('#taskName', { timeout: 2000 });
    await page.type('#taskName', `Test ${category.description}`);
    
    await page.select('#taskCategory', category.name);
    
    // Set due date to today
    const today = new Date().toISOString().split('T')[0];
    await page.evaluate((date) => {
      document.getElementById('dueDate').value = date;
    }, today);
    
    // Set due time
    await page.evaluate(() => {
      document.getElementById('dueTime').value = '17:00';
    });
    
    // Submit task
    await page.click('#addTaskButton');
    
    // Wait for task to appear on screen
    await page.waitForTimeout(1000);
    
    console.log(`✓ Task created for ${category.name}`);
    return true;
    
  } catch (error) {
    console.error(`✗ Failed to create task for ${category.name}:`, error.message);
    return false;
  }
}

async function createHabitInCategory(page, category) {
  console.log(`Creating habit for category: ${category.name}`);
  
  try {
    // Navigate to habit form
    const fabButton = await page.$('#fabButton');
    if (fabButton) {
      // Root build - click FAB, then habits
      await page.click('#fabButton');
      await page.waitForTimeout(500);
      await page.click('[data-type="habits"]');
    } else {
      // MPE build - click show habit form button
      await page.waitForSelector('#showHabitFormButton', { timeout: 2000 });
      await page.click('#showHabitFormButton');
    }
    
    // Fill in habit form
    await page.waitForSelector('#habitName', { timeout: 2000 });
    await page.type('#habitName', `Daily ${category.description}`);
    
    await page.select('#habitCategory', category.name);
    
    // Submit habit
    await page.click('#addHabitButton');
    
    // Wait for habit to appear
    await page.waitForTimeout(1000);
    
    console.log(`✓ Habit created for ${category.name}`);
    return true;
    
  } catch (error) {
    console.error(`✗ Failed to create habit for ${category.name}:`, error.message);
    return false;
  }
}

async function captureScreenshot(page, filename) {
  const screenshotPath = path.join(__dirname, 'screenshots', filename);
  await page.screenshot({ 
    path: screenshotPath,
    fullPage: true
  });
  console.log(`📸 Screenshot saved: ${filename}`);
  return screenshotPath;
}

async function validateCategorySprites(page, build) {
  console.log(`Validating sprites for ${build} build...`);
  
  const results = [];
  
  // Check for enemy elements on screen
  const enemies = await page.$$('.enemy');
  console.log(`Found ${enemies.length} enemies on screen`);
  
  for (const enemy of enemies) {
    try {
      // Get category class
      const className = await enemy.evaluate(el => el.className);
      const categoryMatch = className.match(/category-(\w+)/);
      
      if (categoryMatch) {
        const categoryName = categoryMatch[1];
        
        // Check if sprite is visible (not fallback text)
        const hasBackground = await enemy.evaluate(el => {
          const computedStyle = window.getComputedStyle(el);
          return computedStyle.backgroundImage && computedStyle.backgroundImage !== 'none';
        });
        
        // Check size
        const boundingBox = await enemy.boundingBox();
        
        results.push({
          category: categoryName,
          hasSprite: hasBackground,
          size: boundingBox,
          className: className
        });
        
        if (hasBackground && boundingBox) {
          console.log(`✓ ${categoryName}: Sprite loaded, size ${Math.round(boundingBox.width)}x${Math.round(boundingBox.height)}`);
        } else {
          console.log(`✗ ${categoryName}: Missing sprite or invalid size`);
        }
      }
    } catch (error) {
      console.error('Error validating enemy:', error.message);
    }
  }
  
  return results;
}

async function testBuild(browser, url, buildName) {
  console.log(`\n🧪 Testing ${buildName} build...`);
  console.log(`URL: ${url}`);
  
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT_SIZE);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    
    // Capture initial empty state
    await captureScreenshot(page, `${buildName}_initial.png`);
    
    // Test each category
    for (const category of CATEGORIES) {
      console.log(`\n--- Testing ${category.name} category ---`);
      
      // Create a task in this category
      const taskCreated = await createTaskInCategory(page, category);
      
      if (taskCreated) {
        // Capture screenshot with task
        await captureScreenshot(page, `${buildName}_${category.name}_task.png`);
        
        // Validate sprites
        const spriteResults = await validateCategorySprites(page, buildName);
        
        // Store results
        TEST_RESULTS.passed.push({
          build: buildName,
          category: category.name,
          type: 'task',
          sprites: spriteResults
        });
      } else {
        TEST_RESULTS.failed.push({
          build: buildName,
          category: category.name,
          type: 'task',
          error: 'Failed to create task'
        });
      }
      
      // Also test habits for this category
      const habitCreated = await createHabitInCategory(page, category);
      
      if (habitCreated) {
        await captureScreenshot(page, `${buildName}_${category.name}_habit.png`);
        
        const habitSpriteResults = await validateCategorySprites(page, buildName);
        
        TEST_RESULTS.passed.push({
          build: buildName,
          category: category.name,
          type: 'habit',
          sprites: habitSpriteResults
        });
      }
    }
    
    // Capture final state with all categories
    await captureScreenshot(page, `${buildName}_all_categories.png`);
    
  } catch (error) {
    console.error(`❌ Error testing ${buildName}:`, error.message);
    TEST_RESULTS.errors.push({
      build: buildName,
      error: error.message
    });
  } finally {
    await page.close();
  }
}

async function generateReport() {
  const reportPath = path.join(__dirname, 'test-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: TEST_RESULTS.passed.length + TEST_RESULTS.failed.length,
      passed: TEST_RESULTS.passed.length,
      failed: TEST_RESULTS.failed.length,
      errors: TEST_RESULTS.errors.length
    },
    results: TEST_RESULTS
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📊 Test report saved: ${reportPath}`);
  
  // Print summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`✅ Passed: ${report.summary.passed}`);
  console.log(`❌ Failed: ${report.summary.failed}`);
  console.log(`⚠️ Errors: ${report.summary.errors}`);
  
  return report;
}

async function runVisualRegressionTests() {
  console.log('🚀 Starting Visual Regression Tests for Deadline Game');
  console.log('Testing all categories in Root and MPE builds\n');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for CI/automated runs
    defaultViewport: VIEWPORT_SIZE
  });
  
  try {
    // Test Root build
    await testBuild(browser, ROOT_URL, 'Root');
    
    // Test MPE build
    await testBuild(browser, MPE_URL, 'MPE');
    
    // Generate final report
    await generateReport();
    
  } catch (error) {
    console.error('💥 Fatal error during testing:', error);
  } finally {
    await browser.close();
  }
}

// Run the tests
runVisualRegressionTests().catch(console.error);
