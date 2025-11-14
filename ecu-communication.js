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

                    // Checkbox group inner commands
                    for (const w of node.widgets) {
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
