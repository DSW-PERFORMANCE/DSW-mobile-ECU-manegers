class ECUCommunication {
    constructor() {
        this.isOnline = false;
        this.config = null;

        // tempo entre checagens de status (ms)
        this.pollInterval = 2000;
        this._pollHandle = null;

        // Inicializa integração com Python
        this.initPyLink();

        // garante parar polling se a página for fechada / recarregada
        window.addEventListener('beforeunload', () => this.stopStatusPolling());
    }

    async initPyLink() {
        if (!window.pywebview) {
            window.addEventListener('pywebviewready', async () => {
                try {
                    const status = await window.pywebview.api.get_status();
                    this.setStatus(status.online);
                } catch (e) {
                    this.setStatus(false);
                }
                this.startStatusPolling();
            });
        } else {
            try {
                const status = await window.pywebview.api.get_status();
                this.setStatus(status.online);
            } catch (e) {
                this.setStatus(false);
            }
            this.startStatusPolling();
        }
    }

    startStatusPolling() {
        // evita múltiplos timers
        if (this._pollHandle) return;

        this._pollHandle = setInterval(async () => {
            if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.get_status) {
                // pywebview não pronto -> setar offline e continuar tentando
                if (this.isOnline) this.setStatus(false);
                return;
            }

            try {
                const status = await window.pywebview.api.get_status();
                // se mudou, atualiza badge
                if (typeof status === 'object' && 'online' in status) {
                    if (status.online !== this.isOnline) {
                        this.setStatus(status.online);
                    }
                } else {
                    // resposta inesperada -> assume offline
                    if (this.isOnline) this.setStatus(false);
                }
            } catch (err) {
                // falha na chamada (ex: backend desconectou). marca offline e continua tentando.
                if (this.isOnline) this.setStatus(false);
            }
        }, this.pollInterval);
    }

    stopStatusPolling() {
        if (this._pollHandle) {
            clearInterval(this._pollHandle);
            this._pollHandle = null;
        }
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
        if (!statusBadge) return;

        if (this.isOnline) {
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = 'ONLINE';
        } else {
            statusBadge.className = 'badge bg-danger';
            statusBadge.textContent = 'OFFLINE';
        }
    }

    async sendCommand(command, value) {
        if (!this.isOnline || !window.pywebview) {
            console.log(`[OFFLINE] Não é possível enviar: ${command}=${value}`);
            return false;
        }

        try {
            const result = await window.pywebview.api.send_command(command, value);
            if (result.ok) {
                console.log(`[ECU] Enviado: ${command}=${value}`);
                console.log(`[ECU] Resposta: ${result.response}`);
                return true;
            } else {
                console.warn(`[ERRO] ${result.error}`);
                this.setStatus(false);
                return false;
            }
        } catch (err) {
            console.error(`[ECU] Falha no envio: ${err}`);
            this.setStatus(false);
            return false;
        }
    }

    async queryCommand(command) {
        if (!this.isOnline || !window.pywebview) {
            const defaultValue = this.getDefaultValue(command);
            console.log(`[OFFLINE] Retornando valor padrão para ${command}: ${defaultValue}`);
            return defaultValue;
        }

        try {
            const result = await window.pywebview.api.query_command(command);
            if (result.ok) {
                console.log(`[ECU] Consultado: ${command}?`);
                console.log(`[ECU] Resposta: ${command}=${result.value}`);
                return result.value;
            } else {
                console.warn(`[ERRO] ${result.error}`);
                this.setStatus(false);
                return this.getDefaultValue(command);
            }
        } catch (err) {
            console.error(`[ECU] Falha na consulta: ${err}`);
            this.setStatus(false);
            return this.getDefaultValue(command);
        }
    }

    async saveCurrentScreen(widgets, currentValues) {
        console.log('=== SALVANDO WIDGETS DA TELA ATUAL ===');

        if (!this.isOnline) {
            console.warn('[OFFLINE] Não é possível salvar enquanto offline');
            this.showNotification('ECU offline! Conecte para salvar.', 'warning');
            return false;
        }

        for (const widget of widgets) {
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
                    const widget = node.widgets.find(w => w.command === command);
                    if (widget) return widget.default;
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
                    defaults[widget.command] = widget.default;
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
