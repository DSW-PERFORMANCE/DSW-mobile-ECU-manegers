
class StorageManager {
    constructor() {
        // Carregar configuração de app.json
        this.appConfig = null;
        this.environment = 'browser';
        this.version = '1.0';
        
        this.loadAppConfig();
    }

    /**
     * Carrega configuração de app.json
     */
    async loadAppConfig() {
        try {
            const response = await fetch('app.json');
            if (response.ok) {
                this.appConfig = await response.json();
                this.version = this.appConfig.version || '1.0';
                this.environment = this.appConfig.environment || 'browser';
                console.log(`[Storage] Configuração carregada de app.json:`, {
                    version: this.version,
                    environment: this.environment
                });
            } else {
                console.warn('[Storage] app.json não encontrado, usando valores padrão');
                this.setDefaultConfig();
            }
        } catch (err) {
            console.error('[Storage] Erro ao carregar app.json:', err);
            this.setDefaultConfig();
        }
    }

    /**
     * Define configuração padrão
     */
    setDefaultConfig() {
        this.appConfig = {
            version: '1.0',
            environment: 'browser',
            timestamp: Date.now(),
            data: {}
        };
        this.version = this.appConfig.version;
        this.environment = this.appConfig.environment;
    }

    /**
     * Obtém environment do app.json
     */
    getEnvironment() {
        return this.appConfig?.environment || 'browser';
    }

    /**
     * Obtém versão do app.json
     */
    getVersion() {
        return this.appConfig?.version || '1.0';
    }

    /**
     * Salva dados com metadata
     */
    async save(key, data) {
        try {
            const payload = {
                version: this.version,
                environment: this.environment,
                timestamp: Date.now(),
                data: data
            };

            switch (this.environment) {
                case 'browser':
                    return this._saveBrowser(key, payload);
                case 'webview':
                    return await this._saveWebView(key, payload);
                case 'windows':
                    return await this._saveWindows(key, payload);
                default:
                    console.warn(`[Storage] Environment desconhecido: ${this.environment}`);
                    return this._saveBrowser(key, payload);
            }
        } catch (err) {
            console.error(`[Storage] Erro ao salvar '${key}':`, err);
            return false;
        }
    }

    /**
     * Carrega dados com metadata
     */
    async load(key) {
        try {
            let payload;

            switch (this.environment) {
                case 'browser':
                    payload = this._loadBrowser(key);
                    break;
                case 'webview':
                    payload = await this._loadWebView(key);
                    break;
                case 'windows':
                    payload = await this._loadWindows(key);
                    break;
                default:
                    payload = this._loadBrowser(key);
            }

            if (!payload) return null;
            return payload.data || null;
        } catch (err) {
            console.error(`[Storage] Erro ao carregar '${key}':`, err);
            return null;
        }
    }

    /**
     * Remove dados
     */
    async remove(key) {
        try {
            switch (this.environment) {
                case 'browser':
                    return this._removeBrowser(key);
                case 'webview':
                    return await this._removeWebView(key);
                case 'windows':
                    return await this._removeWindows(key);
                default:
                    return this._removeBrowser(key);
            }
        } catch (err) {
            console.error(`[Storage] Erro ao remover '${key}':`, err);
            return false;
        }
    }

    /**
     * Implementação: Browser (localStorage)
     */
    _saveBrowser(key, payload) {
        try {
            localStorage.setItem(key, JSON.stringify(payload));
            return true;
        } catch (err) {
            console.error('[Storage] Erro ao salvar no localStorage:', err);
            return false;
        }
    }

    _loadBrowser(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.error('[Storage] Erro ao carregar do localStorage:', err);
            return null;
        }
    }

    _removeBrowser(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (err) {
            console.error('[Storage] Erro ao remover do localStorage:', err);
            return false;
        }
    }

    /**
     * Implementação: WebView (Electron/React Native)
     * TODO: Implementar quando necessário
     */
    async _saveWebView(key, payload) {
        console.log('[Storage] WebView save (não implementado ainda):', key);
        // Exemplo para Electron:
        // if (window.ipcRenderer) {
        //     return await window.ipcRenderer.invoke('storage:set', key, payload);
        // }
        
        // Fallback para browser
        return this._saveBrowser(key, payload);
    }

    async _loadWebView(key) {
        console.log('[Storage] WebView load (não implementado ainda):', key);
        // Exemplo para Electron:
        // if (window.ipcRenderer) {
        //     return await window.ipcRenderer.invoke('storage:get', key);
        // }
        
        // Fallback para browser
        return this._loadBrowser(key);
    }

    async _removeWebView(key) {
        console.log('[Storage] WebView remove (não implementado ainda):', key);
        // Fallback para browser
        return this._removeBrowser(key);
    }

    /**
     * Implementação: Windows (API Bridge)
     * TODO: Implementar quando necessário
     */
    async _saveWindows(key, payload) {
        console.log('[Storage] Windows save (não implementado ainda):', key);
        // Exemplo para C# Bridge:
        // if (window.windowsAPI && window.windowsAPI.storage) {
        //     return await window.windowsAPI.storage.set(key, JSON.stringify(payload));
        // }
        
        // Fallback para browser
        return this._saveBrowser(key, payload);
    }

    async _loadWindows(key) {
        console.log('[Storage] Windows load (não implementado ainda):', key);
        // Exemplo para C# Bridge:
        // if (window.windowsAPI && window.windowsAPI.storage) {
        //     const data = await window.windowsAPI.storage.get(key);
        //     return data ? JSON.parse(data) : null;
        // }
        
        // Fallback para browser
        return this._loadBrowser(key);
    }

    async _removeWindows(key) {
        console.log('[Storage] Windows remove (não implementado ainda):', key);
        // Fallback para browser
        return this._removeBrowser(key);
    }

    /**
     * Utilitários
     */
    
    /**
     * Limpa tudo (cuidado!)
     */
    async clear() {
        if (this.environment === 'browser') {
            localStorage.clear();
        }
        console.warn('[Storage] Storage limpo');
    }

    /**
     * Exporta dados para JSON (para backup/share)
     */
    exportToJSON(data) {
        return {
            version: this.version,
            environment: this.environment,
            timestamp: Date.now(),
            data: data
        };
    }

    /**
     * Importa dados de JSON
     */
    importFromJSON(json) {
        if (!json || typeof json !== 'object') return null;
        if (!json.data) return null;
        return json.data;
    }
}

// Criar instância global
window.StorageManager = new StorageManager();

// Exportar para CommonJS se necessário
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
