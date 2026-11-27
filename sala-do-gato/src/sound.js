// Sons sintetizados (sem arquivos): miado, ronronar, chuva, música e passarinho.
// Só tocam depois que o visitante liga o som no botão (exigência dos navegadores).
export function createSound() {
  let ctx = null;
  const loops = {};

  function enable() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return !!ctx; }
  function disable() {
    for (const k of Object.keys(loops)) stopLoop(k, true);
    if (ctx) { ctx.close(); ctx = null; }
  }
  const enabled = () => !!ctx;

  function meow() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(880, t + 0.22); o.frequency.exponentialRampToValueAtTime(430, t + 0.8);
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2200, t + 0.25); f.frequency.linearRampToValueAtTime(1100, t + 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    o.connect(f).connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.9);
  }

  function chirp() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [0, 0.13, 0.26].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + d;
      o.type = 'sine';
      o.frequency.setValueAtTime(3000 + i * 250, t); o.frequency.exponentialRampToValueAtTime(4300 + i * 200, t + 0.07); o.frequency.exponentialRampToValueAtTime(3200, t + 0.11);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.14);
    });
  }

  function noiseBuffer() {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  const makers = {
    rain() {
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(hp).connect(lp).connect(g).connect(ctx.destination); src.start();
      return { gain: g, level: 0.09, stop: () => src.stop() };
    },
    purr() {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 27;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
      const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 2.4;
      const depth = ctx.createGain(); depth.gain.value = 0.35;
      lfo.connect(depth).connect(g.gain);
      o.connect(lp).connect(g).connect(ctx.destination); o.start(); lfo.start();
      return { gain: g, level: 0.35, stop: () => { o.stop(); lfo.stop(); } };
    },
    music() {
      // progressão calma (Am7, Fmaj7, C, G) em notas suaves
      const master = ctx.createGain(); master.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      master.connect(lp).connect(ctx.destination);
      const chords = [[220, 261.63, 329.63, 392], [174.61, 220, 261.63, 329.63], [261.63, 329.63, 392, 493.88], [196, 246.94, 293.66, 392]];
      let bar = 0;
      const note = (f, t, len, vol) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.05);
      };
      const schedule = () => {
        const t = ctx.currentTime + 0.05, ch = chords[bar % 4];
        note(ch[0] / 2, t, 3.0, 0.16);
        [0, 1, 2, 3, 2, 1, 2, 3].forEach((n, i) => note(ch[n], t + i * 0.4, 0.9, 0.09));
        bar++;
      };
      schedule(); const id = setInterval(schedule, 3200);
      return { gain: master, level: 0.9, stop: () => clearInterval(id) };
    },
  };

  function startLoop(name) {
    if (!ctx || loops[name]) return;
    const l = makers[name](); loops[name] = l;
    l.gain.gain.cancelScheduledValues(ctx.currentTime);
    l.gain.gain.setValueAtTime(l.gain.gain.value, ctx.currentTime);
    l.gain.gain.linearRampToValueAtTime(l.level, ctx.currentTime + 1.2);
  }
  function stopLoop(name, now) {
    const l = loops[name]; if (!l) return;
    delete loops[name];
    if (!ctx || now) { try { l.stop(); } catch { /* já parou */ } return; }
    l.gain.gain.cancelScheduledValues(ctx.currentTime);
    l.gain.gain.setValueAtTime(l.gain.gain.value, ctx.currentTime);
    l.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
    setTimeout(() => { try { l.stop(); } catch { /* já parou */ } }, 1200);
  }
  // liga ou desliga cada som de acordo com o que está acontecendo
  function setLoops(want) { for (const k of Object.keys(makers)) { if (want[k]) startLoop(k); else stopLoop(k); } }

  return { enable, disable, enabled, meow, chirp, setLoops };
}
