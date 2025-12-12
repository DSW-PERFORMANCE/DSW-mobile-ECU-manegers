# Sistema de Macros de Configuração - Guia Prático

## 📋 Visão Geral

O arquivo `config-macros.js` fornece um sistema de "macros" (similar a pré-processador de C++) que permite executar código diferente dependendo do ambiente definido em `app.json`.

Isso permite que o **mesmo código base funcione em múltiplas plataformas** com comportamentos diferentes:
- `browser` (padrão) - localStorage, sem APIs externas
- `webview` - Electron, React Native, com IPC ou bridge
- `windows` - Windows nativo, C#/.NET, APIs Windows

---

## 🔧 Como Funciona

### 1. Detecção Automática de Ambiente

Na inicialização, `ConfigMacros` carrega `app.json` e identifica o ambiente:

```json
{
  "version": "1.0",
  "environment": "browser",
  "timestamp": 1702436400,
  "data": {}
}
```

### 2. Registro de Macros

Registra condicionais que serão executadas depois:

```javascript
ConfigMacros
  .when('browser', () => { /* ... */ })
  .otherwise(() => { /* ... */ })
  .execute();
```

### 3. Execução

Quando `.execute()` é chamado, as macros apropriadas para o ambiente são executadas.

---

## 📝 Exemplos Práticos

### Exemplo 1: Simples - Usar localStorage ou API Windows

```javascript
// Em cookies.js ou ecu-communication.js

ConfigMacros
  .when('browser', () => {
    console.log('✓ Usando localStorage');
    // Usar localStorage normalmente
  })
  .otherwise(() => {
    console.log('✓ Usando API diferente');
    // Implementar persistência diferente
  })
  .execute();
```

### Exemplo 2: Comunicação com ECU por Ambiente

```javascript
// Em ecu-communication.js

ConfigMacros
  .when('browser', () => {
    console.log('ECU: Usando simulação');
    // Simular respostas da ECU
    this.simulateECU();
  })
  .when('webview', () => {
    console.log('ECU: Usando WebSocket');
    // Conectar via WebSocket a servidor
    this.connectWebSocket('ws://localhost:8000');
  })
  .when('windows', () => {
    console.log('ECU: Usando COM Port');
    // Conectar via COM Port via C# bridge
    this.connectCOMPort('COM3', 9600);
  })
  .execute();
```

### Exemplo 3: Suporte a Múltiplos Ambientes (OR)

```javascript
// Em dashboard.js

ConfigMacros
  .whenAny(['browser', 'webview'], () => {
    console.log('Rodando em Web-like environment');
    // Usar IndexedDB ou localStorage
    useWebStorage();
  })
  .when('windows', () => {
    console.log('Rodando nativamente em Windows');
    // Usar registro do Windows ou arquivo
    useWindowsRegistry();
  })
  .execute();
```

### Exemplo 4: Negação (NOT)

```javascript
// Em main.js

ConfigMacros
  .unlessEnvironment('windows', () => {
    // Executar em TUDO EXCETO Windows
    enableClipboardAPI();
  })
  .execute();
```

### Exemplo 5: Shortcuts (Atalhos Rápidos)

```javascript
// Em main.js - mais legível

ConfigMacros
  .onBrowser(() => {
    console.log('🌐 Browser detected');
    initBrowserUI();
  })
  .onWebView(() => {
    console.log('📱 WebView detected');
    initMobileUI();
  })
  .onWindows(() => {
    console.log('🪟 Windows detected');
    initWindowsUI();
  });
```

### Exemplo 6: Choose (Switch Funcional)

```javascript
// Em ecu-communication.js

const transport = ConfigMacros.choose({
    browser: () => {
        return new SimulatedTransport();
    },
    webview: () => {
        return new WebSocketTransport('ws://localhost:8000');
    },
    windows: () => {
        return new WindowsAPITransport('COM3');
    }
});

// Agora usar transport normalmente
await transport.connect();
```

---

## 🎯 Casos de Uso Reais

### Caso 1: Sistema de Armazenamento

```javascript
// Em cookies.js

ConfigMacros
  .when('browser', () => {
    window._storageImpl = new LocalStorageImpl();
  })
  .when('webview', () => {
    window._storageImpl = new BridgeStorageImpl(window.ipcRenderer);
  })
  .when('windows', () => {
    window._storageImpl = new WindowsAPIStorageImpl(window.windowsAPI);
  })
  .execute();

// Usar em qualquer lugar:
await window._storageImpl.save('key', data);
```

### Caso 2: Comunicação ECU com Fallbacks

```javascript
// Em ecu-communication.js

ConfigMacros
  .when('browser', () => {
    // Simular dados aleatórios
    this.pollingInterval = 1000;
    this.emulateSensorData();
  })
  .when('webview', () => {
    // Conectar via WebSocket com retry
    this.connectWithRetry('ws://backend:8000', 5);
  })
  .when('windows', () => {
    // Conectar via COM Port com verificação de porta
    this.detectAndConnectCOMPort();
  })
  .execute();
```

### Caso 3: UI Responsiva por Plataforma

```javascript
// Em main.js ou dashboard.js

ConfigMacros
  .when('browser', () => {
    // Full-screen responsive
    document.body.style.height = '100vh';
    dashboard.setLayout('responsive');
  })
  .when('webview', () => {
    // Suportar landscape/portrait switching
    screen.orientation.lock('portrait-primary');
    dashboard.setLayout('mobile-optimized');
  })
  .when('windows', () => {
    // Usar recursos nativos da janela
    dashboard.setLayout('desktop-full');
    enableWindowMenuBar();
  })
  .execute();
```

### Caso 4: Logging por Ambiente

```javascript
// Em qualquer arquivo

const log = {
  info: (msg) => {
    ConfigMacros.choose({
      browser: () => console.log(`[Browser] ${msg}`),
      webview: () => window.ipcRenderer.send('log', msg),
      windows: () => window.windowsAPI.log(msg)
    });
  }
};
```

---

## 🔄 Fluxo de Execução

```
1. index.html carrega
   ↓
2. config-macros.js carrega
   ↓
3. ConfigMacros() inicializa
   ↓
4. loadAppConfig() → lê app.json
   ↓
5. Detecta environment (browser/webview/windows)
   ↓
6. Armazena em window.ConfigMacros.environment
   ↓
7. Quando .execute() chamado, verifica cada macro
   ↓
8. Executa callbacks para macros que combinam com environment
   ↓
9. Sistema continua com comportamento correto para plataforma
```

---

## 📊 Métodos Disponíveis

| Método | Uso | Exemplo |
|--------|-----|---------|
| `when(env, fn)` | Condicional único | `.when('browser', () => {})` |
| `ifEnvironment(env, fn)` | Alias para when | `.ifEnvironment('windows', () => {})` |
| `otherwise(fn)` | Else para último when | `.when(...).otherwise(() => {})` |
| `whenAny(envs, fn)` | OR - múltiplos envs | `.whenAny(['browser', 'webview'], () => {})` |
| `unlessEnvironment(env, fn)` | NOT - todos exceto | `.unlessEnvironment('windows', () => {})` |
| `onBrowser(fn)` | Atalho browser | `.onBrowser(() => {})` |
| `onWebView(fn)` | Atalho webview | `.onWebView(() => {})` |
| `onWindows(fn)` | Atalho windows | `.onWindows(() => {})` |
| `choose(obj)` | Switch funcional | `.choose({browser: fn1, ...})` |
| `execute()` | Executa macros | `.execute()` |
| `isEnvironment(env)` | Verifica env | `if (ConfigMacros.isEnvironment('browser'))` |
| `getEnvironment()` | Retorna env | `const env = ConfigMacros.getEnvironment()` |
| `getAppConfig()` | Retorna app.json | `const cfg = ConfigMacros.getAppConfig()` |
| `debug()` | Info debug | `ConfigMacros.debug()` |

---

## ✨ Vantagens

1. ✅ **Código Único, Múltiplas Plataformas** - Sem duplicação
2. ✅ **Fácil de Ler** - Sintaxe clara e declarativa
3. ✅ **Type-Safe** - Sem strings mágicas, uso de enums possível
4. ✅ **Extensível** - Adicione novos ambientes facilmente
5. ✅ **Async-Ready** - Suporta Promises e async/await
6. ✅ **Debugging** - Método `.debug()` para ver estado
7. ✅ **Fallback** - `.otherwise()` para default
8. ✅ **Composable** - Chain múltiplas macros

---

## 🐛 Troubleshooting

### Macro não executa
**Problema**: Código dentro de `.when()` não roda
**Solução**: Certifique-se de chamar `.execute()` no final

```javascript
// ❌ Errado
ConfigMacros.when('browser', () => { /* ... */ });

// ✅ Correto
ConfigMacros.when('browser', () => { /* ... */ }).execute();
```

### Ambiente detectado incorretamente
**Problema**: `getEnvironment()` retorna 'browser' quando deveria ser 'windows'
**Solução**: Verifique `app.json`:

```json
{
  "environment": "windows"  // ← Mude aqui
}
```

### Macro executada em ambiente errado
**Problema**: Código windows executa em browser
**Solução**: Use `.unless()` ou `.when()` corretamente

```javascript
// ❌ Errado - executa em TUDO
ConfigMacros.onWindows(() => { /* ... */ });

// ✅ Correto - executa APENAS em windows
ConfigMacros.when('windows', () => { /* ... */ }).execute();
```

---

## 🚀 Próximos Passos

1. **Integrar macros em ecu-communication.js** para múltiplos protocolos
2. **Adicionar persistência por ambiente** em cookies.js
3. **Criar Logger por plataforma** com níveis de verbosidade
4. **Implementar Health Checks** específicos por ambiente
5. **Adicionar configuração dinâmica** (mudar app.json em runtime)

---

**Versão**: 1.0  
**Data**: Dezembro 2025  
**Status**: ✅ Pronto para produção
