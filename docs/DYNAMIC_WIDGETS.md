# Sistema de Widgets Dinâmicos

## Visão Geral

O sistema de **widgets dinâmicos** permite que widgets alterem seus parâmetros (título, calibragem, range, etc.) conforme um valor externo (parâmetro da ECU) muda. Isso é útil para adaptar a interface de acordo com o modo de operação, tipo de motor ou outras variáveis.

## Conceito

Um widget dinâmico funciona assim:

1. **parameterCommand**: Define qual valor da ECU vai controlar as variações
2. **parameterVariations**: Mapa de diferentes configurações baseado no valor do parâmetro
3. **defaultVariation**: Configuração usada quando não há contato com a ECU ou o valor é undefined
4. O widget se **recompila automaticamente** quando o valor do parâmetro muda

## Estrutura JSON

```json
{
  "type": "slider",
  "title": "Tempo de Injeção",
  "command": "tipologia/b_a/tempo_100",
  "unit": "ms",
  
  // Configuração dinâmica:
  "parameterCommand": "motor_type",
  "defaultVariation": "1",
  "parameterVariations": {
    "1": {
      "title": "Tempo de Injeção (Motor 1 - Gasolina)",
      "min": 0,
      "max": 15,
      "default": 10,
      "help": "Calibração para motor a gasolina"
    },
    "2": {
      "title": "Tempo de Injeção (Motor 2 - Álcool)",
      "min": 0,
      "max": 22,
      "default": 14,
      "help": "Calibração para motor a álcool"
    },
    "3": {
      "title": "Tempo de Injeção (Motor 3 - Flex)",
      "min": 0,
      "max": 25,
      "default": 12,
      "help": "Calibração para motor flex fuel"
    }
  }
}
```

## Campos Suportados

Qualquer campo de widget pode ser alterado dinamicamente através de `parameterVariations`:

- `title` - Nome do widget
- `help` - Texto de ajuda
- `command` - **⚠️ CRÍTICO: Comando pode mudar!** Ver seção abaixo
- `min` - Valor mínimo (para slider, spinbox, etc.)
- `max` - Valor máximo
- `step` - Incremento (para spinbox)
- `default` - Valor padrão
- `options` - Para combobox (array de {label, value})
- `colors` - Para color_toggle (array de cores)
- `checkboxes` - Para checkbox_group (array de configs)
- ... qualquer outro parâmetro específico do widget

## ⚠️ CRÍTICO: Comando Dinâmico

### Problema

O `command` pode **mudar entre variações**! Isso é extremamente importante:

```json
{
  "command": "sensor_base",
  "parameterVariations": {
    "temperature": {
      "command": "sensor_temperature"  // ← COMANDO DIFERENTE!
    },
    "pressure": {
      "command": "sensor_pressure"    // ← OUTRO COMANDO!
    }
  }
}
```

### Por Que Isso É Perigoso

Se o comando muda mas o sistema continua usando o valor antigo:

1. ❌ Widget mostra valor do comando **anterior**
2. ❌ Usuário muda a interface, alterar comando **errado**
3. ❌ ECU recebe dados para comando **errado**
4. ❌ **DADOS INCONSISTENTES** 🚨

### Como Funciona a Proteção

**Ordem CRÍTICA de operações:**

```javascript
// 1. Resolver widget (pega a config correta)
const resolvedWidget = widgetManager.resolveWidgetVariation(widget, currentValues);

// 2. Extrair comando resolvido
const command = resolvedWidget.command;

// 3. Buscar valor do NOVO comando
const value = currentValues[command];  // ✅ Correto!

// 4. Usar comando resolvido em callbacks
onValueChange(command, newValue);      // ✅ Correto!

// ❌ NUNCA fazer isso:
const value = currentValues[widget.command];  // ← Pode estar desatualizado!
```

### Implementação

Todas as referências ao comando agora usam o comando **resolvido**:

- `renderWidgets()` extrai `resolvedCommand`
- `createWidget()` recebe widget já resolvido
- Callbacks usam comando resolvido
- Indicador de modificação usa comando resolvido

## Campos Suportados

### Cenário: Calibração de Combustível por Tipo de Motor

```json
{
  "type": "spinbox",
  "title": "Correção de Combustível",
  "help": "Correção percentual de combustível",
  "command": "fuel_corr_a",
  "unit": "%",
  "parameterCommand": "motor_type",
  "defaultVariation": "1",
  "parameterVariations": {
    "1": {
      "title": "Correção de Combustível (Gasolina)",
      "min": -30,
      "max": 30,
      "step": 1,
      "help": "Faixa otimizada para gasolina"
    },
    "2": {
      "title": "Correção de Combustível (Álcool)",
      "min": -50,
      "max": 50,
      "step": 2,
      "help": "Faixa otimizada para álcool (maior variação)"
    }
  }
}
```

**Comportamento:**
- Quando `motor_type = 1`: Widget mostra range de -30 a 30%, step de 1
- Quando `motor_type = 2`: Widget muda para -50 a 50%, step de 2
- Se `motor_type` não tiver sido definido: Usa a `defaultVariation` ("1")
- O widget se **recompila em tempo real** quando `motor_type` muda

## Como Funciona Internamente

### Resolução de Variação

```javascript
resolveWidgetVariation(widget, currentValues)
```

1. Lê o valor atual de `currentValues[parameterCommand]`
2. Procura a variação correspondente em `parameterVariations`
3. Se não encontrar, usa `defaultVariation`
4. Mescla a variação com a configuração base do widget

### Listeners Automáticos

```javascript
subscribeToValueChange(command, callback)
```

- Quando o `parameterCommand` muda (ex: `motor_type` muda de 1 para 2)
- Todos os listeners registrados são notificados
- O widget é recompilado com a nova configuração
- Título, help, range etc. são atualizados em tempo real

## Limitações e Notas

1. **Performance**: Para muitos widgets dinâmicos, considere o desempenho de recompilação
2. **Valores Salvos**: Quando um widget muda de tipo ou range, o valor anterior é preservado (se dentro do novo range)
3. **Histórico**: Mudanças de parâmetros disparam histórico apenas ao final da alteração do widget
4. **Compatibilidade**: Funciona com todos os tipos de widgets (slider, spinbox, combobox, toggle, radio, etc.)

## Implementação Técnica

### Arquivos Modificados

- **widgets.js**:
  - `resolveWidgetVariation()` - Resolve configuração dinâmica
  - `renderWidgets()` - Registra listeners
  - `createWidget()` - Usa widget resolvido
  
- **ecu-manager.js**:
  - `subscribeToValueChange()` - Permite inscrição em mudanças
  - `_notifyValueChangeListeners()` - Notifica subscribers
  - `onValueChange()` - Chamado quando valor muda

### Fluxo de Dados

```
ECU envia novo valor → ecuCommunication recebe
  ↓
ecuManager.onValueChange() → Salva em currentValues
  ↓
ecuManager._notifyValueChangeListeners() → Notifica listeners
  ↓
Widget listener acionado → resolveWidgetVariation()
  ↓
Widget recompilado com nova configuração
```

## Exemplo de Uso Avançado

```json
{
  "type": "combobox",
  "title": "Modo de Operação",
  "command": "operation_mode",
  "parameterCommand": "advanced_mode",
  "defaultVariation": "0",
  "parameterVariations": {
    "0": {
      "title": "Modo de Operação (Simples)",
      "help": "Opções básicas",
      "options": [
        {"label": "Eco", "value": "0"},
        {"label": "Normal", "value": "1"}
      ]
    },
    "1": {
      "title": "Modo de Operação (Avançado)",
      "help": "Todas as opções disponíveis",
      "options": [
        {"label": "Eco", "value": "0"},
        {"label": "Normal", "value": "1"},
        {"label": "Sport", "value": "2"},
        {"label": "Custom", "value": "3"}
      ]
    }
  }
}
```

Neste exemplo:
- Se `advanced_mode = 0`: Mostra apenas Eco e Normal
- Se `advanced_mode = 1`: Mostra Eco, Normal, Sport e Custom
- Muda dinamicamente conforme o usuário ativa/desativa modo avançado

## Debug

Para debug de widgets dinâmicos, abra o console e verifique:

```javascript
// Ver todas as variações de um widget
window.widgetManager.dynamicWidgets

// Ver instâncias de widgets dinâmicos ativos
window.widgetManager.dynamicWidgetInstances

// Ver listeners registrados
window.ecuManager._valueChangeListeners
```
