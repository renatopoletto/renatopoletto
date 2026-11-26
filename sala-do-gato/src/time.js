// Relógio de Brasília e posição do sol.
// "brt ms" = milissegundos UTC deslocados para o horário de Brasília.

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
});

let offCache = { key: null, value: -3 * 3600e3 };
export function brtOffset(utcMs) {
  const key = Math.floor(utcMs / 900e3);
  if (offCache.key === key) return offCache.value;
  let value = -3 * 3600e3;
  try {
    const p = {};
    for (const part of fmt.formatToParts(new Date(utcMs))) p[part.type] = +part.value;
    value = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
  } catch { /* mantém UTC-3 */ }
  offCache = { key, value };
  return value;
}

export const toBrt = (utcMs) => utcMs + brtOffset(utcMs);
export const toUtc = (brtMs) => brtMs - brtOffset(brtMs + 3 * 3600e3);

// Cidade de referência para o sol: São Paulo.
const LAT = -23.55 * Math.PI / 180;
const LON = -46.63;

// Retorna altitude real do sol (graus), nascer/pôr e a direção da luz na cena.
export function solar(utcMs) {
  const d = new Date(utcMs);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const n = (utcMs - start) / 864e5; // dia do ano, fracionário
  const decl = -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI / 365 * (n + 10));
  const B = 2 * Math.PI * (n - 81) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutos
  const utcH = (utcMs % 864e5) / 36e5;
  const solarH = (((utcH + LON / 15 + eot / 60) % 24) + 24) % 24;
  let H = 15 * (solarH - 12); // graus, -180..180
  const alt = Math.asin(Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H * Math.PI / 180)) * 180 / Math.PI;
  const cosH0 = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(LAT) * Math.sin(decl)) / (Math.cos(LAT) * Math.cos(decl));
  const H0 = Math.acos(Math.max(-1, Math.min(1, cosH0))) * 180 / Math.PI;
  const isDay = Math.abs(H) < H0;
  // progresso 0..1 do arco (dia: nascer->pôr; noite: pôr->nascer)
  let p;
  if (isDay) p = (H + H0) / (2 * H0);
  else p = ((H > 0 ? H : H + 360) - H0) / (360 - 2 * H0);
  // Direção da fonte de luz na cena (licença artística: o arco é inclinado
  // para o norte para a luz sempre entrar pela janela). Leste = +x, norte = -z.
  const a = Math.PI * p;
  const v = [Math.cos(a), 0.85 * Math.sin(a) + 0.05, -0.75];
  const len = Math.hypot(v[0], v[1], v[2]);
  const dir = v.map((c) => c / len);
  const off = brtOffset(utcMs) / 36e5;
  const noon = 12 - LON / 15 - eot / 60 + off;
  return { alt, isDay, p, dir, sunrise: noon - H0 / 15, sunset: noon + H0 / 15 };
}

// Centro da mancha de sol no chão (ou null se não houver sol utilizável).
export function sunPatch(utcMs) {
  const s = solar(utcMs);
  if (!s.isDay || s.alt < 6) return null;
  const t = 2.3 / s.dir[1];
  const x = -0.3 - s.dir[0] * t;
  const z = -3.0 - s.dir[2] * t;
  if (x < -1.9 || x > 2.3 || z < -1.8 || z > 2.3) return null;
  return { x, z };
}
