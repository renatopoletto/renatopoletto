// Converte rotina, fome e comandos em posição, direção e pose da gata a cada instante.
// Tudo é função pura do horário (e da lista de comandos): sem estado escondido.
import { segmentAt, hash } from './schedule.js';
import { sunPatch, toUtc } from './time.js';

const SPEED = 1.15;
export const BALL_HOME = { x: 0.9, z: 0.9 };
const CAM_HEADING = 0.57; // de frente para a câmera

// p = onde ela fica; a = ponto de acesso no chão; jh = altura do pulo (opcional)
export const FIXED = {
  sofa: { p: [-3.0, 0.6, -0.35], a: [-1.95, 0, -0.35], face: Math.PI / 2 },
  sill: { p: [-0.3, 1.33, -2.68], a: [-0.3, 0, -1.7], face: Math.PI },
  bed: { p: [-1.6, 0.08, 2.15], a: [-1.6, 0.08, 2.15], face: 0.7 },
  tree: { p: [3.2, 1.615, -1.3], a: [2.1, 0, -0.75], face: -Math.PI / 2 + 0.35 },
  rug: { p: [0.2, 0, 0.4], a: [0.2, 0, 0.4], face: 0.6 },
  food: { p: [2.7, 0, 0.9], a: [2.7, 0, 0.9], face: Math.PI / 2 },
  water: { p: [2.7, 0, 1.45], a: [2.7, 0, 1.45], face: Math.PI / 2 },
  call: { p: [0.7, 0, 2.15], a: [0.7, 0, 2.15], face: CAM_HEADING },
  box: { p: [1.7, 0.06, 2.5], a: [1.7, 0, 1.95], face: 0.35, jh: 0.62 },
  pena: { p: [1.85, 0, -1.3], a: [1.85, 0, -1.3], face: Math.PI / 2 },
  treat: { p: [2.2, 0, 1.15], a: [2.2, 0, 1.15], face: Math.PI / 2 },
  stereo: { p: [2.55, 0, 0.05], a: [2.55, 0, 0.05], face: Math.PI / 2 },
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
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const elevated = (s) => Math.hypot(s.p[0] - s.a[0], s.p[1] - s.a[1], s.p[2] - s.a[2]) > 0.05;
const POSE_FOR = { sleep: 'sleep', loaf: 'loaf', groom: 'groom', watch: 'watch', sit: 'sit', eat: 'eat', drink: 'eat', sun: 'sleep' };

function jump(from, to, u, out, h = 0.32) {
  out.x = lerp(from[0], to[0], u);
  out.z = lerp(from[2], to[2], u);
  out.y = lerp(from[1], to[1], u) + 4 * h * u * (1 - u);
  out.heading = Math.atan2(to[0] - from[0], to[2] - from[2]);
  out.pose = 'jump';
  out.groundY = u < 0.5 ? from[1] : to[1];
  out.moving = true;
}

function blank(N, act, spot) {
  return {
    x: N.p[0], y: N.p[1], z: N.p[2], heading: N.face, pose: 'stand', walkPhase: 0,
    groundY: N.p[1], moving: false, act, spot,
    swipe: 0, wiggle: 0, run: false, meow: 0, yawn: 0, petting: 0, purr: 0, hungry: false,
    ball: { x: BALL_HOME.x, z: BALL_HOME.z, roll: 0 }, fx: {},
  };
}

// Leva a gata do lugar P ao lugar N. Devolve -1 enquanto está a caminho,
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
    } else jump(P.p, P.a, (e - 0.35) / 0.55, out, P.jh);
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
    } else jump(N.a, N.p, (t - 0.35) / 0.6, out, N.jh);
    return -1;
  }
  out.x = N.p[0]; out.y = N.p[1]; out.z = N.p[2]; out.groundY = N.p[1];
  out.heading = N.face; out.pose = 'stand'; out.moving = false;
  return e - tDown - tWalk - tUp;
}

// Brincadeira com a bolinha: ciclos de espreitar, dar a patada e correr atrás.
function playPhase(te, seed, n, out) {
  const T = 6;
  const k = Math.floor(te / T);
  if (k >= n) {
    const c = kickSpot(seed, n, n);
    out.x = c.x; out.z = c.z; out.heading = c.h; out.pose = 'sit';
    return;
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
}

// ---------- rotina normal ----------
// `from` = { ms, spot } quando a gata vem de fora da rotina.
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
  const seed = Math.floor(seg.startMs / 300000);
  const arriveMs = brtMs - te * 1000;
  const n = Math.max(1, Math.floor((seg.endMs - arriveMs) / 1000 / 6));
  playPhase(te, seed, n, out);
  return out;
}

// ---------- fome ----------
// Com fome: fareja o pote vazio, mia para quem está olhando e anda inquieta.
const BEG = [[0.9, 0, 2.35], [-0.4, 0, 1.9], [1.7, 0, 1.6]];
function meowAt(t) { const m = t % 2.8; return m < 0.9 ? Math.sin(Math.PI * m / 0.9) : 0; }
function hungryState(brtMs, h0, start) {
  let P = start;
  if (!P) { const seg0 = segmentAt(h0); P = spotOf(seg0.info, seg0.startMs); }
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

// ---------- comandos ----------
const PERCH = { x: 0.3, y: 1.285, z: -3.4 };
// Passarinho: chega voando, pousa no peitoril externo da janela, bica, vira e foge.
export function birdAt(e) {
  if (e < 0 || e > 26.5) return null;
  const flap = Math.sin(e * 42);
  if (e < 3.8) {
    const u = e / 3.8, s = 1 - (1 - u) * (1 - u);
    return { x: lerp(3.8, PERCH.x, s), y: lerp(2.9, PERCH.y, s) + 0.22 * Math.sin(u * Math.PI * 3) * (1 - u), z: lerp(-3.9, PERCH.z, s), face: Math.PI, flying: true, wing: flap, peck: 0 };
  }
  if (e < 22) {
    const t = e - 3.8;
    const hopU = (t % 3.1) / 0.35;
    const hop = hopU < 1 ? 0.07 * Math.sin(Math.PI * hopU) : 0;
    const pk = t % 1.7;
    return {
      x: PERCH.x + 0.18 * Math.sin(t * 0.35), y: PERCH.y + hop, z: PERCH.z,
      face: Math.floor(t / 5.5) % 2 === 0 ? Math.PI : 0, flying: hop > 0.01,
      wing: hop > 0.01 ? flap * 0.5 : 0, peck: pk < 0.25 && t % 5.5 > 1 ? Math.sin(Math.PI * pk / 0.25) : 0,
    };
  }
  const u = (e - 22) / 4.5;
  return { x: lerp(PERCH.x, -3.8, u * u), y: PERCH.y + 2.4 * u, z: PERCH.z - 0.5 * u, face: Math.PI, flying: true, wing: flap, peck: 0 };
}

// Posição do ponto de laser e se está em movimento (tt = segundos desde que começou a andar).
const LASER_L = 2.8, LASER_MOVE = 1.7;
function laserPoint(seed, k) {
  return { x: -1.4 + 3.8 * hash(seed, 2 * k + 1), z: -0.9 + 3.1 * hash(seed, 2 * k + 2) };
}
function laserDot(seed, tt) {
  const k = Math.floor(tt / LASER_L), u = tt - k * LASER_L;
  const A = laserPoint(seed, k), B = laserPoint(seed, k + 1);
  const moving = u < LASER_MOVE;
  const s0 = clamp01(u / LASER_MOVE), s = s0 * s0 * (3 - 2 * s0);
  let dist = 0;
  for (let j = 0; j < k; j++) { const a = laserPoint(seed, j), b = laserPoint(seed, j + 1); dist += Math.hypot(b.x - a.x, b.z - a.z); }
  const len = Math.hypot(B.x - A.x, B.z - A.z);
  dist += s * len;
  return { x: lerp(A.x, B.x, s), z: lerp(A.z, B.z, s), moving, pause: u - LASER_MOVE, dist, heading: Math.atan2(B.x - A.x, B.z - A.z) };
}

function placeAt(P, out) {
  out.x = P.p[0]; out.y = P.p[1]; out.z = P.p[2]; out.groundY = P.p[1]; out.heading = P.face;
}

function runCmd(c, brtMs, P) {
  const e = (brtMs - c.start) / 1000;
  const dur = c.dur / 1000, rem = dur - e;
  const seed = c.id * 7919 + 13;
  const go = (key, act) => {
    const N = FIXED[key];
    const out = blank(N, act, key);
    return { N, out, te: travel(P, N, e, out) };
  };

  switch (c.type) {
    case 'chamar': {
      const { out, te } = go('call', 'chamar');
      if (te < 0) return out;
      out.pose = 'sit'; out.heading = CAM_HEADING; out.meow = meowAt(te + 0.5);
      return out;
    }
    case 'carinho': {
      const { out, te } = go('call', 'carinho');
      if (te < 0) return out;
      out.pose = 'purr'; out.heading = CAM_HEADING;
      out.petting = clamp01((te - 0.4) / 0.7) * clamp01(rem / 0.8);
      out.purr = clamp01((te - 0.8) / 0.8) * clamp01(rem / 1.2);
      return out;
    }
    case 'bolinha': {
      const k0 = kickSpot(seed, 0, 99);
      const N = { p: [k0.x, 0, k0.z], a: [k0.x, 0, k0.z], face: k0.h };
      const out = blank(N, 'play', 'play');
      const te = travel(P, N, e, out);
      if (te < 0) return out;
      const n = Math.max(1, Math.floor((dur - (e - te)) / 6));
      playPhase(te, seed, n, out);
      return out;
    }
    case 'caixa': {
      const { N, out, te } = go('box', 'caixa');
      if (te < 0) return out;
      if (rem < 3.6) { // pula para fora e senta de frente para a sala
        const u = 3.6 - rem;
        if (u < 0.35) { out.pose = 'crouch'; out.heading = Math.atan2(N.a[0] - N.p[0], N.a[2] - N.p[2]); }
        else if (u < 1.0) jump(N.p, N.a, (u - 0.35) / 0.65, out, N.jh);
        else { out.x = N.a[0]; out.y = 0; out.z = N.a[2]; out.groundY = 0; out.heading = CAM_HEADING; out.pose = 'sit'; }
        return out;
      }
      const u = te % 8;
      out.pose = 'sit'; out.heading = N.face + 0.3 * Math.sin(te * 0.7);
      if (u >= 3 && u < 5.4) { out.pose = 'crouch'; out.wiggle = 1; out.fx.box = 1; }
      else if (u >= 5.4 && u < 5.9) { out.pose = 'crouch'; out.swipe = Math.sin((u - 5.4) / 0.5 * Math.PI); out.fx.box = 0.6; }
      return out;
    }
    case 'pena': {
      const { out, te } = go('pena', 'pena');
      if (te < 0) return out;
      const T = 3.2, u = te % T;
      if (u < 0.8) out.pose = 'sit';
      else if (u < 1.4) { out.pose = 'crouch'; out.wiggle = 1; }
      else if (u < 2.7) { out.pose = 'rear'; out.swipe = Math.max(0, Math.sin((u - 1.4) / 0.4 * Math.PI)) * (u < 2.6 ? 1 : 0); }
      else out.pose = 'sit';
      // o brinquedo balança a cada patada
      let ang = 0;
      const kPer = Math.floor(te / T);
      for (let kk = Math.max(0, kPer - 1); kk <= kPer; kk++) for (let j = 0; j < 3; j++) {
        const dt = te - (kk * T + 1.55 + j * 0.45);
        if (dt > 0) ang += 0.45 * Math.exp(-dt / 1.6) * Math.sin(5 * dt);
      }
      out.fx.pend = ang;
      return out;
    }
    case 'laser': {
      const L0 = laserPoint(seed, 0);
      const N = { p: [L0.x, 0, L0.z], a: [L0.x, 0, L0.z], face: 0 };
      const out = blank(N, 'laser', 'laser');
      out.fx.laser = { x: L0.x, z: L0.z };
      const te = travel(P, N, e, out);
      if (te < 0) return out;
      const dot = laserDot(seed, te);
      out.fx.laser = { x: dot.x, z: dot.z };
      const tc = te - 0.7;
      if (tc < 0) { out.pose = 'crouch'; out.wiggle = 1; out.heading = laserDot(seed, 0).heading; return out; }
      const d = laserDot(seed, tc);
      out.x = d.x; out.z = d.z; out.heading = d.heading; out.moving = true;
      if (d.moving) { out.pose = 'walk'; out.run = true; out.walkPhase = d.dist * 7; }
      else { out.pose = 'crouch'; out.wiggle = 1; if (d.pause > 0.75) out.swipe = Math.sin((d.pause - 0.75) / 0.25 * Math.PI); }
      if (rem < 1.2) { out.pose = 'sit'; out.moving = false; out.run = false; out.swipe = 0; out.wiggle = 0; }
      return out;
    }
    case 'petisco': {
      const { N, out, te } = go('treat', 'petisco');
      out.fx.treats = 3; out.fx.drop = clamp01(e / 0.6);
      if (te < 0) return out;
      const EAT = 6.2;
      if (te < EAT) { out.pose = 'eat'; out.fx.treats = 3 * (1 - te / EAT); return out; }
      out.fx.treats = 0;
      const h = te - EAT;
      if (h < 3.6) { // festa: pulinhos e um miado
        const hu = (h % 1.8) / 1.8;
        out.heading = N.face + h * 1.7;
        out.meow = h < 0.9 ? Math.sin(Math.PI * h / 0.9) : 0;
        if (hu > 0.04 && hu < 0.96) { out.pose = 'jump'; out.y = N.p[1] + 0.22 * Math.sin(Math.PI * hu); out.groundY = N.p[1]; }
        return out;
      }
      out.pose = h < 6.6 ? 'sit' : 'groom'; out.heading = CAM_HEADING;
      return out;
    }
    case 'agua': {
      const { out, te } = go('water', 'agua');
      out.fx.refill = clamp01(e / 2.5);
      if (te < 0) return out;
      out.pose = rem > 3.2 ? 'eat' : 'groom'; out.fx.drink = out.pose === 'eat' ? 1 : 0;
      return out;
    }
    case 'acordar': {
      const out = blank(P, 'acordar', P.name || 'floor');
      placeAt(P, out); out.spot = P.name || 'floor';
      if (e < 0.3) out.pose = 'sleep';
      else if (e < 4.8) { out.pose = 'stretch'; out.yawn = Math.sin(Math.PI * clamp01((e - 1.2) / 2.6)); }
      else if (e < 7.5) out.pose = 'sit';
      else out.pose = 'groom';
      return out;
    }
    case 'passarinho': {
      const { out, te } = go('sill', 'passarinho');
      out.fx.bird = birdAt(e);
      if (te < 0) return out;
      out.heading = Math.PI;
      if (e > 22.5 || te < 1.5) { out.pose = 'watch'; return out; }
      const u = (te - 1.5) % 9;
      if (u < 6.4) { out.pose = 'crouch'; out.wiggle = 0.5 + 0.5 * Math.sin(te * 3); }
      else if (u < 6.9) { out.pose = 'crouch'; out.swipe = Math.sin((u - 6.4) / 0.5 * Math.PI); }
      else out.pose = 'watch';
      return out;
    }
    case 'chuva': {
      const { out, te } = go('sill', 'chuva');
      if (te < 0) return out;
      out.pose = te < 26 ? 'watch' : 'loaf';
      return out;
    }
    case 'musica': {
      const { out, te } = go('stereo', 'musica');
      out.fx.music = 1;
      if (te < 0) return out;
      out.pose = te < 26 ? 'listen' : 'loaf';
      return out;
    }
    case 'luz': {
      const { out, te } = go(c.was ? 'sofa' : 'rug', 'luz');
      if (te < 0) return out;
      out.pose = c.was ? 'sleep' : 'loaf';
      return out;
    }
    default: { // comando desconhecido: ignora
      const out = blank(P, 'sit', P.name || 'floor'); placeAt(P, out); return out;
    }
  }
}

// ---------- composição ----------
function spotFromState(st) {
  if (st.y > 0.05) {
    const k = FIXED[st.spot];
    if (k) return { ...k, name: st.spot };
    return { p: [st.x, st.y, st.z], a: [st.x, 0, st.z], face: st.heading, name: 'air' };
  }
  const p = [st.x, 0, st.z];
  return { p, a: p, face: st.heading, name: 'floor' };
}

// Fim efetivo da reação da gata: a fome corta tudo, menos o petisco.
function effEnd(c, hs) {
  let e = c.catEnd != null ? Math.min(c.catEnd, c.start + c.dur) : c.start + c.dur;
  if (c.type !== 'petisco' && hs != null) e = Math.min(e, Math.max(c.start, hs));
  return e;
}

function fromOf(c, i, food, cmds, noHunger) {
  const key = noHunger ? '_fromN' : '_from';
  if (!c[key]) c[key] = spotFromState(stateAt(c.start - 1, food, cmds.slice(0, i), noHunger));
  return c[key];
}
function endSpotOf(c, i, end, food, cmds, noHunger) {
  const key = noHunger ? '_endN' : '_end';
  if (!c[key] || c[key].ms !== end) c[key] = { ms: end, spot: spotFromState(runCmd(c, end - 1, fromOf(c, i, food, cmds, noHunger))) };
  return c[key].spot;
}

let hsCache = { key: '', spot: null };

function stateAt(brtMs, food, cmds, noHunger) {
  const hs = (!noHunger && food && food.hungrySince != null) ? food.hungrySince : null;
  let after = null;
  for (let i = cmds.length - 1; i >= 0; i--) {
    const c = cmds[i];
    if (c.start > brtMs) continue;
    const end = effEnd(c, hs);
    if (brtMs < end) return runCmd(c, brtMs, fromOf(c, i, food, cmds, noHunger));
    if (!after || end > after.ms) after = { c, i, ms: end };
  }
  const afterSpot = () => endSpotOf(after.c, after.i, after.ms, food, cmds, noHunger);

  if (hs != null && brtMs >= hs) {
    if (after && after.ms > hs) return hungryState(brtMs, after.ms, afterSpot());
    const key = hs + ':' + cmds.length;
    if (hsCache.key !== key) hsCache = { key, spot: spotFromState(stateAt(hs - 1, food, cmds, true)) };
    return hungryState(brtMs, hs, hsCache.spot);
  }
  if (food && food.feastAt != null && brtMs >= food.feastAt && !(after && after.ms > food.feastAt)) {
    if (brtMs - food.feastAt < FEAST_END) return feastState(brtMs, food.feastAt, food.hungryFrom ?? food.feastAt);
    return routine(brtMs, { ms: food.feastAt + FEAST_END, spot: FIXED.rug });
  }
  return routine(brtMs, after ? { ms: after.ms, spot: afterSpot() } : null);
}

// food = { hungrySince, feastAt, hungryFrom } e cmds = [{id,type,start,dur,catEnd,was}],
// tudo em ms de Brasília.
export function catState(brtMs, food, cmds = []) {
  return stateAt(brtMs, food, cmds, false);
}

const WHERE = { sofa: 'no sofá', bed: 'na caminha', tree: 'no alto do arranhador', sill: 'na janela', rug: 'no tapete' };
export function statusText(st, isDay) {
  if (st.pose === 'walk' && !st.run) return 'passeando pela sala';
  if (st.pose === 'jump' && !['petisco', 'caixa'].includes(st.act)) return 'dando um pulo';
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
    case 'chamar': return 'vindo ver quem chamou';
    case 'carinho': return st.pose === 'purr' ? 'ronronando com o carinho' : 'vindo pedir carinho';
    case 'caixa': return 'brincando na caixa de papelão';
    case 'pena': return 'atacando o brinquedo de pena';
    case 'laser': return 'perseguindo o ponto de laser';
    case 'petisco': return st.pose === 'eat' ? 'comendo petisco' : 'fazendo festa';
    case 'agua': return 'bebendo água fresca';
    case 'acordar': return 'acordando';
    case 'passarinho': return 'de olho no passarinho';
    case 'chuva': return 'olhando a chuva';
    case 'musica': return 'ouvindo música';
    case 'luz': return st.pose === 'sleep' ? 'dormindo no escuro' : 'curtindo a luz acesa';
    default: return 'sendo gato';
  }
}
