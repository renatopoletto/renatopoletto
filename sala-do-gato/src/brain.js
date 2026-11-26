// Converte a rotina (schedule) em posição, direção e pose do gato a cada instante.
import { segmentAt, hash } from './schedule.js';
import { sunPatch, toUtc } from './time.js';

const SPEED = 1.15;
export const BALL_HOME = { x: 0.9, z: 0.9 };

const FIXED = {
  sofa: { p: [-3.0, 0.6, -0.35], a: [-1.95, 0, -0.35], face: Math.PI / 2 },
  sill: { p: [-0.3, 1.3, -2.68], a: [-0.3, 0, -1.7], face: Math.PI },
  bed: { p: [-1.6, 0.07, 2.15], a: [-1.6, 0.07, 2.15], face: 0.7 },
  tree: { p: [3.2, 1.59, -1.3], a: [2.1, 0, -0.75], face: -Math.PI / 2 + 0.35 },
  rug: { p: [0.2, 0, 0.4], a: [0.2, 0, 0.4], face: 0.6 },
  food: { p: [2.7, 0, 0.9], a: [2.7, 0, 0.9], face: Math.PI / 2 },
  water: { p: [2.7, 0, 1.45], a: [2.7, 0, 1.45], face: Math.PI / 2 },
};

function ballPoint(seed, k, n) {
  if (k <= 0 || k >= n) return BALL_HOME;
  return { x: -0.8 + 2.8 * hash(seed, k * 2 + 1), z: -1.2 + 3.2 * hash(seed, k * 2 + 2) };
}
function kickDir(seed, k, n) {
  const a = ballPoint(seed, k, n), b = ballPoint(seed, k + 1, n);
  let dx = b.x - a.x, dz = b.z - a.z;
  const l = Math.hypot(dx, dz);
  if (l < 1e-3) { dx = 0.7; dz = 0.7; } else { dx /= l; dz /= l; }
  return { dx, dz };
}
function kickSpot(seed, k, n) {
  const b = ballPoint(seed, k, n), d = kickDir(seed, Math.min(k, n - 1), n);
  return { x: b.x - d.dx * 0.42, z: b.z - d.dz * 0.42, h: Math.atan2(d.dx, d.dz) };
}

function spotOf(info, startMs) {
  if (info.spot === 'sun') {
    const s = sunPatch(toUtc(startMs)) || { x: 0.2, z: 0.4 };
    const p = [s.x, 0, s.z];
    return { p, a: p, face: -0.9 };
  }
  if (info.spot === 'play') {
    const c = kickSpot(Math.floor(startMs / 300000), 0, 99);
    const p = [c.x, 0, c.z];
    return { p, a: p, face: c.h };
  }
  return FIXED[info.spot];
}

const lerp = (a, b, t) => a + (b - a) * t;
const elevated = (s) => Math.hypot(s.p[0] - s.a[0], s.p[1] - s.a[1], s.p[2] - s.a[2]) > 0.05;
const POSE_FOR = { sleep: 'sleep', loaf: 'loaf', groom: 'groom', watch: 'watch', sit: 'sit', eat: 'eat', drink: 'eat', sun: 'sleep' };

function jump(from, to, u, out) {
  out.x = lerp(from[0], to[0], u);
  out.z = lerp(from[2], to[2], u);
  out.y = lerp(from[1], to[1], u) + 4 * 0.32 * u * (1 - u);
  out.heading = Math.atan2(to[0] - from[0], to[2] - from[2]);
  out.pose = 'jump';
  out.groundY = u < 0.5 ? from[1] : to[1];
  out.moving = true;
}

function blank(N, act, spot) {
  return {
    x: N.p[0], y: N.p[1], z: N.p[2], heading: N.face, pose: 'stand', walkPhase: 0,
    groundY: N.p[1], moving: false, act, spot,
    swipe: 0, wiggle: 0, run: false, meow: 0, hungry: false,
    ball: { x: BALL_HOME.x, z: BALL_HOME.z, roll: 0 },
  };
}

// Leva o gato do lugar P ao lugar N. Devolve -1 enquanto está a caminho,
// ou o tempo (s) desde a chegada.
function travel(P, N, e, out) {
  const tDown = elevated(P) ? 0.9 : 0;
  const d = Math.hypot(N.a[0] - P.a[0], N.a[2] - P.a[2]);
  const tWalk = d / SPEED;
  const tUp = elevated(N) ? 0.95 : 0;
  if (e < tDown) {
    if (e < 0.35) {
      out.x = P.p[0]; out.y = P.p[1]; out.z = P.p[2]; out.groundY = P.p[1];
      out.heading = Math.atan2(P.a[0] - P.p[0], P.a[2] - P.p[2]);
      out.pose = 'crouch'; out.moving = true;
    } else jump(P.p, P.a, (e - 0.35) / 0.55, out);
    return -1;
  }
  if (e < tDown + tWalk) {
    const u = (e - tDown) / tWalk;
    out.x = lerp(P.a[0], N.a[0], u); out.z = lerp(P.a[2], N.a[2], u);
    out.y = lerp(P.a[1], N.a[1], u); out.groundY = out.y;
    out.heading = Math.atan2(N.a[0] - P.a[0], N.a[2] - P.a[2]);
    out.pose = 'walk'; out.walkPhase = u * d * 9; out.moving = true;
    return -1;
  }
  if (e < tDown + tWalk + tUp) {
    const t = e - tDown - tWalk;
    if (t < 0.35) {
      out.x = N.a[0]; out.y = N.a[1]; out.z = N.a[2]; out.groundY = N.a[1];
      out.heading = Math.atan2(N.p[0] - N.a[0], N.p[2] - N.a[2]);
      out.pose = 'crouch'; out.wiggle = 1; out.moving = true;
    } else jump(N.a, N.p, (t - 0.35) / 0.6, out);
    return -1;
  }
  out.x = N.p[0]; out.y = N.p[1]; out.z = N.p[2]; out.groundY = N.p[1];
  out.heading = N.face; out.pose = 'stand'; out.moving = false;
  return e - tDown - tWalk - tUp;
}

// Rotina normal. `from` = { ms, spot } quando o gato vem de fora da rotina.
function routine(brtMs, from) {
  const seg = segmentAt(brtMs);
  const N = spotOf(seg.info, seg.startMs);
  let P, t0;
  if (from && seg.startMs <= from.ms) { P = from.spot; t0 = from.ms; }
  else { P = spotOf(seg.prev.info, seg.prev.startMs); t0 = seg.startMs; }
  const out = blank(N, seg.info.act, seg.info.spot);
  const te = travel(P, N, (brtMs - t0) / 1000, out);
  if (te < 0) return out;
  if (seg.info.act !== 'play') {
    out.pose = POSE_FOR[seg.info.act] || 'sit';
    return out;
  }

  // Brincadeira: ciclos de espreitar, dar a patada e correr atrás da bolinha.
  const T = 6;
  const seed = Math.floor(seg.startMs / 300000);
  const arriveMs = brtMs - te * 1000;
  const n = Math.max(1, Math.floor((seg.endMs - arriveMs) / 1000 / T));
  const k = Math.floor(te / T);
  if (k >= n) {
    const c = kickSpot(seed, n, n);
    out.x = c.x; out.z = c.z; out.heading = c.h; out.pose = 'sit';
    return out;
  }
  const u = te - k * T;
  const c0 = kickSpot(seed, k, n), c1 = kickSpot(seed, k + 1, n);
  const b0 = ballPoint(seed, k, n), b1 = ballPoint(seed, k + 1, n);
  const bd = Math.hypot(b1.x - b0.x, b1.z - b0.z);
  out.x = c0.x; out.z = c0.z; out.heading = c0.h; out.moving = true;
  if (u < 3.2) { out.pose = 'crouch'; out.wiggle = u > 1.8 ? 1 : 0.2; }
  else if (u < 3.6) { out.pose = 'crouch'; out.swipe = Math.sin((u - 3.2) / 0.4 * Math.PI); }
  else {
    const bu = Math.min(1, (u - 3.6) / 1.4);
    const eo = 1 - (1 - bu) * (1 - bu);
    out.ball.x = lerp(b0.x, b1.x, eo); out.ball.z = lerp(b0.z, b1.z, eo);
    out.ball.roll = eo * bd / 0.09;
    if (u < 4.2) out.pose = 'stand';
    else {
      const ru = (u - 4.2) / 1.8;
      const es = ru * ru * (3 - 2 * ru);
      out.x = lerp(c0.x, c1.x, es); out.z = lerp(c0.z, c1.z, es);
      out.heading = Math.atan2(c1.x - c0.x, c1.z - c0.z);
      out.pose = 'walk'; out.run = true;
      out.walkPhase = es * Math.hypot(c1.x - c0.x, c1.z - c0.z) * 7;
    }
  }
  if (u < 3.6) { out.ball.x = b0.x; out.ball.z = b0.z; }
  return out;
}

// Com fome: fareja o pote vazio, mia para quem está olhando e anda inquieta.
const CAM_HEADING = 0.57; // de frente para a câmera
const BEG = [[0.9, 0, 2.35], [-0.4, 0, 1.9], [1.7, 0, 1.6]];
function meowAt(t) { const m = t % 2.8; return m < 0.9 ? Math.sin(Math.PI * m / 0.9) : 0; }
function hungryState(brtMs, h0) {
  const seg0 = segmentAt(h0);
  const P = spotOf(seg0.info, seg0.startMs);
  const A = FIXED.food;
  const out = blank(A, 'hungry', 'food');
  out.hungry = true;
  const te = travel(P, A, (brtMs - h0) / 1000, out);
  if (te < 0) return out;
  const T = 36, k = Math.floor(te / T), u = te - k * T;
  const b = BEG[Math.floor(hash(Math.floor(h0 / 1000), k) * BEG.length)];
  const B = { p: b, a: b, face: CAM_HEADING };
  if (u < 5) out.pose = 'eat';
  else if (u < 11) { out.pose = 'sit'; out.heading = CAM_HEADING; out.meow = meowAt(u - 5); }
  else if (u < 28) {
    if (travel(A, B, u - 11, out) >= 0) { out.pose = 'sit'; out.meow = meowAt(u - 11); }
  } else travel(B, A, u - 28, out);
  return out;
}

const FEAST_EAT = 300e3, FEAST_END = 480e3;
function feastState(brtMs, feastAt, h0) {
  const hs = hungryState(feastAt, h0);
  const from = [hs.x, 0, hs.z];
  const e = (brtMs - feastAt) / 1000;
  if (e < FEAST_EAT / 1000) {
    const out = blank(FIXED.food, 'eat', 'food');
    if (travel({ p: from, a: from }, FIXED.food, e, out) >= 0) out.pose = 'eat';
    else out.run = true;
    return out;
  }
  const out = blank(FIXED.rug, 'groom', 'rug');
  if (travel(FIXED.food, FIXED.rug, e - FEAST_EAT / 1000, out) >= 0) out.pose = 'groom';
  return out;
}

// food = { hungrySince, feastAt, hungryFrom } em ms de Brasília (ou null).
export function catState(brtMs, food) {
  if (food && food.hungrySince != null && brtMs >= food.hungrySince) return hungryState(brtMs, food.hungrySince);
  if (food && food.feastAt != null) {
    if (brtMs - food.feastAt < FEAST_END) return feastState(brtMs, food.feastAt, food.hungryFrom ?? food.feastAt);
    return routine(brtMs, { ms: food.feastAt + FEAST_END, spot: FIXED.rug });
  }
  return routine(brtMs, null);
}

const WHERE = { sofa: 'no sofá', bed: 'na caminha', tree: 'no alto do arranhador', sill: 'na janela', rug: 'no tapete' };
export function statusText(st, isDay) {
  if (st.pose === 'walk' && !st.run) return 'passeando pela sala';
  if (st.pose === 'jump') return 'dando um pulo';
  if (st.act === 'hungry') return st.meow > 0 || st.pose === 'sit' ? 'miando de fome' : 'inquieta, rondando o pote vazio';
  if (st.pose === 'walk' && st.run && st.act === 'eat') return 'correndo para o pote';
  switch (st.act) {
    case 'sleep': return 'dormindo ' + WHERE[st.spot];
    case 'loaf': return 'de pãozinho ' + WHERE[st.spot];
    case 'groom': return 'tomando banho de língua ' + WHERE[st.spot];
    case 'watch': return isDay ? 'vigiando os passarinhos pela janela' : 'olhando a noite pela janela';
    case 'sit': return 'observando tudo lá de cima';
    case 'eat': return 'comendo ração';
    case 'drink': return 'bebendo água';
    case 'play': return 'caçando a bolinha';
    case 'sun': return 'tomando sol no chão';
    default: return 'sendo gato';
  }
}
