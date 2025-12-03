/* dashboard.js
   Dashboard com elementos configuráveis: Gauge, Bar, LED, Texto, Condicional
   - Tamanho em porcentagem (%)
   - Single click: view mode (visualização apenas)
   - Double click: edit mode com drag-to-position
   - Simulação de tamanho ao arrastar
*/
(function () {
    const STORAGE_KEY = 'dsw_dashboard_elements_v1';
    const viewContainer = document.getElementById('dashboardContent');
    const viewModal = document.getElementById('dashboardModal');
    let container = viewContainer;
    let modal = viewModal;
    const btnOpen = document.getElementById('dashboardBtn');
    const btnClose = document.getElementById('dashboardCloseBtn');
    let editModal = null;
    let editContainer = null;

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
            valueDivisor: 100,
            iconRotation: 0,
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
            iconRotation: 0,
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
    let dashboardButtonsConfig = [];

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

    function loadDashboardButtonsConfig() {
        // Carrega configuração de botões do su.json via ecu-manager
        if (window.ecuManager && window.ecuManager.config && window.ecuManager.config.dashboardButtons) {
            dashboardButtonsConfig = window.ecuManager.config.dashboardButtons;
            console.log('Dashboard buttons config loaded:', dashboardButtonsConfig);
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

    function clampPercent(val) {
        const n = parseFloat(val);
        if (isNaN(n)) return 50;
        return Math.min(98, Math.max(2, n));
    }

    // Share code helpers: encode current elements to single-line string and decode back
    const SHARE_PREFIX = 'DSWCFG1:';

    function generateShareCode() {
        try {
            const json = JSON.stringify(elements);
            const base = btoa(encodeURIComponent(json));
            return SHARE_PREFIX + base;
        } catch (err) {
            console.error('Erro ao gerar código de compartilhamento', err);
            return '';
        }
    }

    function importShareCode(code) {
        try {
            if (!code || typeof code !== 'string') throw new Error('Código inválido');
            // accept prefixed code or raw base64
            let payload = code.trim();
            if (payload.startsWith(SHARE_PREFIX)) payload = payload.slice(SHARE_PREFIX.length);

            // Try decode
            let json = null;
            try {
                json = decodeURIComponent(atob(payload));
            } catch (err) {
                // fallback: maybe it was plain ascii JSON
                try {
                    json = atob(payload);
                } catch (err2) {
                    // last resort: assume payload is raw JSON
                    json = payload;
                }
            }

            const parsed = JSON.parse(json);
            if (!Array.isArray(parsed)) throw new Error('Formato inválido');
            elements = parsed;
            saveElements(elements);
            return { ok: true };
        } catch (err) {
            console.error('Erro ao importar código:', err);
            return { ok: false, error: err.message || String(err) };
        }
    }
    // Aguardar carregamento da configuração do ecu-manager
    setTimeout(() => {
        loadDashboardButtonsConfig();
    }, 500);

    function createGaugeElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker gauge-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        
        const scale = (e.sizeScale || 100) / 100;
        // Use percentage sizing so elements scale with dashboard size
        const basePercent = 12; // base gauge size as % of dashboard width
        const sizePercent = basePercent * scale;
        wrapper.style.width = sizePercent + '%';
        wrapper.style.height = sizePercent + '%';
        
        // Aplicar rotação ao gauge inteiro
        if (e.gaugeRotation && e.gaugeRotation !== 0) {
            wrapper.style.transform = `translate(-50%, -50%) rotate(${e.gaugeRotation}deg)`;
        }

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

        // Background gradient
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
        gradient.setAttribute('id', `gauge-grad-${e.id}`);
        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', 'rgba(40, 40, 40, 0.9)');
        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', 'rgba(15, 15, 15, 0.95)');
        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.appendChild(defs);

        // Outer circle with shadow effect
        const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outerCircle.setAttribute('cx', center);
        outerCircle.setAttribute('cy', center);
        outerCircle.setAttribute('r', radius + 2);
        outerCircle.setAttribute('fill', 'none');
        outerCircle.setAttribute('stroke', 'rgba(139, 0, 0, 0.2)');
        outerCircle.setAttribute('stroke-width', '1.5');
        svg.appendChild(outerCircle);

        // Main gauge circle
        const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bgCircle.setAttribute('cx', center);
        bgCircle.setAttribute('cy', center);
        bgCircle.setAttribute('r', radius);
        bgCircle.setAttribute('fill', `url(#gauge-grad-${e.id})`);
        bgCircle.setAttribute('stroke', '#8B0000');
        bgCircle.setAttribute('stroke-width', '1.5');
        svg.appendChild(bgCircle);

        // Highlight circle for 3D effect
        const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        highlight.setAttribute('cx', center);
        highlight.setAttribute('cy', center - 2);
        highlight.setAttribute('r', radius - 2);
        highlight.setAttribute('fill', 'none');
        highlight.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
        highlight.setAttribute('stroke-width', '0.5');
        svg.appendChild(highlight);

        // Zona de perigo/atenção se configurada
        if (e.dangerZone) {
            const dangerStart = ((e.dangerZone.start - e.min) / (e.max - e.min)) * 270 - 135;
            const dangerEnd = ((e.dangerZone.end - e.min) / (e.max - e.min)) * 270 - 135;
            const dangerRadius = radius - 3;
            const dangerStartX = center + dangerRadius * Math.cos(dangerStart * Math.PI / 180);
            const dangerStartY = center + dangerRadius * Math.sin(dangerStart * Math.PI / 180);
            const dangerEndX = center + dangerRadius * Math.cos(dangerEnd * Math.PI / 180);
            const dangerEndY = center + dangerRadius * Math.sin(dangerEnd * Math.PI / 180);
            const dangerLargeArc = Math.abs(dangerEnd - dangerStart) > 180 ? 1 : 0;
            
            const dangerZonePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            dangerZonePath.setAttribute('d', `M ${dangerStartX} ${dangerStartY} A ${dangerRadius} ${dangerRadius} 0 ${dangerLargeArc} 1 ${dangerEndX} ${dangerEndY}`);
            dangerZonePath.setAttribute('stroke', e.dangerZone.color || '#FF4444');
            dangerZonePath.setAttribute('stroke-width', '4');
            dangerZonePath.setAttribute('fill', 'none');
            dangerZonePath.setAttribute('opacity', '0.7');
            dangerZonePath.style.filter = `drop-shadow(0 0 4px ${e.dangerZone.color || 'rgba(255, 68, 68, 0.8)'})`;
            svg.appendChild(dangerZonePath);
        }

        for (let i = 0; i <= 10; i++) {
            const angle = (i / 10) * 270 - 135;
            const rad = angle * (Math.PI / 180);
            
            // Main tick mark
            const x1 = center + (radius - 8) * Math.cos(rad);
            const y1 = center + (radius - 8) * Math.sin(rad);
            const x2 = center + radius * Math.cos(rad);
            const y2 = center + radius * Math.sin(rad);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', i % 2 === 0 ? '#aaa' : '#777');
            line.setAttribute('stroke-width', i % 2 === 0 ? '1.5' : '0.8');
            line.setAttribute('stroke-linecap', 'round');
            svg.appendChild(line);

            // Minor tick marks between main marks
            if (i < 10) {
                const midAngle = angle + 13.5;
                const midRad = midAngle * (Math.PI / 180);
                const mx1 = center + (radius - 4) * Math.cos(midRad);
                const my1 = center + (radius - 4) * Math.sin(midRad);
                const mx2 = center + radius * Math.cos(midRad);
                const my2 = center + radius * Math.sin(midRad);

                const miniLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                miniLine.setAttribute('x1', mx1);
                miniLine.setAttribute('y1', my1);
                miniLine.setAttribute('x2', mx2);
                miniLine.setAttribute('y2', my2);
                miniLine.setAttribute('stroke', '#555');
                miniLine.setAttribute('stroke-width', '0.5');
                svg.appendChild(miniLine);
            }

            // Value labels com divisor configurável
            const divisor = e.valueDivisor || 1;
            let labelVal = e.min + (e.max - e.min) * (i / 10);
            labelVal = labelVal / divisor;
            
            const labelAngle = angle + 6;
            const labelRad = labelAngle * (Math.PI / 180);
            const lx = center + (radius - 22) * Math.cos(labelRad);
            const ly = center + (radius - 22) * Math.sin(labelRad);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', lx);
            text.setAttribute('y', ly);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', '#aaa');
            text.setAttribute('font-size', size > 120 ? '10' : '8');
            text.setAttribute('font-weight', '500');
            text.textContent = labelVal.toFixed(0);
            svg.appendChild(text);
        }

        const needle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        needle.setAttribute('id', `needle_${e.id}`);
        const needleRotation = ((e.value - e.min) / (e.max - e.min)) * 270 - 135;
        needle.setAttribute('transform', `rotate(${needleRotation} ${center} ${center})`);
        needle.style.transition = 'transform 0.3s ease';

        // Rastro (trail) da agulha - arco suave
        const trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const startAngle = -135;
        const endAngle = needleRotation;
        const trailRadius = radius - 5;
        const trailStartX = center + trailRadius * Math.cos(startAngle * Math.PI / 180);
        const trailStartY = center + trailRadius * Math.sin(startAngle * Math.PI / 180);
        const trailEndX = center + trailRadius * Math.cos(endAngle * Math.PI / 180);
        const trailEndY = center + trailRadius * Math.sin(endAngle * Math.PI / 180);
        const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
        trail.setAttribute('d', `M ${trailStartX} ${trailStartY} A ${trailRadius} ${trailRadius} 0 ${largeArc} 1 ${trailEndX} ${trailEndY}`);
        trail.setAttribute('stroke', e.color || 'var(--primary-red)');
        trail.setAttribute('stroke-width', '2');
        trail.setAttribute('fill', 'none');
        trail.setAttribute('opacity', '0.3');
        trail.style.transition = 'opacity 0.2s ease';
        svg.appendChild(trail);
        wrapper._trail = trail;

        // Needle body - polygon para ponta fina com gradiente
        const needleGrad = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', `needle-grad-${e.id}`);
        grad.setAttribute('x1', '0%');
        grad.setAttribute('y1', '0%');
        grad.setAttribute('x2', '0%');
        grad.setAttribute('y2', '100%');
        const gradStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        gradStop1.setAttribute('offset', '0%');
        gradStop1.setAttribute('stop-color', e.color || 'var(--primary-red)');
        gradStop1.setAttribute('stop-opacity', '1');
        const gradStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        gradStop2.setAttribute('offset', '100%');
        gradStop2.setAttribute('stop-color', 'rgba(139, 0, 0, 0.7)');
        gradStop2.setAttribute('stop-opacity', '1');
        grad.appendChild(gradStop1);
        grad.appendChild(gradStop2);
        needleGrad.appendChild(grad);
        needle.appendChild(needleGrad);

        // Needle polygon - ponta fina
        const needlePolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const needleLength = radius - 10;
        needlePolygon.setAttribute('points', `${center},${center - needleLength} ${center - 2},${center + 8} ${center + 2},${center + 8}`);
        needlePolygon.setAttribute('fill', `url(#needle-grad-${e.id})`);
        needlePolygon.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
        needlePolygon.setAttribute('stroke-width', '0.5');
        needlePolygon.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7))';
        needle.appendChild(needlePolygon);

        // Center dot with gradient effect
        const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerDot.setAttribute('cx', center);
        centerDot.setAttribute('cy', center);
        centerDot.setAttribute('r', '6');
        centerDot.setAttribute('fill', e.color || 'var(--primary-red)');
        centerDot.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
        centerDot.setAttribute('stroke-width', '1');
        centerDot.style.filter = 'drop-shadow(0 0 4px ' + (e.color || 'rgba(139, 0, 0, 0.8)') + ')';
        needle.appendChild(centerDot);
        svg.appendChild(needle);

        // Ícone se configurado - CENTRALIZADO NO MEIO DO GAUGE (CENTRO DO PONTEIRO)
        if (e.icon) {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'gauge-icon-center';
            iconDiv.style.position = 'absolute';
            iconDiv.style.left = '50%';
            iconDiv.style.top = '50%';
            iconDiv.style.transform = `translate(-50%, -50%)`;
            iconDiv.style.width = '32px';
            iconDiv.style.height = '32px';
            iconDiv.style.display = 'flex';
            iconDiv.style.alignItems = 'center';
            iconDiv.style.justifyContent = 'center';
            iconDiv.style.color = (e.color || 'var(--primary-red)');
            iconDiv.style.fontSize = '22px';
            iconDiv.style.pointerEvents = 'none';
            iconDiv.style.textShadow = '0 2px 6px rgba(0, 0, 0, 0.8)';
            iconDiv.style.zIndex = '20';
            
            const icon = document.createElement('i');
            icon.className = `bi bi-${e.icon}`;
            icon.style.fontSize = 'inherit';
            icon.style.filter = `drop-shadow(0 0 3px ${e.color || 'rgba(139, 0, 0, 0.8)'})`;
            iconDiv.appendChild(icon);
            wrapper.appendChild(iconDiv);
            wrapper._iconEl = iconDiv;
            wrapper._iconInner = icon;
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
        const divisor = e.valueDivisor || 1;
        value.textContent = (e.value / divisor).toFixed(1);

        textBox.appendChild(label);
        textBox.appendChild(value);
        svg.appendChild(textBox);

        wrapper.appendChild(svg);
        wrapper._needle = needle;
        wrapper._valueEl = value;
        wrapper._trail = trail;
        wrapper._type = 'gauge';
        wrapper._valueDivisor = e.valueDivisor || 1;
        wrapper._gaugeRotation = e.gaugeRotation || 0;

        // Label com nome e unidade DENTRO do gauge (posicionado no SVG)
        if (e.label || e.unit) {
            try {
                const labelSvgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelSvgText.setAttribute('x', center);
                labelSvgText.setAttribute('y', center + (radius * 0.45));
                labelSvgText.setAttribute('text-anchor', 'middle');
                labelSvgText.setAttribute('dominant-baseline', 'middle');
                labelSvgText.setAttribute('fill', '#999');
                labelSvgText.setAttribute('font-size', size > 120 ? '8' : '6');
                labelSvgText.setAttribute('font-weight', '500');
                labelSvgText.textContent = (e.label || '') + (e.unit ? ` (${e.unit})` : '');
                svg.appendChild(labelSvgText);
            } catch (err) {
                // fallback: append simple div inside wrapper
                const labelDiv = document.createElement('div');
                labelDiv.style.position = 'absolute';
                labelDiv.style.bottom = '-32px';
                labelDiv.style.left = '50%';
                labelDiv.style.transform = 'translateX(-50%)';
                labelDiv.style.whiteSpace = 'nowrap';
                labelDiv.style.fontSize = '12px';
                labelDiv.style.color = '#aaa';
                labelDiv.style.fontWeight = '500';
                labelDiv.style.textAlign = 'center';
                labelDiv.textContent = (e.label || '') + (e.unit ? ` (${e.unit})` : '');
                wrapper.appendChild(labelDiv);
                wrapper._labelDiv = labelDiv;
            }
        }

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
        wrapper.className = 'dashboard-marker led-marker';
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
        label.style.fontWeight = '600';
        label.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.8)';
        label.textContent = e.label || e.id;

        const led = document.createElement('div');
        led.style.width = '100%';
        led.style.aspectRatio = '1/1';
        led.style.borderRadius = '50%';
        const isOn = e.value >= e.threshold;
        const ledColor = isOn ? (e.color || '#00FF00') : (e.colorOff || '#333');
        led.style.background = `radial-gradient(circle at 30% 30%, ${isOn ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.05)'}, ${ledColor})`;
        led.style.border = isOn ? `2px solid ${e.color || '#00FF00'}` : '2px solid #555';
        led.style.boxShadow = isOn ? `0 0 15px ${e.color || '#00FF00'}, inset 0 0 10px rgba(255,255,255,0.1)` : 'inset 0 2px 4px rgba(0,0,0,0.4)';
        led.style.display = 'flex';
        led.style.alignItems = 'center';
        led.style.justifyContent = 'center';
        led.style.position = 'relative';
        led.style.transition = 'all 0.2s ease';

        // Ícone se configurado
        if (e.icon) {
            const icon = document.createElement('i');
            icon.className = `bi bi-${e.icon}`;
            icon.style.fontSize = '40%';
            icon.style.color = isOn ? 'white' : '#999';
            icon.style.pointerEvents = 'none';
            icon.style.textShadow = isOn ? `0 0 6px ${e.color || '#00FF00'}` : 'none';
            icon.style.transition = 'all 0.2s ease';
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
        wrapper.className = 'dashboard-marker bar-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        
        const scale = (e.sizeScale || 100) / 100;
        // Use percentage sizing so bar-marker scales with dashboard
        const baseWidthPercent = 18; // % of dashboard width
        const baseHeightPercent = 10; // % of dashboard width (approx)
        wrapper.style.width = (baseWidthPercent * scale) + '%';
        wrapper.style.height = (baseHeightPercent * scale) + '%';

        const cont = document.createElement('div');
        cont.style.display = 'flex';
        cont.style.flexDirection = 'column';
        cont.style.gap = '8px';
        cont.style.padding = '8px';
        cont.style.width = '100%';
        cont.style.height = '100%';

        const label = document.createElement('div');
        label.style.fontSize = '13px';
        label.style.color = 'var(--text-light)';
        label.style.fontWeight = '600';
        label.textContent = e.label || e.id;

        const barContainer = document.createElement('div');
        barContainer.style.display = 'flex';
        barContainer.style.alignItems = 'center';
        barContainer.style.gap = '8px';
        barContainer.style.width = '100%';
        barContainer.style.flex = '1';

        // Ícone na barra
        if (e.icon) {
            const iconEl = document.createElement('i');
            iconEl.className = `bi bi-${e.icon}`;
            iconEl.style.fontSize = '18px';
            iconEl.style.color = e.color || 'var(--primary-red)';
            iconEl.style.flexShrink = '0';
            iconEl.style.filter = `drop-shadow(0 0 3px ${e.color || 'rgba(139, 0, 0, 0.6)'})`;
            barContainer.appendChild(iconEl);
        }

        const bar = document.createElement('div');
        bar.style.flex = '1';
        bar.style.height = '20px';
        bar.style.background = 'linear-gradient(to bottom, rgba(50, 50, 50, 0.8), rgba(25, 25, 25, 0.9))';
        bar.style.border = '1px solid #8B0000';
        bar.style.borderRadius = '10px';
        bar.style.overflow = 'visible';
        bar.style.position = 'relative';
        bar.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.5)';

        const fill = document.createElement('div');
        fill.style.height = '100%';
        fill.style.background = `linear-gradient(to right, ${e.color || 'var(--primary-red)'}, rgba(165, 42, 42, 0.8))`;
        fill.style.width = ((e.value - e.min) / (e.max - e.min)) * 100 + '%';
        fill.style.transition = 'width 0.3s ease';
        fill.style.boxShadow = `inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 8px ${e.color || 'rgba(139, 0, 0, 0.6)'}`;
        bar.appendChild(fill);

        // Marcador visual (triângulo) mostrando markerValue
        if (e.markerValue !== undefined && e.markerValue !== null) {
            const markerPercent = Math.max(0, Math.min(100, ((e.markerValue - e.min) / (e.max - e.min)) * 100));
            const marker = document.createElement('div');
            marker.style.position = 'absolute';
            marker.style.top = '-8px';
            marker.style.left = markerPercent + '%';
            marker.style.transform = 'translateX(-50%)';
            marker.style.width = '0';
            marker.style.height = '0';
            marker.style.borderLeft = '6px solid transparent';
            marker.style.borderRight = '6px solid transparent';
            marker.style.borderTop = '10px solid ' + (e.markerColor || '#FFD700');
            marker.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8))';
            marker.style.zIndex = '10';
            marker.title = `Marcador: ${e.markerValue}`;
            bar.appendChild(marker);
            // store marker for updates
            bar._markerIndicator = marker;
        }

        barContainer.appendChild(bar);
        if (e.markerValue !== undefined && e.markerValue !== null) {
            const markerPercent = Math.max(0, Math.min(100, ((e.markerValue - e.min) / (e.max - e.min)) * 100));
            const marker = document.createElement('div');
            marker.style.position = 'absolute';
            marker.style.top = '-8px';
            marker.style.left = markerPercent + '%';
            marker.style.transform = 'translateX(-50%)';
            marker.style.width = '0';
            marker.style.height = '0';
            marker.style.borderLeft = '6px solid transparent';
            marker.style.borderRight = '6px solid transparent';
            marker.style.borderTop = '10px solid ' + (e.markerColor || '#FFD700');
            marker.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8))';
            marker.style.zIndex = '10';
            marker.title = `Marcador: ${e.markerValue}`;
            bar.appendChild(marker);
            bar._markerIndicator = marker;
        }

        barContainer.appendChild(bar);
        cont.appendChild(label);
        cont.appendChild(barContainer);

        const value = document.createElement('div');
        value.style.fontSize = '12px';
        value.style.color = 'var(--light-red)';
        value.style.textAlign = 'right';
        value.style.fontWeight = '600';
        const unitStr = e.unit ? ` ${e.unit}` : '';
        value.textContent = e.value.toFixed(1) + ' / ' + e.max.toFixed(1) + unitStr;
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

    function createButtonElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        wrapper.style.width = 'auto';
        wrapper.style.height = 'auto';

        // Procura configuração do botão no su.json
        const buttonConfig = dashboardButtonsConfig.find(btn => btn.id === e.buttonConfigId);
        if (!buttonConfig) {
            console.warn(`Button config not found for ${e.buttonConfigId}`);
            return wrapper;
        }

        // Função auxiliar para converter cor por nome
        function getColorValue(colorName) {
            const colorMap = {
                'red': '#8B0000',
                'green': '#22c55e',
                'blue': '#3b82f6',
                'yellow': '#eab308',
                'purple': '#a855f7',
                'orange': '#f97316'
            };
            return colorMap[colorName] || colorName;
        }

        // Usar nome/ícone customizado do elemento, ou padrão do config
        const buttonTitle = e.customLabel || buttonConfig.title;
        const buttonIcon = e.customIcon || buttonConfig.icon;
        let buttonColor = e.customColor || buttonConfig.color;
        let buttonColorOn = e.customColorOn || buttonConfig.colorOn;
        let buttonIconOn = e.customIconOn || buttonConfig.iconOn;

        const button = document.createElement('button');
        button.style.padding = '12px 24px';
        button.style.borderRadius = '8px';
        button.style.border = '2px solid';
        button.style.fontSize = '14px';
        button.style.fontWeight = '600';
        button.style.cursor = 'pointer';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.gap = '8px';
        button.style.transition = 'all 0.2s ease';
        button.style.color = 'white';
        button.style.background = getColorValue(buttonColor);
        button.style.borderColor = getColorValue(buttonColor);
        button.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`;

        // Para stateful_toggle ou value fixo, armazenar estado no wrapper
        if (buttonConfig.mode === 'stateful_toggle' || buttonConfig.mode === 'stateful_value') {
            wrapper._isActive = false;
            wrapper._currentIcon = buttonIcon;
            wrapper._currentColor = buttonColor;
        }

        button.addEventListener('pointerdown', async (ev) => {
            ev.preventDefault();
            button.style.transform = 'scale(0.95)';
            button.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';

            // Modo press_only: comando só ao apertar
            if (buttonConfig.mode === 'press_only' && buttonConfig.commandPress) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    window.ecuCommunication.sendCommand(buttonConfig.commandPress);
                }
            }

            // Modo value: enviar valores ao apertar
            if (buttonConfig.mode === 'value' && buttonConfig.valuePressCommand) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    window.ecuCommunication.sendCommand(buttonConfig.valuePressCommand);
                }
            }

            // Modo stateful_value: um comando que envia valores diferentes (apertar vs soltar)
            if (buttonConfig.mode === 'stateful_value' && buttonConfig.command && buttonConfig.valuePress !== undefined) {
                wrapper._isActive = true;
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    const cmdWithValue = buttonConfig.command + '=' + buttonConfig.valuePress;
                    window.ecuCommunication.sendCommand(cmdWithValue);
                }
                updateStatefulButton();
            }

            // Modo press_release: comando ao apertar
            if (buttonConfig.mode === 'press_release' && buttonConfig.commandPress) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    window.ecuCommunication.sendCommand(buttonConfig.commandPress);
                }
            }

            // Modo stateful_toggle: sincronizar estado antes de alternar
            if (buttonConfig.mode === 'stateful_toggle' && buttonConfig.command && buttonConfig.valueOn !== undefined && buttonConfig.valueOff !== undefined) {
                // Marcar que está processando para evitar múltiplas requisições
                if (wrapper._processingToggle) return;
                wrapper._processingToggle = true;
                
                try {
                    if (window.ecuCommunication && window.ecuCommunication.queryCommand) {
                        const currentValue = await window.ecuCommunication.queryCommand(buttonConfig.command);
                        wrapper._isActive = currentValue !== buttonConfig.valueOff;
                        
                        // Alternar para o próximo estado
                        wrapper._isActive = !wrapper._isActive;
                        
                        const valueToSend = wrapper._isActive ? buttonConfig.valueOn : buttonConfig.valueOff;
                        const cmdWithValue = buttonConfig.command + '=' + valueToSend;
                        
                        if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                            window.ecuCommunication.sendCommand(cmdWithValue);
                        }
                        
                        // Atualizar visual do botão
                        updateStatefulButton();
                    }
                } catch (err) {
                    console.error('Error querying button state:', err);
                } finally {
                    wrapper._processingToggle = false;
                }
            }

            // Modo toggle: alternar visual
            if (buttonConfig.mode === 'toggle') {
                button.classList.add('active');
                button.style.filter = 'brightness(1.3)';
            }
        });

        button.addEventListener('pointerup', (ev) => {
            ev.preventDefault();
            button.style.transform = 'scale(1)';
            button.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`;

            // Modo press_release: comando ao soltar
            if (buttonConfig.mode === 'press_release' && buttonConfig.commandRelease) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    window.ecuCommunication.sendCommand(buttonConfig.commandRelease);
                }
            }

            // Modo value: enviar valor ao soltar
            if (buttonConfig.mode === 'value' && buttonConfig.valueReleaseCommand) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    window.ecuCommunication.sendCommand(buttonConfig.valueReleaseCommand);
                }
            }

            // Modo stateful_value: enviar valor de soltar
            if (buttonConfig.mode === 'stateful_value' && buttonConfig.command && buttonConfig.valueRelease !== undefined) {
                wrapper._isActive = false;
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    const cmdWithValue = buttonConfig.command + '=' + buttonConfig.valueRelease;
                    window.ecuCommunication.sendCommand(cmdWithValue);
                }
                updateStatefulButton();
            }

            // Modo toggle: alternar estado
            if (buttonConfig.mode === 'toggle') {
                button.classList.toggle('active');
                if (button.classList.contains('active')) {
                    button.style.filter = 'brightness(1.3)';
                } else {
                    button.style.filter = 'brightness(1)';
                }
            }
        });

        button.addEventListener('pointerleave', (ev) => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`;
        });

        button.addEventListener('mouseover', () => {
            button.style.boxShadow = `0 6px 16px rgba(0,0,0,0.4)`;
            button.style.transform = 'translateY(-2px)';
        });

        button.addEventListener('mouseout', () => {
            if (!button.classList.contains('active')) {
                button.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`;
                button.style.transform = 'translateY(0)';
            }
        });

        // Função para atualizar visual do botão stateful
        function updateStatefulButton() {
            // Para stateful_value e stateful_toggle com customização
            let newIcon = buttonIcon;
            let newColor = buttonColor;
            
            if (wrapper._isActive) {
                newIcon = buttonIconOn || (buttonConfig.iconOn) || buttonIcon;
                newColor = buttonColorOn || (buttonConfig.colorOn) || buttonColor;
            }
            
            // Atualizar ícone
            const iconEl = button.querySelector('i');
            if (iconEl && newIcon) {
                iconEl.className = `bi bi-${newIcon}`;
            }
            
            // Atualizar cor
            const colorValue = getColorValue(newColor);
            button.style.background = colorValue;
            button.style.borderColor = colorValue;
        }

        // Adicionar ícone se configurado
        if (buttonIcon) {
            const icon = document.createElement('i');
            icon.className = `bi bi-${buttonIcon}`;
            icon.style.fontSize = '18px';
            button.appendChild(icon);
        }

        // Adicionar label (título customizado ou padrão)
        const label = document.createElement('span');
        label.textContent = buttonTitle;
        button.appendChild(label);

        wrapper.appendChild(button);
        wrapper._button = button;
        wrapper._type = 'button';
        wrapper._tooltip = `${buttonTitle}\n${buttonConfig.description}`;
        button.title = wrapper._tooltip;
        wrapper._updateStateful = updateStatefulButton;
        return wrapper;
    }

    function createElement(e) {
        if (e.type === 'bar') return createBarElement(e);
        if (e.type === 'led') return createLEDElement(e);
        if (e.type === 'text') return createTextElement(e);
        if (e.type === 'bar-marker') return createBarMarkerElement(e);
        if (e.type === 'conditional-text') return createConditionalTextElement(e);
        if (e.type === 'button') return createButtonElement(e);
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
            
            // Atualizar rastro (trail)
            if (el._trail) {
                const startAngle = -135;
                const endAngle = needleRotation;
                const trailRadius = radius - 5;
                const trailStartX = center + trailRadius * Math.cos(startAngle * Math.PI / 180);
                const trailStartY = center + trailRadius * Math.sin(startAngle * Math.PI / 180);
                const trailEndX = center + trailRadius * Math.cos(endAngle * Math.PI / 180);
                const trailEndY = center + trailRadius * Math.sin(endAngle * Math.PI / 180);
                const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
                el._trail.setAttribute('d', `M ${trailStartX} ${trailStartY} A ${trailRadius} ${trailRadius} 0 ${largeArc} 1 ${trailEndX} ${trailEndY}`);
            }
            
            // Atualizar valor com divisor
            if (el._valueEl) {
                const divisor = el._valueDivisor || 1;
                el._valueEl.textContent = (newValue / divisor).toFixed(1);
            }
        } else if (el._type === 'bar' && el._fillEl) {
            const pct = ((newValue - e.min) / (e.max - e.min)) * 100;
            el._fillEl.style.width = pct + '%';
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1);
        } else if (el._type === 'bar-marker' && el._fillEl) {
            const pct = ((newValue - e.min) / (e.max - e.min)) * 100;
            el._fillEl.style.width = pct + '%';
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1) + ' / ' + e.max.toFixed(1) + (e.unit ? ` ${e.unit}` : '');
            
            // Atualizar posição do marcador se existir
            if (el._fillEl._markerIndicator && e.markerValue !== undefined) {
                const markerPercent = Math.max(0, Math.min(100, ((e.markerValue - e.min) / (e.max - e.min)) * 100));
                el._fillEl._markerIndicator.style.left = markerPercent + '%';
            }
        } else if (el._type === 'led' && el._ledEl) {
            const isActive = newValue >= e.threshold;
            const ledColor = isActive ? (e.color || '#00FF00') : (e.colorOff || '#333');
            el._ledEl.style.background = `radial-gradient(circle at 30% 30%, ${isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.05)'}, ${ledColor})`;
            el._ledEl.style.border = isActive ? `2px solid ${e.color || '#00FF00'}` : '2px solid #555';
            el._ledEl.style.boxShadow = isActive ? `0 0 15px ${e.color || '#00FF00'}, inset 0 0 10px rgba(255,255,255,0.1)` : 'inset 0 2px 4px rgba(0,0,0,0.4)';
            // Atualizar ícone se existir
            const iconEl = el._ledEl.querySelector('i');
            if (iconEl && e.icon) {
                iconEl.style.color = isActive ? 'white' : '#999';
                iconEl.style.textShadow = isActive ? `0 0 6px ${e.color || '#00FF00'}` : 'none';
            }
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

    function renderViewMode(targetContainer = container) {
        if (!targetContainer) return;
        targetContainer.innerHTML = '';
        targetContainer.style.position = 'relative';
        targetContainer.style.width = '100%';
        targetContainer.style.height = '100%';
        
        elements.forEach(e => {
            // Alimentar com dados do CommonInfo se fieldId estiver configurado
            let elementWithData = e;
            if (window.CommonInfo && window.CommonInfo.data && e.fieldId) {
                const fieldData = window.CommonInfo.data[e.fieldId];
                if (fieldData) {
                    elementWithData = JSON.parse(JSON.stringify(e));
                    elementWithData.value = fieldData.value !== undefined ? fieldData.value : e.value;
                    if (!e.label) elementWithData.label = fieldData.title;
                    if (!e.unit) elementWithData.unit = fieldData.unit;
                }
            }

            const el = createElement(elementWithData);
            targetContainer.appendChild(el);
            // In view mode we must ensure widgets never escape the modal bounds.
            // Positioning here computes px bounds and clamps left/top so the whole element stays inside (0%..100%).
            try {
                const frameRect = container.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                // desired percent positions (fallback to center)
                const desiredX = (e.pos && e.pos.x != null) ? parseFloat(e.pos.x) : 50;
                const desiredY = (e.pos && e.pos.y != null) ? parseFloat(e.pos.y) : 50;

                // convert desired percent to px inside container
                const desiredLeftPx = (desiredX / 100) * frameRect.width;
                const desiredTopPx = (desiredY / 100) * frameRect.height;

                // clamp so element fully fits
                const clampedLeftPx = Math.min(Math.max(0, desiredLeftPx), Math.max(0, frameRect.width - elRect.width));
                const clampedTopPx = Math.min(Math.max(0, desiredTopPx), Math.max(0, frameRect.height - elRect.height));

                // set left/top as percentage of container and remove centering transform so 0%..100% maps to modal extents
                el.style.left = ((clampedLeftPx / frameRect.width) * 100) + '%';
                el.style.top = ((clampedTopPx / frameRect.height) * 100) + '%';
                el.style.transform = 'translate(0, 0)';
            } catch (err) {
                // fallback to safe percent clamp
                try {
                    if (el && el.style) {
                        if (el.style.left) {
                            const l = clampPercent(el.style.left.replace('%', ''));
                            el.style.left = l + '%';
                        }
                        if (el.style.top) {
                            const t = clampPercent(el.style.top.replace('%', ''));
                            el.style.top = t + '%';
                        }
                    }
                } catch (err2) {
                    console.warn('Erro ao ajustar posição do elemento:', err2);
                }
            }
            
            // Para LED com condições, avaliar se deve piscar
            if (e.type === 'led' && e.blink) {
                let shouldBlink = false;
                
                // Se tem condição configurada
                if (e.sourceElementId && e.conditionOperator && e.conditionThreshold !== undefined) {
                    const sourceElement = elements.find(el => el.id === e.sourceElementId);
                    if (sourceElement && window.CommonInfo && window.CommonInfo.data && sourceElement.fieldId) {
                        const sourceFieldData = window.CommonInfo.data[sourceElement.fieldId];
                        const sourceValue = sourceFieldData ? sourceFieldData.value : sourceElement.value;
                        
                        // Avaliar condição
                        try {
                            shouldBlink = eval(`${sourceValue} ${e.conditionOperator} ${e.conditionThreshold}`);
                        } catch (err) {
                            console.error('Erro ao avaliar condição LED:', err);
                        }
                    }
                } else {
                    // Sem condição, usar valor direto
                    shouldBlink = elementWithData.value >= (e.threshold || 0);
                }
                
                if (shouldBlink) {
                    startBlinking(el);
                }
            }
        });
    }

    // Atualizar elementos quando CommonInfo mudar
    function updateFromCommonInfo() {
        if (!editMode) {
            elements.forEach((e, idx) => {
                if (e.fieldId && window.CommonInfo && window.CommonInfo.data) {
                    const fieldData = window.CommonInfo.data[e.fieldId];
                    if (fieldData && fieldData.value !== e.value) {
                        const el = container.querySelector(`[data-id="${e.id}"]`);
                        if (el) {
                            // Atualizar valor do elemento
                            let newValue = fieldData.value;
                            
                            // Se for LED com condição, calcular se deve piscar
                            if (e.type === 'led' && e.blink && e.sourceElementId && e.conditionOperator) {
                                const sourceElement = elements.find(el => el.id === e.sourceElementId);
                                if (sourceElement && window.CommonInfo.data[sourceElement.fieldId]) {
                                    const sourceValue = window.CommonInfo.data[sourceElement.fieldId].value;
                                    try {
                                        const shouldBlink = eval(`${sourceValue} ${e.conditionOperator} ${e.conditionThreshold}`);
                                        if (shouldBlink) {
                                            startBlinking(el);
                                        } else {
                                            stopBlinking(e.id);
                                        }
                                    } catch (err) {
                                        console.error('Erro ao avaliar condição LED:', err);
                                    }
                                }
                            }
                            
                            updateElement(el, newValue);
                        }
                    }
                }
            });
        }
    }

    // Atualizar a cada 100ms
    setInterval(updateFromCommonInfo, 100);

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

        // Share/Import config UI (one-line code)
        const shareSection = document.createElement('div');
        shareSection.style.marginBottom = '12px';
        shareSection.style.padding = '10px';
        shareSection.style.border = '1px solid var(--border-color)';
        shareSection.style.borderRadius = '6px';
        shareSection.style.background = 'rgba(0,0,0,0.04)';

        const shareTitle = document.createElement('div');
        shareTitle.style.fontSize = '13px';
        shareTitle.style.fontWeight = '700';
        shareTitle.style.color = 'var(--light-red)';
        shareTitle.style.marginBottom = '8px';
        shareTitle.textContent = 'Compartilhar / Importar Configuração';
        shareSection.appendChild(shareTitle);

        // Use os botões 'Gerar & Copiar' e 'Carregar Configuração' no rodapé para exportar/importar
        const shareHint = document.createElement('div');
        shareHint.style.fontSize = '12px';
        shareHint.style.color = 'var(--text-light)';
        shareHint.style.marginTop = '6px';
        shareHint.textContent = "Use 'Gerar & Copiar' e 'Carregar Configuração' no rodapé para exportar/importar o painel.";
        shareSection.appendChild(shareHint);

        leftContent.appendChild(shareSection);

        // Body area for element-specific fields (kept separate so shareSection remains)
        const leftBody = document.createElement('div');
        leftBody.className = 'left-body';
        leftBody.style.flex = '1';
        leftBody.style.overflowY = 'auto';
        leftContent.appendChild(leftBody);

        const leftFooter = document.createElement('div');
        leftFooter.style.padding = '15px 20px';
        leftFooter.style.borderTop = '1px solid var(--border-color)';
        leftFooter.style.background = 'rgba(0,0,0,0.2)';

        // Right panel: Canvas para arrastar
        const rightPanel = document.createElement('div');
        rightPanel.style.flex = '1';
        rightPanel.style.position = 'relative';
        rightPanel.style.background = 'rgba(0,0,0,0.3)';
        rightPanel.style.display = 'flex';
        rightPanel.style.alignItems = 'center';
        rightPanel.style.justifyContent = 'center';
        rightPanel.style.padding = '20px';
        rightPanel.style.overflow = 'hidden';

        // Canvas container com mesma proporção do dashboard - PAINEL DELIMITADOR
        const canvasContainer = document.createElement('div');
        canvasContainer.style.position = 'relative';
        canvasContainer.style.width = '100%';
        canvasContainer.style.maxWidth = '1200px';
        canvasContainer.style.aspectRatio = '16 / 9';
        canvasContainer.style.background = 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(20,20,20,0.9) 100%)';
        canvasContainer.style.borderRadius = '8px';
        canvasContainer.style.overflow = 'hidden';
        canvasContainer.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)';
        canvasContainer.style.border = '1px solid rgba(139,0,0,0.3)';

        // Texto indicador do painel
        const panelIndicator = document.createElement('div');
        panelIndicator.style.position = 'absolute';
        panelIndicator.style.top = '8px';
        panelIndicator.style.left = '12px';
        panelIndicator.style.fontSize = '11px';
        panelIndicator.style.color = 'rgba(169,169,169,0.6)';
        panelIndicator.style.fontWeight = '600';
        panelIndicator.style.zIndex = '1';
        panelIndicator.style.pointerEvents = 'none';
        panelIndicator.textContent = 'PREVIEW DO PAINEL';
        canvasContainer.appendChild(panelIndicator);

        const canvas = document.createElement('div');
        canvas.style.position = 'absolute';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvasContainer.appendChild(canvas);

        // Add element previews with drag
        elements.forEach((e, idx) => {
            // Alimentar o elemento com valor real do CommonInfo se disponível
            const elementCopy = JSON.parse(JSON.stringify(e)); // Deep copy
            
            if (window.CommonInfo && window.CommonInfo.data && elementCopy.fieldId) {
                const fieldData = window.CommonInfo.data[elementCopy.fieldId];
                if (fieldData) {
                    elementCopy.value = fieldData.value || elementCopy.value;
                    if (!elementCopy.label) elementCopy.label = fieldData.title;
                    if (!elementCopy.unit) elementCopy.unit = fieldData.unit;
                }
            }

            // Criar elemento REAL usando a mesma função que a dashboard usa
            let realElement;
            try {
                if (elementCopy.type === 'gauge') {
                    realElement = createGaugeElement(elementCopy);
                } else if (elementCopy.type === 'bar') {
                    realElement = createBarElement(elementCopy);
                } else if (elementCopy.type === 'bar-marker') {
                    realElement = createBarMarkerElement(elementCopy);
                } else if (elementCopy.type === 'led') {
                    realElement = createLEDElement(elementCopy);
                } else if (elementCopy.type === 'text') {
                    realElement = createTextElement(elementCopy);
                } else if (elementCopy.type === 'conditional-text') {
                    realElement = createConditionalTextElement(elementCopy);
                } else if (elementCopy.type === 'button') {
                    realElement = createButtonElement(elementCopy);
                }
            } catch (err) {
                console.error('Erro ao criar elemento preview:', err);
            }

            if (!realElement) return;

            const preview = realElement;
            preview.className = 'dashboard-marker edit-draggable';
            preview.dataset.id = e.id;
            preview.dataset.idx = idx;
            preview.style.position = 'absolute';
            preview.style.left = (e.pos.x) + '%';
            preview.style.top = (e.pos.y) + '%';
            // Garantir que o preview seja posicionado dentro dos limites visíveis
            try {
                const cl = clampPercent(preview.style.left.replace('%', ''));
                const ct = clampPercent(preview.style.top.replace('%', ''));
                preview.style.left = cl + '%';
                preview.style.top = ct + '%';
            } catch (err) {
                // ignorar
            }
            preview.style.transform = 'translate(-50%, -50%)';
            preview.style.cursor = 'grab';
            preview.style.userSelect = 'none';
            preview.style.zIndex = '10';
            
            // NÃO adicionar estilos simples - usar o elemento real já criado criado pelas funções
            
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

        rightPanel.appendChild(canvasContainer);

        // Edit panel function
        const showEditPanel = (idx) => {
            const e = elements[idx];
            const leftBody = leftContent.querySelector('.left-body') || leftContent;
            leftBody.innerHTML = '';

            const title = document.createElement('h3');
            title.style.color = 'var(--light-red)';
            title.style.marginBottom = '15px';
            title.textContent = e.label || e.id;
            leftBody.appendChild(title);

            const infoBox = document.createElement('div');
            infoBox.style.padding = '10px';
            infoBox.style.background = 'rgba(0,200,0,0.1)';
            infoBox.style.borderRadius = '4px';
            infoBox.style.marginBottom = '15px';
            infoBox.style.fontSize = '12px';
            infoBox.style.color = 'var(--text-light)';
            infoBox.style.border = '1px solid rgba(0,200,0,0.3)';
            infoBox.textContent = `Tipo: ${e.type} | Posição: (${Math.round(e.pos.x)}%, ${Math.round(e.pos.y)}%)`;
            leftBody.appendChild(infoBox);

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
            leftBody.appendChild(removeBtn);

            const showButtonConfigInfo = (btnConfig) => {
                const infoPanel = leftContent.querySelector('.button-config-info');
                if (infoPanel) {
                    infoPanel.remove();
                }

                const infoPanelDiv = document.createElement('div');
                infoPanelDiv.className = 'button-config-info';
                infoPanelDiv.style.padding = '15px';
                infoPanelDiv.style.background = 'rgba(0,150,200,0.1)';
                infoPanelDiv.style.borderRadius = '6px';
                infoPanelDiv.style.marginBottom = '15px';
                infoPanelDiv.style.border = '1px solid rgba(0,150,200,0.3)';

                const titleDiv = document.createElement('div');
                titleDiv.style.fontSize = '14px';
                titleDiv.style.fontWeight = '600';
                titleDiv.style.color = 'var(--light-red)';
                titleDiv.style.marginBottom = '8px';
                titleDiv.textContent = `📋 ${btnConfig.title}`;
                infoPanelDiv.appendChild(titleDiv);

                const descDiv = document.createElement('div');
                descDiv.style.fontSize = '12px';
                descDiv.style.color = 'var(--text-light)';
                descDiv.style.marginBottom = '12px';
                descDiv.textContent = btnConfig.description;
                infoPanelDiv.appendChild(descDiv);

                const opcionesLabel = document.createElement('div');
                opcionesLabel.style.fontSize = '12px';
                opcionesLabel.style.fontWeight = '600';
                opcionesLabel.style.color = '#00c8ff';
                opcionesLabel.style.marginBottom = '8px';
                opcionesLabel.textContent = '🎯 Opções Disponíveis:';
                infoPanelDiv.appendChild(opcionesLabel);

                if (btnConfig.options && btnConfig.options.length > 0) {
                    btnConfig.options.forEach((opt, idx) => {
                        const optDiv = document.createElement('div');
                        optDiv.style.fontSize = '11px';
                        optDiv.style.color = '#e0e0e0';
                        optDiv.style.marginBottom = '6px';
                        optDiv.style.paddingLeft = '12px';
                        optDiv.textContent = `• ${opt.label}: ${opt.description}`;
                        infoPanelDiv.appendChild(optDiv);
                    });
                }

                leftBody.insertBefore(infoPanelDiv, leftBody.querySelector('h3').nextSibling);
            };

            // Se for botão e tiver config, mostrar informações iniciais
            if (e.type === 'button' && e.buttonConfigId) {
                const btnConfig = dashboardButtonsConfig.find(btn => btn.id === e.buttonConfigId);
                if (btnConfig) {
                    setTimeout(() => showButtonConfigInfo(btnConfig), 100);
                }
            }

            const commonFields = [
                { label: 'Label', key: 'label', type: 'text' },
                { label: 'Tipo', key: 'type', type: 'select', options: ['gauge', 'bar', 'bar-marker', 'led', 'text', 'conditional-text', 'button'] },
                { label: 'Cor', key: 'color', type: 'color' },
                { label: 'Tamanho (%)', key: 'sizeScale', type: 'range', min: '25', max: '444', step: '5' },
                { label: 'Ícone (Bootstrap)', key: 'icon', type: 'text', placeholder: 'Ex: speedometer, power, fuel-pump' },
                { label: '📡 Campo de Dados', key: 'fieldId', type: 'select', options: [], placeholder: 'Selecione um campo (opcional)' }
            ];

            // Populer opções de fieldId do CommonInfo
            if (window.CommonInfo && window.CommonInfo.config && window.CommonInfo.config.dataFields) {
                const fieldOptions = window.CommonInfo.config.dataFields.map(f => ({
                    value: f.id,
                    label: `${f.title} (${f.id})`
                }));
                commonFields[5].options = fieldOptions; // fieldId é o 6º campo (index 5)
            }

            const gaugeBarFields = [
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Valor', key: 'value', type: 'number' },
                { label: 'Divisor de Valor', key: 'valueDivisor', type: 'number', step: '1' },
                { label: 'Rótulo (Label)', key: 'label', type: 'text', placeholder: 'Ex: Temperatura, RPM' },
                { label: 'Unidade', key: 'unit', type: 'text', placeholder: 'Ex: °C, km/h, bar' },
                { label: 'Rotação do Gauge (°)', key: 'gaugeRotation', type: 'range', min: '0', max: '360', step: '5' },
                { label: 'Zona Perigo - Inicial', key: 'dangerStart', type: 'number', placeholder: 'Deixe vazio sem perigo' },
                { label: 'Zona Perigo - Final', key: 'dangerEnd', type: 'number' },
                { label: 'Zona Perigo - Cor', key: 'dangerColor', type: 'color' }
            ];

            const barMarkerFields = [
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Valor', key: 'value', type: 'number' },
                { label: 'Valor Marcador', key: 'markerValue', type: 'number' },
                { label: 'Rótulo (Label)', key: 'label', type: 'text', placeholder: 'Ex: Pressão, Carga' },
                { label: 'Unidade', key: 'unit', type: 'text', placeholder: 'Ex: bar, %, psi' },
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
                { label: 'Botão Pré-definido', key: 'buttonConfigId', type: 'select', options: [] },
                { label: 'Título Customizado', key: 'customLabel', type: 'text', placeholder: 'Deixe vazio para usar padrão' },
                { label: 'Ícone Customizado (OFF)', key: 'customIcon', type: 'text', placeholder: 'Ex: heart, star, etc (deixe vazio para padrão)' },
                { label: 'Cor Customizada (OFF)', key: 'customColor', type: 'select', options: ['red', 'green', 'blue', 'yellow', 'purple', 'orange'] },
                { label: 'Ícone Customizado (ON)', key: 'customIconOn', type: 'text', placeholder: 'Para estado ativo (stateful only)' },
                { label: 'Cor Customizada (ON)', key: 'customColorOn', type: 'select', options: ['red', 'green', 'blue', 'yellow', 'purple', 'orange'] }
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
            } else if (e.type === 'button') {
                fieldsToShow = [...fieldsToShow, ...buttonFields];
                // Popular opções de botões do su.json
                if (buttonFields[0] && dashboardButtonsConfig.length > 0) {
                    buttonFields[0].options = dashboardButtonsConfig.map(btn => ({
                        value: btn.id,
                        label: btn.title
                    }));
                }
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
                    // Se for campo de seleção de botão, popular com opções
                    if (f.key === 'buttonConfigId' && dashboardButtonsConfig.length > 0) {
                        dashboardButtonsConfig.forEach(btnConfig => {
                            const optEl = document.createElement('option');
                            optEl.value = btnConfig.id;
                            optEl.textContent = btnConfig.title;
                            optEl.selected = e[f.key] === btnConfig.id;
                            inp.appendChild(optEl);
                        });
                    } else {
                        // Opções regulares
                        f.options.forEach(opt => {
                            const optEl = document.createElement('option');
                            // Se opt é um objeto, usar value e label
                            const value = typeof opt === 'string' ? opt : opt.value;
                            const label = typeof opt === 'string' ? opt : opt.label;
                            optEl.value = value;
                            optEl.textContent = label;
                            optEl.selected = e[f.key] === value;
                            inp.appendChild(optEl);
                        });
                    }
                    inp.style.padding = '6px 8px';
                    inp.style.background = 'var(--bg-dark)';
                    inp.style.border = '1px solid var(--border-color)';
                    inp.style.color = 'var(--text-light)';
                    inp.style.borderRadius = '4px';

                    // Se for campo de botão, adicionar listener para mostrar informações
                    if (f.key === 'buttonConfigId') {
                        inp.addEventListener('change', () => {
                            elements[idx][f.key] = inp.value;
                            // Mostrar informações do botão selecionado
                            const selectedBtnConfig = dashboardButtonsConfig.find(btn => btn.id === inp.value);
                            if (selectedBtnConfig) {
                                showButtonConfigInfo(selectedBtnConfig);
                            }
                        });
                    }
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
                    inp.value = e[f.key] || (f.key === 'iconRotation' ? '0' : '100');
                    inp.style.width = '100%';
                    inp.style.cursor = 'pointer';

                    const valueDisplay = document.createElement('div');
                    valueDisplay.style.fontSize = '12px';
                    valueDisplay.style.color = 'var(--light-red)';
                    valueDisplay.style.marginTop = '4px';
                    valueDisplay.style.fontWeight = '600';
                    
                    // Determinar unidade baseada na chave do campo
                    const unit = f.key === 'iconRotation' || f.key === 'gaugeRotation' ? '°' : '%';
                    valueDisplay.textContent = inp.value + unit;

                    inp.addEventListener('input', () => {
                        valueDisplay.textContent = inp.value + unit;
                        // Atualizar elemento em tempo real para campos de rotação
                        if (f.key === 'gaugeRotation' || f.key === 'iconRotation') {
                            elements[idx][f.key] = parseFloat(inp.value);
                            renderEditMode();
                        }
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
                    
                    // Montar dangerZone se for gauge e houver dangerStart/dangerEnd
                    if (e.type === 'gauge' && (f.key === 'dangerStart' || f.key === 'dangerEnd' || f.key === 'dangerColor')) {
                        if (elements[idx].dangerStart != null && elements[idx].dangerEnd != null) {
                            elements[idx].dangerZone = {
                                start: elements[idx].dangerStart,
                                end: elements[idx].dangerEnd,
                                color: elements[idx].dangerColor || '#FF4444'
                            };
                        } else {
                            elements[idx].dangerZone = null;
                        }
                    }
                });

                row.appendChild(lbl);
                row.appendChild(inp);
                leftBody.appendChild(row);

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
                    leftBody.appendChild(iconPickerContainer);
                }
            });

            // ===== SEÇÃO DE CONDIÇÕES PARA LED =====
            if (e.type === 'led') {
                const conditionSection = document.createElement('div');
                conditionSection.style.padding = '15px';
                conditionSection.style.background = 'rgba(0,150,200,0.1)';
                conditionSection.style.borderRadius = '6px';
                conditionSection.style.marginBottom = '15px';
                conditionSection.style.border = '1px solid rgba(0,150,200,0.3)';

                const condTitle = document.createElement('div');
                condTitle.style.fontSize = '13px';
                condTitle.style.fontWeight = '600';
                condTitle.style.color = 'var(--light-red)';
                condTitle.style.marginBottom = '12px';
                condTitle.textContent = '⚡ Condição para Acender';

                conditionSection.appendChild(condTitle);

                // Source: Gauge ou outro elemento
                const sourceLabel = document.createElement('label');
                sourceLabel.style.color = 'var(--text-light)';
                sourceLabel.style.fontSize = '12px';
                sourceLabel.style.fontWeight = '600';
                sourceLabel.style.display = 'block';
                sourceLabel.style.marginBottom = '6px';
                sourceLabel.textContent = 'Fonte (Elemento):';
                conditionSection.appendChild(sourceLabel);

                const sourceSelect = document.createElement('select');
                sourceSelect.style.width = '100%';
                sourceSelect.style.padding = '6px 8px';
                sourceSelect.style.background = 'var(--bg-dark)';
                sourceSelect.style.border = '1px solid var(--border-color)';
                sourceSelect.style.color = 'var(--text-light)';
                sourceSelect.style.borderRadius = '4px';
                sourceSelect.style.marginBottom = '12px';

                const noneOption = document.createElement('option');
                noneOption.value = '';
                noneOption.textContent = '--- Nenhuma (usar valor direto) ---';
                sourceSelect.appendChild(noneOption);

                // Adicionar opções de elementos (apenas gauge e bar)
                elements.forEach((elem, i) => {
                    if ((elem.type === 'gauge' || elem.type === 'bar' || elem.type === 'bar-marker') && i !== idx) {
                        const opt = document.createElement('option');
                        opt.value = elem.id;
                        opt.textContent = `${elem.label || elem.id} (${elem.type})`;
                        opt.selected = e.sourceElementId === elem.id;
                        sourceSelect.appendChild(opt);
                    }
                });

                sourceSelect.addEventListener('change', () => {
                    elements[idx].sourceElementId = sourceSelect.value || null;
                });

                conditionSection.appendChild(sourceSelect);

                // Operador
                const opLabel = document.createElement('label');
                opLabel.style.color = 'var(--text-light)';
                opLabel.style.fontSize = '12px';
                opLabel.style.fontWeight = '600';
                opLabel.style.display = 'block';
                opLabel.style.marginBottom = '6px';
                opLabel.textContent = 'Operador:';
                conditionSection.appendChild(opLabel);

                const opSelect = document.createElement('select');
                opSelect.style.width = '100%';
                opSelect.style.padding = '6px 8px';
                opSelect.style.background = 'var(--bg-dark)';
                opSelect.style.border = '1px solid var(--border-color)';
                opSelect.style.color = 'var(--text-light)';
                opSelect.style.borderRadius = '4px';
                opSelect.style.marginBottom = '12px';

                const operators = [
                    { value: '>=', label: 'Maior ou igual (≥)' },
                    { value: '>', label: 'Maior (>)' },
                    { value: '<=', label: 'Menor ou igual (≤)' },
                    { value: '<', label: 'Menor (<)' },
                    { value: '==', label: 'Igual (=)' },
                    { value: '!=', label: 'Diferente (≠)' }
                ];

                operators.forEach(op => {
                    const opt = document.createElement('option');
                    opt.value = op.value;
                    opt.textContent = op.label;
                    opt.selected = e.conditionOperator === op.value;
                    opSelect.appendChild(opt);
                });

                opSelect.addEventListener('change', () => {
                    elements[idx].conditionOperator = opSelect.value;
                });

                conditionSection.appendChild(opSelect);

                // Valor limite
                const thresholdLabel = document.createElement('label');
                thresholdLabel.style.color = 'var(--text-light)';
                thresholdLabel.style.fontSize = '12px';
                thresholdLabel.style.fontWeight = '600';
                thresholdLabel.style.display = 'block';
                thresholdLabel.style.marginBottom = '6px';
                thresholdLabel.textContent = 'Valor Limite:';
                conditionSection.appendChild(thresholdLabel);

                const thresholdInput = document.createElement('input');
                thresholdInput.type = 'number';
                thresholdInput.style.width = '100%';
                thresholdInput.style.padding = '6px 8px';
                thresholdInput.style.background = 'var(--bg-dark)';
                thresholdInput.style.border = '1px solid var(--border-color)';
                thresholdInput.style.color = 'var(--text-light)';
                thresholdInput.style.borderRadius = '4px';
                thresholdInput.value = e.conditionThreshold || 0;

                thresholdInput.addEventListener('change', () => {
                    elements[idx].conditionThreshold = parseFloat(thresholdInput.value);
                });

                conditionSection.appendChild(thresholdInput);

                leftContent.appendChild(conditionSection);
            }
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
            
            ['gauge', 'bar', 'bar-marker', 'led', 'text', 'conditional-text', 'button'].forEach(t => {
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
                } else if (type === 'button') {
                    // Para botões, usar o primeiro botão configurado como padrão
                    const defaultBtn = dashboardButtonsConfig.length > 0 ? dashboardButtonsConfig[0] : null;
                    if (defaultBtn) {
                        newElem = { ...baseConfig, buttonConfigId: defaultBtn.id };
                    } else {
                        console.warn('Nenhuma configuração de botão disponível no su.json');
                        newElem = { ...baseConfig, buttonConfigId: null };
                    }
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

    function createEditModalIfNeeded() {
        if (editModal && editContainer) return;
        // build edit modal DOM
        editModal = document.createElement('div');
        editModal.id = 'dashboardConfigModal';
        editModal.className = 'dashboard-modal';

        const frame = document.createElement('div');
        frame.className = 'dashboard-frame';
        frame.setAttribute('data-edit-mode', 'true');

        const closeBtn = document.createElement('button');
        closeBtn.className = 'dashboard-close';
        closeBtn.id = 'dashboardConfigCloseBtn';
        closeBtn.setAttribute('aria-label', 'Fechar');
        closeBtn.textContent = '✕';

        const content = document.createElement('div');
        content.className = 'dashboard-content';
        content.id = 'dashboardConfigContent';

        frame.appendChild(closeBtn);
        frame.appendChild(content);
        editModal.appendChild(frame);
        document.body.appendChild(editModal);

        editContainer = content;

        // footer with revert/save
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

        const genBtn = document.createElement('button');
        genBtn.textContent = 'Gerar & Copiar';
        genBtn.style.padding = '8px 14px';
        genBtn.style.background = 'linear-gradient(90deg, #444, #222)';
        genBtn.style.border = '1px solid var(--border-color)';
        genBtn.style.color = 'var(--text-light)';
        genBtn.style.borderRadius = '4px';
        genBtn.style.cursor = 'pointer';
        genBtn.addEventListener('click', () => {
            const modalId = 'dsw-share-modal-footer';
            let existing = document.getElementById(modalId);
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = modalId;
            overlay.style.position = 'fixed';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.background = 'rgba(0,0,0,0.6)';
            overlay.style.zIndex = '20000';

            const panel = document.createElement('div');
            panel.style.width = 'min(880px, 92%)';
            panel.style.maxWidth = '920px';
            panel.style.background = 'var(--bg-darker)';
            panel.style.border = '1px solid var(--border-color)';
            panel.style.borderRadius = '10px';
            panel.style.padding = '18px';
            panel.style.boxShadow = '0 8px 36px rgba(0,0,0,0.6)';

            const h = document.createElement('div');
            h.textContent = 'Código único (uma linha)';
            h.style.fontWeight = '700';
            h.style.color = 'var(--light-red)';
            h.style.marginBottom = '10px';
            panel.appendChild(h);

            const codeInput = document.createElement('input');
            codeInput.type = 'text';
            codeInput.readOnly = true;
            codeInput.style.width = '100%';
            codeInput.style.padding = '10px';
            codeInput.style.background = 'var(--bg-dark)';
            codeInput.style.border = '1px solid var(--border-color)';
            codeInput.style.color = 'var(--text-light)';
            codeInput.style.borderRadius = '6px';
            codeInput.style.fontFamily = 'monospace';
            codeInput.style.overflow = 'hidden';
            codeInput.style.textOverflow = 'ellipsis';

            const code = generateShareCode();
            codeInput.value = code;
            panel.appendChild(codeInput);

            const info = document.createElement('div');
            info.style.fontSize = '12px';
            info.style.color = 'var(--text-light)';
            info.style.marginTop = '8px';
            info.textContent = 'Após copiar, compartilhe este código com um amigo para que ele tenha exatamente o mesmo painel.';
            panel.appendChild(info);

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.marginTop = '12px';
            row.style.justifyContent = 'flex-end';

            const copyBtn2 = document.createElement('button');
            copyBtn2.textContent = 'Copiar';
            copyBtn2.style.padding = '8px 12px';
            copyBtn2.style.background = 'var(--primary-red)';
            copyBtn2.style.border = 'none';
            copyBtn2.style.color = 'white';
            copyBtn2.style.borderRadius = '6px';
            copyBtn2.style.cursor = 'pointer';
            copyBtn2.addEventListener('click', async () => {
                try { await navigator.clipboard.writeText(codeInput.value); } catch (err) {
                    const ta = document.createElement('textarea'); ta.value = codeInput.value; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                }
                copyBtn2.textContent = 'Copiado ✓';
                setTimeout(() => { copyBtn2.textContent = 'Copiar'; }, 1500);
            });

            const closeBtn2 = document.createElement('button');
            closeBtn2.textContent = 'Fechar';
            closeBtn2.style.padding = '8px 12px';
            closeBtn2.style.background = 'var(--border-color)';
            closeBtn2.style.border = 'none';
            closeBtn2.style.color = 'var(--text-light)';
            closeBtn2.style.borderRadius = '6px';
            closeBtn2.style.cursor = 'pointer';
            closeBtn2.addEventListener('click', () => overlay.remove());

            row.appendChild(closeBtn2);
            row.appendChild(copyBtn2);
            panel.appendChild(row);

            overlay.appendChild(panel);
            document.body.appendChild(overlay);
        });

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Carregar Configuração';
        loadBtn.style.padding = '8px 14px';
        loadBtn.style.background = 'var(--border-color)';
        loadBtn.style.border = '1px solid var(--border-color)';
        loadBtn.style.color = 'var(--text-light)';
        loadBtn.style.borderRadius = '4px';
        loadBtn.style.cursor = 'pointer';
        loadBtn.addEventListener('click', () => {
            const modalId = 'dsw-load-modal-footer';
            let existing = document.getElementById(modalId);
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = modalId;
            overlay.style.position = 'fixed';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.background = 'rgba(0,0,0,0.6)';
            overlay.style.zIndex = '20000';

            const panel = document.createElement('div');
            panel.style.width = 'min(880px, 92%)';
            panel.style.maxWidth = '920px';
            panel.style.background = 'var(--bg-darker)';
            panel.style.border = '1px solid var(--border-color)';
            panel.style.borderRadius = '10px';
            panel.style.padding = '18px';
            panel.style.boxShadow = '0 8px 36px rgba(0,0,0,0.6)';

            const h = document.createElement('div');
            h.textContent = 'Carregar configuração (cole o código abaixo)';
            h.style.fontWeight = '700';
            h.style.color = 'var(--light-red)';
            h.style.marginBottom = '10px';
            panel.appendChild(h);

            const ta = document.createElement('textarea');
            ta.style.width = '100%';
            ta.style.minHeight = '120px';
            ta.style.padding = '10px';
            ta.style.background = 'var(--bg-dark)';
            ta.style.border = '1px solid var(--border-color)';
            ta.style.color = 'var(--text-light)';
            ta.style.borderRadius = '6px';
            ta.placeholder = 'Cole aqui o código gerado (ex: DSWCFG1:...) ou JSON...';
            panel.appendChild(ta);

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.marginTop = '12px';
            row.style.justifyContent = 'flex-end';

            const importBtn = document.createElement('button');
            importBtn.textContent = 'Importar';
            importBtn.style.padding = '8px 12px';
            importBtn.style.background = 'var(--primary-red)';
            importBtn.style.border = 'none';
            importBtn.style.color = 'white';
            importBtn.style.borderRadius = '6px';
            importBtn.style.cursor = 'pointer';
            importBtn.addEventListener('click', () => {
                const code = ta.value.trim();
                if (!code) return alert('Cole o código antes de importar');
                const res = importShareCode(code);
                if (res.ok) {
                    saveElements(elements);
                    // re-render the edit modal content if open
                    renderEditMode();
                    overlay.remove();
                    alert('Configuração importada com sucesso');
                } else {
                    alert('Falha ao importar: ' + (res.error || 'erro desconhecido'));
                }
            });

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancelar';
            cancelBtn.style.padding = '8px 12px';
            cancelBtn.style.background = 'var(--border-color)';
            cancelBtn.style.border = 'none';
            cancelBtn.style.color = 'var(--text-light)';
            cancelBtn.style.borderRadius = '6px';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.addEventListener('click', () => overlay.remove());

            row.appendChild(cancelBtn);
            row.appendChild(importBtn);
            panel.appendChild(row);

            overlay.appendChild(panel);
            document.body.appendChild(overlay);
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
        footer.appendChild(genBtn);
        footer.appendChild(loadBtn);
        footer.appendChild(saveBtn);
        frame.appendChild(footer);

        // hook close
        closeBtn.addEventListener('click', closeModal);
    }

    function openModal(editModeFlag = false) {
        editMode = !!editModeFlag;

        // Hide controls-area when viewing dashboard (only in view mode)
        const controlsArea = document.querySelector('.controls-area');
        if (controlsArea) {
            controlsArea.style.display = editMode ? 'flex' : 'none';
        }

        if (editMode) {
            // create separate edit modal if needed
            createEditModalIfNeeded();
            backupElements = JSON.parse(JSON.stringify(elements));
            container = editContainer;
            modal = editModal;
            // show footer
            const footer = document.getElementById('dashboard-edit-footer');
            if (footer) footer.style.display = 'flex';
            renderEditMode();
            // mark frames
            const viewFrame = viewModal && viewModal.querySelector('.dashboard-frame');
            if (viewFrame) viewFrame.removeAttribute('data-edit-mode');
            const editFrame = editModal && editModal.querySelector('.dashboard-frame');
            if (editFrame) editFrame.setAttribute('data-edit-mode', 'true');
        } else {
            // view mode
            container = viewContainer;
            modal = viewModal;
            renderViewMode();
            // ensure edit modal footer hidden if exists
            const footer = document.getElementById('dashboard-edit-footer');
            if (footer) footer.style.display = 'none';
            const viewFrame = viewModal && viewModal.querySelector('.dashboard-frame');
            if (viewFrame) viewFrame.removeAttribute('data-edit-mode');
        }

        if (modal) {
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('dashboard-open');
        }
    }

    // Presentation (view-only) modal functions - totally separate from edit modal
    function openPresentationModal() {
        if (!viewModal || !viewContainer) return;
        // render into the view container (dashboardContent)
        renderViewMode(viewContainer);
        viewModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('dashboard-open');
    }

    function closePresentationModal() {
        if (!viewModal) return;
        viewModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('dashboard-open');
        if (viewContainer) viewContainer.innerHTML = '';
        Object.keys(blinkIntervals).forEach(id => stopBlinking(id));
    }

    function closeModal() {
        if (!modal) return;
        // hide active modal
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('dashboard-open');

        // Restore controls-area visibility
        const controlsArea = document.querySelector('.controls-area');
        if (controlsArea) {
            controlsArea.style.display = 'flex';
        }

        // Stop all blinks
        Object.keys(blinkIntervals).forEach(id => stopBlinking(id));

        // if we are closing edit modal, remove it from DOM and restore view as active container
        if (modal === editModal) {
            editMode = false;
            // remove edit modal from DOM
            try {
                if (editModal && editModal.parentNode) editModal.parentNode.removeChild(editModal);
            } catch (err) {}
            editModal = null;
            editContainer = null;
            // restore references to view modal
            container = viewContainer;
            modal = viewModal;
        } else {
            // closing view modal
            editMode = false;
            container = viewContainer;
            modal = viewModal;
        }
    }

    // Handle single vs double click vs long press (works on both mouse and touch)
    let clickCount = 0;
    let clickTimer = null;
    let pressTimer = null;
    let pressStartTime = null;
    let isLongPressActive = false;
    let longPressIndicator = null;

    if (btnOpen) {
        // Criar indicador visual de long press
        function createLongPressIndicator() {
            const indicator = document.createElement('div');
            indicator.style.position = 'absolute';
            indicator.style.top = '50%';
            indicator.style.left = '50%';
            indicator.style.transform = 'translate(-50%, -50%)';
            indicator.style.width = '60px';
            indicator.style.height = '60px';
            indicator.style.borderRadius = '50%';
            indicator.style.border = '3px solid rgba(165, 42, 42, 0.5)';
            indicator.style.pointerEvents = 'none';
            indicator.style.opacity = '0';
            indicator.style.animation = 'longPressProgress 4s ease-out forwards';
            
            // Adicionar estilo de animação ao head
            if (!document.getElementById('longPressStyle')) {
                const style = document.createElement('style');
                style.id = 'longPressStyle';
                style.innerHTML = `
                    @keyframes longPressProgress {
                        0% {
                            width: 60px;
                            height: 60px;
                            opacity: 1;
                            border-color: rgba(165, 42, 42, 0.3);
                            box-shadow: 0 0 0 0 rgba(165, 42, 42, 0.5);
                        }
                        100% {
                            width: 100px;
                            height: 100px;
                            opacity: 0;
                            border-color: rgba(165, 42, 42, 0);
                            box-shadow: 0 0 0 15px rgba(165, 42, 42, 0);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            return indicator;
        }

        // Unified handler para mouse e touch - usa pointerdown/pointerup (melhor compatibilidade)
        btnOpen.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            pressStartTime = Date.now();
            isLongPressActive = false;

            // Mostrar indicador visual
            if (!btnOpen.style.position) btnOpen.style.position = 'relative';
            longPressIndicator = createLongPressIndicator();
            btnOpen.appendChild(longPressIndicator);

            // Timer para detectar long press (1 segundos)
            pressTimer = setTimeout(() => {
                isLongPressActive = true;
                openModal(true);
                clickCount = 0;
                if (clickTimer) clearTimeout(clickTimer);
                
                // Remover indicador
                if (longPressIndicator && longPressIndicator.parentNode) {
                    longPressIndicator.remove();
                    longPressIndicator = null;
                }
            }, 1000);
        });

        // Cancelar long press se soltar antes
        btnOpen.addEventListener('pointerup', (e) => {
            e.preventDefault();
            
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }

            // Remover indicador visual
            if (longPressIndicator && longPressIndicator.parentNode) {
                longPressIndicator.remove();
                longPressIndicator = null;
            }

            // Se foi long press, não processar como clique
            if (isLongPressActive) {
                isLongPressActive = false;
                return;
            }

            // Processar como clique simples/duplo
            clickCount++;

            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    // Single click - open presentation modal (separate)
                    openPresentationModal();
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                // Double click - abre dashboard em edit mode (config)
                openModal(true);
                clickCount = 0;
            }
        });

        // Cancelar long press se sair do elemento
        btnOpen.addEventListener('pointerleave', () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
                
                // Remover indicador visual
                if (longPressIndicator && longPressIndicator.parentNode) {
                    longPressIndicator.remove();
                    longPressIndicator = null;
                }
            }
        });

        // Adicionar feedback visual durante long press
        btnOpen.addEventListener('pointerdown', function() {
            this.style.opacity = '0.8';
        });

        btnOpen.addEventListener('pointerup', function() {
            this.style.opacity = '1';
        });

        btnOpen.addEventListener('pointerleave', function() {
            this.style.opacity = '1';
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', closeModal);
    }

    // presentation modal close button (if exists)
    const btnViewClose = document.getElementById('dashboardViewCloseBtn');
    if (btnViewClose) {
        btnViewClose.addEventListener('click', closePresentationModal);
    }

    // Footer is created inside the edit modal by createEditModalIfNeeded().

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
        closeModal,
        openPresentationModal,
        closePresentationModal,
        generateShareCode,
        importShareCode
    };

    if (modal && modal.getAttribute('aria-hidden') === 'false') {
        renderViewMode();
    }

})();
