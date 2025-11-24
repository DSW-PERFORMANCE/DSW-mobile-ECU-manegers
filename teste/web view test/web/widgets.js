class WidgetManager {
    constructor() {
        this.currentWidgets = [];
        // Reference to the most recently created chart controller (used by header undo/redo)
        this.latestChartController = null;
        // Header buttons (set when rendering widgets)
        this._undoButton = null;
        this._redoButton = null;
        // Map to track dynamic widgets and their parameter listeners
        this.dynamicWidgets = new Map(); // widgetId -> { parameterCommand, variations, listeners }
        this.dynamicWidgetInstances = new Map(); // widgetInstanceId -> { container, widget, listeners }
        // Map to track table3d controllers for updating data
        this.table3dControllers = new Map(); // command -> Table3DController
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

    /**
     * Resolve the effective widget configuration based on dynamic parameter.
     * If widget has parameterVariations, it will merge the variation config on top of base config.
     * @param {Object} widget - Base widget configuration
     * @param {Object} currentValues - Current ECU values map
     * @returns {Object} - Merged widget configuration
     */
    resolveWidgetVariation(widget, currentValues = {}) {
        // If widget doesn't have dynamic parameters, return as-is
        if (!widget.parameterCommand || !widget.parameterVariations) {
            return widget;
        }

        // Get the parameter value from currentValues
        const parameterValue = currentValues[widget.parameterCommand];
        const variationKey = parameterValue !== undefined 
            ? String(parameterValue)
            : (widget.defaultVariation !== undefined ? widget.defaultVariation : null);

        if (!variationKey || !widget.parameterVariations[variationKey]) {
            return widget; // No matching variation, return base config
        }

        // Merge the variation on top of base widget config
        const variation = widget.parameterVariations[variationKey];
        return {
            ...widget,
            ...variation,
            // Preserve certain fields that shouldn't be overridden
            parameterCommand: widget.parameterCommand,
            parameterVariations: widget.parameterVariations,
            defaultVariation: widget.defaultVariation
        };
    }

    /**
     * Get the resolved command for a widget, considering dynamic variations.
     * Critical: Call this BEFORE any reference to widget.command
     * @param {Object} widget - Base widget configuration
     * @param {Object} currentValues - Current ECU values map
     * @returns {string} - The effective command to use
     */
    getResolvedCommand(widget, currentValues = {}) {
        const resolved = this.resolveWidgetVariation(widget, currentValues);
        return resolved.command;
    }

    /**
     * Get a unique ID for a widget instance (used for tracking dynamic updates)
     */
    getWidgetInstanceId(widget, index) {
        return `${widget.command}_${widget.type}_${index}`;
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
            case 'action_buttons':
                return this.createActionButtons(widget, onValueChange);
            case 'color_toggle':
                return this.createColorToggle(widget, onValueChange);
            case 'checkbox_group':
                return this.createCheckboxGroup(widget, currentValue, onValueChange);
            case 'chart2d':
                return this.createChart2D(widget, currentValue, onValueChange);
            case 'table3d':
                return this.createTable3D(widget, currentValue, onValueChange);
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
        slider.dataset.command = widget.command;

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'slider-value-display';
        valueDisplay.innerHTML = `
            <div class="value-badge">${currentValue}${widget.unit || ''}</div>
        `;

        let sliderChangeInProgress = false;

        slider.addEventListener('input', (e) => {
            const validValue = this.clamp(parseFloat(e.target.value), widget.min, widget.max);
            e.target.value = validValue;
            valueDisplay.querySelector('.value-badge').textContent = `${validValue}${widget.unit || ''}`;
            
            // Route through Communication Bridge for centralized command processing
            if (window.communicationBridge) {
                window.communicationBridge.execute(widget.command, validValue).catch(err => {
                    console.error('Communication Bridge error:', err);
                    onValueChange(widget.command, validValue);
                });
            } else {
                onValueChange(widget.command, validValue);
            }
            
            sliderChangeInProgress = true;
        });

        slider.addEventListener('mouseup', () => {
            // Only push to history when slider drag ends
            if (sliderChangeInProgress && window.globalHistoryManager) {
                window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
                sliderChangeInProgress = false;
            }
        });

        slider.addEventListener('touchend', () => {
            // Also handle touch devices
            if (sliderChangeInProgress && window.globalHistoryManager) {
                window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
                sliderChangeInProgress = false;
            }
        });

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
        input.dataset.command = widget.command;

        const btnPlus = document.createElement('button');
        btnPlus.className = 'spinbox-btn spinbox-plus';
        btnPlus.innerHTML = '<i class="bi bi-plus"></i>';

        const unit = document.createElement('span');
        unit.className = 'spinbox-unit';
        unit.textContent = widget.unit || '';

        const updateValue = (newValue) => {
            const validValue = this.clamp(newValue, widget.min, widget.max);
            input.value = validValue;
            
            // Route through Communication Bridge for centralized command processing
            if (window.communicationBridge) {
                window.communicationBridge.execute(widget.command, validValue).catch(err => {
                    console.error('Communication Bridge error:', err);
                    onValueChange(widget.command, validValue);
                });
            } else {
                onValueChange(widget.command, validValue);
            }
            
            // Push to global history after value change
            if (window.globalHistoryManager) {
                window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
            }
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
        // Get the mode: classic or modern (default: modern)
        const mode = widget.mode || 'modern';
        
        if (mode === 'classic') {
            return this.createComboboxClassic(widget, currentValue, onValueChange);
        } else {
            return this.createComboboxModern(widget, currentValue, onValueChange);
        }
    }

    createComboboxClassic(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-combobox widget-combobox-classic';

        const select = document.createElement('select');
        select.className = 'form-select custom-select';
        select.dataset.command = widget.command;

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
            // Route through Communication Bridge for centralized command processing
            if (window.communicationBridge) {
                window.communicationBridge.execute(widget.command, e.target.value).catch(err => {
                    console.error('Communication Bridge error:', err);
                    onValueChange(widget.command, e.target.value);
                });
            } else {
                onValueChange(widget.command, e.target.value);
            }
            
            // Push to global history after value change
            if (window.globalHistoryManager) {
                window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
            }
        });

        container.appendChild(select);
        return container;
    }

    createComboboxModern(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-combobox widget-combobox-modern';

        // Display button showing current selection
        const displayButton = document.createElement('button');
        displayButton.className = 'combobox-display-button';
        displayButton.type = 'button';
        
        // Find current label
        const currentOption = widget.options.find(opt => opt.value == currentValue);
        const currentLabel = currentOption ? currentOption.label : 'Selecione uma opção';
        displayButton.textContent = currentLabel;
        
        // Store reference to update display later
        displayButton.dataset.command = widget.command;

        // Open modal on click
        displayButton.addEventListener('click', () => {
            this.openComboboxModal(widget, currentValue, (selectedValue) => {
                // Update display
                const selected = widget.options.find(opt => opt.value == selectedValue);
                if (selected) {
                    displayButton.textContent = selected.label;
                }
                
                // Route through Communication Bridge for centralized command processing
                if (window.communicationBridge) {
                    window.communicationBridge.execute(widget.command, selectedValue).catch(err => {
                        console.error('Communication Bridge error:', err);
                        onValueChange(widget.command, selectedValue);
                    });
                } else {
                    onValueChange(widget.command, selectedValue);
                }
                
                // Push to global history
                if (window.globalHistoryManager) {
                    window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
                }
            });
        });

        container.appendChild(displayButton);
        return container;
    }

    /**
     * Open modal for selecting ComboBox option
     */
    openComboboxModal(widget, currentValue, onSelected) {
        // Delegate to DialogManager for centralized modal management with higher priority
        dialogManager.showComboboxModal(widget, currentValue, onSelected);
    }

    createToggle(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-toggle';

        const toggleSwitch = document.createElement('label');
        toggleSwitch.className = 'toggle-switch';

        const input = document.createElement('input');
        input.type = 'checkbox';
        // Normalize initial checked using boolean-friendly check
        input.checked = currentValue === true || currentValue === 'true' || currentValue == 1;
        input.dataset.command = widget.command;

        const slider = document.createElement('span');
        slider.className = 'toggle-slider';

        input.addEventListener('change', (e) => {
            // Use boolean values to match defaults and savedValues (avoids type mismatch)
            const value = !!e.target.checked;
            
            // Route through Communication Bridge for centralized command processing
            if (window.communicationBridge) {
                window.communicationBridge.execute(widget.command, value).catch(err => {
                    console.error('Communication Bridge error:', err);
                    onValueChange(widget.command, value);
                });
            } else {
                onValueChange(widget.command, value);
            }
            
            // Push to global history after value change
            if (window.globalHistoryManager) {
                window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
            }
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
            input.dataset.command = widget.command;

            const radioCustom = document.createElement('span');
            radioCustom.className = 'radio-custom';

            const radioLabel = document.createElement('span');
            radioLabel.className = 'radio-label';
            radioLabel.textContent = option.label;

            input.addEventListener('change', (e) => {
                if (e.target.checked) {
                    // Route through Communication Bridge for centralized command processing
                    if (window.communicationBridge) {
                        window.communicationBridge.execute(widget.command, option.value).catch(err => {
                            console.error('Communication Bridge error:', err);
                            onValueChange(widget.command, option.value);
                        });
                    } else {
                        onValueChange(widget.command, option.value);
                    }
                    
                    // Push to global history after value change
                    if (window.globalHistoryManager) {
                        window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
                    }
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

    createActionButtons(widget, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-action-buttons';

        // Se houver descrição, mostra antes dos botões
        if (widget.description) {
            const description = document.createElement('div');
            description.style.cssText = 'font-size: 14px; color: #999; margin-bottom: 10px;';
            description.textContent = widget.description;
            container.appendChild(description);
        }

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'action-buttons-container';

        // Itera sobre os botões configurados
        if (widget.buttons && Array.isArray(widget.buttons)) {
            widget.buttons.forEach(buttonConfig => {
                const button = document.createElement('button');
                button.className = 'action-button';

                // Adiciona cor (padrão: red)
                const color = buttonConfig.color || 'red';
                button.classList.add(`color-${color}`);

                // Adiciona ícone se existir
                if (buttonConfig.icon) {
                    const icon = document.createElement('i');
                    icon.className = buttonConfig.icon;
                    button.appendChild(icon);
                }

                // Adiciona texto do botão
                const text = document.createElement('span');
                text.textContent = buttonConfig.label || 'Botão';
                button.appendChild(text);

                // Modo do botão: 'press_release' (padrão) ou 'toggle'
                const mode = buttonConfig.mode || 'press_release';
                let toggleState = false; // Estado para modo toggle

                // Função para enviar comando imediatamente (sem valor de soltar)
                const sendCommandImmediate = (command) => {
                    if (!command) return;
                    
                    // Route through Communication Bridge for centralized command processing
                    if (window.communicationBridge) {
                        window.communicationBridge.execute(command, 1).catch(err => {
                            console.error('Communication Bridge error:', err);
                            if (window.ecuCommunication) {
                                console.log(`[ACTION BUTTON] Fallback direto: ${command}`);
                                window.ecuCommunication.sendCommand(command, 1);
                            }
                        });
                    } else if (window.ecuCommunication) {
                        console.log(`[ACTION BUTTON] Enviando direto: ${command}`);
                        window.ecuCommunication.sendCommand(command, 1);
                    }
                };

                if (mode === 'press_release') {
                    // Modo padrão: press ao apertar, release ao soltar
                    button.addEventListener('mousedown', () => {
                        sendCommandImmediate(buttonConfig.commandPress);
                    });

                    button.addEventListener('mouseup', () => {
                        sendCommandImmediate(buttonConfig.commandRelease);
                    });

                    button.addEventListener('mouseout', () => {
                        sendCommandImmediate(buttonConfig.commandRelease);
                    });

                    // Touch events para mobile
                    button.addEventListener('touchstart', () => {
                        sendCommandImmediate(buttonConfig.commandPress);
                    });

                    button.addEventListener('touchend', () => {
                        sendCommandImmediate(buttonConfig.commandRelease);
                    });

                } else if (mode === 'toggle') {
                    // Modo toggle: cada clique alterna entre press e release
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        
                        if (!toggleState) {
                            // Estado OFF → ON (envia press)
                            sendCommandImmediate(buttonConfig.commandPress);
                            button.classList.add('active');
                            toggleState = true;
                        } else {
                            // Estado ON → OFF (envia release)
                            sendCommandImmediate(buttonConfig.commandRelease);
                            button.classList.remove('active');
                            toggleState = false;
                        }
                    });
                }

                buttonsContainer.appendChild(button);
            });
        }

        container.appendChild(buttonsContainer);
        return container;
    }

    createColorToggle(widget, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-color-toggle';

        // Estado interno do toggle (índice da cor atual)
        let currentColorIndex = 0;
        const colors = widget.colors || ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
        
        // Se houver descrição, mostra antes do botão
        if (widget.description) {
            const description = document.createElement('div');
            description.style.cssText = 'font-size: 14px; color: #999; margin-bottom: 10px;';
            description.textContent = widget.description;
            container.appendChild(description);
        }

        const toggleButton = document.createElement('button');
        toggleButton.className = 'color-toggle-button';
        toggleButton.setAttribute('data-color-index', '0');

        // Define a cor inicial
        const initialColor = colors[0];
        toggleButton.classList.add(`color-${initialColor}`);

        // Ícone
        if (widget.icon) {
            const icon = document.createElement('i');
            icon.className = widget.icon;
            toggleButton.appendChild(icon);
        }

        // Texto
        const text = document.createElement('span');
        text.textContent = widget.label || 'Toggle';
        toggleButton.appendChild(text);

        // Função para enviar comando direto (SEM histórico)
        const sendCommand = (colorValue) => {
            // Envia APENAS o comando + valor, sem alterar widgets
            // Simula envio direto para ECU (bypass do histórico)
            if (window.communicationBridge) {
                window.communicationBridge.execute(widget.command, colorValue).catch(err => {
                    console.error('Communication Bridge error:', err);
                    if (window.ecuCommunication) {
                        console.log(`[COLOR TOGGLE] Fallback direto: ${widget.command}=${colorValue}`);
                        window.ecuCommunication.sendCommand(widget.command, colorValue);
                    }
                });
            } else if (window.ecuCommunication) {
                console.log(`[COLOR TOGGLE] Enviando direto: ${widget.command}=${colorValue}`);
                window.ecuCommunication.sendCommand(widget.command, colorValue);
            }
            
            // Notificação visual
            if (window.notificationManager) {
                window.notificationManager.info(`${widget.label}: ${colorValue}`);
            }
        };

        // Event listener para mudar cor ao apertar
        toggleButton.addEventListener('mousedown', () => {
            currentColorIndex = (currentColorIndex + 1) % colors.length;
            const newColor = colors[currentColorIndex];
            
            // Remove classe de cor antiga e adiciona nova
            colors.forEach(color => toggleButton.classList.remove(`color-${color}`));
            toggleButton.classList.add(`color-${newColor}`);
            toggleButton.setAttribute('data-color-index', currentColorIndex);

            // Envia comando com valor de cor
            const colorValue = widget.valueMap ? widget.valueMap[newColor] : newColor;
            sendCommand(colorValue);
        });

        // Opcional: Event listener para mudar cor novamente ao soltar (se configurado)
        if (widget.toggleOnRelease) {
            toggleButton.addEventListener('mouseup', () => {
                currentColorIndex = (currentColorIndex + 1) % colors.length;
                const newColor = colors[currentColorIndex];
                
                colors.forEach(color => toggleButton.classList.remove(`color-${color}`));
                toggleButton.classList.add(`color-${newColor}`);
                toggleButton.setAttribute('data-color-index', currentColorIndex);

                const colorValue = widget.valueMap ? widget.valueMap[newColor] : newColor;
                sendCommand(colorValue);
            });
        }

        // Touch events para mobile
        toggleButton.addEventListener('touchstart', () => {
            currentColorIndex = (currentColorIndex + 1) % colors.length;
            const newColor = colors[currentColorIndex];
            
            colors.forEach(color => toggleButton.classList.remove(`color-${color}`));
            toggleButton.classList.add(`color-${newColor}`);
            toggleButton.setAttribute('data-color-index', currentColorIndex);

            const colorValue = widget.valueMap ? widget.valueMap[newColor] : newColor;
            sendCommand(colorValue);
        });

        if (widget.toggleOnRelease) {
            toggleButton.addEventListener('touchend', () => {
                currentColorIndex = (currentColorIndex + 1) % colors.length;
                const newColor = colors[currentColorIndex];
                
                colors.forEach(color => toggleButton.classList.remove(`color-${color}`));
                toggleButton.classList.add(`color-${newColor}`);
                toggleButton.setAttribute('data-color-index', currentColorIndex);

                const colorValue = widget.valueMap ? widget.valueMap[newColor] : newColor;
                sendCommand(colorValue);
            });
        }

        container.appendChild(toggleButton);
        return container;
    }

    createCheckboxGroup(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-checkbox-group';

        // Frame com as checkboxes
        const checkboxesFrame = document.createElement('div');
        checkboxesFrame.className = 'checkbox-group-frame';

        // Itera sobre as checkboxes configuradas
        if (widget.checkboxes && Array.isArray(widget.checkboxes)) {
            widget.checkboxes.forEach(checkboxConfig => {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'checkbox-item';

                const label = document.createElement('label');
                label.className = 'checkbox-label';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'checkbox-input';

                // Store command and on/off mappings for history and reload
                input.dataset.command = checkboxConfig.command;
                input.dataset.valueOn = String(checkboxConfig.valueOn !== undefined ? checkboxConfig.valueOn : 1);
                input.dataset.valueOff = String(checkboxConfig.valueOff !== undefined ? checkboxConfig.valueOff : 0);

                // Obtém o valor salvo (padrão: off)
                const valueOff = checkboxConfig.valueOff !== undefined ? checkboxConfig.valueOff : 0;
                const valueOn = checkboxConfig.valueOn !== undefined ? checkboxConfig.valueOn : 1;
                const savedValue = currentValue && currentValue[checkboxConfig.command];
                
                // Define se está checked
                input.checked = savedValue === valueOn;

                // Listener para mudança
                input.addEventListener('change', (e) => {
                    const newValue = e.target.checked ? valueOn : valueOff;
                    
                    // Route through Communication Bridge for centralized command processing
                    if (window.communicationBridge) {
                        window.communicationBridge.execute(checkboxConfig.command, newValue).catch(err => {
                            console.error('Communication Bridge error:', err);
                            onValueChange(checkboxConfig.command, newValue);
                        });
                    } else {
                        onValueChange(checkboxConfig.command, newValue);
                    }
                    
                    // Push to global history
                    if (window.globalHistoryManager) {
                        window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
                    }
                });

                // Ícone (se houver)
                if (checkboxConfig.icon) {
                    const icon = document.createElement('i');
                    icon.className = `checkbox-icon ${checkboxConfig.icon}`;
                    label.appendChild(icon);
                }

                // Checkbox visual
                const checkboxVisual = document.createElement('span');
                checkboxVisual.className = 'checkbox-visual';
                label.appendChild(input);
                label.appendChild(checkboxVisual);

                // Texto da checkbox
                const text = document.createElement('span');
                text.className = 'checkbox-text';
                text.textContent = checkboxConfig.label || 'Opção';
                label.appendChild(text);

                // Help text (se houver)
                if (checkboxConfig.help) {
                    const help = document.createElement('div');
                    help.className = 'checkbox-help';
                    help.textContent = checkboxConfig.help;
                    checkboxItem.appendChild(help);
                }

                checkboxItem.appendChild(label);
                checkboxesFrame.appendChild(checkboxItem);
            });
        }

        container.appendChild(checkboxesFrame);
        return container;
    }

    renderWidgets(widgets, widgetsArea, currentValues, onValueChange, breadcrumbPath, modifiedWidgets = new Set()) {
        // Clean up previous dynamic widget listeners
        for (const [id, instance] of this.dynamicWidgetInstances) {
            if (instance.listeners) {
                instance.listeners.forEach(listener => {
                    if (window.ecuManager && window.ecuManager.unsubscribeFromValueChange) {
                        window.ecuManager.unsubscribeFromValueChange(listener.command, listener.callback);
                    }
                });
            }
        }
        this.dynamicWidgetInstances.clear();

        widgetsArea.innerHTML = '';

        if (breadcrumbPath) {
            const headerRow = document.createElement('div');
            headerRow.className = 'breadcrumb-header';

            const homeBtn = document.createElement('button');
            homeBtn.id = 'homeBtn';
            homeBtn.className = 'home-btn';
            homeBtn.title = 'Voltar para a página inicial';
            homeBtn.innerHTML = '<i class="bi bi-house-fill"></i>';

            // Undo / Redo buttons (to the right of the home button)
            const undoBtn = document.createElement('button');
            undoBtn.className = 'undo-btn';
            undoBtn.title = 'Desfazer (Ctrl+Z)';
            undoBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
            undoBtn.disabled = true;

            const redoBtn = document.createElement('button');
            redoBtn.className = 'redo-btn';
            redoBtn.title = 'Refazer (Ctrl+Y)';
            redoBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
            redoBtn.disabled = true;

            // Export / Import buttons
            const exportBtn = document.createElement('button');
            exportBtn.className = 'export-btn';
            exportBtn.title = 'Exportar configuração';
            exportBtn.innerHTML = '<i class="bi bi-upload"></i>';
            exportBtn.id = 'exportBtnHeader';

            const importBtn = document.createElement('button');
            importBtn.className = 'import-btn';
            importBtn.title = 'Importar configuração';
            importBtn.innerHTML = '<i class="bi bi-download"></i>';
            importBtn.id = 'importBtnHeader';

            // Store references for later updates by the chart controller
            this._undoButton = undoBtn;
            this._redoButton = redoBtn;
            this._exportButton = exportBtn;
            this._importButton = importBtn;

            // Wire the buttons to call the latest chart controller when clicked
            undoBtn.addEventListener('click', () => {
                if (window.globalHistoryManager) {
                    const success = window.globalHistoryManager.undo();
                    if (success && window.notificationManager) {
                        window.notificationManager.info('Desfazer: última alteração revertida');
                    } else if (!success && window.notificationManager) {
                        window.notificationManager.warning('Nenhuma alteração anterior para desfazer');
                    }
                } else {
                    if (window.notificationManager) {
                        window.notificationManager.warning('Gerenciador de histórico não disponível');
                    }
                }
            });
            redoBtn.addEventListener('click', () => {
                if (window.globalHistoryManager) {
                    const success = window.globalHistoryManager.redo();
                    if (success && window.notificationManager) {
                        window.notificationManager.info('Refazer: alteração reaplicada');
                    } else if (!success && window.notificationManager) {
                        window.notificationManager.warning('Nenhuma alteração subsequente para refazer');
                    }
                } else {
                    if (window.notificationManager) {
                        window.notificationManager.warning('Gerenciador de histórico não disponível');
                    }
                }
            });

            // Register buttons with global history manager
            if (window.globalHistoryManager) {
                window.globalHistoryManager.setButtons(undoBtn, redoBtn);
            }

            // Wire export/import buttons
            exportBtn.addEventListener('click', () => {
                if (window.ecuManager) {
                    window.ecuManager.exportCurrentConfig();
                }
            });
            importBtn.addEventListener('click', () => {
                document.getElementById('importFileInput').click();
            });

            const headerStrip = document.createElement('div');
            headerStrip.className = 'breadcrumb-strip';

            const breadcrumb = document.createElement('div');
            breadcrumb.className = 'breadcrumb-path';

            const breadcrumbText = document.createElement('span');
            breadcrumbText.textContent = breadcrumbPath;

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-breadcrumb-btn';
            copyBtn.title = 'Copiar caminho';
            copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(breadcrumbPath);
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="bi bi-check2"></i>';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 2000);
            });

            const statusIndicator = document.createElement('div');
            statusIndicator.id = 'statusIndicator';
            statusIndicator.className = 'status-indicator';
            statusIndicator.title = 'Alterações não salvas';

            breadcrumb.appendChild(breadcrumbText);
            breadcrumb.appendChild(copyBtn);
            breadcrumb.appendChild(statusIndicator);

            headerStrip.appendChild(breadcrumb);

            headerRow.appendChild(homeBtn);
            headerRow.appendChild(undoBtn);
            headerRow.appendChild(redoBtn);
            headerRow.appendChild(exportBtn);
            headerRow.appendChild(importBtn);
            headerRow.appendChild(headerStrip);

            widgetsArea.appendChild(headerRow);
        }

        this.setCurrentWidgets(widgets);

        widgets.forEach((widget, widgetIndex) => {
            const container = document.createElement('div');
            container.className = 'widget-container';

            // Resolve widget variation if it has dynamic parameters
            const resolvedWidget = this.resolveWidgetVariation(widget, currentValues);
            const resolvedCommand = resolvedWidget.command;
            const instanceId = this.getWidgetInstanceId(widget, widgetIndex);

            const titleRow = document.createElement('div');
            titleRow.className = 'widget-title-row';

            const title = document.createElement('div');
            title.className = 'widget-title';
            title.textContent = resolvedWidget.title;

            const modifiedIndicator = document.createElement('div');
            modifiedIndicator.className = 'widget-modified-indicator';
            modifiedIndicator.title = 'Widget alterado';

            if (modifiedWidgets.has(resolvedCommand)) {
                modifiedIndicator.style.display = 'block';
            } else {
                modifiedIndicator.style.display = 'none';
            }

            titleRow.appendChild(title);
            titleRow.appendChild(modifiedIndicator);

            container.appendChild(titleRow);

            if (resolvedWidget.help) {
                const help = document.createElement('div');
                help.className = 'widget-help';
                help.textContent = resolvedWidget.help;
                container.appendChild(help);
            }

            // For checkbox_group and table3d, pass the full currentValues map so they can read their own command values
            // For other widgets, pass just the scalar value
            let widgetCurrentValue;
            if (resolvedWidget.type === 'checkbox_group' || resolvedWidget.type === 'table3d') {
                widgetCurrentValue = currentValues; // Pass full map for checkbox_group and table3d
            } else {
                widgetCurrentValue = currentValues[resolvedCommand] !== undefined
                    ? currentValues[resolvedCommand]
                    : resolvedWidget.default;
            }

            const widgetContent = this.createWidget(resolvedWidget, widgetCurrentValue, (cmd, val) => {
                onValueChange(cmd, val, container);
            });
            container.appendChild(widgetContent);

            widgetsArea.appendChild(container);

            // If widget has dynamic parameters, set up listener for parameter changes
            if (widget.parameterCommand && widget.parameterVariations) {
                const listeners = [];
                
                // Create a function that will update the widget when parameter changes
                const updateWidgetVariation = () => {
                    const newResolvedWidget = this.resolveWidgetVariation(widget, currentValues);
                    
                    // Only rebuild if configuration actually changed
                    if (JSON.stringify(this.resolveWidgetVariation(widget, currentValues)) !== 
                        JSON.stringify(resolvedWidget)) {
                        
                        // Update title if it changed
                        if (newResolvedWidget.title !== resolvedWidget.title) {
                            titleRow.querySelector('.widget-title').textContent = newResolvedWidget.title;
                        }

                        // Update help if it changed
                        if (newResolvedWidget.help !== resolvedWidget.help) {
                            const existingHelp = container.querySelector('.widget-help');
                            if (existingHelp) {
                                if (newResolvedWidget.help) {
                                    existingHelp.textContent = newResolvedWidget.help;
                                } else {
                                    existingHelp.remove();
                                }
                            } else if (newResolvedWidget.help) {
                                const help = document.createElement('div');
                                help.className = 'widget-help';
                                help.textContent = newResolvedWidget.help;
                                container.insertBefore(help, container.lastChild);
                            }
                        }

                        // If widget type or critical parameters changed, rebuild the widget
                        if (newResolvedWidget.type !== resolvedWidget.type || 
                            JSON.stringify({min: newResolvedWidget.min, max: newResolvedWidget.max, step: newResolvedWidget.step}) 
                            !== JSON.stringify({min: resolvedWidget.min, max: resolvedWidget.max, step: resolvedWidget.step})) {
                            
                            const oldWidgetContent = container.querySelector(`.widget-${resolvedWidget.type}`);
                            if (oldWidgetContent) {
                                const newWidgetContent = this.createWidget(newResolvedWidget, widgetCurrentValue, (cmd, val) => {
                                    onValueChange(cmd, val, container);
                                });
                                oldWidgetContent.replaceWith(newWidgetContent);
                            }
                        }
                    }
                };

                // Listen to changes on the parameter command
                if (window.ecuManager && window.ecuManager.subscribeToValueChange) {
                    window.ecuManager.subscribeToValueChange(widget.parameterCommand, (newValue) => {
                        currentValues[widget.parameterCommand] = newValue;
                        updateWidgetVariation();
                    });

                    listeners.push({
                        command: widget.parameterCommand,
                        callback: updateWidgetVariation
                    });
                }

                this.dynamicWidgetInstances.set(instanceId, {
                    container,
                    widget,
                    listeners,
                    resolvedWidget
                });
            }
        });
    }

    createChart2D(widget, currentValue, onValueChange) {
        const container = document.createElement('div');
        container.className = 'widget-chart2d';

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart2d-container';

        const canvas = document.createElement('canvas');
        canvas.className = 'chart2d-canvas';
        
        // Define as dimensões iniciais
        const containerWidth = chartContainer.clientWidth - 40; // 40 é o padding total
        canvas.width = Math.max(containerWidth, 400);
        canvas.height = widget.height || Math.min(300, canvas.width * 0.6);
        
        // Adiciona listener para redimensionamento
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const newWidth = Math.max(entry.contentRect.width - 40, 400);
                canvas.width = newWidth;
                canvas.height = widget.height || Math.min(300, newWidth * 0.6);
                drawChart(); // Redesenha o gráfico
            }
        });
        
        resizeObserver.observe(chartContainer);

        const ctx = canvas.getContext('2d');

        const xMin = widget.xMin || 0;
        const xMax = widget.xMax || 100;
        const yMin = widget.yMin || 0;
        const yMax = widget.yMax || 100;
        const xLabel = widget.xLabel || 'X';
        const yLabel = widget.yLabel || 'Y';
        const gridSize = widget.gridSize || 10;
        const mode = widget.mode || 'xy';
        const xFixed = widget.xFixed || null;
        const refLine = widget.refLine ?? null;
        const commandY = widget.command || null;
        const commandX = widget.commandX && widget.commandX.toLowerCase() !== "none" ? widget.commandX : null;

        // ---- Inicialização dos pontos ----
        let points = [];
        if (currentValue && typeof currentValue === 'string') {
            const values = currentValue.split(',').map(v => parseFloat(v.trim()));

            if (mode === 'xy') {
                for (let i = 0; i < values.length; i += 2) {
                    if (i + 1 < values.length) points.push({ x: values[i], y: values[i + 1] });
                }
            } else if (mode === 'y' && xFixed && Array.isArray(xFixed)) {
                for (let i = 0; i < xFixed.length; i++) {
                    const yVal = values[i] ?? 0;
                    points.push({ x: xFixed[i], y: yVal });
                }
            } else {
                points = values.map((y, idx) => ({ x: idx, y }));
            }
        }

        let draggingPoint = null;
        let isDragging = false;
        let tooltipDiv = null;
        const hitRadius = 20; // Aumenta a área de captura dos pontos

        // Reference to history manager for this chart
        const manager = this;
        
        const showValueTooltip = (x, y, xVal, yVal) => {
            if (!tooltipDiv) {
                tooltipDiv = document.createElement('div');
                tooltipDiv.className = 'chart2d-value-tooltip';
                document.body.appendChild(tooltipDiv);
            }
            
            tooltipDiv.style.display = 'block';
            tooltipDiv.style.left = `${x}px`;
            tooltipDiv.style.top = `${y - 35}px`; // Posiciona acima do mouse
            tooltipDiv.textContent = `X: ${xVal.toFixed(2)}, Y: ${yVal.toFixed(2)}`;
        };
        
        const hideValueTooltip = () => {
            if (tooltipDiv) {
                tooltipDiv.style.display = 'none';
            }
        };

        // ---- Função de desenho ----
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

            // Eixos
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(padding, padding);
            ctx.lineTo(padding, canvas.height - padding);
            ctx.lineTo(canvas.width - padding, canvas.height - padding);
            ctx.stroke();

            // Linha de referência opcional
            if (refLine !== null) {
                const yRef = canvas.height - padding - ((refLine - yMin) / (yMax - yMin)) * chartHeight;
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(padding, yRef);
                ctx.lineTo(canvas.width - padding, yRef);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Labels
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
                    if (idx === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                });

                ctx.stroke();

                ctx.fillStyle = '#8B0000';
                ctx.strokeStyle = '#a52a2a';
                ctx.lineWidth = 2;

                points.forEach(point => {
                    const px = padding + ((point.x - xMin) / (xMax - xMin)) * chartWidth;
                    const py = canvas.height - padding - ((point.y - yMin) / (yMax - yMin)) * chartHeight;
                    ctx.beginPath();
                    ctx.arc(px, py, 8, 0, Math.PI * 2); // Aumenta o raio do ponto de 6 para 8
                    ctx.fill();
                    ctx.stroke();
                });
            }
        };

        // ---- Envio dos valores ----
        const updateValue = () => {
            if (mode === 'xy') {
                const xVals = points.map(p => p.x.toFixed(2)).join(',');
                const yVals = points.map(p => p.y.toFixed(2)).join(',');

                if (commandX) onValueChange(commandX, xVals);
                else onValueChange(commandY, points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(','));

                if (commandY && commandX) onValueChange(commandY, yVals);
            } else {
                const yVals = points.map(p => p.y.toFixed(2)).join(',');
                onValueChange(commandY, yVals);
            }
        };

        // ---- Interação ----
        canvas.addEventListener('mousedown', (e) => {
            // Map client (CSS) coordinates into canvas internal coordinates to account for any
            // differences between the canvas element size and its drawing buffer. This fixes
            // imprecision when the canvas is resized or on high-DPI displays.
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mouseX = (e.clientX - rect.left) * scaleX;
            const mouseY = (e.clientY - rect.top) * scaleY;

            const padding = 60;
            const chartWidth = canvas.width - padding * 2;
            const chartHeight = canvas.height - padding * 2;

            let pointFound = false;
            for (let idx = 0; idx < points.length; idx++) {
                const point = points[idx];
                const px = padding + ((point.x - xMin) / (xMax - xMin)) * chartWidth;
                const py = canvas.height - padding - ((point.y - yMin) / (yMax - yMin)) * chartHeight;
                const dist = Math.sqrt((mouseX - px) ** 2 + (mouseY - py) ** 2);
                
                if (dist < hitRadius) {
                    // Shift+Click para editar coordenadas
                    if (e.shiftKey) {
                        e.preventDefault();
                        (async () => {
                            const result = await window.dialogManager.editPointCoordinates(
                                point,
                                xMin, xMax,
                                yMin, yMax,
                                mode === 'y' && xFixed !== null // X é bloqueado se mode é 'y'
                            );
                            if (result) {
                                points[idx].x = result.x;
                                points[idx].y = result.y;
                                if (mode === 'y' && xFixed && Array.isArray(xFixed)) {
                                    points.sort((a, b) => a.x - b.x);
                                }
                                drawChart();
                                updateValue();
                            }
                        })();
                    } else {
                        draggingPoint = idx;
                        isDragging = true;
                        pointFound = true;
                    }
                    break;
                }
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            // Map client coords into canvas internal coords
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mouseX = (e.clientX - rect.left) * scaleX;
            const mouseY = (e.clientY - rect.top) * scaleY;

            const padding = 60;
            const chartWidth = canvas.width - padding * 2;
            const chartHeight = canvas.height - padding * 2;

            // Muda o cursor quando está sobre um ponto
            let onPoint = false;
            for (let idx = 0; idx < points.length; idx++) {
                const point = points[idx];
                const px = padding + ((point.x - xMin) / (xMax - xMin)) * chartWidth;
                const py = canvas.height - padding - ((point.y - yMin) / (yMax - yMin)) * chartHeight;
                const dist = Math.sqrt((mouseX - px) ** 2 + (mouseY - py) ** 2);
                
                if (dist < hitRadius) {
                    canvas.style.cursor = 'grab';
                    canvas.title = 'Arraste para mover • Shift+Clique para editar';
                    onPoint = true;
                    break;
                }
            }
            if (!onPoint) {
                canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
                canvas.title = '';
            }

            if (isDragging && draggingPoint !== null) {
                // Use the mapped mouse coordinates for calculations
                const newX = xMin + ((mouseX - padding) / chartWidth) * (xMax - xMin);
                const newY = yMin + ((canvas.height - padding - mouseY) / chartHeight) * (yMax - yMin);

                if (mode === 'xy') points[draggingPoint].x = this.clamp(newX, xMin, xMax);
                points[draggingPoint].y = this.clamp(newY, yMin, yMax);

                showValueTooltip(e.clientX, e.clientY, points[draggingPoint].x, points[draggingPoint].y);
                drawChart();
                updateValue();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                hideValueTooltip();
                isDragging = false;
                draggingPoint = null;
                // Push final state after drag completes
                if (window.globalHistoryManager) {
                    window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
                }
            }
        });

        drawChart();
        chartContainer.appendChild(canvas);
        container.appendChild(chartContainer);
        return container;
    }

    createTable3D(widget, currentValue, onValueChange) {
        // Table3D precisa de um mapa de valores para cada rowCommand
        // Se currentValue é apenas um valor scalar, criamos um mapa vazio
        // Se é um objeto (mapa), passamos como está
        let valueMap = {};
        
        if (widget.rowCommands && Array.isArray(widget.rowCommands)) {
            // Cria mapa de comandos -> valores
            if (typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)) {
                // currentValue já é um mapa, usa como está
                valueMap = currentValue;
            } else {
                // Cria mapa vazio (valores default serão usados)
                widget.rowCommands.forEach(cmd => {
                    valueMap[cmd] = undefined;
                });
            }
        }

        const controller = new Table3DController(widget, valueMap, onValueChange);
        
        // Registra o controlador para atualizações futuras
        if (widget.rowCommands && widget.rowCommands.length > 0) {
            this.table3dControllers.set(widget.rowCommands[0], controller);
        }
        
        return controller.create();
    }

    /**
     * Atualiza dados de table3d após recarregar valores da ECU
     */
    updateTable3DData(currentValues) {
        for (const [key, controller] of this.table3dControllers) {
            if (controller && controller.widget && controller.widget.rowCommands) {
                // Reconstrói o mapa de valores
                const valueMap = {};
                for (const rowCmd of controller.widget.rowCommands) {
                    valueMap[rowCmd] = currentValues[rowCmd];
                }
                
                // Atualiza também os eixos
                if (controller.widget.xAxis && controller.widget.xAxis.command) {
                    valueMap[controller.widget.xAxis.command] = currentValues[controller.widget.xAxis.command];
                }
                if (controller.widget.yAxis && controller.widget.yAxis.command) {
                    valueMap[controller.widget.yAxis.command] = currentValues[controller.widget.yAxis.command];
                }
                
                // Chama o método de atualização do controller
                if (controller.updateDataFromValues) {
                    controller.updateDataFromValues(valueMap);
                }
            }
        }
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
