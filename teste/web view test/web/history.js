/**
 * Global History Manager
 * Tracks all widget value changes across the entire tab/page
 * Supports undo/redo for sliders, toggles, spinbox, combobox, buttons, charts, etc.
 */
class GlobalHistoryManager {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 300;
        this.isApplyingHistory = false; // Flag to prevent creating history entries while applying history
        this.undoButton = null;
        this.redoButton = null;
    }

    /**
     * Create a snapshot of current widget values from the widgets area
     */
    createSnapshot() {
        // Build a snapshot by scanning DOM elements with `data-command` so that
        // multi-checkbox groups and individually-addressable inputs are captured
        // deterministically (order-independent).
        const snapshot = {};
        const widgetsArea = document.querySelector('.widgets-area');
        if (!widgetsArea) return snapshot;

        const elements = widgetsArea.querySelectorAll('input[data-command], select[data-command], textarea[data-command]');
        elements.forEach(el => {
            const cmd = el.dataset.command;
            if (!cmd) return;

            if (el.type === 'radio') {
                if (el.checked) snapshot[cmd] = el.value;
            } else if (el.type === 'checkbox') {
                // If checkbox has explicit on/off mapping use those, otherwise use boolean
                if (el.dataset.valueOn !== undefined && el.dataset.valueOff !== undefined) {
                    snapshot[cmd] = el.checked ? this._coerceNumeric(el.dataset.valueOn) : this._coerceNumeric(el.dataset.valueOff);
                } else {
                    snapshot[cmd] = !!el.checked;
                }
            } else if (el.tagName.toLowerCase() === 'select') {
                snapshot[cmd] = el.value;
            } else {
                // number / text
                snapshot[cmd] = el.value;
            }
        });

        return snapshot;
    }

    /**
     * Get a widget's current value from the DOM
     */
    _getWidgetValue(widget) {
        const widgetsArea = document.querySelector('.widgets-area');
        if (!widgetsArea) return null;

        const container = Array.from(widgetsArea.querySelectorAll('.widget-container')).find(c => {
            return c.querySelector('.widget-title')?.textContent === widget.title;
        });

        if (!container) return null;

        const value = this._extractValueFromContainer(container, widget.type);
        return value;
    }

    /**
     * Extract value from a widget container based on its type
     */
    _extractValueFromContainer(container, widgetType) {
        switch (widgetType) {
            case 'slider': {
                const input = container.querySelector('input[type="range"]');
                return input ? parseFloat(input.value) : null;
            }
            case 'spinbox': {
                const input = container.querySelector('input[type="number"]');
                return input ? parseFloat(input.value) : null;
            }
            case 'combobox': {
                const select = container.querySelector('select');
                return select ? select.value : null;
            }
            case 'toggle': {
                const input = container.querySelector('input[type="checkbox"]');
                // Return boolean to match widget toggle semantics
                return input ? !!input.checked : null;
            }
            case 'radio': {
                const checked = container.querySelector('input[type="radio"]:checked');
                return checked ? checked.value : null;
            }
            case 'chart2d': {
                // For charts, capture all canvas-based data from any data structure
                // This will be handled during snapshot creation by storing the current chart state
                const canvas = container.querySelector('canvas.chart2d-canvas');
                if (!canvas) return null;
                // Store canvas ID or reference for later restoration
                return 'chart2d_canvas';
            }
            default:
                return null;
        }
    }

    /**
     * Push a new state to history
     */
    push(stateSnapshot) {
        if (this.isApplyingHistory) return;

        // Remove any redo history if we're at a branch point
        if (this.historyIndex < this.history.length - 1) {
            this.history.splice(this.historyIndex + 1);
        }

        // Add the new state
        this.history.push(stateSnapshot);

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        this._updateButtonStates();
    }

    /**
     * Undo to previous state
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this._applySnapshot(this.history[this.historyIndex]);
            this._updateButtonStates();
            return true;
        }
        return false;
    }

    /**
     * Redo to next state
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this._applySnapshot(this.history[this.historyIndex]);
            this._updateButtonStates();
            return true;
        }
        return false;
    }

    /**
     * Apply a snapshot to all widgets in the page
     */
    _applySnapshot(snapshot) {
        this.isApplyingHistory = true;

        const widgetsArea = document.querySelector('.widgets-area');
        if (!widgetsArea) {
            this.isApplyingHistory = false;
            return;
        }

        // Apply snapshot by setting DOM elements that have matching data-command
        for (const [cmd, value] of Object.entries(snapshot)) {
            const els = Array.from(widgetsArea.querySelectorAll(`[data-command="${cmd}"]`));
            els.forEach(el => {
                if (el.type === 'radio') {
                    el.checked = String(el.value) === String(value);
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (el.type === 'checkbox') {
                    if (el.dataset.valueOn !== undefined && el.dataset.valueOff !== undefined) {
                        // Coerce comparison
                        el.checked = String(this._coerceNumeric(value)) === String(this._coerceNumeric(el.dataset.valueOn));
                    } else {
                        el.checked = value === true || value === 'true' || value == 1;
                    }
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (el.tagName.toLowerCase() === 'select') {
                    el.value = value;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    el.value = value;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }

        this.isApplyingHistory = false;
    }

    _coerceNumeric(v) {
        // If v looks like a number, return Number, else return original string
        if (v === null || v === undefined) return v;
        if (typeof v === 'number') return v;
        const n = Number(v);
        return !isNaN(n) ? n : v;
    }

    /**
     * Set a widget's value in the DOM and trigger change events
     */
    _setWidgetValue(widget, value) {
        const widgetsArea = document.querySelector('.widgets-area');
        const container = Array.from(widgetsArea.querySelectorAll('.widget-container')).find(c => {
            return c.querySelector('.widget-title')?.textContent === widget.title;
        });

        if (!container) return;

        let input, event;

        switch (widget.type) {
            case 'slider': {
                input = container.querySelector('input[type="range"]');
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            }
            case 'spinbox': {
                input = container.querySelector('input[type="number"]');
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            }
            case 'combobox': {
                input = container.querySelector('select');
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            }
            case 'toggle': {
                input = container.querySelector('input[type="checkbox"]');
                if (input) {
                    // Accept boolean or numeric/string representations
                    input.checked = value === true || value === 'true' || value == 1;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            }
            case 'radio': {
                input = container.querySelector(`input[type="radio"][value="${value}"]`);
                if (input) {
                    input.checked = true;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            }
        }
    }

    /**
     * Update undo/redo button states
     */
    _updateButtonStates() {
        if (this.undoButton) {
            this.undoButton.disabled = this.historyIndex <= 0;
        }
        if (this.redoButton) {
            this.redoButton.disabled = this.historyIndex >= this.history.length - 1;
        }
    }

    /**
     * Set references to the header undo/redo buttons
     */
    setButtons(undoButton, redoButton) {
        this.undoButton = undoButton;
        this.redoButton = redoButton;
        this._updateButtonStates();
    }

    /**
     * Clear all history
     */
    clear() {
        this.history = [];
        this.historyIndex = -1;
        this._updateButtonStates();
    }
}

// Create global instance
window.globalHistoryManager = new GlobalHistoryManager();
