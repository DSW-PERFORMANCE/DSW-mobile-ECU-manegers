/**
 * Gerenciador de Exportação/Importação de Configurações
 * Com criptografia AES-256-GCM
 */
class ConfigExportImport {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
    }

    /**
     * Deriva uma chave a partir de uma senha usando PBKDF2
     * @param {string} password - Senha do usuário
     * @param {Uint8Array} salt - Salt aleatório
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(password);
        
        const baseKey = await crypto.subtle.importKey(
            'raw',
            passwordData,
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: this.keyLength },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Exporta a configuração atual da aba
     * @param {object} config - Configuração a exportar (values + metadata)
     * @param {string} password - Senha para criptografia
     * @param {string} filename - Nome do arquivo (sem extensão)
     * @returns {Promise<void>}
     */
    async exportConfig(config, password, filename = 'config') {
        try {
            // Gera salt aleatório
            const salt = crypto.getRandomValues(new Uint8Array(16));
            
            // Deriva chave da senha
            const key = await this.deriveKey(password, salt);
            
            // Gera IV aleatório
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Converte config para JSON
            const encoder = new TextEncoder();
            const configData = encoder.encode(JSON.stringify(config));
            
            // Criptografa
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                configData
            );
            
            // Monta o arquivo: salt + iv + dados encriptados
            const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
            
            // Converte para base64 para facilitar transferência
            const base64 = btoa(String.fromCharCode.apply(null, combined));
            
            // Cria e faz download
            const blob = new Blob([base64], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.dswcfg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Erro ao exportar configuração:', error);
            throw error;
        }
    }

    /**
     * Importa uma configuração criptografada
     * @param {File} file - Arquivo .dswcfg
     * @param {string} password - Senha para descriptografia
     * @returns {Promise<object>} Configuração descriptografada
     */
    async importConfig(file, password) {
        try {
            // Lê o arquivo
            const text = await file.text();
            
            // Decodifica base64
            const binaryString = atob(text);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Extrai salt, iv e dados
            const salt = bytes.slice(0, 16);
            const iv = bytes.slice(16, 28);
            const encryptedData = bytes.slice(28);
            
            // Deriva chave da senha com o salt original
            const key = await this.deriveKey(password, salt);
            
            // Descriptografa
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encryptedData
            );
            
            // Decodifica JSON
            const decoder = new TextDecoder();
            const configText = decoder.decode(decryptedData);
            const config = JSON.parse(configText);
            
            return config;
        } catch (error) {
            console.error('Erro ao importar configuração:', error);
            throw error;
        }
    }

    /**
     * Valida se um arquivo é um arquivo .dswcfg válido
     * @param {File} file - Arquivo a validar
     * @returns {boolean}
     */
    isValidConfigFile(file) {
        return file.name.endsWith('.dswcfg') && file.type === 'text/plain';
    }
}

window.configExportImport = new ConfigExportImport();
