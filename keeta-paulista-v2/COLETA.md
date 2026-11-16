# Coleta de exposição de marca

O jogo mede, sem mostrar nada ao jogador, quantas vezes e por quanto tempo cada marca ficou visível. Os dados saem em lotes, por jogador, para a plataforma que embute o jogo e, se configurado, para um endpoint HTTP.

## O que conta como exposição

Uma peça conta **1 impressão** quando fica, por **1 segundo seguido**:

- com pelo menos **50% da área** visível na tela;
- fora dos elementos de interface do jogo (relógio, minimapa, velocímetro, botões);
- com pelo menos **18 px de altura** na tela.

Cada peça conta uma vez por passagem. O campo `segundos` soma todo o tempo em que a peça ficou visível depois de atingir esse critério.

Marcas: `keeta`, `mcd` (McDonald's), `coke` (Coca-Cola).
Locais: `painel` (painel de rua), `loja` (letreiro do McDonald's na loja), `fachada` (letreiro na fachada da loja).

Não é descontado o que fica coberto por carros, pedestres ou pelo entregador. É uma métrica interna do jogo, sem auditoria de terceiros.

## Configuração

Em ordem de prioridade:

1. **Mensagem da plataforma** (recomendado quando o jogo roda num iframe):
   ```js
   iframe.contentWindow.postMessage({ type: 'keeta-config', jogador: '<id do usuário>', endpoint: 'https://...' }, '*');
   ```
   O `endpoint` só é aceito se começar com `https://`.
2. **Parâmetros no endereço:** `index.html?jogador=<id>&coleta=<url codificada>`.
3. **Constante `EXPO_ENDPOINT`** no início do bloco de envio em `index.html`.

Sem endpoint, os lotes vão apenas por `postMessage` para a página que embute o jogo.
Sem `jogador`, só existe o identificador anônimo `jogadorAnonimo`, aleatório e guardado no aparelho.

## Quando um lote é enviado

| `motivo` | Momento |
|---|---|
| `fim-da-fase` | o jogador conclui uma fase |
| `fim-do-turno` | o turno termina (pedido cancelado ou destruído) |
| `app-em-segundo-plano` | a aba ou o app vai para segundo plano |
| `saida` | a página é fechada |

Cada lote traz só o que foi medido **desde o lote anterior**; para totais, some os lotes. Lotes vazios não são enviados.

## Como os dados chegam

- **Para a plataforma:** `window.parent.postMessage(lote, '*')`, com `lote.tipo === 'keeta-exposicao'`.
- **Para o endpoint:** `POST` com o JSON no corpo, enviado por `navigator.sendBeacon` (ou `fetch` com `keepalive`). O corpo vai como `text/plain` para evitar a verificação prévia de CORS; o servidor deve fazer o parse do texto como JSON.

## Exemplo de lote

```json
{
  "tipo": "keeta-exposicao",
  "versao": 1,
  "jogador": "cliente-12345",
  "jogadorAnonimo": "anon-r9e2uts7mwjjutzr",
  "sessao": "s-bet4x68d",
  "lote": 1,
  "motivo": "fim-da-fase",
  "inicio": "2026-11-16T17:40:53.463Z",
  "fim": "2026-11-16T17:42:01.327Z",
  "fase": 1,
  "veiculo": "bike",
  "circuito": "Av. Paulista",
  "criterio": { "areaVisivelMinima": 0.5, "segundosMinimos": 1, "alturaMinimaPx": 18 },
  "exposicoes": {
    "keeta": { "painel": { "impressoes": 3, "segundos": 17.5 }, "loja": { "impressoes": 0, "segundos": 0 }, "fachada": { "impressoes": 0, "segundos": 0 } },
    "mcd":   { "painel": { "impressoes": 4, "segundos": 27.8 }, "loja": { "impressoes": 1, "segundos": 6.4 }, "fachada": { "impressoes": 0, "segundos": 0 } },
    "coke":  { "painel": { "impressoes": 2, "segundos": 20.4 }, "loja": { "impressoes": 0, "segundos": 0 }, "fachada": { "impressoes": 0, "segundos": 0 } }
  }
}
```

## Pontos de atenção

- **Privacidade (LGPD):** o id do jogador e o id anônimo tornam os dados pessoais (pseudonimizados). O tratamento precisa de base legal e de aviso na política de privacidade da plataforma.
- **Entrega não garantida:** envio por beacon pode se perder com a rede caindo ou o app sendo encerrado à força. Use `sessao` + `lote` para detectar lacunas e eliminar duplicidades.
- **Integridade:** os números são calculados no aparelho e podem ser adulterados por quem tiver acesso técnico. Para uso comercial (cobrança de mídia), trate como indicativo, não como medição certificada.
