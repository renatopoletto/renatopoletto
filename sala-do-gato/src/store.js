// Estado do pote de comida e fila de comandos.
// MODO DEMONSTRAÇÃO: tudo fica só no navegador de cada visitante e nenhum
// pagamento é cobrado. Para valer para todo mundo, load(), feed() e enqueue()
// precisam passar a falar com um servidor (que confirma o pagamento e
// guarda a fila).
import { DEFS } from './commands.js';

export const PORTION_MS = 30e3; // uma porção alimenta a gata por 30 segundos
const KEY = 'pipoca-comida-v1';
const MAX_PENDING = 3;

export function load(now, persist) {
  if (persist) {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s.fedUntil === 'number') return s;
    } catch { /* sem armazenamento: segue com o padrão */ }
  }
  return { fedUntil: now - 20 * 60e3, feastAt: null, hungryFrom: null };
}

export function feed(state, now, persist) {
  if (now >= state.fedUntil) { state.hungryFrom = state.fedUntil; state.feastAt = now; }
  state.fedUntil = Math.max(now, state.fedUntil) + PORTION_MS;
  if (persist) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignora */ } }
  return state;
}

// ---------- fila de comandos ----------
export function createQueue() { return { cmds: [], lastEnd: {}, seq: 0 }; }

const catEnd = (c) => (c.catEnd != null ? Math.min(c.catEnd, c.start + c.dur) : c.start + c.dur);

// ctx: { hungry, fedUntil, sleeping }
export function canRun(q, id, now, ctx) {
  const def = DEFS[id];
  if (!def) return false;
  if (def.fed && ctx.hungry) return false;
  if (def.sleeping && !ctx.sleeping) return false;
  if (now < (q.lastEnd[id] || 0) + def.cd) return false;
  const pending = q.cmds.filter((c) => catEnd(c) > now);
  if (!def.priority && pending.length >= MAX_PENDING) return false;
  if (def.fed) {
    const start = Math.max(now, ...pending.map(catEnd));
    if (start >= ctx.fedUntil) return false;
  }
  return true;
}

// Devolve o comando criado, ou null se não pôde rodar agora.
export function enqueue(q, id, now, ctx) {
  if (!canRun(q, id, now, ctx)) return null;
  const def = DEFS[id];
  q.cmds = q.cmds.filter((c) => c.start + c.dur + 10 * 60e3 > now);
  let start = now;
  if (def.priority) {
    // petisco passa na frente: interrompe a reação em andamento e descarta a fila
    q.cmds = q.cmds.filter((c) => c.start <= now);
    for (const c of q.cmds) if (catEnd(c) > now) c.catEnd = now;
  } else {
    start = Math.max(now, ...q.cmds.map(catEnd));
  }
  const cmd = { id: ++q.seq, type: id, start, dur: def.dur, catEnd: null, was: !!ctx.lampOn };
  q.cmds.push(cmd);
  q.lastEnd[id] = start + def.dur;
  return cmd;
}
