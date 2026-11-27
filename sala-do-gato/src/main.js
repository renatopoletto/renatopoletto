import * as THREE from '../vendor/three.module.min.js';
import { toBrt, brtOffset, solar } from './time.js';
import { catState, statusText } from './brain.js';
import { createCat } from './cat.js';
import { createRoom } from './room.js';
import { createSky, skyColors } from './sky.js';
import { load, feed, createQueue, enqueue, canRun } from './store.js';
import { DEFS, ORDER, envState } from './commands.js';
import { createSound } from './sound.js';
import { createAtmos } from './atmos.js';
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js';

// ----- relógio (parâmetros de teste: ?hora=21:30 e ?vel=600) -----
const params = new URLSearchParams(location.search);
const speed = Math.max(0, parseFloat(params.get('vel')) || 1);
let baseUtc = Date.now();
const hora = /^(\d{1,2})(?::(\d{2}))?$/.exec(params.get('hora') || '');
if (hora) {
  const off = brtOffset(baseUtc);
  const dayStart = Math.floor((baseUtc + off) / 864e5) * 864e5;
  baseUtc = dayStart + (+hora[1]) * 36e5 + (+(hora[2] || 0)) * 6e4 - off;
}
const foco = params.has('foco');
const perf0 = performance.now();
const nowUtc = () => baseUtc + (performance.now() - perf0) * speed;

let lastSkyDraw = -1e9, lastSecond = -1, lastStatus = '';
const pad = (n) => String(n).padStart(2, '0');

// ----- comida -----
const testMode = !!hora || speed !== 1;
const food = load(baseUtc, !testMode);
if (params.get('fome') === '0') food.fedUntil = baseUtc + 6 * 3600e3;
const elAlimentar = document.getElementById('alimentar');
elAlimentar.addEventListener('click', () => { feed(food, nowUtc(), !testMode); lastSecond = -1; });

// ----- som (sintetizado; só toca depois de ligar no botão) -----
const sound = createSound();
let lastMeow = 0, lastBird = false, lastChirp = 0;
const elSom = document.getElementById('som');
elSom.addEventListener('click', () => {
  if (sound.enabled()) sound.disable(); else sound.enable();
  elSom.textContent = sound.enabled() ? 'Som ligado' : 'Som desligado';
  elSom.setAttribute('aria-pressed', sound.enabled() ? 'true' : 'false');
});

// ----- cena -----
const canvas = document.getElementById('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = params.get('tm') === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 80);
const TARGET = new THREE.Vector3(-0.35, 1.55, -0.2);
const CAM_DIR = new THREE.Vector3(6.6, 4.3, 10.2).normalize();
let camDist = 14;

const sky = createSky();
const room = createRoom(scene, sky.texture, sky.glass);
const cat = createCat();
scene.add(cat.root, cat.shadow, ...cat.zzz);
const atmos = createAtmos(scene);

const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(5, 7, 8);
const sun = new THREE.DirectionalLight(0xffffff, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
sun.target.position.set(0, 1, 0);
scene.add(hemi, fill, sun, sun.target);

// ----- pós-processamento: brilho nas luzes + acabamento de cor -----
// ?q=max força a qualidade máxima; ?q=min desliga os efeitos.
const qParam = params.get('q');
let fx = qParam !== 'min';
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType, samples: 4, stencilBuffer: true, depthBuffer: true,
}));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.2, 0.45, 1.35);
// o brilho soma só cor: a transparência da cena (fundo da página) fica intacta
Object.assign(bloom.blendMaterial, {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
});
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, 1.08);                     // um pouco mais de cor
      c.rgb = clamp((c.rgb - 0.5) * 1.05 + 0.5, 0.0, 1.0);  // contraste suave
      gl_FragColor = c;
    }`,
}));

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  camera.aspect = w / h;
  camDist = 14.2 * Math.max(1, 1.62 / camera.aspect);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX / window.innerWidth * 2 - 1;
  mouse.y = e.clientY / window.innerHeight * 2 - 1;
});

// ----- comandos do internauta -----
const queue = createQueue();
let lastSt = null, lampNow = 0;
const elMenu = document.getElementById('menu');
const elBrincar = document.getElementById('brincar');
const btns = {};
for (const id of ORDER) {
  const b = document.createElement('button');
  b.type = 'button'; b.dataset.id = id; b.textContent = DEFS[id].label;
  elMenu.appendChild(b); btns[id] = b;
}
function ctxNow(utc) {
  const sl = lastSt && (lastSt.pose === 'sleep' || lastSt.pose === 'loaf');
  return { hungry: utc >= food.fedUntil, fedUntil: food.fedUntil, sleeping: !!sl, lampOn: lampNow > 0.5 };
}
function refreshMenu(utc) {
  const c = ctxNow(utc);
  for (const id of ORDER) btns[id].disabled = !canRun(queue, id, utc, c);
  btns.luz.textContent = lampNow > 0.5 ? 'apagar as luzes' : 'acender as luzes';
}
function run(id) {
  const utc = nowUtc();
  if (enqueue(queue, id, utc, ctxNow(utc))) { refreshMenu(utc); lastSecond = -1; }
}
function toggleMenu(open) {
  elMenu.hidden = !open; elBrincar.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-aberto', open);
  if (open) refreshMenu(nowUtc());
}
elBrincar.addEventListener('click', (ev) => { ev.stopPropagation(); toggleMenu(elMenu.hidden); });
elMenu.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-id]'); if (b && !b.disabled) run(b.dataset.id); });
document.addEventListener('click', (ev) => { if (!elMenu.hidden && !ev.target.closest('#acoes')) toggleMenu(false); });
// tocar na gata faz carinho
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', (e) => {
  ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight * 2 - 1));
  ray.setFromCamera(ndc, camera);
  if (ray.intersectObject(cat.root, true).length) run('carinho');
});
// cópia dos comandos em horário de Brasília (guarda os caches de cálculo)
const brtCopies = new Map();
function cmdsForBrain(off) {
  return queue.cmds.map((c) => {
    let b = brtCopies.get(c.id);
    if (!b) { b = { id: c.id, type: c.type, dur: c.dur, was: c.was }; brtCopies.set(c.id, b); }
    b.start = c.start + off; b.catEnd = c.catEnd == null ? null : c.catEnd + off;
    return b;
  });
}

// ----- ambiente por horário -----
const C = (h) => new THREE.Color(h);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const col = { a: new THREE.Color(), b: new THREE.Color() };
const PAL = {
  sunLow: C('#ff9648'), sunHigh: C('#fff0d8'), moon: C('#9fb8ff'),
  hemiSkyDay: C('#eef4ff'), hemiSkyDusk: C('#ffc9a0'), hemiSkyNight: C('#34427e'),
  hemiGndDay: C('#d8b48c'), hemiGndNight: C('#1c1e3a'),
  fillDay: C('#fff3e0'), fillNight: C('#7f96e0'),
};

const elHora = document.getElementById('hora');
const elData = document.getElementById('data');
const elStatus = document.getElementById('status');
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });


function applyEnvironment(utc, brt, tSec, env) {
  const s = solar(utc);
  const hour = (brt % 864e5) / 36e5;
  const day = sstep(-4, 8, s.alt);          // 0 noite .. 1 dia
  const dusk = 1 - Math.min(1, Math.abs(s.alt - 1) / 9); // pico no nascer/pôr

  // sol / lua
  sun.position.set(s.dir[0] * 18, s.dir[1] * 18 + 1, s.dir[2] * 18);
  if (s.isDay) {
    sun.color.copy(PAL.sunLow).lerp(PAL.sunHigh, sstep(2, 24, s.alt));
    sun.intensity = 4.2 * sstep(-0.8, 10, s.alt);
  } else {
    sun.color.copy(PAL.moon);
    sun.intensity = 0.75 * sstep(-5, -13, s.alt) * Math.sin(Math.PI * Math.min(1, Math.max(0, s.p)) * 0.9 + 0.15);
  }
  sun.intensity *= 1 - 0.8 * env.rain;
  col.a.copy(PAL.hemiSkyNight).lerp(PAL.hemiSkyDay, day).lerp(PAL.hemiSkyDusk, dusk * 0.6);
  hemi.color.copy(col.a);
  hemi.groundColor.copy(PAL.hemiGndNight).lerp(PAL.hemiGndDay, day);
  hemi.intensity = lerp(0.62, 1.55, day) * (1 - 0.3 * env.rain);
  fill.color.copy(PAL.fillNight).lerp(PAL.fillDay, day);
  fill.intensity = lerp(0.28, 0.75, day);

  // abajures: do entardecer até 23:30 e do despertar até clarear
  const dark = Math.max(sstep(6, -3, s.alt), 0.65 * env.rain);
  const awake = Math.max(sstep(15, 16, hour) * (1 - sstep(23.3, 23.7, hour)), sstep(5.6, 6, hour) * (1 - sstep(11, 12, hour)));
  lampNow = dark * awake;
  // comando "luzes": inverte o estado dos abajures e do pisca-pisca por um tempo
  const tgt = env.luzWas ? 0 : 1;
  room.setLights(lerp(lampNow, tgt, env.luz), lerp(dark, tgt, env.luz), tSec);

  // vista da janela (redesenha no máximo 5x por segundo)
  const perfNow = performance.now();
  if (perfNow - lastSkyDraw > (env.rain > 0.02 ? 50 : speed > 1 ? 80 : 200)) { sky.draw(s, hour, utc / 1000, env.rain); lastSkyDraw = perfNow; }

  // fundo da página acompanha o céu
  const [top, bottom] = skyColors(s.alt);
  const bg = (c, k) => `rgb(${c.map((v, i) => Math.round(lerp(v, [244, 232, 214][i], k))).join(',')})`;
  const soft = lerp(0.12, 0.62, day);
  document.body.style.background = `linear-gradient(${bg(top, soft)}, ${bg(bottom, soft + 0.1)})`;
  document.body.classList.toggle('noite', day < 0.5);
  return s;
}

// Qualidade automática: se o aparelho estiver lento, desliga os efeitos e reduz a resolução.
let adaptN = 0, adaptT0 = 0;
function adapt(now) {
  if (qParam === 'max' || adaptN < 0) return;
  if (adaptN === 0) { adaptT0 = now; adaptN = 1; return; }
  if (++adaptN < 120) return;
  const avg = (now - adaptT0) / adaptN;
  adaptN = -1;
  if (avg > 40) { fx = false; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25)); resize(); }
}

let prev = performance.now();
function frame() {
  const perfNow = performance.now();
  const dt = Math.min(0.1, (perfNow - prev) / 1000) * Math.min(speed || 1, 4);
  prev = perfNow;
  const utc = nowUtc();
  const brt = toBrt(utc);
  const tSec = utc / 1000 % 100000;

  const env = envState(queue.cmds, utc);
  const s = applyEnvironment(utc, brt, tSec, env);
  const isHungry = utc >= food.fedUntil;
  const off = brt - utc;
  const st = catState(brt, {
    hungrySince: isHungry ? food.fedUntil + off : null,
    feastAt: food.feastAt != null ? food.feastAt + off : null,
    hungryFrom: food.hungryFrom != null ? food.hungryFrom + off : null,
  }, cmdsForBrain(off));
  lastSt = st;
  room.setFood(!isHungry);
  room.setFx(st.fx, tSec, dt, env);
  if (st.meow > 0.05 && lastMeow <= 0.05) sound.meow();
  lastMeow = st.meow;
  const bird = st.fx.bird;
  if ((bird && !lastBird) || (bird && !bird.flying && bird.peck > 0.95 && perfNow - lastChirp > 2500)) { sound.chirp(); lastChirp = perfNow; }
  lastBird = !!bird;
  sound.setLoops({ rain: env.rain > 0.05, music: env.music > 0.05, purr: (st.purr || 0) > 0.25 });
  cat.update(dt, tSec, st);
  room.yarn.position.set(st.ball.x, 0.09, st.ball.z);
  room.yarn.rotation.z = -st.ball.roll;

  const sec = Math.floor(brt / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    const d = new Date(brt);
    const h = d.getUTCHours(), m = d.getUTCMinutes(), ss = d.getUTCSeconds();
    room.setClock(h, m, ss);
    elHora.textContent = `${pad(h)}:${pad(m)}:${pad(ss)}`;
    elData.textContent = fmtData.format(d);
    const txt = statusText(st, s.isDay);
    if (txt !== lastStatus) { lastStatus = txt; elStatus.textContent = txt; }
    if (!elMenu.hidden) refreshMenu(utc);
  }

  mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
  const yaw = -mouse.sx * 0.07, lift = mouse.sy * 0.035;
  const dir = CAM_DIR.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  dir.y += lift; dir.normalize();
  if (foco) { // modo de teste: câmera próxima da gata
    const c = new THREE.Vector3(st.x, st.y + 0.4, st.z);
    camera.position.copy(c).addScaledVector(dir, 4.2); camera.lookAt(c);
  } else {
    camera.position.copy(TARGET).addScaledVector(dir, camDist);
    camera.lookAt(TARGET);
  }

  atmos.update(s.dir, sun.color, Math.min(1, sun.intensity / 4.2) * (s.isDay ? 1 : 0.3), dt, tSec);

  if (fx) composer.render(); else renderer.render(scene, camera);
  adapt(perfNow);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (params.has('dbg')) window.__pipoca = { queue, ctxNow, run, get st() { return lastSt; } };
// parâmetro de teste: ?cmd=laser dispara um comando logo ao carregar
if (params.get('cmd')) setTimeout(() => run(params.get('cmd')), +params.get('cmdt') || 600);
