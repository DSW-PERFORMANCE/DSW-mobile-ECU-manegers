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
            // Usar StorageManager se disponível, senão fallback para localStorage
            if (window.StorageManager) {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return JSON.parse(JSON.stringify(defaultElements));
                const payload = JSON.parse(raw);
                return payload.data || JSON.parse(JSON.stringify(defaultElements));
            } else {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return JSON.parse(JSON.stringify(defaultElements));
                return JSON.parse(raw);
            }
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
            // Usar StorageManager se disponível
            if (window.StorageManager) {
                window.StorageManager.save(STORAGE_KEY, list);
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            }
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
    const SHARE_PREFIX = 'DSWCFG2:'; // v2 inclui quick stats

    function generateShareCode() {
        try {
            // Incluir tanto elements quanto quick stats no export
            const exportData = {
                elements: elements,
                quickStats: window.quickStatsConfig || []
            };
            const json = JSON.stringify(exportData);
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
            
            // Detectar versão do código
            let isV2 = false;
            if (payload.startsWith('DSWCFG2:')) {
                isV2 = true;
                payload = payload.slice('DSWCFG2:'.length);
            } else if (payload.startsWith('DSWCFG1:')) {
                payload = payload.slice('DSWCFG1:'.length);
            }

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
            
            // Se for v2, importar tanto elements quanto quickStats
            if (isV2 && parsed.elements) {
                if (!Array.isArray(parsed.elements)) throw new Error('Formato inválido');
                elements = parsed.elements;
                
                // Importar quick stats se existirem
                if (parsed.quickStats && Array.isArray(parsed.quickStats)) {
                    window.quickStatsConfig = parsed.quickStats;
                    saveQuickStatsConfig();
                    updateQuickStats();
                }
            } else {
                // v1: apenas elements
                if (!Array.isArray(parsed)) throw new Error('Formato inválido');
                elements = parsed;
            }
            
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
            wrapper.style.transformOrigin = '50% 50%';
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
            // keep reference so preview can update dynamically
            wrapper._dangerPath = dangerZonePath;
        }

        // zona de warning (faixa amarela) opcional
        if (e.warningZone) {
            const warningStart = ((e.warningZone.start - e.min) / (e.max - e.min)) * 270 - 135;
            const warningEnd = ((e.warningZone.end - e.min) / (e.max - e.min)) * 270 - 135;
            const warningRadius = radius - 6;
            const warnStartX = center + warningRadius * Math.cos(warningStart * Math.PI / 180);
            const warnStartY = center + warningRadius * Math.sin(warningStart * Math.PI / 180);
            const warnEndX = center + warningRadius * Math.cos(warningEnd * Math.PI / 180);
            const warnEndY = center + warningRadius * Math.sin(warningEnd * Math.PI / 180);
            const warnArc = Math.abs(warningEnd - warningStart) > 180 ? 1 : 0;

            const warningPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            warningPath.setAttribute('d', `M ${warnStartX} ${warnStartY} A ${warningRadius} ${warningRadius} 0 ${warnArc} 1 ${warnEndX} ${warnEndY}`);
            warningPath.setAttribute('stroke', e.warningZone.color || '#FFD54F');
            warningPath.setAttribute('stroke-width', '3');
            warningPath.setAttribute('fill', 'none');
            warningPath.setAttribute('opacity', '0.6');
            warningPath.style.filter = `drop-shadow(0 0 3px ${e.warningZone.color || 'rgba(255, 213, 79, 0.8)'})`;
            svg.appendChild(warningPath);
            wrapper._warningPath = warningPath;
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
        const widthPx = 220 * scale;
        const heightPx = 48 * scale;
        wrapper.style.width = widthPx + 'px';
        wrapper.style.height = heightPx + 'px';

        const cont = document.createElement('div');
        cont.style.display = 'flex';
        cont.style.flexDirection = 'column';
        cont.style.gap = '6px';
        cont.style.padding = '6px';
        cont.style.width = '100%';
        cont.style.height = '100%';

        const label = document.createElement('div');
        label.style.fontSize = '12px';
        label.style.color = 'var(--text-light)';
        label.style.fontWeight = '700';
        label.style.textAlign = 'left';
        label.textContent = e.label || e.id;

        // Value / unit
        const value = document.createElement('div');
        value.style.fontSize = '12px';
        value.style.color = 'var(--light-red)';
        value.style.textAlign = 'right';
        value.style.fontWeight = '700';
        const unitStr = e.unit ? ` ${e.unit}` : '';
        value.textContent = (e.value !== undefined ? e.value.toFixed(1) : '') + unitStr;

        // Bar container
        const barOuter = document.createElement('div');
        barOuter.style.position = 'relative';
        barOuter.style.width = '100%';
        barOuter.style.flex = '1';
        barOuter.style.display = 'flex';
        barOuter.style.alignItems = 'center';
        barOuter.style.justifyContent = 'center';

        // border around bar
        const bar = document.createElement('div');
        bar.style.width = '100%';
        bar.style.height = '14px';
        bar.style.background = '#222';
        bar.style.border = '1px solid rgba(255,255,255,0.06)';
        bar.style.borderRadius = '8px';
        bar.style.overflow = 'hidden';
        bar.style.position = 'relative';
        bar.style.transition = 'height 0.3s ease';

        // fill element (will show gradient and width)
        const fill = document.createElement('div');
        fill.style.height = '100%';
        fill.style.width = ((e.value - (e.min || 0)) / ((e.max || 1) - (e.min || 0))) * 100 + '%';
        fill.style.transition = 'width 0.5s ease, background-color 0.3s ease';
        fill.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.06)';
        // choose gradient colors
        const cold = e.coldColor || '#2ea8ff';
        const hot = e.hotColor || (e.color || '#ff6b6b');
        fill.style.background = `linear-gradient(to right, ${cold}, ${hot})`;

        bar.appendChild(fill);
        barOuter.appendChild(bar);

        cont.appendChild(label);
        cont.appendChild(barOuter);
        cont.appendChild(value);
        wrapper.appendChild(cont);

        // mode: 'fill' (default) or 'thickness' (bar grows in height with value)
        wrapper._fillEl = fill;
        wrapper._barEl = bar;
        wrapper._valueEl = value;
        wrapper._type = 'bar';
        wrapper._mode = e.mode || 'fill';
        wrapper._coldColor = cold;
        wrapper._hotColor = hot;
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

        barContainer.appendChild(bar);        barContainer.appendChild(bar);
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

    function createBarPointerElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker bar-pointer';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        
        const scale = (e.sizeScale || 100) / 100;
        const baseWidthPercent = 20;
        const baseHeightPercent = 12;
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
        bar.style.height = '24px';
        bar.style.background = 'linear-gradient(to bottom, rgba(50, 50, 50, 0.8), rgba(25, 25, 25, 0.9))';
        bar.style.border = '1px solid #8B0000';
        bar.style.borderRadius = '12px';
        bar.style.overflow = 'hidden';
        bar.style.position = 'relative';
        bar.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.5)';

        const fill = document.createElement('div');
        fill.style.height = '100%';
        fill.style.width = ((e.value - e.min) / (e.max - e.min)) * 100 + '%';
        fill.style.transition = 'width 0.3s ease';
        fill.style.background = `linear-gradient(to right, ${e.color || 'var(--primary-red)'}, rgba(165, 42, 42, 0.8))`;
        fill.style.boxShadow = `inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 8px ${e.color || 'rgba(139, 0, 0, 0.6)'}`;
        bar.appendChild(fill);

        // Ponteiro vertical mostrando valor atual
        const pointerPercent = Math.max(0, Math.min(100, ((e.value - e.min) / (e.max - e.min)) * 100));
        const pointer = document.createElement('div');
        pointer.style.position = 'absolute';
        pointer.style.left = pointerPercent + '%';
        pointer.style.top = '0';
        pointer.style.width = '3px';
        pointer.style.height = '100%';
        pointer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        pointer.style.transform = 'translateX(-50%)';
        pointer.style.boxShadow = '0 0 6px rgba(255, 255, 255, 0.6), 0 0 12px ' + (e.color || 'rgba(139, 0, 0, 0.8)');
        pointer.style.zIndex = '5';
        bar.appendChild(pointer);
        bar._pointerIndicator = pointer;

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
        wrapper._pointerEl = bar;
        wrapper._valueEl = value;
        wrapper._type = 'bar-pointer';
        return wrapper;
    }

    function createDigitalElement(e) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-marker digital-marker';
        wrapper.dataset.id = e.id;
        wrapper.style.left = (e.pos && e.pos.x != null ? e.pos.x : 50) + '%';
        wrapper.style.top = (e.pos && e.pos.y != null ? e.pos.y : 50) + '%';
        const scale = (e.sizeScale || 100) / 100;
        const widthPx = (e.widthPx || 140) * scale;
        const heightPx = (e.heightPx || 48) * scale;
        wrapper.style.width = widthPx + 'px';
        wrapper.style.height = heightPx + 'px';

        const box = document.createElement('div');
        box.style.width = '100%';
        box.style.height = '100%';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.justifyContent = 'center';
        box.style.alignItems = 'center';
        box.style.background = 'linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.6))';
        box.style.border = '2px solid rgba(255,255,255,0.06)';
        box.style.borderRadius = '6px';
        box.style.boxShadow = 'inset 0 -6px 18px rgba(0,0,0,0.6), 0 6px 18px rgba(0,0,0,0.6)';
        box.style.padding = '6px 10px';

        const title = document.createElement('div');
        title.textContent = e.label || e.id;
        title.style.fontSize = '11px';
        title.style.color = 'var(--text-light)';
        title.style.alignSelf = 'stretch';
        title.style.textAlign = 'left';
        title.style.marginBottom = '4px';

        const val = document.createElement('div');
        val.className = 'digital-value';
        val.style.fontFamily = 'monospace, monospace';
        val.style.fontSize = '22px';
        val.style.letterSpacing = '1px';
        val.style.color = e.color || '#00ff88';
        val.style.fontWeight = '700';
        val.style.textShadow = '0 2px 8px rgba(0,0,0,0.6)';
        const unit = e.unit ? ` ${e.unit}` : '';
        val.textContent = (e.value !== undefined ? (e.value).toFixed(1) : '-') + unit;

        box.appendChild(title);
        box.appendChild(val);
        wrapper.appendChild(box);

        wrapper._digitEl = val;
        wrapper._type = 'digital';
        wrapper._displayUnit = unit;
        wrapper._currentValue = e.value || 0;
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
        textDiv.style.padding = '10px 14px';
        textDiv.style.borderRadius = '8px';
        textDiv.style.whiteSpace = 'nowrap';
        textDiv.style.border = '2px solid';
        textDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

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
        textDiv.style.color = activeCondition ? (activeCondition.textColor || '#ffffff') : (e.defaultTextColor || '#ffffff');
        textDiv.style.background = activeCondition ? (activeCondition.backgroundColor || 'rgba(255,0,0,0.3)') : (e.defaultBackgroundColor || 'rgba(0,0,0,0.2)');
        textDiv.style.borderColor = activeCondition ? (activeCondition.borderColor || 'rgba(255,0,0,0.5)') : (e.defaultBorderColor || 'rgba(0,0,0,0.3)');

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
                    console.log(`[Button] Enviando comando (press_only): ${buttonConfig.commandPress}`);
                    try {
                        await window.ecuCommunication.sendCommand(buttonConfig.commandPress);
                    } catch (err) {
                        console.error(`[Button] Erro ao enviar: ${err.message}`);
                    }
                }
            }

            // Modo value: enviar valores ao apertar
            if (buttonConfig.mode === 'value' && buttonConfig.valuePressCommand) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    console.log(`[Button] Enviando comando (value press): ${buttonConfig.valuePressCommand}`);
                    try {
                        await window.ecuCommunication.sendCommand(buttonConfig.valuePressCommand);
                    } catch (err) {
                        console.error(`[Button] Erro ao enviar: ${err.message}`);
                    }
                }
            }

            // Modo stateful_value: um comando que envia valores diferentes (apertar vs soltar)
            if (buttonConfig.mode === 'stateful_value' && buttonConfig.command && buttonConfig.valuePress !== undefined) {
                wrapper._isActive = true;
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    const cmdWithValue = buttonConfig.command + '=' + buttonConfig.valuePress;
                    console.log(`[Button] Enviando comando (stateful_value press): ${cmdWithValue}`);
                    try {
                        await window.ecuCommunication.sendCommand(buttonConfig.command, buttonConfig.valuePress);
                    } catch (err) {
                        console.error(`[Button] Erro ao enviar: ${err.message}`);
                    }
                }
                updateStatefulButton();
            }

            // Modo press_release: comando ao apertar
            if (buttonConfig.mode === 'press_release' && buttonConfig.commandPress) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    console.log(`[Button] Enviando comando (press_release press): ${buttonConfig.commandPress}`);
                    try {
                        await window.ecuCommunication.sendCommand(buttonConfig.commandPress);
                    } catch (err) {
                        console.error(`[Button] Erro ao enviar: ${err.message}`);
                    }
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
                            console.log(`[Button] Enviando toggle: ${cmdWithValue}`);
                            try {
                                await window.ecuCommunication.sendCommand(buttonConfig.command, valueToSend);
                            } catch (err) {
                                console.error(`[Button] Erro no toggle: ${err.message}`);
                            }
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

        button.addEventListener('pointerup', async (ev) => {
            ev.preventDefault();
            button.style.transform = 'scale(1)';
            button.style.boxShadow = `0 4px 12px rgba(0,0,0,0.3)`;

            // Modo press_release: comando ao soltar
            if (buttonConfig.mode === 'press_release' && buttonConfig.commandRelease) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    console.log(`[Button] Enviando comando (press_release release): ${buttonConfig.commandRelease}`);
                    try {
                        await window.ecuCommunication.sendCommand(buttonConfig.commandRelease);
                    } catch (err) {
                        console.error(`[Button] Erro ao enviar: ${err.message}`);
                    }
                }
            }

            // Modo value: enviar valor ao soltar
            if (buttonConfig.mode === 'value' && buttonConfig.valueReleaseCommand) {
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    console.log(`[Button] Enviando comando (value release): ${buttonConfig.valueReleaseCommand}`);
                    try {
                        await window.ecuCommunication.sendCommand(buttonConfig.valueReleaseCommand);
                    } catch (err) {
                        console.error(`[Button] Erro ao enviar: ${err.message}`);
                    }
                }
            }

            // Modo stateful_value: enviar valor de soltar
            if (buttonConfig.mode === 'stateful_value' && buttonConfig.command && buttonConfig.valueRelease !== undefined) {
                wrapper._isActive = false;
                if (window.ecuCommunication && window.ecuCommunication.sendCommand) {
                    const cmdWithValue = buttonConfig.command + '=' + buttonConfig.valueRelease;
                    console.log(`[Button] Enviando comando (stateful_value release): ${cmdWithValue}`);
                    try {
                        await window.ecuCommunication.sendCommand(buttonConfig.command, buttonConfig.valueRelease);
                    } catch (err) {
                        console.error(`[Button] Erro ao enviar: ${err.message}`);
                    }
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
        if (e.type === 'digital') return createDigitalElement(e);
        if (e.type === 'bar-marker') return createBarMarkerElement(e);
        if (e.type === 'bar-pointer') return createBarPointerElement(e);
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

            // Atualizar zona de perigo (se existir)
            if (el._dangerPath && e.dangerZone && e.min != null && e.max != null) {
                try {
                    const dangerStart = ((e.dangerZone.start - e.min) / (e.max - e.min)) * 270 - 135;
                    const dangerEnd = ((e.dangerZone.end - e.min) / (e.max - e.min)) * 270 - 135;
                    const dangerRadius = radius - 3;
                    const dangerStartX = center + dangerRadius * Math.cos(dangerStart * Math.PI / 180);
                    const dangerStartY = center + dangerRadius * Math.sin(dangerStart * Math.PI / 180);
                    const dangerEndX = center + dangerRadius * Math.cos(dangerEnd * Math.PI / 180);
                    const dangerEndY = center + dangerRadius * Math.sin(dangerEnd * Math.PI / 180);
                    const dangerLargeArc = Math.abs(dangerEnd - dangerStart) > 180 ? 1 : 0;
                    el._dangerPath.setAttribute('d', `M ${dangerStartX} ${dangerStartY} A ${dangerRadius} ${dangerRadius} 0 ${dangerLargeArc} 1 ${dangerEndX} ${dangerEndY}`);
                    el._dangerPath.setAttribute('stroke', e.dangerZone.color || '#FF4444');
                    el._dangerPath.style.filter = `drop-shadow(0 0 4px ${e.dangerZone.color || 'rgba(255, 68, 68, 0.8)'})`;
                } catch (err) {}
            }

            // Atualizar zona de warning (se existir)
            if (el._warningPath && e.warningZone && e.min != null && e.max != null) {
                try {
                    const warningStart = ((e.warningZone.start - e.min) / (e.max - e.min)) * 270 - 135;
                    const warningEnd = ((e.warningZone.end - e.min) / (e.max - e.min)) * 270 - 135;
                    const warningRadius = radius - 6;
                    const warnStartX = center + warningRadius * Math.cos(warningStart * Math.PI / 180);
                    const warnStartY = center + warningRadius * Math.sin(warningStart * Math.PI / 180);
                    const warnEndX = center + warningRadius * Math.cos(warningEnd * Math.PI / 180);
                    const warnEndY = center + warningRadius * Math.sin(warningEnd * Math.PI / 180);
                    const warnArc = Math.abs(warningEnd - warningStart) > 180 ? 1 : 0;
                    el._warningPath.setAttribute('d', `M ${warnStartX} ${warnStartY} A ${warningRadius} ${warningRadius} 0 ${warnArc} 1 ${warnEndX} ${warnEndY}`);
                    el._warningPath.setAttribute('stroke', e.warningZone.color || '#FFD54F');
                    el._warningPath.style.filter = `drop-shadow(0 0 3px ${e.warningZone.color || 'rgba(255, 213, 79, 0.8)'})`;
                } catch (err) {}
            }
            
            // Atualizar valor com divisor
            if (el._valueEl) {
                const divisor = el._valueDivisor || 1;
                el._valueEl.textContent = (newValue / divisor).toFixed(1);
            }
        } else if (el._type === 'bar' && el._fillEl) {
            const min = (e.min != null ? e.min : 0);
            const max = (e.max != null ? e.max : 1);
            const pct = ((newValue - min) / (max - min)) * 100;
            const clampedPct = Math.max(0, Math.min(100, pct));
            el._fillEl.style.width = clampedPct + '%';
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1) + (e.unit ? ` ${e.unit}` : '');

            // update gradient colors if provided
            try {
                const cold = el._coldColor || '#2ea8ff';
                const hot = el._hotColor || (e.color || '#ff6b6b');
                el._fillEl.style.background = `linear-gradient(to right, ${cold}, ${hot})`;
            } catch (err) {}

            // thickness mode: increase bar height as value increases
            if (el._mode === 'thickness' && el._barEl) {
                const baseH = 8; // px
                const maxH = 40; // px
                const newH = Math.round(baseH + (clampedPct / 100) * (maxH - baseH));
                el._barEl.style.height = newH + 'px';
            }
        } else if (el._type === 'bar-marker' && el._fillEl) {
            const pct = ((newValue - e.min) / (e.max - e.min)) * 100;
            el._fillEl.style.width = pct + '%';
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1) + ' / ' + e.max.toFixed(1) + (e.unit ? ` ${e.unit}` : '');
            
            // Atualizar posição do marcador se existir
            if (el._fillEl._markerIndicator && e.markerValue !== undefined) {
                const markerPercent = Math.max(0, Math.min(100, ((e.markerValue - e.min) / (e.max - e.min)) * 100));
                el._fillEl._markerIndicator.style.left = markerPercent + '%';
            }
        } else if (el._type === 'bar-pointer' && el._fillEl) {
            const pct = ((newValue - e.min) / (e.max - e.min)) * 100;
            const clampedPct = Math.max(0, Math.min(100, pct));
            el._fillEl.style.width = clampedPct + '%';
            if (el._valueEl) el._valueEl.textContent = newValue.toFixed(1) + ' / ' + e.max.toFixed(1) + (e.unit ? ` ${e.unit}` : '');
            
            // Atualizar posição do ponteiro vertical (se existir)
            if (el._pointerEl && el._pointerEl._pointerIndicator) {
                el._pointerEl._pointerIndicator.style.left = clampedPct + '%';
            }
        } else if (el._type === 'led' && el._ledEl) {
            const isActive = newValue >= e.threshold;
            const ledColor = isActive ? (e.color || '#00FF00') : (e.colorOff || '#333');
            el._ledEl.style.background = `radial-gradient(circle at 30% 30%, ${isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.05)'}, ${ledColor})`;
            el._ledEl.style.border = isActive ? `2px solid ${e.color || '#00FF00'}` : '2px solid #555';
            el._ledEl.style.boxShadow = isActive ? `0 0 15px ${e.color || '#00FF00'}, inset 0 0 10px rgba(255,255,255,0.1)` : 'inset 0 2px 4px rgba(0,0,0,0.4)';
            
            // Aplicar/remover animação de blink
            if (e.blink && isActive) {
                el._ledEl.classList.add('led-blinking');
            } else {
                el._ledEl.classList.remove('led-blinking');
            }
            
            // Atualizar ícone se existir
            const iconEl = el._ledEl.querySelector('i');
            if (iconEl && e.icon) {
                iconEl.style.color = isActive ? 'white' : '#999';
                iconEl.style.textShadow = isActive ? `0 0 6px ${e.color || '#00FF00'}` : 'none';
            }
        } else if (el._type === 'conditional-text' && el._textEl) {
            // Atualizar conditional-text quando valor muda
            if (e.conditions && Array.isArray(e.conditions)) {
                let activeCondition = e.conditions[0];
                for (let cond of e.conditions) {
                    if (eval(`${newValue} ${cond.operator} ${cond.threshold}`)) {
                        activeCondition = cond;
                        break;
                    }
                }
                el._textEl.textContent = activeCondition ? activeCondition.text : (e.label || '');
                el._textEl.style.color = activeCondition ? (activeCondition.textColor || '#ffffff') : (e.defaultTextColor || '#ffffff');
                el._textEl.style.background = activeCondition ? (activeCondition.backgroundColor || 'rgba(255,0,0,0.3)') : (e.defaultBackgroundColor || 'rgba(0,0,0,0.2)');
                el._textEl.style.borderColor = activeCondition ? (activeCondition.borderColor || 'rgba(255,0,0,0.5)') : (e.defaultBorderColor || 'rgba(0,0,0,0.3)');
            }
        } else if (el._type === 'digital' && el._digitEl) {
            // animate numeric change
            const start = typeof el._currentValue === 'number' ? el._currentValue : parseFloat((el._digitEl.textContent || '0').replace(/[^0-9.\-]/g, '')) || 0;
            const end = Number(newValue);
            const duration = 400;
            const startTime = performance.now();
            el._currentValue = start;
            function step(now) {
                const t = Math.min(1, (now - startTime) / duration);
                // easeOutQuad
                const eased = t * (2 - t);
                const val = start + (end - start) * eased;
                el._digitEl.textContent = val.toFixed(1) + (el._displayUnit || '');
                if (t < 1) requestAnimationFrame(step);
                else el._currentValue = end;
            }
            requestAnimationFrame(step);
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

    // Helper para acessar CommonInfo (definido ANTES de renderViewMode)
    function getCommonValue(fieldId) {
        try {
            if (!fieldId) return undefined;
            if (window.CommonInfo && typeof window.CommonInfo.getValue === 'function') {
                return window.CommonInfo.getValue(fieldId);
            }
        } catch (err) { /* ignore */ }
        return undefined;
    }

    function renderViewMode(targetContainer = container) {
        if (!targetContainer) return;
        targetContainer.innerHTML = '';
        targetContainer.style.position = 'relative';
        targetContainer.style.width = '100%';
        targetContainer.style.height = '100%';
        // create or reuse dashboard-stage inside the container
        let stage = targetContainer.querySelector('.dashboard-stage');
        if (!stage) {
            stage = document.createElement('div');
            stage.className = 'dashboard-stage';
            // allow override of design dimensions per container
            if (targetContainer.dataset && targetContainer.dataset.designWidth) {
                stage.dataset.designWidth = targetContainer.dataset.designWidth;
                stage.style.setProperty('--dashboard-design-width', targetContainer.dataset.designWidth);
            }
            if (targetContainer.dataset && targetContainer.dataset.designHeight) {
                stage.dataset.designHeight = targetContainer.dataset.designHeight;
                stage.style.setProperty('--dashboard-design-height', targetContainer.dataset.designHeight);
            }
            targetContainer.appendChild(stage);
        } else {
            stage.innerHTML = '';
        }
        
        elements.forEach(e => {
            // Alimentar com dados do CommonInfo se fieldId ou sourceElementId estiver configurado
            let elementWithData = e;
            // If element is bound to another element (source), prefer that source
            if (e.sourceElementId) {
                const src = elements.find(s => s.id === e.sourceElementId);
                if (src) {
                    elementWithData = JSON.parse(JSON.stringify(e));
                    // If source has a fieldId, prefer realtime CommonInfo value
                    if (src.fieldId) {
                        const sVal = getCommonValue(src.fieldId);
                        if (sVal != null) elementWithData.value = sVal != null ? sVal : (src.value || e.value);
                    } else {
                        elementWithData.value = src.value !== undefined ? src.value : e.value;
                    }
                    // inherit unit and range from source when not defined
                    if (!elementWithData.unit && src.unit) elementWithData.unit = src.unit;
                    if ((elementWithData.min == null) && (src.min != null)) elementWithData.min = src.min;
                    if ((elementWithData.max == null) && (src.max != null)) elementWithData.max = src.max;
                }
            } else if (e.fieldId) {
                const fval = getCommonValue(e.fieldId);
                if (fval != null) {
                    elementWithData = JSON.parse(JSON.stringify(e));
                    elementWithData.value = fval != null ? fval : e.value;
                    if (!e.label && window.CommonInfo && window.CommonInfo.data && window.CommonInfo.data[e.fieldId]) elementWithData.label = window.CommonInfo.data[e.fieldId].title;
                    if (!e.unit && window.CommonInfo && window.CommonInfo.data && window.CommonInfo.data[e.fieldId]) elementWithData.unit = window.CommonInfo.data[e.fieldId].unit;
                }
            }

            const el = createElement(elementWithData);
            // sanitize inner element so it fits the wrapper
            try {
                el.style.removeProperty('left');
                el.style.removeProperty('top');
                el.style.removeProperty('transform');
                el.style.position = 'relative';
                el.style.width = '100%';
                el.style.height = '100%';
            } catch (err) {}

            // create a dashboard-item wrapper to control percent-based pos/size
            const item = document.createElement('div');
            item.className = 'dashboard-item';
            // compute base size percent depending on type
            let baseW = 10; // percent of design width
            let baseH = 10; // percent of design height
            if (elementWithData.type === 'gauge') { baseW = 12; baseH = 12; }
            else if (elementWithData.type === 'bar' || elementWithData.type === 'bar-marker' || elementWithData.type === 'bar-pointer') { baseW = 28; baseH = 10; }
            else if (elementWithData.type === 'led') { baseW = 6; baseH = 8; }
            else if (elementWithData.type === 'text' || elementWithData.type === 'conditional-text') { baseW = 12; baseH = 6; }

            const sizeScale = (elementWithData.sizeScale || 100) / 100;
            const wPercent = Math.max(1, baseW * sizeScale);
            const hPercent = Math.max(1, baseH * sizeScale);

            // set custom properties on wrapper
            item.style.setProperty('--x', (elementWithData.pos && elementWithData.pos.x != null) ? elementWithData.pos.x : 50);
            item.style.setProperty('--y', (elementWithData.pos && elementWithData.pos.y != null) ? elementWithData.pos.y : 50);
            item.style.setProperty('--w', wPercent);
            item.style.setProperty('--h', hPercent);

            // append original element as content
            item.appendChild(el);
            stage.appendChild(item);
            // In view mode we must ensure widgets never escape the modal bounds.
            // Positioning here computes px bounds and clamps left/top so the whole element stays inside (0%..100%).
            try {
                // positioning is delegated to the .dashboard-stage and --x/--y variables
                // no further px clamping required here because the stage scales and contains items.
                // but keep percent values bounded
                if (e.pos) {
                    e.pos.x = clampPercent(e.pos.x);
                    e.pos.y = clampPercent(e.pos.y);
                }
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
                let newValue = undefined;

                // If bound to another element, try to get source value
                if (e.sourceElementId) {
                    const src = elements.find(s => s.id === e.sourceElementId);
                    if (src) {
                        // Try to get value from source's fieldId
                        if (src.fieldId) {
                            newValue = getCommonValue(src.fieldId);
                        } else {
                            // Use source's direct value
                            newValue = src.value;
                        }
                    }
                }

                // Otherwise, if bound to CommonInfo directly
                if (newValue == null && e.fieldId) {
                    newValue = getCommonValue(e.fieldId);

                }

                if (newValue !== undefined && newValue !== e.value) {
                    const el = container.querySelector(`[data-id="${e.id}"]`);
                    if (el) {
                        updateElement(el, newValue);
                    }
                }
            });
        }
    }

    // Atualizar a cada 100ms
    setInterval(updateFromCommonInfo, 100);

    // Se CommonInfo expõe onUpdate, inscrever para atualizações imediatas sem sobrepor callbacks anteriores
    try {
        if (window.CommonInfo && typeof window.CommonInfo.onUpdate === 'function') {
            const prev = window.CommonInfo.onDataReceived;
            window.CommonInfo.onUpdate((data) => {
                try { updateFromCommonInfo(); } catch (err) {}
                if (typeof prev === 'function') {
                    try { prev(data); } catch (err) { console.error(err); }
                }
            });
        }
    } catch (err) {}

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

        // create a dashboard-stage inside the preview canvas to keep same coordinate system
        let editStage = canvas.querySelector('.dashboard-stage');
        if (!editStage) {
            editStage = document.createElement('div');
            editStage.className = 'dashboard-stage';
            // set design size same as default or as provided by canvasContainer
            editStage.dataset.designWidth = canvasContainer.dataset.designWidth || '500';
            editStage.dataset.designHeight = canvasContainer.dataset.designHeight || '500';
            canvas.appendChild(editStage);
        } else {
            editStage.innerHTML = '';
        }

        // helper: compute base percent sizes per type (same logic as used when creating previews)
        function computeBaseSizeForType(type) {
            let baseW = 10, baseH = 10;
            if (type === 'gauge') { baseW = 12; baseH = 12; }
            else if (type === 'bar' || type === 'bar-marker') { baseW = 28; baseH = 10; }
            else if (type === 'led') { baseW = 6; baseH = 8; }
            else if (type === 'text' || type === 'conditional-text') { baseW = 12; baseH = 6; }
            else if (type === 'digital') { baseW = 12; baseH = 6; }
            return { baseW, baseH };
        }

        // helper: update preview appearance for a single element index without full re-render
        function updatePreviewForElement(idx) {
            try {
                const e = elements[idx];
                const preview = editStage.querySelector(`.dashboard-item[data-idx="${idx}"]`);
                if (!preview) return;

                // recompute base sizes
                const { baseW, baseH } = computeBaseSizeForType(e.type);
                const sizeScale = (e.sizeScale || 100) / 100;
                const wPercent = Math.max(1, baseW * sizeScale);
                const hPercent = Math.max(1, baseH * sizeScale);
                preview.style.setProperty('--w', wPercent);
                preview.style.setProperty('--h', hPercent);

                // update position
                if (e.pos) {
                    preview.style.setProperty('--x', clampPercent(e.pos.x));
                    preview.style.setProperty('--y', clampPercent(e.pos.y));
                }

                // update inner elements depending on type
                const inner = preview.querySelector('[data-id]') || preview.firstElementChild;

                // compute displayed value for this preview taking into account CommonInfo or source element
                let displayValue = e.value;
                try {
                    const gval = e.fieldId ? getCommonValue(e.fieldId) : undefined;
                    if (gval != null) {
                        displayValue = gval;
                    } else if (e.sourceElementId) {
                        const src = elements.find(s => s.id === e.sourceElementId);
                        if (src) {
                            const sVal = src.fieldId ? getCommonValue(src.fieldId) : undefined;
                            if (sVal != null) {
                                displayValue = sVal;
                            } else {
                                displayValue = src.value !== undefined ? src.value : displayValue;
                            }
                        }
                    }
                } catch (err) { /* ignore */ }
                // For gauge rotation, update wrapper transform or inner as needed
                if (e.type === 'gauge') {
                    if (e.gaugeRotation != null) {
                        // apply rotate on preview wrapper (preserve translate) and set pivot to center
                        preview.style.transformOrigin = '50% 50%';
                        preview.style.transform = `translate(-50%, -50%) rotate(${e.gaugeRotation}deg)`;
                    } else {
                        preview.style.transform = 'translate(-50%, -50%)';
                    }
                    // Update displayed value if exists
                    const valEl = preview.querySelector('.marker-value');
                    if (valEl) valEl.textContent = ((displayValue != null ? displayValue : 0) / (e.valueDivisor || 1)).toFixed(1);

                    // update danger / warning arcs (if present on this preview element)
                    try {
                        const innerEl = preview.querySelector('[data-id]') || preview.firstElementChild;
                        if (innerEl && innerEl._dangerPath && e.dangerZone && e.min != null && e.max != null) {
                            const dangerStart = ((e.dangerZone.start - e.min) / (e.max - e.min)) * 270 - 135;
                            const dangerEnd = ((e.dangerZone.end - e.min) / (e.max - e.min)) * 270 - 135;
                            const dangerRadius = (120 / 2 - 15) - 3;
                            const center = 120 / 2;
                            const dStartX = center + dangerRadius * Math.cos(dangerStart * Math.PI / 180);
                            const dStartY = center + dangerRadius * Math.sin(dangerStart * Math.PI / 180);
                            const dEndX = center + dangerRadius * Math.cos(dangerEnd * Math.PI / 180);
                            const dEndY = center + dangerRadius * Math.sin(dangerEnd * Math.PI / 180);
                            const largeArc = Math.abs(dangerEnd - dangerStart) > 180 ? 1 : 0;
                            innerEl._dangerPath.setAttribute('d', `M ${dStartX} ${dStartY} A ${dangerRadius} ${dangerRadius} 0 ${largeArc} 1 ${dEndX} ${dEndY}`);
                            innerEl._dangerPath.setAttribute('stroke', e.dangerZone.color || '#FF4444');
                        }

                        if (innerEl && innerEl._warningPath && e.warningZone && e.min != null && e.max != null) {
                            const warningStart = ((e.warningZone.start - e.min) / (e.max - e.min)) * 270 - 135;
                            const warningEnd = ((e.warningZone.end - e.min) / (e.max - e.min)) * 270 - 135;
                            const warningRadius = (120 / 2 - 15) - 6;
                            const center = 120 / 2;
                            const wStartX = center + warningRadius * Math.cos(warningStart * Math.PI / 180);
                            const wStartY = center + warningRadius * Math.sin(warningStart * Math.PI / 180);
                            const wEndX = center + warningRadius * Math.cos(warningEnd * Math.PI / 180);
                            const wEndY = center + warningRadius * Math.sin(warningEnd * Math.PI / 180);
                            const warnArc = Math.abs(warningEnd - warningStart) > 180 ? 1 : 0;
                            innerEl._warningPath.setAttribute('d', `M ${wStartX} ${wStartY} A ${warningRadius} ${warningRadius} 0 ${warnArc} 1 ${wEndX} ${wEndY}`);
                            innerEl._warningPath.setAttribute('stroke', e.warningZone.color || '#FFD54F');
                        }
                    } catch (err) {
                        // ignore preview arc updates
                    }
                }

                if (e.type === 'bar' || e.type === 'bar-marker') {
                    const fill = preview.querySelector('div[style*="width"]') || preview.querySelector('div');
                    // find fill element by stored ref or by class
                    const fillEl = preview._fillEl || preview.querySelector('[style*="linear-gradient"]') || preview.querySelector('div > div > div');
                    if (fillEl) {
                        const min = (e.min != null ? e.min : 0);
                        const max = (e.max != null ? e.max : 1);
                        const useVal = (displayValue != null ? displayValue : (e.value != null ? e.value : 0));
                        const pct = ((useVal - min) / (max - min)) * 100;
                        const clamped = Math.max(0, Math.min(100, pct));
                        fillEl.style.width = clamped + '%';
                        // update gradient colors
                        try { fillEl.style.background = `linear-gradient(to right, ${e.coldColor || '#2ea8ff'}, ${e.hotColor || e.color || '#ff6b6b'})`; } catch (err) {}
                    }
                    // update value text
                    const valNode = preview.querySelector('[style*="fontWeight: 700"]') || preview.querySelector('div');
                    if (valNode && preview._valueEl) preview._valueEl.textContent = (displayValue != null ? Number(displayValue).toFixed(1) : '') + (e.unit ? ` ${e.unit}` : '');
                }

                if (e.type === 'led') {
                    const ledEl = preview.querySelector('div[style*="border-radius: 50%"]');
                    if (ledEl) {
                        const isOn = (displayValue != null ? displayValue : e.value) >= (e.threshold || 0);
                        const ledColor = isOn ? (e.color || '#00FF00') : (e.colorOff || '#333');
                        ledEl.style.background = `radial-gradient(circle at 30% 30%, ${isOn ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.05)'}, ${ledColor})`;
                        ledEl.style.border = isOn ? `2px solid ${e.color || '#00FF00'}` : '2px solid #555';
                    }
                }

                if (e.type === 'digital') {
                    const digit = preview.querySelector('.digital-value');
                    if (digit) digit.textContent = (displayValue != null ? Number(displayValue).toFixed(1) : '-') + (e.unit ? ` ${e.unit}` : '');
                }
            } catch (err) {
                console.error('updatePreviewForElement error', err);
            }
        }

        // Add element previews with drag
        elements.forEach((e, idx) => {
            // Alimentar o elemento com valor real do CommonInfo se disponível
            const elementCopy = JSON.parse(JSON.stringify(e)); // Deep copy
            
            // If bound to another element source, inherit its value/unit/range where possible
            if (elementCopy.sourceElementId) {
                const src = elements.find(s => s.id === elementCopy.sourceElementId);
                if (src) {
                    if (src.fieldId) {
                        const sFieldVal = getCommonValue(src.fieldId);
                        if (sFieldVal != null) elementCopy.value = sFieldVal != null ? sFieldVal : (src.value || elementCopy.value);
                        else elementCopy.value = src.value !== undefined ? src.value : elementCopy.value;
                    } else {
                        elementCopy.value = src.value !== undefined ? src.value : elementCopy.value;
                    }
                    if (!elementCopy.unit && src.unit) elementCopy.unit = src.unit;
                    if ((elementCopy.min == null) && (src.min != null)) elementCopy.min = src.min;
                    if ((elementCopy.max == null) && (src.max != null)) elementCopy.max = src.max;
                }
            } else if (elementCopy.fieldId) {
                const fval = getCommonValue(elementCopy.fieldId);
                if (fval != null) {
                    elementCopy.value = fval != null ? fval : elementCopy.value;
                    if (!elementCopy.label && window.CommonInfo && window.CommonInfo.data && window.CommonInfo.data[elementCopy.fieldId]) elementCopy.label = window.CommonInfo.data[elementCopy.fieldId].title;
                    if (!elementCopy.unit && window.CommonInfo && window.CommonInfo.data && window.CommonInfo.data[elementCopy.fieldId]) elementCopy.unit = window.CommonInfo.data[elementCopy.fieldId].unit;
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

            const inner = realElement;
            // sanitize inner element
            try {
                inner.style.removeProperty('left');
                inner.style.removeProperty('top');
                inner.style.removeProperty('transform');
                inner.style.position = 'relative';
                inner.style.width = '100%';
                inner.style.height = '100%';
            } catch (err) {}

            const preview = document.createElement('div');
            preview.className = 'dashboard-item edit-draggable';
            preview.dataset.id = e.id;
            preview.dataset.idx = idx;
            // compute base size
            let baseW = 10, baseH = 10;
            if (e.type === 'gauge') { baseW = 12; baseH = 12; }
            else if (e.type === 'bar' || e.type === 'bar-marker' || e.type === 'bar-pointer') { baseW = 28; baseH = 10; }
            else if (e.type === 'led') { baseW = 6; baseH = 8; }
            else if (e.type === 'text' || e.type === 'conditional-text') { baseW = 12; baseH = 6; }
            const sizeScale = (e.sizeScale || 100) / 100;
            preview.style.setProperty('--w', Math.max(1, baseW * sizeScale));
            preview.style.setProperty('--h', Math.max(1, baseH * sizeScale));
            preview.style.setProperty('--x', clampPercent(e.pos.x));
            preview.style.setProperty('--y', clampPercent(e.pos.y));
            preview.appendChild(inner);
            preview.style.cursor = 'grab';
            preview.style.userSelect = 'none';
            preview.style.zIndex = '10';
            preview.style.transformOrigin = '50% 50%';
            
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
                bounds = editStage.getBoundingClientRect();
                preview.style.cursor = 'grabbing';
                preview.style.zIndex = '1000';

                // Criar simulação do elemento (wrapper com mesmas props)
                const innerClone = createElement(e);
                try {
                    innerClone.style.removeProperty('left');
                    innerClone.style.removeProperty('top');
                    innerClone.style.removeProperty('transform');
                    innerClone.style.position = 'relative';
                    innerClone.style.width = '100%';
                    innerClone.style.height = '100%';
                } catch (err) {}
                previewClone = document.createElement('div');
                previewClone.className = 'dashboard-item preview-clone';
                const baseWc = (e.type === 'gauge') ? 18 : (e.type === 'bar' || e.type === 'bar-marker') ? 36 : (e.type === 'led') ? 8 : 20;
                const sizeScaleC = (e.sizeScale || 100) / 100;
                previewClone.style.setProperty('--w', Math.max(1, baseWc * sizeScaleC));
                previewClone.style.setProperty('--h', Math.max(1, (e.type === 'gauge' ? 18 : baseWc) * sizeScaleC));
                previewClone.style.setProperty('--x', e.pos.x || 50);
                previewClone.style.setProperty('--y', e.pos.y || 50);
                previewClone.style.pointerEvents = 'none';
                previewClone.style.opacity = '0.7';
                previewClone.style.transformOrigin = '50% 50%';
                previewClone.appendChild(innerClone);
                editStage.appendChild(previewClone);
            }

            function onPointerMove(ev) {
                if (!dragging || !previewClone) return;
                const dx = ev.clientX - start.x;
                const dy = ev.clientY - start.y;
                const centerRect = preview.getBoundingClientRect();
                const cx = centerRect.left + centerRect.width / 2 + dx;
                const cy = centerRect.top + centerRect.height / 2 + dy;

                const xClamped = Math.max(bounds.left + 2, Math.min(cx, bounds.right - 2));
                const yClamped = Math.max(bounds.top + 2, Math.min(cy, bounds.bottom - 2));

                const px = ((xClamped - bounds.left) / bounds.width) * 100;
                const py = ((yClamped - bounds.top) / bounds.height) * 100;

                // update wrapper custom props
                preview.style.setProperty('--x', px.toFixed(2));
                preview.style.setProperty('--y', py.toFixed(2));
                if (previewClone) {
                    previewClone.style.setProperty('--x', px.toFixed(2));
                    previewClone.style.setProperty('--y', py.toFixed(2));
                }

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

            // append preview into the editStage so it uses the same coordinate system
            try {
                editStage.appendChild(preview);
            } catch (err) {
                // fallback
                canvas.appendChild(preview);
            }

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
            title.textContent = e.id;
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

            // --- Build three-tab editor: Visual | Rótulos | Valores ---
            const tabsHeader = document.createElement('div');
            tabsHeader.style.display = 'flex';
            tabsHeader.style.gap = '6px';
            tabsHeader.style.marginBottom = '12px';

            const tabButtons = {};
            const makeTabBtn = (id, labelText, active = false) => {
                const btn = document.createElement('button');
                btn.textContent = labelText;
                btn.dataset.tab = id;
                btn.style.padding = '8px 10px';
                btn.style.border = '1px solid var(--border-color)';
                btn.style.borderRadius = '6px';
                btn.style.background = active ? 'linear-gradient(90deg,var(--primary-red),#8b0000)' : 'transparent';
                btn.style.color = active ? 'white' : 'var(--text-light)';
                btn.style.cursor = 'pointer';
                btn.style.fontWeight = '700';
                tabButtons[id] = btn;
                return btn;
            };

            const visualBtn = makeTabBtn('visual', 'Visual', true);
            const labelsBtn = makeTabBtn('labels', 'Rótulos');
            const valuesBtn = makeTabBtn('values', 'Valores');
            
            // Determinar nome da aba específica baseado no tipo
            const typeName = {
                'gauge': 'Gauge',
                'bar': 'Barra',
                'bar-marker': 'Marcador',
                'led': 'LED',
                'text': 'Texto',
                'conditional-text': 'Texto Condicional',
                'button': 'Botão',
                'digital': 'Digital'
            }[e.type] || 'Configurações';
            
            const configBtn = makeTabBtn('config', typeName);

            // Determinar quais abas devem estar disponíveis
            let hasConfigTab = true;
            if (e.type === 'button') {
                valuesBtn.style.opacity = '0.5';
                valuesBtn.style.cursor = 'not-allowed';
                valuesBtn.style.pointerEvents = 'none';
                valuesBtn.title = 'Botões não têm valor';
            }
            
            // Se não houver campos específicos de configuração, bloquear a aba
            let typeHasConfig = ['gauge', 'bar', 'bar-marker', 'led', 'text', 'conditional-text', 'button', 'digital'].includes(e.type);
            if (!typeHasConfig) hasConfigTab = false;
            
            if (!hasConfigTab) {
                configBtn.style.opacity = '0.5';
                configBtn.style.cursor = 'not-allowed';
                configBtn.style.pointerEvents = 'none';
                configBtn.title = 'Sem configurações específicas';
            }
            
            tabsHeader.appendChild(visualBtn);
            tabsHeader.appendChild(labelsBtn);
            tabsHeader.appendChild(valuesBtn);
            tabsHeader.appendChild(configBtn);
            leftBody.appendChild(tabsHeader);

            const tabArea = document.createElement('div');
            tabArea.style.minHeight = '160px';
            tabArea.style.marginBottom = '10px';
            leftBody.appendChild(tabArea);

            // create three panes and helper to switch
            const panes = {
                visual: document.createElement('div'),
                labels: document.createElement('div'),
                values: document.createElement('div'),
                config: document.createElement('div')
            };
            Object.values(panes).forEach(p => { p.style.display = 'none'; p.style.padding = '6px 0'; tabArea.appendChild(p); });
            panes.visual.style.display = 'block';

            function switchTo(tabId) {
                if (!hasConfigTab && tabId === 'config') return; // não permitir ir pra config se não tiver
                Object.keys(panes).forEach(k => panes[k].style.display = (k === tabId ? 'block' : 'none'));
                Object.keys(tabButtons).forEach(k => {
                    const b = tabButtons[k];
                    if (k === tabId) { b.style.background = 'linear-gradient(90deg,var(--primary-red),#8b0000)'; b.style.color = 'white'; }
                    else { b.style.background = 'transparent'; b.style.color = 'var(--text-light)'; }
                });
            }

            visualBtn.addEventListener('click', () => switchTo('visual'));
            labelsBtn.addEventListener('click', () => switchTo('labels'));
            valuesBtn.addEventListener('click', () => switchTo('values'));
            configBtn.addEventListener('click', () => switchTo('config'));

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
                { label: 'ID', key: 'id', type: 'text' },
                { label: 'Tipo', key: 'type', type: 'select', options: ['gauge', 'bar', 'bar-marker', 'bar-pointer', 'led', 'text', 'conditional-text', 'button', 'digital'] },
                { label: 'Cor', key: 'color', type: 'color' },
                { label: 'Tamanho (%)', key: 'sizeScale', type: 'range', min: '25', max: '444', step: '5' },
                { label: 'Ícone (Bootstrap)', key: 'icon', type: 'text', placeholder: 'Ex: speedometer, power, fuel-pump' },
                { label: '📡 Campo de Dados', key: 'fieldId', type: 'select', options: [], placeholder: 'Selecione um campo (opcional)' },
                { label: 'Fonte (Elemento)', key: 'sourceElementId', type: 'select', options: [], placeholder: 'Selecionar outro elemento como fonte (opcional)' }
            ];

            // Populer opções de fieldId do CommonInfo
            if (window.CommonInfo && window.CommonInfo.config && window.CommonInfo.config.dataFields) {
                const fieldOptions = window.CommonInfo.config.dataFields.map(f => ({
                    value: f.id,
                    label: `${f.title} (${f.id})`
                }));
                commonFields[5].options = fieldOptions; // fieldId is index 5
            }

            // populate sourceElement options from existing elements
            commonFields[6].options = elements.filter(s => true).map(s => ({ value: s.id, label: `${s.label || s.id} (${s.type})` }));

            const gaugeBarFields = [
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Divisor de Valor', key: 'valueDivisor', type: 'number', step: '1' },
                { label: 'Rótulo (Label)', key: 'label', type: 'text', placeholder: 'Ex: Temperatura, RPM' },
                { label: 'Unidade', key: 'unit', type: 'text', placeholder: 'Ex: °C, km/h, bar' },
                { label: 'Rotação do Gauge (°)', key: 'gaugeRotation', type: 'range', min: '0', max: '360', step: '5' },
                { label: 'Zona Perigo - Inicial', key: 'dangerStart', type: 'number', placeholder: 'Deixe vazio sem perigo' },
                { label: 'Zona Perigo - Final', key: 'dangerEnd', type: 'number' },
                { label: 'Zona Perigo - Cor', key: 'dangerColor', type: 'color' },
                { label: 'Zona Warning - Inicial', key: 'warningStart', type: 'number', placeholder: 'Faixa amarela - início (opcional)' },
                { label: 'Zona Warning - Final', key: 'warningEnd', type: 'number', placeholder: 'Faixa amarela - fim (opcional)' },
                { label: 'Zona Warning - Cor', key: 'warningColor', type: 'color' }
            ];

            const barFields = [
                { label: 'Modo da Barra', key: 'mode', type: 'select', options: ['fill', 'thickness'], placeholder: 'fill = padrão, thickness = engrossa conforme aumenta' },
                { label: 'Cor Fria (início)', key: 'coldColor', type: 'color' },
                { label: 'Cor Quente (fim)', key: 'hotColor', type: 'color' }
            ];

            const digitalFields = [
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Unidade', key: 'unit', type: 'text' },
                { label: 'Cor do Texto', key: 'color', type: 'color' }
            ];

            const barMarkerFields = [
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Valor Marcador', key: 'markerValue', type: 'number' },
                { label: 'Rótulo (Label)', key: 'label', type: 'text', placeholder: 'Ex: Pressão, Carga' },
                { label: 'Unidade', key: 'unit', type: 'text', placeholder: 'Ex: bar, %, psi' },
                { label: 'Cor Marcador', key: 'markerColor', type: 'color' }
            ];

            const barPointerFields = [
                { label: 'Mín', key: 'min', type: 'number' },
                { label: 'Máx', key: 'max', type: 'number' },
                { label: 'Rótulo (Label)', key: 'label', type: 'text', placeholder: 'Ex: Velocidade, Pressão' },
                { label: 'Unidade', key: 'unit', type: 'text', placeholder: 'Ex: km/h, bar, psi' }
            ];

            const ledFields = [
                { label: 'Rótulo (Label)', key: 'label', type: 'text', placeholder: 'Ex: Sensor, Alerta' },
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
                { label: 'Tamanho Fonte (px)', key: 'fontSize', type: 'number' },
                { label: 'Peso (400, 600, 700)', key: 'fontWeight', type: 'number' },
                { label: 'Cor do Texto Padrão', key: 'defaultTextColor', type: 'color' },
                { label: 'Cor de Fundo Padrão', key: 'defaultBackgroundColor', type: 'color' },
                { label: 'Cor da Orla Padrão', key: 'defaultBorderColor', type: 'color' }
            ];

            const buttonFields = [
                { label: 'Botão Pré-definido', key: 'buttonConfigId', type: 'select', options: [] },
                { label: 'Título Customizado', key: 'customLabel', type: 'text', placeholder: 'Deixe vazio para usar padrão' },
                { label: 'Ícone Customizado (OFF)', key: 'customIcon', type: 'text', placeholder: 'Ex: heart, star, etc (deixe vazio para padrão)' },
                { label: 'Cor Customizada (OFF)', key: 'customColor', type: 'select', options: ['red', 'green', 'blue', 'yellow', 'purple', 'orange'] },
                { label: 'Ícone Customizado (ON)', key: 'customIconOn', type: 'text', placeholder: 'Para estado ativo (stateful only)' },
                { label: 'Cor Customizada (ON)', key: 'customColorOn', type: 'select', options: ['red', 'green', 'blue', 'yellow', 'purple', 'orange'] },
                { label: 'Sincronizar com ECU', key: 'syncWithECU', type: 'checkbox', help: 'Carregar estado atual da ECU ao abrir dashboard' }
            ];

            let fieldsToShow = commonFields;
            
            if (e.type === 'gauge' || e.type === 'bar') {
                fieldsToShow = [...fieldsToShow, ...gaugeBarFields];
            }
            if (e.type === 'bar') {
                fieldsToShow = [...fieldsToShow, ...barFields];
            } else if (e.type === 'bar-marker') {
                fieldsToShow = [...fieldsToShow, ...barMarkerFields];
            } else if (e.type === 'bar-pointer') {
                fieldsToShow = [...fieldsToShow, ...barPointerFields];
            } else if (e.type === 'digital') {
                fieldsToShow = [...fieldsToShow, ...digitalFields];
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

            // Reference to any LED condition source-select so we can keep it sync'd
            // LED condition source has been removed — LED uses the central data source configured in the 'Valores' tab.

            // If both fieldId / sourceElementId are available in this element's fields, create a single
            // mutual-exclusive "Data Source" control in the Values tab so user picks one source only.
            const hasFieldPick = fieldsToShow.some(ff => ff.key === 'fieldId');
            const hasElementSource = fieldsToShow.some(ff => ff.key === 'sourceElementId');

            if (hasFieldPick || hasElementSource) {
                // create a compact source selector with three modes: Fixed | CommonInfo field | Element source
                const dsContainer = document.createElement('div');
                dsContainer.style.padding = '12px';
                dsContainer.style.border = '1px solid var(--border-color)';
                dsContainer.style.borderRadius = '6px';
                dsContainer.style.marginBottom = '12px';
                dsContainer.style.background = 'rgba(0,0,0,0.04)';

                const dsTitle = document.createElement('div');
                dsTitle.textContent = 'Fonte de dados (Valores)';
                dsTitle.style.fontWeight = '700';
                dsTitle.style.color = 'var(--light-red)';
                dsTitle.style.marginBottom = '8px';
                dsContainer.appendChild(dsTitle);

                const radioName = 'data_source_' + e.id + '_' + idx;
                // fixed value
                const fixedRow = document.createElement('div');
                fixedRow.style.display = 'flex';
                fixedRow.style.alignItems = 'center';
                fixedRow.style.gap = '8px';
                let rFixed = document.createElement('input'); rFixed.type = 'radio'; rFixed.name = radioName; rFixed.value = 'fixed';
                const lblFixed = document.createElement('label'); lblFixed.textContent = 'Valor fixo (usado diretamente)'; lblFixed.style.color = 'var(--text-light)';
                fixedRow.appendChild(rFixed); fixedRow.appendChild(lblFixed);
                dsContainer.appendChild(fixedRow);

                // Input para valor fixo (abaixo do radio button)
                const fixedValueContainer = document.createElement('div');
                fixedValueContainer.style.marginLeft = '24px';
                fixedValueContainer.style.marginTop = '6px';
                fixedValueContainer.style.marginBottom = '12px';
                const fixedValueInput = document.createElement('input');
                fixedValueInput.type = 'number';
                fixedValueInput.style.width = '100%';
                fixedValueInput.style.padding = '6px';
                fixedValueInput.style.borderRadius = '4px';
                fixedValueInput.style.background = 'var(--bg-dark)';
                fixedValueInput.style.color = 'var(--text-light)';
                fixedValueInput.style.border = '1px solid var(--border-color)';
                fixedValueInput.placeholder = 'Digite o valor fixo aqui';
                fixedValueInput.value = e.value !== undefined ? e.value : '';
                fixedValueContainer.appendChild(fixedValueInput);
                dsContainer.appendChild(fixedValueContainer);

                // commoninfo field
                const fieldRow = document.createElement('div');
                fieldRow.style.display = 'flex';
                fieldRow.style.alignItems = 'center';
                fieldRow.style.gap = '8px';
                let rField = document.createElement('input'); rField.type = 'radio'; rField.name = radioName; rField.value = 'field';
                const lblField = document.createElement('label'); lblField.textContent = 'Campo comum (CommonInfo)'; lblField.style.color = 'var(--text-light)';
                let fieldSelect = document.createElement('select');
                fieldSelect.style.marginLeft = '8px'; fieldSelect.style.padding = '6px'; fieldSelect.style.borderRadius = '4px';
                fieldSelect.style.background = 'var(--bg-dark)'; fieldSelect.style.color = 'var(--text-light)';
                // populate
                try {
                    if (window.CommonInfo && window.CommonInfo.config && window.CommonInfo.config.dataFields) {
                        const noneOpt = document.createElement('option'); noneOpt.value = ''; noneOpt.textContent = '--- selecione ---'; fieldSelect.appendChild(noneOpt);
                        window.CommonInfo.config.dataFields.forEach(ff => {
                            const o = document.createElement('option'); o.value = ff.id; o.textContent = `${ff.title} (${ff.id})`; o.selected = e.fieldId === ff.id; fieldSelect.appendChild(o);
                        });
                    } else if (commonFields[5] && commonFields[5].options && commonFields[5].options.length) {
                        const noneOpt = document.createElement('option'); noneOpt.value = ''; noneOpt.textContent = '--- selecione ---'; fieldSelect.appendChild(noneOpt);
                        commonFields[5].options.forEach(o => { const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.label; opt.selected = e.fieldId === o.value; fieldSelect.appendChild(opt); });
                    } else {
                        const p = document.createElement('option'); p.value = ''; p.textContent = '(nenhum campo CommonInfo disponível)'; fieldSelect.appendChild(p);
                    }
                } catch (err) {}

                fieldRow.appendChild(rField); fieldRow.appendChild(lblField); fieldRow.appendChild(fieldSelect);
                dsContainer.appendChild(fieldRow);

                // element source
                const elementRow = document.createElement('div');
                elementRow.style.display = 'flex'; elementRow.style.alignItems = 'center'; elementRow.style.gap = '8px';
                let rElement = document.createElement('input'); rElement.type = 'radio'; rElement.name = radioName; rElement.value = 'element';
                const lblElement = document.createElement('label'); lblElement.textContent = 'Outro elemento (usar valor de outro marcador)'; lblElement.style.color = 'var(--text-light)';
                let elementSelect = document.createElement('select'); elementSelect.style.marginLeft = '8px'; elementSelect.style.padding = '6px'; elementSelect.style.borderRadius = '4px'; elementSelect.style.background = 'var(--bg-dark)'; elementSelect.style.color = 'var(--text-light)';
                // populate with elements (exclude self and duplicates)
                const seen = new Set();
                const noneE = document.createElement('option'); noneE.value = ''; noneE.textContent = '--- selecione ---'; elementSelect.appendChild(noneE);
                elements.forEach((it) => { if (!it || !it.id) return; if (it.id === e.id) return; if (seen.has(it.id)) return; seen.add(it.id); const opt = document.createElement('option'); opt.value = it.id; opt.textContent = `${it.label || it.id} (${it.type})`; opt.selected = e.sourceElementId === it.id; elementSelect.appendChild(opt); });
                elementRow.appendChild(rElement); elementRow.appendChild(lblElement); elementRow.appendChild(elementSelect);
                dsContainer.appendChild(elementRow);

                // choose initial
                if (e.fieldId) rField.checked = true; else if (e.sourceElementId) rElement.checked = true; else rFixed.checked = true;

                // Event listener para o input de valor fixo
                fixedValueInput.addEventListener('change', () => {
                    elements[idx].value = fixedValueInput.value ? parseFloat(fixedValueInput.value) : undefined;
                    try { updatePreviewForElement(idx); } catch (err) {}
                });
                fixedValueInput.addEventListener('input', () => {
                    elements[idx].value = fixedValueInput.value ? parseFloat(fixedValueInput.value) : undefined;
                    try { updatePreviewForElement(idx); } catch (err) {}
                });

                // event handlers: switching modes
                // central helper to keep data-source state consistent across all controls
                function setDataSource(mode, value) {
                    if (!elements[idx]) return;
                    if (mode === 'fixed') {
                        elements[idx].fieldId = null;
                        elements[idx].sourceElementId = null;
                    } else if (mode === 'field') {
                        elements[idx].fieldId = value || null;
                        elements[idx].sourceElementId = null;
                    } else if (mode === 'element') {
                        elements[idx].sourceElementId = value || null;
                        elements[idx].fieldId = null;
                    }

                    // keep UI in sync if the controls are available
                    try {
                        if (rFixed) rFixed.checked = (mode === 'fixed');
                        if (rField) rField.checked = (mode === 'field');
                        if (rElement) rElement.checked = (mode === 'element');
                        if (fieldSelect) { fieldSelect.disabled = (mode !== 'field'); if (mode === 'field' && value) fieldSelect.value = value; }
                        if (elementSelect) { elementSelect.disabled = (mode !== 'element'); if (mode === 'element' && value) elementSelect.value = value; }
                        // LED condition source was removed from the editor — the Values tab is the single source of truth
                    } catch (err) {}

                    try { updatePreviewForElement(idx); } catch (err) {}
                }

                function applyMode(mode) {
                    if (mode === 'fixed') setDataSource('fixed', null);
                    else if (mode === 'field') setDataSource('field', fieldSelect?.value || null);
                    else if (mode === 'element') setDataSource('element', elementSelect?.value || null);
                }

                [rFixed, rField, rElement].forEach(r => r.addEventListener('change', () => setDataSource(r.value, (r.value === 'field' ? fieldSelect?.value : (r.value === 'element' ? elementSelect?.value : null)))));
                fieldSelect.addEventListener('change', () => { setDataSource('field', fieldSelect.value || null); });
                elementSelect.addEventListener('change', () => { setDataSource('element', elementSelect.value || null); });

                // disable selects initially depending on current mode
                if (rFixed.checked) { fieldSelect.disabled = true; elementSelect.disabled = true; }
                if (rField.checked) { fieldSelect.disabled = false; elementSelect.disabled = true; }
                if (rElement.checked) { fieldSelect.disabled = true; elementSelect.disabled = false; }

                // place the container into Values pane
                panes.values.insertBefore(dsContainer, panes.values.firstChild);

                // remove the simple rows for fieldId/sourceElementId from fieldsToShow processing so they don't duplicate
                fieldsToShow = fieldsToShow.filter(ff => ff.key !== 'fieldId' && ff.key !== 'sourceElementId');
            }

            fieldsToShow.forEach(f => {
                // Decide to which tab pane this field belongs
                const visualKeys = new Set(['color','sizeScale','icon','iconRotation','gaugeRotation','fontSize','fontWeight']);
                const valueKeys = new Set(['min','max','valueDivisor','mode','coldColor','hotColor','markerValue','markerColor','threshold','fieldId','sourceElementId']);
                const labelKeys = new Set(['id','label','unit','type']);
                const configKeys = new Set(['dangerStart','dangerEnd','dangerColor','warningStart','warningEnd','warningColor','text','customLabel','customIcon','customColor','customIconOn','customColorOn','buttonConfigId','blink','blinkRate','syncWithECU']);

                let targetPane = panes.labels; // default
                if (visualKeys.has(f.key)) targetPane = panes.visual;
                else if (valueKeys.has(f.key)) targetPane = panes.values;
                else if (configKeys.has(f.key)) targetPane = panes.config;
                else if (labelKeys.has(f.key)) targetPane = panes.labels;
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
                        const seenBtn = new Set();
                        dashboardButtonsConfig.forEach(btnConfig => {
                            if (seenBtn.has(btnConfig.id)) return;
                            seenBtn.add(btnConfig.id);
                            const optEl = document.createElement('option');
                            optEl.value = btnConfig.id;
                            optEl.textContent = btnConfig.title;
                            optEl.selected = e[f.key] === btnConfig.id;
                            inp.appendChild(optEl);
                        });
                    } else {
                        // Special-case: sourceElementId should not include the current element
                        if (f.key === 'sourceElementId') {
                            const noneOpt = document.createElement('option');
                            noneOpt.value = '';
                            noneOpt.textContent = '--- Nenhuma (opcional) ---';
                            noneOpt.selected = !e[f.key];
                            inp.appendChild(noneOpt);

                            const seen = new Set();
                            elements.forEach((it) => {
                                if (!it || !it.id) return;
                                if (it.id === e.id) return; // exclude itself
                                if (seen.has(it.id)) return;
                                seen.add(it.id);
                                const optEl = document.createElement('option');
                                optEl.value = it.id;
                                optEl.textContent = `${it.label || it.id} (${it.type})`;
                                optEl.selected = e[f.key] === it.id;
                                inp.appendChild(optEl);
                            });
                        } else {
                            // Opções regulares
                            const seen = new Set();
                            f.options.forEach(opt => {
                                const optEl = document.createElement('option');
                                // Se opt é um objeto, usar value e label
                                const value = typeof opt === 'string' ? opt : opt.value;
                                const label = typeof opt === 'string' ? opt : opt.label;
                                if (seen.has(value)) return;
                                seen.add(value);
                                optEl.value = value;
                                optEl.textContent = label;
                                optEl.selected = e[f.key] === value;
                                inp.appendChild(optEl);
                            });
                        }
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
                        // update value live for any range fields so preview reacts as user slides
                        elements[idx][f.key] = parseFloat(inp.value);
                        try { updatePreviewForElement(idx); } catch (err) {}
                    });

                    row.appendChild(lbl);
                    row.appendChild(inp);
                    row.appendChild(valueDisplay);
                    targetPane.appendChild(row);

                    inp.addEventListener('change', () => {
                        elements[idx][f.key] = parseFloat(inp.value);
                        try { updatePreviewForElement(idx); } catch (err) {}
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

                    // If editing the ID, ensure uniqueness and non-empty
                    if (f.key === 'id') {
                        const newId = String(v).trim();
                        if (!newId) {
                            alert('ID não pode ser vazio');
                            inp.value = elements[idx].id || ('elem_' + Date.now());
                            return;
                        }
                        const duplicate = elements.some((el, i2) => i2 !== idx && el.id === newId);
                        if (duplicate) {
                            alert('ID já existe. Use um ID único.');
                            inp.value = elements[idx].id || ('elem_' + Date.now());
                            return;
                        }
                        elements[idx].id = newId;
                        // Re-render editor to reflect ID change (and update option lists)
                        renderEditMode();
                        return;
                    }

                    // prevent using itself as a source (would create circular reference / confused config)
                    if (f.key === 'sourceElementId' && v === elements[idx].id) {
                        alert('Não é possível usar o mesmo elemento como fonte. Selecione outro.');
                        if (typeof setDataSource === 'function') setDataSource('element', null);
                        else elements[idx].sourceElementId = null;
                        showEditPanel(idx);
                        return;
                    }

                    // If this is a data source field and a centralized setter exists use it so sources remain exclusive
                    if ((f.key === 'fieldId' || f.key === 'sourceElementId') && typeof setDataSource === 'function') {
                        if (f.key === 'fieldId') setDataSource('field', v || null);
                        else setDataSource('element', v || null);
                    } else {
                        elements[idx][f.key] = v;
                    }
                    try { updatePreviewForElement(idx); } catch (err) {}

                    // If type changed, re-open the editor for this element so fields update to new type
                    if (f.key === 'type') {
                        // Re-render the edit panel to show type-specific controls
                        showEditPanel(idx);
                        return;
                    }
                    
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

                    // Montar warningZone (faixa amarela) se configurada
                    if (e.type === 'gauge' && (f.key === 'warningStart' || f.key === 'warningEnd' || f.key === 'warningColor')) {
                        if (elements[idx].warningStart != null && elements[idx].warningEnd != null) {
                            elements[idx].warningZone = {
                                start: elements[idx].warningStart,
                                end: elements[idx].warningEnd,
                                color: elements[idx].warningColor || '#FFD54F'
                            };
                        } else {
                            elements[idx].warningZone = null;
                        }
                    }
                });

                row.appendChild(lbl);
                row.appendChild(inp);
                targetPane.appendChild(row);

                // add immediate input -> live preview for text/number/color fields (but skip ID editing immediate update because of uniqueness checks)
                if (f.key !== 'id' && (f.type === 'number' || f.type === 'text' || f.type === 'color')) {
                    inp.addEventListener('input', () => {
                        let iv = inp.value;
                        if (f.type === 'number') iv = parseFloat(iv) || 0;
                        elements[idx][f.key] = iv;
                        try { updatePreviewForElement(idx); } catch (err) {}
                    });
                }

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
                    panes.visual.appendChild(iconPickerContainer);
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

                // Show read-only reminder: the LED uses the data-source configured in the Values tab above
                const sourceNote = document.createElement('div');
                sourceNote.style.fontSize = '12px';
                sourceNote.style.color = 'var(--text-light)';
                sourceNote.style.marginBottom = '8px';
                const currentSourceLabel = (() => {
                    if (e.fieldId) return `Campo CommonInfo: ${e.fieldId}`;
                    if (e.sourceElementId) {
                        const sElem = elements.find(x => x.id === e.sourceElementId);
                        return sElem ? `Outro elemento: ${sElem.label || sElem.id} (${sElem.type})` : `Outro elemento: ${e.sourceElementId}`;
                    }
                    return 'Valor fixo (usando valor do próprio elemento)';
                })();
                sourceNote.textContent = `Fonte de valor configurada: ${currentSourceLabel} — use a aba "Valores" para mudar a fonte.`;
                conditionSection.appendChild(sourceNote);

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

                // Append LED condition controls into the 'Valores' tab so value-mechanism lives together
                panes.values.appendChild(conditionSection);
            }

            // ===== SEÇÃO DE CONDIÇÕES PARA TEXTOS CONDICIONAIS =====
            if (e.type === 'conditional-text') {
                const condWrap = document.createElement('div');
                condWrap.style.padding = '12px';
                condWrap.style.border = '1px solid rgba(120,120,120,0.08)';
                condWrap.style.borderRadius = '6px';
                condWrap.style.marginBottom = '12px';

                const condTitle = document.createElement('div');
                condTitle.textContent = 'Condições (conditional-text)';
                condTitle.style.fontWeight = '700';
                condTitle.style.color = 'var(--light-red)';
                condTitle.style.marginBottom = '8px';
                condWrap.appendChild(condTitle);

                const list = document.createElement('div');
                list.style.display = 'flex';
                list.style.flexDirection = 'column';
                list.style.gap = '8px';

                function renderConditions() {
                    list.innerHTML = '';
                    const conds = Array.isArray(elements[idx].conditions) ? elements[idx].conditions : [];
                    conds.forEach((c, ci) => {
                        const row = document.createElement('div');
                        row.style.display = 'grid';
                        row.style.gridTemplateColumns = 'auto auto 1fr auto auto auto auto auto';
                        row.style.gap = '6px';
                        row.style.alignItems = 'center';
                        row.style.padding = '8px';
                        row.style.background = 'rgba(0,0,0,0.1)';
                        row.style.borderRadius = '4px';
                        row.style.marginBottom = '6px';

                        const opSelect = document.createElement('select');
                        opSelect.style.padding = '4px 6px';
                        opSelect.style.background = 'var(--bg-dark)';
                        opSelect.style.color = 'var(--text-light)';
                        opSelect.style.border = '1px solid var(--border-color)';
                        opSelect.style.borderRadius = '4px';
                        ['>=','>','<=','<','==','!='].forEach(o => { const oEl = document.createElement('option'); oEl.value = o; oEl.textContent = o; if (c.operator === o) oEl.selected = true; opSelect.appendChild(oEl); });
                        
                        const thr = document.createElement('input');
                        thr.type = 'number';
                        thr.value = c.threshold || 0;
                        thr.style.padding = '4px 6px';
                        thr.style.width = '70px';
                        thr.style.background = 'var(--bg-dark)';
                        thr.style.color = 'var(--text-light)';
                        thr.style.border = '1px solid var(--border-color)';
                        thr.style.borderRadius = '4px';
                        
                        const txt = document.createElement('input');
                        txt.type = 'text';
                        txt.value = c.text || '';
                        txt.placeholder = 'Texto a exibir';
                        txt.style.padding = '4px 6px';
                        txt.style.background = 'var(--bg-dark)';
                        txt.style.color = 'var(--text-light)';
                        txt.style.border = '1px solid var(--border-color)';
                        txt.style.borderRadius = '4px';
                        
                        const textColor = document.createElement('input');
                        textColor.type = 'color';
                        textColor.value = c.textColor || '#ffffff';
                        textColor.title = 'Cor do texto';
                        textColor.style.width = '40px';
                        textColor.style.height = '32px';
                        textColor.style.cursor = 'pointer';
                        textColor.style.border = '1px solid var(--border-color)';
                        
                        const bgColor = document.createElement('input');
                        bgColor.type = 'color';
                        bgColor.value = c.backgroundColor || '#ff0000';
                        bgColor.title = 'Cor de fundo';
                        bgColor.style.width = '40px';
                        bgColor.style.height = '32px';
                        bgColor.style.cursor = 'pointer';
                        bgColor.style.border = '1px solid var(--border-color)';
                        
                        const borderColorInput = document.createElement('input');
                        borderColorInput.type = 'color';
                        borderColorInput.value = c.borderColor || '#ff6666';
                        borderColorInput.title = 'Cor da orla';
                        borderColorInput.style.width = '40px';
                        borderColorInput.style.height = '32px';
                        borderColorInput.style.cursor = 'pointer';
                        borderColorInput.style.border = '1px solid var(--border-color)';
                        
                        const rem = document.createElement('button');
                        rem.textContent = '✕';
                        rem.title = 'Remover condição';
                        rem.style.background = 'transparent';
                        rem.style.border = '1px solid var(--border-color)';
                        rem.style.borderRadius = '4px';
                        rem.style.color = 'var(--text-light)';
                        rem.style.padding = '4px 8px';
                        rem.style.cursor = 'pointer';

                        opSelect.addEventListener('change', () => { elements[idx].conditions[ci].operator = opSelect.value; try { updatePreviewForElement(idx); } catch (err) {} });
                        thr.addEventListener('input', () => { elements[idx].conditions[ci].threshold = parseFloat(thr.value) || 0; try { updatePreviewForElement(idx); } catch (err) {} });
                        txt.addEventListener('input', () => { elements[idx].conditions[ci].text = txt.value; try { updatePreviewForElement(idx); } catch (err) {} });
                        textColor.addEventListener('change', () => { elements[idx].conditions[ci].textColor = textColor.value; try { updatePreviewForElement(idx); } catch (err) {} });
                        bgColor.addEventListener('change', () => { elements[idx].conditions[ci].backgroundColor = bgColor.value; try { updatePreviewForElement(idx); } catch (err) {} });
                        borderColorInput.addEventListener('change', () => { elements[idx].conditions[ci].borderColor = borderColorInput.value; try { updatePreviewForElement(idx); } catch (err) {} });
                        rem.addEventListener('click', () => { elements[idx].conditions.splice(ci,1); renderConditions(); try { updatePreviewForElement(idx); } catch (err) {} });

                        row.appendChild(opSelect);
                        row.appendChild(thr);
                        row.appendChild(txt);
                        row.appendChild(textColor);
                        row.appendChild(bgColor);
                        row.appendChild(borderColorInput);
                        row.appendChild(rem);
                        list.appendChild(row);
                    });
                }

                const addBtnCond = document.createElement('button');
                addBtnCond.textContent = '+ Adicionar Condição';
                addBtnCond.style.marginTop = '12px';
                addBtnCond.style.padding = '10px 16px';
                addBtnCond.style.border = 'none';
                addBtnCond.style.background = 'var(--primary-red)';
                addBtnCond.style.color = 'white';
                addBtnCond.style.borderRadius = '6px';
                addBtnCond.style.fontWeight = '600';
                addBtnCond.style.cursor = 'pointer';
                addBtnCond.style.width = '100%';
                addBtnCond.addEventListener('click', () => {
                    elements[idx].conditions = elements[idx].conditions || [];
                    elements[idx].conditions.push({ operator: '>=', threshold: 0, text: 'Novo', textColor: '#ffffff', backgroundColor: '#ff0000', borderColor: '#ff6666' });
                    renderConditions();
                    try { updatePreviewForElement(idx); } catch (err) {}
                });

                condWrap.appendChild(list);
                condWrap.appendChild(addBtnCond);
                panes.values.appendChild(condWrap);
                renderConditions();
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
            
            ['gauge', 'bar', 'bar-marker', 'bar-pointer', 'led', 'text', 'conditional-text', 'button', 'digital'].forEach(t => {
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
                } else if (type === 'bar-pointer') {
                    newElem = { ...baseConfig, value: 50, min: 0, max: 100, sizeScale: 100, color: '#8B0000' };
                } else if (type === 'led') {
                    newElem = { ...baseConfig, value: 0, threshold: 500, color: '#00FF00', colorOff: '#333333', blink: false, blinkRate: 500, sizeScale: 100 };
                } else if (type === 'text') {
                    newElem = { ...baseConfig, text: 'Novo Texto', fontSize: 14, fontWeight: '400', color: 'var(--text-light)' };
                } else if (type === 'digital') {
                    newElem = { ...baseConfig, value: 0, min: 0, max: 9999, unit: '', sizeScale: 100, color: '#00ff88' };
                } else if (type === 'conditional-text') {
                    newElem = { ...baseConfig, value: 0, fontSize: 16, fontWeight: '600', defaultTextColor: '#ffffff', defaultBackgroundColor: 'rgba(0,0,0,0.2)', defaultBorderColor: 'rgba(0,0,0,0.3)', conditions: [] };
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
                // re-render and open editor for the newly created element
                renderEditMode();
                // ensure we open the editor for the element just added (last index)
                try { showEditPanel(elements.length - 1); } catch (err) {}
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

        const externalDashBtn = document.createElement('button');
        externalDashBtn.textContent = 'Dashboard Externa';
        externalDashBtn.style.padding = '8px 14px';
        externalDashBtn.style.background = 'linear-gradient(90deg, #8B0000, #ff6666)';
        externalDashBtn.style.border = 'none';
        externalDashBtn.style.color = 'white';
        externalDashBtn.style.borderRadius = '4px';
        externalDashBtn.style.cursor = 'pointer';
        externalDashBtn.style.fontWeight = '600';
        externalDashBtn.addEventListener('click', () => {
            openQuickStatsModal();
        });

        footer.appendChild(revertBtn);
        footer.appendChild(genBtn);
        footer.appendChild(loadBtn);
        footer.appendChild(externalDashBtn);
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

    // ===== QUICK STATS MODAL =====
    function openQuickStatsModal() {
        // Criar modal overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '20000';
        
        // Criar modal content com layout flexível
        const modalBox = document.createElement('div');
        modalBox.style.background = 'var(--bg-dark)';
        modalBox.style.borderRadius = '12px';
        modalBox.style.maxWidth = '500px';
        modalBox.style.width = '90%';
        modalBox.style.maxHeight = '80vh';
        modalBox.style.border = '2px solid var(--primary-red)';
        modalBox.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        modalBox.style.display = 'flex';
        modalBox.style.flexDirection = 'column';
        
        // Criar container para conteúdo scrollável
        const contentContainer = document.createElement('div');
        contentContainer.style.flex = '1';
        contentContainer.style.overflowY = 'auto';
        contentContainer.style.padding = '20px';
        
        // Título
        const title = document.createElement('h3');
        title.textContent = 'Configurar Dashboard Externa (Quick Stats)';
        title.style.color = 'white';
        title.style.marginBottom = '20px';
        title.style.marginTop = '0';
        title.style.textAlign = 'center';
        contentContainer.appendChild(title);
        
        // Descrição
        const desc = document.createElement('p');
        desc.textContent = 'Configure até 4 valores rápidos da sua ECU para exibir na barra superior';
        desc.style.color = 'var(--text-light)';
        desc.style.fontSize = '13px';
        desc.style.marginBottom = '15px';
        contentContainer.appendChild(desc);
        
        // Slots para cada stat
        window.quickStatsConfig.forEach((stat, idx) => {
            const slotDiv = document.createElement('div');
            slotDiv.style.background = 'rgba(0,0,0,0.2)';
            slotDiv.style.padding = '15px';
            slotDiv.style.marginBottom = '12px';
            slotDiv.style.borderRadius = '8px';
            slotDiv.style.border = '1px solid var(--border-color)';
            
            // Heading
            const slotTitle = document.createElement('div');
            slotTitle.style.fontSize = '13px';
            slotTitle.style.fontWeight = '700';
            slotTitle.style.color = 'var(--primary-red)';
            slotTitle.style.marginBottom = '10px';
            slotTitle.textContent = `Valor ${idx + 1}`;
            slotDiv.appendChild(slotTitle);
            
            // Checkbox habilitar
            const enableDiv = document.createElement('div');
            enableDiv.style.display = 'flex';
            enableDiv.style.alignItems = 'center';
            enableDiv.style.marginBottom = '10px';
            enableDiv.style.gap = '8px';
            
            const enableCheck = document.createElement('input');
            enableCheck.type = 'checkbox';
            enableCheck.checked = stat.enabled;
            enableCheck.style.cursor = 'pointer';
            
            const enableLabel = document.createElement('label');
            enableLabel.textContent = 'Habilitado';
            enableLabel.style.color = 'var(--text-light)';
            enableLabel.style.cursor = 'pointer';
            enableLabel.style.margin = '0';
            
            enableDiv.appendChild(enableCheck);
            enableDiv.appendChild(enableLabel);
            slotDiv.appendChild(enableDiv);
            
            // Label input
            const labelDiv = document.createElement('div');
            labelDiv.style.marginBottom = '10px';
            
            const labelLbl = document.createElement('label');
            labelLbl.textContent = 'Nome:';
            labelLbl.style.display = 'block';
            labelLbl.style.color = 'var(--text-light)';
            labelLbl.style.fontSize = '12px';
            labelLbl.style.marginBottom = '4px';
            
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.value = stat.label;
            labelInput.placeholder = 'Ex: RPM, Temperatura';
            labelInput.style.width = '100%';
            labelInput.style.padding = '6px 8px';
            labelInput.style.background = 'var(--bg-darker)';
            labelInput.style.border = '1px solid var(--border-color)';
            labelInput.style.borderRadius = '4px';
            labelInput.style.color = 'var(--text-light)';
            labelInput.style.boxSizing = 'border-box';
            
            labelDiv.appendChild(labelLbl);
            labelDiv.appendChild(labelInput);
            slotDiv.appendChild(labelDiv);
            
            // Field select
            const fieldDiv = document.createElement('div');
            fieldDiv.style.marginBottom = '10px';
            
            const fieldLbl = document.createElement('label');
            fieldLbl.textContent = 'Campo CommonInfo:';
            fieldLbl.style.display = 'block';
            fieldLbl.style.color = 'var(--text-light)';
            fieldLbl.style.fontSize = '12px';
            fieldLbl.style.marginBottom = '4px';
            
            const fieldSelect = document.createElement('select');
            fieldSelect.style.width = '100%';
            fieldSelect.style.padding = '6px 8px';
            fieldSelect.style.background = 'var(--bg-darker)';
            fieldSelect.style.border = '1px solid var(--border-color)';
            fieldSelect.style.borderRadius = '4px';
            fieldSelect.style.color = 'var(--text-light)';
            fieldSelect.style.boxSizing = 'border-box';
            
            // Opção vazia
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '-- Selecione um campo --';
            fieldSelect.appendChild(emptyOpt);
            
            // Adicionar campos do CommonInfo
            if (window.CommonInfo && window.CommonInfo.config && window.CommonInfo.config.dataFields) {
                window.CommonInfo.config.dataFields.forEach(field => {
                    const opt = document.createElement('option');
                    opt.value = field.id;
                    opt.textContent = `${field.title} (${field.id})`;
                    if (stat.fieldId === field.id) opt.selected = true;
                    fieldSelect.appendChild(opt);
                });
            }
            
            fieldDiv.appendChild(fieldLbl);
            fieldDiv.appendChild(fieldSelect);
            slotDiv.appendChild(fieldDiv);
            
            // Divisor input
            const divDiv = document.createElement('div');
            divDiv.style.marginBottom = '10px';
            
            const divLbl = document.createElement('label');
            divLbl.textContent = 'Divisor de Valor:';
            divLbl.style.display = 'block';
            divLbl.style.color = 'var(--text-light)';
            divLbl.style.fontSize = '12px';
            divLbl.style.marginBottom = '4px';
            
            const divInput = document.createElement('input');
            divInput.type = 'number';
            divInput.value = stat.divisor;
            divInput.min = '0.1';
            divInput.step = '0.1';
            divInput.style.width = '100%';
            divInput.style.padding = '6px 8px';
            divInput.style.background = 'var(--bg-darker)';
            divInput.style.border = '1px solid var(--border-color)';
            divInput.style.borderRadius = '4px';
            divInput.style.color = 'var(--text-light)';
            divInput.style.boxSizing = 'border-box';
            
            divDiv.appendChild(divLbl);
            divDiv.appendChild(divInput);
            slotDiv.appendChild(divDiv);
            
            // Cor input
            const colorDiv = document.createElement('div');
            colorDiv.style.marginBottom = '0';
            
            const colorLbl = document.createElement('label');
            colorLbl.textContent = 'Cor:';
            colorLbl.style.display = 'block';
            colorLbl.style.color = 'var(--text-light)';
            colorLbl.style.fontSize = '12px';
            colorLbl.style.marginBottom = '4px';
            
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = stat.color;
            colorInput.style.width = '100%';
            colorInput.style.height = '40px';
            colorInput.style.border = 'none';
            colorInput.style.borderRadius = '4px';
            colorInput.style.cursor = 'pointer';
            
            colorDiv.appendChild(colorLbl);
            colorDiv.appendChild(colorInput);
            slotDiv.appendChild(colorDiv);
            
            // Event listeners
            enableCheck.addEventListener('change', () => {
                stat.enabled = enableCheck.checked;
            });
            
            labelInput.addEventListener('input', () => {
                stat.label = labelInput.value;
            });
            
            fieldSelect.addEventListener('change', () => {
                stat.fieldId = fieldSelect.value;
            });
            
            divInput.addEventListener('change', () => {
                stat.divisor = parseFloat(divInput.value) || 1;
            });
            
            colorInput.addEventListener('change', () => {
                stat.color = colorInput.value;
            });
            
            contentContainer.appendChild(slotDiv);
        });
        
        modalBox.appendChild(contentContainer);
        
        // Botões de ação (FIXO na base do modal)
        const btnDiv = document.createElement('div');
        btnDiv.style.display = 'flex';
        btnDiv.style.gap = '10px';
        btnDiv.style.padding = '15px 20px';
        btnDiv.style.borderTop = '1px solid var(--border-color)';
        btnDiv.style.background = 'rgba(0,0,0,0.3)';
        btnDiv.style.flexShrink = '0';
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Salvar';

        saveBtn.style.flex = '1';
        saveBtn.style.padding = '10px';
        saveBtn.style.background = 'var(--primary-red)';
        saveBtn.style.border = 'none';
        saveBtn.style.color = 'white';
        saveBtn.style.borderRadius = '6px';
        saveBtn.style.fontWeight = '600';
        saveBtn.style.cursor = 'pointer';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Fechar';
        closeBtn.style.flex = '1';
        closeBtn.style.padding = '10px';
        closeBtn.style.background = 'var(--border-color)';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'var(--text-light)';
        closeBtn.style.borderRadius = '6px';
        closeBtn.style.fontWeight = '600';
        closeBtn.style.cursor = 'pointer';
        
        saveBtn.addEventListener('click', () => {
            saveQuickStatsConfig();
            updateQuickStats();
            overlay.remove();
        });
        
        closeBtn.addEventListener('click', () => {
            overlay.remove();
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        btnDiv.appendChild(saveBtn);
        btnDiv.appendChild(closeBtn);
        modalBox.appendChild(btnDiv);
        
        overlay.appendChild(modalBox);
        document.body.appendChild(overlay);
    }

    // ===== QUICK STATS =====
    const QUICK_STATS_KEY = 'dsw_quick_stats_config_v1';

    function initializeQuickStats() {
        try {
            // Usar StorageManager se disponível, senão fallback para localStorage
            let saved = null;
            if (window.StorageManager) {
                const raw = localStorage.getItem(QUICK_STATS_KEY);
                if (raw) {
                    const payload = JSON.parse(raw);
                    saved = payload.data;
                }
            } else {
                saved = localStorage.getItem(QUICK_STATS_KEY);
                if (saved) saved = JSON.parse(saved);
            }
            
            if (saved) {
                window.quickStatsConfig = saved;
            } else {
                window.quickStatsConfig = [
                    { id: 'stat1', label: '', fieldId: '', divisor: 1, color: '#FFD700', enabled: false },
                    { id: 'stat2', label: '', fieldId: '', divisor: 1, color: '#FFD700', enabled: false },
                    { id: 'stat3', label: '', fieldId: '', divisor: 1, color: '#FFD700', enabled: false },
                    { id: 'stat4', label: '', fieldId: '', divisor: 1, color: '#FFD700', enabled: false }
                ];
            }
        } catch (err) {
            console.error('Erro ao carregar quick stats:', err);
            window.quickStatsConfig = [
                { id: 'stat1', label: '', fieldId: '', divisor: 1, color: '#FFD700', enabled: false },
                { id: 'stat2', label: '', fieldId: '', divisor: 1, color: '#FFD700', enabled: false },
                { id: 'stat3', label: '', fieldId: '', divisor: 1, color: '#FFD700', enabled: false },
                { id: 'stat4', label: '', fieldId: '', divisor: 1, color: '#FFD700', enabled: false }
            ];
        }
        updateQuickStats();
    }

    function updateQuickStats() {
        const panel = document.getElementById('quickStatsPanel');
        if (!panel) return;
        
        panel.innerHTML = '';
        
        window.quickStatsConfig.forEach(stat => {
            if (!stat.enabled || !stat.fieldId) return;
            
            let value = 0;
            let unit = '';
            
            if (window.CommonInfo && window.CommonInfo.data && window.CommonInfo.data[stat.fieldId]) {
                value = window.CommonInfo.data[stat.fieldId].value || 0;
                unit = window.CommonInfo.data[stat.fieldId].unit || '';
            }
            
            const divisor = stat.divisor || 1;
            const displayValue = (value / divisor).toFixed(1);
            
            const item = document.createElement('div');
            item.className = 'quick-stat-item';
            item.style.borderColor = stat.color;
            item.style.boxShadow = `0 0 8px ${stat.color}33, 0 2px 8px rgba(0,0,0,0.3)`;
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'quick-stat-label';
            labelDiv.textContent = stat.label || stat.fieldId;
            
            const valueDiv = document.createElement('div');
            valueDiv.className = 'quick-stat-value';
            valueDiv.textContent = displayValue;
            valueDiv.style.color = stat.color;
            
            const unitDiv = document.createElement('div');
            unitDiv.className = 'quick-stat-unit';
            unitDiv.textContent = unit;
            
            item.appendChild(labelDiv);
            item.appendChild(valueDiv);
            item.appendChild(unitDiv);
            panel.appendChild(item);
        });
    }

    function saveQuickStatsConfig() {
        try {
            // Usar StorageManager se disponível
            if (window.StorageManager) {
                window.StorageManager.save(QUICK_STATS_KEY, window.quickStatsConfig);
            } else {
                localStorage.setItem(QUICK_STATS_KEY, JSON.stringify(window.quickStatsConfig));
            }
        } catch (err) {
            console.error('Erro ao salvar quick stats:', err);
        }
    }

    // Atualizar quick stats quando CommonInfo for atualizado
    window.addEventListener('commoninfoUpdated', () => {
        updateQuickStats();
    });

    // Inicializar ao carregar
    setTimeout(() => {
        initializeQuickStats();
    }, 500);

    if (modal && modal.getAttribute('aria-hidden') === 'false') {
        renderViewMode();
    }

})();
