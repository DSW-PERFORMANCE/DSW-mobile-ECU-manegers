class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.initContainer();
    }

    initContainer() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            document.body.appendChild(this.container);
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
}

window.notificationManager = new NotificationManager();
