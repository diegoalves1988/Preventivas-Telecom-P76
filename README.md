# Preventivas Telecom — P-76

App para preencher as preventivas de telecom no PDA, gravando tudo no navegador e exportando o TXT no formato do roteiro SAP.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Tela inicial: busca, filtros por sistema e situação, progresso de cada OM, backup geral |
| `preventiva.html` | Tela única de preenchimento, usada por todas as OMs (`preventiva.html?tag=CDI-5510505A`) |
| `dados.js` | Catálogo: roteiros SAP (textos literais dos itens) e lista de OMs |
| `nucleo.js` | Gravação no PDA, migração dos dados antigos, backup e restauração |
| `estilo.css` | Visual comum a todas as telas |
| `sw.js` | Permite abrir o app sem internet depois do primeiro acesso |
| `paga.html`, `ip66-paga.html`, `cdt.html` | Endereços antigos: só redirecionam para a nova tela |

## Como incluir uma OM nova

Abra `dados.js` e acrescente uma linha em `oms`:

```js
{"tag":"CDI-5510506A","om":"20322XXXXX","roteiro":"A3280-1A","sistema":"paga-ex","textoOperacao":"P.XXXXX.TEL.CAIXA DIST PAGA CDI-5510506A"}
```

Se o roteiro ainda não existir, acrescente-o em `roteiros` copiando os itens do SAP **sem alterar o texto**. Para um sistema novo, acrescente-o em `sistemas`. Nenhum HTML precisa ser mexido.

Roteiros com medições (como o A3281-1A) usam `medicoes` (número do item → `potencia` ou `isolacao`) e cada OM traz o `historico` com cabos, valores de projeto e da inspeção anterior.

## Dados já preenchidos

Ao abrir uma OM pela primeira vez na versão nova, o app procura o registro das versões anteriores no PDA e o copia para o formato novo (incluindo fotos). Os dados antigos não são apagados. Backups JSON das versões antigas também podem ser restaurados.

## Exportação SAP A3281

Nas OMs com roteiro A3281-1A, o TXT começa diretamente no código `A3281-1A.IMO_.INSPEC.CX DISTR.IP66 PA/GA`. O cabeçalho de OM e a data/hora copiados do OneNote não são exportados.

## Novas OMs — 22/11/2026

Foram incluídas as caixas Ex de telefonia **CDT-1415001** (2032246611), **CDT-1417001** (2032246612), **CDT-1421001** (2032659046) e **CDT-5510501** (2032246610), todas pelo roteiro **A3308-1A** de 11 itens.

A OM de **telefones Ex vinculada à CDT-1421001** (2032658978) utiliza o roteiro **A3307-2A** de 14 itens e contém **10 TAGs individuais**. Use o seletor de equipamentos na tela de inspeção para registrar status, observações e fotos separadamente. **Todos os status são criados em branco**, sem importar os ES escritos no texto de referência. O TXT reúne as duas matrizes de TAG/tarefa do SAP e um registro complementar do item 10, que não consta nas colunas da matriz de origem.

Os códigos das novas OMs começam diretamente no código do roteiro na exportação TXT, sem as linhas iniciais do OneNote. Os backups leves removem as fotos também da OM com múltiplas TAGs.