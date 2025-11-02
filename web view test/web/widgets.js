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
            case 'chart2d':
                return this.createChart2D(widget, currentValue, onValueChange);
            default:
                const div = document.createElement('div');
                div.textContent = 'Widget não suportado';
                return div;
        }
    }

    createSlider(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-slider';

        const sliderTrack = document.createElement('div');
        sliderTrack.className = 'slider-track';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = widget.min;
        slider.max = widget.max;
        slider.value = currentValue;
        slider.className = 'form-range custom-slider';

        const percentage = ((currentValue - widget.min) / (widget.max - widget.min)) * 100;

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'slider-value-display';
        valueDisplay.innerHTML = `
            <div class="value-badge">${currentValue}${widget.unit || ''}</div>
        `;

        slider.addEventListener('input', (e) => {
            const validValue = this.clamp(parseFloat(e.target.value), widget.min, widget.max);
            e.target.value = validValue;

            const newPercentage = ((validValue - widget.min) / (widget.max - widget.min)) * 100;
            valueDisplay.style.left = `calc(${newPercentage}% - 30px)`;
            valueDisplay.querySelector('.value-badge').textContent = `${validValue}${widget.unit || ''}`;

            onValueChange(widget.command, validValue);
        });

        valueDisplay.style.left = `calc(${percentage}% - 30px)`;

        const rangeLabels = document.createElement('div');
        rangeLabels.className = 'slider-labels';
        rangeLabels.innerHTML = `
            <span class="label-min">${widget.min}</span>
            <span class="label-max">${widget.max}</span>
        `;

        sliderTrack.appendChild(slider);
        sliderTrack.appendChild(valueDisplay);

        container.appendChild(sliderTrack);
        container.appendChild(rangeLabels);
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

    renderWidgets(widgets, widgetsArea, currentValues, onValueChange, breadcrumbPath, modifiedWidgets = new Set()) {
        widgetsArea.innerHTML = '';

        if (breadcrumbPath) {
            const headerRow = document.createElement('div');
            headerRow.className = 'breadcrumb-header';

            const homeBtn = document.createElement('button');
            homeBtn.id = 'homeBtn';
            homeBtn.className = 'home-btn';
            homeBtn.title = 'Voltar para a página inicial';
            homeBtn.innerHTML = '<i class="bi bi-house-fill"></i>';

            const breadcrumb = document.createElement('div');
            breadcrumb.className = 'breadcrumb-path';

            const breadcrumbText = document.createElement('span');
            breadcrumbText.textContent = breadcrumbPath;

            const statusIndicator = document.createElement('div');
            statusIndicator.id = 'statusIndicator';
            statusIndicator.className = 'status-indicator';
            statusIndicator.title = 'Alterações não salvas';

            breadcrumb.appendChild(breadcrumbText);
            breadcrumb.appendChild(statusIndicator);

            headerRow.appendChild(homeBtn);
            headerRow.appendChild(breadcrumb);

            widgetsArea.appendChild(headerRow);
        }

        this.setCurrentWidgets(widgets);

        widgets.forEach(widget => {
            const container = document.createElement('div');
            container.className = 'widget-container';

            const titleRow = document.createElement('div');
            titleRow.className = 'widget-title-row';

            const title = document.createElement('div');
            title.className = 'widget-title';
            title.textContent = widget.title;

            const modifiedIndicator = document.createElement('div');
            modifiedIndicator.className = 'widget-modified-indicator';
            modifiedIndicator.title = 'Widget alterado';

            if (modifiedWidgets.has(widget.command)) {
                modifiedIndicator.style.display = 'block';
            } else {
                modifiedIndicator.style.display = 'none';
            }

            titleRow.appendChild(title);
            titleRow.appendChild(modifiedIndicator);

            container.appendChild(titleRow);

            if (widget.help) {
                const help = document.createElement('div');
                help.className = 'widget-help';
                help.textContent = widget.help;
                container.appendChild(help);
            }

            const currentValue = currentValues[widget.command] !== undefined
                ? currentValues[widget.command]
                : widget.default;

            const widgetContent = this.createWidget(widget, currentValue, (cmd, val) => {
                onValueChange(cmd, val, container);
            });
            container.appendChild(widgetContent);

            widgetsArea.appendChild(container);
        });
    }

    createChart2D(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-chart2d';

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart2d-container';

        const canvas = document.createElement('canvas');
        canvas.className = 'chart2d-canvas';
        canvas.width = widget.width || 400;
        canvas.height = widget.height || 300;

        const ctx = canvas.getContext('2d');

        const xMin = widget.xMin || 0;
        const xMax = widget.xMax || 100;
        const yMin = widget.yMin || 0;
        const yMax = widget.yMax || 100;
        const xLabel = widget.xLabel || 'X';
        const yLabel = widget.yLabel || 'Y';
        const gridSize = widget.gridSize || 10;

        let points = [];
        if (currentValue && typeof currentValue === 'string') {
            const values = currentValue.split(',').map(v => parseFloat(v.trim()));

            if (widget.mode === 'xy') {
                for (let i = 0; i < values.length; i += 2) {
                    if (i + 1 < values.length) {
                        points.push({ x: values[i], y: values[i + 1] });
                    }
                }
            } else {
                points = values.map((y, idx) => ({ x: idx, y: y }));
            }
        }

        let draggingPoint = null;
        let isDragging = false;

        const drawChart = () => {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const padding = 60;
            const chartWidth = canvas.width - padding * 2;
            const chartHeight = canvas.height - padding * 2;

            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 0.5;

            for (let i = 0; i <= gridSize; i++) {
                const x = padding + (chartWidth / gridSize) * i;
                const y = padding + (chartHeight / gridSize) * i;

                ctx.beginPath();
                ctx.moveTo(x, padding);
                ctx.lineTo(x, canvas.height - padding);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(canvas.width - padding, y);
                ctx.stroke();
            }

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(padding, canvas.height - padding);
            ctx.lineTo(canvas.width - padding, canvas.height - padding);
            ctx.lineTo(padding, padding);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(xLabel, canvas.width / 2, canvas.height - 10);

            ctx.save();
            ctx.translate(15, canvas.height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(yLabel, 0, 0);
            ctx.restore();

            ctx.font = '12px Arial';
            ctx.fillStyle = '#999999';

            for (let i = 0; i <= gridSize; i++) {
                const x = padding + (chartWidth / gridSize) * i;
                const xValue = xMin + (xMax - xMin) * (i / gridSize);
                ctx.textAlign = 'center';
                ctx.fillText(xValue.toFixed(0), x, canvas.height - padding + 20);

                const y = canvas.height - padding - (chartHeight / gridSize) * i;
                const yValue = yMin + (yMax - yMin) * (i / gridSize);
                ctx.textAlign = 'right';
                ctx.fillText(yValue.toFixed(0), padding - 10, y + 4);
            }

            if (points.length > 0) {
                ctx.strokeStyle = '#a52a2a';
                ctx.lineWidth = 2;
                ctx.beginPath();

                points.forEach((point, idx) => {
                    const px = padding + ((point.x - xMin) / (xMax - xMin)) * chartWidth;
                    const py = canvas.height - padding - ((point.y - yMin) / (yMax - yMin)) * chartHeight;

                    if (idx === 0) {
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                });

                ctx.stroke();

                ctx.fillStyle = '#8B0000';
                ctx.strokeStyle = '#a52a2a';
                ctx.lineWidth = 2;

                points.forEach(point => {
                    const px = padding + ((point.x - xMin) / (xMax - xMin)) * chartWidth;
                    const py = canvas.height - padding - ((point.y - yMin) / (yMax - yMin)) * chartHeight;

                    ctx.beginPath();
                    ctx.arc(px, py, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                });
            }
        };

        const updateValue = () => {
            if (widget.mode === 'xy') {
                const formattedValue = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(',');
                onValueChange(widget.commandX, formattedValue);
                if (widget.commandY) {
                    onValueChange(widget.commandY, formattedValue);
                }
            } else {
                const formattedValue = points.map(p => p.y.toFixed(2)).join(',');
                onValueChange(widget.command, formattedValue);
            }
        };

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const padding = 60;
            const chartWidth = canvas.width - padding * 2;
            const chartHeight = canvas.height - padding * 2;

            points.forEach((point, idx) => {
                const px = padding + ((point.x - xMin) / (xMax - xMin)) * chartWidth;
                const py = canvas.height - padding - ((point.y - yMin) / (yMax - yMin)) * chartHeight;

                const dist = Math.sqrt((mouseX - px) ** 2 + (mouseY - py) ** 2);
                if (dist < 10) {
                    draggingPoint = idx;
                    isDragging = true;
                }
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || draggingPoint === null) return;

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const padding = 60;
            const chartWidth = canvas.width - padding * 2;
            const chartHeight = canvas.height - padding * 2;

            const newX = xMin + ((mouseX - padding) / chartWidth) * (xMax - xMin);
            const newY = yMin + ((canvas.height - padding - mouseY) / chartHeight) * (yMax - yMin);

            points[draggingPoint].x = this.clamp(newX, xMin, xMax);
            points[draggingPoint].y = this.clamp(newY, yMin, yMax);

            drawChart();
            updateValue();
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            draggingPoint = null;
        });

        drawChart();

        chartContainer.appendChild(canvas);
        container.appendChild(chartContainer);

        return container;
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
