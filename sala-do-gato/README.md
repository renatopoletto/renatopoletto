# A sala da Pipoca

Uma sala ilustrada em 3D (three.js) com uma gata vivendo a rotina dela, 24 horas por dia, no horário de Brasília.

## Rodar

É um site estático, sem build. Precisa de um servidor HTTP (abrir o `index.html` direto do disco não funciona, por causa dos módulos JS):

```
cd sala-do-gato
python3 -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Parâmetros de teste

- `?hora=21:30` começa naquele horário de Brasília
- `?vel=600` acelera o tempo (600 = 10 minutos por segundo)
- `?foco=1` aproxima a câmera da gata
- `?cmd=laser` dispara um comando ao carregar (veja os nomes em `src/commands.js`) e `?fome=0` deixa a gata alimentada por 6 horas
- `?q=max` força a qualidade gráfica máxima; `?q=min` desliga os efeitos (por padrão o site reduz a qualidade sozinho em aparelhos lentos)

## Como funciona

- `src/time.js`: horário de Brasília (fuso `America/Sao_Paulo`) e posição do sol calculada para São Paulo. O nascer e o pôr do sol são os reais do dia; a direção da luz na sala é ajustada para sempre entrar pela janela.
- `src/schedule.js`: a rotina é uma função pura da data e hora, em blocos de 5 minutos. Dois visitantes no mesmo instante veem a mesma coisa, sem servidor.
- `src/brain.js`: transforma a rotina em posição, direção e pose.
- `src/cat.js`, `src/room.js`, `src/sky.js`: a gata, a sala e a vista da janela, tudo gerado por código.
- `vendor/`: three.js r180 (licença MIT).

## Comandos do internauta

O botão "brincar" abre uma lista com 13 comandos: chamar, carinho (também tocando na gata), bolinha, caixa de papelão, brinquedo de pena, ponteiro de laser, passarinho, petisco, água fresca, acordar, música, chuva e luzes.

- Os brinquedos já ficam na sala; o comando só faz a gata brincar com eles.
- Os comandos entram numa fila (no máximo 3) e cada um tem um tempo de espera.
- Com fome, ela só aceita petisco, música, chuva e luzes. Os demais ficam desabilitados até alimentar.
- Tudo ainda roda só no navegador de cada visitante. Para valer para todos, `src/store.js` precisa falar com um servidor.
