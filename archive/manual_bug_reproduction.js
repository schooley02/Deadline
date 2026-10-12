// Manual Bug Reproduction Script for Browser Console
// Run this script in the browser console at http://localhost:8000/ to reproduce the subtask duplication bug

console.log('🔍 SUBTASK DUPLICATION BUG REPRODUCTION SCRIPT');
console.log('===============================================');

function logStep(step, description) {
    console.log(`\n📍 Step ${step}: ${description}`);
}

function logState(description, data) {
    console.log(`📊 ${description}:`, data);
}

function logBug(message) {
    console.log(`🚨 BUG: ${message}`);
}

function logSuccess(message) {
    console.log(`✅ ${message}`);
}

async function reproduceSubtaskBug() {
    try {
        // Step 1: Setup and initial state check
        logStep(1, 'Checking initial state');
        
        const initialTasks = document.querySelectorAll('.enemy');
        const initialListItems = document.querySelectorAll('#activeItemsList li');
        
        logState('Initial canvas tasks', initialTasks.length);
        logState('Initial list items', initialListItems.length);
        
        // Step 2: Create parent task
        logStep(2, 'Creating parent task');
        
        // Click FAB button
        const fabButton = document.getElementById('fabButton');
        if (!fabButton) {
            throw new Error('FAB button not found');
        }
        fabButton.click();
        
        // Wait for menu to appear
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Click Tasks option
        const tasksOption = document.querySelector('[data-type="tasks"]');
        if (!tasksOption) {
            throw new Error('Tasks option not found');
        }
        tasksOption.click();
        
        // Wait for modal to appear
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fill out task form
        const taskName = document.getElementById('taskName');
        const taskCategory = document.getElementById('taskCategory');
        const taskHighPriority = document.getElementById('taskHighPriority');
        const dueDate = document.getElementById('dueDate');
        const dueTime = document.getElementById('dueTime');
        
        if (!taskName || !taskCategory || !dueDate) {
            throw new Error('Task form elements not found');
        }
        
        taskName.value = 'Parent Task - Test Project';
        taskCategory.value = 'career';
        taskHighPriority.checked = true;
        
        const today = new Date().toISOString().split('T')[0];
        dueDate.value = today;
        dueTime.value = '17:00';
        
        logSuccess('Parent task form filled');
        
        // Submit parent task
        const addTaskButton = document.getElementById('addTaskButton');
        if (!addTaskButton) {
            throw new Error('Add Task button not found');
        }
        addTaskButton.click();
        
        // Wait for task to be created
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 3: Verify parent task creation
        logStep(3, 'Verifying parent task creation');
        
        const tasksAfterParent = document.querySelectorAll('.enemy');
        const listItemsAfterParent = document.querySelectorAll('#activeItemsList li');
        
        logState('Canvas tasks after parent creation', tasksAfterParent.length);
        logState('List items after parent creation', listItemsAfterParent.length);
        
        if (tasksAfterParent.length !== 1) {
            logBug(`Expected 1 task in canvas, found ${tasksAfterParent.length}`);
        }
        
        if (listItemsAfterParent.length !== 1) {
            logBug(`Expected 1 item in list, found ${listItemsAfterParent.length}`);
        }
        
        // Step 4: Find and click subtask button
        logStep(4, 'Creating subtask');
        
        const subtaskButton = document.querySelector('.add-subtask-button');
        if (!subtaskButton) {
            throw new Error('Add Sub-task button not found');
        }
        
        logSuccess('Found Add Sub-task button');
        subtaskButton.click();
        
        // Wait for subtask modal
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fill out subtask form
        const subTaskName = document.getElementById('subTaskName');
        const subTaskCategory = document.getElementById('subTaskCategory');
        
        if (!subTaskName || !subTaskCategory) {
            throw new Error('Subtask form elements not found');
        }
        
        subTaskName.value = 'Research Phase';
        
        logState('Subtask category (inherited)', subTaskCategory.value);
        logSuccess('Subtask form filled');
        
        // Step 5: Submit subtask and analyze results
        logStep(5, 'Submitting subtask form');
        
        const createSubTaskBtn = document.getElementById('createSubTaskBtn');
        if (!createSubTaskBtn) {
            throw new Error('Create Sub-task button not found');
        }
        
        // Capture state before submitting
        const tasksBeforeSubmit = Array.from(document.querySelectorAll('.enemy')).map(el => ({
            id: el.dataset.itemId,
            classes: el.className,
            isSubtask: el.className.includes('subtask-enemy') || el.className.includes('zombie-subtask')
        }));
        
        const listItemsBeforeSubmit = Array.from(document.querySelectorAll('#activeItemsList li')).map(el => ({
            text: el.textContent.replace(/\s+/g, ' ').trim(),
            hasSubtaskSection: el.querySelector('.sub-tasks-section') !== null
        }));
        
        logState('Tasks before subtask submit', tasksBeforeSubmit);
        logState('List items before subtask submit', listItemsBeforeSubmit);
        
        // Submit subtask
        createSubTaskBtn.click();
        
        // Wait for subtask to be created
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 6: Analyze final state for bug
        logStep(6, 'Analyzing final state for duplication bug');
        
        const finalTasks = Array.from(document.querySelectorAll('.enemy')).map(el => ({
            id: el.dataset.itemId,
            classes: el.className,
            isSubtask: el.className.includes('subtask-enemy') || el.className.includes('zombie-subtask'),
            position: { x: el.style.left, y: el.style.top }
        }));
        
        const finalListItems = Array.from(document.querySelectorAll('#activeItemsList li')).map(el => ({
            text: el.textContent.replace(/\s+/g, ' ').trim(),
            hasSubtaskSection: el.querySelector('.sub-tasks-section') !== null,
            subtaskCount: el.querySelectorAll('.sub-task-item').length
        }));
        
        logState('Final canvas tasks', finalTasks.length);
        finalTasks.forEach((task, i) => console.log(`  ${i+1}. ID: ${task.id}, IsSubtask: ${task.isSubtask}, Classes: ${task.classes}`));
        
        logState('Final list items', finalListItems.length);
        finalListItems.forEach((item, i) => console.log(`  ${i+1}. "${item.text}" (Subtasks: ${item.subtaskCount})`));
        
        // Bug detection
        const expectedTasks = 2; // 1 parent + 1 subtask
        const expectedListItems = 1; // Only parent in main list
        
        console.log('\n🔍 BUG ANALYSIS:');
        console.log(`Expected canvas tasks: ${expectedTasks}, Actual: ${finalTasks.length}`);
        console.log(`Expected list items: ${expectedListItems}, Actual: ${finalListItems.length}`);
        
        let bugDetected = false;
        
        if (finalTasks.length > expectedTasks) {
            logBug('Extra tasks detected in game canvas!');
            bugDetected = true;
            
            const standaloneTasksCount = finalTasks.filter(task => !task.isSubtask).length;
            if (standaloneTasksCount > 1) {
                logBug(`Multiple standalone tasks detected: ${standaloneTasksCount} (should be 1)`);
            }
        }
        
        if (finalListItems.length > expectedListItems) {
            logBug('Extra items detected in task list!');
            bugDetected = true;
        }
        
        // Check for duplicate standalone task with subtask name
        const duplicateStandalone = finalListItems.find(item => 
            item.text.includes('Research Phase') && !item.hasSubtaskSection
        );
        
        if (duplicateStandalone) {
            logBug('Standalone task with subtask name found in main list!');
            logBug(`Duplicate item: "${duplicateStandalone.text}"`);
            bugDetected = true;
        }
        
        if (bugDetected) {
            console.log('\n🚨 DUPLICATION BUG CONFIRMED!');
            
            console.log('\n📋 EXACT USER FLOW TO REPRODUCE:');
            console.log('1. Click FAB (+) button');
            console.log('2. Click "Tasks" option');
            console.log('3. Fill form: Name="Parent Task - Test Project", Category="career", High Priority=checked, Due=today 17:00');
            console.log('4. Click "Add Task"');
            console.log('5. Click "+ Sub-task" button on parent task');
            console.log('6. Fill form: Name="Research Phase"');
            console.log('7. Click "Create Sub-task"');
            console.log('8. OBSERVE: Extra standalone task appears');
            
        } else {
            logSuccess('No duplication bug detected - behavior is correct');
        }
        
    } catch (error) {
        console.error('❌ Error during bug reproduction:', error);
    }
}

// Auto-run function
console.log('\n🚀 Starting bug reproduction in 2 seconds...');
console.log('Make sure you are on http://localhost:8000/ and the app has loaded');

setTimeout(() => {
    reproduceSubtaskBug();
}, 2000);

// Also make it available for manual execution
window.reproduceSubtaskBug = reproduceSubtaskBug;
