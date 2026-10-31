/* My AI Arcade — синтезированные звуки через WebAudio (без файлов). */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  const A = (G.Audio = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    compressor: null,
    noiseBuf: null,
    lastPlayed: {},
    muted: false,
    enabled: true,
    activeVoices: 0,
    maxVoices: 48,

    // Создание контекста возможно только после жеста пользователя.
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        this.enabled = false;
        return false;
      }
      try {
        this.ctx = new Ctx();
      } catch (e) {
        this.enabled = false;
        return false;
      }
      const ctx = this.ctx;
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.2;

      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.compressor);
      this.musicBus.connect(this.compressor);
      this.compressor.connect(this.master);
      this.master.connect(ctx.destination);

      this.noiseBuf = this.makeNoise(2);
      this.applyVolumes();
      return true;
    },

    makeNoise(seconds) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    },

    applyVolumes() {
      if (!this.ctx) return;
      const s = G.Save.settings;
      const t = this.ctx.currentTime;
      this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : s.sfx, t, 0.02);
      this.musicBus.gain.setTargetAtTime(this.muted ? 0 : s.music * 0.6, t, 0.05);
    },

    setMuted(m) {
      this.muted = m;
      this.applyVolumes();
    },

    get now() {
      return this.ctx ? this.ctx.currentTime : 0;
    },

    // ---------- Примитивы ----------
    // Осциллятор с огибающей и скольжением частоты.
    tone(opts) {
      const ctx = this.ctx;
      const t0 = ctx.currentTime + (opts.delay || 0);
      const dur = opts.dur || 0.15;
      const osc = ctx.createOscillator();
      osc.type = opts.type || 'square';
      osc.frequency.setValueAtTime(opts.f0, t0);
      if (opts.f1 !== undefined) {
        if (opts.slide === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(1, opts.f1), t0 + dur);
        else osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + dur);
      }
      if (opts.detune) osc.detune.value = opts.detune;
      const g = ctx.createGain();
      const vol = opts.vol === undefined ? 0.3 : opts.vol;
      const atk = opts.attack || 0.004;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let node = osc;
      if (opts.filter) {
        const f = ctx.createBiquadFilter();
        f.type = opts.filter.type || 'lowpass';
        f.frequency.setValueAtTime(opts.filter.f0, t0);
        if (opts.filter.f1) f.frequency.exponentialRampToValueAtTime(opts.filter.f1, t0 + dur);
        f.Q.value = opts.filter.q || 1;
        node.connect(f);
        node = f;
      }
      node.connect(g);
      this.route(g, opts.pan, opts.bus);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
      this.trackVoice(osc, dur);
      return osc;
    },

    // Отфильтрованный шум — взрывы, удары, свист.
    noise(opts) {
      const ctx = this.ctx;
      const t0 = ctx.currentTime + (opts.delay || 0);
      const dur = opts.dur || 0.3;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = opts.rate || 1;
      const f = ctx.createBiquadFilter();
      f.type = opts.ftype || 'lowpass';
      f.frequency.setValueAtTime(opts.f0 || 2000, t0);
      if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t0 + dur);
      f.Q.value = opts.q || 0.8;
      const g = ctx.createGain();
      const vol = opts.vol === undefined ? 0.4 : opts.vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      this.route(g, opts.pan, opts.bus);
      const offset = Math.random() * 1.5;
      src.start(t0, offset, dur + 0.05);
      this.trackVoice(src, dur);
      return src;
    },

    route(node, pan, bus) {
      const target = bus === 'music' ? this.musicBus : this.sfxBus;
      if (pan && this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = U.clamp(pan, -1, 1);
        node.connect(p);
        p.connect(target);
      } else {
        node.connect(target);
      }
    },

    trackVoice(src, dur) {
      this.activeVoices++;
      const self = this;
      src.onended = function () {
        self.activeVoices--;
      };
      // Страховка на случай, если onended не сработает.
      setTimeout(function () {
        if (src.onended) {
          src.onended = null;
          self.activeVoices = Math.max(0, self.activeVoices - 1);
        }
      }, (dur + 0.5) * 1000);
    },

    // ---------- Публичный вызов ----------
    // name — ключ из библиотеки SFX, opts: {x (для панорамы), pitch, vol}
    play(name, opts) {
      if (!this.ctx || !this.enabled || this.muted) return;
      if (G.Save.settings.sfx <= 0) return;
      const def = SFX[name];
      if (!def) return;
      const now = performance.now();
      const minGap = def.gap === undefined ? 30 : def.gap;
      if (this.lastPlayed[name] && now - this.lastPlayed[name] < minGap) return;
      if (this.activeVoices > this.maxVoices && !def.priority) return;
      this.lastPlayed[name] = now;
      opts = opts || {};
      const pan = opts.x !== undefined ? ((opts.x / 540) * 2 - 1) * 0.6 : 0;
      const pitch = opts.pitch || 1;
      const vol = opts.vol === undefined ? 1 : opts.vol;
      try {
        def.fn(this, pan, pitch, vol);
      } catch (e) {
        /* звук не критичен */
      }
    },

    vibrate(pattern) {
      if (!G.Save.settings.vibration) return;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(pattern);
        } catch (e) {
          /* ignore */
        }
      }
    },
  });

  // ---------- Библиотека эффектов ----------
  const SFX = {
    shoot: {
      gap: 55,
      fn(a, pan, p, v) {
        a.tone({ type: 'square', f0: 880 * p, f1: 440 * p, dur: 0.07, vol: 0.06 * v, pan, filter: { f0: 3000, f1: 900 } });
      },
    },
    shootHeavy: {
      gap: 70,
      fn(a, pan, p, v) {
        a.tone({ type: 'sawtooth', f0: 320 * p, f1: 110 * p, dur: 0.12, vol: 0.08 * v, pan, filter: { f0: 1800, f1: 300 } });
        a.noise({ dur: 0.06, f0: 3000, f1: 600, vol: 0.05 * v, pan });
      },
    },
    spread: {
      gap: 70,
      fn(a, pan, p, v) {
        a.tone({ type: 'triangle', f0: 1200 * p, f1: 500 * p, dur: 0.08, vol: 0.08 * v, pan });
        a.tone({ type: 'square', f0: 600 * p, f1: 300 * p, dur: 0.06, vol: 0.03 * v, pan });
      },
    },
    laser: {
      gap: 90,
      fn(a, pan, p, v) {
        a.tone({ type: 'sawtooth', f0: 1600 * p, f1: 1400 * p, dur: 0.1, vol: 0.035 * v, pan, filter: { type: 'bandpass', f0: 2400, q: 4 } });
      },
    },
    missile: {
      gap: 120,
      fn(a, pan, p, v) {
        a.noise({ dur: 0.25, f0: 800, f1: 3000, ftype: 'bandpass', q: 2, vol: 0.08 * v, pan });
        a.tone({ type: 'sine', f0: 200 * p, f1: 600 * p, dur: 0.2, vol: 0.05 * v, pan });
      },
    },
    plasma: {
      gap: 100,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 300 * p, f1: 900 * p, dur: 0.14, vol: 0.1 * v, pan });
        a.tone({ type: 'triangle', f0: 600 * p, f1: 1800 * p, dur: 0.1, vol: 0.04 * v, pan, delay: 0.02 });
      },
    },
    lightning: {
      gap: 90,
      fn(a, pan, p, v) {
        a.noise({ dur: 0.12, f0: 6000, f1: 1500, ftype: 'highpass', vol: 0.09 * v, pan });
        a.tone({ type: 'square', f0: 2200 * p, f1: 180 * p, dur: 0.09, vol: 0.03 * v, pan });
      },
    },
    enemyShoot: {
      gap: 60,
      fn(a, pan, p, v) {
        a.tone({ type: 'triangle', f0: 520 * p, f1: 260 * p, dur: 0.09, vol: 0.05 * v, pan });
      },
    },
    enemyLaser: {
      gap: 200,
      fn(a, pan, p, v) {
        a.tone({ type: 'sawtooth', f0: 90 * p, f1: 60 * p, dur: 0.6, vol: 0.09 * v, pan, filter: { f0: 900, f1: 300 } });
        a.noise({ dur: 0.5, f0: 1500, f1: 400, vol: 0.05 * v, pan });
      },
    },
    charge: {
      gap: 200,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 150 * p, f1: 1200 * p, dur: 0.7, vol: 0.06 * v, pan, attack: 0.3 });
      },
    },
    hit: {
      gap: 35,
      fn(a, pan, p, v) {
        a.tone({ type: 'square', f0: 240 * p, f1: 120 * p, dur: 0.05, vol: 0.045 * v, pan });
      },
    },
    shieldHit: {
      gap: 50,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 1800 * p, f1: 1200 * p, dur: 0.08, vol: 0.05 * v, pan });
      },
    },
    hurt: {
      gap: 150,
      priority: true,
      fn(a, pan, p, v) {
        a.tone({ type: 'sawtooth', f0: 400 * p, f1: 60 * p, dur: 0.35, vol: 0.2 * v, pan, filter: { f0: 2000, f1: 200 } });
        a.noise({ dur: 0.3, f0: 1800, f1: 200, vol: 0.2 * v, pan });
      },
    },
    explodeSmall: {
      gap: 40,
      fn(a, pan, p, v) {
        a.noise({ dur: 0.28, f0: 2400 * p, f1: 200, vol: 0.16 * v, pan });
        a.tone({ type: 'sine', f0: 160 * p, f1: 40, dur: 0.2, vol: 0.12 * v, pan });
      },
    },
    explodeBig: {
      gap: 80,
      priority: true,
      fn(a, pan, p, v) {
        a.noise({ dur: 0.8, f0: 1800 * p, f1: 80, vol: 0.32 * v, pan });
        a.tone({ type: 'sine', f0: 110 * p, f1: 28, dur: 0.7, vol: 0.28 * v, pan });
        a.tone({ type: 'square', f0: 70 * p, f1: 30, dur: 0.4, vol: 0.06 * v, pan, filter: { f0: 400 } });
      },
    },
    bossExplode: {
      gap: 300,
      priority: true,
      fn(a, pan, p, v) {
        for (let i = 0; i < 5; i++) {
          a.noise({ dur: 0.9, f0: 2500 - i * 300, f1: 60, vol: 0.28 * v, delay: i * 0.18 });
          a.tone({ type: 'sine', f0: 140 - i * 15, f1: 25, dur: 0.8, vol: 0.22 * v, delay: i * 0.18 });
        }
        a.tone({ type: 'triangle', f0: 60, f1: 20, dur: 2.2, vol: 0.3 * v, delay: 0.9 });
      },
    },
    powerup: {
      gap: 80,
      priority: true,
      fn(a, pan, p, v) {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => a.tone({ type: 'square', f0: f * p, dur: 0.09, vol: 0.07 * v, delay: i * 0.05, pan, filter: { f0: 4000 } }));
      },
    },
    weaponUp: {
      gap: 120,
      priority: true,
      fn(a, pan, p, v) {
        const notes = [392, 523, 659, 784, 1047, 1319];
        notes.forEach((f, i) => a.tone({ type: 'sawtooth', f0: f * p, dur: 0.1, vol: 0.05 * v, delay: i * 0.04, pan, filter: { f0: 3500 } }));
      },
    },
    coin: {
      gap: 25,
      fn(a, pan, p, v) {
        a.tone({ type: 'square', f0: 1318 * p, dur: 0.05, vol: 0.04 * v, pan, filter: { f0: 5000 } });
        a.tone({ type: 'square', f0: 1760 * p, dur: 0.12, vol: 0.04 * v, delay: 0.045, pan, filter: { f0: 5000 } });
      },
    },
    heal: {
      gap: 100,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 440 * p, f1: 880 * p, dur: 0.3, vol: 0.12 * v, pan });
        a.tone({ type: 'sine', f0: 660 * p, f1: 1320 * p, dur: 0.3, vol: 0.06 * v, pan, delay: 0.08 });
      },
    },
    bomb: {
      gap: 300,
      priority: true,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 1200, f1: 40, dur: 1.0, vol: 0.3 * v });
        a.noise({ dur: 1.4, f0: 5000, f1: 60, vol: 0.35 * v, attack: 0.02 });
        a.tone({ type: 'sawtooth', f0: 80, f1: 30, dur: 1.2, vol: 0.1 * v, filter: { f0: 600, f1: 80 } });
      },
    },
    dash: {
      gap: 100,
      fn(a, pan, p, v) {
        a.noise({ dur: 0.2, f0: 400, f1: 5000, ftype: 'bandpass', q: 3, vol: 0.12 * v, pan });
      },
    },
    shieldUp: {
      gap: 200,
      fn(a, pan, p, v) {
        a.tone({ type: 'triangle', f0: 300 * p, f1: 1200 * p, dur: 0.4, vol: 0.1 * v, pan });
      },
    },
    warning: {
      gap: 400,
      priority: true,
      fn(a, pan, p, v) {
        for (let i = 0; i < 3; i++) {
          a.tone({ type: 'square', f0: 220, dur: 0.22, vol: 0.09 * v, delay: i * 0.45, filter: { f0: 1500 } });
          a.tone({ type: 'square', f0: 165, dur: 0.22, vol: 0.09 * v, delay: i * 0.45 + 0.22, filter: { f0: 1500 } });
        }
      },
    },
    levelClear: {
      gap: 500,
      priority: true,
      fn(a, pan, p, v) {
        const seq = [523, 659, 784, 1047, 784, 1047, 1319];
        seq.forEach((f, i) => a.tone({ type: 'square', f0: f, dur: 0.16, vol: 0.07 * v, delay: i * 0.1, filter: { f0: 3000 } }));
        seq.forEach((f, i) => a.tone({ type: 'triangle', f0: f / 2, dur: 0.16, vol: 0.08 * v, delay: i * 0.1 }));
      },
    },
    gameOver: {
      gap: 500,
      priority: true,
      fn(a, pan, p, v) {
        const seq = [392, 370, 349, 330, 311, 294, 262];
        seq.forEach((f, i) => a.tone({ type: 'sawtooth', f0: f, dur: 0.24, vol: 0.06 * v, delay: i * 0.17, filter: { f0: 1500 } }));
        a.tone({ type: 'sine', f0: 131, f1: 65, dur: 1.4, vol: 0.15 * v, delay: 1.2 });
      },
    },
    uiMove: {
      gap: 40,
      priority: true,
      fn(a, pan, p, v) {
        a.tone({ type: 'square', f0: 660, dur: 0.035, vol: 0.03 * v, filter: { f0: 3000 } });
      },
    },
    uiSelect: {
      gap: 60,
      priority: true,
      fn(a, pan, p, v) {
        a.tone({ type: 'square', f0: 880, dur: 0.05, vol: 0.05 * v, filter: { f0: 4000 } });
        a.tone({ type: 'square', f0: 1320, dur: 0.08, vol: 0.05 * v, delay: 0.05, filter: { f0: 4000 } });
      },
    },
    uiBack: {
      gap: 60,
      priority: true,
      fn(a, pan, p, v) {
        a.tone({ type: 'square', f0: 660, dur: 0.05, vol: 0.04 * v, filter: { f0: 3000 } });
        a.tone({ type: 'square', f0: 440, dur: 0.08, vol: 0.04 * v, delay: 0.05, filter: { f0: 3000 } });
      },
    },
    uiError: {
      gap: 100,
      priority: true,
      fn(a, pan, p, v) {
        a.tone({ type: 'sawtooth', f0: 150, dur: 0.15, vol: 0.06 * v, filter: { f0: 800 } });
      },
    },
    buy: {
      gap: 100,
      priority: true,
      fn(a, pan, p, v) {
        [784, 988, 1175, 1568].forEach((f, i) => a.tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.08 * v, delay: i * 0.06 }));
      },
    },
    perk: {
      gap: 200,
      priority: true,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 523, f1: 1047, dur: 0.25, vol: 0.1 * v });
        a.tone({ type: 'sine', f0: 659, f1: 1319, dur: 0.25, vol: 0.06 * v, delay: 0.06 });
        a.tone({ type: 'sine', f0: 784, f1: 1568, dur: 0.3, vol: 0.05 * v, delay: 0.12 });
      },
    },
    achievement: {
      gap: 400,
      priority: true,
      fn(a, pan, p, v) {
        [659, 784, 988, 1319].forEach((f, i) => a.tone({ type: 'square', f0: f, dur: 0.14, vol: 0.05 * v, delay: i * 0.08, filter: { f0: 3500 } }));
      },
    },
    combo: {
      gap: 120,
      fn(a, pan, p, v) {
        a.tone({ type: 'triangle', f0: 880 * p, f1: 1760 * p, dur: 0.12, vol: 0.06 * v });
      },
    },
    lowHp: {
      gap: 900,
      priority: true,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 880, dur: 0.1, vol: 0.06 * v });
        a.tone({ type: 'sine', f0: 880, dur: 0.1, vol: 0.06 * v, delay: 0.18 });
      },
    },
    teleport: {
      gap: 100,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 2000 * p, f1: 200 * p, dur: 0.2, vol: 0.06 * v, pan });
      },
    },
    spawn: {
      gap: 150,
      fn(a, pan, p, v) {
        a.tone({ type: 'triangle', f0: 100 * p, f1: 400 * p, dur: 0.25, vol: 0.05 * v, pan });
      },
    },
    graze: {
      gap: 60,
      fn(a, pan, p, v) {
        a.tone({ type: 'sine', f0: 2600 * p, dur: 0.03, vol: 0.02 * v, pan });
      },
    },
  };
  A.SFX = SFX;
})();
