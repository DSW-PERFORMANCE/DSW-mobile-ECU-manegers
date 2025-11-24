/**
 * Notification Manager
 * Centraliza TODOS os tipos de notificações:
 * - Toasts (notificações flutuantes)
 * - Alerts (alertas modais)
 * - Confirmations (diálogos de confirmação)
 * - Loading states (estados de carregamento)
 */
class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.toastContainer = null;
        this.alertContainer = null;
        this.activeLoadings = new Map();
        this.soundEnabled = true;
        this.initContainers();
    }

    initContainers() {
        // Container para toasts (canto superior direito)
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
        }

        // Container para alerts (centro da tela)
        if (!this.alertContainer) {
            this.alertContainer = document.createElement('div');
            this.alertContainer.id = 'alert-container';
            this.alertContainer.className = 'alert-container';
            document.body.appendChild(this.alertContainer);
        }
    }

    show(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        const id = `notification-${Date.now()}`;
        notification.id = id;
        notification.className = `notification notification-${type}`;

        let icon = '';
        switch (type) {
            case 'success':
                icon = '<i class="bi bi-check-circle-fill"></i>';
                break;
            case 'error':
                icon = '<i class="bi bi-x-circle-fill"></i>';
                break;
            case 'warning':
                icon = '<i class="bi bi-exclamation-triangle-fill"></i>';
                break;
            case 'info':
            default:
                icon = '<i class="bi bi-info-circle-fill"></i>';
                break;
        }

        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    ${icon}
                </div>
                <div class="notification-message">
                    ${message}
                </div>
                <button class="notification-close" data-notification-id="${id}">
                    <i class="bi bi-x"></i>
                </button>
            </div>
            <div class="notification-progress"></div>
        `;

        this.container.appendChild(notification);
        this.notifications.push(id);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.remove(id);
        });

        if (duration > 0) {
            setTimeout(() => {
                this.remove(id);
            }, duration);
        }

        notification.offsetHeight;
        notification.classList.add('show');

        return id;
    }

    remove(id) {
        const notification = document.getElementById(id);
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.notifications = this.notifications.filter(n => n !== id);
            }, 300);
        }
    }

    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }

    clear() {
        this.notifications.forEach(id => {
            this.remove(id);
        });
    }

    /**
     * Mostra alerta modal (bloqueante)
     * @param {string} title - Título do alerta
     * @param {string} message - Mensagem
     * @param {string} type - 'info', 'warning', 'error', 'success'
     * @returns {Promise<void>}
     */
    async alert(title, message, type = 'info') {
        return new Promise((resolve) => {
            const alertId = `alert-${Date.now()}`;
            const backdrop = document.createElement('div');
            backdrop.className = 'alert-backdrop';
            backdrop.id = `${alertId}-backdrop`;

            const alertBox = document.createElement('div');
            alertBox.className = `alert-box alert-${type}`;
            alertBox.id = alertId;

            let icon = '';
            switch (type) {
                case 'success':
                    icon = '<i class="bi bi-check-circle"></i>';
                    break;
                case 'error':
                    icon = '<i class="bi bi-x-circle"></i>';
                    break;
                case 'warning':
                    icon = '<i class="bi bi-exclamation-circle"></i>';
                    break;
                case 'info':
                default:
                    icon = '<i class="bi bi-info-circle"></i>';
                    break;
            }

            alertBox.innerHTML = `
                <div class="alert-content">
                    <div class="alert-icon">${icon}</div>
                    <div class="alert-body">
                        <div class="alert-title">${title}</div>
                        <div class="alert-message">${message}</div>
                    </div>
                </div>
                <div class="alert-actions">
                    <button class="btn btn-primary" id="${alertId}-btn">OK</button>
                </div>
            `;

            this.alertContainer.appendChild(backdrop);
            this.alertContainer.appendChild(alertBox);

            backdrop.classList.add('show');
            alertBox.classList.add('show');

            const closeAlert = () => {
                backdrop.classList.remove('show');
                alertBox.classList.remove('show');
                setTimeout(() => {
                    backdrop.remove();
                    alertBox.remove();
                    resolve();
                }, 300);
            };

            document.getElementById(`${alertId}-btn`).addEventListener('click', closeAlert);
            backdrop.addEventListener('click', closeAlert);
        });
    }

    /**
     * Mostra confirmação (yes/no)
     * @param {string} title - Título
     * @param {string} message - Mensagem
     * @returns {Promise<boolean>} true se clicou sim, false se clicou não
     */
    async confirm(title, message) {
        return new Promise((resolve) => {
            const confirmId = `confirm-${Date.now()}`;
            const backdrop = document.createElement('div');
            backdrop.className = 'alert-backdrop';

            const confirmBox = document.createElement('div');
            confirmBox.className = 'alert-box alert-confirm';

            confirmBox.innerHTML = `
                <div class="alert-content">
                    <div class="alert-icon"><i class="bi bi-question-circle"></i></div>
                    <div class="alert-body">
                        <div class="alert-title">${title}</div>
                        <div class="alert-message">${message}</div>
                    </div>
                </div>
                <div class="alert-actions">
                    <button class="btn btn-secondary" id="${confirmId}-cancel">Cancelar</button>
                    <button class="btn btn-primary" id="${confirmId}-ok">Confirmar</button>
                </div>
            `;

            this.alertContainer.appendChild(backdrop);
            this.alertContainer.appendChild(confirmBox);

            backdrop.classList.add('show');
            confirmBox.classList.add('show');

            const closeConfirm = (result) => {
                backdrop.classList.remove('show');
                confirmBox.classList.remove('show');
                setTimeout(() => {
                    backdrop.remove();
                    confirmBox.remove();
                    resolve(result);
                }, 300);
            };

            document.getElementById(`${confirmId}-ok`).addEventListener('click', () => closeConfirm(true));
            document.getElementById(`${confirmId}-cancel`).addEventListener('click', () => closeConfirm(false));
            backdrop.addEventListener('click', () => closeConfirm(false));
        });
    }

    /**
     * Mostra diálogo de prompt (entrada de texto)
     * @param {string} title - Título
     * @param {string} message - Mensagem
     * @param {string} defaultValue - Valor padrão
     * @returns {Promise<string|null>} Texto inserido ou null se cancelou
     */
    async prompt(title, message, defaultValue = '') {
        return new Promise((resolve) => {
            const promptId = `prompt-${Date.now()}`;
            const backdrop = document.createElement('div');
            backdrop.className = 'alert-backdrop';

            const promptBox = document.createElement('div');
            promptBox.className = 'alert-box alert-prompt';

            promptBox.innerHTML = `
                <div class="alert-content">
                    <div class="alert-body">
                        <div class="alert-title">${title}</div>
                        <div class="alert-message">${message}</div>
                        <input type="text" id="${promptId}-input" class="prompt-input" value="${defaultValue}" placeholder="Digite aqui...">
                    </div>
                </div>
                <div class="alert-actions">
                    <button class="btn btn-secondary" id="${promptId}-cancel">Cancelar</button>
                    <button class="btn btn-primary" id="${promptId}-ok">OK</button>
                </div>
            `;

            this.alertContainer.appendChild(backdrop);
            this.alertContainer.appendChild(promptBox);

            backdrop.classList.add('show');
            promptBox.classList.add('show');

            const inputElement = document.getElementById(`${promptId}-input`);
            inputElement.focus();
            inputElement.select();

            const closePrompt = (result) => {
                backdrop.classList.remove('show');
                promptBox.classList.remove('show');
                setTimeout(() => {
                    backdrop.remove();
                    promptBox.remove();
                    resolve(result);
                }, 300);
            };

            const handleOK = () => closePrompt(inputElement.value || null);
            const handleCancel = () => closePrompt(null);

            document.getElementById(`${promptId}-ok`).addEventListener('click', handleOK);
            document.getElementById(`${promptId}-cancel`).addEventListener('click', handleCancel);
            inputElement.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleOK();
                if (e.key === 'Escape') handleCancel();
            });
            backdrop.addEventListener('click', handleCancel);
        });
    }

    /**
     * Mostra loading overlay
     * @param {string} message - Mensagem ('Carregando...' por padrão)
     * @param {string} id - ID único para o loading
     * @returns {string} ID do loading para posterior fechamento
     */
    showLoading(message = 'Carregando...', id = null) {
        const loadingId = id || `loading-${Date.now()}`;

        if (this.activeLoadings.has(loadingId)) {
            return loadingId; // Já existe
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'loading-backdrop';
        backdrop.id = `${loadingId}-backdrop`;

        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        spinner.innerHTML = `
            <div class="spinner"></div>
            <div class="loading-message">${message}</div>
        `;

        backdrop.appendChild(spinner);
        this.alertContainer.appendChild(backdrop);

        setTimeout(() => {
            backdrop.classList.add('show');
        }, 10);

        this.activeLoadings.set(loadingId, { backdrop, spinner });
        return loadingId;
    }

    /**
     * Fecha loading overlay
     * @param {string} id - ID do loading
     */
    hideLoading(id) {
        if (!this.activeLoadings.has(id)) return;

        const { backdrop } = this.activeLoadings.get(id);
        backdrop.classList.remove('show');

        setTimeout(() => {
            backdrop.remove();
            this.activeLoadings.delete(id);
        }, 300);
    }

    /**
     * Habilita/desabilita sons
     * @param {boolean} enabled - true para ativar sons
     */
    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
    }

    /**
     * Toca som de notificação
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    playSound(type = 'info') {
        if (!this.soundEnabled) return;
        
        // Aqui você pode adicionar sons reais se desejar
        // Por enquanto, apenas registra no console
        console.log(`[SOUND] ${type}`);
    }
}

window.notificationManager = new NotificationManager();
