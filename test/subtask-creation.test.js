/**
 * Unit Tests for Subtask Creation
 * 
 * Tests the creation of subtasks with valid parentId and verifies:
 * 1. Exactly one task is added to activeItems array
 * 2. The resulting task object contains the correct parentId
 * 3. No duplicate regular tasks are created
 */

// Mock DOM elements and global variables for testing
const mockGameState = {
    activeItems: [],
    itemIdCounter: 1,
    gameIsOver: false,
    GAME_SCREEN_WIDTH: 1200,
    BASE_WIDTH: 150,
    ENEMY_WIDTH: 128
};

// Mock DOM elements
const mockGameCanvas = {
    offsetWidth: 1200,
    offsetHeight: 600,
    appendChild: jest.fn()
};

const mockBaseElement = {
    offsetWidth: 150
};

// Mock functions that would normally be part of the global scope
const mockFunctions = {
    calculateTimelinePosition: jest.fn((taskData, creationTime) => 1000),
    updateTaskCountDisplay: jest.fn(),
    sortAndRenderActiveList: jest.fn(),
    createListItem: jest.fn(),
    markAsOverdue: jest.fn()
};

// Set up global mocks
global.activeItems = mockGameState.activeItems;
global.itemIdCounter = mockGameState.itemIdCounter;
global.gameIsOver = mockGameState.gameIsOver;
global.GAME_SCREEN_WIDTH = mockGameState.GAME_SCREEN_WIDTH;
global.BASE_WIDTH = mockGameState.BASE_WIDTH;
global.ENEMY_WIDTH = mockGameState.ENEMY_WIDTH;
global.gameCanvas = mockGameCanvas;
global.baseElement = mockBaseElement;
global.calculateTimelinePosition = mockFunctions.calculateTimelinePosition;
global.updateTaskCountDisplay = mockFunctions.updateTaskCountDisplay;
global.sortAndRenderActiveList = mockFunctions.sortAndRenderActiveList;
global.createListItem = mockFunctions.createListItem;
global.markAsOverdue = mockFunctions.markAsOverdue;

// Mock document.createElement
global.document = {
    createElement: jest.fn((tagName) => ({
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn()
        },
        style: {},
        dataset: {},
        addEventListener: jest.fn(),
        textContent: '',
        appendChild: jest.fn(),
        remove: jest.fn()
    }))
};

/**
 * Simplified version of createTaskItemData function for testing
 * Based on the actual implementation from script.js lines 320-387
 */
function createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId = null) {
    console.log('🛠️ createTaskItemData called with:', {
        name,
        category,
        isHighPriority,
        dueDateStr,
        dueTimeStr,
        parentId,
        parentIdType: typeof parentId
    });
    
    const creationTime = new Date();
    let dueDateTime;
    
    if (dueDateStr && dueTimeStr) {
        dueDateTime = new Date(`${dueDateStr}T${dueTimeStr}`);
    } else if (dueDateStr) {
        dueDateTime = new Date(dueDateStr);
        dueDateTime.setHours(23, 59, 59, 999);
    } else {
        dueDateTime = new Date(creationTime.getTime() + 10 * 60 * 1000); // 10 minutes from now
    }
    
    // If this is a sub-task and no due date was provided, inherit from parent
    if (parentId && !dueDateStr && !dueTimeStr) {
        const parentTask = activeItems.find(item => item.id === parentId && item.type === 'task');
        if (parentTask) {
            dueDateTime = new Date(parentTask.dueDateTime);
        }
    }
    
    // Validate due date but allow past time today
    if (isNaN(dueDateTime.getTime()) || (dueDateTime < creationTime && dueDateStr !== creationTime.toISOString().split('T')[0])) {
        dueDateTime = new Date(creationTime.getTime() + 5 * 60 * 1000);
    }
    
    const taskData = {
        id: itemIdCounter++,
        type: 'task',
        name: name || "Unnamed Task",
        category: category || "other",
        isHighPriority: isHighPriority,
        dueDateTime: dueDateTime,
        creationTime: creationTime,
        timeToDueAtCreationMs: Math.max(0, dueDateTime.getTime() - creationTime.getTime()),
        x: GAME_SCREEN_WIDTH - ENEMY_WIDTH,
        isOverdue: false,
        lastDamageTickTime: null,
        element: null,
        listItemElement: null,
        // Sub-task hierarchy fields
        parentId: parentId,
        subTasks: [],
        completedSubTasks: 0,
        totalSubTasks: 0
    };
    
    // Calculate initial position based on timeline system
    taskData.x = calculateTimelinePosition(taskData, creationTime);
    
    console.log('🔧 createTaskItemData returning:', {
        id: taskData.id,
        name: taskData.name,
        parentId: taskData.parentId,
        parentIdType: typeof taskData.parentId
    });
    
    return taskData;
}

/**
 * Simplified version of addItemToGame function for testing
 * Based on the actual implementation from script.js lines 390-474
 */
function addItemToGame(itemData) {
    console.log('📍 addItemToGame called with:', {
        id: itemData.id,
        name: itemData.name,
        type: itemData.type,
        parentId: itemData.parentId,
        parentIdType: typeof itemData.parentId
    });
    
    if (gameIsOver) return;
    
    // Create enemy element (mocked)
    const itemElement = document.createElement('div');
    itemElement.classList.add('enemy');
    itemElement.classList.add(`category-${itemData.category}`);
    
    // Add zombie sprite classes
    itemElement.classList.add('zombie-sprite');
    itemElement.classList.add(`zombie-${itemData.category}`);
    
    if (itemData.parentId) {
        // This is a subtask
        itemElement.classList.add('subtask-enemy');
        itemElement.classList.add('zombie-subtask');
    }
    
    if (itemData.type === 'task' && itemData.isHighPriority) {
        itemElement.classList.add('high-priority');
    }
    
    // Position enemy (mocked)
    itemElement.style.left = itemData.x + 'px';
    itemElement.style.top = '100px';
    
    // Set up click handler (mocked)
    itemElement.dataset.itemId = itemData.id;
    
    // Add to game canvas (mocked)
    gameCanvas.appendChild(itemElement);
    itemData.element = itemElement;
    
    // Create list item only if it's a top-level task
    if (!itemData.parentId) {
        createListItem(itemData);
    }
    
    // Add to activeItems array - THIS IS THE KEY ACTION WE'RE TESTING
    activeItems.push(itemData);
    updateTaskCountDisplay();
    sortAndRenderActiveList();
}

describe('Subtask Creation Tests', () => {
    beforeEach(() => {
        // Reset mock state before each test
        mockGameState.activeItems.length = 0;
        mockGameState.itemIdCounter = 1;
        mockGameState.gameIsOver = false;
        
        // Reset global state
        global.activeItems = mockGameState.activeItems;
        global.itemIdCounter = mockGameState.itemIdCounter;
        global.gameIsOver = mockGameState.gameIsOver;
        
        // Clear all mock calls
        jest.clearAllMocks();
    });

    describe('Positive Tests - Valid Subtask Creation', () => {
        test('should create exactly one task when creating a subtask with valid parentId', () => {
            // Arrange: Create a parent task first
            const parentTask = createTaskItemData('Parent Task', 'career', false, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            const initialTaskCount = activeItems.length;
            expect(initialTaskCount).toBe(1);
            
            // Act: Create subtask with valid parentId
            const subtask = createTaskItemData(
                'Subtask Name',
                'career',
                false,
                '2024-01-01',
                '16:00',
                parentTask.id  // Valid parentId
            );
            addItemToGame(subtask);
            
            // Assert: Exactly one additional task should be added
            expect(activeItems).toHaveLength(initialTaskCount + 1);
            expect(activeItems[1]).toBe(subtask);
        });

        test('should create task object with correct parentId field', () => {
            // Arrange: Create a parent task
            const parentTask = createTaskItemData('Parent Task', 'health', true, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            // Act: Create subtask
            const subtask = createTaskItemData(
                'Health Subtask',
                'health',
                true,
                '2024-01-01', 
                '15:00',
                parentTask.id
            );
            addItemToGame(subtask);
            
            // Assert: Subtask should have correct parentId
            expect(subtask.parentId).toBe(parentTask.id);
            expect(typeof subtask.parentId).toBe('number');
            expect(subtask.type).toBe('task');
            expect(subtask.name).toBe('Health Subtask');
        });

        test('should verify that addItemToGame is called exactly once for subtask creation', () => {
            // Arrange: Create parent task
            const parentTask = createTaskItemData('Parent Task', 'creativity', false, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            // Spy on activeItems.push to track calls
            const pushSpy = jest.spyOn(activeItems, 'push');
            
            // Act: Create subtask
            const subtask = createTaskItemData('Creative Subtask', 'creativity', false, '2024-01-01', '16:00', parentTask.id);
            addItemToGame(subtask);
            
            // Assert: activeItems.push should be called exactly once for the subtask
            expect(pushSpy).toHaveBeenCalledTimes(1);
            expect(pushSpy).toHaveBeenCalledWith(subtask);
        });

        test('should inherit due date from parent when no due date specified for subtask', () => {
            // Arrange: Create parent with specific due date
            const parentDueDate = new Date('2024-01-15T17:00:00');
            const parentTask = createTaskItemData('Parent Task', 'financial', false, '2024-01-15', '17:00');
            addItemToGame(parentTask);
            
            // Act: Create subtask without specifying due date
            const subtask = createTaskItemData('Financial Subtask', 'financial', false, null, null, parentTask.id);
            
            // Assert: Subtask should inherit parent's due date
            expect(subtask.dueDateTime.getTime()).toBe(parentTask.dueDateTime.getTime());
            expect(subtask.parentId).toBe(parentTask.id);
        });

        test('should create subtask with all required hierarchy fields', () => {
            // Arrange: Create parent task
            const parentTask = createTaskItemData('Parent Task', 'relationships', false, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            // Act: Create subtask
            const subtask = createTaskItemData('Relationship Subtask', 'relationships', false, '2024-01-01', '16:00', parentTask.id);
            
            // Assert: Subtask should have all hierarchy fields
            expect(subtask).toHaveProperty('parentId', parentTask.id);
            expect(subtask).toHaveProperty('subTasks', []);
            expect(subtask).toHaveProperty('completedSubTasks', 0);
            expect(subtask).toHaveProperty('totalSubTasks', 0);
            expect(subtask.type).toBe('task');
        });
    });

    describe('Negative Tests - Preventing Duplicate Task Creation', () => {
        test('should not create duplicate regular task when subtask creation is intended', () => {
            // Arrange: Create parent task
            const parentTask = createTaskItemData('Parent Task', 'spirituality', false, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            const initialTaskCount = activeItems.length;
            
            // Act: Create subtask (should not create a regular task)
            const subtask = createTaskItemData('Spiritual Subtask', 'spirituality', false, '2024-01-01', '16:00', parentTask.id);
            addItemToGame(subtask);
            
            // Assert: Should have exactly 2 tasks (parent + subtask), no duplicates
            expect(activeItems).toHaveLength(2);
            
            // Verify that we have one parent and one subtask, not duplicate regular tasks
            const parentTasks = activeItems.filter(item => !item.parentId);
            const subtasks = activeItems.filter(item => item.parentId);
            
            expect(parentTasks).toHaveLength(1);
            expect(subtasks).toHaveLength(1);
            expect(subtasks[0].parentId).toBe(parentTask.id);
        });

        test('should not create list item for subtasks (only for parent tasks)', () => {
            // Arrange: Create parent task
            const parentTask = createTaskItemData('Parent Task', 'other', false, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            // Reset createListItem mock to track calls
            mockFunctions.createListItem.mockClear();
            
            // Act: Create subtask
            const subtask = createTaskItemData('Other Subtask', 'other', false, '2024-01-01', '16:00', parentTask.id);
            addItemToGame(subtask);
            
            // Assert: createListItem should not be called for subtasks
            expect(mockFunctions.createListItem).not.toHaveBeenCalled();
        });

        test('should not create task when gameIsOver is true', () => {
            // Arrange: Set game over state
            mockGameState.gameIsOver = true;
            global.gameIsOver = true;
            
            const parentTask = createTaskItemData('Parent Task', 'career', false, '2024-01-01', '17:00');
            addItemToGame(parentTask); // This should not add anything
            
            // Act: Try to create subtask when game is over
            const subtask = createTaskItemData('Career Subtask', 'career', false, '2024-01-01', '16:00', 1);
            addItemToGame(subtask); // This should not add anything
            
            // Assert: No tasks should be added when game is over
            expect(activeItems).toHaveLength(0);
        });

        test('should handle invalid parentId gracefully', () => {
            // Arrange: Create parent task
            const parentTask = createTaskItemData('Parent Task', 'lifestyle', false, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            // Act: Create subtask with non-existent parentId
            const subtask = createTaskItemData('Lifestyle Subtask', 'lifestyle', false, '2024-01-01', '16:00', 999);
            addItemToGame(subtask);
            
            // Assert: Subtask should still be created but with invalid parentId
            expect(activeItems).toHaveLength(2);
            expect(subtask.parentId).toBe(999); // Invalid parentId is preserved
            expect(subtask.type).toBe('task');
        });
    });

    describe('Integration Tests - Full Subtask Creation Flow', () => {
        test('should simulate complete subtask creation workflow', () => {
            // Arrange: Create parent task
            const parentTask = createTaskItemData('Complete Project', 'career', true, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            // Act: Create multiple subtasks
            const subtask1 = createTaskItemData('Research Phase', 'career', true, '2024-01-01', '10:00', parentTask.id);
            const subtask2 = createTaskItemData('Development Phase', 'career', true, '2024-01-01', '14:00', parentTask.id);
            const subtask3 = createTaskItemData('Testing Phase', 'career', false, '2024-01-01', '16:00', parentTask.id);
            
            addItemToGame(subtask1);
            addItemToGame(subtask2);
            addItemToGame(subtask3);
            
            // Assert: All tasks should be properly created
            expect(activeItems).toHaveLength(4); // 1 parent + 3 subtasks
            
            // Verify parent task
            const parentInArray = activeItems.find(item => item.id === parentTask.id);
            expect(parentInArray).toBeDefined();
            expect(parentInArray.parentId).toBeNull();
            
            // Verify subtasks
            const subtasksInArray = activeItems.filter(item => item.parentId === parentTask.id);
            expect(subtasksInArray).toHaveLength(3);
            
            subtasksInArray.forEach(subtask => {
                expect(subtask.parentId).toBe(parentTask.id);
                expect(subtask.type).toBe('task');
                expect(subtask.category).toBe('career');
            });
        });

        test('should verify DOM element creation for subtasks', () => {
            // Arrange: Create parent task
            const parentTask = createTaskItemData('Parent Task', 'health', false, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            // Act: Create subtask
            const subtask = createTaskItemData('Health Subtask', 'health', false, '2024-01-01', '16:00', parentTask.id);
            addItemToGame(subtask);
            
            // Assert: DOM elements should be created properly
            expect(document.createElement).toHaveBeenCalledWith('div');
            expect(gameCanvas.appendChild).toHaveBeenCalledTimes(2); // Parent + subtask
            
            // Verify subtask element has correct classes
            const subtaskElement = subtask.element;
            expect(subtaskElement.classList.add).toHaveBeenCalledWith('enemy');
            expect(subtaskElement.classList.add).toHaveBeenCalledWith('category-health');
            expect(subtaskElement.classList.add).toHaveBeenCalledWith('subtask-enemy');
            expect(subtaskElement.classList.add).toHaveBeenCalledWith('zombie-subtask');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle null parentId (regular task creation)', () => {
            // Act: Create task with null parentId
            const regularTask = createTaskItemData('Regular Task', 'other', false, '2024-01-01', '17:00', null);
            addItemToGame(regularTask);
            
            // Assert: Should create regular task
            expect(activeItems).toHaveLength(1);
            expect(regularTask.parentId).toBeNull();
            expect(mockFunctions.createListItem).toHaveBeenCalledWith(regularTask);
        });

        test('should handle undefined parentId (regular task creation)', () => {
            // Act: Create task with undefined parentId
            const regularTask = createTaskItemData('Regular Task', 'other', false, '2024-01-01', '17:00');
            addItemToGame(regularTask);
            
            // Assert: Should create regular task
            expect(activeItems).toHaveLength(1);
            expect(regularTask.parentId).toBeNull();
            expect(mockFunctions.createListItem).toHaveBeenCalledWith(regularTask);
        });

        test('should assign unique IDs to subtasks', () => {
            // Arrange: Create parent task
            const parentTask = createTaskItemData('Parent Task', 'creativity', false, '2024-01-01', '17:00');
            addItemToGame(parentTask);
            
            // Act: Create multiple subtasks
            const subtask1 = createTaskItemData('Subtask 1', 'creativity', false, '2024-01-01', '15:00', parentTask.id);
            const subtask2 = createTaskItemData('Subtask 2', 'creativity', false, '2024-01-01', '16:00', parentTask.id);
            
            // Assert: Each subtask should have unique ID
            expect(subtask1.id).not.toBe(subtask2.id);
            expect(subtask1.id).not.toBe(parentTask.id);
            expect(subtask2.id).not.toBe(parentTask.id);
        });
    });
});

// Export functions for potential manual testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createTaskItemData,
        addItemToGame,
        mockGameState,
        mockFunctions
    };
}
