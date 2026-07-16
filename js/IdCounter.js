/**
 * Simple ID counter utility
 */
class IdCounter {
    constructor(startValue = 0) {
        this.counter = startValue;
    }

    get() {
        return this.counter++;
    }

    set(value) {
        this.counter = value;
    }

    current() {
        return this.counter;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IdCounter;
}
