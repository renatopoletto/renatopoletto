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

  // chuva: riscos no céu e gotas escorrendo no vidro
  const rainDrops = Array.from({ length: 170 }, () => ({ x: r() * (W + 200), y: r() * H, len: 14 + r() * 22, v: 520 + r() * 380 }));
  const gc = document.createElement('canvas'); gc.width = 512; gc.height = 256;
  const gg = gc.getContext('2d');
  const glassTex = new THREE.CanvasTexture(gc);
  glassTex.colorSpace = THREE.SRGBColorSpace;
  const beads = Array.from({ length: 38 }, () => ({ x: r() * 512, y0: r() * 256, rad: 2 + r() * 4, v: 4 + r() * 16, w: r() * 6 }));
  let glassClear = false;

  function drawGlass(rain, tSec) {
    if (rain < 0.02) { if (!glassClear) { gg.clearRect(0, 0, 512, 256); glassTex.needsUpdate = true; glassClear = true; } return; }
    glassClear = false;
    gg.clearRect(0, 0, 512, 256);
    for (const b of beads) {
      const y = (b.y0 + tSec * b.v) % 290 - 20, x = b.x + Math.sin(tSec * 0.5 + b.w) * 1.5;
      gg.fillStyle = `rgba(215,235,255,${0.5 * rain})`;
      gg.beginPath(); gg.ellipse(x, y, b.rad * 0.8, b.rad * 1.2, 0, 0, 6.3); gg.fill();
      gg.fillStyle = `rgba(255,255,255,${0.7 * rain})`;
      gg.beginPath(); gg.arc(x - b.rad * 0.25, y - b.rad * 0.4, b.rad * 0.3, 0, 6.3); gg.fill();
      gg.strokeStyle = `rgba(215,235,255,${0.16 * rain})`; gg.lineWidth = b.rad * 0.5;
      gg.beginPath(); gg.moveTo(x, y - b.rad * 6); gg.lineTo(x, y); gg.stroke();
    }
    glassTex.needsUpdate = true;
  }

  function draw(sun, hour, tSec, rain = 0) {
    const night = Math.max(0, Math.min(1, (-sun.alt - 2) / 8));
    const [top0, bottom0, cloud0] = skyColors(sun.alt);
    const rk = rain * 0.8;
    const top = mix(top0, mix([104, 116, 134], [26, 32, 50], night), rk);
    const bottom = mix(bottom0, mix([150, 160, 174], [40, 46, 64], night), rk);
    const cloudCol = mix(cloud0, mix([150, 158, 170], [60, 66, 84], night), rk);
    drawGlass(rain, tSec);
    const grad = g.createLinearGradient(0, 0, 0, H * 0.82);
    grad.addColorStop(0, css(top)); grad.addColorStop(1, css(bottom));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);

    g.globalAlpha = 1 - 0.9 * rain;
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
    g.globalAlpha = 1;
    // nuvens
    for (const c of clouds) {
      const x = ((c.x + tSec * c.v) % (W + 300)) - 150;
      g.fillStyle = css(cloudCol, 0.85 - night * 0.45);
      for (const [dx, dy, k] of [[0, 0, 1], [0.8, 0.12, 0.75], [-0.8, 0.15, 0.7], [0.3, -0.35, 0.7], [-0.35, -0.25, 0.6]]) {
        g.beginPath(); g.ellipse(x + dx * c.s, c.y + dy * c.s, c.s * k, c.s * k * 0.55, 0, 0, 6.3); g.fill();
      }
    }
    if (rain > 0.02) { // camada de nuvens carregadas
      const cg = g.createLinearGradient(0, 0, 0, H * 0.7);
      cg.addColorStop(0, css(mix([92, 100, 116], [24, 28, 44], night), 0.92 * rain)); cg.addColorStop(1, css(mix([140, 148, 160], [44, 50, 68], night), 0));
      g.fillStyle = cg; g.fillRect(0, 0, W, H * 0.7);
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
    if (rain > 0.02) {
      g.fillStyle = css(mix([150, 160, 174], [40, 46, 64], night), 0.35 * rain); g.fillRect(0, H * 0.5, W, H * 0.5); // neblina da chuva
      g.strokeStyle = `rgba(205,220,240,${0.45 * rain})`; g.lineWidth = 1.4;
      g.beginPath();
      for (const d of rainDrops) {
        const y = (d.y + tSec * d.v) % (H + 40) - 20, x = ((d.x - y * 0.22) % (W + 200) + W + 200) % (W + 200) - 100;
        g.moveTo(x, y); g.lineTo(x - d.len * 0.22, y + d.len);
      }
      g.stroke();
    }
    texture.needsUpdate = true;
  }

  return { texture, glass: glassTex, draw };
}
