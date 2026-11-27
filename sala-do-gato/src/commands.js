// Comandos que o internauta pode dar. Dados puros, usados pela fila, pelo
// comportamento da gata, pelo ambiente e pelo menu.
//   dur: duração (ms)   cd: tempo de espera depois do fim (ms)
//   fed: só funciona com a gata alimentada   sleeping: só se ela estiver dormindo
export const DEFS = {
  chamar:     { label: 'chamar',            dur: 12e3, cd: 15e3, fed: true },
  bolinha:    { label: 'bolinha',           dur: 42e3, cd: 20e3, fed: true },
  caixa:      { label: 'caixa de papelão',  dur: 40e3, cd: 25e3, fed: true },
  pena:       { label: 'brinquedo de pena', dur: 30e3, cd: 20e3, fed: true },
  laser:      { label: 'ponteiro de laser', dur: 34e3, cd: 25e3, fed: true },
  carinho:    { label: 'carinho',           dur: 14e3, cd: 12e3, fed: true },
  petisco:    { label: 'petisco',           dur: 18e3, cd: 25e3, fed: false, priority: true },
  agua:       { label: 'água fresca',       dur: 16e3, cd: 25e3, fed: true },
  acordar:    { label: 'acordar',           dur: 12e3, cd: 20e3, fed: true, sleeping: true },
  passarinho: { label: 'passarinho',        dur: 32e3, cd: 35e3, fed: true },
  chuva:      { label: 'chuva',             dur: 45e3, cd: 45e3, fed: false },
  musica:     { label: 'música',            dur: 45e3, cd: 45e3, fed: false },
  luz:        { label: 'luzes',             dur: 45e3, cd: 25e3, fed: false },
};
export const ORDER = ['chamar', 'carinho', 'bolinha', 'caixa', 'pena', 'laser', 'passarinho', 'petisco', 'agua', 'acordar', 'musica', 'chuva', 'luz'];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

// Efeitos de ambiente (chuva, música, luzes) num instante t. Usa o intervalo
// visual completo do comando (start..start+dur), mesmo que a reação da gata
// tenha sido interrompida.
export function envState(cmds, t) {
  const env = { rain: 0, music: 0, luz: 0, luzWas: false };
  for (const c of cmds) {
    const s = c.start, e = c.start + c.dur;
    if (t < s || t > e + 9000) continue;
    const ramp = (up, down) => smooth((t - s) / up) * (t <= e ? 1 : smooth(1 - (t - e) / down));
    if (c.type === 'chuva') env.rain = Math.max(env.rain, ramp(4000, 9000));
    else if (c.type === 'musica') env.music = Math.max(env.music, ramp(1500, 2500));
    else if (c.type === 'luz') { const k = ramp(1500, 3000); if (k >= env.luz) { env.luz = k; env.luzWas = !!c.was; } }
  }
  return env;
}
