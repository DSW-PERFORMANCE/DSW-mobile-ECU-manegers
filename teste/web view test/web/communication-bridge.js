/**
 * Communication Bridge
 * Camada intermediária entre widgets e ECU Communication
 * Filtra, valida e ajusta comandos antes do envio
 * 
 * Responsabilidades:
 * - Validar comandos
 * - Ajustar formatos de dados
 * - Aplicar transformações necessárias
 * - Registrar histórico de comandos
 * - Garantir integridade dos dados
 */
class CommunicationBridge {
    constructor() {
        this.commandHistory = [];
        this.maxHistorySize = 1000;
        this.filters = [];
        this.transformers = [];
        this.validators = [];
        this.logging = true;
        
        // Registra filtros, transformers e validators padrão
        this.registerDefaultRules();
    }

    /**
     * Registra regras padrão de filtro, transformação e validação
     */
    registerDefaultRules() {
        // Validador: garante que comando não é vazio
        this.registerValidator('notEmpty', (command, value) => {
            if (!command || command.trim().length === 0) {
                return { valid: false, reason: 'Comando vazio' };
            }
            return { valid: true };
        });

        // Transformador: converte booleanos para 0/1
        this.registerTransformer('booleanTo01', (command, value) => {
            if (typeof value === 'boolean') {
                return { command, value: value ? 1 : 0 };
            }
            return { command, value };
        });

        // Transformador: converte strings numéricas para números
        this.registerTransformer('stringToNumber', (command, value) => {
            if (typeof value === 'string' && !isNaN(value) && value.trim().length > 0) {
                return { command, value: parseFloat(value) };
            }
            return { command, value };
        });

        // Transformador: garante valores de array sejam strings CSV
        this.registerTransformer('arrayToCSV', (command, value) => {
            if (Array.isArray(value)) {
                return { command, value: value.join(',') };
            }
            return { command, value };
        });

        // Filtro: ignora comandos de controle (ação buttons)
        this.registerFilter('ignoreActionCommands', (command, value) => {
            if (command === 'trigger' || command === 'trigger_press' || command === 'trigger_release') {
                return false; // Bloqueia
            }
            return true; // Permite
        });
    }

    /**
     * Registra um filtro customizado
     * @param {string} name - Nome do filtro
     * @param {Function} fn - (command, value) => boolean
     */
    registerFilter(name, fn) {
        this.filters.push({ name, fn });
        this.log(`Filtro registrado: ${name}`);
    }

    /**
     * Registra um transformador customizado
     * @param {string} name - Nome do transformador
     * @param {Function} fn - (command, value) => {command, value}
     */
    registerTransformer(name, fn) {
        this.transformers.push({ name, fn });
        this.log(`Transformador registrado: ${name}`);
    }

    /**
     * Registra um validador customizado
     * @param {string} name - Nome do validador
     * @param {Function} fn - (command, value) => {valid, reason?}
     */
    registerValidator(name, fn) {
        this.validators.push({ name, fn });
        this.log(`Validador registrado: ${name}`);
    }

    /**
     * Processa um comando antes do envio
     * @param {string} command - Comando a enviar
     * @param {*} value - Valor do comando
     * @returns {Object} {success, command, value, reason?}
     */
    async processCommand(command, value) {
        try {
            let processedCommand = command;
            let processedValue = value;

            // 1. FILTRAR: bloqueia comandos que não passam pelos filtros
            for (const filter of this.filters) {
                const allowed = filter.fn(processedCommand, processedValue);
                if (!allowed) {
                    this.log(`❌ Comando bloqueado por filtro "${filter.name}": ${processedCommand}`, 'warn');
                    return {
                        success: false,
                        command: processedCommand,
                        value: processedValue,
                        reason: `Bloqueado por filtro: ${filter.name}`
                    };
                }
            }

            // 2. TRANSFORMAR: ajusta o formato dos dados
            for (const transformer of this.transformers) {
                try {
                    const result = transformer.fn(processedCommand, processedValue);
                    if (result.command) processedCommand = result.command;
                    if (result.value !== undefined) processedValue = result.value;
                    this.log(`✓ Transformador "${transformer.name}" aplicado: ${processedCommand}=${processedValue}`, 'debug');
                } catch (e) {
                    this.log(`⚠ Erro no transformador "${transformer.name}": ${e.message}`, 'warn');
                }
            }

            // 3. VALIDAR: garante que comando está correto
            for (const validator of this.validators) {
                const result = validator.fn(processedCommand, processedValue);
                if (!result.valid) {
                    this.log(`❌ Validação falhou "${validator.name}": ${result.reason}`, 'warn');
                    return {
                        success: false,
                        command: processedCommand,
                        value: processedValue,
                        reason: `Validação falhou: ${result.reason}`
                    };
                }
            }

            // 4. REGISTRAR no histórico
            this.recordCommand(processedCommand, processedValue, 'pending');

            this.log(`✅ Comando processado com sucesso: ${processedCommand}=${processedValue}`, 'debug');

            return {
                success: true,
                command: processedCommand,
                value: processedValue
            };

        } catch (error) {
            this.log(`❌ Erro ao processar comando: ${error.message}`, 'error');
            return {
                success: false,
                command,
                value,
                reason: error.message
            };
        }
    }

    /**
     * Envia comando processado para ECU Communication
     * @param {string} command - Comando validado
     * @param {*} value - Valor validado
     * @returns {Promise<boolean>} Sucesso do envio
     */
    async sendCommand(command, value) {
        if (!window.ecuCommunication) {
            this.log('❌ ECU Communication não disponível', 'error');
            return false;
        }

        try {
            const result = await window.ecuCommunication.sendCommand(command, value);
            this.recordCommand(command, value, result ? 'sent' : 'failed');
            return result;
        } catch (error) {
            this.log(`❌ Erro ao enviar comando: ${error.message}`, 'error');
            this.recordCommand(command, value, 'error');
            return false;
        }
    }

    /**
     * Pipeline completo: processa + envia
     * @param {string} command - Comando
     * @param {*} value - Valor
     * @returns {Promise<Object>} {success, command, value, reason?}
     */
    async execute(command, value) {
        // Processa
        const processed = await this.processCommand(command, value);
        
        if (!processed.success) {
            return processed;
        }

        // Envia
        const sent = await this.sendCommand(processed.command, processed.value);
        
        return {
            success: sent,
            command: processed.command,
            value: processed.value
        };
    }

    /**
     * Registra comando no histórico
     * @param {string} command - Comando
     * @param {*} value - Valor
     * @param {string} status - 'pending', 'sent', 'failed', 'error'
     */
    recordCommand(command, value, status = 'sent') {
        const record = {
            timestamp: new Date().toISOString(),
            command,
            value,
            status
        };

        this.commandHistory.push(record);

        // Limita tamanho do histórico
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory.shift();
        }

        this.log(`[${status.toUpperCase()}] ${command}=${value}`);
    }

    /**
     * Retorna histórico de comandos
     * @param {number} limit - Número máximo de registros (default: 50)
     * @returns {Array} Histórico
     */
    getHistory(limit = 50) {
        return this.commandHistory.slice(-limit);
    }

    /**
     * Limpa histórico
     */
    clearHistory() {
        this.commandHistory = [];
        this.log('Histórico limpo');
    }

    /**
     * Exporta histórico como CSV
     * @returns {string} Dados em formato CSV
     */
    exportHistoryAsCSV() {
        const headers = 'Timestamp,Command,Value,Status\n';
        const rows = this.commandHistory
            .map(r => `${r.timestamp},"${r.command}","${r.value}",${r.status}`)
            .join('\n');
        return headers + rows;
    }

    /**
     * Ativa/desativa logging
     * @param {boolean} enabled - true para ativar, false para desativar
     */
    setLogging(enabled) {
        this.logging = enabled;
    }

    /**
     * Log interno
     * @param {string} message - Mensagem
     * @param {string} level - 'debug', 'info', 'warn', 'error'
     */
    log(message, level = 'info') {
        if (!this.logging) return;

        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[Bridge ${timestamp}]`;

        switch (level) {
            case 'debug':
                console.debug(`${prefix} ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ${message}`);
                break;
            case 'error':
                console.error(`${prefix} ${message}`);
                break;
            case 'info':
            default:
                console.log(`${prefix} ${message}`);
                break;
        }
    }
}

// Instância global
window.communicationBridge = new CommunicationBridge();
