# Changelog - Versão 6

## 🎯 Mudanças Implementadas

### 1. ✅ Slider Value - Posição Ajustada
**Arquivo**: `style.css`

**Mudança**: O valor do slider agora aparece **acima** do slider (não embaixo).

```css
/* Antes: padding-bottom: 40px; bottom: 0 */
/* Depois: padding-top: 40px; top: 0 */
```

**Resultado Visual**:
```
┌─────────────────────────────────────┐
│         [100%]  ← Valor aqui        │
│     ━━━━●━━━━━━━━━━━━━━━━━━━       │
│     0                            100 │
└─────────────────────────────────────┘
```

---

### 2. 🎨 Novo Widget: Action Buttons
**Arquivo**: `widgets.js` (função `createActionButtons`)

**Características**:
- ✅ Múltiplos botões em um container único
- ✅ Cada botão tem **comando ao apertar** (`commandPress` + `valuePress`)
- ✅ Cada botão tem **comando ao soltar** (`commandRelease` + `valueRelease`)
- ✅ Suporte a **6 cores**: red, blue, green, yellow, purple, orange
- ✅ Ícones customizáveis (Bootstrap Icons)
- ✅ Auto-organização com flex layout
- ✅ Suporte a touch (mobile)
- ✅ Renderiza título e descrição
- ✅ Integrado com histórico global

**Exemplo de Configuração** (su.json):
```json
{
  "type": "action_buttons",
  "title": "Controle de Teste",
  "description": "Botões de teste com press/release",
  "buttons": [
    {
      "label": "Teste 1",
      "icon": "bi-power",
      "color": "red",
      "commandPress": "test_btn_1_press",
      "valuePress": 1,
      "commandRelease": "test_btn_1_release",
      "valueRelease": 0
    },
    {
      "label": "Teste 2",
      "icon": "bi-play-fill",
      "color": "green",
      "commandPress": "test_btn_2_press",
      "valuePress": 1,
      "commandRelease": "test_btn_2_release",
      "valueRelease": 0
    }
  ]
}
```

**Resultado Visual**:
```
┌──────────────────────────────────────┐
│     Controle de Teste                │
│  Botões de teste com press/release   │
│                                      │
│  [🔴 Teste 1]  [🟢 Teste 2]         │
│  [🟠 Teste 3]                        │
│                                      │
│  (Os botões se organizam sozinhos)   │
└──────────────────────────────────────┘
```

**Comportamento**:
- **Mouse Down** → Envia `commandPress` com `valuePress`
- **Mouse Up** → Envia `commandRelease` com `valueRelease`
- **Mouse Out** → Envia `commandRelease` com `valueRelease` (segurança)
- **Touch Start** → Envia `commandPress` com `valuePress`
- **Touch End** → Envia `commandRelease` com `valueRelease`

---

### 3. 📋 Estilos CSS Adicionados
**Arquivo**: `style.css`

Novos estilos para `.action-button`:
- `.action-button` - Botão base com flex, gap, box-shadow
- `.action-button:hover` - Elevação e aumento de shadow
- `.action-button:active` - Pressão visual
- `.color-red`, `.color-blue`, `.color-green`, `.color-yellow`, `.color-purple`, `.color-orange` - Variações de cor

**Cores**:
- 🔴 **Red**: `#8B0000` → `#5a0000`
- 🔵 **Blue**: `#3b82f6` → `#1d4ed8`
- 🟢 **Green**: `#22c55e` → `#16a34a`
- 🟡 **Yellow**: `#eab308` → `#ca8a04` (texto preto)
- 🟣 **Purple**: `#a855f7` → `#7c3aed`
- 🟠 **Orange**: `#f97316` → `#ea580c`

---

### 4. 📖 Documentação Atualizada
**Arquivo**: `README.md`

- ✅ Adicionado widget `action_buttons` na lista de funcionamento
- ✅ Exemplo completo de uso com todas as propriedades
- ✅ Descrição de cores disponíveis
- ✅ Propriedades por botão documentadas

---

### 5. 📝 Exemplo Adicionado em su.json
**Arquivo**: `su.json`

Adicionado widget `action_buttons` em "Limites e Proteções" → "Limitador de RPM" com 3 botões de exemplo:
- Teste 1 (Red, Power Icon)
- Teste 2 (Green, Play Icon)
- Teste 3 (Orange, Stop Icon)

---

## 🚀 Como Usar

### Criar um Widget de Action Buttons

1. Editar `su.json` e adicionar widget com `type: "action_buttons"`
2. Definir `title` e `description` (opcional)
3. Criar array `buttons` com múltiplos botões
4. Cada botão precisa de:
   - `label`: Texto
   - `icon`: Ícone Bootstrap (opcional)
   - `color`: Cor (optional, padrão: red)
   - `commandPress`: Comando ao apertar
   - `valuePress`: Valor ao apertar (opcional)
   - `commandRelease`: Comando ao soltar
   - `valueRelease`: Valor ao soltar (opcional)

### Exemplo Mínimo
```json
{
  "type": "action_buttons",
  "title": "Meu Botão",
  "buttons": [
    {
      "label": "Ação",
      "commandPress": "cmd_press",
      "commandRelease": "cmd_release"
    }
  ]
}
```

---

## 🔧 Detalhes Técnicos

### Quadrão/Container
O widget mantém o padrão visual do projeto com:
- `background-color: var(--bg-darker)`
- `border: 1px solid var(--border-color)`
- `border-radius: 8px`
- `padding: 20px`
- `margin-bottom: 20px`

Nenhum estilo do widget ultrapassa os limites do container.

### Integração com Sistema Global
- ✅ Histórico (undo/redo) integrado
- ✅ Modificação/Salvo rastreado
- ✅ Notificações funcionam normalmente
- ✅ Breadcrumbs e status atualizados

---

## ✨ Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| Slider Value | Embaixo | **Acima** ✅ |
| Widgets Disponíveis | 6 tipos | **7 tipos** ✅ |
| Action Buttons | ❌ | **✅ Novo** |
| Cores de Botão | 1 (red) | **6 cores** ✅ |
| Press/Release | ❌ | **✅ Suportado** |
| Mobile | N/A | **✅ Touch** |

