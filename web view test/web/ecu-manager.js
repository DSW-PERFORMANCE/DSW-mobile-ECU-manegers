class ECUManager {
    constructor() {
        this.config = null;
        this.currentValues = {};
        this.currentNodeId = null;
        this.currentBreadcrumb = '';
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.renderTree();
        window.ecuCommunication.setConfig(this.config);
        window.ecuCommunication.setStatus(false);
        this.currentValues = window.ecuCommunication.getAllDefaultValues();
    }

    async loadConfig() {
        try {
            const response = await fetch('su.json');
            this.config = await response.json();
        } catch (error) {
            console.error('Erro ao carregar configuração:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCurrentScreen());
        document.getElementById('reloadBtn').addEventListener('click', () => this.reloadCurrentScreen());
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchTree(e.target.value));
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
                    this.selectNode(node.id, itemDiv, currentPath);
                    this.renderWidgets(node.widgets, currentPath);
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

    selectNode(nodeId, itemDiv, breadcrumb) {
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });
        itemDiv.classList.add('active');
        this.currentNodeId = nodeId;
        this.currentBreadcrumb = breadcrumb;
    }

    renderWidgets(widgets, breadcrumbPath) {
        const widgetsArea = document.getElementById('widgetsArea');
        window.widgetManager.renderWidgets(
            widgets,
            widgetsArea,
            this.currentValues,
            (command, value) => this.onValueChange(command, value),
            breadcrumbPath
        );
    }

    onValueChange(command, value) {
        this.currentValues[command] = value;
        console.log(`[VALOR ALTERADO] ${command} = ${value}`);
    }

    async saveCurrentScreen() {
        const currentWidgets = window.widgetManager.getCurrentWidgets();

        if (currentWidgets.length === 0) {
            window.ecuCommunication.showNotification('Nenhum widget para salvar', 'warning');
            return;
        }

        await window.ecuCommunication.saveCurrentScreen(currentWidgets, this.currentValues);
    }

    async reloadCurrentScreen() {
        const currentWidgets = window.widgetManager.getCurrentWidgets();

        if (currentWidgets.length === 0) {
            window.ecuCommunication.showNotification('Nenhum widget para recarregar', 'warning');
            return;
        }

        const reloadedValues = await window.ecuCommunication.reloadCurrentScreen(currentWidgets);

        Object.assign(this.currentValues, reloadedValues);

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
        const lowerQuery = query.toLowerCase();
        const nodes = document.querySelectorAll('.tree-node');

        nodes.forEach(node => {
            const label = node.querySelector('.tree-item span:last-child');
            if (label) {
                const text = label.textContent.toLowerCase();
                if (text.includes(lowerQuery) || query === '') {
                    node.style.display = '';
                } else {
                    node.style.display = 'none';
                }
            }
        });

        if (query) {
            document.querySelectorAll('.tree-children').forEach(children => {
                children.classList.add('show');
            });
            document.querySelectorAll('.tree-item').forEach(item => {
                item.classList.add('expanded');
            });
        }
    }
}

window.ecuManager = new ECUManager();
