class ECUManager {
    constructor() {
        this.config = null;
        this.currentValues = {};
        this.currentNodeId = null;
        this.currentBreadcrumb = '';
        this.modifiedWidgets = new Set();
        this.screenModified = false;
        this.savedValues = {};
        this._valueNormalizer = this._normalizeValue.bind(this);
        // Value change listeners for dynamic widgets
        this._valueChangeListeners = new Map(); // command -> [callbacks]
    }

    _normalizeValue(v) {
        // Normalize booleans
        if (v === true || v === false) return v;
        if (typeof v === 'string') {
            const tv = v.trim().toLowerCase();
            if (tv === 'true') return true;
            if (tv === 'false') return false;
            // numeric
            if (tv !== '' && !isNaN(Number(tv))) {
                return Number(tv);
            }
        }
        return v;
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.renderTree();
        if (window.ecuCommunication) {
            window.ecuCommunication.setConfig(this.config);
            window.ecuCommunication.setStatus(false);
            this.currentValues = window.ecuCommunication.getAllDefaultValues();
        }
        await this.autoReloadOnStartup();
    }

    async loadConfig() {
        try {
            const response = await fetch('su.json');
            this.config = await response.json();
        } catch (error) {
            console.error('Erro ao carregar configuração:', error);
        }
    }

    async autoReloadOnStartup() {
        await this.reloadCurrentScreen();
    }

    setupEventListeners() {
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCurrentScreen());
        document.getElementById('reloadBtn').addEventListener('click', async () => {
            if (this.screenModified) {
                const shouldContinue = await window.dialogManager.confirm(
                    'Alterações não salvas',
                    'Existem alterações não salvas. Deseja recarregar sem salvar?'
                );
                if (!shouldContinue) return;
            }
            this.reloadCurrentScreen();
        });
        
        // Import file input
        document.getElementById('importFileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importCurrentConfig(e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });
        
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchTree(e.target.value));

        // Export/Import buttons are added dynamically in renderWidgets, so we need to set them up there
        setTimeout(() => this.setupHomeButton(), 100);
    }

    renderTree() {
        const treeView = document.getElementById('treeView');
        treeView.innerHTML = '';

        const renderNode = (node, level = 0, parentPath = '') => {
            const nodeDiv = document.createElement('div');
            nodeDiv.className = 'tree-node';
            nodeDiv.dataset.nodeId = node.id;

            const hasChildren = node.children && node.children.length > 0;
            const hasWidgets = node.widgets && node.widgets.length > 0;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'tree-item';
            itemDiv.style.paddingLeft = `${level * 15 + 15}px`;

            if (hasChildren) {
                const toggleIcon = document.createElement('i');
                toggleIcon.className = 'bi bi-chevron-right toggle-icon';
                itemDiv.appendChild(toggleIcon);
            } else {
                const spacer = document.createElement('span');
                spacer.style.width = '14px';
                spacer.style.display = 'inline-block';
                itemDiv.appendChild(spacer);
            }

            const icon = document.createElement('i');
            icon.className = node.icon || 'bi-folder';
            itemDiv.appendChild(icon);

            const label = document.createElement('span');
            label.textContent = node.label;
            itemDiv.appendChild(label);

            const currentPath = parentPath ? `${parentPath} / ${node.label}` : node.label;

            itemDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                if (hasChildren) {
                    this.toggleNode(nodeDiv, itemDiv);
                }
                if (hasWidgets) {
                    this.switchToNode(node.id, itemDiv, currentPath, node.widgets);
                }
            });

            nodeDiv.appendChild(itemDiv);

            if (hasChildren) {
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'tree-children';
                node.children.forEach(child => {
                    childrenDiv.appendChild(renderNode(child, level + 1, currentPath));
                });
                nodeDiv.appendChild(childrenDiv);
            }

            return nodeDiv;
        };

        this.config.tree.forEach(node => {
            treeView.appendChild(renderNode(node));
        });
    }

    toggleNode(nodeDiv, itemDiv) {
        const childrenDiv = nodeDiv.querySelector('.tree-children');
        if (childrenDiv) {
            childrenDiv.classList.toggle('show');
            itemDiv.classList.toggle('expanded');
        }
    }

    async switchToNode(nodeId, itemDiv, breadcrumb, widgets) {
        if (this.screenModified) {
            const shouldContinue = await window.dialogManager.confirm(
                'Alterações não salvas',
                'Existem alterações não salvas. Deseja continuar sem salvar?'
            );

            if (!shouldContinue) {
                return;
            }
        }

        this.selectNode(nodeId, itemDiv, breadcrumb);
        this.modifiedWidgets.clear();
        this.screenModified = false;
        // Normalize saved values to canonical types
        this.savedValues = {};
        Object.keys(this.currentValues).forEach(k => {
            this.savedValues[k] = this._normalizeValue(this.currentValues[k]);
        });
        
        // Clear history when switching to a new tab/node
        if (window.globalHistoryManager) {
            window.globalHistoryManager.clear();
        }
        
        this.updateBreadcrumb();
        
        // RENDER WIDGETS FIRST (com valores padrão apenas)
        this.renderWidgets(widgets, breadcrumb);

        // AGUARDE 44ms ANTES DE TENTAR CARREGAR VALORES
        setTimeout(() => {
            this.setupHomeButton();
            // Agora, após 44ms, carrega os valores da ECU
            this.autoReloadCurrentScreen();
        }, 44);
    }

    async autoReloadCurrentScreen() {
        if (!window.ecuCommunication || !window.widgetManager) return;
        const currentWidgets = window.widgetManager.getCurrentWidgets();
        if (currentWidgets.length === 0) return;

        const reloadedValues = await window.ecuCommunication.reloadCurrentScreen(currentWidgets);
        Object.assign(this.currentValues, reloadedValues);
        // Normalize saved values after reload
        this.savedValues = {};
        Object.keys(this.currentValues).forEach(k => {
            this.savedValues[k] = this._normalizeValue(this.currentValues[k]);
        });

        setTimeout(() => {
            const widgetContainers = document.querySelectorAll('.widget-container');
            widgetContainers.forEach(container => {
                const inputs = container.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    const command = input.dataset.command;
                    if (command && this.currentValues[command] !== undefined) {
                        if (input.type === 'checkbox') {
                                // Accept boolean or numeric saved values
                                input.checked = this.currentValues[command] === true || this.currentValues[command] === 'true' || this.currentValues[command] == 1;
                        } else if (input.type === 'range') {
                            input.value = this.currentValues[command];
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                            input.value = this.currentValues[command];
                        }
                    }
                });
            });

            // After loading values, reset history to a clean slate with current state as base
            if (window.globalHistoryManager) {
                window.globalHistoryManager.clear();
                window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
            }
        }, 50);
    }

    selectNode(nodeId, itemDiv, breadcrumb) {
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });
        itemDiv.classList.add('active');
        this.currentNodeId = nodeId;
        this.currentBreadcrumb = breadcrumb;
    }

    updateBreadcrumb() {
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            if (this.screenModified) {
                statusIndicator.style.display = 'block';
                statusIndicator.className = 'status-indicator status-modified';
                statusIndicator.title = 'Alterações não salvas';
            } else if (this.currentNodeId) {
                statusIndicator.style.display = 'block';
                statusIndicator.className = 'status-indicator status-saved';
                statusIndicator.title = 'Tudo salvo';
            } else {
                statusIndicator.style.display = 'none';
            }
        }
    }

    renderWidgets(widgets, breadcrumbPath) {
        const widgetsArea = document.getElementById('widgetsArea');
        window.widgetManager.renderWidgets(
            widgets,
            widgetsArea,
            this.currentValues,
            (command, value, widgetElement) => this.onValueChange(command, value, widgetElement),
            breadcrumbPath,
            this.modifiedWidgets
        );

        // Normalize savedValues when rendering widgets
        this.savedValues = {};
        Object.keys(this.currentValues).forEach(k => {
            this.savedValues[k] = this._normalizeValue(this.currentValues[k]);
        });
    }

    onValueChange(command, value, widgetElement) {
        const normalized = this._normalizeValue(value);
        this.currentValues[command] = normalized;

        // Notify all dynamic widget listeners about this value change
        this._notifyValueChangeListeners(command, normalized);

        // Compare normalized saved value vs normalized incoming
        const saved = this.savedValues.hasOwnProperty(command) ? this.savedValues[command] : undefined;
        if (saved !== undefined) {
            if (saved !== normalized) this.modifiedWidgets.add(command);
            else this.modifiedWidgets.delete(command);
        } else {
            // If no saved value, treat change as modification
            this.modifiedWidgets.add(command);
        }

        this.screenModified = this.modifiedWidgets.size > 0;
        this.updateBreadcrumb();

        if (widgetElement) {
            const indicator = widgetElement.querySelector('.widget-modified-indicator');
            if (indicator) {
                if (this.modifiedWidgets.has(command)) {
                    indicator.style.display = 'block';
                } else {
                    indicator.style.display = 'none';
                }
            }
        }

        console.log(`[VALOR ALTERADO] ${command} = ${value}`);
    }

    async saveCurrentScreen() {
        if (!window.ecuCommunication || !window.widgetManager) return;
        const currentWidgets = window.widgetManager.getCurrentWidgets();

        if (currentWidgets.length === 0) {
            window.ecuCommunication.showNotification('Nenhum widget para salvar', 'warning');
            return;
        }

        const success = await window.ecuCommunication.saveCurrentScreen(currentWidgets, this.currentValues);

        if (success) {
            this.modifiedWidgets.clear();
            this.screenModified = false;
            this.updateBreadcrumb();

            document.querySelectorAll('.widget-modified-indicator').forEach(indicator => {
                indicator.style.display = 'none';
            });
        }
    }

    async reloadCurrentScreen() {
        if (!window.ecuCommunication || !window.widgetManager) return;
        const currentWidgets = window.widgetManager.getCurrentWidgets();

        if (currentWidgets.length === 0) {
            return; // Falha silenciosa se não houver widgets
        }

        const reloadedValues = await window.ecuCommunication.reloadCurrentScreen(currentWidgets);

        Object.assign(this.currentValues, reloadedValues);
        this.modifiedWidgets.clear();
        this.screenModified = false;
        this.updateBreadcrumb();

        // Atualiza table3d widgets com novos dados
        if (window.widgetManager) {
            window.widgetManager.updateTable3DData(this.currentValues);
        }

        if (this.currentNodeId) {
            const node = this.findNodeById(this.currentNodeId);
            if (node && node.widgets) {
                this.renderWidgets(node.widgets, this.currentBreadcrumb);
            }
        }
    }

    findNodeById(nodeId) {
        const search = (nodes) => {
            for (const node of nodes) {
                if (node.id === nodeId) return node;
                if (node.children) {
                    const result = search(node.children);
                    if (result) return result;
                }
            }
            return null;
        };

        return search(this.config.tree);
    }

  

    searchTree(query) {
        const q = query.trim().toLowerCase();
        const treeView = document.getElementById('treeView');
        const allNodes = treeView.querySelectorAll('.tree-node');
        
        if (!q) {
            // Se a busca está vazia, volta ao estado normal
            allNodes.forEach(node => {
                node.style.display = '';
                const itemDiv = node.querySelector('.tree-item');
                if (itemDiv) {
                    const span = itemDiv.querySelector('span:last-child');
                    if (span) {
                        const originalText = span.textContent;
                        span.innerHTML = originalText;
                    }
                }
            });
            return;
        }

        // Separa a busca por "/" para pesquisa hierárquica
        const searchTerms = q.split('/').map(term => term.trim()).filter(term => term.length > 0);

        // Função para obter o caminho completo de um nó
        const getNodePath = (node) => {
            let path = [];
            let current = node;
            
            while (current && current !== treeView) {
                if (current.classList.contains('tree-node')) {
                    const itemDiv = current.querySelector('.tree-item');
                    if (itemDiv) {
                        const span = itemDiv.querySelector('span:last-child');
                        if (span) {
                            path.unshift(span.textContent);
                        }
                    }
                }
                current = current.parentElement;
            }
            return path;
        };

        // Marca todos os nós que correspondem à busca
        const matchingNodes = new Set();
        
        allNodes.forEach(node => {
            const itemDiv = node.querySelector('.tree-item');
            if (!itemDiv) return;
            
            const span = itemDiv.querySelector('span:last-child');
            if (!span) return;

            const nodeText = span.textContent.toLowerCase();
            const nodePath = getNodePath(node).map(p => p.toLowerCase());
            
            let isMatch = false;

            if (searchTerms.length > 1) {
                // Busca hierárquica: verifica se o caminho contém todos os termos na ordem
                let pathIndex = 0;
                let termIndex = 0;

                while (pathIndex < nodePath.length && termIndex < searchTerms.length) {
                    if (nodePath[pathIndex].includes(searchTerms[termIndex])) {
                        termIndex++;
                    }
                    pathIndex++;
                }

                isMatch = termIndex === searchTerms.length;
            } else {
                // Busca simples: procura em qualquer parte do nome ou caminho
                const fullPath = nodePath.join(' / ');
                isMatch = fullPath.includes(q) || nodeText.includes(q);
            }

            if (isMatch) {
                matchingNodes.add(node);
                
                // Destaca o texto correspondente
                const originalText = span.textContent;
                const highlightTerm = searchTerms[searchTerms.length - 1];
                const regex = new RegExp(`(${highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                span.innerHTML = originalText.replace(regex, '<mark>$1</mark>');
            } else {
                span.innerHTML = span.textContent;
            }
        });

        // Mostra/esconde nós e expande pais
        allNodes.forEach(node => {
            if (matchingNodes.has(node)) {
                // Mostra este nó
                node.style.display = '';
                
                // Expande este nó
                const childrenDiv = node.querySelector('.tree-children');
                if (childrenDiv) {
                    childrenDiv.classList.add('show');
                }
                const itemDiv = node.querySelector('.tree-item');
                if (itemDiv) {
                    itemDiv.classList.add('expanded');
                }
                
                // Expande e mostra todos os nós pais
                let parent = node.parentElement;
                while (parent && parent !== treeView) {
                    if (parent.classList.contains('tree-node')) {
                        parent.style.display = '';
                        const parentChildrenDiv = parent.querySelector('.tree-children');
                        if (parentChildrenDiv) {
                            parentChildrenDiv.classList.add('show');
                        }
                        const parentItemDiv = parent.querySelector('.tree-item');
                        if (parentItemDiv) {
                            parentItemDiv.classList.add('expanded');
                        }
                    }
                    parent = parent.parentElement;
                }
            } else {
                node.style.display = 'none';
            }
        });
    }




    goHome() {
        this.currentNodeId = null;
        this.currentBreadcrumb = '';
        this.modifiedWidgets.clear();
        this.screenModified = false;

        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });

        const widgetsArea = document.getElementById('widgetsArea');
        widgetsArea.innerHTML = '';
        widgetsArea.appendChild(this.createEmptyState());
    }

    createEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <i class="bi bi-gear"></i>
            <p>Selecione um item na árvore para configurar</p>
        `;
        return emptyState;
    }

    setupHomeButton() {
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.removeEventListener('click', () => {});
            homeBtn.addEventListener('click', async () => {
                if (this.screenModified) {
                    const shouldContinue = await window.dialogManager.confirm(
                        'Alterações não salvas',
                        'Existem alterações não salvas. Deseja voltar sem salvar?'
                    );

                    if (!shouldContinue) {
                        return;
                    }
                }
                this.goHome();
            });
        }
    }

    /**
     * Subscribe to value changes for a specific command.
     * Used by dynamic widgets to react to parameter changes.
     * @param {string} command - The command to listen for
     * @param {Function} callback - Callback(newValue) to invoke when value changes
     */
    subscribeToValueChange(command, callback) {
        if (!this._valueChangeListeners.has(command)) {
            this._valueChangeListeners.set(command, []);
        }
        this._valueChangeListeners.get(command).push(callback);
    }

    /**
     * Unsubscribe from value changes.
     * @param {string} command - The command to stop listening for
     * @param {Function} callback - The exact callback function to remove
     */
    unsubscribeFromValueChange(command, callback) {
        if (this._valueChangeListeners.has(command)) {
            const callbacks = this._valueChangeListeners.get(command);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Notify all listeners about a value change.
     * Called internally when a value changes.
     * @param {string} command - The command that changed
     * @param {*} value - The new value
     */
    _notifyValueChangeListeners(command, value) {
        if (this._valueChangeListeners.has(command)) {
            const callbacks = this._valueChangeListeners.get(command);
            callbacks.forEach(callback => {
                try {
                    callback(value);
                } catch (error) {
                    console.error(`Error in value change listener for ${command}:`, error);
                }
            });
        }
    }

    /**
     * Exporta a configuração atual da aba como arquivo criptografado
     */
    async exportCurrentConfig() {
        if (!this.currentNodeId) {
            if (window.notificationManager) {
                window.notificationManager.warning('Selecione uma aba para exportar');
            } else {
                alert('Selecione uma aba para exportar');
            }
            return;
        }

        const node = this.findNodeById(this.currentNodeId);
        if (!node) {
            if (window.notificationManager) {
                window.notificationManager.warning('Aba não encontrada');
            } else {
                alert('Aba não encontrada');
            }
            return;
        }

        // Solicita senha ao usuário
        const values = await window.dialogManager.promptValues(
            'Exportar Configuração',
            [
                {
                    label: 'Senha de Criptografia',
                    type: 'text',
                    default: '',
                    icon: 'bi-lock',
                    validate: (val) => val && val.length >= 6
                }
            ],
            'bi-download'
        );

        if (!values) return;

        const password = values['Senha de Criptografia'];

        if (!password || password.length < 6) {
            if (window.notificationManager) {
                window.notificationManager.warning('Senha deve ter pelo menos 6 caracteres');
            } else {
                alert('Senha deve ter pelo menos 6 caracteres');
            }
            return;
        }

        try {
            // Prepara dados para exportar
            const configData = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                tabName: this.currentBreadcrumb,
                nodeId: this.currentNodeId,
                values: this.currentValues,
                widgets: node.widgets
            };

            // Exporta com criptografia
            await window.configExportImport.exportConfig(
                configData,
                password,
                `config_${node.label.replace(/\s+/g, '_')}`
            );

            if (window.notificationManager) {
                window.notificationManager.info('Configuração exportada com sucesso!');
            } else {
                alert('Configuração exportada com sucesso!');
            }
        } catch (error) {
            console.error('Erro ao exportar:', error);
            if (window.notificationManager) {
                window.notificationManager.error('Erro ao exportar configuração', error.message);
            } else {
                alert('Erro ao exportar: ' + error.message);
            }
        }
    }

    /**
     * Importa uma configuração de arquivo criptografado
     */
    async importCurrentConfig(file) {
        if (!window.configExportImport.isValidConfigFile(file)) {
            window.notificationManager.warning('Arquivo inválido. Use um arquivo .dswcfg');
            return;
        }

        // Solicita senha ao usuário
        const values = await window.dialogManager.promptValues(
            'Importar Configuração',
            [
                {
                    label: 'Senha de Descriptografia',
                    type: 'text',
                    default: '',
                    icon: 'bi-lock-fill'
                }
            ],
            'bi-upload'
        );

        if (!values) return;

        const password = values['Senha de Descriptografia'];

        try {
            // Importa e descriptografa
            const configData = await window.configExportImport.importConfig(file, password);

            // Mostra informações do arquivo
            const infoMsg = `
Arquivo: ${configData.tabName}
Data: ${new Date(configData.timestamp).toLocaleString()}
Versão: ${configData.version}
            `.trim();

            const shouldImport = await window.dialogManager.confirm(
                'Confirmar Importação',
                `${infoMsg}\n\nDeseja aplicar estas configurações?`
            );

            if (!shouldImport) return;

            // Aplica as valores importados
            Object.assign(this.currentValues, configData.values);
            this.modifiedWidgets.clear();
            this.screenModified = false;

            // Recarrega os widgets com os novos valores
            if (this.currentNodeId) {
                const node = this.findNodeById(this.currentNodeId);
                if (node && node.widgets) {
                    window.widgetManager.renderWidgets(
                        node.widgets,
                        document.getElementById('widgetsArea'),
                        this.currentValues,
                        (command, value, widgetElement) => this.onValueChange(command, value, widgetElement),
                        this.currentBreadcrumb,
                        this.modifiedWidgets
                    );
                }
            }

            // Normaliza os valores salvos
            this.savedValues = {};
            Object.keys(this.currentValues).forEach(k => {
                this.savedValues[k] = this._normalizeValue(this.currentValues[k]);
            });

            this.updateBreadcrumb();
            window.notificationManager.info('Configuração importada com sucesso!');

        } catch (error) {
            console.error('Erro ao importar:', error);
            if (error.message.includes('decrypt')) {
                window.notificationManager.error('Erro ao descriptografar', 'Senha incorreta ou arquivo corrompido');
            } else {
                window.notificationManager.error('Erro ao importar configuração', error.message);
            }
        }
    }
}

window.ecuManager = new ECUManager();
