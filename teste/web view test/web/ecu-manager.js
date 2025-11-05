class ECUManager {
    constructor() {
        this.config = null;
        this.currentValues = {};
        this.currentNodeId = null;
        this.currentBreadcrumb = '';
        this.modifiedWidgets = new Set();
        this.screenModified = false;
        this.savedValues = {};
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
        } catch (error) {
            console.error('Erro ao carregar configuração:', error);
        }
    }

    async autoReloadOnStartup() {
        await this.reloadCurrentScreen();
    }

    setupEventListeners() {
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCurrentScreen());
        document.getElementById('reloadBtn').addEventListener('click', () => this.reloadCurrentScreen());
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchTree(e.target.value));

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
        this.savedValues = { ...this.currentValues };
        this.updateBreadcrumb();
        this.renderWidgets(widgets, breadcrumb);

        setTimeout(() => {
            this.setupHomeButton();
            this.autoReloadCurrentScreen();
        }, 0);
    }

    async autoReloadCurrentScreen() {
        const currentWidgets = window.widgetManager.getCurrentWidgets();
        if (currentWidgets.length === 0) return;

        const reloadedValues = await window.ecuCommunication.reloadCurrentScreen(currentWidgets);
        Object.assign(this.currentValues, reloadedValues);
        this.savedValues = { ...this.currentValues };

        setTimeout(() => {
            const widgetContainers = document.querySelectorAll('.widget-container');
            widgetContainers.forEach(container => {
                const inputs = container.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    const command = input.dataset.command;
                    if (command && this.currentValues[command] !== undefined) {
                        if (input.type === 'checkbox') {
                            input.checked = this.currentValues[command] == 1;
                        } else if (input.type === 'range') {
                            input.value = this.currentValues[command];
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                            input.value = this.currentValues[command];
                        }
                    }
                });
            });
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

        this.savedValues = { ...this.currentValues };
    }

    onValueChange(command, value, widgetElement) {
        this.currentValues[command] = value;

        if (this.savedValues[command] !== value) {
            this.modifiedWidgets.add(command);
        } else {
            this.modifiedWidgets.delete(command);
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
            window.ecuCommunication.showNotification('Nenhum widget para recarregar', 'warning');
            return;
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
        const roots = document.querySelectorAll('#treeView .tree-root');

        roots.forEach(root => {
            const spans = root.querySelectorAll('.tree-item span');
            let matchFound = false;

            spans.forEach(span => {
                const text = span.textContent;
                span.innerHTML = text; // limpa highlight

                if (q && text.toLowerCase().includes(q)) {
                    matchFound = true;
                    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    span.innerHTML = text.replace(regex, '<mark>$1</mark>');
                }
            });

            // mostra ou oculta a árvore
            root.style.display = matchFound || !q ? '' : 'none';

            // expande se achou algo
            const children = root.querySelectorAll('.tree-children');
            const items = root.querySelectorAll('.tree-item');

            if (matchFound && q) {
                children.forEach(c => c.classList.add('show'));
                items.forEach(i => i.classList.add('expanded'));
            } else if (!q) {
                children.forEach(c => c.classList.remove('show'));
                items.forEach(i => i.classList.remove('expanded'));
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
