<img width="1367" height="644" alt="image" src="https://github.com/user-attachments/assets/14021f95-1140-4aca-ae9f-5d010b0b0e01" />

# DSW Mobile ECU Manager

## Visão Geral
Este projeto é um gerenciador de parâmetros e configurações para ECUs automotivas, com interface web responsiva e interativa. Permite visualizar, editar, salvar e recarregar valores de diversos widgets, além de operar gráficos 2D, histórico de alterações, busca avançada e sistema de diálogos customizados.

## Documentação atualizada até a versão 6

---

## Visão Geral do Sistema
O sistema inicia carregando o arquivo `su.json` (estrutura de parâmetros e widgets), monta a árvore de navegação e exibe a tela inicial. Ao selecionar um item, os widgets são renderizados e os valores padrão são carregados. O histórico global é inicializado e todos os eventos de modificação são rastreados. A interface é responsiva, com atalhos globais e proteção contra perda de dados.

Fluxo de inicialização:
1. Carregamento do `index.html` e dos scripts principais.
2. Inicialização do `main.js` (atalhos, eventos globais).
3. Carregamento da configuração via `ecu-manager.js` (`su.json`).
4. Renderização da árvore e widgets.
5. Inicialização do histórico global (`history.js`).
6. Instalação dos sistemas de diálogos, notificações e proteção.

## Principais Funcionalidades

- **Widgets Interativos**: Slider, spinbox, combobox, toggle, radio, botão, action buttons, color toggle, checkbox group, gráfico 2D.
- **Gráfico 2D**: Arraste pontos, Shift+Clique para editar, interpolação, reset, tooltip dinâmico.
- **Histórico Global (Undo/Redo)**: Botões e atalhos (Ctrl+Z / Ctrl+Y) para desfazer/refazer alterações em qualquer widget.
- **Color Toggle**: Widget especial que alterna cores e envia comando direto (sem histórico, sem alterar valores).
- **Busca Hierárquica**: Pesquisa por nome ou caminho usando `/`.
- **Breadcrumbs e Status**: Caminho atual, status de modificação/salvo, botão de copiar, indicadores visuais.
- **Diálogos Customizados**: Confirmação, alerta, informação, pausa/carregando, edição de valores (ícones, múltiplos campos, validação).
- **Proteção de Recarregar/Voltar**: Confirmação se houver alterações não salvas.
- **Notificações**: Feedback visual para ações importantes.
- **Mobile Friendly**: Interface adaptada para dispositivos móveis.

## Funcionamento dos Arquivos e Funções

### index.html
Estrutura principal da interface web. Inclui scripts, estilos, área de navegação (`treeView`), área de widgets (`widgetsArea`), botões de salvar/recarregar, barra de status, busca, breadcrumbs.

### style.css
Define cores, layout, responsividade, estilos dos widgets, gráficos, diálogos, notificações, botões, tooltips, indicadores de status.

### main.js
- Inicializa o sistema ao carregar a página.
- Instala atalhos globais (Ctrl+Z/Y para undo/redo).
- Gerencia eventos de orientação e integração com histórico global.

### ecu-manager.js
- Carrega e renderiza a árvore de navegação.
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

