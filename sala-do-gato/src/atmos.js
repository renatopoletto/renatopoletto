// Atmosfera: raios de sol entrando pela janela e poeira flutuando na luz.
import * as THREE from '../vendor/three.module.min.js';

const Z = -3.08;                     // plano da janela
const XS = [-1.9, -1.1, -0.3, 0.5, 1.3];   // divisões verticais dos caixilhos
const YS = [1.25, 2.65, 3.35];             // divisões horizontais
const GAP = 0.05, LEN = 9;

export function createAtmos(scene) {
  // ---- raios de luz: um prisma por vidraça, estendido na direção do sol ----
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uColor: { value: new THREE.Color('#ffe2b0') }, uStrength: { value: 0 } },
    vertexShader: 'attribute float aU; varying float vU; varying vec3 vW; void main(){ vU = aU; vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vU; varying vec3 vW;
      void main(){
        // só dentro da sala, e sem lavar o vidro: o raio nasce suave a partir da janela
        if (vW.x < -3.95 || vW.x > 4.2 || vW.y < 0.0 || vW.y > 4.2 || vW.z > 3.3) discard;
        float a = pow(1.0 - vU, 1.7) * smoothstep(0.0, 0.14, vU);
        gl_FragColor = vec4(uColor * a * uStrength, 0.0);
      }`,
  });
  const positions = [], us = [], index = [];
  const panes = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) panes.push([XS[i] + GAP, XS[i + 1] - GAP, YS[j] + GAP, YS[j + 1] - GAP]);
  const nearIdx = [];
  for (const [x0, x1, y0, y1] of panes) {
    const base = positions.length / 3;
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { positions.push(x, y, Z); us.push(0); }
    for (let k = 0; k < 4; k++) { positions.push(0, 0, 0); us.push(1); }
    nearIdx.push(base);
    for (let k = 0; k < 4; k++) {
      const a = base + k, b = base + (k + 1) % 4;
      index.push(a, b, b + 4, a, b + 4, a + 4);
    }
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.Float32BufferAttribute(positions, 3);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aU', new THREE.Float32BufferAttribute(us, 1));
  geo.setIndex(index);
  const shafts = new THREE.Mesh(geo, shaftMat);
  shafts.frustumCulled = false; shafts.renderOrder = 3;
  scene.add(shafts);

  // ---- poeira ----
  const N = 110;
  const dustPos = new Float32Array(N * 3), dustCol = new Float32Array(N * 4), vel = [];
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    dustPos[i * 3] = -2.4 + rnd() * 4.2; dustPos[i * 3 + 1] = 0.4 + rnd() * 3.2; dustPos[i * 3 + 2] = -3 + rnd() * 5.5;
    vel.push([(rnd() - 0.5) * 0.03, 0.01 + rnd() * 0.02, (rnd() - 0.5) * 0.03, rnd() * 6.28]);
  }
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dgeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 4));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({
    size: 0.05, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  }));
  dust.frustumCulled = false; dust.renderOrder = 4;
  scene.add(dust);

  const travel = new THREE.Vector3();
  const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function update(sunDir, sunColor, strength, dt, t) {
    travel.set(-sunDir[0], -sunDir[1], -sunDir[2]).normalize();
    // pontas distantes dos prismas
    for (const base of nearIdx) {
      for (let k = 0; k < 4; k++) {
        const i = base + k;
        posAttr.setXYZ(i + 4, posAttr.getX(i) + travel.x * LEN, posAttr.getY(i) + travel.y * LEN, Z + travel.z * LEN);
      }
    }
    posAttr.needsUpdate = true;
    shaftMat.uniforms.uStrength.value = 0.032 * strength;
    shaftMat.uniforms.uColor.value.copy(sunColor);
    shafts.visible = strength > 0.01 && travel.z > 0.15;

    for (let i = 0; i < N; i++) {
      const v = vel[i];
      dustPos[i * 3] += (v[0] + Math.sin(t * 0.4 + v[3]) * 0.012) * dt;
      dustPos[i * 3 + 1] += (v[1] + Math.cos(t * 0.3 + v[3]) * 0.008) * dt;
      dustPos[i * 3 + 2] += (v[2] + Math.sin(t * 0.35 + v[3] * 2) * 0.012) * dt;
      if (dustPos[i * 3 + 1] > 3.6) dustPos[i * 3 + 1] = 0.3;
      if (dustPos[i * 3 + 0] > 2.0) dustPos[i * 3 + 0] = -2.4; else if (dustPos[i * 3] < -2.4) dustPos[i * 3] = 2.0;
      if (dustPos[i * 3 + 2] > 2.6) dustPos[i * 3 + 2] = -3; else if (dustPos[i * 3 + 2] < -3) dustPos[i * 3 + 2] = 2.6;
      // dentro do raio de sol? projeta de volta ao plano da janela
      let a = 0;
      if (travel.z > 0.15) {
        const k = (dustPos[i * 3 + 2] - Z) / travel.z;
        const x0 = dustPos[i * 3] - travel.x * k, y0 = dustPos[i * 3 + 1] - travel.y * k;
        const e = Math.min(sst(-1.9, -1.75, x0), sst(1.3, 1.15, x0), sst(1.25, 1.4, y0), sst(3.35, 3.2, y0));
        a = e * (0.55 + 0.45 * Math.sin(t * 1.3 + v[3] * 3)) * strength;
      }
      dustCol[i * 4] = sunColor.r; dustCol[i * 4 + 1] = sunColor.g; dustCol[i * 4 + 2] = sunColor.b; dustCol[i * 4 + 3] = a;
    }
    dgeo.attributes.position.needsUpdate = true; dgeo.attributes.color.needsUpdate = true;
  }
  return { update };
}
