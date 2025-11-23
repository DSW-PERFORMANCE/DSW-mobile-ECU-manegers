class ECUCommunication {
    constructor() {
        this.isOnline = false;
        this.config = null;
    }

    setConfig(config) {
        this.config = config;
    }

    setStatus(online) {
        this.isOnline = online;
        this.updateStatusBadge();
    }

    getStatus() {
        return this.isOnline;
    }

    updateStatusBadge() {
        const statusBadge = document.getElementById('statusBadge');
        if (this.isOnline) {
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = 'ONLINE';
        } else {
            statusBadge.className = 'badge bg-danger';
            statusBadge.textContent = 'OFFLINE';
        }
    }

    async sendCommand(command, value) {
        if (!this.isOnline) {
            console.log(`[OFFLINE] Não é possível enviar: ${command}=${value}`);
            return false;
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`[ECU] Enviado: ${command}=${value}`);
                console.log(`[ECU] Resposta: OK`);
                resolve(true);
            }, 50);
        });
    }

    async queryCommand(command) {
        if (!this.isOnline) {
            const defaultValue = this.getDefaultValue(command);
            console.log(`[OFFLINE] Retornando valor padrão para ${command}: ${defaultValue}`);
            return defaultValue;
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                const simulatedValue = this.getDefaultValue(command);
                console.log(`[ECU] Consultado: ${command}?`);
                console.log(`[ECU] Resposta: ${command}=${simulatedValue}`);
                resolve(simulatedValue);
            }, 50);
        });
    }

    async saveCurrentScreen(widgets, currentValues) {
        console.log('=== SALVANDO WIDGETS DA TELA ATUAL ===');

        if (!this.isOnline) {
            console.warn('[OFFLINE] Não é possível salvar enquanto offline');
            this.showNotification('ECU offline! Conecte para salvar.', 'warning');
            return false;
        }

        for (const widget of widgets) {
            // Ignore widgets that don't represent stored values (action buttons, plain buttons)
            if (!widget) continue;
            if (widget.type === 'action_buttons' || widget.type === 'button') continue;

            // Table3D widgets have multiple rowCommands, each representing a row of data
            if (widget.type === 'table3d' && Array.isArray(widget.rowCommands)) {
                console.log(`[Table3D] Enviando ${widget.rowCommands.length} linhas...`);
                for (const rowCmd of widget.rowCommands) {
                    if (!rowCmd) continue;
                    const value = currentValues[rowCmd];
                    const commandStr = `${rowCmd}=${value}`;
                    console.log(`Enviando: ${commandStr}`);
                    await this.sendCommand(rowCmd, value);
                }
                // Also send axis commands if present
                if (widget.xAxis && widget.xAxis.command) {
                    const xValue = currentValues[widget.xAxis.command];
                    if (xValue !== undefined) {
                        console.log(`Enviando Eixo X: ${widget.xAxis.command}=${xValue}`);
                        await this.sendCommand(widget.xAxis.command, xValue);
                    }
                }
                if (widget.yAxis && widget.yAxis.command) {
                    const yValue = currentValues[widget.yAxis.command];
                    if (yValue !== undefined) {
                        console.log(`Enviando Eixo Y: ${widget.yAxis.command}=${yValue}`);
                        await this.sendCommand(widget.yAxis.command, yValue);
                    }
                }
                continue;
            }

            // Checkbox groups contain multiple checkbox entries, each with its own command
            if (widget.type === 'checkbox_group' && Array.isArray(widget.checkboxes)) {
                for (const cb of widget.checkboxes) {
                    if (!cb || !cb.command) continue;
                    const value = currentValues[cb.command];
                    const commandStr = `${cb.command}=${value}`;
                    console.log(`Enviando: ${commandStr}`);
                    await this.sendCommand(cb.command, value);
                }
                continue;
            }

            // If widget has no command, skip it
            if (!widget.command) continue;

            const value = currentValues[widget.command];
            const commandStr = `${widget.command}=${value}`;
            console.log(`Enviando: ${commandStr}`);
            await this.sendCommand(widget.command, value);
        }

        console.log('=== SALVAMENTO CONCLUÍDO ===');
        this.showNotification('Configurações salvas na ECU!', 'success');
        return true;
    }

    async reloadCurrentScreen(widgets) {
        console.log('=== RECARREGANDO WIDGETS DA TELA ATUAL ===');

        const reloadedValues = {};

        for (const widget of widgets) {
            if (!widget) continue;
            if (widget.type === 'action_buttons' || widget.type === 'button') continue;

            // Table3D widgets have multiple rowCommands, each representing a row of data
            if (widget.type === 'table3d' && Array.isArray(widget.rowCommands)) {
                console.log(`[Table3D] Carregando ${widget.rowCommands.length} linhas...`);
                for (const rowCmd of widget.rowCommands) {
                    if (!rowCmd) continue;
                    const commandStr = `${rowCmd}?`;
                    console.log(`Consultando: ${commandStr}`);
                    const value = await this.queryCommand(rowCmd);
                    reloadedValues[rowCmd] = value;
                }
                // Also query axis commands if present
                if (widget.xAxis && widget.xAxis.command) {
                    const commandStr = `${widget.xAxis.command}?`;
                    console.log(`Consultando Eixo X: ${commandStr}`);
                    const value = await this.queryCommand(widget.xAxis.command);
                    reloadedValues[widget.xAxis.command] = value;
                }
                if (widget.yAxis && widget.yAxis.command) {
                    const commandStr = `${widget.yAxis.command}?`;
                    console.log(`Consultando Eixo Y: ${commandStr}`);
                    const value = await this.queryCommand(widget.yAxis.command);
                    reloadedValues[widget.yAxis.command] = value;
                }
                continue;
            }

            if (widget.type === 'checkbox_group' && Array.isArray(widget.checkboxes)) {
                for (const cb of widget.checkboxes) {
                    if (!cb || !cb.command) continue;
                    const commandStr = `${cb.command}?`;
                    console.log(`Consultando: ${commandStr}`);
                    const value = await this.queryCommand(cb.command);
                    reloadedValues[cb.command] = value;
                }
                continue;
            }

            if (!widget.command) continue;
            const commandStr = `${widget.command}?`;
            console.log(`Consultando: ${commandStr}`);
            const value = await this.queryCommand(widget.command);
            reloadedValues[widget.command] = value;
        }

        console.log('=== VALORES RECARREGADOS ===');
        console.log(reloadedValues);

        const message = this.isOnline
            ? 'Valores recarregados da ECU!'
            : 'Valores padrão carregados (ECU offline)';

        this.showNotification(message, 'info');
        return reloadedValues;
    }

    getDefaultValue(command) {
        if (!this.config) {
            return 0;
        }

        const findDefault = (nodes) => {
            for (const node of nodes) {
                if (node.widgets) {
                    // Direct widget command
                    const widget = node.widgets.find(w => w.command === command);
                    if (widget) return widget.default;

                    // Table3D row commands
                    for (const w of node.widgets) {
                        if (w.type === 'table3d' && Array.isArray(w.rowCommands)) {
                            if (w.rowCommands.includes(command)) {
                                // Return default values as comma-separated string
                                // Use middle value between min and max
                                const cols = w.cols || 20;
                                const minVal = w.min !== undefined ? w.min : 0;
                                const maxVal = w.max !== undefined ? w.max : 100;
                                const midVal = (minVal + maxVal) / 2;
                                const defaultStr = Array(cols).fill(midVal).join(',');
                                return defaultStr;
                            }
                            // Also check axis commands
                            if (w.xAxis && w.xAxis.command === command) {
                                // Generate axis values linearly
                                const cols = w.cols || 20;
                                const axisMin = w.xAxis.min !== undefined ? w.xAxis.min : 0;
                                const axisMax = w.xAxis.max !== undefined ? w.xAxis.max : 100;
                                const axisValues = [];
                                for (let i = 0; i < cols; i++) {
                                    const val = axisMin + (axisMax - axisMin) * (i / (cols - 1));
                                    axisValues.push(val.toFixed(2));
                                }
                                return axisValues.join(',');
                            }
                            if (w.yAxis && w.yAxis.command === command) {
                                // Generate axis values linearly
                                const rows = w.rows || 20;
                                const axisMin = w.yAxis.min !== undefined ? w.yAxis.min : 0;
                                const axisMax = w.yAxis.max !== undefined ? w.yAxis.max : 100;
                                const axisValues = [];
                                for (let i = 0; i < rows; i++) {
                                    const val = axisMin + (axisMax - axisMin) * (i / (rows - 1));
                                    axisValues.push(val.toFixed(2));
                                }
                                return axisValues.join(',');
                            }
                        }

                        // Checkbox group inner commands
                        if (w.type === 'checkbox_group' && Array.isArray(w.checkboxes)) {
                            const cb = w.checkboxes.find(c => c.command === command);
                            if (cb) return cb.default !== undefined ? cb.default : (cb.valueOff !== undefined ? cb.valueOff : 0);
                        }
                    }
                }
                if (node.children) {
                    const result = findDefault(node.children);
                    if (result !== undefined) return result;
                }
            }
            return undefined;
        };

        const defaultValue = findDefault(this.config.tree);
        return defaultValue !== undefined ? defaultValue : 0;
    }

    getAllDefaultValues() {
        if (!this.config) {
            return {};
        }

        const defaults = {};

        const processNode = (node) => {
            if (node.widgets) {
                node.widgets.forEach(widget => {
                    if (widget.type === 'checkbox_group' && Array.isArray(widget.checkboxes)) {
                        widget.checkboxes.forEach(cb => {
                            defaults[cb.command] = cb.default !== undefined ? cb.default : (cb.valueOff !== undefined ? cb.valueOff : 0);
                        });
                    } else if (widget.type === 'table3d' && Array.isArray(widget.rowCommands)) {
                        // Add default values for each row command
                        const cols = widget.cols || 20;
                        const minVal = widget.min !== undefined ? widget.min : 0;
                        const maxVal = widget.max !== undefined ? widget.max : 100;
                        const midVal = (minVal + maxVal) / 2;
                        const defaultStr = Array(cols).fill(midVal).join(',');
                        
                        widget.rowCommands.forEach(cmd => {
                            defaults[cmd] = defaultStr;
                        });
                        
                        // Also add axis defaults if present
                        if (widget.xAxis && widget.xAxis.command) {
                            const axisMin = widget.xAxis.min !== undefined ? widget.xAxis.min : 0;
                            const axisMax = widget.xAxis.max !== undefined ? widget.xAxis.max : 100;
                            const axisValues = [];
                            for (let i = 0; i < cols; i++) {
                                const val = axisMin + (axisMax - axisMin) * (i / (cols - 1));
                                axisValues.push(val.toFixed(2));
                            }
                            defaults[widget.xAxis.command] = axisValues.join(',');
                        }
                        if (widget.yAxis && widget.yAxis.command) {
                            const rows = widget.rows || 20;
                            const axisMin = widget.yAxis.min !== undefined ? widget.yAxis.min : 0;
                            const axisMax = widget.yAxis.max !== undefined ? widget.yAxis.max : 100;
                            const axisValues = [];
                            for (let i = 0; i < rows; i++) {
                                const val = axisMin + (axisMax - axisMin) * (i / (rows - 1));
                                axisValues.push(val.toFixed(2));
                            }
                            defaults[widget.yAxis.command] = axisValues.join(',');
                        }
                    } else if (widget.command) {
                        defaults[widget.command] = widget.default;
                    }
                });
            }
            if (node.children) {
                node.children.forEach(child => processNode(child));
            }
        };

        this.config.tree.forEach(node => processNode(node));
        return defaults;
    }

    showNotification(message, type) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        if (window.notificationManager) {
            window.notificationManager[type](message);
        }
    }
}

window.ecuCommunication = new ECUCommunication();
