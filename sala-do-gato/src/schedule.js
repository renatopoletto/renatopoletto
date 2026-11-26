// Rotina da Pipoca: função pura do horário de Brasília.
// Todo visitante que abrir o site no mesmo instante vê a mesma coisa.
import { sunPatch, toUtc } from './time.js';

export const SLOT_MS = 5 * 60 * 1000;
const SLOTS_DAY = 288;

export function hash(a, b) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// [atividade, lugar, peso]. block = tamanho do bloco em slots de 5 min.
const PROFILES = [
  { from: 0, block: 12, w: [['sleep', 'bed', 34], ['sleep', 'sofa', 28], ['sleep', 'tree', 18], ['watch', 'sill', 9], ['play', 'play', 6], ['drink', 'water', 2], ['groom', 'rug', 3]] },
  { from: 5, block: 2, w: [['play', 'play', 26], ['watch', 'sill', 26], ['groom', 'rug', 14], ['sit', 'tree', 10], ['drink', 'water', 6], ['loaf', 'sofa', 8], ['sleep', 'bed', 10]] },
  { from: 8, block: 4, w: [['sun', 'sun', 32], ['sleep', 'sofa', 16], ['sleep', 'tree', 10], ['watch', 'sill', 16], ['groom', 'rug', 10], ['play', 'play', 8], ['loaf', 'sill', 8]] },
  { from: 11, block: 8, w: [['sun', 'sun', 26], ['sleep', 'sofa', 22], ['sleep', 'bed', 16], ['sleep', 'tree', 12], ['loaf', 'sill', 10], ['groom', 'sofa', 7], ['watch', 'sill', 5], ['drink', 'water', 2]] },
  { from: 16, block: 2, w: [['play', 'play', 28], ['watch', 'sill', 24], ['groom', 'rug', 12], ['sit', 'tree', 10], ['loaf', 'sofa', 10], ['sun', 'sun', 8], ['drink', 'water', 4], ['sleep', 'bed', 4]] },
  { from: 20, block: 4, w: [['loaf', 'sofa', 26], ['sleep', 'sofa', 22], ['sleep', 'bed', 14], ['groom', 'sofa', 12], ['play', 'play', 10], ['watch', 'sill', 10], ['sit', 'tree', 6]] },
];
const MEALS = [84, 150, 216]; // 07:00, 12:30, 18:00

function profileFor(hour) {
  let idx = 0;
  for (let i = 0; i < PROFILES.length; i++) if (hour >= PROFILES[i].from) idx = i;
  return idx;
}

const infoCache = new Map();
export function slotInfo(abs) {
  if (infoCache.has(abs)) return infoCache.get(abs);
  const sod = ((abs % SLOTS_DAY) + SLOTS_DAY) % SLOTS_DAY;
  const day = Math.floor(abs / SLOTS_DAY);
  let act, spot;
  if (MEALS.includes(sod)) { act = 'eat'; spot = 'food'; }
  else if (MEALS.includes(sod - 1)) { act = 'groom'; spot = 'rug'; }
  else {
    const pi = profileFor(sod / 12);
    const prof = PROFILES[pi];
    const blk = Math.floor(sod / prof.block);
    const total = prof.w.reduce((s, x) => s + x[2], 0);
    let r = hash(day, blk * 16 + pi) * total;
    let pick = prof.w[0];
    for (const x of prof.w) { if (r < x[2]) { pick = x; break; } r -= x[2]; }
    [act, spot] = pick;
    if (act === 'sun' && !sunPatch(toUtc(abs * SLOT_MS))) { act = 'sleep'; spot = 'sofa'; }
  }
  const info = { act, spot, key: act + '@' + spot };
  if (infoCache.size > 4000) infoCache.clear();
  infoCache.set(abs, info);
  return info;
}

// Segmento = sequência de slots consecutivos com a mesma atividade/lugar.
function bounds(abs) {
  const info = slotInfo(abs);
  let start = abs, end = abs + 1;
  while (abs - start < 72 && slotInfo(start - 1).key === info.key) start--;
  while (end - abs < 72 && slotInfo(end).key === info.key) end++;
  return { info, start, end };
}

let segCache = null;
export function segmentAt(brtMs) {
  const abs = Math.floor(brtMs / SLOT_MS);
  if (segCache && segCache.abs === abs) return segCache.seg;
  const cur = bounds(abs);
  const prev = bounds(cur.start - 1);
  const seg = {
    info: cur.info, startSlot: cur.start,
    startMs: cur.start * SLOT_MS, endMs: cur.end * SLOT_MS,
    prev: { info: prev.info, startMs: prev.start * SLOT_MS },
  };
  segCache = { abs, seg };
  return seg;
}
