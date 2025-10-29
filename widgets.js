class WidgetManager {
    constructor() {
        this.currentWidgets = [];
    }

    setCurrentWidgets(widgets) {
        this.currentWidgets = widgets;
    }

    getCurrentWidgets() {
        return this.currentWidgets;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    validateValue(value, widget) {
        let validValue = parseFloat(value);

        if (isNaN(validValue)) {
            return widget.default;
        }

        if (widget.min !== undefined && widget.max !== undefined) {
            validValue = this.clamp(validValue, widget.min, widget.max);
        }

        return validValue;
    }

    createWidget(widget, currentValue, onValueChange) {
        switch (widget.type) {
            case 'slider':
                return this.createSlider(widget, currentValue, onValueChange);
            case 'spinbox':
                return this.createSpinbox(widget, currentValue, onValueChange);
            case 'combobox':
                return this.createCombobox(widget, currentValue, onValueChange);
            case 'toggle':
                return this.createToggle(widget, currentValue, onValueChange);
            case 'radio':
                return this.createRadio(widget, currentValue, onValueChange);
            case 'button':
                return this.createButton(widget, onValueChange);
            default:
                const div = document.createElement('div');
                div.textContent = 'Widget não suportado';
                return div;
        }
    }

    createSlider(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-slider';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = widget.min;
        slider.max = widget.max;
        slider.value = currentValue;
        slider.className = 'form-range custom-slider';

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'slider-value';
        valueDisplay.innerHTML = `
            <span>${widget.min}${widget.unit || ''}</span>
            <span class="current-value">${currentValue}${widget.unit || ''}</span>
            <span>${widget.max}${widget.unit || ''}</span>
        `;

        slider.addEventListener('input', (e) => {
            const validValue = this.clamp(parseFloat(e.target.value), widget.min, widget.max);
            e.target.value = validValue;
            valueDisplay.querySelector('.current-value').textContent = `${validValue}${widget.unit || ''}`;
            onValueChange(widget.command, validValue);
        });

        container.appendChild(slider);
        container.appendChild(valueDisplay);
        return container;
    }

    createSpinbox(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-spinbox';

        const btnMinus = document.createElement('button');
        btnMinus.className = 'spinbox-btn spinbox-minus';
        btnMinus.innerHTML = '<i class="bi bi-dash"></i>';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = widget.min;
        input.max = widget.max;
        input.step = widget.step || 1;
        input.value = currentValue;
        input.className = 'form-control spinbox-input';

        const btnPlus = document.createElement('button');
        btnPlus.className = 'spinbox-btn spinbox-plus';
        btnPlus.innerHTML = '<i class="bi bi-plus"></i>';

        const unit = document.createElement('span');
        unit.className = 'spinbox-unit';
        unit.textContent = widget.unit || '';

        const updateValue = (newValue) => {
            const validValue = this.clamp(newValue, widget.min, widget.max);
            input.value = validValue;
            onValueChange(widget.command, validValue);
        };

        btnMinus.addEventListener('click', () => {
            const step = parseFloat(widget.step || 1);
            updateValue(parseFloat(input.value) - step);
        });

        btnPlus.addEventListener('click', () => {
            const step = parseFloat(widget.step || 1);
            updateValue(parseFloat(input.value) + step);
        });

        input.addEventListener('change', (e) => {
            updateValue(parseFloat(e.target.value));
        });

        container.appendChild(btnMinus);
        container.appendChild(input);
        container.appendChild(btnPlus);
        if (unit.textContent) {
            container.appendChild(unit);
        }

        return container;
    }

    createCombobox(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-combobox';

        const select = document.createElement('select');
        select.className = 'form-select custom-select';

        widget.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            if (option.value == currentValue) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });

        select.addEventListener('change', (e) => {
            onValueChange(widget.command, e.target.value);
        });

        container.appendChild(select);
        return container;
    }

    createToggle(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-toggle';

        const toggleSwitch = document.createElement('label');
        toggleSwitch.className = 'toggle-switch';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = currentValue == 1;

        const slider = document.createElement('span');
        slider.className = 'toggle-slider';

        input.addEventListener('change', (e) => {
            const value = e.target.checked ? 1 : 0;
            onValueChange(widget.command, value);
        });

        toggleSwitch.appendChild(input);
        toggleSwitch.appendChild(slider);

        const label = document.createElement('span');
        label.className = 'toggle-label';
        label.textContent = widget.label || '';

        container.appendChild(toggleSwitch);
        if (label.textContent) {
            container.appendChild(label);
        }

        return container;
    }

    createRadio(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-radio';

        widget.options.forEach(option => {
            const radioItem = document.createElement('label');
            radioItem.className = 'radio-item';

            const input = document.createElement('input');
            input.type = 'radio';
            input.name = widget.command;
            input.value = option.value;
            input.checked = option.value == currentValue;

            const radioCustom = document.createElement('span');
            radioCustom.className = 'radio-custom';

            const radioLabel = document.createElement('span');
            radioLabel.className = 'radio-label';
            radioLabel.textContent = option.label;

            input.addEventListener('change', (e) => {
                if (e.target.checked) {
                    onValueChange(widget.command, option.value);
                }
            });

            radioItem.appendChild(input);
            radioItem.appendChild(radioCustom);
            radioItem.appendChild(radioLabel);
            container.appendChild(radioItem);
        });

        return container;
    }

    createButton(widget, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-button';

        const button = document.createElement('button');
        button.className = 'btn-custom';

        if (widget.icon) {
            const icon = document.createElement('i');
            icon.className = widget.icon;
            button.appendChild(icon);
        }

        const text = document.createElement('span');
        text.textContent = widget.label || widget.title;
        button.appendChild(text);

        button.addEventListener('click', () => {
            onValueChange(widget.command, 'trigger');
        });

        container.appendChild(button);
        return container;
    }

    renderWidgets(widgets, widgetsArea, currentValues, onValueChange, breadcrumbPath) {
        widgetsArea.innerHTML = '';

        if (breadcrumbPath) {
            const breadcrumb = document.createElement('div');
            breadcrumb.className = 'breadcrumb-path';
            breadcrumb.textContent = breadcrumbPath;
            widgetsArea.appendChild(breadcrumb);
        }

        this.setCurrentWidgets(widgets);

        widgets.forEach(widget => {
            const container = document.createElement('div');
            container.className = 'widget-container';

            const title = document.createElement('div');
            title.className = 'widget-title';
            title.textContent = widget.title;
            container.appendChild(title);

            if (widget.help) {
                const help = document.createElement('div');
                help.className = 'widget-help';
                help.textContent = widget.help;
                container.appendChild(help);
            }

            const currentValue = currentValues[widget.command] !== undefined
                ? currentValues[widget.command]
                : widget.default;

            const widgetContent = this.createWidget(widget, currentValue, onValueChange);
            container.appendChild(widgetContent);

            widgetsArea.appendChild(container);
        });
    }

    clearWidgets(widgetsArea) {
        widgetsArea.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-gear"></i>
                <p>Selecione um item na árvore para configurar</p>
            </div>
        `;
        this.setCurrentWidgets([]);
    }
}

window.widgetManager = new WidgetManager();
