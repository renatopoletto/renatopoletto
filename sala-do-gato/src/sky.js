// Vista da janela: céu, sol/lua, nuvens e a cidade, pintados num canvas 2D.
import * as THREE from '../vendor/three.module.min.js';

const W = 1024, H = 512;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// altitude do sol (graus) -> [topo, base, nuvem]
const STOPS = [
  [-14, '#060a22', '#151c44', '#232a52'],
  [-6, '#18225a', '#55407a', '#4a4478'],
  [-1, '#35478f', '#f2855a', '#f7a98b'],
  [5, '#6c9fd9', '#ffd49c', '#fff0dd'],
  [22, '#4f9fe3', '#c6e6f8', '#ffffff'],
];
export function skyColors(alt) {
  if (alt <= STOPS[0][0]) return STOPS[0].slice(1).map(hex);
  for (let i = 1; i < STOPS.length; i++) {
    if (alt <= STOPS[i][0]) {
      const t = (alt - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]);
      return [1, 2, 3].map((j) => mix(hex(STOPS[i - 1][j]), hex(STOPS[i][j]), t));
    }
  }
  return STOPS[STOPS.length - 1].slice(1).map(hex);
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function createSky() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const r = rng(7);
  const stars = Array.from({ length: 150 }, () => ({ x: r() * W, y: r() * H * 0.75, s: 0.6 + r() * 1.5, f: r() * 6 }));
  const clouds = Array.from({ length: 6 }, () => ({ x: r() * W, y: 60 + r() * 190, s: 50 + r() * 60, v: 2 + r() * 4 }));
  const buildings = [];
  for (let x = -10; x < W;) {
    const w = 42 + r() * 70, h = 60 + r() * 150;
    const wins = [];
    for (let wy = 14; wy < h - 10; wy += 20) for (let wx = 9; wx < w - 12; wx += 17) wins.push({ x: wx, y: wy, on: r(), late: r() });
    buildings.push({ x, w, h, shade: r(), wins, roof: r() });
    x += w + r() * 14 - 4;
  }
  const trees = Array.from({ length: 16 }, () => ({ x: r() * W, s: 26 + r() * 30 }));

  function draw(sun, hour, tSec) {
    const [top, bottom, cloudCol] = skyColors(sun.alt);
    const night = Math.max(0, Math.min(1, (-sun.alt - 2) / 8));
    const grad = g.createLinearGradient(0, 0, 0, H * 0.82);
    grad.addColorStop(0, css(top)); grad.addColorStop(1, css(bottom));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);

    if (night > 0) {
      for (const s of stars) {
        g.fillStyle = `rgba(255,250,235,${night * (0.55 + 0.45 * Math.sin(tSec * 1.5 + s.f))})`;
        g.beginPath(); g.arc(s.x, s.y, s.s, 0, 6.3); g.fill();
      }
    }
    // sol ou lua: leste à direita (janela voltada para o norte)
    const a = Math.PI * sun.p;
    const bx = W * (0.5 + 0.44 * Math.cos(a)), by = H * (0.78 - 0.62 * Math.sin(a));
    if (sun.isDay) {
      const low = Math.max(0, 1 - sun.alt / 18);
      const sc = mix([255, 247, 214], [255, 150, 80], low);
      const halo = g.createRadialGradient(bx, by, 4, bx, by, 150);
      halo.addColorStop(0, css(sc, 0.75)); halo.addColorStop(1, css(sc, 0));
      g.fillStyle = halo; g.fillRect(bx - 150, by - 150, 300, 300);
      g.fillStyle = css(mix([255, 252, 235], [255, 190, 120], low));
      g.beginPath(); g.arc(bx, by, 30, 0, 6.3); g.fill();
    } else {
      const halo = g.createRadialGradient(bx, by, 4, bx, by, 110);
      halo.addColorStop(0, `rgba(210,222,255,${0.35 * night})`); halo.addColorStop(1, 'rgba(210,222,255,0)');
      g.fillStyle = halo; g.fillRect(bx - 110, by - 110, 220, 220);
      g.fillStyle = `rgba(244,244,228,${night})`;
      g.beginPath(); g.arc(bx, by, 24, 0, 6.3); g.fill();
      g.fillStyle = css(mix(top, bottom, by / (H * 0.82)), night);
      g.beginPath(); g.arc(bx + 11, by - 5, 21, 0, 6.3); g.fill();
    }
    // nuvens
    for (const c of clouds) {
      const x = ((c.x + tSec * c.v) % (W + 300)) - 150;
      g.fillStyle = css(cloudCol, 0.85 - night * 0.45);
      for (const [dx, dy, k] of [[0, 0, 1], [0.8, 0.12, 0.75], [-0.8, 0.15, 0.7], [0.3, -0.35, 0.7], [-0.35, -0.25, 0.6]]) {
        g.beginPath(); g.ellipse(x + dx * c.s, c.y + dy * c.s, c.s * k, c.s * k * 0.55, 0, 0, 6.3); g.fill();
      }
    }
    // cidade
    const base = H * 0.86;
    const lit = Math.max(0, Math.min(1, (4 - sun.alt) / 8));
    const lateNight = hour >= 23 || hour < 5.5;
    for (const b of buildings) {
      const tone = mix(mix([120, 132, 150], [62, 72, 100], b.shade), bottom, 0.28);
      const col = mix(tone, [16, 20, 40], night * 0.8);
      g.fillStyle = css(col);
      g.fillRect(b.x, base - b.h, b.w, b.h + 80);
      if (b.roof > 0.6) g.fillRect(b.x + b.w * 0.3, base - b.h - 12, b.w * 0.25, 12);
      for (const w of b.wins) {
        const on = lit > 0 && w.on < (lateNight ? 0.14 : 0.6) * lit && !(lateNight && w.late < 0.3);
        g.fillStyle = on ? (w.late > 0.5 ? '#ffd98a' : '#ffe9b8') : css(mix(col, [200, 225, 245], 0.22 * (1 - night)));
        g.fillRect(b.x + w.x, base - b.h + w.y, 9, 11);
      }
    }
    for (const t of trees) {
      g.fillStyle = css(mix([70, 122, 78], [14, 26, 34], night * 0.85));
      g.beginPath(); g.arc(t.x, base + 22, t.s, 0, 6.3); g.arc(t.x + t.s * 0.7, base + 30, t.s * 0.8, 0, 6.3); g.fill();
    }
    g.fillStyle = css(mix([86, 140, 88], [12, 22, 30], night * 0.85));
    g.fillRect(0, base + 38, W, H);
    texture.needsUpdate = true;
  }

  return { texture, draw };
}
