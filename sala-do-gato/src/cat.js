// A Pipoca: gata laranja construída com formas simples e animada por código.
import * as THREE from '../vendor/three.module.min.js';

const ORANGE = '#e8923a', DARK = '#bf651c', CREAM = '#fcefdc', PINK = '#f0a3a0';

function furTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.fillStyle = ORANGE; g.fillRect(0, 0, 256, 256);
  if (kind === 'body') {
    // barriga clara (u ~ 0.25) e listras no dorso (u ~ 0.75)
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0.08, 'rgba(252,239,220,0)');
    grad.addColorStop(0.25, 'rgba(252,239,220,0.95)');
    grad.addColorStop(0.42, 'rgba(252,239,220,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.fillStyle = DARK;
    for (let i = 0; i < 9; i++) {
      const y = 40 + i * 22;
      g.beginPath(); g.ellipse(192, y, 52 - (i % 2) * 8, 4.5, 0, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === 'head') {
    // rosto em u = 0.25; testa listrada; bochechas claras
    g.fillStyle = CREAM;
    g.beginPath(); g.ellipse(64, 168, 30, 26, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = DARK; g.lineWidth = 5; g.lineCap = 'round';
    for (const dx of [-12, 0, 12]) { g.beginPath(); g.moveTo(64 + dx, 28); g.lineTo(64 + dx * 0.8, 70); g.stroke(); }
    for (const s of [-1, 1]) for (const dy of [0, 14]) {
      g.beginPath(); g.moveTo(64 + s * 40, 120 + dy); g.lineTo(64 + s * 62, 114 + dy); g.stroke();
    }
    g.fillStyle = DARK;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(192, 30 + i * 22, 44, 4, 0, 0, Math.PI * 2); g.fill(); }
  } else {
    g.fillStyle = DARK;
    for (let i = 0; i < 6; i++) g.fillRect(0, 20 + i * 42, 256, 14);
  }
  // fios de pelo: traços finos claros e escuros por cima de tudo
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineCap = 'round';
  let q = kind.length * 977 + 13;
  const rn = () => { q = (q * 16807) % 2147483647; return q / 2147483647; };
  for (let i = 0; i < 7000; i++) {
    const x = rn() * 512, y = rn() * 512, ang = rn() * 6.283, len = 5 + rn() * 7;
    g.strokeStyle = rn() < 0.5 ? 'rgba(255,236,200,0.13)' : 'rgba(140,64,16,0.13)';
    g.lineWidth = 0.9 + rn() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const BASE = {
  bodyY: 0.42, pitch: 0, roll: 0, headPitch: 0, headYaw: 0, headY: 0,
  fl: 0, fr: 0, hl: 0, hr: 0, lenF: 1, lenH: 1, lenFR: 1,
  tailLift: 0.95, tailCurl: 0.13, tailSide: 0, eye: 1, walk: 0, sway: 1,
};
const POSES = {
  stand: {},
  walk: { walk: 1, headPitch: 0.05 },
  sit: { bodyY: 0.34, pitch: -0.75, headPitch: 0.72, fl: 0.75, fr: 0.75, lenF: 1.12, lenFR: 1.12, hl: -0.6, hr: -0.6, lenH: 0.6, tailLift: 0.72, tailCurl: 0, tailSide: 0.36 },
  loaf: { bodyY: 0.2, fl: -0.7, fr: -0.7, hl: -0.5, hr: -0.5, lenF: 0.34, lenFR: 0.34, lenH: 0.3, tailLift: 0.02, tailCurl: 0, tailSide: 0.44, eye: 0.4, headY: -0.03, sway: 0.2 },
  sleep: { bodyY: 0.19, roll: 0.14, fl: -0.7, fr: -0.7, hl: -0.5, hr: -0.5, lenF: 0.3, lenFR: 0.3, lenH: 0.3, tailLift: 0.02, tailCurl: 0, tailSide: 0.5, eye: 0, headPitch: 0.5, headYaw: 0.75, headY: -0.13, sway: 0 },
  eat: { pitch: 0.2, headPitch: 0.8, headY: -0.07, tailLift: 0.45, tailCurl: 0.05, sway: 0.4 },
  crouch: { bodyY: 0.3, pitch: 0.08, lenF: 0.72, lenFR: 0.72, lenH: 0.72, headPitch: -0.12, tailLift: 0.15, tailCurl: 0.04 },
  jump: { pitch: -0.3, fl: -1.0, fr: -1.0, hl: 0.9, hr: 0.9, headPitch: 0.2, tailLift: 0.3, tailCurl: 0.05, sway: 0 },
};
POSES.watch = { ...POSES.sit };
POSES.rear = { bodyY: 0.5, pitch: -1.15, headPitch: 1.0, fl: -1.25, fr: -0.55, hl: -0.25, hr: -0.25, lenF: 1.1, lenFR: 1.1, lenH: 1.0, tailLift: 0.4, tailCurl: 0.05, sway: 1.4 };
POSES.stretch = { bodyY: 0.36, pitch: 0.5, headPitch: 0.25, fl: -1.4, fr: -1.4, lenF: 1.05, lenFR: 1.05, hl: 0, hr: 0, tailLift: 1.3, tailCurl: 0.1, eye: 0.25 };
POSES.groom = { ...POSES.sit, fr: -1.1, lenFR: 0.95, headPitch: 1.2, headYaw: -0.3, eye: 0.3 };
POSES.purr = { ...POSES.sit, eye: 0.04, headPitch: 0.6, tailSide: 0.5, sway: 0.5 };
POSES.listen = { ...POSES.sit };

export function createCat() {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(1.22);
  root.add(inner);

  const std = (opts) => new THREE.MeshPhysicalMaterial({ roughness: 0.95, sheen: 1, sheenRoughness: 0.45, sheenColor: '#ffddb0', ...opts });
  const mOrange = std({ color: ORANGE });
  const mCream = std({ color: CREAM });
  const mPink = std({ color: PINK });
  const mBody = std({ map: furTexture('body') });
  const mHead = std({ map: furTexture('head') });
  const mTail = std({ map: furTexture('tail') });
  const mEye = new THREE.MeshStandardMaterial({ color: '#1c1a17', roughness: 0.15 });
  const mShine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const mWhisk = new THREE.MeshBasicMaterial({ color: '#fff8ee' });

  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  };
  const sph = new THREE.SphereGeometry(1, 28, 20);

  const body = new THREE.Group();
  inner.add(body);

  const torsoGeo = new THREE.SphereGeometry(1, 32, 24); torsoGeo.rotateX(Math.PI / 2);
  const torso = mesh(torsoGeo, mBody, body); torso.scale.set(0.19, 0.185, 0.37);
  const chest = mesh(sph, mOrange, body, 0, -0.005, 0.2); chest.scale.set(0.165, 0.17, 0.16);
  const bib = mesh(sph, mCream, body, 0, -0.03, 0.27); bib.scale.set(0.11, 0.12, 0.1);
  const haunch = mesh(sph, mOrange, body, 0, -0.01, -0.2); haunch.scale.set(0.185, 0.18, 0.18);

  // cabeça
  const head = new THREE.Group(); head.position.set(0, 0.15, 0.37); head.rotation.order = 'YXZ';
  body.add(head);
  const skull = mesh(new THREE.SphereGeometry(1, 32, 24), mHead, head); skull.scale.set(0.185, 0.16, 0.16);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * 0.105, 0.115, -0.01); ear.rotation.z = -s * 0.28;
    const outer = mesh(new THREE.ConeGeometry(0.068, 0.14, 4), mOrange, ear, 0, 0.05, 0); outer.rotation.y = Math.PI / 4; outer.scale.z = 0.6;
    const innerEar = mesh(new THREE.ConeGeometry(0.042, 0.095, 4), mPink, ear, 0, 0.042, 0.014); innerEar.rotation.y = Math.PI / 4; innerEar.scale.z = 0.5;
    innerEar.castShadow = false;
    head.add(ear); ears.push(ear);
    const cheek = mesh(sph, mCream, head, s * 0.04, -0.055, 0.125); cheek.scale.set(0.05, 0.04, 0.045);
  }
  const chin = mesh(sph, mCream, head, 0, -0.085, 0.105); chin.scale.set(0.045, 0.03, 0.04);
  const nose = mesh(sph, mPink, head, 0, -0.03, 0.165); nose.scale.set(0.02, 0.014, 0.014);
  const mouth = mesh(sph, std({ color: '#7a2630' }), head, 0, -0.068, 0.15); mouth.castShadow = false;
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.075, 0.018, 0.133);
    const ball = mesh(sph, mEye, eye); ball.scale.set(0.031, 0.036, 0.02); ball.castShadow = false;
    const shine = mesh(sph, mShine, eye, s * 0.008, 0.012, 0.018); shine.scale.setScalar(0.008); shine.castShadow = false;
    head.add(eye); eyes.push(eye);
    for (let i = 0; i < 3; i++) {
      const w = mesh(new THREE.CylinderGeometry(0.0022, 0.0012, 0.17, 4), mWhisk, head, s * 0.12, -0.05 + (i - 1) * 0.004, 0.11);
      w.rotation.z = Math.PI / 2 + s * (i - 1) * 0.22; w.rotation.y = -s * 0.35; w.castShadow = false;
    }
  }

  // pernas
  const legGeo = new THREE.CapsuleGeometry(0.05, 0.26, 4, 10);
  const mkLeg = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, -0.04, z);
    mesh(legGeo, mOrange, g, 0, -0.17, 0);
    const paw = mesh(sph, mCream, g, 0, -0.36, 0.02); paw.scale.set(0.058, 0.045, 0.072);
    body.add(g); return g;
  };
  const legs = { fl: mkLeg(-0.105, 0.22), fr: mkLeg(0.105, 0.22), hl: mkLeg(-0.115, -0.22), hr: mkLeg(0.115, -0.22) };

  // rabo: cadeia de segmentos
  const tail = [];
  let parent = body;
  for (let i = 0; i < 8; i++) {
    const j = new THREE.Group();
    j.position.set(0, i === 0 ? 0.07 : 0, i === 0 ? -0.33 : -0.085);
    const r = 0.04 - i * 0.0018;
    const segGeo = new THREE.CapsuleGeometry(r, 0.085, 4, 8); segGeo.rotateX(Math.PI / 2);
    mesh(segGeo, i >= 6 ? mOrange : mTail, j, 0, 0, -0.042);
    parent.add(j); parent = j; tail.push(j);
  }

  // sombra de contato
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 6, 64, 64, 62);
  rg.addColorStop(0, 'rgba(30,18,10,0.7)'); rg.addColorStop(1, 'rgba(30,18,10,0)');
  sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 3;

  // Zzz
  const zc = document.createElement('canvas'); zc.width = zc.height = 64;
  const zg = zc.getContext('2d');
  zg.font = 'bold 52px Georgia, serif'; zg.textAlign = 'center'; zg.textBaseline = 'middle';
  zg.fillStyle = '#ffffff'; zg.fillText('z', 32, 30);
  const zTex = new THREE.CanvasTexture(zc);
  const zzz = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, opacity: 0, depthWrite: false }));
    s.renderOrder = 5; zzz.push(s);
  }

  // balão "miau!"
  const mc = document.createElement('canvas'); mc.width = 256; mc.height = 96;
  const mg = mc.getContext('2d');
  mg.font = 'italic bold 60px Georgia, serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.lineWidth = 9; mg.lineJoin = 'round'; mg.strokeStyle = '#3b2c22'; mg.strokeText('miau!', 128, 48);
  mg.fillStyle = '#fff6e4'; mg.fillText('miau!', 128, 48);
  const miau = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mc), transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
  miau.renderOrder = 6; zzz.push(miau);

  // corações do carinho
  const hc = document.createElement('canvas'); hc.width = hc.height = 64;
  const hg = hc.getContext('2d');
  hg.fillStyle = '#ff6f8a'; hg.strokeStyle = '#fff'; hg.lineWidth = 5;
  hg.beginPath(); hg.moveTo(32, 54); hg.bezierCurveTo(4, 34, 10, 8, 32, 22); hg.bezierCurveTo(54, 8, 60, 34, 32, 54); hg.closePath(); hg.stroke(); hg.fill();
  const heartTex = new THREE.CanvasTexture(hc);
  const hearts = [];
  for (let i = 0; i < 4; i++) {
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, opacity: 0, depthWrite: false }));
    h.renderOrder = 5; hearts.push(h); zzz.push(h);
  }
  // mão do carinho: luva simples com antebraço saindo para o lado da câmera
  const hand = new THREE.Group(); hand.visible = false; hand.rotation.y = -(Math.PI - 0.57);
  {
    const skin = new THREE.MeshStandardMaterial({ color: '#f1c7a3', roughness: 0.8 });
    const sleeve = new THREE.MeshStandardMaterial({ color: '#7fa6c9', roughness: 0.9 });
    const add = (g, m, x, y, z, par) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; par.add(o); return o; };
    add(sph, skin, 0, 0, 0, hand).scale.set(0.085, 0.032, 0.095);
    for (let i = 0; i < 4; i++) { const f = add(sph, skin, 0.1 + (i === 1 || i === 2 ? 0.012 : 0), 0, (i - 1.5) * 0.032, hand); f.scale.set(0.045, 0.017, 0.019); }
    add(sph, skin, 0.02, 0, -0.1, hand).scale.set(0.04, 0.02, 0.022);
    const arm = new THREE.Group(); arm.rotation.z = -0.3; hand.add(arm);
    const ag = new THREE.CapsuleGeometry(0.05, 0.7, 4, 10); ag.rotateZ(Math.PI / 2);
    add(ag, skin, -0.4, 0, 0, arm);
    const sg = new THREE.CylinderGeometry(0.062, 0.062, 0.55, 14); sg.rotateZ(Math.PI / 2);
    add(sg, sleeve, -0.95, 0, 0, arm);
  }
  zzz.push(hand);

  // esferas do corpo: usadas para apoiar a gata exatamente na superfície
  const spheres = [];
  inner.traverse((m) => { if (m.isMesh && m.geometry.type === 'SphereGeometry') spheres.push(m); });
  let lift = 0, rugLift = 0;

  const cur = { ...BASE };
  let first = true, heading = 0, sleepAmt = 0;
  const headWorld = new THREE.Vector3();

  function update(dt, t, st) {
    const target = { ...BASE, ...(POSES[st.pose] || {}) };
    const k = first ? 1 : 1 - Math.exp(-dt * 9);
    for (const key in cur) cur[key] += (target[key] - cur[key]) * k;

    // direção com interpolação angular
    let dh = st.heading - heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    heading += dh * (first ? 1 : 1 - Math.exp(-dt * 10));
    const first0 = first;
    first = false;
    root.position.set(st.x, st.y, st.z);
    root.rotation.y = heading;

    const p = { ...cur };
    const ph = st.walkPhase, amp = (st.run ? 0.95 : 0.55) * cur.walk;
    p.fl += amp * Math.sin(ph); p.hr += amp * Math.sin(ph + 0.4);
    p.fr += amp * Math.sin(ph + Math.PI); p.hl += amp * Math.sin(ph + Math.PI + 0.4);
    p.bodyY += 0.014 * cur.walk * Math.sin(ph * 2);
    p.headPitch += 0.04 * cur.walk * Math.sin(ph * 2 + 1);

    const asleep = st.pose === 'sleep';
    sleepAmt += ((asleep ? 1 : 0) - sleepAmt) * Math.min(1, dt * 2);
    const breath = Math.sin(t * (asleep ? 1.5 : 2.6));
    torso.scale.set(0.19 * (1 + 0.025 * breath), 0.185 * (1 + 0.035 * breath), 0.37);

    if (st.pose === 'groom') {
      const lick = Math.sin(t * 9);
      p.headPitch += 0.1 * lick; p.fr += 0.06 * lick;
    } else if (st.pose === 'watch') {
      p.headYaw += 0.45 * Math.sin(t * 0.23) + 0.2 * Math.sin(t * 0.71 + 2);
      p.headPitch += 0.06 * Math.sin(t * 0.4);
    } else if (st.pose === 'sit' || st.pose === 'loaf') {
      p.headYaw += 0.3 * Math.sin(t * 0.17 + 1) + 0.12 * Math.sin(t * 0.53);
    } else if (st.pose === 'eat') {
      p.headPitch += 0.07 * Math.sin(t * 7.5);
    } else if (st.pose === 'crouch') {
      p.roll += 0.07 * st.wiggle * Math.sin(t * 15);
      p.fr += -1.25 * st.swipe; p.lenFR += 0.25 * st.swipe;
    }
    if (st.pose === 'rear') {
      p.fl += -0.55 * st.swipe; p.fr += 0.75 * st.swipe * Math.sin(t * 14);
      p.headPitch += 0.08 * Math.sin(t * 3);
    } else if (st.pose === 'purr') {
      p.roll += 0.012 * Math.sin(t * 48) * (0.3 + st.purr);
      p.headPitch += 0.07 * st.petting * Math.sin(t * 5);
      p.headYaw -= 0.25 * st.petting;
    } else if (st.pose === 'listen') {
      p.headPitch += 0.07 * Math.sin(t * 3.3); p.tailSide += 0.3 * Math.sin(t * 2.2); p.sway *= 2.5;
    }
    const meow = st.meow || 0, yawn = st.yawn || 0;
    const mouthOpen = Math.max(meow, yawn * 1.3);
    p.headPitch -= 0.5 * meow + 0.55 * yawn; p.eye = Math.min(p.eye, 1 - 0.75 * meow - 0.8 * yawn);
    mouth.scale.set(0.024, 0.002 + 0.03 * mouthOpen, 0.014);
    if (st.hungry) p.sway *= 3;
    // piscadas
    const blink = (t % 4.3) < 0.13 || ((t + 1.7) % 7.1) < 0.1;
    const eyeOpen = blink ? Math.min(p.eye, 0.08) : p.eye;

    body.position.y = p.bodyY;
    body.rotation.set(p.pitch, 0, p.roll);
    head.position.y = 0.15 + p.headY;
    head.rotation.set(p.headPitch, p.headYaw, 0);
    legs.fl.rotation.x = p.fl; legs.fr.rotation.x = p.fr;
    legs.hl.rotation.x = p.hl; legs.hr.rotation.x = p.hr;
    legs.fl.scale.y = p.lenF; legs.fr.scale.y = p.lenFR;
    legs.hl.scale.y = p.lenH; legs.hr.scale.y = p.lenH;
    for (const eye of eyes) eye.scale.y = Math.max(0.07, eyeOpen);
    const twitch = Math.max(0, Math.sin(t * 0.9 + 2) - 0.97) * 12;
    ears[0].rotation.x = -twitch; ears[1].rotation.x = -Math.max(0, Math.sin(t * 0.63) - 0.97) * 12;

    const sway = Math.sin(t * (st.hungry ? 4.2 : 1.3)) * 0.07 * p.sway;
    for (let i = 0; i < tail.length; i++) {
      tail[i].rotation.x = i === 0 ? p.tailLift : p.tailCurl + (i > 5 ? 0.12 * p.sway * Math.sin(t * 2.1) : 0);
      tail[i].rotation.y = p.tailSide + sway * (i / 4);
    }

    // apoio no chão: mede o ponto mais baixo do corpo e ajusta a altura
    const onRug = st.groundY < 0.15 && st.x > -1.97 && st.x < 2.27 && st.z > -1.17 && st.z < 1.87;
    rugLift += ((onRug ? 0.032 : 0) - rugLift) * (first0 ? 1 : 1 - Math.exp(-dt * 25));
    root.position.y = st.y + (st.groundY < 0.15 ? rugLift : 0);
    if (st.pose !== 'jump') {
      inner.position.y = 0;
      root.updateMatrixWorld(true);
      let low = 1e9;
      for (const m of spheres) {
        const e = m.matrixWorld.elements;
        const v = e[13] - Math.hypot(e[1], e[5], e[9]);
        if (v < low) low = v;
      }
      const want = root.position.y - low;
      lift += (want - lift) * (first0 ? 1 : 1 - Math.exp(-dt * 20));
    }
    inner.position.y = lift;

    // sombra de contato
    const h = Math.max(0, st.y - st.groundY);
    const sz = (st.pose === 'sleep' || st.pose === 'loaf' ? 1.25 : 1.1) * (1 - Math.min(0.5, h));
    shadow.position.set(st.x, st.groundY + (st.groundY < 0.15 ? rugLift : 0) + 0.008, st.z);
    shadow.scale.set(sz, sz, 1);
    shadow.material.opacity = 0.9 * (1 - Math.min(0.7, h * 1.5));

    // Zzz
    head.getWorldPosition(headWorld);
    // carinho: mão acariciando e corações subindo
    const pet = st.petting || 0, pur = st.purr || 0;
    hand.visible = pet > 0.02;
    if (hand.visible) {
      const pat = Math.sin(t * 6.5);
      hand.position.set(headWorld.x + 0.05 * Math.sin(t * 3.2), headWorld.y + 0.17 + 0.05 * pat + (1 - pet) * 0.25, headWorld.z + 0.03);
    }
    for (let i = 0; i < hearts.length; i++) {
      const u = ((t * 0.35 + i / hearts.length) % 1);
      const h = hearts[i];
      h.position.set(headWorld.x - 0.1 + 0.2 * Math.sin(i * 2.3 + u * 4), headWorld.y + 0.3 + u * 0.7, headWorld.z + 0.08);
      h.scale.setScalar(0.09 + 0.08 * Math.sin(u * Math.PI));
      h.material.opacity = pur * Math.sin(u * Math.PI);
    }
    miau.position.set(headWorld.x + 0.1, headWorld.y + 0.55 + 0.12 * meow, headWorld.z + 0.1);
    miau.scale.set(0.62 * (0.7 + 0.3 * meow), 0.23 * (0.7 + 0.3 * meow), 1);
    miau.material.opacity = Math.min(1, meow * 1.6);
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.28 + i / 3) % 1);
      const s = zzz[i];
      s.position.set(headWorld.x + 0.12 + u * 0.35 + 0.05 * Math.sin(u * 9), headWorld.y + 0.25 + u * 0.8, headWorld.z + 0.1);
      s.scale.setScalar(0.12 + u * 0.16);
      s.material.opacity = sleepAmt * Math.sin(u * Math.PI) * 0.9;
    }
  }

  return { root, shadow, zzz, update };
}
