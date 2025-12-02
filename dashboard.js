/* dashboard.js
   Dashboard with configurable elements: Gauge, Bar, LED
   - Single click: view mode (see values only, no interaction)
   - Double click: edit mode with 2 tabs (Content / Position)
   - Persistence: localStorage key 'dsw_dashboard_elements_v1'
   
   Element types:
   - gauge: circular dial with needle pointer
   - bar: horizontal/vertical progress bar
   - led: on/off indicator with optional blinking
*/
(function () {
    const STORAGE_KEY = 'dsw_dashboard_elements_v1';
    const container = document.getElementById('dashboardContent');
    const modal = document.getElementById('dashboardModal');
    const btnOpen = document.getElementById('dashboardBtn');
    const btnClose = document.getElementById('dashboardCloseBtn');

    if (!container || !modal || !btnOpen || !btnClose) {
        console.warn('Dashboard elements missing in DOM.');
        return;
    }

    const defaultElements = [
        {
            id: 'rpm_gauge',
            type: 'gauge',
            label: 'RPM',
            value: 1200,
            min: 0,
            max: 8000,
            size: 140,
            color: '#8B0000',
            pos: { x: 20, y: 40 }
        },
        {
            id: 'speed_gauge',
            type: 'gauge',
            label: 'Velocidade',
            value: 60,
            min: 0,
            max: 300,
            size: 140,
            color: '#8B0000',
            pos: { x: 80, y: 40 }
        },
        {
            id: 'engine_led',
            type: 'led',
            label: 'Motor Ativo',
            value: 1,
            threshold: 500,
            color: '#00FF00',
            colorOff: '#333333',
            blink: true,
            blinkRate: 500,
            size: 50,
            pos: { x: 50, y: 75 }
        }
    ];

    let elements = [];
    let editMode = false;
    let backupElements = null;
    let blinkIntervals = {};

    function loadElements() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(defaultElements));
            return JSON.parse(raw);
        } catch (err) {
            console.error('Failed to load elements', err);
            return JSON.parse(JSON.stringify(defaultElements));
        }
    }

    function saveElements(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (err) {
            console.error('Failed to save elements', err);
        }
    }

    elements = loadElements();

    function createGaugeElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        wrapper.style.width = (e.size || 120) + 'px';
        wrapper.style.height = (e.size || 120) + 'px';

        const size = e.size || 120;
        const radius = (size / 2) - 15;
        const center = size / 2;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';

        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttribute('cx', center);
        bgCircle.setAttribute('cy', center);
        bgCircle.setAttribute('r', radius);
        bgCircle.setAttribute('fill', 'rgba(20, 20, 20, 0.8)');
        bgCircle.setAttribute('stroke', 'var(--border-color)');
        bgCircle.setAttribute('stroke-width', '2');
        svg.appendChild(bgCircle);

        for (let i = 0; i <= 10; i++) {
            const angle = (i / 10) * 270 - 135;
            const rad = angle * (Math.PI / 180);
            const x1 = center + (radius - 5) * Math.cos(rad);
            const y1 = center + (radius - 5) * Math.sin(rad);
            const x2 = center + radius * Math.cos(rad);
            const y2 = center + radius * Math.sin(rad);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#555');
            line.setAttribute('stroke-width', '1');
            svg.appendChild(line);

            const labelVal = e.min + (e.max - e.min) * (i / 10);
            const labelAngle = angle + 6;
            const labelRad = labelAngle * (Math.PI / 180);
            const lx = center + (radius - 18) * Math.cos(labelRad);
            const ly = center + (radius - 18) * Math.sin(labelRad);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', lx);
            text.setAttribute('y', ly);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', '#999');
            text.setAttribute('font-size', size > 120 ? '10' : '8');
            text.textContent = labelVal.toFixed(0);
            svg.appendChild(text);
        }

        const needle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        needle.setAttribute('id', `needle_${e.id}`);
        const needleRotation = ((e.value - e.min) / (e.max - e.min)) * 270 - 135;
        needle.setAttribute('transform', `rotate(${needleRotation} ${center} ${center})`);

        const needleLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        needleLine.setAttribute('x1', center);
        needleLine.setAttribute('y1', center);
        needleLine.setAttribute('x2', center);
        needleLine.setAttribute('y2', center - (radius - 10));
        needleLine.setAttribute('stroke', e.color || 'var(--primary-red)');
        needleLine.setAttribute('stroke-width', '3');
        needleLine.setAttribute('stroke-linecap', 'round');
        needle.appendChild(needleLine);

        const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerDot.setAttribute('cx', center);
        centerDot.setAttribute('cy', center);
        centerDot.setAttribute('r', '5');
        centerDot.setAttribute('fill', e.color || 'var(--primary-red)');
        needle.appendChild(centerDot);
        svg.appendChild(needle);

        const textBox = document.createElement('div');
        textBox.style.position = 'absolute';
        textBox.style.bottom = '8px';
        textBox.style.width = '100%';
        textBox.style.textAlign = 'center';
        textBox.style.pointerEvents = 'none';

        const label = document.createElement('div');
        label.className = 'marker-label';
        label.style.fontSize = '11px';
        label.textContent = e.label || e.id;

        const value = document.createElement('div');
        value.className = 'marker-value';
        value.style.fontSize = '14px';
        value.style.fontWeight = '700';
        value.textContent = e.value.toFixed(1);

        textBox.appendChild(label);
        textBox.appendChild(value);
        svg.appendChild(textBox);

        wrapper.appendChild(svg);
        wrapper._needle = needle;
        wrapper._valueEl = value;
        wrapper._type = 'gauge';
        return wrapper;
    }

    function createBarElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        wrapper.style.width = '120px';
        wrapper.style.height = '60px';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        container.style.padding = '10px';

        const label = document.createElement('div');
        label.style.fontSize = '12px';
        label.style.color = 'var(--text-light)';
        label.textContent = e.label || e.id;

        const bar = document.createElement('div');
        bar.style.width = '100px';
        bar.style.height = '12px';
        bar.style.background = '#333';
        bar.style.border = '1px solid var(--border-color)';
        bar.style.borderRadius = '6px';
        bar.style.overflow = 'hidden';

        const fill = document.createElement('div');
        fill.style.height = '100%';
        fill.style.background = e.color || 'var(--primary-red)';
        fill.style.width = ((e.value - e.min) / (e.max - e.min)) * 100 + '%';
        fill.style.transition = 'width 0.3s ease';
        bar.appendChild(fill);

        const value = document.createElement('div');
        value.style.fontSize = '11px';
        value.style.color = 'var(--light-red)';
        value.style.textAlign = 'center';
        value.textContent = e.value.toFixed(1);

        container.appendChild(label);
        container.appendChild(bar);
        container.appendChild(value);
        wrapper.appendChild(container);

        wrapper._fillEl = fill;
        wrapper._valueEl = value;
        wrapper._type = 'bar';
        return wrapper;
    }

    function createLEDElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        wrapper.style.width = (e.size || 50) + 'px';
        wrapper.style.height = (e.size + 30) + 'px';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.gap = '6px';

        const label = document.createElement('div');
        label.style.fontSize = '11px';
        label.style.color = 'var(--text-light)';
        label.textContent = e.label || e.id;

        const led = document.createElement('div');
        const size = e.size || 50;
        led.style.width = size + 'px';
        led.style.height = size + 'px';
        led.style.borderRadius = '50%';
        led.style.background = e.value >= e.threshold ? (e.color || '#00FF00') : (e.colorOff || '#333');
        led.style.border = '2px solid #555';
        led.style.boxShadow = e.value >= e.threshold ? `0 0 10px ${e.color || '#00FF00'}` : 'none';

        if (e.blink && e.value >= e.threshold) {
            led.id = `led_${e.id}`;
            wrapper._blinkEl = led;
        }

        container.appendChild(label);
        container.appendChild(led);
        wrapper.appendChild(container);

        wrapper._ledEl = led;
        wrapper._type = 'led';
        return wrapper;
    }

    function createElement(e) {
        if (e.type === 'bar') return createBarElement(e);
        if (e.type === 'led') return createLEDElement(e);
        return createGaugeElement(e);
    }

    function updateElement(el, newValue) {
        const e = elements.find(elem => elem.id === el.dataset.id);
        if (!e) return;
        e.value = newValue;

        if (el._type === 'gauge' && el._needle) {
            const size = e.size || 120;
            const radius = (size / 2) - 15;
            const center = size / 2;
            const needleRotation = ((newValue - e.min) / (e.max - e.min)) * 270 - 135;
            el._needle.setAttribute('transform', `rotate(${needleRotation} ${center} ${center})`);
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1);
        } else if (el._type === 'bar' && el._fillEl) {
            const pct = ((newValue - e.min) / (e.max - e.min)) * 100;
            el._fillEl.style.width = pct + '%';
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1);
        } else if (el._type === 'led' && el._ledEl) {
            const isActive = newValue >= e.threshold;
            el._ledEl.style.background = isActive ? (e.color || '#00FF00') : (e.colorOff || '#333');
            el._ledEl.style.boxShadow = isActive ? `0 0 10px ${e.color || '#00FF00'}` : 'none';
        }
    }

    function startBlinking(el) {
        if (!el._blinkEl) return;
        const e = elements.find(elem => elem.id === el.dataset.id);
        if (!e || !e.blink) return;

        const interval = e.blinkRate || 500;
        let visible = true;

        blinkIntervals[e.id] = setInterval(() => {
            visible = !visible;
            el._blinkEl.style.opacity = visible ? '1' : '0.2';
        }, interval / 2);
    }

    function stopBlinking(id) {
        if (blinkIntervals[id]) {
            clearInterval(blinkIntervals[id]);
            delete blinkIntervals[id];
        }
    }

    function renderViewMode() {
        if (!container) return;
        container.innerHTML = '';
        elements.forEach(e => {
            const el = createElement(e);
            container.appendChild(el);
            if (e.type === 'led' && e.blink && e.value >= e.threshold) {
                startBlinking(el);
            }
        });
    }

    function renderEditMode() {
        if (!container) return;
        container.innerHTML = '';

        // Tabs
        const tabsContainer = document.createElement('div');
        tabsContainer.style.display = 'flex';
        tabsContainer.style.gap = '10px';
        tabsContainer.style.padding = '15px 20px';
        tabsContainer.style.borderBottom = '2px solid var(--border-color)';
        tabsContainer.style.position = 'sticky';
        tabsContainer.style.top = '0';
        tabsContainer.style.background = 'rgba(0,0,0,0.5)';
        tabsContainer.style.zIndex = '100';

        const tabContent = document.createElement('div');
        tabContent.style.padding = '20px';
        tabContent.style.paddingBottom = '80px';
        tabContent.style.overflowY = 'auto';
        tabContent.style.maxHeight = 'calc(100% - 70px)';

        const tabContentTab = document.createElement('div');
        tabContentTab.style.display = 'none';
        tabContentTab.id = 'tab-content';

        const tabPositionTab = document.createElement('div');
        tabPositionTab.style.display = 'none';
        tabPositionTab.id = 'tab-position';

        const btnContent = document.createElement('button');
        btnContent.textContent = 'Conteúdo';
        btnContent.style.padding = '8px 16px';
        btnContent.style.background = 'var(--primary-red)';
        btnContent.style.border = 'none';
        btnContent.style.color = 'white';
        btnContent.style.borderRadius = '4px';
        btnContent.style.cursor = 'pointer';
        btnContent.style.fontWeight = '600';

        const btnPosition = document.createElement('button');
        btnPosition.textContent = 'Posição';
        btnPosition.style.padding = '8px 16px';
        btnPosition.style.background = 'transparent';
        btnPosition.style.border = '1px solid var(--border-color)';
        btnPosition.style.color = 'var(--text-light)';
        btnPosition.style.borderRadius = '4px';
        btnPosition.style.cursor = 'pointer';

        btnContent.addEventListener('click', () => {
            tabContentTab.style.display = 'block';
            tabPositionTab.style.display = 'none';
            btnContent.style.background = 'var(--primary-red)';
            btnContent.style.border = 'none';
            btnPosition.style.background = 'transparent';
            btnPosition.style.border = '1px solid var(--border-color)';
        });

        btnPosition.addEventListener('click', () => {
            tabContentTab.style.display = 'none';
            tabPositionTab.style.display = 'block';
            btnContent.style.background = 'transparent';
            btnContent.style.border = '1px solid var(--border-color)';
            btnPosition.style.background = 'var(--primary-red)';
            btnPosition.style.border = 'none';
        });

        tabsContainer.appendChild(btnContent);
        tabsContainer.appendChild(btnPosition);
        container.appendChild(tabsContainer);

        // ABA 1: CONTEÚDO
        elements.forEach((e, idx) => {
            const item = document.createElement('div');
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.border = '1px solid var(--border-color)';
            item.style.borderRadius = '6px';
            item.style.padding = '15px';
            item.style.marginBottom = '15px';

            const titleRow = document.createElement('div');
            titleRow.style.display = 'flex';
            titleRow.style.justifyContent = 'space-between';
            titleRow.style.alignItems = 'center';
            titleRow.style.marginBottom = '10px';
            titleRow.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            titleRow.style.paddingBottom = '10px';

            const title = document.createElement('h4');
            title.style.margin = '0';
            title.style.color = 'var(--light-red)';
            title.style.fontSize = '16px';
            title.textContent = e.label || e.id;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕ Remove';
            removeBtn.style.background = '#8B0000';
            removeBtn.style.border = 'none';
            removeBtn.style.color = 'white';
            removeBtn.style.padding = '4px 8px';
            removeBtn.style.borderRadius = '4px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.fontSize = '12px';
            removeBtn.addEventListener('click', () => {
                elements.splice(idx, 1);
                renderEditMode();
            });

            titleRow.appendChild(title);
            titleRow.appendChild(removeBtn);
            item.appendChild(titleRow);

            // Fields
            const commonFields = [
                { label: 'Label', key: 'label', type: 'text' },
                { label: 'Tipo', key: 'type', type: 'select', options: ['gauge', 'bar', 'led'] },
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Valor', key: 'value', type: 'number' },
                { label: 'Cor', key: 'color', type: 'color' },
                { label: 'Tamanho (px)', key: 'size', type: 'number' }
            ];

            const ledFields = [
                { label: 'Limiar', key: 'threshold', type: 'number' },
                { label: 'Cor Off', key: 'colorOff', type: 'color' },
                { label: 'Piscar', key: 'blink', type: 'checkbox' },
                { label: 'Taxa Pisca (ms)', key: 'blinkRate', type: 'number' }
            ];

            const fieldsToShow = e.type === 'led' ? [...commonFields, ...ledFields] : commonFields;

            fieldsToShow.forEach(f => {
                if (e.type !== 'led' && (f.key === 'threshold' || f.key === 'colorOff' || f.key === 'blink' || f.key === 'blinkRate')) return;

                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '10px';
                row.style.marginBottom = '8px';
                row.style.alignItems = 'center';

                const lbl = document.createElement('label');
                lbl.style.flex = '0 0 130px';
                lbl.style.color = 'var(--text-light)';
                lbl.style.fontSize = '13px';
                lbl.textContent = f.label;

                let inp;
                if (f.type === 'select') {
                    inp = document.createElement('select');
                    inp.style.flex = '1';
                    f.options.forEach(opt => {
                        const optEl = document.createElement('option');
                        optEl.value = opt;
                        optEl.textContent = opt;
                        optEl.selected = e[f.key] === opt;
                        inp.appendChild(optEl);
                    });
                    inp.style.padding = '6px 8px';
                    inp.style.background = 'var(--bg-dark)';
                    inp.style.border = '1px solid var(--border-color)';
                    inp.style.color = 'var(--text-light)';
                    inp.style.borderRadius = '4px';
                } else if (f.type === 'checkbox') {
                    inp = document.createElement('input');
                    inp.type = 'checkbox';
                    inp.checked = e[f.key] || false;
                    inp.style.cursor = 'pointer';
                    inp.style.width = '18px';
                    inp.style.height = '18px';
                } else {
                    inp = document.createElement('input');
                    inp.type = f.type;
                    inp.style.flex = '1';
                    inp.style.padding = '6px 8px';
                    inp.style.background = 'var(--bg-dark)';
                    inp.style.border = '1px solid var(--border-color)';
                    inp.style.color = 'var(--text-light)';
                    inp.style.borderRadius = '4px';
                    inp.style.fontSize = '13px';
                    inp.value = f.type === 'color' ? (e[f.key] || '#8B0000') : e[f.key];
                }

                inp.addEventListener('change', () => {
                    let v;
                    if (f.type === 'checkbox') {
                        v = inp.checked;
                    } else if (f.type === 'number') {
                        v = parseFloat(inp.value);
                    } else {
                        v = inp.value;
                    }
                    elements[idx][f.key] = v;
                    renderEditMode();
                });

                row.appendChild(lbl);
                row.appendChild(inp);
                item.appendChild(row);
            });

            tabContentTab.appendChild(item);
        });

        // ABA 2: POSIÇÃO
        const posGrid = document.createElement('div');
        posGrid.style.display = 'grid';
        posGrid.style.gridTemplateColumns = '1fr 1fr';
        posGrid.style.gap = '20px';
        posGrid.style.padding = '20px';

        // Visual grid 10x10 para arrastar visualmente
        const gridContainer = document.createElement('div');
        gridContainer.style.gridColumn = '1 / -1';
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(10, 1fr)';
        gridContainer.style.gap = '4px';
        gridContainer.style.padding = '10px';
        gridContainer.style.background = 'rgba(255,255,255,0.05)';
        gridContainer.style.borderRadius = '6px';
        gridContainer.style.border = '1px solid var(--border-color)';
        gridContainer.style.position = 'relative';
        gridContainer.style.height = '300px';
        gridContainer.style.marginBottom = '15px';

        // Preview items
        elements.forEach((e, idx) => {
            const preview = document.createElement('div');
            preview.style.position = 'absolute';
            preview.style.left = (e.pos.x) + '%';
            preview.style.top = (e.pos.y) + '%';
            preview.style.transform = 'translate(-50%, -50%)';
            preview.style.width = '30px';
            preview.style.height = '30px';
            preview.style.background = e.color || 'var(--primary-red)';
            preview.style.borderRadius = e.type === 'led' ? '50%' : '4px';
            preview.style.border = '2px solid white';
            preview.style.cursor = 'pointer';
            preview.style.display = 'flex';
            preview.style.alignItems = 'center';
            preview.style.justifyContent = 'center';
            preview.style.fontSize = '11px';
            preview.style.color = 'white';
            preview.style.fontWeight = '600';
            preview.textContent = (idx + 1);

            preview.addEventListener('click', () => {
                // Show position editor for this element
                showPosEditor(idx);
            });

            gridContainer.appendChild(preview);
        });

        const showPosEditor = (idx) => {
            const e = elements[idx];
            posGrid.innerHTML = '';

            const backBtn = document.createElement('button');
            backBtn.textContent = '← Voltar';
            backBtn.style.padding = '8px 16px';
            backBtn.style.background = 'var(--border-color)';
            backBtn.style.border = 'none';
            backBtn.style.color = 'var(--text-light)';
            backBtn.style.borderRadius = '4px';
            backBtn.style.cursor = 'pointer';
            backBtn.style.gridColumn = '1 / -1';
            backBtn.style.marginBottom = '10px';
            backBtn.addEventListener('click', () => {
                posGrid.innerHTML = '';
                posGrid.appendChild(gridContainer);
            });
            posGrid.appendChild(backBtn);

            const title = document.createElement('h4');
            title.style.color = 'var(--light-red)';
            title.style.gridColumn = '1 / -1';
            title.style.marginBottom = '15px';
            title.textContent = `Posição: ${e.label}`;
            posGrid.appendChild(title);

            const xRow = document.createElement('div');
            xRow.style.display = 'flex';
            xRow.style.gap = '10px';
            const xLbl = document.createElement('label');
            xLbl.textContent = 'X (%)';
            xLbl.style.flex = '0 0 60px';
            xLbl.style.color = 'var(--text-light)';
            const xInp = document.createElement('input');
            xInp.type = 'number';
            xInp.value = e.pos.x;
            xInp.style.flex = '1';
            xInp.style.padding = '6px 8px';
            xInp.style.background = 'var(--bg-dark)';
            xInp.style.border = '1px solid var(--border-color)';
            xInp.style.color = 'var(--text-light)';
            xInp.addEventListener('change', () => {
                elements[idx].pos.x = parseFloat(xInp.value);
            });
            xRow.appendChild(xLbl);
            xRow.appendChild(xInp);
            posGrid.appendChild(xRow);

            const yRow = document.createElement('div');
            yRow.style.display = 'flex';
            yRow.style.gap = '10px';
            const yLbl = document.createElement('label');
            yLbl.textContent = 'Y (%)';
            yLbl.style.flex = '0 0 60px';
            yLbl.style.color = 'var(--text-light)';
            const yInp = document.createElement('input');
            yInp.type = 'number';
            yInp.value = e.pos.y;
            yInp.style.flex = '1';
            yInp.style.padding = '6px 8px';
            yInp.style.background = 'var(--bg-dark)';
            yInp.style.border = '1px solid var(--border-color)';
            yInp.style.color = 'var(--text-light)';
            yInp.addEventListener('change', () => {
                elements[idx].pos.y = parseFloat(yInp.value);
            });
            yRow.appendChild(yLbl);
            yRow.appendChild(yInp);
            posGrid.appendChild(yRow);
        };

        posGrid.appendChild(gridContainer);
        tabPositionTab.appendChild(posGrid);

        // Add new element button
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Adicionar Elemento';
        addBtn.style.padding = '12px 20px';
        addBtn.style.background = 'var(--primary-red)';
        addBtn.style.border = 'none';
        addBtn.style.color = 'white';
        addBtn.style.borderRadius = '6px';
        addBtn.style.cursor = 'pointer';
        addBtn.style.fontSize = '14px';
        addBtn.style.fontWeight = '600';
        addBtn.style.marginTop = '15px';
        addBtn.style.width = '100%';
        addBtn.addEventListener('click', () => {
            const newId = 'elem_' + Date.now();
            elements.push({
                id: newId,
                type: 'gauge',
                label: 'Novo Elemento',
                value: 0,
                min: 0,
                max: 100,
                size: 120,
                color: '#8B0000',
                pos: { x: 50, y: 50 }
            });
            renderEditMode();
        });
        tabContentTab.appendChild(addBtn);

        tabContentTab.style.display = 'block';
        tabContent.appendChild(tabContentTab);
        tabContent.appendChild(tabPositionTab);
        container.appendChild(tabContent);
    }

    function openModal(editModeFlag = false) {
        if (!modal) return;
        editMode = editModeFlag;

        if (editMode) {
            backupElements = JSON.parse(JSON.stringify(elements));
            renderEditMode();
        } else {
            renderViewMode();
        }

        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('dashboard-open');

        const footer = document.getElementById('dashboard-edit-footer');
        if (footer) {
            footer.style.display = editMode ? 'flex' : 'none';
        }
    }

    function closeModal() {
        if (!modal) return;
        editMode = false;
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('dashboard-open');

        const footer = document.getElementById('dashboard-edit-footer');
        if (footer) {
            footer.style.display = 'none';
        }

        // Stop all blinks
        Object.keys(blinkIntervals).forEach(id => stopBlinking(id));
    }

    // Handle single vs double click
    let clickCount = 0;
    let clickTimer = null;

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            clickCount++;

            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    openModal(false);
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                openModal(true);
                clickCount = 0;
            }
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', closeModal);
    }

    // Create footer with Revert/Save
    const dashboardFrame = document.querySelector('.dashboard-frame');
    if (dashboardFrame) {
        const footer = document.createElement('div');
        footer.id = 'dashboard-edit-footer';
        footer.style.position = 'absolute';
        footer.style.bottom = '0';
        footer.style.left = '0';
        footer.style.right = '0';
        footer.style.height = '60px';
        footer.style.display = 'none';
        footer.style.background = 'rgba(0,0,0,0.7)';
        footer.style.borderTop = '1px solid var(--border-color)';
        footer.style.padding = '10px 20px';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '10px';
        footer.style.alignItems = 'center';

        const revertBtn = document.createElement('button');
        revertBtn.textContent = 'Reverter';
        revertBtn.style.padding = '8px 16px';
        revertBtn.style.background = 'var(--border-color)';
        revertBtn.style.border = 'none';
        revertBtn.style.color = 'var(--text-light)';
        revertBtn.style.borderRadius = '4px';
        revertBtn.style.cursor = 'pointer';
        revertBtn.addEventListener('click', () => {
            if (backupElements) {
                elements = JSON.parse(JSON.stringify(backupElements));
            }
            closeModal();
        });

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Salvar';
        saveBtn.style.padding = '8px 16px';
        saveBtn.style.background = 'var(--primary-red)';
        saveBtn.style.border = 'none';
        saveBtn.style.color = 'white';
        saveBtn.style.borderRadius = '4px';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.fontWeight = '600';
        saveBtn.addEventListener('click', () => {
            saveElements(elements);
            closeModal();
        });

        footer.appendChild(revertBtn);
        footer.appendChild(saveBtn);
        dashboardFrame.appendChild(footer);
    }

    // expose API
    window.DashboardElements = {
        load: () => {
            elements = loadElements();
            if (!editMode) renderViewMode();
            return elements;
        },
        save: () => saveElements(elements),
        create: (e) => {
            if (!e.id) e.id = 'elem_' + Date.now();
            elements.push(e);
            saveElements(elements);
            if (!editMode) renderViewMode();
            return e;
        },
        updateValue: (id, newValue) => {
            const el = container.querySelector(`[data-id="${id}"]`);
            if (el) updateElement(el, newValue);
        },
        getAll: () => elements,
        getElement: (id) => elements.find(e => e.id === id),
        openModal,
        closeModal
    };

    if (modal && modal.getAttribute('aria-hidden') === 'false') {
        renderViewMode();
    }

})();
