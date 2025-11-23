# Table3D Widget - Documentação

## O que é?

Um novo widget de tabela numérica 3D totalmente interativo para o DSW Mobile ECU Manager. Perfeito para configurar matrizes de dados como mapas de motores, tabelas de correção, etc.

## Características

### ✅ Funcionalidades Principais
- **Tabela Numérica Dinâmica**: Crie tabelas de tamanho N×M (ex: 15×20, 20×20)
- **Um Comando por Linha**: Cada linha é um comando separado na ECU
- **Cores Dinâmicas**: 3 modos de colorização:
  - `gradient`: Vermelho claro → escuro (padrão)
  - `heat`: Azul → Verde → Amarelo → Vermelho
  - `cool`: Branco → Azul → Preto
- **Seleção de Células**: Clique para selecionar e editar
- **Edição Inline**: Shift+Click para editar diretamente na célula
- **Interpolação**: Preencha uma linha inteira ou interpole entre valores
- **Tooltips**: Hover mostra coordenadas e valor
- **Compatibilidade com `parameterVariations`**: Ajusta-se automaticamente com mudanças de parâmetros

## Configuração no su.json

```json
{
  "type": "table3d",
  "title": "Nome da Tabela",
  "help": "Descrição da tabela",
  "rows": 15,
  "cols": 20,
  "rowCommands": [
    "comando_linha_0",
    "comando_linha_1",
    "comando_linha_2",
    ...
  ],
  "min": 0,
  "max": 100,
  "step": 0.1,
  "unit": "%",
  "colorMode": "heat",
  "xLabel": "Eixo X",
  "yLabel": "Eixo Y"
}
```

### Propriedades

| Propriedade | Tipo | Descrição |
|---|---|---|
| `type` | string | Deve ser `"table3d"` |
| `title` | string | Título do widget |
| `help` | string | Texto de ajuda/descrição |
| `rows` | number | Número de linhas (default: 20) |
| `cols` | number | Número de colunas (default: 20) |
| `rowCommands` | array | Array de comandos ECU, um por linha |
| `min` | number | Valor mínimo permitido (default: 0) |
| `max` | number | Valor máximo permitido (default: 100) |
| `step` | number | Incremento para edição (default: 1) |
| `unit` | string | Unidade de medida (ex: "%", "ms", "kPa") |
| `colorMode` | string | Modo de cores: "gradient", "heat" ou "cool" |
| `xLabel` | string | Rótulo do eixo X (colunas) |
| `yLabel` | string | Rótulo do eixo Y (linhas) |
| `parameterCommand` | string | (Opcional) Comando para variações dinâmicas |
| `parameterVariations` | object | (Opcional) Variações de configuração |

## Interações

### Teclado/Mouse
- **Clique**: Seleciona uma célula
- **Shift+Clique**: Edita valor diretamente na célula
- **Drag**: Algumas células podem ser arrastadas (extensível)
- **Hover**: Mostra tooltip com coordenadas e valor

### Botões de Ação
- **Preencher Linha**: Preenche toda a linha com o valor selecionado
- **Interpolar**: Interpola valores lineares entre primeira e última coluna
- **Limpar Tabela**: Reseta todos os valores para o mínimo

## Exemplos no su.json

Dois exemplos já estão configurados:

1. **Tabela de Correção por RPM** (15×20)
   - Localização: Tabelas 3D → Correção por RPM
   - Comandos: `table_rpm_corr_row_0` até `table_rpm_corr_row_14`

2. **Mapa de Carga do Motor** (20×20)
   - Localização: Tabelas 3D → Mapa de Carga
   - Comandos: `map_load_row_0` até `map_load_row_19`

## Compatibilidade

✅ **Compatível com:**
- Histórico (Undo/Redo)
- Exportação/Importação de configurações
- Variações de parâmetros (`parameterVariations`)
- Temas escuros
- Responsividade

## Arquivos Modificados

- `table3d-controller.js` - Nova classe com toda a lógica
- `widgets.js` - Integração e criação do widget
- `style.css` - Estilos CSS para tabela 3D
- `index.html` - Link para novo arquivo JS
- `su.json` - Exemplos de configuração

## Testes

Um arquivo de teste está disponível em `test-table3d.html` com testes unitários da classe Table3DController.
