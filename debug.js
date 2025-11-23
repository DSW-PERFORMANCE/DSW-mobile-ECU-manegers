// Script de Debug - copie e cole isso no console do navegador para testar

console.log('=== VERIFICAÇÃO DE INICIALIZAÇÃO ===');
console.log('ecuCommunication.isOnline:', window.ecuCommunication?.isOnline);
console.log('statusBadge.textContent:', document.getElementById('statusBadge')?.textContent);
console.log('ecuManager.config:', !!window.ecuManager?.config);
console.log('widgetManager exists:', !!window.widgetManager);

console.log('\n=== TESTE 1: Mudar status ===');
window.ecuCommunication.setStatus(false);
console.log('Status definido para false');
console.log('Badge:', document.getElementById('statusBadge').textContent);

setTimeout(() => {
    window.ecuCommunication.setStatus(true);
    console.log('Status definido para true');
    console.log('Badge:', document.getElementById('statusBadge').textContent);

    console.log('\n=== TESTE 2: Enviar comando ===');
    window.ecuCommunication.sendCommand('test_command', 'test_value').then(result => {
        console.log('Comando enviado, resultado:', result);
    });
}, 500);
