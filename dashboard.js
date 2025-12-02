/* dashboard.js
   Dashboard with configurable elements: Gauge, Bar, LED
   - Single click: view mode (see values only, no interaction)
   - Double click: edit mode with drag-to-position on canvas
   - Persistence: localStorage key 'dsw_dashboard_elements_v1'
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

        const cont = document.createElement('div');
        cont.style.display = 'flex';
        cont.style.flexDirection = 'column';
        cont.style.gap = '8px';
        cont.style.padding = '10px';

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

        cont.appendChild(label);
        cont.appendChild(bar);
        cont.appendChild(value);
        wrapper.appendChild(cont);

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

        const cont = document.createElement('div');
        cont.style.display = 'flex';
        cont.style.flexDirection = 'column';
        cont.style.alignItems = 'center';
        cont.style.gap = '6px';

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

        cont.appendChild(label);
        cont.appendChild(led);
        wrapper.appendChild(cont);

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
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        
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
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';

        const mainArea = document.createElement('div');
        mainArea.style.display = 'flex';
        mainArea.style.height = '100%';
        mainArea.style.gap = '0';

        // Left panel: Configurações
        const leftPanel = document.createElement('div');
        leftPanel.style.width = '30%';
        leftPanel.style.overflowY = 'auto';
        leftPanel.style.padding = '20px';
        leftPanel.style.paddingBottom = '80px';
        leftPanel.style.background = 'rgba(255,255,255,0.02)';
        leftPanel.style.borderRight = '1px solid var(--border-color)';

        // Right panel: Canvas para arrastar
        const rightPanel = document.createElement('div');
        rightPanel.style.flex = '1';
        rightPanel.style.position = 'relative';
        rightPanel.style.background = 'rgba(0,0,0,0.3)';
        rightPanel.style.overflow = 'hidden';

        const canvas = document.createElement('div');
        canvas.style.position = 'absolute';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.left = '0';
        canvas.style.top = '0';

        // Add element previews with drag
        elements.forEach((e, idx) => {
            const preview = document.createElement('div');
            preview.className = 'dashboard-marker edit-draggable';
            preview.dataset.id = e.id;
            preview.dataset.idx = idx;
            preview.style.position = 'absolute';
            preview.style.left = (e.pos.x) + '%';
            preview.style.top = (e.pos.y) + '%';
            preview.style.transform = 'translate(-50%, -50%)';
            preview.style.cursor = 'grab';
            preview.style.userSelect = 'none';
            preview.style.zIndex = '10';

            // Mini preview
            if (e.type === 'gauge') {
                preview.style.width = '60px';
                preview.style.height = '60px';
                preview.style.background = e.color || 'var(--primary-red)';
                preview.style.borderRadius = '50%';
                preview.style.border = '2px solid white';
            } else if (e.type === 'bar') {
                preview.style.width = '80px';
                preview.style.height = '25px';
                preview.style.background = e.color || 'var(--primary-red)';
                preview.style.borderRadius = '12px';
                preview.style.border = '2px solid white';
            } else if (e.type === 'led') {
                preview.style.width = (e.size || 50) + 'px';
                preview.style.height = (e.size || 50) + 'px';
                preview.style.background = e.color || '#00FF00';
                preview.style.borderRadius = '50%';
                preview.style.border = '2px solid white';
                preview.style.boxShadow = `0 0 15px ${e.color || '#00FF00'}`;
            }

            // Label
            const label = document.createElement('div');
            label.style.position = 'absolute';
            label.style.bottom = '-20px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.color = 'var(--text-light)';
            label.style.fontSize = '12px';
            label.style.fontWeight = '600';
            label.style.whiteSpace = 'nowrap';
            label.textContent = e.label || e.id;
            preview.appendChild(label);

            // Drag logic
            let dragging = false;
            let start = { x: 0, y: 0 };
            let bounds = null;

            function onPointerDown(ev) {
                ev.preventDefault();
                dragging = true;
                preview.setPointerCapture && preview.setPointerCapture(ev.pointerId);
                start.x = ev.clientX;
                start.y = ev.clientY;
                bounds = canvas.getBoundingClientRect();
                preview.style.cursor = 'grabbing';
                preview.style.zIndex = '1000';
            }

            function onPointerMove(ev) {
                if (!dragging) return;
                const dx = ev.clientX - start.x;
                const dy = ev.clientY - start.y;
                const currentRect = preview.getBoundingClientRect();
                const cx = currentRect.left + currentRect.width / 2 + dx;
                const cy = currentRect.top + currentRect.height / 2 + dy;

                const xClamped = Math.max(bounds.left + 5, Math.min(cx, bounds.right - 5));
                const yClamped = Math.max(bounds.top + 5, Math.min(cy, bounds.bottom - 5));

                const px = ((xClamped - bounds.left) / bounds.width) * 100;
                const py = ((yClamped - bounds.top) / bounds.height) * 100;

                preview.style.left = px + '%';
                preview.style.top = py + '%';

                elements[idx].pos = { x: Math.round(px * 100) / 100, y: Math.round(py * 100) / 100 };

                start.x = ev.clientX;
                start.y = ev.clientY;
            }

            function onPointerUp(ev) {
                if (!dragging) return;
                dragging = false;
                preview.releasePointerCapture && preview.releasePointerCapture(ev.pointerId);
                preview.style.cursor = 'grab';
                preview.style.zIndex = '10';
            }

            preview.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);

            canvas.appendChild(preview);

            // Click to edit config
            preview.addEventListener('click', (e) => {
                if (!dragging) {
                    showEditPanel(idx);
                }
            });
        });

        rightPanel.appendChild(canvas);

        // Edit panel function
        const showEditPanel = (idx) => {
            const e = elements[idx];
            leftPanel.innerHTML = '';

            const title = document.createElement('h3');
            title.style.color = 'var(--light-red)';
            title.style.marginBottom = '15px';
            title.textContent = e.label || e.id;
            leftPanel.appendChild(title);

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '✕ Remover';
            removeBtn.style.width = '100%';
            removeBtn.style.padding = '8px 12px';
            removeBtn.style.background = '#8B0000';
            removeBtn.style.border = 'none';
            removeBtn.style.color = 'white';
            removeBtn.style.borderRadius = '4px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.marginBottom = '15px';
            removeBtn.addEventListener('click', () => {
                elements.splice(idx, 1);
                renderEditMode();
            });
            leftPanel.appendChild(removeBtn);

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
                row.style.flexDirection = 'column';
                row.style.gap = '4px';
                row.style.marginBottom = '12px';

                const lbl = document.createElement('label');
                lbl.style.color = 'var(--text-light)';
                lbl.style.fontSize = '12px';
                lbl.style.fontWeight = '600';
                lbl.textContent = f.label;

                let inp;
                if (f.type === 'select') {
                    inp = document.createElement('select');
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
                leftPanel.appendChild(row);
            });
        };

        // Add new element button
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Novo Elemento';
        addBtn.style.width = '100%';
        addBtn.style.padding = '12px 20px';
        addBtn.style.background = 'var(--primary-red)';
        addBtn.style.border = 'none';
        addBtn.style.color = 'white';
        addBtn.style.borderRadius = '6px';
        addBtn.style.cursor = 'pointer';
        addBtn.style.fontSize = '14px';
        addBtn.style.fontWeight = '600';
        addBtn.style.marginTop = '15px';
        addBtn.addEventListener('click', () => {
            const newId = 'elem_' + Date.now();
            elements.push({
                id: newId,
                type: 'gauge',
                label: 'Novo',
                value: 0,
                min: 0,
                max: 100,
                size: 120,
                color: '#8B0000',
                pos: { x: 50, y: 50 }
            });
            renderEditMode();
        });
        leftPanel.appendChild(addBtn);

        mainArea.appendChild(leftPanel);
        mainArea.appendChild(rightPanel);
        container.appendChild(mainArea);

        // Show first element by default
        if (elements.length > 0) {
            showEditPanel(0);
        }
    }

    function openModal(editModeFlag = false) {
        if (!modal) return;
        editMode = editModeFlag;

        // Show/hide footer BEFORE rendering content
        const footer = document.getElementById('dashboard-edit-footer');
        if (footer) {
            footer.style.display = editMode ? 'flex' : 'none';
        }

        if (editMode) {
            backupElements = JSON.parse(JSON.stringify(elements));
            renderEditMode();
        } else {
            renderViewMode();
        }

        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('dashboard-open');
    }

    function closeModal() {
        if (!modal) return;
        editMode = false;
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('dashboard-open');

        // Ensure footer is hidden on close
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

    // Create footer with Revert/Save (only visible in edit mode)
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
