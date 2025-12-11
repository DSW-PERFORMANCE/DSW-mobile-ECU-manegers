/**
 * common-info.js
 * 
 * Sistema de coleta automática de dados diagnósticos do ECU
 * - Polling de baixa prioridade quando ECU está online
 * - Pausa automática quando há operações prioritárias (save/load)
 * - Modo emergência após 3 falhas consecutivas
 * - Expõe dados globalmente via window.CommonInfo
 */

(function () {
    const CommonInfo = {
        // Estado do sistema
        isOnline: false,
        isPaused: false,
        isPolling: false,
        isEmergencyMode: false,
        failureCount: 0,
        maxConsecutiveFailures: 3,
        
        // Configuração
        config: null,
        pollingInterval: null,
        pollingFrequency: 500, // ms padrão
        
        // Dados coletados
        data: {},
        defaultData: {}, // valores padrão do JSON
        lastFetchTime: null,
        fetchCount: 0,
        successCount: 0,
        
        // Callbacks / subscribers
        _listeners: new Set(),
        
        /**
         * Inicializa o sistema de coleta de dados comuns
         */
        init() {
            console.log('[CommonInfo] 🟢 Inicializando sistema de diagnósticos comuns...');
            
            // Carregar configuração do ECU
            this.loadEcuConfig();
            
            // Inicializar objeto de dados com valores padrão
            this.initializeDataObject();
            
            // Monitorar status de conexão
            this.setupConnectionMonitoring();
            
            // Monitorar operações prioritárias
            this.setupPriorityMonitoring();
            
            console.log('[CommonInfo] ✅ Sistema inicializado com sucesso');
            this.logStatus();
        },
        
        /**
         * Carrega configuração do ECU do su.json
         */
        loadEcuConfig() {
            if (!window.ecuManager || !window.ecuManager.config) {
                console.warn('[CommonInfo] ⚠️ ecuManager não disponível');
                return;
            }
            
            const fullConfig = window.ecuManager.config;
            if (!fullConfig.ecuInfo) {
                console.warn('[CommonInfo] ⚠️ Seção ecuInfo não encontrada em su.json');
                return;
            }
            
            this.config = fullConfig.ecuInfo;
            this.pollingFrequency = this.config.commonDiagnosticsFrequency || 500;
            
            console.log('[CommonInfo] 📋 Configuração carregada:', {
                modelo: this.config.model,
                ativo: this.config.enabled,
                comando: this.config.commonDiagnosticsCommand,
                frequencia: `${this.pollingFrequency}ms`,
                campos: this.config.dataFields?.length || 0
            });
        },
        
        /**
         * Inicializa objeto de dados com valores padrão do JSON
         */
        initializeDataObject() {
            if (!this.config?.dataFields || !Array.isArray(this.config.dataFields)) {
                console.warn('[CommonInfo] ⚠️ Nenhum campo dataFields configurado em ecuInfo');
                return;
            }

            // Inicializar com valores padrão do JSON
            this.config.dataFields.forEach(field => {
                const defaultValue = field.default !== undefined ? field.default : 0;
                
                this.data[field.id] = {
                    value: defaultValue,
                    title: field.title,
                    unit: field.unit,
                    type: field.type,
                    format: field.format,
                    position: field.position,
                    min: field.min,
                    max: field.max,
                    timestamp: null,
                    source: 'default' // 'default', 'ecu', 'emergency'
                };
                
                // Guardar valor padrão para referência
                this.defaultData[field.id] = defaultValue;
            });

            console.log('[CommonInfo] 📊 Inicializado com valores padrão:', {
                campos: Object.keys(this.data).length,
                valores: Object.entries(this.defaultData).map(([id, val]) => `${id}=${val}`).join(', ')
            });
        },
        
        /**
         * Configura monitoramento de status de conexão
         */
        setupConnectionMonitoring() {
            if (!window.ecuCommunication) {
                console.warn('[CommonInfo] ⚠️ ecuCommunication não disponível');
                return;
            }

            // Monitorar via evento de status
            const originalSetStatus = window.ecuCommunication.setStatus?.bind(window.ecuCommunication);
            
            if (originalSetStatus) {
                window.ecuCommunication.setStatus = (status) => {
                    const wasOnline = this.isOnline;
                    this.isOnline = status;
                    
                    console.log(`[CommonInfo] 🔌 Status: ${status ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
                    
                    if (status && !wasOnline) {
                        console.log('[CommonInfo] 📡 ECU conectada - iniciando polling de dados');
                        this.failureCount = 0; // resetar contador de falhas
                        this.isEmergencyMode = false;
                        this.startPolling();
                    } else if (!status && wasOnline) {
                        console.log('[CommonInfo] 📵 ECU desconectada - usando valores padrão');
                        this.stopPolling();
                        // Manter dados padrão disponíveis offline
                        this.restoreDefaultValues();
                    }
                    
                    if (originalSetStatus) {
                        originalSetStatus(status);
                    }
                };
            }
        },
        
        /**
         * Restaura valores padrão (quando offline ou em emergência)
         */
        restoreDefaultValues() {
            Object.entries(this.defaultData).forEach(([id, defaultVal]) => {
                if (this.data[id]) {
                    this.data[id].value = defaultVal;
                    this.data[id].source = this.isEmergencyMode ? 'emergency' : 'default';
                    this.data[id].timestamp = Date.now();
                }
            });
            this.notifyListeners();
        },
        
        /**
         * Configura monitoramento de operações prioritárias
         */
        setupPriorityMonitoring() {
            this.monitorCommandQueue();
        },
        
        /**
         * Monitora a fila de comandos para detectar operações prioritárias
         */
        monitorCommandQueue() {
            if (!window.ecuCommunication) return;
            
            const originalSendCommand = window.ecuCommunication.sendCommand?.bind(window.ecuCommunication);
            
            if (originalSendCommand) {
                window.ecuCommunication.sendCommand = (command, ...args) => {
                    // Parar polling ao enviar comando prioritário
                    if (command && !command.includes('getcominfo')) {
                        this.pausePolling();
                        console.log(`[CommonInfo] ⏸️ Polling pausado (comando: ${command})`);
                    }
                    
                    const result = originalSendCommand(command, ...args);
                    
                    return result;
                };
            }
        },
        
        /**
         * Inicia polling dos dados diagnósticos
         */
        startPolling() {
            if (!this.config?.enabled || this.isPolling) {
                return;
            }
            
            if (this.isPaused) {
                console.log('[CommonInfo] ⏸️ Polling ainda está pausado - aguardando resumo');
                return;
            }
            
            this.isPolling = true;
            console.log(`[CommonInfo] ▶️ Polling iniciado - frequência: ${this.pollingFrequency}ms`);
            
            this.pollingInterval = setInterval(() => {
                if (this.isOnline && !this.isPaused) {
                    this.fetchCommonData();
                }
            }, this.pollingFrequency);
            
            // Fazer fetch imediato
            if (this.isOnline && !this.isPaused) {
                this.fetchCommonData();
            }
        },
        
        /**
         * Para o polling dos dados
         */
        stopPolling() {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
            this.isPolling = false;
            console.log('[CommonInfo] ⏹️ Polling parado');
        },
        
        /**
         * Pausa o polling temporariamente
         */
        pausePolling() {
            this.isPaused = true;
        },
        
        /**
         * Retoma o polling após operações prioritárias
         */
        resumePolling() {
            if (this.isPaused) {
                this.isPaused = false;
                console.log('[CommonInfo] ▶️ Polling retomado');
                
                if (this.isOnline && !this.isPolling) {
                    this.startPolling();
                }
            }
        },
        
        /**
         * Busca dados diagnósticos comuns do ECU
         */
        async fetchCommonData() {
            if (!this.config?.commonDiagnosticsCommand || !this.isOnline) {
                return;
            }
            
            try {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    const command = this.config.commonDiagnosticsCommand;
                    
                    // Enviar comando com timeout
                    const timeoutId = setTimeout(() => {
                        this.handleFetchFailure('Timeout ao buscar dados');
                    }, 3000);
                    
                    window.ecuCommunication.sendCommand(command, (response) => {
                        clearTimeout(timeoutId);
                        
                        if (response && response.length > 0) {
                            this.parseCommonData(response);
                        } else {
                            this.handleFetchFailure('Resposta vazia da ECU');
                        }
                    });
                }
            } catch (error) {
                this.handleFetchFailure(`Erro: ${error.message}`);
            }
        },
        
        /**
         * Trata falha ao buscar dados
         */
        handleFetchFailure(reason) {
            this.failureCount++;
            console.warn(`[CommonInfo] ⚠️ Falha ${this.failureCount}/${this.maxConsecutiveFailures}: ${reason}`);
            
            if (this.failureCount >= this.maxConsecutiveFailures) {
                console.error(`[CommonInfo] 🚨 MODO EMERGÊNCIA ATIVADO após ${this.failureCount} falhas`);
                this.activateEmergencyMode();
            }
        },
        
        /**
         * Ativa modo emergência
         */
        activateEmergencyMode() {
            this.isEmergencyMode = true;
            this.stopPolling();
            
            // Restaurar valores padrão
            this.restoreDefaultValues();
            
            console.error('[CommonInfo] 🆘 MODO EMERGÊNCIA:', {
                motivo: '3 tentativas falhadas',
                dados: 'Usando valores padrão do JSON',
                acao: 'Verifique a conexão com a ECU'
            });
        },
        
        /**
         * Analisa e processa resposta dos dados comuns
         */
        parseCommonData(response) {
            if (!response || !this.config?.dataFields) {
                this.handleFetchFailure('Resposta inválida ou sem configuração');
                return;
            }
            
            try {
                // Dividir por vírgula
                const values = response.split(',').map(v => v.trim());

                let updatedCount = 0;

                // Mapear posição para field.id
                this.config.dataFields.forEach(field => {
                    const rawValue = values[field.position];
                    
                    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
                        const numValue = parseFloat(rawValue);
                        
                        if (!isNaN(numValue)) {
                            // Validar contra min/max se configurados
                            let finalValue = numValue;
                            if (field.min !== undefined && numValue < field.min) {
                                console.warn(`[CommonInfo] ⚠️ ${field.id}: valor ${numValue} abaixo do mínimo ${field.min}`);
                                finalValue = field.min;
                            }
                            if (field.max !== undefined && numValue > field.max) {
                                console.warn(`[CommonInfo] ⚠️ ${field.id}: valor ${numValue} acima do máximo ${field.max}`);
                                finalValue = field.max;
                            }
                            
                            this.data[field.id] = {
                                value: finalValue,
                                title: field.title,
                                unit: field.unit,
                                type: field.type,
                                format: field.format,
                                position: field.position,
                                min: field.min,
                                max: field.max,
                                timestamp: Date.now(),
                                source: 'ecu',
                                raw: rawValue
                            };
                            
                            updatedCount++;
                        }
                    }
                });

                if (updatedCount === 0) {
                    this.handleFetchFailure('Nenhum valor válido extraído');
                    return;
                }

                // Reset contador de falhas em sucesso
                this.failureCount = 0;
                this.successCount++;
                
                if (this.isEmergencyMode) {
                    console.log('[CommonInfo] ✅ MODO EMERGÊNCIA DESATIVADO - Dados da ECU recuperados');
                    this.isEmergencyMode = false;
                }
                
                this.lastFetchTime = Date.now();
                
                console.debug(`[CommonInfo] 📊 Dados atualizados: ${updatedCount} campos (fetch #${this.fetchCount})`);
                
                // Notificar listeners
                this.notifyListeners();
                
            } catch (error) {
                this.handleFetchFailure(`Parse error: ${error.message}`);
            }
        },
        
        /**
         * Notifica todos os listeners sobre atualização
         */
        notifyListeners() {
            try {
                if (this._listeners && this._listeners.size > 0) {
                    this._listeners.forEach(cb => {
                        try {
                            cb(this.data);
                        } catch (err) {
                            console.error('[CommonInfo] 🔴 Erro em listener:', err);
                        }
                    });
                }
            } catch (err) {
                console.error('[CommonInfo] 🔴 Erro ao notificar listeners:', err);
            }
        },
        
        /**
         * Retorna valor específico
         */
        getValue(fieldId) {
            if (!fieldId) return undefined;
            const entry = this.data[fieldId];
            return entry && entry.value !== undefined ? entry.value : undefined;
        },
        
        /**
         * Configura callback para quando dados forem recebidos
         */
        onUpdate(callback) {
            if (!callback || typeof callback !== 'function') return;
            this._listeners.add(callback);
            return () => { this._listeners.delete(callback); };
        },

        addUpdateListener(callback) {
            if (!callback || typeof callback !== 'function') return false;
            this._listeners.add(callback);
            return true;
        },

        removeUpdateListener(callback) {
            if (!callback || typeof callback !== 'function') return false;
            return this._listeners.delete(callback);
        },
        
        /**
         * Retorna estatísticas do sistema
         */
        getStats() {
            return {
                online: this.isOnline,
                pausado: this.isPaused,
                polling: this.isPolling,
                modoEmergencia: this.isEmergencyMode,
                falhasConsecutivas: this.failureCount,
                sucessos: this.successCount,
                frequencia: `${this.pollingFrequency}ms`,
                ultimaAtualizacao: this.lastFetchTime ? new Date(this.lastFetchTime).toLocaleTimeString('pt-BR') : 'nunca',
                campos: Object.keys(this.data).length
            };
        },
        
        /**
         * Log do status atual do CommonInfo
         */
        logStatus() {
            console.log('[CommonInfo] 📈 Status Atual:', this.getStats());
            console.table(Object.entries(this.data).map(([id, info]) => ({
                'ID': id,
                'Valor': info.value,
                'Unidade': info.unit,
                'Fonte': info.source,
                'Título': info.title
            })));
        }
    };
    
    // Expor globalmente
    window.CommonInfo = CommonInfo;
    
    // Inicializar quando ECU Manager estiver pronto
    if (window.ecuManager && window.ecuManager.config) {
        CommonInfo.init();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (window.ecuManager && window.ecuManager.config) {
                    CommonInfo.init();
                }
            }, 500);
        });
    }
    
    console.log('[CommonInfo] ✅ Módulo carregado e pronto');
})();
