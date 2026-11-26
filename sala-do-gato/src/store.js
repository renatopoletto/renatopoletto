// Estado do pote de comida.
// MODO DEMONSTRAÇÃO: fica guardado só no navegador de cada visitante e
// nenhum pagamento é cobrado. Para valer para todo mundo, load() e feed()
// precisam passar a falar com um servidor (que confirma o pagamento).
export const PORTION_MS = 4 * 3600e3; // quanto tempo uma porção alimenta a gata
const KEY = 'pipoca-comida-v1';

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
