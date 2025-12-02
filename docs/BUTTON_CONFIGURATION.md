# Guia de Configuração de Botões do Dashboard

Este documento explica como configurar e customizar botões no dashboard do ECU Manager.

## Índice
1. [Estrutura Geral](#estrutura-geral)
2. [Modos de Botão](#modos-de-botão)
3. [Configuração no su.json](#configuração-no-sujson)
4. [Customização no Dashboard](#customização-no-dashboard)
5. [Exemplos Práticos](#exemplos-práticos)
6. [Troubleshooting](#troubleshooting)

---

## Estrutura Geral

Todos os botões são configurados no arquivo `su.json` dentro do array `dashboardButtons`. Cada botão possui:

```json
{
  "id": "btn_unique_id",           // ID único do botão
  "title": "Nome do Botão",        // Título exibido
  "description": "Descrição",      // Descrição da função
  "icon": "bootstrap-icon-name",   // Ícone Bootstrap (sem "bi-")
  "color": "red",                  // Cor inicial (OFF/padrão)
  "mode": "press_release",         // Modo de funcionamento
  "options": []                    // Informações exibidas no dashboard
}
```

---

## Modos de Botão

### 1. **press_release** - Comando ao Apertar e Soltar
Envia um comando quando o botão é pressionado e outro quando é liberado.

**Uso ideal:** Controles que precisam de ação dual (ligar/desligar)

```json
{
  "id": "btn_motor_test",
  "title": "Teste Motor",
  "icon": "power",
  "color": "red",
  "mode": "press_release",
  "commandPress": "motor/start",
  "commandRelease": "motor/stop"
}
```

**No Dashboard:** Botão muda de aparência ao ser pressionado, volta ao normal ao soltar.

---

### 2. **value** - Valores Diferentes ao Apertar e Soltar
Envia valores diferentes pelo mesmo comando. Ideal para sensores/velocidades.

**Uso ideal:** Bomba de combustível, ventilador com velocidades fixas

```json
{
  "id": "btn_fuel_pump",
  "title": "Bomba Combustível",
  "icon": "fuel-pump",
  "color": "green",
  "mode": "value",
  "valuePressCommand": "fuel_pump/max",
  "valueReleaseCommand": "fuel_pump/min"
}
```

**No Dashboard:** Botão se ativa ao apertar, volta ao normal ao soltar (visual temporário).

---

### 3. **stateful_value** - Valores com Estado Fixo
Envia um valor ao apertar e outro ao soltar, com **mudança visual permanente** até soltar.

**Uso ideal:** Ventilador/bomba que muda velocidade e mantém estado visual

```json
{
  "id": "btn_fan_control",
  "title": "Controle do Ventilador",
  "icon": "fan",
  "color": "blue",
  "colorOn": "cyan",
  "iconOn": "fan",
  "mode": "stateful_value",
  "command": "fan/speed",
  "valuePress": 100,
  "valueRelease": 0
}
```

**No Dashboard:**
- Ao apertar: Botão fica **cyan** com ícone fixo, envia `fan/speed=100`
- Ao soltar: Botão volta a **blue** original, envia `fan/speed=0`

---

### 4. **stateful_toggle** - Alternar Estado com Sincronização
**Consulta o estado atual do ECU**, alterna para o oposto e envia o novo valor.

**Uso ideal:** Injeção, Ignição, Sistemas que você quer manter sincronizados

```json
{
  "id": "btn_injection_toggle",
  "title": "Controle de Injeção",
  "icon": "droplet",
  "color": "red",
  "colorOn": "green",
  "iconOn": "check-circle",
  "mode": "stateful_toggle",
  "command": "injecao/status",
  "valueOn": 1,
  "valueOff": 0
}
```

**Fluxo:**
1. Você clica no botão
2. Dashboard **consulta** `injecao/status` (queryCommand)
3. Se value = 0 (OFF), muda para 1 (ON) e envia `injecao/status=1`
4. Se value = 1 (ON), muda para 0 (OFF) e envia `injecao/status=0`
5. Botão fica **verde** com ícone `check-circle` quando ON

**No Dashboard:**
- Primeiro clique: Muda para **colorOn** e **iconOn**
- Segundo clique: Volta para **color** e **icon** original

---

### 5. **toggle** - Apenas Visual (Sem Comando)
Alterna aparência apenas para feedback visual. Não envia comando.

```json
{
  "id": "btn_simple_toggle",
  "title": "Indicador",
  "icon": "circle-fill",
  "color": "gray",
  "mode": "toggle"
}
```

---

### 6. **press_only** - Comando Só ao Apertar
Envia comando **apenas quando o botão é pressionado**, nada ao soltar.

```json
{
  "id": "btn_start_test",
  "title": "Iniciar Teste",
  "icon": "play-fill",
  "color": "green",
  "mode": "press_only",
  "commandPress": "diagnostics/start"
}
```

---

## Configuração no su.json

### Estrutura Básica

```json
{
  "dashboardButtons": [
    {
      "id": "btn_unique_id",
      "title": "Nome Exibido",
      "description": "Descrição detalhada",
      "icon": "bootstrap-icon",
      "color": "cor_inicial",
      "colorOn": "cor_quando_ativo",      // Opcional (para stateful)
      "iconOn": "icon_quando_ativo",      // Opcional (para stateful)
      "mode": "press_release|value|stateful_value|stateful_toggle|toggle|press_only",
      "command": "comando_ecu",           // Depende do modo
      "commandPress": "...",              // Para press_release
      "commandRelease": "...",            // Para press_release
      "valuePressCommand": "...",         // Para value
      "valueReleaseCommand": "...",       // Para value
      "valuePress": 100,                  // Para stateful_value
      "valueRelease": 0,                  // Para stateful_value
      "valueOn": 1,                       // Para stateful_toggle
      "valueOff": 0,                      // Para stateful_toggle
      "options": [                        // Informações exibidas
        {
          "label": "Descrição do Estado ON",
          "description": "O que acontece quando ativo"
        },
        {
          "label": "Descrição do Estado OFF",
          "description": "O que acontece quando inativo"
        }
      ]
    }
  ]
}
```

### Cores Disponíveis
- `red` - Vermelho (#8B0000)
- `green` - Verde (#22c55e)
- `blue` - Azul (#3b82f6)
- `yellow` - Amarelo (#eab308)
- `purple` - Roxo (#a855f7)
- `orange` - Laranja (#f97316)

### Ícones Disponíveis
Qualquer ícone do Bootstrap Icons 1.13.1. Use o **nome sem o prefixo "bi-"**:
- `power` → bi-power
- `fan` → bi-fan
- `droplet` → bi-droplet
- `check-circle` → bi-check-circle
- `x-circle` → bi-x-circle
- `lambda` → bi-lambda
- `tools` → bi-tools
- `play-fill` → bi-play-fill
- `stop-fill` → bi-stop-fill
- etc.

---

## Customização no Dashboard

### Como Adicionar Botão ao Dashboard

1. **Abra o dashboard** (clique único)
2. **Entre em modo edição** (duplo clique)
3. **Clique com direita** → "Adicionar Elemento"
4. **Selecione tipo:** `button`
5. **Configure os campos:**

| Campo | Descrição |
|-------|-----------|
| Botão Pré-definido | Selecione qual botão do su.json usar |
| Título Customizado | Sobrescreve o título do su.json (deixe vazio para usar padrão) |
| Ícone Customizado (OFF) | Sobrescreve o ícone OFF (deixe vazio para usar padrão) |
| Cor Customizada (OFF) | Sobrescreve a cor OFF (deixe vazio para usar padrão) |
| Ícone Customizado (ON) | Ícone quando botão está **ativo** (apenas stateful) |
| Cor Customizada (ON) | Cor quando botão está **ativo** (apenas stateful) |

### Exemplo de Customização

Você pode usar o mesmo botão `btn_injection_toggle` em múltiplos lugares com aparências diferentes:

**Instância 1 (Padrão):**
- Deixe tudo em branco para usar su.json

**Instância 2 (Customizada):**
- Título Customizado: "Injeção Bancada A"
- Ícone Customizado (OFF): `x-circle`
- Cor Customizada (OFF): `red`
- Ícone Customizado (ON): `check-circle`
- Cor Customizada (ON): `green`

---

## Exemplos Práticos

### Exemplo 1: Botão de Ligar/Desligar Motor (press_release)

```json
{
  "id": "btn_motor_control",
  "title": "Motor",
  "description": "Controla o motor de teste",
  "icon": "power",
  "color": "red",
  "colorOn": "green",
  "iconOn": "check-circle",
  "mode": "press_release",
  "commandPress": "motor/start",
  "commandRelease": "motor/stop",
  "options": [
    {"label": "Ligar Motor", "description": "Ativa o motor"},
    {"label": "Desligar Motor", "description": "Desativa o motor"}
  ]
}
```

**Comportamento:**
- Você clica → envia `motor/start`
- Você solta → envia `motor/stop`

---

### Exemplo 2: Ventilador com Dois Níveis (stateful_value)

```json
{
  "id": "btn_fan_speed",
  "title": "Ventilador Máximo",
  "description": "Ativa ventilador em velocidade máxima",
  "icon": "fan",
  "color": "blue",
  "colorOn": "cyan",
  "iconOn": "fan",
  "mode": "stateful_value",
  "command": "fan/speed",
  "valuePress": 255,
  "valueRelease": 0,
  "options": [
    {"label": "Máximo", "description": "Velocidade 255"},
    {"label": "Parado", "description": "Velocidade 0"}
  ]
}
```

**Comportamento:**
- Ao apertar: Botão fica **cyan**, envia `fan/speed=255`
- Ao soltar: Botão volta a **blue**, envia `fan/speed=0`

---

### Exemplo 3: Injeção com Sincronização (stateful_toggle)

```json
{
  "id": "btn_injection_sync",
  "title": "Injeção",
  "description": "Alterna injeção com sincronização ECU",
  "icon": "droplet",
  "color": "red",
  "colorOn": "green",
  "iconOn": "check-circle",
  "mode": "stateful_toggle",
  "command": "injecao/enable",
  "valueOn": 1,
  "valueOff": 0,
  "options": [
    {"label": "Ativa", "description": "Injeção ligada"},
    {"label": "Inativa", "description": "Injeção desligada"}
  ]
}
```

**Comportamento:**
- Clique 1: Consulta `injecao/enable`, se = 0 → envia 1, botão fica **verde**
- Clique 2: Consulta `injecao/enable`, se = 1 → envia 0, botão volta a **vermelho**

---

### Exemplo 4: Múltiplas Instâncias do Mesmo Botão

No su.json, defina uma vez:

```json
{
  "id": "btn_generic_toggle",
  "title": "Genérico",
  "icon": "toggle-on",
  "color": "blue",
  "colorOn": "green",
  "mode": "stateful_toggle",
  "command": "generic/state",
  "valueOn": 1,
  "valueOff": 0
}
```

No dashboard, adicione 3 vezes com customizações diferentes:

**Instância 1:**
- Título: "Injeção"
- Ícone OFF: `droplet`
- Cor OFF: `red`
- Ícone ON: `check-circle`
- Cor ON: `green`

**Instância 2:**
- Título: "Ventilador"
- Ícone OFF: `fan`
- Cor OFF: `blue`
- Ícone ON: `fan`
- Cor ON: `cyan`

**Instância 3:**
- Título: "Ignição"
- Ícone OFF: `lightning`
- Cor OFF: `yellow`
- Ícone ON: `lightning-charge`
- Cor ON: `orange`

---

## Troubleshooting

### Problema: Botão Não Responde

**Causa possível:** Comando não existe no ECU

**Solução:** 
1. Verifique o comando está correto em su.json
2. No modo edição, veja se o botão aparece normalmente
3. Teste em modo view (clique único)

---

### Problema: Botão Trava na Segunda Clicada (stateful_toggle)

**Causa:** O sistema estava fazendo múltiplas requisições simultâneas

**Solução:** ✅ **CORRIGIDO** - Agora usa flag `_processingToggle` para evitar race conditions

**Como funciona:**
- Primeira clicada ativa a flag
- Aguarda a resposta do ECU
- Libera a flag apenas após concluir

---

### Problema: Cor/Ícone Não Muda

**Para stateful_value/stateful_toggle:**
1. Certifique-se de ter `colorOn` e `iconOn` definidos no su.json
2. Ou customize no dashboard (campos "ON")
3. Verifique se o comando está sendo recebido pelo ECU

---

### Problema: Botão Fica Travado em Uma Cor

**Causa:** ECU não respondeu ao comando, estado ficou desincronizado

**Solução:**
1. Clique no botão novamente - vai consultar o estado real
2. Se persistir, reinicie o dashboard
3. Verifique comunicação ECU-Dashboard (veja console do browser: F12)

---

## Referência Rápida

| Modo | Quando Usar | Campos Obrigatórios | Campos Opcionais |
|------|-------------|-------------------|-----------------|
| **press_release** | Ligar/desligar | `commandPress`, `commandRelease` | `color`, `icon` |
| **value** | Sensor com valores | `valuePressCommand`, `valueReleaseCommand` | `color`, `icon` |
| **stateful_value** | Velocidades fixas | `command`, `valuePress`, `valueRelease` | `color`, `colorOn`, `icon`, `iconOn` |
| **stateful_toggle** | Sincronizar com ECU | `command`, `valueOn`, `valueOff` | `color`, `colorOn`, `icon`, `iconOn` |
| **toggle** | Visual apenas | - | `color`, `icon` |
| **press_only** | Iniciar processo | `commandPress` | `color`, `icon` |

---

## Dicas Importantes

✅ **Sempre use dois `options`** - um para ON, outro para OFF (melhora UX)

✅ **Teste em modo view** depois de salvar - garante que funcionou

✅ **Use cores contrastantes** - `red`/`green`, `blue`/`cyan`, etc.

✅ **Ícones grandes e claros** - facilita reconhecimento rápido

✅ **Nomes descritivos** - evita confusão com muitos botões

✅ **Para stateful_toggle, sempre defina `valueOn` e `valueOff`** - garante sincronização

---

## Contato/Suporte

Se encontrar problemas:
1. Verifique este documento
2. Abra console (F12) e procure por erros
3. Verifique se comando existe no ECU
4. Teste comunicação diretamente com ECU

