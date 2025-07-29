// Bug Reproduction Script - Subtask Duplication Issue
// This script automates the user flow to reproduce the bug where creating a subtask
// incorrectly adds a second, standalone task with the same title and category

const puppeteer = require('puppeteer');

async function reproduceSubtaskBug() {
    console.log('🔍 Starting subtask duplication bug reproduction...');
    
    const browser = await puppeteer.launch({ 
        headless: false, // Keep visible to observe the bug
        slowMo: 1000,    // Slow down to observe each step
        defaultViewport: { width: 1200, height: 800 }
    });
    
    try {
        const page = await browser.newPage();
        
        // Navigate to the app
        console.log('📍 Step 1: Navigating to http://localhost:8000/');
        await page.goto('http://localhost:8000/', { waitUntil: 'networkidle2' });
        
        // Wait for the app to load
        await page.waitForSelector('#fabButton', { timeout: 10000 });
        console.log('✅ App loaded successfully');
        
        // Step 2: Create a parent task
        console.log('📍 Step 2: Creating a parent task');
        await page.click('#fabButton');
        await page.waitForSelector('[data-type="tasks"]', { timeout: 5000 });
        await page.click('[data-type="tasks"]');
        
        // Wait for task form modal to appear
        await page.waitForSelector('#taskName', { timeout: 5000 });
        
        // Fill out the parent task form
        await page.type('#taskName', 'Parent Task - Test Project');
        await page.select('#taskCategory', 'career');
        await page.click('#taskHighPriority'); // Make it high priority
        
        // Set due date to today
        const today = new Date().toISOString().split('T')[0];
        await page.evaluate((dateStr) => {
            document.getElementById('dueDate').value = dateStr;
        }, today);
        await page.evaluate(() => {
            document.getElementById('dueTime').value = '17:00';
        });
        
        // Submit the parent task
        console.log('📍 Step 3: Submitting parent task form');
        await page.click('#addTaskButton');
        
        // Wait for modal to close and task to appear in list
        await page.waitForTimeout(2000);
        
        // Verify parent task was created
        const parentTasks = await page.$$eval('#activeItemsList li', els => 
            els.map(el => ({
                text: el.textContent,
                classes: el.className
            }))
        );
        console.log('✅ Parent task created:', parentTasks[0]);
        
        // Step 4: Find and click the "Add Sub-task" button
        console.log('📍 Step 4: Looking for Add Sub-task button');
        await page.waitForSelector('.add-subtask-button', { timeout: 5000 });
        
        // Count tasks before adding subtask
        const tasksBeforeSubtask = await page.$$eval('.enemy', els => 
            els.map(el => ({
                id: el.dataset.itemId,
                classes: el.className,
                position: { x: el.style.left, y: el.style.top }
            }))
        );
        console.log('📊 Tasks in game canvas BEFORE subtask creation:', tasksBeforeSubtask.length);
        tasksBeforeSubtask.forEach((task, i) => console.log(`  ${i+1}. ID: ${task.id}, Classes: ${task.classes}`));
        
        // Click the Add Sub-task button
        await page.click('.add-subtask-button');
        
        // Wait for subtask modal to appear
        await page.waitForSelector('#subTaskName', { timeout: 5000 });
        console.log('✅ Subtask creation modal opened');
        
        // Step 5: Fill out the subtask form
        console.log('📍 Step 5: Filling out subtask form');
        await page.type('#subTaskName', 'Research Phase');
        
        // Category should inherit from parent (career)
        const selectedCategory = await page.$eval('#subTaskCategory', el => el.value);
        console.log('📊 Subtask category (should inherit from parent):', selectedCategory);
        
        // Submit the subtask
        console.log('📍 Step 6: Submitting subtask form');
        await page.click('#createSubTaskBtn');
        
        // Wait for modal to close and subtask to be created
        await page.waitForTimeout(3000);
        
        // Step 7: Analyze the results - Check for duplication bug
        console.log('📍 Step 7: Analyzing results for duplication bug');
        
        // Count tasks after adding subtask
        const tasksAfterSubtask = await page.$$eval('.enemy', els => 
            els.map(el => ({
                id: el.dataset.itemId,
                classes: el.className,
                position: { x: el.style.left, y: el.style.top },
                isSubtask: el.className.includes('subtask-enemy') || el.className.includes('zombie-subtask')
            }))
        );
        
        console.log('📊 Tasks in game canvas AFTER subtask creation:', tasksAfterSubtask.length);
        tasksAfterSubtask.forEach((task, i) => console.log(`  ${i+1}. ID: ${task.id}, Classes: ${task.classes}, IsSubtask: ${task.isSubtask}`));
        
        // Check the task list in UI
        const taskListItems = await page.$$eval('#activeItemsList li', els => 
            els.map(el => ({
                text: el.textContent.replace(/\s+/g, ' ').trim(),
                classes: el.className,
                hasSubtaskSection: el.querySelector('.sub-tasks-section') !== null,
                subtaskCount: el.querySelectorAll('.sub-task-item').length
            }))
        );
        
        console.log('📊 Task list items:', taskListItems.length);
        taskListItems.forEach((item, i) => console.log(`  ${i+1}. ${item.text}`));
        console.log(`     Has subtask section: ${taskListItems[0]?.hasSubtaskSection}`);
        console.log(`     Subtask count: ${taskListItems[0]?.subtaskCount}`);
        
        // BUG DETECTION: Check if we have more than expected
        const expectedTasks = 2; // 1 parent + 1 subtask = 2 total tasks in canvas
        const expectedListItems = 1; // Only parent task should appear in main list
        
        console.log('\n🔍 BUG ANALYSIS:');
        console.log(`Expected tasks in canvas: ${expectedTasks}`);
        console.log(`Actual tasks in canvas: ${tasksAfterSubtask.length}`);
        console.log(`Expected main list items: ${expectedListItems}`);
        console.log(`Actual main list items: ${taskListItems.length}`);
        
        // Check for the specific bug: standalone task with same name
        const duplicateStandalone = taskListItems.find(item => 
            item.text.includes('Research Phase') && !item.hasSubtaskSection
        );
        
        if (tasksAfterSubtask.length > expectedTasks) {
            console.log('🚨 BUG CONFIRMED: Extra tasks detected in game canvas!');
            
            // Find non-subtasks (standalone duplicates)
            const standaloneTasksAfter = tasksAfterSubtask.filter(task => !task.isSubtask);
            console.log(`   Standalone tasks: ${standaloneTasksAfter.length} (should be 1)`);
            
            if (standaloneTasksAfter.length > 1) {
                console.log('🚨 DUPLICATE STANDALONE TASK DETECTED!');
            }
        }
        
        if (taskListItems.length > expectedListItems) {
            console.log('🚨 BUG CONFIRMED: Extra items in task list!');
        }
        
        if (duplicateStandalone) {
            console.log('🚨 BUG CONFIRMED: Standalone task with subtask name found in main list!');
            console.log('   Duplicate item:', duplicateStandalone.text);
        }
        
        // Log the exact user flow for test reproduction
        console.log('\n📋 EXACT USER FLOW TO REPRODUCE BUG:');
        console.log('1. Click FAB (+) button');
        console.log('2. Click "Tasks" option from FAB menu');
        console.log('3. Fill task form:');
        console.log('   - Name: "Parent Task - Test Project"');
        console.log('   - Category: "career"');
        console.log('   - High Priority: checked');
        console.log('   - Due Date: today');
        console.log('   - Due Time: 17:00');
        console.log('4. Click "Add Task" button');
        console.log('5. Wait for task to appear in list');
        console.log('6. Click "+ Sub-task" button on the parent task');
        console.log('7. Fill subtask form:');
        console.log('   - Name: "Research Phase"');
        console.log('   - Category: "career" (inherited)');
        console.log('8. Click "Create Sub-task" button');
        console.log('9. Observe: Extra standalone task appears in both canvas and main list');
        
        // Keep browser open for manual inspection
        console.log('\n🔍 Browser kept open for manual inspection. Press Ctrl+C to close.');
        
        // Wait indefinitely to allow manual inspection
        await page.waitForTimeout(300000); // 5 minutes
        
    } catch (error) {
        console.error('❌ Error during bug reproduction:', error);
    } finally {
        await browser.close();
    }
}

// Run the reproduction script
if (require.main === module) {
    reproduceSubtaskBug().catch(console.error);
}

module.exports = { reproduceSubtaskBug };
