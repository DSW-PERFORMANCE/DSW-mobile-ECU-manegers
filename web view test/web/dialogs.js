class DialogManager {
    constructor() {
        this.createDialogContainer();
    }

    createDialogContainer() {
        if (!document.getElementById('dialogContainer')) {
            const container = document.createElement('div');
            container.id = 'dialogContainer';
            document.body.appendChild(container);
        }
    }

    async show(title, message, type = 'confirm') {
        return new Promise((resolve) => {
            const container = document.getElementById('dialogContainer');
            const backdrop = document.createElement('div');
            backdrop.className = 'dialog-backdrop';

            const dialog = document.createElement('div');
            dialog.className = 'dialog';

            const content = document.createElement('div');
            content.className = 'dialog-content';

            const titleEl = document.createElement('div');
            titleEl.className = 'dialog-title';
            titleEl.textContent = title;

            const messageEl = document.createElement('div');
            messageEl.className = 'dialog-message';
            messageEl.textContent = message;

            const actions = document.createElement('div');
            actions.className = 'dialog-actions';

            const cleanup = () => {
                backdrop.classList.remove('show');
                setTimeout(() => backdrop.remove(), 300);
            };

            if (type === 'confirm') {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'dialog-btn dialog-btn-cancel';
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(false);
                });

                const okBtn = document.createElement('button');
                okBtn.className = 'dialog-btn dialog-btn-ok';
                okBtn.textContent = 'OK';
                okBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(true);
                });

                actions.appendChild(cancelBtn);
                actions.appendChild(okBtn);
            } else if (type === 'retry') {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'dialog-btn dialog-btn-cancel';
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve('cancel');
                });

                const retryBtn = document.createElement('button');
                retryBtn.className = 'dialog-btn dialog-btn-retry';
                retryBtn.textContent = 'Tentar Novamente';
                retryBtn.addEventListener('click', () => {
                    cleanup();
                    resolve('retry');
                });

                actions.appendChild(cancelBtn);
                actions.appendChild(retryBtn);
            } else {
                const okBtn = document.createElement('button');
                okBtn.className = 'dialog-btn dialog-btn-ok';
                okBtn.textContent = 'OK';
                okBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(true);
                });

                actions.appendChild(okBtn);
            }

            content.appendChild(titleEl);
            content.appendChild(messageEl);
            content.appendChild(actions);

            dialog.appendChild(content);
            backdrop.appendChild(dialog);
            container.appendChild(backdrop);

            setTimeout(() => backdrop.classList.add('show'), 10);

            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEsc);
                    cleanup();
                    resolve(false);
                }
            };

            document.addEventListener('keydown', handleEsc);
        });
    }

    async confirm(title, message) {
        return this.show(title, message, 'confirm');
    }

    async alert(title, message) {
        return this.show(title, message, 'alert');
    }

    async retry(title, message) {
        return this.show(title, message, 'retry');
    }
}

window.dialogManager = new DialogManager();
