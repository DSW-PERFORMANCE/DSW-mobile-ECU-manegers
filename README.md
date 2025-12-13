# DSW Mobile ECU Manager - Documentação Completa

## 📋 Visão Geral

Sistema modular de gerenciamento e monitoramento de ECU (Engine Control Unit) em tempo real com dashboard configurável, visualização de dados em múltiplos formatos, suporte a múltiplas plataformas e persistência de configurações.

<img width="1361" height="627" alt="image" src="https://github.com/user-attachments/assets/3ca8fc57-1ed4-409f-9f24-e740c9723d36" />

---

## 🏗️ Estrutura de Arquivos

### Arquivos de Configuração

#### **app.json** - Configuração Global da Aplicação
```json
{
  "version": "1.0",
  "environment": "browser",
  "timestamp": 1702436400,
  "data": {}
}
```
- **Propósito**: Controla ambiente de execução, persistência de dados, comportamento geral
- **Usado por**: `cookies.js`, `ecu-communication.js`
- **Lido em**: Inicialização da aplicação

#### **su.json** - Configuração de Widgets e Campos de Dados
- **Propósito**: Define estrutura de dados da ECU, widgets disponíveis, campos dinâmicos
- **Formato**: Array de widgets com propriedades específicas
- **Carregado por**: `ecu-manager.js` → distribuído para outros módulos

---

## 🔄 Ordem de Inicialização

```
index.html
  ↓ Carrega scripts em ordem:
  1. cookies.js           → StorageManager (abstração de persistência)
  2. notifications.js     → Sistema de notificações
  3. dialogs.js          → Caixas de diálogo
  4. history.js          → Histórico de ações
  5. table3d-controller.js → Widget Table3D
  6. widgets.js          → Widget comum (gauge, bar, etc)
  7. ecu-communication.js → Comunicação com ECU
  8. ecu-manager.js      → Carrega su.json, coordena sistema
  9. config-export-import.js → Import/export de configurações
  10. common-info.js     → Dados comuns (lê su.json)
  11. dashboard-scale.js → Responsividade do dashboard
  12. dashboard.js       → Sistema de dashboard configurável
  13. main.js            → Coordenação final
```

---

## 📁 Detalhamento de Arquivos

### **cookies.js** - Abstração de Persistência
**Responsabilidades:**
- Detectar/carregar ambiente de app.json
- Abstrair localStorage vs outras plataformas
- Serializar/desserializar com metadata

**Classe Principal:**
```javascript
class StorageManager {
  loadAppConfig()          // Carrega app.json
  getEnvironment()         // Retorna: 'browser' | 'webview' | 'windows'
  getVersion()             // Retorna versão do app
  async save(key, data)    // Salva com metadata
  async load(key)          // Carrega dados
  async remove(key)        // Remove dados
}
```

**Uso:**
```javascript
await window.StorageManager.save('key', data);
const data = await window.StorageManager.load('key');
```

---

### **ecu-communication.js** - Comunicação com ECU
**Responsabilidades:**
- Comunicação com ECU (serial, WebSocket, HTTP)
- Enviar/receber comandos
- Gerenciar status online/offline
- Suporte a múltiplos ambientes

**Classe Principal:**
```javascript
class ECUCommunication {
  loadAppConfig()           // Carrega app.json
  getEnvironment()          // Retorna ambiente atual
  isEnvironment(env)        // Verifica ambiente
  async sendCommand(cmd, val) // Envia comando
  async queryCommand(cmd)   // Consulta valor
  setConfig(config)         // Define configuração
  setStatus(online)         // Atualiza status
  getStatus()              // Retorna status
  getDefaultValue(cmd)      // Valor padrão para comando
}
```

**Uso:**
```javascript
const ecuManager = new ECUCommunication();
await ecuManager.sendCommand('RPM', 3000);
const rpm = await ecuManager.queryCommand('RPM');
```

---

### **ecu-manager.js** - Coordenador Principal
**Responsabilidades:**
- Carregar su.json
- Distribuir configuração para módulos
- Coordenar atualização de widgets
- Gerenciar dados dinâmicos

**Funções Principais:**
```javascript
loadConfig()               // Carrega su.json
getDataFields()           // Retorna campos disponíveis
notifyUpdate(data)        // Notifica alteração de dados
addEventListener(cb)      // Registra listener
removeEventListener(cb)   // Remove listener
```

**Dados Globais:**
```javascript
window.ecuManager = new ECUCommunication()
window.ecuManager.config = { /* su.json */ }
```

---

### **common-info.js** - Sistema de Dados Dinâmicos
**Responsabilidades:**
- Manter estado global de dados da ECU
- Sincronizar com ecu-communication
- Disparar eventos de atualização

**Classe Principal:**
```javascript
class CommonInfo {
  constructor()
  addListener(callback)        // Adiciona listener para mudanças
  removeListener(callback)     // Remove listener
  notifyListeners()           // Dispara evento commoninfoUpdated
  async updateFromECU()       // Atualiza valores da ECU
  static get data()           // Dados atuais
  static get config()         // Configuração (su.json)
}
```

**Eventos:**
- `commoninfoUpdated`: Disparado quando dados mudam

**Dados Globais:**
```javascript
window.CommonInfo.data    // { fieldId: { value, label, ... } }
window.CommonInfo.config  // { dataFields: [...] }
```

---

### **dashboard.js** - Sistema de Dashboard Configurável
**Responsabilidades:**
- Renderizar elementos do dashboard
- Sincronizar com CommonInfo
- Permitir edição/reposicionamento
- Exportar/importar configurações

**Funções Principais:**
```javascript
renderViewMode()           // Renderiza visualização
renderEditMode()          // Renderiza modo edição
openQuickStatsModal()     // Abre painel de stats rápidos
generateShareCode()       // Gera código de compartilhamento
importShareCode(code)     // Importa configuração
saveElements(list)        // Salva elementos
loadElements()           // Carrega elementos
```

**Tipos de Elementos:**
- `gauge`: Velocímetro
- `bar`: Barra de preenchimento
- `bar-marker`: Barra com marcador
- `bar-pointer`: Barra com ponteiro vertical
- `led`: LED (acende/apaga)
- `text`: Texto estático
- `conditional-text`: Texto condicionado ao valor
- `button`: Botão de ação
- `digital`: Número digital

**Persistência:**
- Chave: `dsw_dashboard_elements_v1`
- Formato: JSON com metadata (StorageManager)

---

### **widgets.js** - Componentes de Visualização
**Responsabilidades:**
- Criar elementos visuais (gauge, bar, etc)
- Aplicar estilos CSS
- Gerenciar interatividade

**Widgets Suportados:**
```javascript
createGaugeElement(e)       // Velocímetro/medidor
createBarElement(e)         // Barra de preenchimento
createBarMarkerElement(e)   // Barra com marcador
createBarPointerElement(e)  // Barra com ponteiro
createLEDElement(e)        // LED (acende/apaga/pisca)
createTextElement(e)       // Texto estático
createConditionalText(e)   // Texto condicionado
createButtonElement(e)     // Botão
createDigitalElement(e)    // Display numérico
```

---

## 🔄 Fluxo de Dados

### Inicialização
```
1. index.html carrega
2. cookies.js: StorageManager carrega app.json
3. ecu-communication.js: ECUCommunication carrega app.json
4. ecu-manager.js: Carrega su.json via fetch()
5. common-info.js: Inicializa CommonInfo com su.json
6. dashboard.js: Carrega elementos salvos via StorageManager
7. main.js: Sincroniza CommonInfo com valores iniciais
8. Widgets iniciais renderizados
```

### Atualização de Dados
```
ECU (hardware/simulador)
  ↓
ecu-communication.queryCommand() 
  ↓
common-info.updateFromECU()
  ↓
window.dispatchEvent('commoninfoUpdated')
  ↓
dashboard.updateQuickStats()
  ↓
updateElement() para cada widget
  ↓
Widgets atualizam em tempo real
```

### Atualização Visual
```
CommonInfo.notifyListeners()
  ↓
dispatchEvent('commoninfoUpdated')
  ↓
dashboard.updateQuickStats()  // Atualiza painel rápido
dashboard.updateElement()      // Atualiza cada widget
  ↓
Widget altera:
  - Valor exibido
  - Cor
  - Preenchimento (bar)
  - Estado (LED: on/off/blink)
  - Ponteiro (bar-pointer)
  - Rotação (gauge)
```

---

## ⚙️ Configuração com app.json

### Ambientes Suportados

#### **Browser (Padrão)**
```json
{
  "version": "1.0",
  "environment": "browser",
  "timestamp": 1702436400,
  "data": {}
}
```
- Usa `localStorage` para persistência
- Comunicação simulada com ECU
- Ideal para desenvolvimento/web

#### **WebView** (Futuro)
```json
{
  "version": "1.0",
  "environment": "webview",
  "timestamp": 1702436400,
  "data": {}
}
```
- Integração com Electron, React Native
- Acesso a APIs nativas
- Comunicação com backend local

#### **Windows** (Futuro)
```json
{
  "version": "1.0",
  "environment": "windows",
  "timestamp": 1702436400,
  "data": {}
}
```
- Integração com C#/.NET
- Comunicação via bridge API
- Acesso a recursos Windows

### Detecção de Ambiente
```javascript
// Em qualquer arquivo:
const env = window.StorageManager.getEnvironment(); 
// 'browser' | 'webview' | 'windows'

// Executar lógica específica:
if (window.ecuManager.isEnvironment('browser')) {
  // Usar localStorage
} else if (window.ecuManager.isEnvironment('windows')) {
  // Usar Windows API
}
```

---

## 📊 Estrutura de su.json

```json
{
  "dataFields": [
    {
      "id": "RPM",
      "title": "Rotação do Motor",
      "unit": "rpm",
      "min": 0,
      "max": 8000,
      "default": 1000
    },
    {
      "id": "SPEED",
      "title": "Velocidade",
      "unit": "km/h",
      "min": 0,
      "max": 300,
      "default": 0
    }
  ],
  "widgets": [
    {
      "id": "speed_gauge",
      "type": "gauge",
      "label": "Velocidade",
      "fieldId": "SPEED",
      "min": 0,
      "max": 300,
      "color": "#8B0000"
    }
  ]
}
```

---

## 🎨 Sistema de Cores Dinâmicas

### Cores do Tema (CSS)
```css
--primary-red: #8B0000      /* Cor principal */
--light-red: #ff6666        /* Vermelho claro */
--bg-dark: #1a1a1a          /* Fundo escuro */
--bg-darker: #0f0f0f        /* Fundo mais escuro */
--text-light: #b0b0b0       /* Texto claro */
--border-color: #333333     /* Borda */
```

### Cores Dinâmicas por Widget
Cada widget pode ter cores customizadas:
```javascript
{
  "color": "#FF0000",        // Cor principal
  "coldColor": "#0000FF",    // Cor fria (início)
  "hotColor": "#FF0000",     // Cor quente (fim)
  "colorOff": "#333333",     // Cor desligada (LED)
  "dangerColor": "#FF0000",  // Zona de perigo
  "warningColor": "#FFAA00"  // Zona de alerta
}
```

---

## 🚀 Quick Stats (Dashboard Externa)

Sistema de exibição rápida de até 4 valores na barra superior.

### Configuração
```javascript
window.quickStatsConfig = [
  {
    id: 'stat1',
    label: 'RPM',
    fieldId: 'RPM',
    divisor: 1,
    color: '#FFD700',
    enabled: true
  },
  // ... até 4 slots
]
```

### Armazenamento
- Chave: `dsw_quick_stats_config_v1`
- Métodos: `saveQuickStatsConfig()`, `initializeQuickStats()`

### Sincronização
- Listener: `commoninfoUpdated` event
- Função: `updateQuickStats()`

---

## 📤 Export/Import

### Versão 2 (v2) - Com Quick Stats
Código: `DSWCFG2:...`

Inclui:
- Dashboard elements
- Quick Stats config

### Versão 1 (v1) - Legacy
Código: `DSWCFG1:...`

Inclui:
- Apenas dashboard elements

### Compatibilidade
- Importa v1 e v2
- Exporta sempre em v2
- Retrocompatível

---

## 🐛 Problemas Conhecidos e Soluções

### Bar-Pointer - Ponteiro Não Marca
**Status**: ✅ CORRIGIDO
- Ponteiro agora atualiza corretamente ao mudar valor

### LED - Não Acende/Pisca
**Status**: ✅ CORRIGIDO
- LED agora muda de cor e pisca conforme threshold
- Estado sincronizado com dados

### Dados Não Carregam
**Status**: ✅ CORRIGIDO
- CommonInfo agora carrega corretamente de su.json
- Sincronização entre módulos melhorada

---

## 🎯 Próximos Passos

1. **Implementar ambientes** (webview, windows)
2. **Adicionar sincronização com backend**
3. **Implementar logging avançado**
4. **Adicionar autenticação**
5. **Criar editor visual de widgets**

---

**Versão**: 1.0  
**Data**: Dezembro 2025  
**Ambiente**: Browser (padrão)
- Gerencia seleção de nó, breadcrumbs, status de modificação/salvo.
- Renderiza widgets conforme seleção.
- Controla busca, proteção de recarregar/voltar, integração com histórico global.
- Funções principais: `init`, `loadConfig`, `renderTree`, `switchToNode`, `saveCurrentScreen`, `reloadCurrentScreen`, `searchTree`, `goHome`.

### widgets.js
- Cria e gerencia widgets: `createSlider`, `createSpinbox`, `createCombobox`, `createToggle`, `createRadio`, `createButton`, `createActionButtons`, `createColorToggle`, `createCheckboxGroup`, `createChart2D`.
- Integra cada widget ao histórico global e ao sistema de modificação/salvo.
- Função `renderWidgets` monta todos os widgets da tela.
- **Color Toggle**: Widget especial que NÃO entra no histórico, envia comando direto à ECU.
- **Checkbox Group**: Frame com múltiplas checkboxes independentes, cada uma com seu comando e valores customizáveis.
 - **Linked Radio (`linked_radio`)**: Radio especial que pode ser renderizado em vários blocos com o mesmo `group` id. Todas as opções com o mesmo `group` compartilham seleção e escrevem no mesmo `command`.

### dialogs.js
Sistema central de diálogos:
- `confirm(title, message)`: Confirmação (OK/Cancelar)
- `info(title, message, icon)`: Informação (OK, com ícone)
- `promptValues(title, fields, icon)`: Solicita um ou mais valores, com validação, ícone, títulos e valores padrão
- `showPause(title, message, icon)`: Diálogo de pausa/carregando, não pode ser fechado pelo usuário
- `editPointCoordinates(point, xMin, xMax, yMin, yMax, xLocked)`: Edição de coordenadas do gráfico 2D

### notifications.js
- Funções: `success`, `error`, `warning`, `info`, `show`, `clear`.
- Gerencia notificações visuais para feedback de ações.

### history.js
- Gerenciador global de histórico (undo/redo) para todos os widgets.
- Funções: `push`, `undo`, `redo`, `clear`, `setButtons`, `createSnapshot`.

### ecu-communication.js
- Gerencia comunicação simulada com a ECU.
- Funções: `sendCommand`, `queryCommand`, `saveCurrentScreen`, `reloadCurrentScreen`, `getDefaultValue`, `getAllDefaultValues`, `showNotification`.

### su.json
Arquivo de configuração dos parâmetros, widgets e estrutura da árvore de navegação. Exemplo de comandos/widgets:
```
// Injeção
tipologia/b_a/tempo_100 (slider)
fuel_corr_a (spinbox)
bank_a_enable (toggle)
tipologia/b_b/tempo_100 (slider)
fuel_corr_b (spinbox)
bank_b_enable (toggle)

// Ignição
ign_advance (slider)
ign/dl_base (slider)
tipologia/padrao/ingn (combobox)
ignc/dl_perVol (chart2d)

// Sensores
temp_sensor_type (combobox)
temp_calibration (spinbox)
map_calibration (slider)

// Limites
rpm_limit (spinbox)
rpm_limiter_enable (toggle)
```

### bootstrap.js / bootstrap-5.3.8-dist/
Biblioteca de componentes visuais e ícones (Bootstrap e Bootstrap Icons).

## Exemplos de Uso das Funções

### Exemplo de Diálogo de Confirmação
```js
await window.dialogManager.confirm('Salvar alterações?', 'Deseja salvar antes de sair?');
```

### Exemplo de Diálogo de Informação
```js
await window.dialogManager.info('Operação concluída', 'Os dados foram salvos com sucesso!', 'bi-check-circle-fill');
```

### Exemplo de Diálogo de Valores Múltiplos
```js
const resultado = await window.dialogManager.promptValues('Editar parâmetros', [
  { label: 'RPM', type: 'number', default: 7000, min: 1000, max: 12000 },
  { label: 'Modo', type: 'select', default: '2', options: [
    { label: 'Sequencial', value: '2' },
    { label: 'Semi-Sequencial', value: '1' },
    { label: 'Distributivo', value: '0' }
  ] }
]);
```

### Exemplo de Widget Chart2D
```js
// Widget tipo gráfico 2D, arraste pontos ou Shift+Clique para editar
{
  type: 'chart2d',
  title: 'Correção de Dwell por Voltagem',
  command: 'ignc/dl_perVol',
  mode: 'y',
  xFixed: [6,8,10,12,14,16,18],
  yMin: -50,
  yMax: 154,
  default: '150,120,100,100,95,90,85'
}
```

### Exemplo de Widget Action Buttons
```js
// Widget com múltiplos botões de ação
{
  type: 'action_buttons',
  title: 'Controle de Teste',
  description: 'Botões com diferentes modos',
  buttons: [
    {
      label: 'Teste 1 (Press/Release)',
      icon: 'bi-power',
      color: 'red',
      mode: 'press_release',  // Apertar: press, Soltar: release
      commandPress: 'test_btn_1_press',
      commandRelease: 'test_btn_1_release'
    },
    {
      label: 'Teste 2 (Toggle)',
      icon: 'bi-play-fill',
      color: 'green',
      mode: 'toggle',  // 1º clique: press, 2º clique: release
      commandPress: 'test_btn_2_on',
      commandRelease: 'test_btn_2_off'
    }
  ]
}
```

**Modos disponíveis**:
- `press_release` (padrão): Envia `commandPress` ao apertar, `commandRelease` ao soltar
- `toggle`: Envia `commandPress` no 1º clique, `commandRelease` no 2º clique (alterna visualmente)

**Propriedades por botão**:
- `label`: Texto exibido no botão
- `icon`: Ícone Bootstrap Icons (ex: `bi-power`, `bi-play-fill`)
- `color`: Cor do botão (padrão: `red`) - red, blue, green, yellow, purple, orange
- `mode`: Modo de operação (padrão: `press_release`) - `press_release` ou `toggle`
- `commandPress`: Comando enviado ao apertar/primeira vez
- `commandRelease`: Comando enviado ao soltar/segunda vez
- **Sem valores**: Nenhum botão envia valores, apenas comandos

### Exemplo de Widget Color Toggle
```js
// Widget que alterna cores ao clicar (envia comando direto, SEM histórico)
{
  type: 'color_toggle',
  title: 'Modo de Energia',
  description: 'Clique para alternar o modo de energia',
  command: 'energy_mode',
  icon: 'bi-lightning-charge',
  label: 'Energia',
  colors: ['red', 'blue', 'green'],  // Ciclo de cores ao clicar
  valueMap: {
    red: 'eco',
    blue: 'normal',
    green: 'sport'
  },
  toggleOnRelease: false  // Se true, muda cor ao soltar também
}
```

**Características do Color Toggle**:
- ✅ **Envia comando direto** à ECU (sem passar por histórico)
- ✅ **Alternância de cores**: Cicla entre cores configuradas a cada clique
- ✅ **Sem alterar valores**: Não modifica valores de outros widgets
- ✅ **NÃO registra em histórico**: Ações de toggle não entram em undo/redo
- ✅ **Notificação instantânea**: Mostra feedback visual ao clicar
- ✅ **Opcional**: `valueMap` permite mapear cores para valores específicos
- ✅ **Toggle duplo**: `toggleOnRelease` permite mudar cor novamente ao soltar

**Propriedades**:
- `command`: Comando enviado ao ECU
- `icon`: Ícone do botão
- `label`: Texto exibido
- `colors`: Array de cores para ciclar (padrão: todas as cores)
- `valueMap`: Objeto que mapeia cores para valores (opcional)
- `toggleOnRelease`: Se `true`, muda cor novamente ao soltar (padrão: `false`)

### Exemplo de Widget Checkbox Group
```js
// Frame com múltiplas checkboxes, cada uma com seu comando
{
  type: 'checkbox_group',
  title: 'Configurações de Diagnóstico',
  description: 'Marque as opções desejadas',
  checkboxes: [
    {
      label: 'Ativar Log de Dados',
      command: 'diag_enable_logging',
      icon: 'bi-file-earmark-text',
      help: 'Registra todos os parâmetros',
      valueOn: 1,
      valueOff: 0
    },
    {
      label: 'Monitorar Sensores',
      command: 'diag_monitor_sensors',
      icon: 'bi-graph-up',
      help: 'Monitora leitura em tempo real',
      valueOn: 1,
      valueOff: 0
    }
  ]
}
```

**Características do Checkbox Group**:
- ✅ **Frame visual**: Engloba múltiplas checkboxes
- ✅ **Comandos independentes**: Cada checkbox tem seu próprio comando
- ✅ **Valores customizáveis**: `valueOn` e `valueOff` podem ser qualquer valor
- ✅ **Ícones opcionais**: Cada checkbox pode ter um ícone
- ✅ **Help text**: Descrição debaixo de cada opção
- ✅ **Histórico integrado**: Entra em undo/redo
- ✅ **Múltiplas seleções**: Pode marcar várias ao mesmo tempo

**Propriedades por Checkbox**:
- `label`: Texto exibido
- `command`: Comando enviado ao ECU
- `icon`: Ícone (Bootstrap Icons) - opcional
- `help`: Texto de ajuda debaixo - opcional
- `valueOn`: Valor enviado quando marcada (padrão: 1)
- `valueOff`: Valor enviado quando desmarcada (padrão: 0)

## Atalhos e Comportamentos
- **Ctrl+Z**: Desfazer última alteração
- **Ctrl+Y**: Refazer alteração desfeita
- **Botão de recarregar**: Pede confirmação se houver alterações não salvas
- **Botão de voltar (home)**: Pede confirmação se houver alterações não salvas
- **Busca**: Use `/` para busca hierárquica (ex: `Ignição / Bobinas`)
- **Gráfico 2D**: Arraste pontos, Shift+Clique para editar, interpolação, reset, tooltip dinâmico
- **Color Toggle**: Clique para alternar cores, envia comando direto (sem histórico)
- **Checkbox Group**: Marque múltiplas opções, cada uma com seu comando
- **Diálogos**: Ícones customizáveis, múltiplos campos, validação, pausa/carregando

## Observações

- O histórico é sempre zerado ao trocar de aba ou recarregar valores.
- O sistema de diálogos pode ser expandido para novos tipos conforme necessidade.
- Todos os widgets são integrados ao histórico global e ao sistema de modificação/salvo.
- **Toggle widget**: Corrigido - agora apenas marca como modificado se o valor realmente mudou.

