# Tabela 3D - Novas Funcionalidades

## Configurações Adicionadas

### 1. Tipo de Valor (`valueType`)
Define o tipo de dado armazenado nas células da tabela.

**Valores possíveis:**
- `"float"` (padrão): Aceita valores decimais
- `"integer"`: Arredonda valores para inteiros

**Exemplo na configuração:**
```json
{
  "type": "table3d",
  "valueType": "integer",
  "min": 0,
  "max": 255
}
```

### 2. Auto-preenchimento (`autoFill`)
Quando habilitado, a tabela é preenchida automaticamente com um gradiente diagonal quando inicializada vazia.

**Valores possíveis:**
- `true` (padrão): Auto-fill ativado
- `false`: Sem preenchimento automático

**Comportamento:**
- Se a tabela estiver completamente vazia (todos os valores = min), ela será preenchida com um gradiente diagonal do `min` até `max`
- A interpolação vai de cima-esquerda (min) até baixo-direita (max)
- Se a tabela já contiver algum dado diferente do padrão, não faz auto-fill

**Exemplo:**
```json
{
  "type": "table3d",
  "autoFill": true,
  "min": 0,
  "max": 100
}
```

### 3. Modos de Cores (`colorMode`)
Novos modos de coloração disponíveis para visualização da tabela.

**Valores possíveis:**
- `"gradient"` (padrão): Gradiente vermelho personalizado
- `"heat"`: Mapa térmica clássica (Azul → Verde → Amarelo → Laranja → Vermelho)
- `"cool"`: Mapa fria (Branco → Azul → Preto)
- `"viridis"`: Gradiente perceptualmente uniforme (Roxo → Azul → Verde → Amarelo)
- `"plasma"`: Mapa de plasma vibrante (Roxo → Rosa → Laranja → Amarelo)
- `"inferno"`: Mapa de inferno (Preto → Marrom → Vermelho → Laranja → Amarelo)

**Exemplo:**
```json
{
  "type": "table3d",
  "colorMode": "viridis",
  "min": 0,
  "max": 255
}
```

## Suporte Mobile

### Touch Events
A tabela 3D agora suporta eventos de toque em dispositivos móveis:

- **Touch Start (Toque inicial)**: Seleciona a célula tocada
- **Touch Move (Arrastar)**: Seleciona um intervalo de células enquanto arrasta
- **Touch End (Soltar)**: Finaliza a seleção

### Responsividade
O aplicativo se adapta automaticamente ao tamanho da tela:

**Breakpoints:**
- **≥ 1025px**: Layout desktop (painel esquerdo + painel direito lado a lado)
- **768px - 1024px**: Layout tablet (painel esquerdo em cima, painel direito embaixo)
- **480px - 767px**: Layout smartphone otimizado
- **< 480px**: Layout ultra-compacto para celulares pequenos

**Ajustes automáticos:**
- Tabela redimensiona para caber na tela sem vazar do frame
- Botões aumentam de tamanho para facilitar toque
- Fontes se reduzem mantendo legibilidade
- Espaçamento ajusta para telas menores

### Meta Tags Mobile
Adicionadas meta tags para melhor experiência em dispositivos móveis:
```html
<meta name="apple-mobile-web-app-capable" content="true">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#8B0000">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
```

## Exemplo de Configuração Completa

```json
{
  "type": "table3d",
  "title": "Mapa Turbo",
  "rows": 16,
  "cols": 16,
  "min": 0,
  "max": 255,
  "step": 1,
  "valueType": "integer",
  "colorMode": "viridis",
  "autoFill": true,
  "unit": "PSI",
  "rowCommands": ["turboMap1", "turboMap2", ...],
  "xLabel": "RPM",
  "yLabel": "Carga",
  "xAxis": {
    "enabled": true,
    "command": "turboMapXAxis",
    "min": 0,
    "max": 7000
  },
  "yAxis": {
    "enabled": true,
    "command": "turboMapYAxis",
    "min": 0,
    "max": 100
  }
}
```

## Comportamento de Interpolação Automática

Quando a tabela está vazia e `autoFill` está habilitado:

1. A célula superior-esquerda recebe o valor `min`
2. A célula inferior-direita recebe o valor `max`
3. Todas as outras células são interpoladas proporcionalmente

**Fórmula:**
```
value[r][c] = min + (max - min) * ((r / (rows - 1) + c / (cols - 1)) / 2)
```

Esta interpolação cria um efeito de gradiente diagonal suave.

## Notas Importantes

- O tipo de valor é aplicado **ao salvar** as mudanças
- A seleção de múltiplas células funciona com Ctrl+Click no desktop e toque longo em mobile
- A interpolação de valores respeita o tipo definido (arredonda inteiros)
- Todos os modos de cores mantêm o mesmo intervalo [min, max]
- Em telas muito pequenas (< 480px), o tamanho das células é reduzido automaticamente

## Debugging

Para verificar o tipo de valor e modo de cores atual, abra o console do navegador e verifique:
```javascript
console.log(`Tipo: ${window.table3dController.valueType}`);
console.log(`Cores: ${window.table3dController.colorMode}`);
```
