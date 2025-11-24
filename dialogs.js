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

    async error(title, message) {
        return this.info(title, message, 'bi-exclamation-circle-fill');
    }

    async info(title, message, icon = 'bi-info-circle-fill') {
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
            titleEl.innerHTML = icon ? `<i class="bi ${icon}" style="margin-right:8px;color:#4ade80;font-size:22px;"></i>` : '';
            titleEl.innerHTML += title;

            const messageEl = document.createElement('div');
            messageEl.className = 'dialog-message';
            messageEl.textContent = message;

            const actions = document.createElement('div');
            actions.className = 'dialog-actions';

            const okBtn = document.createElement('button');
            okBtn.className = 'dialog-btn dialog-btn-ok';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', () => {
                backdrop.classList.remove('show');
                setTimeout(() => backdrop.remove(), 300);
                resolve();
            });

            actions.appendChild(okBtn);
            content.appendChild(titleEl);
            content.appendChild(messageEl);
            content.appendChild(actions);
            dialog.appendChild(content);
            backdrop.appendChild(dialog);
            container.appendChild(backdrop);
            setTimeout(() => backdrop.classList.add('show'), 10);
        });
    }

    async promptValues(title, fields, icon = 'bi-currency-dollar') {
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
            titleEl.innerHTML = icon ? `<i class="bi ${icon}" style="margin-right:8px;color:#fbbf24;font-size:22px;"></i>` : '';
            titleEl.innerHTML += title;

            const form = document.createElement('form');
            form.style.display = 'flex';
            form.style.flexDirection = 'column';
            form.style.gap = '18px';
            form.style.marginBottom = '18px';

            const inputs = [];
            fields.forEach((field, idx) => {
                const fieldDiv = document.createElement('div');
                fieldDiv.style.display = 'flex';
                fieldDiv.style.flexDirection = 'column';
                fieldDiv.style.gap = '6px';

                const label = document.createElement('label');
                label.textContent = field.label;
                label.style.fontWeight = '600';
                label.style.color = '#fbbf24';
                if (field.icon) label.innerHTML = `<i class="bi ${field.icon}" style="margin-right:6px;color:#fbbf24;"></i>` + label.textContent;

                let input;
                if (field.type === 'number') {
                    input = document.createElement('input');
                    input.type = 'number';
                    input.value = field.default ?? '';
                    if (field.min !== undefined) input.min = field.min;
                    if (field.max !== undefined) input.max = field.max;
                    input.required = true;
                } else if (field.type === 'text') {
                    input = document.createElement('input');
                    input.type = 'text';
                    input.value = field.default ?? '';
                    input.required = true;
                } else if (field.type === 'select' && field.options) {
                    input = document.createElement('select');
                    field.options.forEach(opt => {
                        const optEl = document.createElement('option');
                        optEl.value = opt.value;
                        optEl.textContent = opt.label;
                        if (opt.value === field.default) optEl.selected = true;
                        input.appendChild(optEl);
                    });
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                    input.value = field.default ?? '';
                    input.required = true;
                }
                input.style.padding = '8px';
                input.style.borderRadius = '6px';
                input.style.border = '1.5px solid #fbbf24';
                input.style.fontSize = '15px';
                input.style.background = '#1a1a1a';
                input.style.color = '#fff';
                fieldDiv.appendChild(label);
                fieldDiv.appendChild(input);
                form.appendChild(fieldDiv);
                inputs.push({ input, field });
            });

            const actions = document.createElement('div');
            actions.className = 'dialog-actions';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'dialog-btn dialog-btn-cancel';
            cancelBtn.textContent = 'Cancelar';
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                backdrop.classList.remove('show');
                setTimeout(() => backdrop.remove(), 300);
                resolve(null);
            });

            const okBtn = document.createElement('button');
            okBtn.className = 'dialog-btn dialog-btn-ok';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', (e) => {
                e.preventDefault();
                let valid = true;
                const values = {};
                inputs.forEach(({ input, field }) => {
                    let val = input.value;
                    if (field.type === 'number') val = parseFloat(val);
                    if (field.validate && typeof field.validate === 'function') {
                        if (!field.validate(val)) {
                            input.style.borderColor = '#f87171';
                            valid = false;
                        } else {
                            input.style.borderColor = '#fbbf24';
                        }
                    } else if (field.min !== undefined && val < field.min) {
                        input.style.borderColor = '#f87171';
                        valid = false;
                    } else if (field.max !== undefined && val > field.max) {
                        input.style.borderColor = '#f87171';
                        valid = false;
                    } else {
                        input.style.borderColor = '#fbbf24';
                    }
                    values[field.label] = val;
                });
                if (!valid) return;
                backdrop.classList.remove('show');
                setTimeout(() => backdrop.remove(), 300);
                resolve(values);
            });

            actions.appendChild(cancelBtn);
            actions.appendChild(okBtn);
            content.appendChild(titleEl);
            content.appendChild(form);
            content.appendChild(actions);
            dialog.appendChild(content);
            backdrop.appendChild(dialog);
            container.appendChild(backdrop);
            setTimeout(() => backdrop.classList.add('show'), 10);
        });
    }

    showComboboxModal(widget, currentValue, onSelected) {
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'combobox-modal-overlay';
        modalOverlay.style.zIndex = '99999';

        const modal = document.createElement('div');
        modal.className = 'combobox-modal';

        // DEFINIR closeModal ANTES de usar
        const closeModal = () => {
            modalOverlay.classList.remove('show');
            setTimeout(() => {
                if (modalOverlay.parentNode) {
                    modalOverlay.remove();
                }
            }, 300);
        };

        const header = document.createElement('div');
        header.className = 'combobox-modal-header';
        const title = document.createElement('h3');
        title.textContent = widget.title || 'Selecione uma opção';
        header.appendChild(title);

        const searchContainer = document.createElement('div');
        searchContainer.className = 'combobox-search-container';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'combobox-search-input';
        searchInput.placeholder = 'Pesquisar...';
        searchInput.setAttribute('aria-label', 'Pesquisar opções');
        searchContainer.appendChild(searchInput);

        const optionsList = document.createElement('div');
        optionsList.className = 'combobox-options-list';

        let selectedInModal = currentValue;

        const renderOptions = (filter = '') => {
            optionsList.innerHTML = '';
            const filtered = widget.options.filter(opt => 
                opt.label.toLowerCase().includes(filter.toLowerCase())
            );

            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'combobox-empty-state';
                empty.textContent = 'Nenhuma opção encontrada';
                optionsList.appendChild(empty);
                return;
            }

            filtered.forEach(option => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'combobox-option-item';
                if (option.value == selectedInModal) {
                    item.classList.add('selected');
                }
                item.textContent = option.label;
                item.dataset.value = option.value;

                item.addEventListener('click', () => {
                    selectedInModal = option.value;
                    optionsList.querySelectorAll('.combobox-option-item').forEach(btn => {
                        btn.classList.remove('selected');
                    });
                    item.classList.add('selected');
                });

                optionsList.appendChild(item);
            });
        };

        renderOptions();

        searchInput.addEventListener('input', (e) => {
            renderOptions(e.target.value);
        });

        const footer = document.createElement('div');
        footer.className = 'combobox-modal-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel';
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.addEventListener('click', () => {
            closeModal();
        });

        const applyBtn = document.createElement('button');
        applyBtn.className = 'btn-apply';
        applyBtn.type = 'button';
        applyBtn.textContent = 'Aplicar';
        
        applyBtn.addEventListener('click', () => {
            closeModal();
            if (onSelected) {
                onSelected(selectedInModal);
            }
        });

        footer.appendChild(cancelBtn);
        footer.appendChild(applyBtn);

        modal.appendChild(header);
        modal.appendChild(searchContainer);
        modal.appendChild(optionsList);
        modal.appendChild(footer);

        modalOverlay.appendChild(modal);
        document.body.appendChild(modalOverlay);

        // Mostrar com animação
        setTimeout(() => {
            modalOverlay.classList.add('show');
        }, 10);

        searchInput.focus();

        // Event listeners
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    showPause(title, message, icon = 'bi-arrow-repeat') {
        const container = document.getElementById('dialogContainer');
        const backdrop = document.createElement('div');
        backdrop.className = 'dialog-backdrop';
        backdrop.style.zIndex = 9999;

        const dialog = document.createElement('div');
        dialog.className = 'dialog';

        const content = document.createElement('div');
        content.className = 'dialog-content';

        const titleEl = document.createElement('div');
        titleEl.className = 'dialog-title';
        titleEl.innerHTML = `<i class="bi ${icon}" style="margin-right:8px;color:#3b82f6;font-size:22px;animation:spin 1s linear infinite;"></i>` + title;

        const messageEl = document.createElement('div');
        messageEl.className = 'dialog-message';
        messageEl.textContent = message;

        content.appendChild(titleEl);
        content.appendChild(messageEl);
        dialog.appendChild(content);
        backdrop.appendChild(dialog);
        container.appendChild(backdrop);
        setTimeout(() => backdrop.classList.add('show'), 10);

        if (!document.getElementById('dialog-spin-style')) {
            const style = document.createElement('style');
            style.id = 'dialog-spin-style';
            style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }

        return () => {
            backdrop.classList.remove('show');
            setTimeout(() => backdrop.remove(), 300);
        };
    }

    showCustomDialog(title, contentElement, onOk) {
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

            const bodyEl = document.createElement('div');
            bodyEl.className = 'dialog-body';
            bodyEl.style.padding = '15px 0';
            bodyEl.appendChild(contentElement);

            const actions = document.createElement('div');
            actions.className = 'dialog-actions';

            const cleanup = () => {
                backdrop.classList.remove('show');
                setTimeout(() => backdrop.remove(), 300);
            };

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
                onOk();
                cleanup();
                resolve(true);
            });

            actions.appendChild(cancelBtn);
            actions.appendChild(okBtn);

            content.appendChild(titleEl);
            content.appendChild(bodyEl);
            content.appendChild(actions);

            dialog.appendChild(content);
            backdrop.appendChild(dialog);
            container.appendChild(backdrop);

            setTimeout(() => backdrop.classList.add('show'), 10);
        });
    }

    editNumberValue(title, value, min, max, step, unit, onConfirm) {
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

            const bodyEl = document.createElement('div');
            bodyEl.style.padding = '15px 0';
            bodyEl.innerHTML = `
                <div style="display: flex; gap: 10px; align-items: center;">
                    <input type="number" id="number-input" value="${value}" min="${min}" max="${max}" step="${step}" 
                           style="flex: 1; padding: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); 
                                  color: white; border-radius: 4px; font-size: 14px;">
                    <span style="color: #999; min-width: 40px;">${unit}</span>
                </div>
            `;

            const actions = document.createElement('div');
            actions.className = 'dialog-actions';

            const cleanup = () => {
                backdrop.classList.remove('show');
                setTimeout(() => backdrop.remove(), 300);
            };

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
                const input = document.getElementById('number-input');
                const newValue = parseFloat(input.value);
                if (!isNaN(newValue)) {
                    onConfirm(newValue);
                }
                cleanup();
                resolve(true);
            });

            actions.appendChild(cancelBtn);
            actions.appendChild(okBtn);

            content.appendChild(titleEl);
            content.appendChild(bodyEl);
            content.appendChild(actions);

            dialog.appendChild(content);
            backdrop.appendChild(dialog);
            container.appendChild(backdrop);

            setTimeout(() => {
                backdrop.classList.add('show');
                document.getElementById('number-input').focus();
                document.getElementById('number-input').select();
            }, 10);
        });
    }
}

window.dialogManager = new DialogManager();
