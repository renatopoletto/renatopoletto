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

## Como funciona

- `src/time.js`: horário de Brasília (fuso `America/Sao_Paulo`) e posição do sol calculada para São Paulo. O nascer e o pôr do sol são os reais do dia; a direção da luz na sala é ajustada para sempre entrar pela janela.
- `src/schedule.js`: a rotina é uma função pura da data e hora, em blocos de 5 minutos. Dois visitantes no mesmo instante veem a mesma coisa, sem servidor.
- `src/brain.js`: transforma a rotina em posição, direção e pose.
- `src/cat.js`, `src/room.js`, `src/sky.js`: a gata, a sala e a vista da janela, tudo gerado por código.
- `vendor/`: three.js r180 (licença MIT).
