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
        window.ecuCommunication.setConfig(this.config);
        window.ecuCommunication.setStatus(false);
        this.currentValues = window.ecuCommunication.getAllDefaultValues();
        await this.autoReloadOnStartup();
    }

    async loadConfig() {
        try {
            const response = await fetch('su.json');
            this.config = await response.json();
            // Validate linked_radio groups across the entire config
            this._validateLinkedRadios();
        } catch (error) {
            console.error('Erro ao carregar configuração:', error);
        }
    }

    _validateLinkedRadios() {
        if (!this.config || !Array.isArray(this.config.tree)) return;

        const groups = {};

        const traverse = (nodes, parentIdPath = []) => {
            for (const node of nodes) {
                const nodeId = node.id || null;
                if (node.widgets && Array.isArray(node.widgets)) {
                    node.widgets.forEach(widget => {
                        if (widget.type === 'linked_radio') {
                            const groupId = widget.group || widget.command || null;
                            if (!groupId) return;
                            groups[groupId] = groups[groupId] || [];
                            groups[groupId].push({
                                widget: widget,
                                command: widget.command,
                                nodeId: nodeId,
                                nodePath: parentIdPath.concat(node.label || nodeId).join(' / ')
                            });
                        }
                    });
                }

                if (node.children && node.children.length > 0) {
                    traverse(node.children, parentIdPath.concat(node.label || node.id));
                }
            }
        };

        traverse(this.config.tree);

        // Expose groups map for runtime use (linked radio behavior)
        this.linkedRadioGroups = groups;

        // Now validate each group
        for (const [groupId, members] of Object.entries(groups)) {
            // Count validation
            if (members.length < 2 || members.length > 4) {
                const msg = `linked_radio group '${groupId}' must have between 2 and 4 members (found ${members.length}).`;
                console.error(msg, members);
                if (window.notificationManager) window.notificationManager.error(msg);
            }

            // Command equality validation
            const commands = new Set(members.map(m => String(m.command)));
            if (commands.size > 1) {
                const msg = `linked_radio group '${groupId}' members must share the same 'command'. Found different commands: ${[...commands].join(', ')}.`;
                console.error(msg, members);
                if (window.notificationManager) window.notificationManager.error(msg);
            }

            // Allow members to be placed in the same node, but limit to maximum 2 per node
            const nodeCounts = members.reduce((acc, m) => {
                const id = m.nodeId || '__root__';
                acc[id] = (acc[id] || 0) + 1;
                return acc;
            }, {});

            for (const [nodeId, cnt] of Object.entries(nodeCounts)) {
                if (cnt > 2) {
                    const msg = `linked_radio group '${groupId}' has ${cnt} members inside node '${nodeId}'. Maximum 2 members per node are allowed.`;
                    console.error(msg, members.filter(m => (m.nodeId || '__root__') === nodeId));
                    if (window.notificationManager) window.notificationManager.error(msg);
                }
            }
            // Disallow defining multiple options inside a single linked_radio widget when intending cross-frame linking
            members.forEach(m => {
                if (m.widget && Array.isArray(m.widget.options) && m.widget.options.length > 1) {
                    const msg = `linked_radio widget in node '${m.nodePath}' uses 'options' array. For cross-frame linking each linked_radio must be a single-option widget (use 'value').`;
                    console.error(msg, m);
                    if (window.notificationManager) window.notificationManager.error(msg);
                }
            });
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
        const currentWidgets = window.widgetManager.getCurrentWidgets();

        if (currentWidgets.length === 0) {
            return; // Falha silenciosa se não houver widgets
        }

        const reloadedValues = await window.ecuCommunication.reloadCurrentScreen(currentWidgets);

        Object.assign(this.currentValues, reloadedValues);
        this.modifiedWidgets.clear();
        this.screenModified = false;
        this.updateBreadcrumb();

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
}

window.ecuManager = new ECUManager();
