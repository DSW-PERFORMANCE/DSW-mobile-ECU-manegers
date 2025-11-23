/**
 * Table3D Widget Controller
 * Gerencia uma tabela numérica interativa com múltiplas linhas, cada uma com seu comando
 * Suporta interpolação, seleção, cores dinâmicas e compatibilidade com parameterVariations
 */
class Table3DController {
    constructor(widget, currentValue, onValueChange) {
        this.widget = widget;
        this.onValueChange = onValueChange;
        this.selectedCell = null;
        this.selectedCells = new Set(); // Múltiplas células selecionadas
        this.editMode = false;
        this.tooltipDiv = null;
        this.container = null;
        this.isDragging = false;
        this.dragStart = null;
        
        // Configuration - DEVE vir ANTES de parseData
        this.rows = widget.rows || 20;
        this.cols = widget.cols || 20;
        this.rowCommands = widget.rowCommands || []; // Array de comandos, um por linha
        this.xLabel = widget.xLabel || 'Coluna';
        this.yLabel = widget.yLabel || 'Linha';
        this.min = widget.min !== undefined ? widget.min : 0;
        this.max = widget.max !== undefined ? widget.max : 100;
        this.step = widget.step || 1;
        this.unit = widget.unit || '';
        this.colorMode = widget.colorMode || 'gradient'; // gradient, heat, cool
        
        // Eixos editáveis (opcional)
        this.xAxis = widget.xAxis || null; // {min, max, command, enabled}
        this.yAxis = widget.yAxis || null; // {min, max, command, enabled}
        this.xAxisValues = [];
        this.yAxisValues = [];
        
        // Agora sim, fazer parseData com this.min já definido
        this.data = this.parseData(currentValue, widget);
    }

    /**
     * Parse current value into 2D array
     * Format: cada linha é um comando separado, armazenado individualmente
     */
    parseData(currentValue, widget) {
        const data = [];
        const minValue = typeof this.min === 'number' ? this.min : 0;
        
        if (widget.rowCommands && Array.isArray(widget.rowCommands)) {
            // Se há rowCommands, cada um representa uma linha
            // O currentValue deve ter os valores para cada linha
            for (let row = 0; row < widget.rowCommands.length; row++) {
                const rowData = [];
                const cols = widget.cols || 20;
                
                // Cada valor é um comando separado
                // Assumindo que currentValue é um objeto com os comandos como chaves
                if (currentValue && typeof currentValue === 'object') {
                    const cmdValue = currentValue[widget.rowCommands[row]];
                    if (cmdValue && typeof cmdValue === 'string') {
                        const values = cmdValue.split(',').map(v => {
                            const num = parseFloat(v.trim());
                            return !isNaN(num) ? num : minValue;
                        });
                        for (let col = 0; col < cols; col++) {
                            const val = values[col];
                            rowData.push(typeof val === 'number' ? val : minValue);
                        }
                    } else {
                        for (let col = 0; col < cols; col++) {
                            rowData.push(minValue);
                        }
                    }
                } else {
                    for (let col = 0; col < cols; col++) {
                        rowData.push(minValue);
                    }
                }
                data.push(rowData);
            }
        } else {
            // Fallback: criar tabela vazia
            for (let row = 0; row < this.rows; row++) {
                const rowData = [];
                for (let col = 0; col < this.cols; col++) {
                    rowData.push(minValue);
                }
                data.push(rowData);
            }
        }
        
        return data;
    }

    /**
     * Gera cor baseada no valor (interpolação entre cores)
     */
    getColorForValue(value) {
        // Validação: garantir que value é um número
        const numValue = typeof value === 'number' ? value : (this.min || 0);
        
        // Normaliza o valor entre 0 e 1
        const range = this.max - this.min;
        const normalized = range > 0 ? (numValue - this.min) / range : 0;
        const clamped = Math.max(0, Math.min(1, normalized));

        if (this.colorMode === 'heat') {
            // Heat map: azul -> verde -> amarelo -> vermelho
            if (clamped < 0.25) {
                // Azul para verde
                const t = clamped / 0.25;
                return this.interpolateColor({ r: 0, g: 0, b: 255 }, { r: 0, g: 255, b: 0 }, t);
            } else if (clamped < 0.5) {
                // Verde para amarelo
                const t = (clamped - 0.25) / 0.25;
                return this.interpolateColor({ r: 0, g: 255, b: 0 }, { r: 255, g: 255, b: 0 }, t);
            } else if (clamped < 0.75) {
                // Amarelo para laranja
                const t = (clamped - 0.5) / 0.25;
                return this.interpolateColor({ r: 255, g: 255, b: 0 }, { r: 255, g: 165, b: 0 }, t);
            } else {
                // Laranja para vermelho
                const t = (clamped - 0.75) / 0.25;
                return this.interpolateColor({ r: 255, g: 165, b: 0 }, { r: 255, g: 0, b: 0 }, t);
            }
        } else if (this.colorMode === 'cool') {
            // Cool map: branco -> azul -> preto
            if (clamped < 0.5) {
                const t = clamped / 0.5;
                return this.interpolateColor({ r: 255, g: 255, b: 255 }, { r: 0, g: 100, b: 255 }, t);
            } else {
                const t = (clamped - 0.5) / 0.5;
                return this.interpolateColor({ r: 0, g: 100, b: 255 }, { r: 0, g: 0, b: 0 }, t);
            }
        } else {
            // Gradient padrão: vermelho claro -> vermelho escuro
            const r = Math.round(180 + clamped * 75);
            const g = Math.round(20 + clamped * 30);
            const b = Math.round(20 + clamped * 30);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    /**
     * Interpola cor entre dois pontos RGB
     */
    interpolateColor(color1, color2, t) {
        const r = Math.round(color1.r + (color2.r - color1.r) * t);
        const g = Math.round(color1.g + (color2.g - color1.g) * t);
        const b = Math.round(color1.b + (color2.b - color1.b) * t);
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Inicializa valores dos eixos (pull automático)
     */
    initializeAxes(currentValue) {
        // X Axis
        if (this.xAxis && this.xAxis.enabled) {
            const xMin = this.xAxis.min || 0;
            const xMax = this.xAxis.max || 100;
            const xStep = (xMax - xMin) / (this.cols - 1);
            this.xAxisValues = [];
            for (let i = 0; i < this.cols; i++) {
                this.xAxisValues.push(xMin + i * xStep);
            }
            
            // Pull automático se comando existir
            if (this.xAxis.command && currentValue && currentValue[this.xAxis.command]) {
                try {
                    const values = currentValue[this.xAxis.command].split(',').map(v => parseFloat(v.trim()));
                    if (values.length === this.cols) {
                        this.xAxisValues = values;
                    }
                } catch (e) {
                    console.warn('Erro ao fazer pull do eixo X:', e);
                }
            }
        }
        
        // Y Axis
        if (this.yAxis && this.yAxis.enabled) {
            const yMin = this.yAxis.min || 0;
            const yMax = this.yAxis.max || 100;
            const yStep = (yMax - yMin) / (this.rows - 1);
            this.yAxisValues = [];
            for (let i = 0; i < this.rows; i++) {
                this.yAxisValues.push(yMin + i * yStep);
            }
            
            // Pull automático se comando existir
            if (this.yAxis.command && currentValue && currentValue[this.yAxis.command]) {
                try {
                    const values = currentValue[this.yAxis.command].split(',').map(v => parseFloat(v.trim()));
                    if (values.length === this.rows) {
                        this.yAxisValues = values;
                    }
                } catch (e) {
                    console.warn('Erro ao fazer pull do eixo Y:', e);
                }
            }
        }
    }

    /**
     * Cria o elemento da tabela
     */
    create() {
        // Inicializar eixos
        this.initializeAxes(this.widget.currentValue || {});
        
        this.container = document.createElement('div');
        this.container.className = 'widget-table3d';

        // Container principal (flex para acomodar labels laterais)
        const mainWrapper = document.createElement('div');
        mainWrapper.style.display = 'flex';
        mainWrapper.style.gap = '0';

        // Label vertical do eixo Y (esquerda)
        if (this.yAxis && this.yAxis.enabled) {
            const yLabelWrapper = document.createElement('div');
            yLabelWrapper.className = 'table3d-y-axis-label';
            yLabelWrapper.style.display = 'flex';
            yLabelWrapper.style.alignItems = 'center';
            yLabelWrapper.style.padding = '0 5px';
            yLabelWrapper.style.writingMode = 'vertical-rl';
            yLabelWrapper.style.textOrientation = 'mixed';
            yLabelWrapper.style.color = '#888';
            yLabelWrapper.style.fontSize = '12px';
            yLabelWrapper.style.fontWeight = 'bold';
            yLabelWrapper.textContent = `← ${this.yLabel} →`;
            mainWrapper.appendChild(yLabelWrapper);
        }

        // Container com scroll horizontal/vertical + label X no topo
        const tableWrapper = document.createElement('div');
        tableWrapper.style.display = 'flex';
        tableWrapper.style.flexDirection = 'column';
        tableWrapper.style.flex = '1';

        // Label horizontal do eixo X (topo)
        if (this.xAxis && this.xAxis.enabled) {
            const xLabelWrapper = document.createElement('div');
            xLabelWrapper.className = 'table3d-x-axis-label';
            xLabelWrapper.style.textAlign = 'center';
            xLabelWrapper.style.color = '#888';
            xLabelWrapper.style.fontSize = '12px';
            xLabelWrapper.style.fontWeight = 'bold';
            xLabelWrapper.style.padding = '5px 0';
            xLabelWrapper.textContent = `↓ ${this.xLabel} ↓`;
            tableWrapper.appendChild(xLabelWrapper);
        }

        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'table3d-scroll-container';

        // Tabela principal
        const table = document.createElement('div');
        table.className = 'table3d-main';
        
        // Configura o grid: 1 coluna para labels + N colunas para dados
        table.style.gridTemplateColumns = `40px repeat(${this.cols}, minmax(35px, 1fr))`;

        // Header com labels de colunas
        const headerRow = document.createElement('div');
        headerRow.className = 'table3d-row table3d-header-row';

        // Canto superior esquerdo (vazio para alinhamento)
        const cornerCell = document.createElement('div');
        cornerCell.className = 'table3d-corner-cell';
        cornerCell.textContent = '';
        headerRow.appendChild(cornerCell);

        // Labels das colunas (valores do eixo X se disponível)
        for (let col = 0; col < this.cols; col++) {
            const headerCell = document.createElement('div');
            headerCell.className = 'table3d-header-cell';
            
            // Mostrar valor do eixo X se disponível, senão índice
            if (this.xAxis && this.xAxis.enabled && this.xAxisValues.length > 0) {
                const value = this.xAxisValues[col];
                headerCell.textContent = value.toFixed(1);
            } else {
                headerCell.textContent = col;
            }
            headerRow.appendChild(headerCell);
        }
        table.appendChild(headerRow);

        // Rows
        for (let row = 0; row < this.data.length; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'table3d-row';

            // Label da linha (valores do eixo Y se disponível)
            const rowLabel = document.createElement('div');
            rowLabel.className = 'table3d-row-label';
            
            if (this.yAxis && this.yAxis.enabled && this.yAxisValues.length > 0) {
                const value = this.yAxisValues[row];
                rowLabel.textContent = value.toFixed(1);
            } else {
                rowLabel.textContent = row;
            }
            rowDiv.appendChild(rowLabel);

            // Células
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'table3d-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                const value = this.data[row] && this.data[row][col] !== undefined ? this.data[row][col] : this.min;
                const bgColor = this.getColorForValue(value);
                const textColor = this.getTextColorForBg(bgColor);

                cell.style.backgroundColor = bgColor;
                cell.style.color = textColor;
                cell.textContent = (typeof value === 'number' ? value : this.min).toFixed(1);

                // Click para selecionar (simples ou múltipla)
                cell.addEventListener('click', (e) => {
                    this.handleCellClick(row, col, cell, e);
                });

                // Duplo clique para editar com diálogo
                cell.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this.editCellWithDialog(row, col);
                });

                // Mouse down para iniciar seleção por drag
                cell.addEventListener('mousedown', (e) => {
                    if (e.button === 0) { // Botão esquerdo
                        this.isDragging = true;
                        this.dragStart = { row, col };
                    }
                });

                // Mouse over durante drag
                cell.addEventListener('mouseover', (e) => {
                    if (this.isDragging && this.dragStart) {
                        this.selectCellRange(this.dragStart.row, this.dragStart.col, row, col);
                    }
                });

                // Hover tooltip
                cell.addEventListener('mouseenter', () => {
                    this.showCellTooltip(row, col, cell);
                });

                rowDiv.appendChild(cell);
            }
            table.appendChild(rowDiv);
        }

        scrollContainer.appendChild(table);
        tableWrapper.appendChild(scrollContainer);
        mainWrapper.appendChild(tableWrapper);
        this.container.appendChild(mainWrapper);

        // Events globais para drag
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.dragStart = null;
        });

        // Painel de controle / edição
        const controlPanel = document.createElement('div');
        controlPanel.className = 'table3d-control-panel';

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'table3d-controls';

        // Campo de entrada para editar valor
        const inputGroup = document.createElement('div');
        inputGroup.className = 'table3d-input-group';

        const label = document.createElement('label');
        label.textContent = 'Editar valor:';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'table3d-value-input';
        input.min = this.min;
        input.max = this.max;
        input.step = this.step;
        input.placeholder = 'Selecione uma célula';

        const unit = document.createElement('span');
        unit.className = 'table3d-unit';
        unit.textContent = this.unit;

        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
        if (this.unit) inputGroup.appendChild(unit);

        // Botões de ação
        const actionGroup = document.createElement('div');
        actionGroup.className = 'table3d-action-group';

        const interpolateHBtn = document.createElement('button');
        interpolateHBtn.innerHTML = '<i class="bi bi-arrow-left-right"></i> Interpolar H';
        interpolateHBtn.className = 'btn-table3d btn-interpolate';
        interpolateHBtn.disabled = true;
        interpolateHBtn.title = 'Interpola horizontalmente entre células selecionadas';

        const interpolateVBtn = document.createElement('button');
        interpolateVBtn.innerHTML = '<i class="bi bi-arrow-up-down"></i> Interpolar V';
        interpolateVBtn.className = 'btn-table3d btn-interpolate';
        interpolateVBtn.disabled = true;
        interpolateVBtn.title = 'Interpola verticalmente entre células selecionadas';

        const interpolateDBtn = document.createElement('button');
        interpolateDBtn.innerHTML = '<i class="bi bi-slash-lg"></i> Interpolar D';
        interpolateDBtn.className = 'btn-table3d btn-interpolate';
        interpolateDBtn.disabled = true;
        interpolateDBtn.title = 'Interpola diagonalmente entre células selecionadas';

        const mathBtn = document.createElement('button');
        mathBtn.innerHTML = '<i class="bi bi-calculator"></i> Matemática';
        mathBtn.className = 'btn-table3d btn-math';
        mathBtn.disabled = true;
        mathBtn.title = 'Aplica operação matemática às células selecionadas';

        interpolateHBtn.addEventListener('click', () => {
            if (this.selectedCells.size > 0) {
                this.interpolateHorizontal();
            }
        });

        interpolateVBtn.addEventListener('click', () => {
            if (this.selectedCells.size > 0) {
                this.interpolateVertical();
            }
        });

        interpolateDBtn.addEventListener('click', () => {
            if (this.selectedCells.size > 0) {
                this.interpolateDiagonal();
            }
        });

        mathBtn.addEventListener('click', () => {
            if (this.selectedCells.size > 0) {
                this.showMathDialog();
            }
        });

        // Botão para editar eixos (apenas se houver eixos editáveis)
        const hasEditableAxes = (this.xAxis && this.xAxis.enabled && this.xAxis.command) || 
                                (this.yAxis && this.yAxis.enabled && this.yAxis.command);
        
        let editAxesBtn = null;
        if (hasEditableAxes) {
            editAxesBtn = document.createElement('button');
            editAxesBtn.innerHTML = '<i class="bi bi-sliders"></i> Editar Eixos';
            editAxesBtn.className = 'btn-table3d btn-edit-axes';
            editAxesBtn.title = 'Editar intervalos dos eixos X e Y';
            editAxesBtn.addEventListener('click', () => this.editAxesDialog());
        }

        input.addEventListener('input', (e) => {
            if (this.selectedCell) {
                this.updateCellValue(this.selectedCell.row, this.selectedCell.col, parseFloat(e.target.value));
            }
        });

        actionGroup.appendChild(interpolateHBtn);
        actionGroup.appendChild(interpolateVBtn);
        actionGroup.appendChild(interpolateDBtn);
        actionGroup.appendChild(mathBtn);
        if (editAxesBtn) {
            actionGroup.appendChild(editAxesBtn);
        }
        
        // Guardar referências
        this.interpolateHBtn = interpolateHBtn;
        this.interpolateVBtn = interpolateVBtn;
        this.interpolateDBtn = interpolateDBtn;
        this.mathBtn = mathBtn;
        this.editAxesBtn = editAxesBtn;

        controlsDiv.appendChild(inputGroup);
        controlsDiv.appendChild(actionGroup);
        controlPanel.appendChild(controlsDiv);

        this.container.appendChild(controlPanel);

        // Guardar referências para atualizar depois
        this.inputField = input;
        this.tableElement = table;

        return this.container;
    }

    /**
     * Determina cor do texto baseado na cor de fundo (contraste)
     */
    getTextColorForBg(bgColor) {
        // Extrai RGB de "rgb(r, g, b)"
        const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return '#fff';

        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);

        // Calcula luminância
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000' : '#fff';
    }

    /**
     * Manipula clique em célula (seleção simples ou múltipla)
     */
    handleCellClick(row, col, cellElement, event) {
        const cellKey = `${row},${col}`;
        
        if (event.ctrlKey || event.metaKey) {
            // Ctrl+Click: adiciona/remove da seleção múltipla
            if (this.selectedCells.has(cellKey)) {
                this.selectedCells.delete(cellKey);
                cellElement.classList.remove('multi-selected');
            } else {
                this.selectedCells.add(cellKey);
                cellElement.classList.add('multi-selected');
            }
        } else if (event.shiftKey && this.selectedCell) {
            // Shift+Click: seleciona range entre última célula e esta
            this.selectCellRange(this.selectedCell.row, this.selectedCell.col, row, col);
        } else {
            // Clique simples: seleção única
            this.clearMultiSelection();
            this.selectedCell = { row, col, element: cellElement };
            this.selectedCells.clear();
            this.selectedCells.add(cellKey);
            cellElement.classList.add('multi-selected');
        }

        this.updateButtonStates();
        this.updateInputField();
    }

    /**
     * Seleciona range de células
     */
    selectCellRange(startRow, startCol, endRow, endCol) {
        this.clearMultiSelection();
        
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const cellKey = `${r},${c}`;
                this.selectedCells.add(cellKey);
                const cell = this.tableElement.querySelector(
                    `.table3d-cell[data-row="${r}"][data-col="${c}"]`
                );
                if (cell) {
                    cell.classList.add('multi-selected');
                }
            }
        }
        
        this.updateButtonStates();
    }

    /**
     * Limpa seleção múltipla
     */
    clearMultiSelection() {
        this.tableElement.querySelectorAll('.table3d-cell.multi-selected').forEach(cell => {
            cell.classList.remove('multi-selected');
        });
        this.selectedCells.clear();
    }

    /**
     * Atualiza estados dos botões
     */
    updateButtonStates() {
        const hasSelection = this.selectedCells.size > 0;
        this.interpolateHBtn.disabled = !hasSelection;
        this.interpolateVBtn.disabled = !hasSelection;
        this.interpolateDBtn.disabled = !hasSelection;
        this.mathBtn.disabled = !hasSelection;
    }

    /**
     * Atualiza campo de entrada
     */
    updateInputField() {
        if (this.selectedCell) {
            const cellValue = this.data[this.selectedCell.row] && this.data[this.selectedCell.row][this.selectedCell.col] !== undefined 
                ? this.data[this.selectedCell.row][this.selectedCell.col] 
                : this.min;
            this.inputField.value = typeof cellValue === 'number' ? cellValue : this.min;
        }
    }

    /**
     * Edita célula com diálogo
     */
    editCellWithDialog(row, col) {
        const currentValue = this.data[row] && this.data[row][col] !== undefined ? this.data[row][col] : this.min;
        
        if (window.dialogManager && window.dialogManager.editNumberValue) {
            window.dialogManager.editNumberValue(
                `Editar [${row}, ${col}]`,
                currentValue,
                this.min,
                this.max,
                this.step,
                this.unit,
                (newValue) => {
                    this.updateCellValue(row, col, newValue);
                }
            );
        }
    }

    /**
     * Modo de edição inline
     */


    /**
     * Atualiza valor de uma célula
     */
    updateCellValue(row, col, value) {
        // Validação: garantir que value é um número
        const numValue = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : this.min);
        const validValue = !isNaN(numValue) ? numValue : this.min;
        const clamped = Math.max(this.min, Math.min(this.max, validValue));
        
        // Garantir que data[row][col] existe
        if (!this.data[row]) this.data[row] = [];
        this.data[row][col] = clamped;

        // Atualiza visual
        const cellElement = this.tableElement.querySelector(
            `.table3d-cell[data-row="${row}"][data-col="${col}"]`
        );
        if (cellElement) {
            const bgColor = this.getColorForValue(clamped);
            const textColor = this.getTextColorForBg(bgColor);
            cellElement.style.backgroundColor = bgColor;
            cellElement.style.color = textColor;
            cellElement.textContent = clamped.toFixed(1);
        }

        // Atualiza campo de entrada
        this.inputField.value = clamped;

        // Notifica mudança
        this.sendUpdate();
    }

    /**
     * Preenche uma linha com um valor
     */
    /**
     * Interpola horizontalmente (entre colunas)
     */
    interpolateHorizontal() {
        const cells = Array.from(this.selectedCells).map(key => {
            const [row, col] = key.split(',').map(Number);
            return { row, col };
        });

        if (cells.length < 2) return;

        // Agrupa por linha
        const rowMap = {};
        cells.forEach(cell => {
            if (!rowMap[cell.row]) rowMap[cell.row] = [];
            rowMap[cell.row].push(cell.col);
        });

        // Interpola cada linha
        Object.keys(rowMap).forEach(row => {
            const cols = rowMap[row].sort((a, b) => a - b);
            if (cols.length < 2) return;

            for (let i = 0; i < cols.length - 1; i++) {
                const startCol = cols[i];
                const endCol = cols[i + 1];
                const startVal = this.data[row][startCol];
                const endVal = this.data[row][endCol];

                for (let c = startCol; c <= endCol; c++) {
                    const t = (c - startCol) / (endCol - startCol);
                    this.data[row][c] = startVal + (endVal - startVal) * t;
                }
            }
            this.redrawRow(row);
        });

        this.sendUpdate();
        if (window.notificationManager) {
            window.notificationManager.info('Interpolação horizontal aplicada');
        }
    }

    /**
     * Interpola verticalmente (entre linhas)
     */
    interpolateVertical() {
        const cells = Array.from(this.selectedCells).map(key => {
            const [row, col] = key.split(',').map(Number);
            return { row, col };
        });

        if (cells.length < 2) return;

        // Agrupa por coluna
        const colMap = {};
        cells.forEach(cell => {
            if (!colMap[cell.col]) colMap[cell.col] = [];
            colMap[cell.col].push(cell.row);
        });

        // Interpola cada coluna
        Object.keys(colMap).forEach(col => {
            const rows = colMap[col].sort((a, b) => a - b);
            if (rows.length < 2) return;

            for (let i = 0; i < rows.length - 1; i++) {
                const startRow = rows[i];
                const endRow = rows[i + 1];
                const startVal = this.data[startRow][col];
                const endVal = this.data[endRow][col];

                for (let r = startRow; r <= endRow; r++) {
                    const t = (r - startRow) / (endRow - startRow);
                    this.data[r][col] = startVal + (endVal - startVal) * t;
                }
            }
        });

        this.redrawAll();
        this.sendUpdate();
        if (window.notificationManager) {
            window.notificationManager.info('Interpolação vertical aplicada');
        }
    }

    /**
     * Interpola diagonalmente
     */
    interpolateDiagonal() {
        const cells = Array.from(this.selectedCells).map(key => {
            const [row, col] = key.split(',').map(Number);
            return { row, col };
        });

        if (cells.length < 2) return;

        // Encontra min/max row e col
        const rows = cells.map(c => c.row);
        const cols = cells.map(c => c.col);
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);
        const minCol = Math.min(...cols);
        const maxCol = Math.max(...cols);

        const startVal = this.data[minRow][minCol];
        const endVal = this.data[maxRow][maxCol];

        // Interpola diagonalmente
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                const tRow = (maxRow - minRow) > 0 ? (r - minRow) / (maxRow - minRow) : 0;
                const tCol = (maxCol - minCol) > 0 ? (c - minCol) / (maxCol - minCol) : 0;
                const t = (tRow + tCol) / 2; // Média das duas interpolações
                this.data[r][c] = startVal + (endVal - startVal) * t;
            }
        }

        this.redrawAll();
        this.sendUpdate();
        if (window.notificationManager) {
            window.notificationManager.info('Interpolação diagonal aplicada');
        }
    }

    /**
     * Mostra diálogo de operações matemáticas
     */
    showMathDialog() {
        if (!window.dialogManager) {
            alert('Gerenciador de diálogos não disponível');
            return;
        }

        const html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <button id="math-mult" class="btn btn-sm" style="padding: 10px; background: #2a5a8a; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    <i class="bi bi-x"></i> Multiplicar
                </button>
                <button id="math-div" class="btn btn-sm" style="padding: 10px; background: #2a5a8a; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    <i class="bi bi-slash"></i> Dividir
                </button>
                <button id="math-add" class="btn btn-sm" style="padding: 10px; background: #6a5a2a; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    <i class="bi bi-plus"></i> Somar
                </button>
                <button id="math-sub" class="btn btn-sm" style="padding: 10px; background: #6a5a2a; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    <i class="bi bi-dash"></i> Subtrair
                </button>
                <button id="math-set" class="btn btn-sm" style="padding: 10px; background: #8a3a3a; color: white; border: none; border-radius: 4px; cursor: pointer; grid-column: 1 / -1;">
                    <i class="bi bi-equal"></i> Igualar Todas
                </button>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 500;">Valor:</label>
                <input type="number" id="math-value" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px;">
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = html;

        const valueInput = container.querySelector('#math-value');
        
        const applyOperation = (op) => {
            const value = parseFloat(valueInput.value);
            if (isNaN(value)) {
                alert('Digite um valor válido');
                return;
            }

            const cells = Array.from(this.selectedCells).map(key => {
                const [row, col] = key.split(',').map(Number);
                return { row, col };
            });

            cells.forEach(cell => {
                let newVal;
                const currentVal = this.data[cell.row][cell.col];
                
                switch(op) {
                    case 'mult': newVal = currentVal * value; break;
                    case 'div': newVal = currentVal / value; break;
                    case 'add': newVal = currentVal + value; break;
                    case 'sub': newVal = currentVal - value; break;
                    case 'set': newVal = value; break;
                    default: newVal = currentVal;
                }

                this.updateCellValue(cell.row, cell.col, newVal);
            });

            this.redrawAll();
            this.sendUpdate();
            
            if (window.notificationManager) {
                window.notificationManager.info(`Operação aplicada a ${cells.length} célula(s)`);
            }
        };

        container.querySelector('#math-mult').addEventListener('click', () => {
            applyOperation('mult');
        });
        container.querySelector('#math-div').addEventListener('click', () => {
            applyOperation('div');
        });
        container.querySelector('#math-add').addEventListener('click', () => {
            applyOperation('add');
        });
        container.querySelector('#math-sub').addEventListener('click', () => {
            applyOperation('sub');
        });
        container.querySelector('#math-set').addEventListener('click', () => {
            applyOperation('set');
        });

        if (window.dialogManager && window.dialogManager.showCustomDialog) {
            window.dialogManager.showCustomDialog(
                'Operações Matemáticas',
                container,
                () => {} // OK callback (já aplicado direto)
            );
        }
    }

    /**
     * Redesenha uma linha
     */
    redrawRow(row) {
        const rowElements = this.tableElement.querySelectorAll(`.table3d-row`);
        if (rowElements[row + 1]) { // +1 porque primeira linha é header
            const cells = rowElements[row + 1].querySelectorAll('.table3d-cell');
            for (let col = 0; col < this.cols; col++) {
                const value = this.data[row][col];
                const bgColor = this.getColorForValue(value);
                const textColor = this.getTextColorForBg(bgColor);
                cells[col].style.backgroundColor = bgColor;
                cells[col].style.color = textColor;
                cells[col].textContent = value.toFixed(1);
            }
        }
    }

    /**
     * Redesenha toda a tabela
     */
    redrawAll() {
        const rowElements = this.tableElement.querySelectorAll('.table3d-row:not(.table3d-header-row)');
        rowElements.forEach((rowElement, rowIdx) => {
            const cells = rowElement.querySelectorAll('.table3d-cell');
            for (let col = 0; col < this.cols; col++) {
                const value = this.data[rowIdx][col];
                const bgColor = this.getColorForValue(value);
                const textColor = this.getTextColorForBg(bgColor);
                cells[col].style.backgroundColor = bgColor;
                cells[col].style.color = textColor;
                cells[col].textContent = value.toFixed(1);
            }
        });
    }

    /**
     * Mostra tooltip ao hover
     */
    showCellTooltip(row, col, cellElement) {
        const value = this.data[row][col];
        const rect = cellElement.getBoundingClientRect();

        if (!this.tooltipDiv) {
            this.tooltipDiv = document.createElement('div');
            this.tooltipDiv.className = 'table3d-tooltip';
            document.body.appendChild(this.tooltipDiv);
        }

        this.tooltipDiv.textContent = `[${row}, ${col}] = ${value.toFixed(2)} ${this.unit}`;
        this.tooltipDiv.style.display = 'block';
        this.tooltipDiv.style.left = `${rect.left}px`;
        this.tooltipDiv.style.top = `${rect.top - 35}px`;

        cellElement.addEventListener('mouseleave', () => {
            this.tooltipDiv.style.display = 'none';
        });
    }

    /**
     * Envia atualização dos valores para o widget
     * Cada linha envia um comando separado
     */
    sendUpdate() {
        if (this.widget.rowCommands && Array.isArray(this.widget.rowCommands)) {
            for (let row = 0; row < this.data.length && row < this.widget.rowCommands.length; row++) {
                const rowValues = this.data[row].map(v => v.toFixed(2)).join(',');
                this.onValueChange(this.widget.rowCommands[row], rowValues);
            }
        }

        // Atualiza histórico
        if (window.globalHistoryManager) {
            window.globalHistoryManager.push(window.globalHistoryManager.createSnapshot());
        }
    }

    /**
     * Atualiza displays dos eixos X e Y
     */
    updateAxisDisplays() {
        if (this.xAxis && this.xAxis.enabled && this.xAxisValues.length > 0) {
            const displayEl = document.getElementById('x-axis-display');
            if (displayEl) {
                const min = Math.min(...this.xAxisValues).toFixed(2);
                const max = Math.max(...this.xAxisValues).toFixed(2);
                displayEl.textContent = `${min} a ${max}`;
            }
        }
        
        if (this.yAxis && this.yAxis.enabled && this.yAxisValues.length > 0) {
            const displayEl = document.getElementById('y-axis-display');
            if (displayEl) {
                const min = Math.min(...this.yAxisValues).toFixed(2);
                const max = Math.max(...this.yAxisValues).toFixed(2);
                displayEl.textContent = `${min} a ${max}`;
            }
        }
    }

    /**
     * Abre diálogo para editar ambos os eixos (X e Y) de uma vez
     */
    editAxesDialog() {
        if (!window.dialogManager || !window.dialogManager.promptValues) {
            alert('Gerenciador de diálogos não disponível');
            return;
        }

        const fields = [];

        // Campo para Eixo X
        if (this.xAxis && this.xAxis.enabled && this.xAxis.command) {
            const currentMin = this.xAxisValues.length > 0 ? Math.min(...this.xAxisValues) : (this.xAxis.min || 0);
            const currentMax = this.xAxisValues.length > 0 ? Math.max(...this.xAxisValues) : (this.xAxis.max || 100);

            fields.push({
                label: `Mínimo - Eixo X (${this.xLabel})`,
                type: 'number',
                default: currentMin,
                icon: 'bi-arrow-down'
            });

            fields.push({
                label: `Máximo - Eixo X (${this.xLabel})`,
                type: 'number',
                default: currentMax,
                icon: 'bi-arrow-up'
            });
        }

        // Campo para Eixo Y
        if (this.yAxis && this.yAxis.enabled && this.yAxis.command) {
            const currentMin = this.yAxisValues.length > 0 ? Math.min(...this.yAxisValues) : (this.yAxis.min || 0);
            const currentMax = this.yAxisValues.length > 0 ? Math.max(...this.yAxisValues) : (this.yAxis.max || 100);

            fields.push({
                label: `Mínimo - Eixo Y (${this.yLabel})`,
                type: 'number',
                default: currentMin,
                icon: 'bi-arrow-down'
            });

            fields.push({
                label: `Máximo - Eixo Y (${this.yLabel})`,
                type: 'number',
                default: currentMax,
                icon: 'bi-arrow-up'
            });
        }

        if (fields.length === 0) return;

        window.dialogManager.promptValues('Editar Eixos', fields, 'bi-sliders').then(values => {
            if (values) {
                let changed = false;

                // Processar Eixo X
                if (this.xAxis && this.xAxis.enabled && this.xAxis.command) {
                    const xMinKey = `Mínimo - Eixo X (${this.xLabel})`;
                    const xMaxKey = `Máximo - Eixo X (${this.xLabel})`;
                    const newXMin = parseFloat(values[xMinKey]);
                    const newXMax = parseFloat(values[xMaxKey]);

                    if (!isNaN(newXMin) && !isNaN(newXMax) && newXMin < newXMax) {
                        const newValues = [];
                        const step = (newXMax - newXMin) / (this.cols - 1);
                        for (let i = 0; i < this.cols; i++) {
                            newValues.push(newXMin + i * step);
                        }
                        this.xAxisValues = newValues;

                        const commandValues = newValues.map(v => v.toFixed(2)).join(',');
                        this.onValueChange(this.xAxis.command, commandValues);
                        changed = true;
                    }
                }

                // Processar Eixo Y
                if (this.yAxis && this.yAxis.enabled && this.yAxis.command) {
                    const yMinKey = `Mínimo - Eixo Y (${this.yLabel})`;
                    const yMaxKey = `Máximo - Eixo Y (${this.yLabel})`;
                    const newYMin = parseFloat(values[yMinKey]);
                    const newYMax = parseFloat(values[yMaxKey]);

                    if (!isNaN(newYMin) && !isNaN(newYMax) && newYMin < newYMax) {
                        const newValues = [];
                        const step = (newYMax - newYMin) / (this.rows - 1);
                        for (let i = 0; i < this.rows; i++) {
                            newValues.push(newYMin + i * step);
                        }
                        this.yAxisValues = newValues;

                        const commandValues = newValues.map(v => v.toFixed(2)).join(',');
                        this.onValueChange(this.yAxis.command, commandValues);
                        changed = true;
                    }
                }

                if (changed) {
                    this.updateAxisDisplays();
                    if (window.notificationManager) {
                        window.notificationManager.info('Eixos atualizados');
                    }
                }
            }
        });
    }
}
