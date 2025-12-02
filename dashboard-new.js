/* dashboard.js
   Dashboard with gauge markers, full configuration, and edit mode
   - Single click: open dashboard (view mode only - see values)
   - Double click: open dashboard (edit mode - configure everything)
   - Persistence: localStorage key 'dsw_dashboard_markers_v1'
*/
(function () {
    const STORAGE_KEY = 'dsw_dashboard_markers_v1';
    const container = document.getElementById('dashboardContent');
    const modal = document.getElementById('dashboardModal');
    const btnOpen = document.getElementById('dashboardBtn');
    const btnClose = document.getElementById('dashboardCloseBtn');

    if (!container || !modal || !btnOpen || !btnClose) {
        console.warn('Dashboard elements missing in DOM.');
        return;
    }

    const defaultMarkers = [
        {
            id: 'rpm',
            label: 'RPM',
            value: 1200,
            min: 0,
            max: 8000,
            size: 140,
            rotation: 0,
            pos: { x: 20, y: 40 }
        },
        {
            id: 'speed',
            label: 'Velocidade',
            value: 60,
            min: 0,
            max: 300,
            size: 140,
            rotation: 0,
            pos: { x: 80, y: 40 }
        },
        {
            id: 'pressure',
            label: 'Pressão',
            value: 2.5,
            min: 0,
            max: 4,
            size: 140,
            rotation: 0,
            pos: { x: 50, y: 75 }
        }
    ];

    let markers = [];
    let editMode = false;
    let backupMarkers = null;

    function loadMarkers() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(defaultMarkers));
            return JSON.parse(raw);
        } catch (err) {
            console.error('Failed to load markers', err);
            return JSON.parse(JSON.stringify(defaultMarkers));
        }
    }

    function saveMarkers(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (err) {
            console.error('Failed to save markers', err);
        }
    }

    markers = loadMarkers();

    function createGaugeElement(m) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker';
        wrapper.dataset.id = m.id;
        wrapper.style.left = (m.pos && m.pos.x != null ? m.pos.x : 50) + '%';
        wrapper.style.top = (m.pos && m.pos.y != null ? m.pos.y : 50) + '%';
        wrapper.style.width = (m.size || 120) + 'px';
        wrapper.style.height = (m.size || 120) + 'px';

        const size = m.size || 120;
        const radius = (size / 2) - 15;
        const center = size / 2;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';

        // Background circle
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttribute('cx', center);
        bgCircle.setAttribute('cy', center);
        bgCircle.setAttribute('r', radius);
        bgCircle.setAttribute('fill', 'rgba(20, 20, 20, 0.8)');
        bgCircle.setAttribute('stroke', 'var(--border-color)');
        bgCircle.setAttribute('stroke-width', '2');
        svg.appendChild(bgCircle);

        // Tick marks and scale
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

            const labelVal = m.min + (m.max - m.min) * (i / 10);
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

        // Needle (pointer)
        const needle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        needle.setAttribute('id', `needle_${m.id}`);

        const needleRotation = ((m.value - m.min) / (m.max - m.min)) * 270 - 135;
        needle.setAttribute('transform', `rotate(${needleRotation} ${center} ${center})`);

        const needleLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        needleLine.setAttribute('x1', center);
        needleLine.setAttribute('y1', center);
        needleLine.setAttribute('x2', center);
        needleLine.setAttribute('y2', center - (radius - 10));
        needleLine.setAttribute('stroke', 'var(--primary-red)');
        needleLine.setAttribute('stroke-width', '3');
        needleLine.setAttribute('stroke-linecap', 'round');
        needle.appendChild(needleLine);

        const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerDot.setAttribute('cx', center);
        centerDot.setAttribute('cy', center);
        centerDot.setAttribute('r', '5');
        centerDot.setAttribute('fill', 'var(--primary-red)');
        needle.appendChild(centerDot);

        svg.appendChild(needle);

        // Label and value on top
        const textBox = document.createElement('div');
        textBox.style.position = 'absolute';
        textBox.style.bottom = '8px';
        textBox.style.width = '100%';
        textBox.style.textAlign = 'center';
        textBox.style.pointerEvents = 'none';

        const label = document.createElement('div');
        label.className = 'marker-label';
        label.style.fontSize = '11px';
        label.textContent = m.label || m.id;

        const value = document.createElement('div');
        value.className = 'marker-value';
        value.style.fontSize = '14px';
        value.style.fontWeight = '700';
        value.textContent = m.value.toFixed(1);

        textBox.appendChild(label);
        textBox.appendChild(value);
        svg.appendChild(textBox);

        wrapper.appendChild(svg);
        wrapper._needle = needle;
        wrapper._valueEl = value;
        wrapper._svg = svg;
        wrapper._m = m;

        return wrapper;
    }

    function updateNeedle(el, newValue) {
        if (!el._needle || !el._m) return;
        const m = el._m;
        const center = (m.size || 120) / 2;
        const needleRotation = ((newValue - m.min) / (m.max - m.min)) * 270 - 135;
        el._needle.setAttribute('transform', `rotate(${needleRotation} ${center} ${center})`);
        if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1);
    }

    function renderMarkersView() {
        if (!container) return;
        container.innerHTML = '';
        markers.forEach(m => {
            const el = createGaugeElement(m);
            container.appendChild(el);
            attachDragListener(el);
        });
    }

    function attachDragListener(el) {
        let dragging = false;
        let start = { x: 0, y: 0 };
        let bounds = null;

        function onPointerDown(e) {
            if (editMode) return;
            e.preventDefault();
            dragging = true;
            el.setPointerCapture && el.setPointerCapture(e.pointerId);
            start.x = e.clientX;
            start.y = e.clientY;
            bounds = container.getBoundingClientRect();
            el.style.cursor = 'grabbing';
        }

        function onPointerMove(e) {
            if (!dragging) return;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            const currentRect = el.getBoundingClientRect();
            const cx = currentRect.left + currentRect.width / 2 + dx;
            const cy = currentRect.top + currentRect.height / 2 + dy;
            const xClamped = Math.max(bounds.left + 1, Math.min(cx, bounds.right - 1));
            const yClamped = Math.max(bounds.top + 1, Math.min(cy, bounds.bottom - 1));
            const px = ((xClamped - bounds.left) / bounds.width) * 100;
            const py = ((yClamped - bounds.top) / bounds.height) * 100;
            el.style.left = px + '%';
            el.style.top = py + '%';

            const id = el.dataset.id;
            const idx = markers.findIndex(t => t.id === id);
            if (idx >= 0) {
                markers[idx].pos = { x: Math.round(px * 100) / 100, y: Math.round(py * 100) / 100 };
            }
            start.x = e.clientX;
            start.y = e.clientY;
        }

        function onPointerUp(e) {
            if (!dragging) return;
            dragging = false;
            el.releasePointerCapture && el.releasePointerCapture(e.pointerId);
            el.style.cursor = 'grab';
            saveMarkers(markers);
        }

        el.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function renderEditMode() {
        if (!container) return;
        container.innerHTML = '';

        const editPanel = document.createElement('div');
        editPanel.style.display = 'flex';
        editPanel.style.flexDirection = 'column';
        editPanel.style.gap = '10px';
        editPanel.style.padding = '20px';
        editPanel.style.paddingBottom = '80px';
        editPanel.style.overflowY = 'auto';
        editPanel.style.maxHeight = '100%';
        editPanel.style.width = '100%';

        markers.forEach((m, idx) => {
            const item = document.createElement('div');
            item.style.background = 'rgba(255,255,255,0.05)';
            item.style.border = '1px solid var(--border-color)';
            item.style.borderRadius = '6px';
            item.style.padding = '15px';

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
            title.textContent = m.label || m.id;

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
                markers.splice(idx, 1);
                renderEditMode();
            });

            titleRow.appendChild(title);
            titleRow.appendChild(removeBtn);
            item.appendChild(titleRow);

            // Create field editors
            const fields = [
                { label: 'Label', key: 'label', type: 'text' },
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Valor', key: 'value', type: 'number' },
                { label: 'Tamanho (px)', key: 'size', type: 'number' },
                { label: 'Rotação (°)', key: 'rotation', type: 'number' },
                { label: 'Posição X (%)', key: 'posX', type: 'number' },
                { label: 'Posição Y (%)', key: 'posY', type: 'number' }
            ];

            fields.forEach(f => {
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

                const inp = document.createElement('input');
                inp.type = f.type;
                inp.style.flex = '1';
                inp.style.padding = '6px 8px';
                inp.style.background = 'var(--bg-dark)';
                inp.style.border = '1px solid var(--border-color)';
                inp.style.color = 'var(--text-light)';
                inp.style.borderRadius = '4px';
                inp.style.fontSize = '13px';

                if (f.key === 'posX') {
                    inp.value = (m.pos.x).toFixed(1);
                } else if (f.key === 'posY') {
                    inp.value = (m.pos.y).toFixed(1);
                } else if (f.type === 'number') {
                    inp.value = m[f.key];
                } else {
                    inp.value = m[f.key] || '';
                }

                inp.addEventListener('change', () => {
                    const v = f.type === 'number' ? parseFloat(inp.value) : inp.value;
                    if (f.key === 'posX') {
                        markers[idx].pos.x = v;
                    } else if (f.key === 'posY') {
                        markers[idx].pos.y = v;
                    } else {
                        markers[idx][f.key] = v;
                    }
                });

                row.appendChild(lbl);
                row.appendChild(inp);
                item.appendChild(row);
            });

            editPanel.appendChild(item);
        });

        // Add new marker button
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Adicionar Marcador';
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
            const newId = 'm_' + Date.now();
            markers.push({
                id: newId,
                label: 'Novo',
                value: 0,
                min: 0,
                max: 100,
                size: 120,
                rotation: 0,
                pos: { x: 50, y: 50 }
            });
            renderEditMode();
        });
        editPanel.appendChild(addBtn);

        container.appendChild(editPanel);
    }

    function openModal(editModeFlag = false) {
        if (!modal) return;
        editMode = editModeFlag;
        
        if (editMode) {
            backupMarkers = JSON.parse(JSON.stringify(markers));
            renderEditMode();
        } else {
            renderMarkersView();
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
    }

    // Handle click detection for single vs double click
    let clickCount = 0;
    let clickTimer = null;

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            clickCount++;
            
            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    // Single click
                    openModal(false);
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                // Double click
                openModal(true);
                clickCount = 0;
            }
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', closeModal);
    }

    // Create and wire footer buttons
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
            if (backupMarkers) {
                markers = JSON.parse(JSON.stringify(backupMarkers));
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
            saveMarkers(markers);
            closeModal();
        });

        footer.appendChild(revertBtn);
        footer.appendChild(saveBtn);
        dashboardFrame.appendChild(footer);
    }

    // expose API
    window.DashboardMarkers = {
        load: () => {
            markers = loadMarkers();
            if (!editMode) renderMarkersView();
            return markers;
        },
        save: () => saveMarkers(markers),
        create: (m) => {
            if (!m.id) m.id = 'm_' + Date.now();
            markers.push(m);
            saveMarkers(markers);
            if (!editMode) renderMarkersView();
            return m;
        },
        updateValue: (id, newValue) => {
            const idx = markers.findIndex(m => m.id === id);
            if (idx === -1) return null;
            markers[idx].value = newValue;
            const el = container && container.querySelector(`[data-id="${id}"]`);
            if (el) updateNeedle(el, newValue);
            return markers[idx];
        },
        getAll: () => markers,
        getMarker: (id) => markers.find(m => m.id === id) || null,
        remove: (id) => {
            const idx = markers.findIndex(m => m.id === id);
            if (idx === -1) return false;
            markers.splice(idx, 1);
            saveMarkers(markers);
            if (!editMode) renderMarkersView();
            return true;
        },
        openModal,
        closeModal
    };

    // Initial render if modal already visible
    if (modal && modal.getAttribute('aria-hidden') === 'false') {
        renderMarkersView();
    }

})();
