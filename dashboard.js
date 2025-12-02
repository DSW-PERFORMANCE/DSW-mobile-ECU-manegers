/* dashboard.js
   Dashboard com elementos configuráveis: Gauge, Bar, LED, Texto, Condicional
   - Tamanho em porcentagem (%)
   - Single click: view mode (visualização apenas)
   - Double click: edit mode com drag-to-position
   - Simulação de tamanho ao arrastar
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
            sizeScale: 100,
            color: '#8B0000',
            icon: 'speedometer2',
            pos: { x: 15, y: 30 }
        },
        {
            id: 'speed_gauge',
            type: 'gauge',
            label: 'Velocidade',
            value: 60,
            min: 0,
            max: 300,
            sizeScale: 100,
            color: '#8B0000',
            icon: 'speedometer',
            pos: { x: 50, y: 30 }
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
            sizeScale: 100,
            icon: 'power',
            pos: { x: 80, y: 30 }
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
        
        const scale = (e.sizeScale || 100) / 100;
        const baseSizePx = 120;
        const sizePx = baseSizePx * scale;
        wrapper.style.width = sizePx + 'px';
        wrapper.style.height = sizePx + 'px';

        const size = 120;
        const radius = (size / 2) - 15;
        const center = size / 2;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
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

        // Ícone se configurado
        if (e.icon) {
            const iconDiv = document.createElement('div');
            iconDiv.style.fontSize = '30%';
            iconDiv.style.position = 'absolute';
            iconDiv.style.top = '50%';
            iconDiv.style.left = '50%';
            iconDiv.style.transform = 'translate(-50%, -50%)';
            iconDiv.style.color = (e.color || 'var(--primary-red)');
            iconDiv.style.opacity = '0.3';
            iconDiv.style.pointerEvents = 'none';
            iconDiv.style.width = '30%';
            iconDiv.style.height = '30%';
            iconDiv.style.display = 'flex';
            iconDiv.style.alignItems = 'center';
            iconDiv.style.justifyContent = 'center';
            const icon = document.createElement('i');
            icon.className = `bi bi-${e.icon}`;
            icon.style.fontSize = 'inherit';
            iconDiv.appendChild(icon);
            svg.appendChild(iconDiv);
        }

        const textBox = document.createElement('div');
        textBox.style.position = 'absolute';
        textBox.style.bottom = '8px';
        textBox.style.width = '100%';
        textBox.style.textAlign = 'center';
        textBox.style.pointerEvents = 'none';
        textBox.style.fontSize = '60%';

        const label = document.createElement('div');
        label.className = 'marker-label';
        label.style.fontSize = 'inherit';
        label.textContent = e.label || e.id;

        const value = document.createElement('div');
        value.className = 'marker-value';
        value.style.fontSize = '120%';
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
        
        const scale = (e.sizeScale || 100) / 100;
        const widthPx = 120 * scale;
        const heightPx = 60 * scale;
        wrapper.style.width = widthPx + 'px';
        wrapper.style.height = heightPx + 'px';

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
        bar.style.width = '100%';
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
        
        const scale = (e.sizeScale || 100) / 100;
        const baseSizePx = 50;
        const sizePx = baseSizePx * scale;
        wrapper.style.width = sizePx + 'px';
        wrapper.style.height = (sizePx + 30) + 'px';

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
        led.style.width = '100%';
        led.style.aspectRatio = '1/1';
        led.style.borderRadius = '50%';
        led.style.background = e.value >= e.threshold ? (e.color || '#00FF00') : (e.colorOff || '#333');
        led.style.border = '2px solid #555';
        led.style.boxShadow = e.value >= e.threshold ? `0 0 10px ${e.color || '#00FF00'}` : 'none';
        led.style.display = 'flex';
        led.style.alignItems = 'center';
        led.style.justifyContent = 'center';
        led.style.position = 'relative';

        // Ícone se configurado
        if (e.icon) {
            const icon = document.createElement('i');
            icon.className = `bi bi-${e.icon}`;
            icon.style.fontSize = '40%';
            icon.style.color = 'white';
            icon.style.pointerEvents = 'none';
            led.appendChild(icon);
        }

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

    function createBarMarkerElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        
        const scale = (e.sizeScale || 100) / 100;
        const widthPx = 150 * scale;
        const heightPx = 35 * scale;
        wrapper.style.width = widthPx + 'px';
        wrapper.style.height = heightPx + 'px';

        const cont = document.createElement('div');
        cont.style.display = 'flex';
        cont.style.flexDirection = 'column';
        cont.style.gap = '8px';
        cont.style.padding = '8px';
        cont.style.width = '100%';
        cont.style.height = '100%';

        const label = document.createElement('div');
        label.style.fontSize = '12px';
        label.style.color = 'var(--text-light)';
        label.textContent = e.label || e.id;

        const bar = document.createElement('div');
        bar.style.width = '100%';
        bar.style.height = '16px';
        bar.style.background = '#333';
        bar.style.border = '1px solid var(--border-color)';
        bar.style.borderRadius = '8px';
        bar.style.overflow = 'hidden';
        bar.style.position = 'relative';

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
        value.textContent = e.value.toFixed(1) + ' / ' + e.max.toFixed(1);

        cont.appendChild(label);
        cont.appendChild(bar);
        cont.appendChild(value);
        wrapper.appendChild(cont);

        wrapper._fillEl = fill;
        wrapper._markerEl = bar;
        wrapper._valueEl = value;
        wrapper._type = 'bar-marker';
        return wrapper;
    }

    function createTextElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        wrapper.style.width = 'auto';
        wrapper.style.height = 'auto';

        const textDiv = document.createElement('div');
        textDiv.style.color = e.color || 'var(--text-light)';
        textDiv.style.fontSize = (e.fontSize || 14) + 'px';
        textDiv.style.fontWeight = e.fontWeight || '400';
        textDiv.style.textAlign = 'center';
        textDiv.style.whiteSpace = 'nowrap';
        textDiv.textContent = e.text || e.label || '';

        wrapper.appendChild(textDiv);
        wrapper._textEl = textDiv;
        wrapper._type = 'text';
        return wrapper;
    }

    function createConditionalTextElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        wrapper.style.width = 'auto';
        wrapper.style.height = 'auto';

        const textDiv = document.createElement('div');
        textDiv.style.fontSize = (e.fontSize || 16) + 'px';
        textDiv.style.fontWeight = e.fontWeight || '600';
        textDiv.style.textAlign = 'center';
        textDiv.style.padding = '8px 12px';
        textDiv.style.borderRadius = '6px';
        textDiv.style.whiteSpace = 'nowrap';

        let activeCondition = e.conditions && e.conditions[0];
        if (e.conditions) {
            for (let cond of e.conditions) {
                if (eval(`${e.value} ${cond.operator} ${cond.threshold}`)) {
                    activeCondition = cond;
                    break;
                }
            }
        }

        textDiv.textContent = activeCondition ? activeCondition.text : e.label || '';
        textDiv.style.color = activeCondition ? (activeCondition.color || 'white') : 'var(--text-light)';
        textDiv.style.background = activeCondition ? (activeCondition.background || 'rgba(255,0,0,0.3)') : 'rgba(0,0,0,0.2)';

        wrapper.appendChild(textDiv);
        wrapper._textEl = textDiv;
        wrapper._type = 'conditional-text';
        return wrapper;
    }

    function createElement(e) {
        if (e.type === 'bar') return createBarElement(e);
        if (e.type === 'led') return createLEDElement(e);
        if (e.type === 'text') return createTextElement(e);
        if (e.type === 'bar-marker') return createBarMarkerElement(e);
        if (e.type === 'conditional-text') return createConditionalTextElement(e);
        return createGaugeElement(e);
    }

    function updateElement(el, newValue) {
        const e = elements.find(elem => elem.id === el.dataset.id);
        if (!e) return;
        e.value = newValue;

        if (el._type === 'gauge' && el._needle) {
            const size = 120;
            const radius = (size / 2) - 15;
            const center = size / 2;
            const needleRotation = ((newValue - e.min) / (e.max - e.min)) * 270 - 135;
            el._needle.setAttribute('transform', `rotate(${needleRotation} ${center} ${center})`);
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1);
        } else if (el._type === 'bar' && el._fillEl) {
            const pct = ((newValue - e.min) / (e.max - e.min)) * 100;
            el._fillEl.style.width = pct + '%';
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1);
        } else if (el._type === 'bar-marker' && el._fillEl) {
            const pct = ((newValue - e.min) / (e.max - e.min)) * 100;
            el._fillEl.style.width = pct + '%';
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1) + ' / ' + e.max.toFixed(1);
        } else if (el._type === 'led' && el._ledEl) {
            const isActive = newValue >= e.threshold;
            el._ledEl.style.background = isActive ? (e.color || '#00FF00') : (e.colorOff || '#333');
            el._ledEl.style.boxShadow = isActive ? `0 0 10px ${e.color || '#00FF00'}` : 'none';
        } else if (el._type === 'text' && el._textEl) {
            el._textEl.textContent = e.text || e.label || '';
        } else if (el._type === 'conditional-text' && el._textEl) {
            let activeCondition = e.conditions && e.conditions[0];
            if (e.conditions) {
                for (let cond of e.conditions) {
                    if (eval(`${newValue} ${cond.operator} ${cond.threshold}`)) {
                        activeCondition = cond;
                        break;
                    }
                }
            }
            el._textEl.textContent = activeCondition ? activeCondition.text : e.label || '';
            el._textEl.style.color = activeCondition ? (activeCondition.color || 'white') : 'var(--text-light)';
            el._textEl.style.background = activeCondition ? (activeCondition.background || 'rgba(255,0,0,0.3)') : 'rgba(0,0,0,0.2)';
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
        leftPanel.style.background = 'rgba(255,255,255,0.02)';
        leftPanel.style.borderRight = '1px solid var(--border-color)';
        leftPanel.style.display = 'flex';
        leftPanel.style.flexDirection = 'column';
        leftPanel.style.height = '100%';

        const leftContent = document.createElement('div');
        leftContent.style.flex = '1';
        leftContent.style.overflowY = 'auto';
        leftContent.style.padding = '20px';

        const leftFooter = document.createElement('div');
        leftFooter.style.padding = '15px 20px';
        leftFooter.style.borderTop = '1px solid var(--border-color)';
        leftFooter.style.background = 'rgba(0,0,0,0.2)';

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

            // Mini preview com tamanho proporcional
            if (e.type === 'gauge') {
                const scale = (e.sizeScale || 100) / 100;
                const sizePx = 120 * scale;
                preview.style.width = sizePx + 'px';
                preview.style.height = sizePx + 'px';
                preview.style.background = e.color || 'var(--primary-red)';
                preview.style.borderRadius = '50%';
                preview.style.border = '2px solid white';
            } else if (e.type === 'bar') {
                const scale = (e.sizeScale || 100) / 100;
                const widthPx = 120 * scale;
                const heightPx = 30 * scale;
                preview.style.width = widthPx + 'px';
                preview.style.height = heightPx + 'px';
                preview.style.background = e.color || 'var(--primary-red)';
                preview.style.borderRadius = '12px';
                preview.style.border = '2px solid white';
            } else if (e.type === 'bar-marker') {
                const scale = (e.sizeScale || 100) / 100;
                const widthPx = 150 * scale;
                const heightPx = 35 * scale;
                preview.style.width = widthPx + 'px';
                preview.style.height = heightPx + 'px';
                preview.style.background = e.color || 'var(--primary-red)';
                preview.style.borderRadius = '8px';
                preview.style.border = '2px solid white';
            } else if (e.type === 'led') {
                const scale = (e.sizeScale || 100) / 100;
                const sizePx = 50 * scale;
                preview.style.width = sizePx + 'px';
                preview.style.height = sizePx + 'px';
                preview.style.background = e.color || '#00FF00';
                preview.style.borderRadius = '50%';
                preview.style.border = '2px solid white';
                preview.style.boxShadow = `0 0 15px ${e.color || '#00FF00'}`;
            } else if (e.type === 'text') {
                preview.style.width = 'auto';
                preview.style.height = 'auto';
                preview.style.padding = '6px 12px';
                preview.style.background = 'rgba(255,255,255,0.1)';
                preview.style.borderRadius = '4px';
                preview.style.border = '1px solid white';
                preview.style.color = e.color || 'var(--text-light)';
                preview.style.fontSize = ((e.fontSize || 14) * 0.8) + 'px';
                preview.textContent = (e.text || 'Texto').substring(0, 15);
            } else if (e.type === 'conditional-text') {
                preview.style.width = 'auto';
                preview.style.height = 'auto';
                preview.style.padding = '8px 12px';
                preview.style.background = 'rgba(0,200,0,0.2)';
                preview.style.borderRadius = '4px';
                preview.style.border = '2px solid #00FF00';
                preview.style.color = '#00FF00';
                preview.style.fontSize = ((e.fontSize || 16) * 0.8) + 'px';
                preview.style.fontWeight = '600';
                preview.textContent = 'Condicional';
            }

            // Label
            const label = document.createElement('div');
            label.style.position = 'absolute';
            label.style.bottom = '-22px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.color = 'var(--text-light)';
            label.style.fontSize = '11px';
            label.style.fontWeight = '600';
            label.style.whiteSpace = 'nowrap';
            label.textContent = e.label || e.id;
            preview.appendChild(label);

            // Drag logic
            let dragging = false;
            let start = { x: 0, y: 0 };
            let bounds = null;
            let previewClone = null;

            function onPointerDown(ev) {
                ev.preventDefault();
                dragging = true;
                preview.setPointerCapture && preview.setPointerCapture(ev.pointerId);
                start.x = ev.clientX;
                start.y = ev.clientY;
                bounds = canvas.getBoundingClientRect();
                preview.style.cursor = 'grabbing';
                preview.style.zIndex = '1000';

                // Criar simulação do elemento
                previewClone = createElement(e);
                previewClone.style.position = 'absolute';
                previewClone.style.left = '50%';
                previewClone.style.top = '50%';
                previewClone.style.transform = 'translate(-50%, -50%)';
                previewClone.style.pointerEvents = 'none';
                previewClone.style.opacity = '0.7';
                canvas.appendChild(previewClone);
            }

            function onPointerMove(ev) {
                if (!dragging || !previewClone) return;
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
                previewClone.style.left = px + '%';
                previewClone.style.top = py + '%';

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

                if (previewClone) {
                    previewClone.remove();
                    previewClone = null;
                }
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
            leftContent.innerHTML = '';

            const title = document.createElement('h3');
            title.style.color = 'var(--light-red)';
            title.style.marginBottom = '15px';
            title.textContent = e.label || e.id;
            leftContent.appendChild(title);

            const infoBox = document.createElement('div');
            infoBox.style.padding = '10px';
            infoBox.style.background = 'rgba(0,200,0,0.1)';
            infoBox.style.borderRadius = '4px';
            infoBox.style.marginBottom = '15px';
            infoBox.style.fontSize = '12px';
            infoBox.style.color = 'var(--text-light)';
            infoBox.style.border = '1px solid rgba(0,200,0,0.3)';
            infoBox.textContent = `Tipo: ${e.type} | Posição: (${Math.round(e.pos.x)}%, ${Math.round(e.pos.y)}%)`;
            leftContent.appendChild(infoBox);

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
            leftContent.appendChild(removeBtn);

            const commonFields = [
                { label: 'Label', key: 'label', type: 'text' },
                { label: 'Tipo', key: 'type', type: 'select', options: ['gauge', 'bar', 'bar-marker', 'led', 'text', 'conditional-text', 'button'] },
                { label: 'Cor', key: 'color', type: 'color' },
                { label: 'Tamanho (%)', key: 'sizeScale', type: 'range', min: '25', max: '444', step: '5' },
                { label: 'Ícone (Bootstrap)', key: 'icon', type: 'text', placeholder: 'Ex: speedometer, power, fuel-pump' }
            ];

            const gaugeBarFields = [
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Valor', key: 'value', type: 'number' }
            ];

            const barMarkerFields = [
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Valor', key: 'value', type: 'number' },
                { label: 'Valor Marcador', key: 'markerValue', type: 'number' },
                { label: 'Cor Marcador', key: 'markerColor', type: 'color' }
            ];

            const ledFields = [
                { label: 'Valor', key: 'value', type: 'number' },
                { label: 'Limiar', key: 'threshold', type: 'number' },
                { label: 'Cor Off', key: 'colorOff', type: 'color' },
                { label: 'Piscar', key: 'blink', type: 'checkbox' },
                { label: 'Taxa Pisca (ms)', key: 'blinkRate', type: 'number' }
            ];

            const textFields = [
                { label: 'Texto', key: 'text', type: 'text' },
                { label: 'Tamanho Fonte (px)', key: 'fontSize', type: 'number' },
                { label: 'Peso (400, 600, 700)', key: 'fontWeight', type: 'number' }
            ];

            const conditionalTextFields = [
                { label: 'Valor', key: 'value', type: 'number' },
                { label: 'Tamanho Fonte (px)', key: 'fontSize', type: 'number' },
                { label: 'Peso (400, 600, 700)', key: 'fontWeight', type: 'number' }
            ];

            const buttonFields = [
                { label: 'Modo', key: 'mode', type: 'select', options: ['press_release', 'toggle', 'value'] },
                { label: 'Comando ao Apertar', key: 'commandPress', type: 'text', placeholder: 'Ex: test_press' },
                { label: 'Comando ao Soltar', key: 'commandRelease', type: 'text', placeholder: 'Ex: test_release' },
                { label: 'Valor ao Apertar', key: 'valuePressCommand', type: 'text', placeholder: 'Comando+valor, ex: motor_cmd/1000' },
                { label: 'Valor ao Soltar', key: 'valueReleaseCommand', type: 'text', placeholder: 'Comando+valor, ex: motor_cmd/0' }
            ];

            let fieldsToShow = commonFields;
            
            if (e.type === 'gauge' || e.type === 'bar') {
                fieldsToShow = [...fieldsToShow, ...gaugeBarFields];
            } else if (e.type === 'bar-marker') {
                fieldsToShow = [...fieldsToShow, ...barMarkerFields];
            } else if (e.type === 'led') {
                fieldsToShow = [...fieldsToShow, ...ledFields];
            } else if (e.type === 'text') {
                fieldsToShow = [...fieldsToShow, ...textFields];
            } else if (e.type === 'conditional-text') {
                fieldsToShow = [...fieldsToShow, ...conditionalTextFields];
            }

            fieldsToShow.forEach(f => {
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
                } else if (f.type === 'range') {
                    inp = document.createElement('input');
                    inp.type = 'range';
                    inp.min = f.min || '0';
                    inp.max = f.max || '100';
                    inp.step = f.step || '1';
                    inp.value = e[f.key] || '100';
                    inp.style.width = '100%';
                    inp.style.cursor = 'pointer';

                    const valueDisplay = document.createElement('div');
                    valueDisplay.style.fontSize = '12px';
                    valueDisplay.style.color = 'var(--light-red)';
                    valueDisplay.style.marginTop = '4px';
                    valueDisplay.style.fontWeight = '600';
                    valueDisplay.textContent = inp.value + '%';

                    inp.addEventListener('input', () => {
                        valueDisplay.textContent = inp.value + '%';
                    });

                    row.appendChild(lbl);
                    row.appendChild(inp);
                    row.appendChild(valueDisplay);
                    leftContent.appendChild(row);

                    inp.addEventListener('change', () => {
                        elements[idx][f.key] = parseFloat(inp.value);
                    });
                    return;
                } else {
                    inp = document.createElement('input');
                    inp.type = f.type;
                    inp.style.padding = '6px 8px';
                    inp.style.background = 'var(--bg-dark)';
                    inp.style.border = '1px solid var(--border-color)';
                    inp.style.color = 'var(--text-light)';
                    inp.style.borderRadius = '4px';
                    inp.style.fontSize = '13px';
                    if (f.placeholder) inp.placeholder = f.placeholder;
                    if (f.step) inp.step = f.step;
                    inp.value = f.type === 'color' ? (e[f.key] || '#8B0000') : (e[f.key] || '');
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
                });

                row.appendChild(lbl);
                row.appendChild(inp);
                leftContent.appendChild(row);

                // Se for campo de ícone, adicionar seletor visual
                if (f.key === 'icon') {
                    const iconPickerContainer = document.createElement('div');
                    iconPickerContainer.style.marginBottom = '12px';
                    iconPickerContainer.style.paddingTop = '10px';
                    iconPickerContainer.style.borderTop = '1px solid var(--border-color)';

                    const pickerLabel = document.createElement('label');
                    pickerLabel.style.color = 'var(--text-light)';
                    pickerLabel.style.fontSize = '12px';
                    pickerLabel.style.fontWeight = '600';
                    pickerLabel.textContent = 'Ícones populares:';
                    iconPickerContainer.appendChild(pickerLabel);

                    const commonIcons = [
                        'speedometer', 'speedometer2', 'fuel-pump', 'power', 'thermometer', 
                        'droplet', 'wind', 'lightning', 'gear', 'wrench', 'tool', 'clock',
                        'battery-full', 'exclamation-triangle', 'check-circle', 'x-circle',
                        'arrow-up', 'arrow-down', 'circle-fill', 'square-fill', 'lambda',
                        'gauge', 'activity', 'play-fill', 'stop-fill', 'pause-fill',
                        'filter', 'sliders', 'crosshair', 'pin', 'target'
                    ];

                    const iconGrid = document.createElement('div');
                    iconGrid.style.display = 'grid';
                    iconGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
                    iconGrid.style.gap = '6px';
                    iconGrid.style.marginTop = '8px';

                    commonIcons.forEach(iconName => {
                        const iconBtn = document.createElement('button');
                        iconBtn.style.padding = '8px';
                        iconBtn.style.background = e.icon === iconName ? 'var(--primary-red)' : 'rgba(255,255,255,0.05)';
                        iconBtn.style.border = '1px solid var(--border-color)';
                        iconBtn.style.borderRadius = '4px';
                        iconBtn.style.cursor = 'pointer';
                        iconBtn.style.fontSize = '16px';
                        iconBtn.style.color = 'var(--text-light)';
                        iconBtn.style.transition = 'all 0.2s ease';
                        iconBtn.title = iconName;

                        const icon = document.createElement('i');
                        icon.className = `bi bi-${iconName}`;
                        iconBtn.appendChild(icon);

                        iconBtn.addEventListener('mouseover', () => {
                            iconBtn.style.background = 'rgba(200,50,50,0.3)';
                        });

                        iconBtn.addEventListener('mouseout', () => {
                            iconBtn.style.background = e.icon === iconName ? 'var(--primary-red)' : 'rgba(255,255,255,0.05)';
                        });

                        iconBtn.addEventListener('click', () => {
                            elements[idx].icon = iconName;
                            inp.value = iconName;
                            showEditPanel(idx);
                        });

                        iconGrid.appendChild(iconBtn);
                    });

                    iconPickerContainer.appendChild(iconGrid);
                    leftContent.appendChild(iconPickerContainer);
                }
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

        addBtn.addEventListener('click', () => {
            const typeSelect = document.createElement('select');
            typeSelect.style.padding = '8px';
            typeSelect.style.marginBottom = '10px';
            typeSelect.style.width = '100%';
            typeSelect.style.borderRadius = '4px';
            typeSelect.style.border = '1px solid var(--border-color)';
            typeSelect.style.background = 'var(--bg-dark)';
            typeSelect.style.color = 'var(--text-light)';
            
            ['gauge', 'bar', 'bar-marker', 'led', 'text', 'conditional-text'].forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                typeSelect.appendChild(opt);
            });

            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Criar';
            confirmBtn.style.width = '48%';
            confirmBtn.style.padding = '8px';
            confirmBtn.style.background = 'var(--primary-red)';
            confirmBtn.style.border = 'none';
            confirmBtn.style.color = 'white';
            confirmBtn.style.borderRadius = '4px';
            confirmBtn.style.cursor = 'pointer';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancelar';
            cancelBtn.style.width = '48%';
            cancelBtn.style.padding = '8px';
            cancelBtn.style.background = 'var(--border-color)';
            cancelBtn.style.border = 'none';
            cancelBtn.style.color = 'var(--text-light)';
            cancelBtn.style.borderRadius = '4px';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.style.marginLeft = '4%';

            confirmBtn.addEventListener('click', () => {
                const type = typeSelect.value;
                const baseConfig = {
                    id: 'elem_' + Date.now(),
                    type: type,
                    label: 'Novo',
                    pos: { x: 50, y: 50 }
                };

                let newElem = baseConfig;
                if (type === 'gauge' || type === 'bar') {
                    newElem = { ...baseConfig, value: 0, min: 0, max: 100, sizeScale: 100, color: '#8B0000' };
                } else if (type === 'bar-marker') {
                    newElem = { ...baseConfig, value: 50, min: 0, max: 100, sizeScale: 100, color: '#8B0000', markerValue: 75, markerColor: '#FFD700' };
                } else if (type === 'led') {
                    newElem = { ...baseConfig, value: 0, threshold: 500, color: '#00FF00', colorOff: '#333333', blink: false, blinkRate: 500, sizeScale: 100 };
                } else if (type === 'text') {
                    newElem = { ...baseConfig, text: 'Novo Texto', fontSize: 14, fontWeight: '400', color: 'var(--text-light)' };
                } else if (type === 'conditional-text') {
                    newElem = { ...baseConfig, value: 0, fontSize: 16, fontWeight: '600', conditions: [] };
                }

                elements.push(newElem);
                renderEditMode();
            });

            cancelBtn.addEventListener('click', () => {
                renderEditMode();
            });

            const tmpPanel = document.createElement('div');
            tmpPanel.style.padding = '15px';
            tmpPanel.style.background = 'rgba(255,0,0,0.1)';
            tmpPanel.style.borderRadius = '6px';
            tmpPanel.style.marginBottom = '15px';

            const title = document.createElement('div');
            title.textContent = 'Selecione o tipo de elemento:';
            title.style.marginBottom = '10px';
            title.style.color = 'var(--light-red)';

            tmpPanel.appendChild(title);
            tmpPanel.appendChild(typeSelect);
            tmpPanel.appendChild(confirmBtn);
            tmpPanel.appendChild(cancelBtn);

            leftContent.innerHTML = '';
            leftContent.appendChild(tmpPanel);
        });

        leftPanel.appendChild(leftContent);
        leftFooter.appendChild(addBtn);
        leftPanel.appendChild(leftFooter);

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
