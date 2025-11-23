document.addEventListener('DOMContentLoaded', () => {
    window.ecuManager.init();
    if (window.ecuCommunication) {
        window.ecuCommunication.setStatus(false);
    }

    // Install global keyboard shortcuts for undo/redo
    document.addEventListener('keydown', (ev) => {
        const isMod = ev.ctrlKey || ev.metaKey;
        if (!isMod) return;

        const key = ev.key.toLowerCase();
        if (key === 'z' && !ev.shiftKey) {
            ev.preventDefault();
            if (window.globalHistoryManager) {
                const success = window.globalHistoryManager.undo();
                if (success && window.notificationManager) {
                    window.notificationManager.info('Desfazer: última alteração revertida');
                }
            }
        } else if (key === 'y' || (key === 'z' && ev.shiftKey)) {
            ev.preventDefault();
            if (window.globalHistoryManager) {
                const success = window.globalHistoryManager.redo();
                if (success && window.notificationManager) {
                    window.notificationManager.info('Refazer: alteração reaplicada');
                }
            }
        }
    });
});