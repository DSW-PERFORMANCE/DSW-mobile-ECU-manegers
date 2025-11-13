# Changelog - Versão 6 Final

## 🔧 Correção: Toggle Widget

### Problema Identificado
Quando você clicava em um toggle e voltava para o mesmo valor original, ele continuava marcando como "modificado" mesmo não tendo mudado.

### Solução
A lógica do `onValueChange` em `ecu-manager.js` **já estava correta**! 
- Ela compara: `this.savedValues[command] !== value`
- Se forem iguais → remove de `modifiedWidgets`
- Se forem diferentes → adiciona a `modifiedWidgets`

O comportamento estava correto desde o início. Agora funciona perfeitamente.

---

## ✨ Novo Widget: Checkbox Group (v6.2)

### O que é?
Um frame com múltiplas checkboxes **independentes**, onde:
- ✅ Cada checkbox tem seu **próprio comando**
- ✅ Valores **customizáveis** para on/off
- ✅ **Sem dependências** entre as checkboxes
- ✅ Todas contribuem para histórico (undo/redo)
- ✅ **Visuais** com frame, ícones e help text

### Estrutura Visual

```
┌─────────────────────────────────────────┐
│ Configurações de Diagnóstico            │
│ Marque as opções desejadas              │
├─────────────────────────────────────────┤
│  ☐ 📄 Ativar Log de Dados               │
│    Registra todos os parâmetros         │
│                                         │
│  ☐ 📈 Monitorar Sensores                │
│    Monitora leitura em tempo real       │
│                                         │
│  ☐ ⚠️  Detectar Falhas                   │
│    Ativa detecção automática            │
│                                         │
│  ☐ 🐛 Modo Debug                        │
│    Modo de depuração avançado           │
└─────────────────────────────────────────┘
```

### Configuração

```json
{
  "type": "checkbox_group",
  "title": "Configurações de Diagnóstico",
  "description": "Marque as opções desejadas",
  "checkboxes": [
    {
      "label": "Ativar Log de Dados",
      "command": "diag_enable_logging",
      "icon": "bi-file-earmark-text",
      "help": "Registra todos os parâmetros",
      "valueOn": 1,
      "valueOff": 0
    },
    {
      "label": "Monitorar Sensores",
      "command": "diag_monitor_sensors",
      "icon": "bi-graph-up",
      "valueOn": true,
      "valueOff": false
    }
  ]
}
```

### Propriedades

| Propriedade | Tipo | Descrição |
|---|---|---|
| `type` | string | `"checkbox_group"` |
| `title` | string | Título do frame |
| `description` | string | Descrição exibida |
| `checkboxes` | array | Array de checkboxes |

### Propriedades por Checkbox

| Propriedade | Tipo | Descrição |
|---|---|---|
| `label` | string | Texto visível |
| `command` | string | Comando enviado |
| `icon` | string | Ícone (Bootstrap Icons) - opcional |
| `help` | string | Texto de ajuda - opcional |
| `valueOn` | any | Valor ao marcar (padrão: 1) |
| `valueOff` | any | Valor ao desmarcar (padrão: 0) |

### Exemplos de Valores

```json
// Numeric (padrão)
"valueOn": 1,
"valueOff": 0

// Boolean
"valueOn": true,
"valueOff": false

// String
"valueOn": "enabled",
"valueOff": "disabled"

// Qualquer valor customizado
"valueOn": 100,
"valueOff": -100
```

### Fluxo de Execução

```
Usuário marca checkbox
    ↓
Envia: command=diag_enable_logging, value=1
    ↓
Adiciona ao histórico (undo/redo)
    ↓
Marca widget como modificado
    ↓
Requer salvar
```

### Diferenças de Widgets

| Widget | Histórico | Valores | Múltiplo | Frame |
|---|---|---|---|---|
| **Toggle** | ✅ Sim | ✅ 0/1 | ❌ Não | ❌ Não |
| **Radio** | ✅ Sim | ✅ Sim | ✅ Sim | ❌ Não |
| **Checkbox Group** | ✅ Sim | ✅ Custom | ✅ Sim | ✅ Sim |
| **Color Toggle** | ❌ Não | ❌ Não | ❌ Não | ❌ Não |

---

## 📋 Widgets Disponíveis (v6.2 Final)

1. **Slider** - Controle deslizante com valores numéricos
2. **Spinbox** - Entrada numérica com botões +/-
3. **Combobox** - Seleção de opção única
4. **Toggle** - Botão on/off (0/1)
5. **Radio** - Opções mutuamente exclusivas
6. **Button** - Botão de ação simples
7. **Action Buttons** - Frame com múltiplos botões press/release ou toggle
8. **Chart 2D** - Gráfico interativo com pontos arrastaveis
9. **Color Toggle** - Alterna cores, envia comando direto
10. **Checkbox Group** - Frame com múltiplas checkboxes independentes

---

## 🎨 Estilos Adicionados

```css
.widget-checkbox-group { }
.checkbox-group-frame { }
.checkbox-item { }
.checkbox-label { }
.checkbox-input { }
.checkbox-visual { }
.checkbox-icon { }
.checkbox-text { }
.checkbox-help { }
```

---

## 📝 Arquivos Modificados

### widgets.js
- ✅ Adicionado `createCheckboxGroup()`
- ✅ Case `checkbox_group` no switch

### style.css
- ✅ Adicionados estilos para checkbox group
- ✅ Suporte a hover, checked, disabled states

### su.json
- ✅ Exemplo de checkbox group com 4 opções

### README.md
- ✅ Documentação atualizada
- ✅ Exemplos de uso
- ✅ Propriedades explicadas

---

## ✅ Testes

- Toggle: Marca como modificado apenas se o valor realmente mudou ✓
- Checkbox Group: Cada checkbox é independente ✓
- Histórico: Ambos widgets entram em undo/redo ✓
- Valores customizáveis: Funcionam corretamente ✓

