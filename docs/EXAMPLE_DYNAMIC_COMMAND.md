# Exemplo: Widget com Comando Dinâmico

## Problema Resolvido

Este documento demonstra como o sistema **protege contra mudanças de comando**.

## Cenário: Sensor Dinâmico

Suponha que temos:
- **Motor Tipo 1**: Usa sensor de temperatura (`temp_sensor`)
- **Motor Tipo 2**: Usa sensor de pressão (`pressure_sensor`)

O mesmo widget pode mudar de comando!

## Configuração JSON

```json
{
  "type": "slider",
  "title": "Calibração de Sensor",
  "command": "sensor_base_value",
  
  "parameterCommand": "motor_type",
  "defaultVariation": "1",
  
  "parameterVariations": {
    "1": {
      "title": "Calibração de Temperatura",
      "command": "temp_sensor_cal",      // ← COMANDO 1
      "min": -50,
      "max": 50,
      "default": 0,
      "help": "Ajusta calibração do sensor de temperatura"
    },
    "2": {
      "title": "Calibração de Pressão",
      "command": "pressure_sensor_cal",  // ← COMANDO 2 (DIFERENTE!)
      "min": 0,
      "max": 300,
      "default": 100,
      "help": "Ajusta calibração do sensor de pressão"
    }
  }
}
```

## Fluxo de Execução

### Estado Inicial: motor_type = 1

```
1. renderWidgets() chamado
2. resolveWidgetVariation(widget, {motor_type: 1, ...})
3. Retorna: config com command: "temp_sensor_cal"
4. Extrai resolvedCommand = "temp_sensor_cal"
5. Carrega value = currentValues["temp_sensor_cal"]  ✅ CORRETO
6. Widget renderizado com command correto
```

### Mudança: motor_type = 1 → 2

```
1. ecuManager.onValueChange("motor_type", 2)
2. Notifica listeners (widget dinâmico)
3. renderWidgets() chamado novamente
4. resolveWidgetVariation(widget, {motor_type: 2, ...})
5. Retorna: config com command: "pressure_sensor_cal"
6. Extrai resolvedCommand = "pressure_sensor_cal"
7. Carrega value = currentValues["pressure_sensor_cal"]  ✅ CORRETO (NOVO!)
8. Widget recompilado com novo comando
```

## Teste Manual

### Setup

1. Configure widget conforme JSON acima
2. Abra a tela com este widget
3. Abra DevTools (F12)

### Teste 1: Verificar comando inicial

```javascript
// Console:
window.ecuManager.currentValues.temp_sensor_cal
// Output: 0 (valor padrão)

window.ecuManager.currentValues.pressure_sensor_cal
// Output: undefined (ainda não foi carregado)
```

### Teste 2: Mude para motor_type = 2

```javascript
// Console:
window.ecuManager.currentValues.motor_type = 2;
window.ecuManager._notifyValueChangeListeners("motor_type", 2);

// Observe: Widget recompilado com novo comando
// Verifique console para logs:
// [VALOR ALTERADO] motor_type = 2
```

### Teste 3: Verifique widget

```javascript
// Console:
window.widgetManager.dynamicWidgetInstances
// Ver instâncias ativas

// Verifique que widget mostra:
// - Título: "Calibração de Pressão"
// - Range: 0-300 (não -50 a 50)
// - Help texto atualizado
```

### Teste 4: Mude valor

1. No widget, altere o slider para 150
2. Verifique console:

```javascript
// Console:
window.ecuManager.currentValues.pressure_sensor_cal
// Output: 150  ✅ Correto! Salvou no comando novo!

window.ecuManager.currentValues.temp_sensor_cal
// Output: 0  ✅ Intacto! Não foi tocado!
```

### Teste 5: Volte para motor_type = 1

```javascript
// Console:
window.ecuManager.currentValues.motor_type = 1;
window.ecuManager._notifyValueChangeListeners("motor_type", 1);

// Observe: Widget recompilado novamente
// Título muda para "Calibração de Temperatura"
// Range volta para -50 a 50
// Valor volta para 0 (do temp_sensor_cal)

window.ecuManager.currentValues.temp_sensor_cal
// Output: 0  ✅ Mantém valor anterior
```

## Verificação de Segurança ✅

Código relevante em `widgets.js`:

```javascript
renderWidgets(widgets, widgetsArea, currentValues, onValueChange, ...) {
    widgets.forEach((widget, widgetIndex) => {
        // ✅ Resolve widget completo (inclui comando)
        const resolvedWidget = this.resolveWidgetVariation(widget, currentValues);
        
        // ✅ Extrai comando resolvido
        const resolvedCommand = resolvedWidget.command;
        
        // ✅ Usa comando resolvido, NÃO widget.command
        let widgetCurrentValue;
        if (resolvedWidget.type === 'checkbox_group') {
            widgetCurrentValue = currentValues;
        } else {
            widgetCurrentValue = currentValues[resolvedCommand] !== undefined
                ? currentValues[resolvedCommand]           // ✅ Resolvido!
                : resolvedWidget.default;
        }
        
        // ✅ Passa widget resolvido para createWidget
        const widgetContent = this.createWidget(resolvedWidget, widgetCurrentValue, 
            (cmd, val) => {
                onValueChange(cmd, val, container);
            }
        );
        
        // ... resto do código
    });
}
```

## Proteção em Camadas

### Camada 1: Resolução
- `resolveWidgetVariation()` retorna widget completo com comando correto

### Camada 2: Extração
- `renderWidgets()` extrai `resolvedCommand` explicitamente

### Camada 3: Uso
- Todo lugar que usa comando usa `resolvedCommand`, nunca `widget.command`

### Camada 4: Callbacks
- Callbacks recebem widget já resolvido
- Não há ambiguidade

## Casos de Uso Reais

### 1. Multi-Sensor

```json
{
  "command": "sensor_value",
  "parameterCommand": "sensor_type",
  "parameterVariations": {
    "temp": { "command": "temp_sensor" },
    "humidity": { "command": "humidity_sensor" },
    "pressure": { "command": "pressure_sensor" }
  }
}
```

### 2. Perfil de Usuário

```json
{
  "command": "setting_basic",
  "parameterCommand": "user_profile",
  "parameterVariations": {
    "novice": { 
      "command": "setting_basic",
      "title": "Configuração Básica"
    },
    "advanced": { 
      "command": "setting_advanced",
      "title": "Configuração Avançada"
    }
  }
}
```

### 3. Modo de Combustível

```json
{
  "command": "fuel_corr_base",
  "parameterCommand": "fuel_type",
  "parameterVariations": {
    "gasoline": { "command": "fuel_corr_gasoline" },
    "ethanol": { "command": "fuel_corr_ethanol" },
    "flex": { "command": "fuel_corr_flex" }
  }
}
```

## Debugging

Se encontrar problemas, verifique:

```javascript
// 1. Widget está sendo resolvido?
const resolved = window.widgetManager.resolveWidgetVariation(widget, currentValues);
console.log("Resolved widget:", resolved);

// 2. Comando correto?
console.log("Resolved command:", resolved.command);
console.log("Expected command:", expectedCommand);

// 3. Valor sendo carregado correto?
console.log("Value:", currentValues[resolved.command]);

// 4. Listeners registrados?
console.log("Listeners:", window.ecuManager._valueChangeListeners);

// 5. Notificações funcionando?
// (Abra console, mude parâmetro, veja logs)
```

## Pontos Críticos

🔴 **NUNCA** use `widget.command` quando há `parameterVariations`
🟢 **SEMPRE** use `resolveWidgetVariation()` primeiro
🟢 **SEMPRE** extraia `resolvedCommand` explicitamente
🟢 **SEMPRE** teste mudanças de comando

## Conclusão

O sistema está protegido em **múltiplas camadas** contra o uso de comando desatualizado. A resolução de comando acontece **ANTES** de qualquer carregamento de valor, garantindo que nunca haverá inconsistência de dados.
