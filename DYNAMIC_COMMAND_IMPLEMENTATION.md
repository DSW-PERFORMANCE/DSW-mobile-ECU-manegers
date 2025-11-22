# Proteção Contra Comando Dinâmico - Implementação Completa

## 🎯 Objetivo

Garantir que widgets com comando dinâmico (que pode variar por `parameterVariations`) **sempre** carregam e salvam no comando correto, evitando:

- ❌ Carregar valor de comando antigo/errado
- ❌ Salvar alteração no comando errado
- ❌ Inconsistências de dados na ECU

## ✅ Solução Implementada

### 1. Resolução ANTES do Uso

**Princípio**: Resolver o comando **ANTES** de qualquer operação com valores.

```javascript
// Ordem CORRETA:
const resolvedWidget = widgetManager.resolveWidgetVariation(widget, currentValues);
const command = resolvedWidget.command;           // ✅ Comando correto
const value = currentValues[command];             // ✅ Valor correto
```

### 2. Em `widgets.js`

#### Novo Método: `getResolvedCommand()`

```javascript
getResolvedCommand(widget, currentValues = {}) {
    const resolved = this.resolveWidgetVariation(widget, currentValues);
    return resolved.command;
}
```

**Uso**: Quando você precisa do comando resolvido antes de renderizar.

#### Modificação: `renderWidgets()`

```javascript
widgets.forEach((widget, widgetIndex) => {
    // 1. Resolve widget (inclui comando)
    const resolvedWidget = this.resolveWidgetVariation(widget, currentValues);
    
    // 2. Extrai comando resolvido explicitamente
    const resolvedCommand = resolvedWidget.command;
    
    // 3. Usa comando resolvido, NUNCA widget.command
    if (modifiedWidgets.has(resolvedCommand)) { ... }
    
    let widgetCurrentValue;
    if (resolvedWidget.type === 'checkbox_group') {
        widgetCurrentValue = currentValues;
    } else {
        // ✅ Carrega do comando resolvido!
        widgetCurrentValue = currentValues[resolvedCommand] !== undefined
            ? currentValues[resolvedCommand]
            : resolvedWidget.default;
    }
    
    // 4. Passa widget resolvido para createWidget
    const widgetContent = this.createWidget(resolvedWidget, widgetCurrentValue, 
        (cmd, val) => {
            onValueChange(cmd, val, container);
        }
    );
});
```

### 3. Em `ecu-manager.js`

#### Sistema de Notificação

```javascript
// Quando valor muda:
onValueChange(command, value, widgetElement) {
    const normalized = this._normalizeValue(value);
    this.currentValues[command] = normalized;
    
    // ✅ Notifica todos os widgets dinâmicos
    this._notifyValueChangeListeners(command, normalized);
    
    // ... resto do código
}

// Listeners se inscrevem:
subscribeToValueChange(command, callback) {
    if (!this._valueChangeListeners.has(command)) {
        this._valueChangeListeners.set(command, []);
    }
    this._valueChangeListeners.get(command).push(callback);
}
```

## 🔄 Fluxo Completo

### Cenário: Comando muda de `sensor_a` → `sensor_b`

```
1. Usuário muda parameterCommand (ex: motor_type 1 → 2)
   ↓
2. ecuManager.onValueChange("motor_type", 2)
   ↓
3. _notifyValueChangeListeners("motor_type", 2)
   ↓
4. Widget listener acionado
   ↓
5. renderWidgets() chamado NOVAMENTE
   ↓
6. resolveWidgetVariation() retorna config com comando NOVO
   ↓
7. resolvedCommand = "sensor_b" (não "sensor_a"!)
   ↓
8. Carrega value = currentValues["sensor_b"] ✅ CORRETO!
   ↓
9. Widget renderizado com novo comando
   ↓
10. Usuário muda slider
    ↓
11. onValueChange("sensor_b", newValue) ✅ COMANDO CORRETO!
    ↓
12. Salva em currentValues["sensor_b"] ✅ LOCAL CORRETO!
```

## 📋 Exemplo JSON Completo

```json
{
  "type": "slider",
  "title": "Calibração",
  "command": "cal_base",
  "min": 0,
  "max": 100,
  "default": 50,
  
  "parameterCommand": "motor_type",
  "defaultVariation": "1",
  
  "parameterVariations": {
    "1": {
      "title": "Calibração Motor 1",
      "command": "cal_motor_1",
      "min": 0,
      "max": 50,
      "help": "Para motor tipo 1"
    },
    "2": {
      "title": "Calibração Motor 2",
      "command": "cal_motor_2",
      "min": 0,
      "max": 100,
      "help": "Para motor tipo 2"
    }
  }
}
```

## 🛡️ Proteção em Camadas

| Camada | Mecanismo | Proteção |
|--------|-----------|----------|
| **1** | Resolução | `resolveWidgetVariation()` retorna comando correto |
| **2** | Extração | `renderWidgets()` extrai `resolvedCommand` |
| **3** | Uso | Nunca usa `widget.command` quando há variações |
| **4** | Callbacks | Recebe widget já resolvido |
| **5** | Notificação | Listeners reagem a mudanças e rerenderizam |

## 🚨 Checklist de Implementação

Ao adicionar widget com comando dinâmico:

- [ ] Widget tem `parameterCommand`
- [ ] Widget tem `parameterVariations`
- [ ] Cada variação define `command` diferente (se necessário)
- [ ] JSON está válido (use validador)
- [ ] Teste mudança de `parameterCommand` no console
- [ ] Verifique que comando muda no widget
- [ ] Verifique que valor carrega correto
- [ ] Teste salvar e verificar command correto recebeu dados

## 🧪 Testes Sugeridos

### Teste 1: Verificar Resolução

```javascript
const widget = window.ecuManager.config.tree[0].children[0].widgets[0];
const resolved = window.widgetManager.resolveWidgetVariation(widget, 
    window.ecuManager.currentValues);
console.log("Command original:", widget.command);
console.log("Command resolvido:", resolved.command);
// Devem ser diferentes se há variações!
```

### Teste 2: Verificar Carregamento de Valor

```javascript
// Mude motor_type
window.ecuManager.currentValues.motor_type = 2;
window.ecuManager._notifyValueChangeListeners("motor_type", 2);

// Verifique que valor carregou do novo comando
setTimeout(() => {
    console.log("Valor carregado:", window.ecuManager.currentValues);
}, 100);
```

### Teste 3: Verificar Salvamento

```javascript
// Altere widget manualmente
// Console deve mostrar onValueChange com comando correto
// currentValues deve atualizar comando correto

// Verifique:
console.log("Valores atualizados:", window.ecuManager.currentValues);
```

## 📚 Documentação Gerada

1. **CHANGELOG_DYNAMIC_WIDGETS.md**
   - Overview da implementação
   - Seção crítica sobre comando dinâmico

2. **DYNAMIC_WIDGETS.md**
   - Guia completo de uso
   - Exemplos de variações
   - Debugging

3. **COMBOBOX_MODERN.md**
   - ComboBox melhorada com modal
   - Suporte a comando dinâmico
   - Exemplos de uso

4. **EXAMPLE_DYNAMIC_COMMAND.md** (este arquivo)
   - Exemplo prático completo
   - Testes manuais
   - Casos de uso reais
   - Debugging detalhado

## 🎓 Aprendizados Críticos

1. **Ordem importa**: Resolver > Carregar > Usar
2. **Sempre extrair**: Não confiar em `widget.command` com variações
3. **Notificar**: Listeners precisam ser informados de mudanças
4. **Testar**: Especialmente mudança de comando
5. **Documentar**: Deixar claro quando comando pode variar

## 🚀 Próximas Melhorias Opcionais

- [ ] Validação de comando em tempo de carregamento
- [ ] Warning no console se `widget.command` usado diretamente
- [ ] Cache de resolução para performance
- [ ] Teste automatizado de comando dinâmico
- [ ] UI de debug mostrando comando resolvido

## 📞 Suporte

Se encontrar problema:

1. Verifique JSON está bem formatado
2. Use console para verificar `resolvedCommand`
3. Procure por uses de `widget.command` (devem ser raros)
4. Teste listeners estão registrados
5. Verifique `currentValues` tem os comandos esperados

---

**Status**: ✅ IMPLEMENTADO E TESTADO
**Data**: November 21, 2025
**Versão**: 1.0 (Comando Dinâmico Seguro)
