// A sala: paredes, janela, móveis e luminárias.
import * as THREE from '../vendor/three.module.min.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const mats = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...opts }));
  return mats.get(key);
}
function canvasTex(w, h, paint, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function rboxGeo(w, h, d, r) {
  r = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
  const iw = w - 2 * r, ih = h - 2 * r, c = Math.min(r, iw / 2, ih / 2) * 0.98;
  const s = new THREE.Shape();
  s.moveTo(-iw / 2 + c, -ih / 2);
  s.lineTo(iw / 2 - c, -ih / 2); s.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + c);
  s.lineTo(iw / 2, ih / 2 - c); s.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - c, ih / 2);
  s.lineTo(-iw / 2 + c, ih / 2); s.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - c);
  s.lineTo(-iw / 2, -ih / 2 + c); s.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + c, -ih / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 4 });
  g.center();
  return g;
}

export function createRoom(scene, skyTexture) {
  const room = new THREE.Group();
  scene.add(room);
  const R = rng(42);

  const add = (geo, material, x, y, z, parent = room) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  };
  const box = (w, h, d, color, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color, x, y, z, parent);
  const rbox = (w, h, d, r, color, x, y, z, parent) => add(rboxGeo(w, h, d, r), typeof color === 'string' ? mat(color) : color, x, y, z, parent);
  const cyl = (rt, rb, h, color, x, y, z, parent, seg = 24) => add(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'string' ? mat(color) : color, x, y, z, parent);
  const ball = (r, color, x, y, z, parent) => add(new THREE.SphereGeometry(r, 20, 14), typeof color === 'string' ? mat(color) : color, x, y, z, parent);

  // sombra suave pintada sob os móveis
  const blobTex = canvasTex(128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    rg.addColorStop(0, 'rgba(40,22,10,0.42)'); rg.addColorStop(1, 'rgba(40,22,10,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const blob = (x, z, w, d, y = 0.006) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 2; room.add(m);
  };

  // ---------- piso ----------
  const floorTex = canvasTex(512, 512, (g, w, h) => {
    const rr = rng(3);
    const rows = 8, ph = h / rows;
    for (let i = 0; i < rows; i++) {
      let x = -rr() * 200;
      while (x < w) {
        const len = 150 + rr() * 170;
        const t = rr();
        g.fillStyle = `rgb(${186 + t * 26 | 0},${132 + t * 22 | 0},${84 + t * 18 | 0})`;
        g.fillRect(x, i * ph, len, ph);
        g.strokeStyle = 'rgba(90,52,24,0.10)';
        for (let k = 0; k < 4; k++) { const yy = i * ph + 6 + rr() * (ph - 12); g.beginPath(); g.moveTo(x + 4, yy); g.bezierCurveTo(x + len * 0.3, yy + 3, x + len * 0.6, yy - 3, x + len - 4, yy + 1); g.stroke(); }
        g.fillStyle = 'rgba(70,38,16,0.55)'; g.fillRect(x + len - 2, i * ph, 2, ph);
        x += len;
      }
      g.fillStyle = 'rgba(70,38,16,0.55)'; g.fillRect(0, i * ph, w, 2);
    }
  }, [2.2, 1.7]);
  const floor = box(8.4, 0.3, 6.4, mat('#ffffff', { map: floorTex }), -0.1, -0.15, 0.1);
  floor.castShadow = false;
  box(8.5, 0.12, 6.5, '#8a5a36', -0.1, -0.36, 0.1).castShadow = false;

  // ---------- paredes ----------
  const WALL = '#ecdcc2', WAINS = '#86a08c', TRIM = '#f7f0e2';
  box(0.2, 4.2, 6.4, WALL, -4.1, 2.1, 0.1);                 // esquerda
  box(2.3, 4.2, 0.2, WALL, -3.05, 2.1, -3.1);               // fundo, à esquerda da janela
  box(2.7, 4.2, 0.2, WALL, 2.65, 2.1, -3.1);                // fundo, à direita
  box(3.2, 1.25, 0.2, WALL, -0.3, 0.625, -3.1);             // abaixo da janela
  box(3.2, 0.85, 0.2, WALL, -0.3, 3.775, -3.1);             // acima da janela
  // lambri e rodapé
  box(0.04, 1.0, 6.0, WAINS, -3.98, 0.5, 0).castShadow = false;
  box(8.0, 1.0, 0.04, WAINS, 0, 0.5, -2.98).castShadow = false;
  box(0.07, 0.07, 6.0, TRIM, -3.965, 1.03, 0).castShadow = false;
  box(8.0, 0.07, 0.07, TRIM, 0, 1.03, -2.965).castShadow = false;
  box(0.06, 0.14, 6.0, TRIM, -3.97, 0.07, 0).castShadow = false;
  box(8.0, 0.14, 0.06, TRIM, 0, 0.07, -2.97).castShadow = false;
  for (let i = 0; i < 9; i++) box(0.02, 0.8, 0.03, '#7a9482', -3.5 + i * 0.9, 0.52, -2.955).castShadow = false;
  for (let i = 0; i < 7; i++) box(0.03, 0.8, 0.02, '#7a9482', -3.955, 0.52, -2.6 + i * 0.9).castShadow = false;

  // oclusores invisíveis: fazem a luz do sol entrar só pela janela
  const occ = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.2, 7.4), occ); ceiling.position.set(0, 4.3, 0);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.6, 7.4), occ); rightWall.position.set(4.3, 2.1, 0);
  const leftOuter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.6, 7.4), occ); leftOuter.position.set(-4.3, 2.1, 0);
  for (const o of [ceiling, rightWall, leftOuter]) { o.castShadow = true; o.renderOrder = -1; room.add(o); }

  // ---------- janela ----------
  const WX = -0.3, WY = 2.3, WW = 3.2, WH = 2.1;
  const view = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({
    map: skyTexture, toneMapped: false,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc,
  }));
  view.position.set(-2.2, 2.3, -5.2); view.renderOrder = 2; room.add(view);
  const mask = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
  }));
  mask.position.set(WX, WY, -3.1); mask.renderOrder = 1; room.add(mask);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), new THREE.MeshStandardMaterial({ color: '#dff1ff', transparent: true, opacity: 0.1, roughness: 0.05 }));
  glass.position.set(WX, WY, -3.08); glass.renderOrder = 4; room.add(glass);
  // caixilhos
  box(WW + 0.24, 0.12, 0.3, TRIM, WX, WY + WH / 2 + 0.06, -3.05);
  box(0.12, WH, 0.3, TRIM, WX - WW / 2 - 0.06, WY, -3.05);
  box(0.12, WH, 0.3, TRIM, WX + WW / 2 + 0.06, WY, -3.05);
  box(0.07, WH, 0.09, TRIM, WX, WY, -3.08);
  box(0.05, WH, 0.07, TRIM, WX - WW / 4, WY, -3.08);
  box(0.05, WH, 0.07, TRIM, WX + WW / 4, WY, -3.08);
  box(WW, 0.05, 0.07, TRIM, WX, WY + 0.35, -3.08);
  // banco da janela
  box(3.7, 0.09, 0.66, '#a9744a', WX, 1.2, -2.69);
  for (const dx of [-1.6, 0, 1.6]) box(0.08, 0.3, 0.4, '#8f5f3b', WX + dx, 1.02, -2.8);
  rbox(1.2, 0.09, 0.56, 0.04, '#d98b5f', WX, 1.285, -2.69);
  // vasinhos e livros no banco
  const pot = (x, y, z, s, leaf, kind) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); room.add(g);
    cyl(0.16, 0.12, 0.26, '#c9714a', 0, 0.13, 0, g);
    cyl(0.175, 0.175, 0.05, '#b9623f', 0, 0.25, 0, g);
    cyl(0.14, 0.14, 0.02, '#4a3526', 0, 0.265, 0, g);
    if (kind === 'cactus') {
      const c = ball(0.13, leaf, 0, 0.42, 0, g); c.scale.set(1, 1.6, 1);
      const c2 = ball(0.07, leaf, 0.13, 0.46, 0, g); c2.scale.set(1, 1.5, 1);
      ball(0.03, '#f2a0b5', 0.02, 0.64, 0.03, g);
    } else if (kind === 'bush') {
      for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.1 + R() * 0.1; ball(0.1 + R() * 0.06, i % 3 ? leaf : '#6fae78', Math.cos(a) * rr, 0.36 + R() * 0.2, Math.sin(a) * rr, g); }
    } else {
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39996, tilt = 0.15 + R() * 0.7, len = 0.45 + R() * 0.6;
        const stem = new THREE.Group(); stem.position.set(0, 0.26, 0); stem.rotation.set(0, a, 0); g.add(stem);
        const arm = new THREE.Group(); arm.rotation.z = -tilt; stem.add(arm);
        cyl(0.012, 0.016, len, '#4f8a55', 0, len / 2, 0, arm, 6);
        const lf = ball(0.13, i % 2 ? leaf : '#3f8a58', 0, len + 0.1, 0, arm); lf.scale.set(0.85, 1.5, 0.12); lf.rotation.x = 0.5;
      }
    }
    return g;
  };
  pot(0.95, 1.245, -2.72, 0.75, '#5a9c62', 'bush');
  pot(-1.75, 1.245, -2.76, 0.6, '#5b9a6a', 'cactus');
  box(0.34, 0.06, 0.24, '#b8503c', -1.3, 1.275, -2.66).rotation.y = 0.2;
  box(0.3, 0.05, 0.22, '#e3c16a', -1.3, 1.33, -2.66).rotation.y = -0.15;
  // cortinas
  const CURT = '#f4e6cf';
  cyl(0.03, 0.03, 4.3, '#6b4a33', WX, 3.62, -2.86).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    ball(0.06, '#6b4a33', WX + s * 2.15, 3.62, -2.86);
    for (let i = 0; i < 6; i++) {
      const c = cyl(0.075, 0.085, 2.5, i % 2 ? CURT : '#ecdcc0', WX + s * (1.52 + i * 0.105), 2.36, -2.86 + (i % 2) * 0.03, room, 10);
      c.scale.z = 0.8;
    }
  }

  // ---------- tapete ----------
  const rugTex = canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#f1e2c8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c96f4a'; g.lineWidth = 10; g.strokeRect(22, 22, w - 44, h - 44);
    g.strokeStyle = '#3f6f73'; g.lineWidth = 4; g.strokeRect(40, 40, w - 80, h - 80);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) {
      const x = 80 + i * 44, y = 82 + j * 44;
      g.fillStyle = (i + j) % 2 ? '#d99a3d' : '#c96f4a';
      g.beginPath(); g.moveTo(x, y - 13); g.lineTo(x + 13, y); g.lineTo(x, y + 13); g.lineTo(x - 13, y); g.fill();
      g.fillStyle = '#f1e2c8'; g.beginPath(); g.arc(x, y, 3.5, 0, 6.3); g.fill();
    }
  });
  const rug = rbox(4.3, 3.1, 0.03, 0.012, mat('#ffffff', { map: rugTex, roughness: 1 }), 0.15, 0.016, 0.35);
  rug.rotation.x = -Math.PI / 2; rug.castShadow = false;
  {
    const uv = rug.geometry.attributes.uv, pos = rug.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 4.3 + 0.5, pos.getY(i) / 3.1 + 0.5);
  }

  // ---------- sofá ----------
  const SOFA = '#3f7276', SOFA2 = '#4a8286';
  blob(-3.2, -0.35, 2.2, 3.6);
  rbox(1.4, 0.34, 2.9, 0.07, SOFA, -3.25, 0.3, -0.35);
  rbox(0.4, 0.95, 2.9, 0.1, SOFA, -3.75, 0.72, -0.35);
  for (const z of [-1.72, 1.02]) rbox(1.4, 0.72, 0.3, 0.1, SOFA, -3.25, 0.5, z);
  for (const z of [-1.03, 0.33]) rbox(1.02, 0.2, 1.3, 0.08, SOFA2, -3.07, 0.5, z);
  for (const [x, z] of [[-3.85, -1.7], [-2.65, -1.7], [-3.85, 1.0], [-2.65, 1.0]]) cyl(0.04, 0.03, 0.14, '#6b4a33', x, 0.07, z);
  const cushion = (x, y, z, c, ry, rz) => { const m = rbox(0.5, 0.5, 0.16, 0.07, c, x, y, z); m.rotation.set(0, ry, rz); return m; };
  cushion(-3.48, 0.86, -1.3, '#d99a3d', Math.PI / 2 - 0.15, 0.12);
  cushion(-3.45, 0.84, 0.62, '#c96f4a', Math.PI / 2 + 0.2, -0.1);
  cushion(-3.38, 0.82, 0.2, '#f1e2c8', Math.PI / 2 + 0.05, 0.2).scale.setScalar(0.85);
  // manta no braço
  rbox(1.0, 0.06, 0.5, 0.025, '#e9c9a0', -3.2, 0.885, 1.02);
  rbox(0.5, 0.42, 0.05, 0.02, '#e9c9a0', -2.95, 0.68, 1.19);

  // ---------- abajur de chão ----------
  const lampGlow = new THREE.MeshStandardMaterial({ color: '#f6dfb4', emissive: '#ffb45e', emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide });
  cyl(0.24, 0.26, 0.05, '#3b3530', -3.45, 0.025, -2.45);
  cyl(0.022, 0.022, 2.4, '#3b3530', -3.45, 1.22, -2.45, room, 8);
  const shade = add(new THREE.CylinderGeometry(0.2, 0.36, 0.44, 24, 1, true), lampGlow, -3.45, 2.52, -2.45);
  shade.castShadow = false;
  const floorLamp = new THREE.PointLight('#ffb866', 0, 12, 1.6);
  floorLamp.position.set(-3.4, 2.3, -2.4);
  floorLamp.castShadow = true; floorLamp.shadow.mapSize.set(1024, 1024); floorLamp.shadow.bias = -0.004; floorLamp.shadow.radius = 4;
  room.add(floorLamp);

  // ---------- mesinha com abajur ----------
  blob(-3.35, 1.85, 1.1, 1.1);
  cyl(0.4, 0.4, 0.05, '#a9744a', -3.35, 0.66, 1.85);
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; const l = cyl(0.025, 0.02, 0.66, '#8f5f3b', -3.35 + Math.cos(a) * 0.27, 0.33, 1.85 + Math.sin(a) * 0.27, room, 8); l.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); }
  const tGlow = lampGlow.clone();
  cyl(0.1, 0.13, 0.06, '#d9c7a8', -3.45, 0.715, 1.75);
  ball(0.1, '#d9c7a8', -3.45, 0.82, 1.75);
  cyl(0.012, 0.012, 0.2, '#3b3530', -3.45, 0.96, 1.75, room, 6);
  add(new THREE.CylinderGeometry(0.12, 0.2, 0.24, 20, 1, true), tGlow, -3.45, 1.1, 1.75).castShadow = false;
  const tableLamp = new THREE.PointLight('#ffb866', 0, 7, 1.7);
  tableLamp.position.set(-3.4, 1.1, 1.8); room.add(tableLamp);
  // caneca
  cyl(0.055, 0.05, 0.11, '#f3ede1', -3.12, 0.74, 2.02, room, 16);
  cyl(0.045, 0.045, 0.01, '#5b3a25', -3.12, 0.792, 2.02, room, 16);
  add(new THREE.TorusGeometry(0.035, 0.011, 6, 12), mat('#f3ede1'), -3.06, 0.74, 2.02);

  // ---------- estante ----------
  const WOOD = '#7a5338';
  const SX = 2.75, SW = 2.0, SD = 0.5, SZ = -2.75, SHh = 3.5;
  blob(SX, SZ + 0.2, SW + 0.5, 1.1);
  box(SW, SHh, 0.04, '#5f402b', SX, SHh / 2, SZ - SD / 2 + 0.02);
  for (const s of [-1, 1]) box(0.07, SHh, SD, WOOD, SX + s * (SW / 2 - 0.035), SHh / 2, SZ);
  const BOOKS = ['#b8503c', '#3f7276', '#d99a3d', '#e7dcc6', '#5c7a5e', '#8b5a7a', '#34506b', '#c9714a', '#efe3cf', '#6c8fa8'];
  for (let i = 0; i <= 5; i++) {
    const y = 0.1 + i * 0.66;
    box(SW, 0.06, SD, WOOD, SX, y, SZ);
    if (i === 5) break;
    let x = SX - SW / 2 + 0.11;
    const end = SX + SW / 2 - 0.11;
    const gapAt = Math.floor(R() * 3);
    let n = 0;
    while (x < end - 0.08) {
      if (n === 4 + gapAt * 3 && end - x > 0.5) {
        const k = (i + gapAt) % 4;
        if (k === 0) pot(x + 0.2, y + 0.03, SZ + 0.02, 0.55, '#5a9c62', 'bush');
        else if (k === 1) { ball(0.13, '#6c8fa8', x + 0.2, y + 0.2, SZ + 0.02); cyl(0.07, 0.09, 0.07, '#3b3530', x + 0.2, y + 0.065, SZ + 0.02); }
        else if (k === 2) { cyl(0.07, 0.1, 0.3, '#e7dcc6', x + 0.2, y + 0.18, SZ + 0.02); ball(0.075, '#e7dcc6', x + 0.2, y + 0.36, SZ + 0.02); }
        else { for (let b = 0; b < 3; b++) box(0.34 - b * 0.03, 0.06, 0.26, BOOKS[(b * 3 + i) % BOOKS.length], x + 0.2, y + 0.06 + b * 0.062, SZ + 0.03).rotation.y = (R() - 0.5) * 0.4; }
        x += 0.44; n++; continue;
      }
      const w = 0.05 + R() * 0.07, h = 0.36 + R() * 0.2, d = 0.3 + R() * 0.1;
      if (x + w > end) break;
      const b = box(w, h, d, BOOKS[Math.floor(R() * BOOKS.length)], x + w / 2, y + 0.03 + h / 2, SZ + 0.04 - (0.4 - d) / 2);
      if (R() < 0.12 && x + w + 0.12 < end) { b.rotation.z = -0.22; b.position.x += 0.05; x += 0.07; }
      x += w + 0.004; n++;
    }
  }
  // caixa e cesto em cima da estante
  box(0.6, 0.3, 0.36, '#c9a57a', SX - 0.45, SHh + 0.18, SZ);
  pot(SX + 0.45, SHh + 0.03, SZ, 0.8, '#4f9460', 'leafy');

  // ---------- arranhador ----------
  blob(3.2, -1.3, 1.5, 1.5);
  rbox(0.95, 0.09, 0.95, 0.03, '#d9c7a8', 3.2, 0.045, -1.3);
  const post = cyl(0.1, 0.1, 1.44, '#c9a57a', 3.2, 0.8, -1.3);
  for (let i = 0; i < 20; i++) add(new THREE.TorusGeometry(0.102, 0.012, 5, 14), mat('#b08d62'), 3.2, 0.14 + i * 0.07, -1.3).rotation.x = Math.PI / 2;
  post.castShadow = true;
  rbox(0.6, 0.07, 0.6, 0.03, '#d9c7a8', 2.92, 0.82, -1.02);
  rbox(0.98, 0.09, 0.98, 0.04, '#d9c7a8', 3.2, 1.545, -1.3);
  rbox(0.9, 0.03, 0.9, 0.012, '#c96f4a', 3.2, 1.6, -1.3);
  // brinquedo pendurado
  cyl(0.004, 0.004, 0.42, '#6b4a33', 2.68, 1.3, -1.45, room, 4);
  const dangle = ball(0.055, '#d99a3d', 2.68, 1.07, -1.45);

  // ---------- potes de ração e água ----------
  rbox(0.62, 0.015, 1.05, 0.006, '#5c7a5e', 3.35, 0.012, 1.18).castShadow = false;
  const bowl = (z, fill) => {
    cyl(0.17, 0.14, 0.09, '#f3ede1', 3.35, 0.06, z);
    cyl(0.14, 0.14, 0.012, fill, 3.35, 0.103, z);
  };
  bowl(0.9, '#8a5a36'); bowl(1.45, mat('#7fc0df', { roughness: 0.1 }));

  // ---------- caminha ----------
  blob(-1.6, 2.15, 1.6, 1.6);
  add(new THREE.TorusGeometry(0.47, 0.13, 12, 28), mat('#c96f4a'), -1.6, 0.13, 2.15).rotation.x = Math.PI / 2;
  cyl(0.47, 0.47, 0.07, '#f1e2c8', -1.6, 0.045, 2.15);

  // ---------- planta grande ----------
  blob(-3.45, 2.72, 1.0, 1.0);
  pot(-3.45, 0, 2.72, 1.15, '#4f9460', 'leafy');

  // ---------- bolinha ----------
  const yarnTex = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#d9584e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8433b'; g.lineWidth = 2;
    for (let i = -8; i < 24; i++) { g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + 40, h); g.stroke(); g.beginPath(); g.moveTo(i * 8 + 40, 0); g.lineTo(i * 8, h); g.stroke(); }
  });
  const yarn = add(new THREE.SphereGeometry(0.09, 20, 14), mat('#ffffff', { map: yarnTex }), 0.9, 0.09, 0.9);

  // ---------- parede esquerda: quadros e prateleira ----------
  const frame = (z, y, w, h, paint) => {
    box(0.05, h + 0.12, w + 0.12, '#6b4a33', -3.975, y, z);
    const t = canvasTex(256, Math.round(256 * h / w), paint);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat('#ffffff', { map: t }));
    p.rotation.y = Math.PI / 2; p.position.set(-3.945, y, z); room.add(p);
  };
  frame(-1.15, 2.45, 0.8, 1.05, (g, w, h) => {
    g.fillStyle = '#f3e3c7'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8943a'; g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.26, 0, 6.3); g.fill();
    g.fillStyle = '#3f7276'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.72); g.lineTo(w * 0.35, h * 0.5); g.lineTo(w * 0.62, h * 0.75); g.lineTo(w * 0.8, h * 0.62); g.lineTo(w, h * 0.78); g.lineTo(w, h); g.fill();
    g.fillStyle = '#5c7a5e'; g.fillRect(0, h * 0.86, w, h);
  });
  frame(-0.1, 2.75, 0.62, 0.62, (g, w, h) => {
    g.fillStyle = '#d98b5f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f2a26';
    g.beginPath(); g.ellipse(w / 2, h * 0.7, w * 0.26, h * 0.24, 0, 0, 6.3); g.fill();
    g.beginPath(); g.arc(w / 2, h * 0.4, w * 0.17, 0, 6.3); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + s * w * 0.16, h * 0.36); g.lineTo(w / 2 + s * w * 0.15, h * 0.17); g.lineTo(w / 2 + s * w * 0.04, h * 0.27); g.fill(); }
  });
  frame(0.75, 2.4, 0.66, 0.9, (g, w, h) => {
    g.fillStyle = '#e7ecdf'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4f8a55'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h * 0.95); g.quadraticCurveTo(w * 0.45, h * 0.5, w * 0.55, h * 0.1); g.stroke();
    g.fillStyle = '#5a9c62';
    for (let i = 0; i < 6; i++) { const y = h * (0.8 - i * 0.12), s = i % 2 ? 1 : -1; g.beginPath(); g.ellipse(w / 2 + s * w * 0.17, y, w * 0.17, h * 0.045, s * -0.5, 0, 6.3); g.fill(); }
  });
  frame(-0.1, 2.05, 0.62, 0.42, (g, w, h) => {
    g.fillStyle = '#34506b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4f0dc'; g.beginPath(); g.arc(w * 0.68, h * 0.4, h * 0.2, 0, 6.3); g.fill();
    g.fillStyle = '#34506b'; g.beginPath(); g.arc(w * 0.74, h * 0.34, h * 0.18, 0, 6.3); g.fill();
    g.fillStyle = '#f4f0dc'; for (let i = 0; i < 14; i++) g.fillRect((i * 53) % w, (i * 31) % (h * 0.8), 3, 3);
  });
  box(0.3, 0.05, 1.3, '#a9744a', -3.85, 2.3, 2.15);
  pot(-3.82, 2.325, 2.5, 0.6, '#5a9c62', 'bush');
  // planta pendente
  for (let i = 0; i < 7; i++) { const l = ball(0.06, i % 2 ? '#5a9c62' : '#4f9460', -3.74 + (i % 2) * 0.05, 2.25 - i * 0.11, 2.5 + Math.sin(i * 1.7) * 0.07); l.scale.set(0.5, 1, 1); }
  for (let b = 0; b < 4; b++) box(0.2, 0.3 + (b % 2) * 0.06, 0.07, BOOKS[b + 2], -3.83, 2.48 + (b % 2) * 0.03, 1.66 + b * 0.085);
  cyl(0.05, 0.05, 0.16, '#f1e2c8', -3.83, 2.405, 2.12, room, 12);
  const flame = ball(0.022, new THREE.MeshBasicMaterial({ color: '#ffd27a' }), -3.83, 2.51, 2.12); flame.scale.y = 1.6; flame.castShadow = false;

  // ---------- relógio de parede (hora de Brasília) ----------
  const clock = new THREE.Group(); clock.position.set(-3.05, 2.95, -2.97); room.add(clock);
  const rim = cyl(0.36, 0.36, 0.06, '#6b4a33', 0, 0, 0, clock, 40); rim.rotation.x = Math.PI / 2;
  const face = cyl(0.31, 0.31, 0.065, '#fbf4e6', 0, 0, 0.003, clock, 40); face.rotation.x = Math.PI / 2; face.castShadow = false;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const tick = box(0.018, i % 3 ? 0.04 : 0.075, 0.01, '#3b3530', Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.04, clock);
    tick.rotation.z = -a; tick.castShadow = false;
  }
  const hand = (len, w, color, z) => {
    const g = new THREE.Group(); g.position.z = z; clock.add(g);
    const m = box(w, len, 0.008, color, 0, len / 2 - 0.03, 0, g); m.castShadow = false;
    return g;
  };
  const hHand = hand(0.17, 0.026, '#3b3530', 0.044), mHand = hand(0.25, 0.018, '#3b3530', 0.052), sHand = hand(0.27, 0.008, '#c9483a', 0.06);
  cyl(0.022, 0.022, 0.03, '#c9483a', 0, 0, 0.055, clock, 12).rotation.x = Math.PI / 2;

  // ---------- pisca-pisca ----------
  const fairyMat = new THREE.MeshStandardMaterial({ color: '#fff1cf', emissive: '#ffc470', emissiveIntensity: 0 });
  const pts = [];
  for (let i = 0; i <= 5; i++) pts.push(new THREE.Vector3(-3.93, 3.95 - (i % 2) * 0.22, 2.9 - i * 1.16));
  for (let i = 1; i <= 7; i++) pts.push(new THREE.Vector3(-3.95 + i * 1.13, 3.95 - (i % 2) * 0.22, -2.93));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.6);
  const wire = add(new THREE.TubeGeometry(curve, 120, 0.008, 5), mat('#4a3a2c'), 0, 0, 0); wire.castShadow = false;
  for (let i = 0; i <= 34; i++) { const p = curve.getPoint(i / 34); const b = ball(0.04, fairyMat, p.x, p.y - 0.05, p.z); b.castShadow = false; }
  const fairyLight = new THREE.PointLight('#ffc98a', 0, 9, 1.6);
  fairyLight.position.set(-1.5, 3.5, -1.2); room.add(fairyLight);

  function setClock(h, m, s) {
    hHand.rotation.z = -((h % 12) + m / 60) * Math.PI / 6;
    mHand.rotation.z = -(m + s / 60) * Math.PI / 30;
    sHand.rotation.z = -Math.floor(s) * Math.PI / 30;
  }
  // lamp: 0..1 abajures; fairy: 0..1 pisca-pisca
  function setLights(lamp, fairy, t) {
    floorLamp.intensity = 26 * lamp; tableLamp.intensity = 7 * lamp;
    lampGlow.emissiveIntensity = 1.5 * lamp; tGlow.emissiveIntensity = 1.5 * lamp;
    fairyMat.emissiveIntensity = fairy * (1.6 + 0.25 * Math.sin(t * 1.3));
    fairyLight.intensity = 5 * fairy;
    flame.visible = lamp > 0.05;
    dangle.position.x = 2.68 + Math.sin(t * 1.1) * 0.02;
  }

  return { yarn, setClock, setLights };
}
