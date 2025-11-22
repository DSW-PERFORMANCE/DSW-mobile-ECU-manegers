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

## Benefícios

✅ **Adaptação Automática** - Interface se adapta sem reload
✅ **Economia de Space** - Menos widgets desnecessários na tela
✅ **Melhor UX** - Ranges e opções relevantes para cada contexto
✅ **Manutenível** - Configuração centralizada no JSON
✅ **Type-Safe** - Sistema usa tipos consistentes

## Casos de Uso

1. **Tipos de Motor** - Diferentes calibragens por motor
2. **Modos de Operação** - Widget simples vs avançado
3. **Combustível** - Gasolina, álcool, flex fuel
4. **Contexto Dinâmico** - Temperatura, RPM, pressão
5. **Perfis de Usuário** - Novato vs especialista

## Testes

Para testar:

1. Simule mudança de `motor_type` (1→2→3)
2. Observe widget recompilado com novo título/range
3. Verifique console para logs de mudanças
4. Confirme que valor anterior é preservado quando possível

## Próximas Etapas Opcionais

- [ ] Cache de variações compiladas (otimização)
- [ ] Validação de valores ao trocar range
- [ ] Animações de transição
- [ ] UI de debug no painel
- [ ] Presets baseados em variações

## Documentação

Ver `DYNAMIC_WIDGETS.md` para documentação completa e exemplos.
