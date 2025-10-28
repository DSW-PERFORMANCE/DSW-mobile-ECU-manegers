class ECUManager {
    constructor() {
        this.config = null;
        this.currentValues = {};
        this.isOnline = false;
        this.currentNodeId = null;
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.renderTree();
    }

    async loadConfig() {
        try {
            const response = await fetch('su.json');
            this.config = await response.json();
            this.initializeDefaultValues();
        } catch (error) {
            console.error('Erro ao carregar configuração:', error);
        }
    }

    initializeDefaultValues() {
        const processNode = (node) => {
            if (node.widgets) {
                node.widgets.forEach(widget => {
                    this.currentValues[widget.command] = widget.default;
                });
            }
            if (node.children) {
                node.children.forEach(child => processNode(child));
            }
        };

        this.config.tree.forEach(node => processNode(node));
    }

    setupEventListeners() {
        document.getElementById('saveBtn').addEventListener('click', () => this.saveAll());
        document.getElementById('reloadBtn').addEventListener('click', () => this.reloadAll());
        document.getElementById('searchInput').addEventListener('input', (e) => this.searchTree(e.target.value));
    }

    renderTree() {
        const treeView = document.getElementById('treeView');
        treeView.innerHTML = '';

        const renderNode = (node, level = 0) => {
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

            itemDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                if (hasChildren) {
                    this.toggleNode(nodeDiv, itemDiv);
                }
                if (hasWidgets) {
                    this.selectNode(node.id, itemDiv);
                    this.renderWidgets(node.widgets);
                }
            });

            nodeDiv.appendChild(itemDiv);

            if (hasChildren) {
                const childrenDiv = document.createElement('div');
                childrenDiv.className = 'tree-children';
                node.children.forEach(child => {
                    childrenDiv.appendChild(renderNode(child, level + 1));
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

    selectNode(nodeId, itemDiv) {
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });
        itemDiv.classList.add('active');
        this.currentNodeId = nodeId;
    }

    renderWidgets(widgets) {
        const widgetsArea = document.getElementById('widgetsArea');
        widgetsArea.innerHTML = '';

        widgets.forEach(widget => {
            const container = document.createElement('div');
            container.className = 'widget-container';

            const title = document.createElement('div');
            title.className = 'widget-title';
            title.textContent = widget.title;
            container.appendChild(title);

            if (widget.help) {
                const help = document.createElement('div');
                help.className = 'widget-help';
                help.textContent = widget.help;
                container.appendChild(help);
            }

            const widgetContent = this.createWidget(widget);
            container.appendChild(widgetContent);

            widgetsArea.appendChild(container);
        });
    }

    createWidget(widget) {
        const div = document.createElement('div');
        div.className = `widget-${widget.type}`;

        switch (widget.type) {
            case 'slider':
                return this.createSlider(widget);
            case 'spinbox':
                return this.createSpinbox(widget);
            case 'combobox':
                return this.createCombobox(widget);
            case 'toggle':
                return this.createToggle(widget);
            case 'button':
                return this.createButton(widget);
            default:
                div.textContent = 'Widget não suportado';
                return div;
        }
    }

    createSlider(widget) {
        const container = document.createElement('div');
        container.className = 'widget-slider';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = widget.min;
        slider.max = widget.max;
        slider.value = this.currentValues[widget.command];
        slider.className = 'form-range';

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'slider-value';
        valueDisplay.innerHTML = `
            <span>${widget.min}${widget.unit || ''}</span>
            <span class="current-value">${this.currentValues[widget.command]}${widget.unit || ''}</span>
            <span>${widget.max}${widget.unit || ''}</span>
        `;

        slider.addEventListener('input', (e) => {
            this.currentValues[widget.command] = parseFloat(e.target.value);
            valueDisplay.querySelector('.current-value').textContent =
                `${this.currentValues[widget.command]}${widget.unit || ''}`;
        });

        container.appendChild(slider);
        container.appendChild(valueDisplay);
        return container;
    }

    createSpinbox(widget) {
        const container = document.createElement('div');
        container.className = 'widget-spinbox';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = widget.min;
        input.max = widget.max;
        input.step = widget.step || 1;
        input.value = this.currentValues[widget.command];
        input.className = 'form-control';

        const unit = document.createElement('span');
        unit.textContent = ` ${widget.unit || ''}`;
        unit.style.marginLeft = '10px';
        unit.style.color = '#999';

        input.addEventListener('change', (e) => {
            let value = parseFloat(e.target.value);
            if (value < widget.min) value = widget.min;
            if (value > widget.max) value = widget.max;
            e.target.value = value;
            this.currentValues[widget.command] = value;
        });

        container.appendChild(input);
        container.appendChild(unit);
        return container;
    }

    createCombobox(widget) {
        const container = document.createElement('div');
        container.className = 'widget-combobox';

        const select = document.createElement('select');
        select.className = 'form-select';

        widget.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            if (option.value === this.currentValues[widget.command]) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });

        select.addEventListener('change', (e) => {
            this.currentValues[widget.command] = e.target.value;
        });

        container.appendChild(select);
        return container;
    }

    createToggle(widget) {
        const container = document.createElement('div');
        container.className = 'widget-toggle';

        const toggleSwitch = document.createElement('label');
        toggleSwitch.className = 'toggle-switch';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = this.currentValues[widget.command];

        const slider = document.createElement('span');
        slider.className = 'toggle-slider';

        input.addEventListener('change', (e) => {
            this.currentValues[widget.command] = e.target.checked;
        });

        toggleSwitch.appendChild(input);
        toggleSwitch.appendChild(slider);

        const label = document.createElement('span');
        label.textContent = widget.title;

        container.appendChild(toggleSwitch);
        container.appendChild(label);
        return container;
    }

    createButton(widget) {
        const container = document.createElement('div');
        container.className = 'widget-button';

        const button = document.createElement('button');
        button.textContent = widget.title;
        button.addEventListener('click', () => {
            console.log(`Botão ${widget.command} clicado`);
            this.sendCommand(widget.command, 'trigger');
        });

        container.appendChild(button);
        return container;
    }

    async saveAll() {
        console.log('=== SALVANDO CONFIGURAÇÕES NA ECU ===');

        for (const [command, value] of Object.entries(this.currentValues)) {
            const commandStr = `${command}=${value}`;
            console.log(`Enviando: ${commandStr}`);
            await this.sendCommand(command, value);
        }

        console.log('=== SALVAMENTO CONCLUÍDO ===');
        this.showNotification('Configurações salvas!', 'success');
    }

    async reloadAll() {
        console.log('=== RECARREGANDO CONFIGURAÇÕES DA ECU ===');

        for (const command of Object.keys(this.currentValues)) {
            const commandStr = `${command}?`;
            console.log(`Consultando: ${commandStr}`);
            const value = await this.queryCommand(command);
            this.currentValues[command] = value;
        }

        console.log('=== VALORES RECARREGADOS ===');
        console.log(this.currentValues);

        if (this.currentNodeId) {
            const node = this.findNodeById(this.currentNodeId);
            if (node && node.widgets) {
                this.renderWidgets(node.widgets);
            }
        }

        this.showNotification('Configurações recarregadas!', 'info');
    }

    async sendCommand(command, value) {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`ECU responde: OK`);
                resolve(true);
            }, 50);
        });
    }

    async queryCommand(command) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const defaultValue = this.getDefaultValue(command);
                console.log(`ECU responde: ${command}=${defaultValue}`);
                resolve(defaultValue);
            }, 50);
        });
    }

    getDefaultValue(command) {
        const findDefault = (nodes) => {
            for (const node of nodes) {
                if (node.widgets) {
                    const widget = node.widgets.find(w => w.command === command);
                    if (widget) return widget.default;
                }
                if (node.children) {
                    const result = findDefault(node.children);
                    if (result !== undefined) return result;
                }
            }
            return undefined;
        };

        return findDefault(this.config.tree);
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

    updateStatus(online) {
        this.isOnline = online;
        const statusBadge = document.getElementById('statusBadge');
        if (online) {
            statusBadge.className = 'badge bg-success';
            statusBadge.textContent = 'ONLINE';
        } else {
            statusBadge.className = 'badge bg-danger';
            statusBadge.textContent = 'OFFLINE';
        }
    }

    showNotification(message, type) {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

window.ecuManager = new ECUManager();