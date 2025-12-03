/**
 * common-info.js
 * 
 * Sistema de coleta automática de dados diagnósticos do ECU
 * - Polling de baixa prioridade quando ECU está online
 * - Pausa automática quando há operações prioritárias (save/load)
 * - Expõe dados globalmente via window.CommonInfo
 */

(function () {
    const CommonInfo = {
        // Estado do sistema
        isOnline: false,
        isPaused: false,
        isPolling: false,
        
        // Configuração
        config: null,
        pollingInterval: null,
        pollingFrequency: 500, // ms padrão
        
        // Dados coletados
        data: {},
        lastFetchTime: null,
        fetchCount: 0,
        
        // Callbacks
        onDataReceived: null,
        
        /**
         * Inicializa o sistema de coleta de dados comuns
         */
        init() {
            console.log('[CommonInfo] Inicializando sistema de diagnósticos comuns...');
            
            // Carregar configuração do ECU
            this.loadEcuConfig();
            
            // Inicializar objeto de dados
            this.initializeDataObject();
            
            // Monitorar status de conexão
            this.setupConnectionMonitoring();
            
            // Monitorar operações prioritárias
            this.setupPriorityMonitoring();
            
            console.log('[CommonInfo] Sistema inicializado com sucesso');
        },
        
        /**
         * Carrega configuração do ECU do su.json
         */
        loadEcuConfig() {
            if (!window.ecuManager || !window.ecuManager.config) {
                console.warn('[CommonInfo] ecuManager não disponível');
                return;
            }
            
            const fullConfig = window.ecuManager.config;
            if (!fullConfig.ecuInfo) {
                console.warn('[CommonInfo] Seção ecuInfo não encontrada em su.json');
                return;
            }
            
            this.config = fullConfig.ecuInfo;
            this.pollingFrequency = this.config.commonDiagnosticsFrequency || 500;
            
            console.log('[CommonInfo] Configuração carregada:', {
                model: this.config.model,
                enabled: this.config.enabled,
                command: this.config.commonDiagnosticsCommand,
                frequency: this.pollingFrequency,
                fields: this.config.dataFields.length
            });
        },
        
        /**
         * Inicializa objeto de dados com valores padrão
         */
        initializeDataObject() {
            if (!this.config || !this.config.dataFields) return;
            
            this.config.dataFields.forEach(field => {
                this.data[field.id] = {
                    value: null,
                    title: field.title,
                    unit: field.unit,
                    type: field.type,
                    format: field.format,
                    timestamp: null
                };
            });
        },
        
        /**
         * Configura monitoramento de status de conexão
         */
        setupConnectionMonitoring() {
            // Monitorar status de conexão via ecuCommunication
            if (window.ecuCommunication) {
                // Interceptar método de status
                const originalSetStatus = window.ecuCommunication.setStatus?.bind(window.ecuCommunication);
                
                window.ecuCommunication.setStatus = (status) => {
                    this.isOnline = status;
                    
                    if (status) {
                        console.log('[CommonInfo] ECU online - iniciando polling');
                        this.startPolling();
                    } else {
                        console.log('[CommonInfo] ECU offline - parando polling');
                        this.stopPolling();
                    }
                    
                    if (originalSetStatus) {
                        originalSetStatus(status);
                    }
                };
            }
        },
        
        /**
         * Configura monitoramento de operações prioritárias
         */
        setupPriorityMonitoring() {
            // Expõe métodos para pausa/resume de polling
            window.CommonInfo = {
                pausePolling: () => this.pausePolling(),
                resumePolling: () => this.resumePolling(),
                isPaused: () => this.isPaused,
                getData: () => this.getFormattedData(),
                getRawData: () => this.data
            };
            
            // Monitorar fila de comandos no ecuCommunication
            this.monitorCommandQueue();
        },
        
        /**
         * Monitora a fila de comandos para detectar operações prioritárias
         */
        monitorCommandQueue() {
            if (!window.ecuCommunication) return;
            
            // Interceptar envio de comandos
            const originalSendCommand = window.ecuCommunication.sendCommand?.bind(window.ecuCommunication);
            
            if (originalSendCommand) {
                window.ecuCommunication.sendCommand = (command, ...args) => {
                    // Parar polling ao enviar comando prioritário
                    if (command && !command.includes('read/common_data')) {
                        this.pausePolling();
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
                console.log('[CommonInfo] Polling pausado - aguardando resumo');
                return;
            }
            
            this.isPolling = true;
            console.log('[CommonInfo] Polling iniciado - frequência:', this.pollingFrequency);
            
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
            console.log('[CommonInfo] Polling parado');
        },
        
        /**
         * Pausa o polling temporariamente (durante operações prioritárias)
         */
        pausePolling() {
            this.isPaused = true;
            console.log('[CommonInfo] Polling pausado (operação prioritária)');
        },
        
        /**
         * Retoma o polling após operações prioritárias
         */
        resumePolling() {
            if (this.isPaused) {
                this.isPaused = false;
                console.log('[CommonInfo] Polling retomado');
                
                // Retomar polling se online
                if (this.isOnline && !this.isPolling) {
                    this.startPolling();
                }
            }
        },
        
        /**
         * Busca dados diagnósticos comuns do ECU
         */
        async fetchCommonData() {
            if (!this.config?.commonDiagnosticsCommand) {
                return;
            }
            
            try {
                // Enviar comando READ ao ECU
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    const command = this.config.commonDiagnosticsCommand;
                    
                    // Enviar comando sem parar polling
                    window.ecuCommunication.sendCommand(command, (response) => {
                        this.parseCommonData(response);
                    });
                    
                    this.fetchCount++;
                }
            } catch (error) {
                console.error('[CommonInfo] Erro ao buscar dados:', error);
            }
        },
        
        /**
         * Analisa e processa resposta dos dados comuns (formato CSV)
         * @param {string} response - Dados separados por vírgula
         */
        parseCommonData(response) {
            if (!response || !this.config?.dataFields) {
                return;
            }
            
            try {
                // Dividir por vírgula
                const values = response.split(',').map(v => v.trim());
                
                // Mapear para campos definidos
                this.config.dataFields.forEach(field => {
                    const value = values[field.position];
                    
                    if (value !== undefined && value !== null) {
                        const numValue = parseFloat(value);
                        
                        if (!isNaN(numValue)) {
                            this.data[field.id] = {
                                value: numValue,
                                title: field.title,
                                unit: field.unit,
                                type: field.type,
                                format: field.format,
                                timestamp: Date.now(),
                                raw: value
                            };
                        }
                    }
                });
                
                this.lastFetchTime = Date.now();
                
                // Chamar callback se definido
                if (this.onDataReceived) {
                    this.onDataReceived(this.data);
                }
                
                console.debug('[CommonInfo] Dados atualizados', {
                    count: this.fetchCount,
                    fields: Object.keys(this.data).length
                });
                
            } catch (error) {
                console.error('[CommonInfo] Erro ao processar dados:', error);
            }
        },
        
        /**
         * Retorna dados formatados para exibição
         */
        getFormattedData() {
            const formatted = {};
            
            Object.entries(this.data).forEach(([key, info]) => {
                if (info.value !== null) {
                    // Formatar valor conforme especificado
                    let displayValue = info.value;
                    
                    if (info.format) {
                        displayValue = parseFloat(info.value).toLocaleString('pt-BR', {
                            minimumFractionDigits: info.format.includes('.') ? 1 : 0,
                            maximumFractionDigits: info.format.includes('.') ? (info.format.split('.')[1]?.length || 1) : 0
                        });
                    }
                    
                    formatted[key] = {
                        displayValue: displayValue,
                        rawValue: info.value,
                        title: info.title,
                        unit: info.unit,
                        timestamp: info.timestamp,
                        age: Date.now() - info.timestamp // em ms
                    };
                }
            });
            
            return formatted;
        },
        
        /**
         * Obtém valor específico
         */
        getValue(fieldId) {
            return this.data[fieldId]?.value || null;
        },
        
        /**
         * Configura callback para quando dados forem recebidos
         */
        onUpdate(callback) {
            this.onDataReceived = callback;
        },
        
        /**
         * Retorna estatísticas do sistema
         */
        getStats() {
            return {
                isOnline: this.isOnline,
                isPaused: this.isPaused,
                isPolling: this.isPolling,
                fetchCount: this.fetchCount,
                pollingFrequency: this.pollingFrequency,
                lastFetchTime: this.lastFetchTime,
                timeSinceLastFetch: this.lastFetchTime ? (Date.now() - this.lastFetchTime) : null,
                dataFieldsCount: this.config?.dataFields?.length || 0,
                model: this.config?.model
            };
        }
    };
    
    // Expor globalmente
    window.CommonInfo = CommonInfo;
    
    // Inicializar quando ECU Manager estiver pronto
    if (window.ecuManager) {
        CommonInfo.init();
    } else {
        // Aguardar ECU Manager
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (window.ecuManager) {
                    CommonInfo.init();
                }
            }, 100);
        });
    }
    
    console.log('[CommonInfo] Módulo carregado e pronto para inicialização');
})();
