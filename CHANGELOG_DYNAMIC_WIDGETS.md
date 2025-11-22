# Changelog - Sistema de Widgets Dinâmicos

**Data**: November 21, 2025

## Resumo

Implementado sistema completo de **widgets dinâmicos** que permite alterar parâmetros de widgets em tempo real baseado em valores externos da ECU.

## Alterações

### 1. `widgets.js` - Engine de Widgets Dinâmicos

#### Novo no Constructor
- `dynamicWidgets` (Map) - Rastreamento de widgets com parâmetros dinâmicos
- `dynamicWidgetInstances` (Map) - Instâncias ativas de widgets dinâmicos

#### Novos Métodos
- **`resolveWidgetVariation(widget, currentValues)`**
  - Resolve a configuração efetiva do widget baseado no valor do parâmetro
  - Mescla a variação apropriada com a configuração base
  - Retorna configuração completa do widget

- **`getWidgetInstanceId(widget, index)`**
  - Gera ID único para rastreamento de instância

#### Método Modificado
- **`renderWidgets()`**
  - Limpa listeners antigos antes de re-renderizar
  - Registra listeners para mudanças de parâmetros
  - Suporta recompilação dinâmica de widgets
  - Atualiza título, help, range conforme parâmetro muda

### 2. `ecu-manager.js` - Sistema de Listeners

#### Novo no Constructor
- `_valueChangeListeners` (Map) - Listeners para mudanças de valores
- `linkedRadioGroups` (Object) - Rastreamento de grupos de radio vinculados

#### Novos Métodos
- **`subscribeToValueChange(command, callback)`**
  - Registra listener para mudanças de um comando
  - `callback(newValue)` é chamado quando valor muda

- **`unsubscribeFromValueChange(command, callback)`**
  - Remove listener registrado
  - Necessário para cleanup ao recarregar widgets

- **`_notifyValueChangeListeners(command, value)`**
  - Notifica todos os listeners inscritos em um comando
  - Trata erros em listeners individuais

#### Método Modificado
- **`onValueChange()`**
  - Agora notifica listeners antes de atualizar UI
  - Permite que widgets dinâmicos reajam a mudanças

### 3. `su.json` - Exemplos de Widgets Dinâmicos

#### Exemplo 1: Slider de Tempo de Injeção
```json
{
  "parameterCommand": "motor_type",
  "defaultVariation": "1",
  "parameterVariations": {
    "1": { "title": "Tempo - Motor 1", "min": 0, "max": 15 },
    "2": { "title": "Tempo - Motor 2", "min": 0, "max": 22 },
    "3": { "title": "Tempo - Motor 3", "min": 0, "max": 25 }
  }
}
```

#### Exemplo 2: Spinbox de Correção de Combustível
- Diferentes ranges e steps para cada tipo de motor
- Títulos e helps personalizados por tipo

## Como Usar

### 1. Adicionar Widget Dinâmico ao JSON

```json
{
  "type": "slider",
  "title": "Parâmetro Base",
  "command": "meu_comando",
  "min": 0,
  "max": 100,
  "default": 50,
  
  // Configuração dinâmica:
  "parameterCommand": "variavel_externa",
  "defaultVariation": "padrao",
  "parameterVariations": {
    "padrao": {
      "title": "Título Padrão",
      "min": 0,
      "max": 50
    },
    "avancado": {
      "title": "Título Avançado",
      "min": 0,
      "max": 100,
      "help": "Help customizado"
    }
  }
}
```

### 2. Comportamento

- **Ao carregar**: Widget usa `defaultVariation` ou valor atual de `parameterCommand`
- **Quando muda**: Qualquer mudança em `parameterCommand` dispara recompilação
- **Atualização**: Título, help, range, options - tudo pode mudar dinamicamente
- **Valor preservado**: Valor anterior é mantido se dentro do novo range

## ⚠️ CRÍTICO: Comando Dinâmico

### Problema

Um widget pode ter **comando diferente** em cada variação! Exemplo:

```json
{
  "command": "inj_time_base",
  "parameterVariations": {
    "1": { "command": "inj_time_gasoline" },  // ← Comando DIFERENTE!
    "2": { "command": "inj_time_alcohol" }
  }
}
```

### Risco

Se o comando muda mas o valor **NÃO** é recarregado do novo comando:
- ❌ Widget mostraria valor do comando **antigo**
- ❌ Salvar alteraria o comando **errado**
- ❌ **DESASTRE DATA**: ECU receberia dados inconsistentes

### Solução Implementada

**Ordem crítica de operações:**

1. **ANTES** de tudo: Resolver comando dinâmico
   ```javascript
   const resolvedCommand = widgetManager.getResolvedCommand(widget, currentValues);
   ```

2. **DEPOIS**: Buscar valor do comando resolvido
   ```javascript
   const currentValue = currentValues[resolvedCommand];
   ```

3. **NUNCA**: Usar `widget.command` diretamente se há variações
   ```javascript
   // ❌ ERRADO:
   const value = currentValues[widget.command];
   
   // ✅ CORRETO:
   const resolved = widgetManager.getResolvedCommand(widget, currentValues);
   const value = currentValues[resolved];
   ```

### Quando Comando Pode Mudar

```json
{
  "type": "slider",
  "command": "default_cmd",
  "parameterCommand": "config_type",
  "parameterVariations": {
    "basic": {
      "command": "basic_config",
      "title": "Configuração Básica"
    },
    "advanced": {
      "command": "advanced_config",
      "title": "Configuração Avançada"
    }
  }
}
```

Quando `config_type` muda:
- `basic` → `advanced`: Carrega de `advanced_config`
- `advanced` → `basic`: Carrega de `basic_config`

### Implementação em Widgets

Ao criar widget, **sempre**:

```javascript
createWidget(widget, currentValue, onValueChange) {
    // 1. Resolver widget (pega comando correto)
    const resolved = this.resolveWidgetVariation(widget, currentValues);
    
    // 2. Resolver comando específico
    const command = resolved.command;
    
    // 3. Buscar valor correto
    const value = currentValues[command] !== undefined
        ? currentValues[command]
        : resolved.default;
    
    // 4. Usar comando resolvido em callbacks
    slider.addEventListener('change', (e) => {
        onValueChange(command, e.target.value);  // ← Usar resolvido!
    });
}
```

## Benefícios

✅ **Adaptação Automática** - Interface se adapta sem reload
✅ **Economia de Space** - Menos widgets desnecessários na tela
✅ **Melhor UX** - Ranges e opções relevantes para cada contexto
✅ **Manutenível** - Configuração centralizada no JSON
✅ **Type-Safe** - Sistema usa tipos consistentes
✅ **Seguro** - Comando sempre resolvido corretamente

## Casos de Uso

1. **Tipos de Motor** - Diferentes calibragens por motor
2. **Modos de Operação** - Widget simples vs avançado
3. **Combustível** - Gasolina, álcool, flex fuel
4. **Contexto Dinâmico** - Temperatura, RPM, pressão
5. **Perfis de Usuário** - Novato vs especialista
6. **Comandos Distintos** - Motor 1 vs Motor 2 com parâmetros diferentes

## Testes

Para testar:

1. Simule mudança de `motor_type` (1→2→3)
2. Observe widget recompilado com novo título/range
3. Verifique console para logs de mudanças
4. Confirme que valor anterior é preservado quando possível
5. **CRÍTICO**: Teste mudança de comando
   - Configure widget com comando diferente por variação
   - Mude entre variações
   - Confirme que valores carregam do comando correto
   - Verifique console que comando foi resolvido

## Checklist de Segurança

- [ ] Widget usa `getResolvedCommand()` para comando
- [ ] Widget usa `resolveWidgetVariation()` para configuração
- [ ] Valor carregado DEPOIS de resolver comando
- [ ] Callbacks usam comando resolvido
- [ ] Logs mostram comando correto em console
- [ ] Teste com comando dinâmico diferente em cada variação

## Próximas Etapas Opcionais

- [ ] Cache de variações compiladas (otimização)
- [ ] Validação de valores ao trocar range
- [ ] Animações de transição
- [ ] UI de debug no painel
- [ ] Presets baseados em variações
- [ ] Validação de comandos em tempo de carregamento

## Documentação

Ver `DYNAMIC_WIDGETS.md` para documentação completa e exemplos.
