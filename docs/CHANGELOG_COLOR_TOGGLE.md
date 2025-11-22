# Changelog - Color Toggle Widget (v6.1)

## ✨ Novo Widget: Color Toggle

### O que é?
Um widget **opcional** que alterna cores ao clicar, enviando comando direto à ECU **SEM**:
- ❌ Registrar no histórico (Undo/Redo)
- ❌ Alterar valores de outros widgets
- ❌ Exigir salvar

### Características

```
┌─────────────────────────────────┐
│ Modo de Energia                 │
│ Clique para alternar...          │
├─────────────────────────────────┤
│                                 │
│    🔴 Energia (cicla cores)    │
│                                 │
└─────────────────────────────────┘

Clique 1: 🔴 (vermelho) → envia "eco"
Clique 2: 🔵 (azul)    → envia "normal"  
Clique 3: 🟢 (verde)   → envia "sport"
Clique 4: 🔴 (volta)   → envia "eco"
```

### Como Configurar

```json
{
  "type": "color_toggle",
  "title": "Modo de Energia",
  "description": "Clique para alternar o modo",
  "command": "energy_mode",
  "icon": "bi-lightning-charge",
  "label": "Energia",
  "colors": ["red", "blue", "green"],
  "valueMap": {
    "red": "eco",
    "blue": "normal", 
    "green": "sport"
  },
  "toggleOnRelease": false
}
```

### Propriedades

| Propriedade | Tipo | Descrição |
|---|---|---|
| `type` | string | Deve ser `"color_toggle"` |
| `title` | string | Título do widget |
| `description` | string | Descrição exibida acima do botão |
| `command` | string | Comando enviado à ECU |
| `icon` | string | Ícone (Bootstrap Icons) |
| `label` | string | Texto do botão |
| `colors` | array | Array de cores para ciclar |
| `valueMap` | object | Mapeia cores → valores |
| `toggleOnRelease` | boolean | Muda cor ao soltar também? |

### Cores Disponíveis
- 🔴 `red`
- 🔵 `blue`
- 🟢 `green`
- 🟡 `yellow`
- 🟣 `purple`
- 🟠 `orange`

### Fluxo de Execução

```
Usuário clica
    ↓
Cor muda (visual feedback)
    ↓
Envia: command=energy_mode, value=mapped_color
    ↓
Notificação visual
    ↓
NÃO entra em histórico
NÃO altera valores globais
NÃO requer salvar
```

### Exemplo Real: Modo de Potência

```json
{
  "type": "color_toggle",
  "title": "Modo de Potência",
  "description": "Selecione o modo de funcionamento",
  "command": "power_mode",
  "icon": "bi-battery-charging",
  "label": "Potência",
  "colors": ["green", "yellow", "red"],
  "valueMap": {
    "green": "low",
    "yellow": "medium",
    "red": "high"
  },
  "toggleOnRelease": false
}
```

## 🎨 Diferenças de Widgets

| Widget | Histórico | Salvar | Valores | Use Case |
|---|---|---|---|---|
| **Slider** | ✅ Sim | ✅ Sim | ✅ Altera | Parâmetros |
| **Toggle** | ✅ Sim | ✅ Sim | ✅ Altera | Ligar/Desligar |
| **Color Toggle** | ❌ Não | ❌ Não | ❌ Independente | Modos/Seleção |
| **Action Buttons** | ✅ Sim | ✅ Sim | ✅ Altera | Press/Release |

## 📝 Notas de Implementação

- Color Toggle **não interfere** com undo/redo de outros widgets
- Cada clique **envia imediatamente** para ECU
- **Sem lado-efeitos** em widgets vizinhos
- **Feedback visual** instantâneo
- **Suporta mobile** (touch events)

## 🔄 Versão

- **v6.1** - Adicionado Color Toggle Widget
- Arquivo: `widgets.js` - função `createColorToggle()`
- Estilos: `style.css` - `.widget-color-toggle` e `.color-toggle-button`
