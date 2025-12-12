/**
 * config-macros.js - Sistema de Macros de Configuração
 * 
 * Permite executar código diferente dependendo do ambiente definido em app.json
 * Similar a macros de pré-processador em C++
 * 
 * Uso:
 * ConfigMacros.when('browser', () => { ... })
 * ConfigMacros.ifEnvironment('windows', () => { ... })
 * ConfigMacros.execute()
 */

class ConfigMacros {
    constructor() {
        this.appConfig = null;
        this.environment = 'browser';
        this.macros = [];
        this.loaded = false;
        
        this.loadAppConfig();
    }

    /**
     * Carrega app.json
     */
    async loadAppConfig() {
        try {
            const response = await fetch('app.json');
            if (response.ok) {
                this.appConfig = await response.json();
                this.environment = this.appConfig.environment || 'browser';
                this.loaded = true;
                console.log(`[ConfigMacros] Ambiente carregado: ${this.environment}`);
            } else {
                this.environment = 'browser';
                this.loaded = true;
                console.warn('[ConfigMacros] app.json não encontrado, usando browser');
            }
        } catch (err) {
            console.error('[ConfigMacros] Erro ao carregar app.json:', err);
            this.environment = 'browser';
            this.loaded = true;
        }
    }

    /**
     * Adiciona macro condicional para ambiente específico
     * Sintaxe similar a #if em C++
     */
    when(env, callback) {
        this.macros.push({
            type: 'when',
            env: env,
            callback: callback
        });
        return this;
    }

    /**
     * Alias para when()
     */
    ifEnvironment(env, callback) {
        return this.when(env, callback);
    }

    /**
     * Adiciona macro para ambiente diferente
     * Sintaxe similar a #else em C++
     */
    otherwise(callback) {
        if (this.macros.length === 0) {
            console.warn('[ConfigMacros] otherwise() sem macro anterior');
            return this;
        }
        
        const lastMacro = this.macros[this.macros.length - 1];
        lastMacro.otherwise = callback;
        return this;
    }

    /**
     * Adiciona macro para múltiplos ambientes (OR)
     */
    whenAny(envs, callback) {
        this.macros.push({
            type: 'whenAny',
            envs: Array.isArray(envs) ? envs : [envs],
            callback: callback
        });
        return this;
    }

    /**
     * Adiciona macro para todos os ambientes exceto um (NOT)
     */
    unlessEnvironment(env, callback) {
        this.macros.push({
            type: 'unless',
            env: env,
            callback: callback
        });
        return this;
    }

    /**
     * Executa macros aplicáveis
     * Deve ser chamado após all configs loaded
     */
    async execute() {
        // Aguardar carregamento se ainda não completou
        if (!this.loaded) {
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (this.loaded) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 50);
                setTimeout(() => clearInterval(checkInterval), 5000); // Timeout 5s
            });
        }

        console.log(`[ConfigMacros] Executando macros para: ${this.environment}`);

        for (const macro of this.macros) {
            let shouldExecute = false;

            if (macro.type === 'when') {
                shouldExecute = this.environment === macro.env;
                if (!shouldExecute && macro.otherwise) {
                    try {
                        macro.otherwise();
                    } catch (err) {
                        console.error('[ConfigMacros] Erro em otherwise:', err);
                    }
                }
            } else if (macro.type === 'whenAny') {
                shouldExecute = macro.envs.includes(this.environment);
            } else if (macro.type === 'unless') {
                shouldExecute = this.environment !== macro.env;
            }

            if (shouldExecute) {
                try {
                    const result = macro.callback();
                    // Se retornar Promise, aguardar
                    if (result && typeof result.then === 'function') {
                        await result;
                    }
                } catch (err) {
                    console.error('[ConfigMacros] Erro ao executar macro:', err);
                }
            }
        }

        console.log('[ConfigMacros] Macros executadas');
    }

    /**
     * Retorna true/false se está em determinado ambiente
     */
    isEnvironment(env) {
        return this.environment === env;
    }

    /**
     * Retorna ambiente atual
     */
    getEnvironment() {
        return this.environment;
    }

    /**
     * Retorna app.json completo
     */
    getAppConfig() {
        return this.appConfig;
    }

    /**
     * Shortcut: executa função se em determinado ambiente
     */
    onBrowser(callback) {
        if (this.environment === 'browser') {
            try {
                callback();
            } catch (err) {
                console.error('[ConfigMacros] Erro em onBrowser:', err);
            }
        }
        return this;
    }

    onWebView(callback) {
        if (this.environment === 'webview') {
            try {
                callback();
            } catch (err) {
                console.error('[ConfigMacros] Erro em onWebView:', err);
            }
        }
        return this;
    }

    onWindows(callback) {
        if (this.environment === 'windows') {
            try {
                callback();
            } catch (err) {
                console.error('[ConfigMacros] Erro em onWindows:', err);
            }
        }
        return this;
    }

    /**
     * Executa callback e retorna resultado diferente por ambiente
     */
    choose(callbacks) {
        // callbacks = { browser: fn, webview: fn, windows: fn }
        const fn = callbacks[this.environment];
        if (fn && typeof fn === 'function') {
            return fn();
        }
        return null;
    }

    /**
     * Debug: lista todas as macros registradas
     */
    debug() {
        console.group('[ConfigMacros] Debug Info');
        console.log('Environment:', this.environment);
        console.log('Loaded:', this.loaded);
        console.log('Macros count:', this.macros.length);
        console.log('Macros:', this.macros);
        console.groupEnd();
    }
}

// Criar instância global
window.ConfigMacros = new ConfigMacros();

// Exportar para CommonJS se necessário
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigMacros;
}

/**
 * EXEMPLOS DE USO:
 * 
 * 1. Condicional simples:
 * ConfigMacros.when('browser', () => {
 *     console.log('Rodando no browser!');
 * }).execute();
 * 
 * 2. With Otherwise:
 * ConfigMacros
 *     .when('windows', () => {
 *         useWindowsAPI();
 *     })
 *     .otherwise(() => {
 *         useBrowserAPI();
 *     })
 *     .execute();
 * 
 * 3. Múltiplos ambientes (OR):
 * ConfigMacros.whenAny(['browser', 'webview'], () => {
 *     console.log('Rodando em web!');
 * }).execute();
 * 
 * 4. Negação (NOT):
 * ConfigMacros.unlessEnvironment('windows', () => {
 *     console.log('Não é Windows!');
 * }).execute();
 * 
 * 5. Shortcuts:
 * ConfigMacros
 *     .onBrowser(() => { // ... })
 *     .onWebView(() => { // ... })
 *     .onWindows(() => { // ... });
 * 
 * 6. Choose (switch):
 * const transport = ConfigMacros.choose({
 *     browser: () => new HttpTransport(),
 *     webview: () => new BridgeTransport(),
 *     windows: () => new WindowsAPITransport()
 * });
 */
