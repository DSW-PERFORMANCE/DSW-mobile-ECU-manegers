# ComboBox Melhorada - Modo Moderno

## Visão Geral

A ComboBox agora suporta dois modos de operação:
- **`modern`** (padrão): Modal com busca, lista com scroll, botões de ação
- **`classic`**: Comportamento original com dropdown inline

## Modo Moderno

### Características

✅ **Modal flutuante** - Não preenche toda a tela
✅ **Campo de busca** - Filtra opções em tempo real
✅ **Lista com scroll** - Apenas a lista scrolla, não o modal
✅ **Botões de ação** - Cancelar e Aplicar
✅ **Teclado** - Pressione ESC para fechar
✅ **Design responsivo** - Adapta-se ao tamanho da tela

### Estrutura JSON

```json
{
  "type": "combobox",
  "title": "Modo de Ignição",
  "help": "Selecione o modo de operação da ignição",
  "command": "tipologia/padrao/ingn",
  "mode": "modern",
  "options": [
    {"label": "Sequencial", "value": "2"},
    {"label": "Semi-Sequencial", "value": "1"},
    {"label": "Distributivo", "value": "0"}
  ],
  "default": "0"
}
```

### Campos

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|-------------|--------|-----------|
| `type` | string | ✓ | - | Deve ser `"combobox"` |
| `command` | string | ✓ | - | Comando da ECU |
| `title` | string | ✓ | - | Título do widget |
| `help` | string | - | - | Texto de ajuda |
| `options` | array | ✓ | - | Array de `{label, value}` |
| `default` | any | ✓ | - | Valor padrão |
| `mode` | string | - | `"modern"` | `"modern"` ou `"classic"` |

## Modo Clássico

### Estrutura JSON

```json
{
  "type": "combobox",
  "title": "Tipo de Sensor",
  "command": "temp_sensor_type",
  "mode": "classic",
  "options": [
    {"label": "NTC 10K", "value": "0"},
    {"label": "NTC 5K", "value": "1"},
    {"label": "PT100", "value": "2"}
  ],
  "default": "0"
}
```

Comporta-se como um `<select>` HTML padrão, sem modal.

## Interação do Usuário

### Modo Moderno

1. Clica no botão de seleção (mostra valor atual)
2. Abre modal com lista de opções
3. (Opcional) Digita na busca para filtrar
4. Clica na opção desejada OU botão "Aplicar"
5. Clica "Cancelar" para fechar sem mudar
6. Pressiona ESC para fechar (sem mudanças)

### Modo Clássico

1. Clica no dropdown
2. Seleciona opção
3. Valor muda imediatamente

## Exemplo com Variações Dinâmicas

```json
{
  "type": "combobox",
  "title": "Modo de Operação",
  "command": "operation_mode",
  "parameterCommand": "advanced_mode",
  "defaultVariation": "0",
  "parameterVariations": {
    "0": {
      "mode": "classic",
      "help": "Modo simples",
      "options": [
        {"label": "Eco", "value": "0"},
        {"label": "Normal", "value": "1"}
      ]
    },
    "1": {
      "mode": "modern",
      "help": "Modo avançado com busca",
      "options": [
        {"label": "Eco", "value": "0"},
        {"label": "Normal", "value": "1"},
        {"label": "Sport", "value": "2"},
        {"label": "Custom", "value": "3"}
      ]
    }
  },
  "default": "0"
}
```

Quando `advanced_mode` muda:
- Se = 0: ComboBox clássica com 2 opções
- Se = 1: ComboBox moderna com 4 opções

## Resolução de Comando Dinâmico

### Problema Resolvido

Quando um widget tem `parameterVariations`, o comando pode mudar! Isso causaria problemas de referência.

**Solução implementada:**

1. `getResolvedCommand()` resolve o comando ANTES de renderizar
2. `resolveWidgetVariation()` aplica a variação correta
3. Garantir que sempre usamos o comando correto

```javascript
// CORRETO:
const resolvedCommand = widgetManager.getResolvedCommand(widget, currentValues);
onValueChange(resolvedCommand, newValue);

// ERRADO:
onValueChange(widget.command, newValue); // Pode estar desatualizado!
```

## Estilos Personalizáveis

As cores seguem o tema da aplicação:

```css
--primary-red: #8B0000
--dark-red: #5a0000
--light-red: #a52a2a
--bg-dark: #1a1a1a
--bg-darker: #0f0f0f
--text-light: #e0e0e0
--border-color: #3a3a3a
```

### Elementos Estilizados

- `.combobox-display-button` - Botão de exibição
- `.combobox-modal-overlay` - Overlay escuro
- `.combobox-modal` - Caixa modal
- `.combobox-search-input` - Campo de busca
- `.combobox-option-item` - Item da lista
- `.combobox-option-item.selected` - Item selecionado
- `.btn-cancel`, `.btn-apply` - Botões de ação

## Acessibilidade

✅ Labels proper para inputs
✅ Controles via teclado (ESC para fechar)
✅ Suporte a screen readers (aria-label)
✅ Contraste de cores adequado
✅ Focus visible em todos os botões

## Performance

- Modal criado sob demanda (não mantém DOM)
- Busca otimizada com `toLowerCase()`
- Scroll apenas na lista (não no modal)
- Animações suaves com CSS

## Compatibilidade

- ✅ Chrome/Chromium 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+

## Exemplos Práticos

### Exemplo 1: Simples (Moderno)

```json
{
  "type": "combobox",
  "title": "Marca do Carro",
  "command": "car_brand",
  "options": [
    {"label": "Toyota", "value": "1"},
    {"label": "Honda", "value": "2"},
    {"label": "Ford", "value": "3"}
  ],
  "default": "1"
}
```

### Exemplo 2: Com Muitas Opções

```json
{
  "type": "combobox",
  "title": "Modelo do Motor",
  "command": "engine_model",
  "mode": "modern",
  "options": [
    {"label": "1.0L 3-Cyl", "value": "0"},
    {"label": "1.5L 4-Cyl", "value": "1"},
    {"label": "2.0L 4-Cyl Turbo", "value": "2"},
    {"label": "2.5L V6", "value": "3"},
    {"label": "3.0L V6 Twin-Turbo", "value": "4"},
    {"label": "3.5L V8", "value": "5"}
  ],
  "default": "1"
}
```

Com muitas opções, o modo moderno com busca é altamente recomendado!

### Exemplo 3: Dinâmica por Tipo de Motor

```json
{
  "type": "combobox",
  "title": "Cilindrada",
  "command": "displacement",
  "parameterCommand": "motor_type",
  "defaultVariation": "1",
  "parameterVariations": {
    "1": {
      "mode": "classic",
      "options": [
        {"label": "Gasolina 1.0L", "value": "0"},
        {"label": "Gasolina 1.5L", "value": "1"}
      ]
    },
    "2": {
      "mode": "modern",
      "options": [
        {"label": "Álcool 1.5L", "value": "0"},
        {"label": "Álcool 2.0L", "value": "1"},
        {"label": "Álcool 2.5L", "value": "2"}
      ]
    }
  },
  "default": "0"
}
```

## Troubleshooting

### Modal não abre

Certifique-se de que `window.globalHistoryManager` está definido.

### Busca não funciona

Verifique que o `label` das opções contém o texto esperado (case-insensitive).

### Estilo diferente

Os estilos CSS devem estar carregados. Verifique se `style.css` contém as regras `.combobox-*`.

### Comando desatualizado

Use `getResolvedCommand()` para garantir o comando correto em widgets dinâmicos.
