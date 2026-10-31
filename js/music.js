/* My AI Arcade — процедурный музыкальный секвенсор (синтвейв). */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    pentaMinor: [0, 3, 5, 7, 10],
  };

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // Описания треков. Строки паттернов: 16 шагов, символы:
  //  bass:  цифра — ступень аккорда (0 — тоника, 1 — терция...), '.' — пауза, '-' — продление
  //  drums: 'x' — удар, 'o' — тихий удар, '.' — пауза
  const TRACKS = {
    menu: {
      bpm: 96,
      root: 45,
      scale: 'dorian',
      progression: [0, 5, 3, 4],
      bass: '0...0...0..20...',
      arp: [0, 2, 4, 7, 4, 2],
      arpRate: 2,
      arpOct: 2,
      pad: true,
      lead: null,
      drums: { kick: 'x.......x.......', snare: '....o.......o...', hat: '..o...o...o...o.' },
      bassWave: 'triangle',
      arpWave: 'sine',
    },
    sector1: {
      bpm: 128,
      root: 45,
      scale: 'minor',
      progression: [0, 5, 2, 6],
      bass: '0.0.0.0.0.0.2.0.',
      arp: [0, 2, 4, 2, 7, 4],
      arpRate: 1,
      arpOct: 2,
      pad: false,
      lead: [7, '-', 6, 4, '-', '-', 2, '-', 4, '-', 2, 0, '-', '-', '.', '.'],
      drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'o.x.o.x.o.x.o.xo' },
      bassWave: 'sawtooth',
      arpWave: 'square',
    },
    sector2: {
      bpm: 136,
      root: 43,
      scale: 'phrygian',
      progression: [0, 1, 0, 6],
      bass: '00.000.000.00.0.',
      arp: [0, 4, 7, 4, 9, 7],
      arpRate: 1,
      arpOct: 2,
      pad: false,
      lead: [4, '-', '-', 3, 1, '-', 0, '-', 1, '-', 3, '-', 4, '-', '-', '-'],
      drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x..o', hat: 'xxxxxxxxxxxxxxxx' },
      bassWave: 'square',
      arpWave: 'sawtooth',
    },
    sector3: {
      bpm: 120,
      root: 41,
      scale: 'harmonicMinor',
      progression: [0, 3, 4, 0],
      bass: '0..0..0.0..0..2.',
      arp: [0, 2, 4, 6, 4, 2, 0, -1],
      arpRate: 1,
      arpOct: 2,
      pad: true,
      lead: [0, '-', 2, '-', 4, '-', 6, 7, '-', '-', 6, 4, 2, '-', '.', '.'],
      drums: { kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.' },
      bassWave: 'sawtooth',
      arpWave: 'triangle',
    },
    sector4: {
      bpm: 142,
      root: 47,
      scale: 'minor',
      progression: [0, 6, 5, 4],
      bass: '0.0.2.0.0.0.4.2.',
      arp: [0, 7, 4, 7, 2, 7, 4, 7],
      arpRate: 1,
      arpOct: 2,
      pad: false,
      lead: [4, 4, '-', 2, '-', 4, 6, '-', 7, '-', 6, '-', 4, '-', 2, '-'],
      drums: { kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx' },
      bassWave: 'square',
      arpWave: 'square',
    },
    sector5: {
      bpm: 110,
      root: 40,
      scale: 'pentaMinor',
      progression: [0, 3, 2, 4],
      bass: '0---0---0-0-2---',
      arp: [0, 1, 2, 3, 4, 3, 2, 1],
      arpRate: 2,
      arpOct: 3,
      pad: true,
      lead: null,
      drums: { kick: 'x.......x..x....', snare: '........x.......', hat: 'o.o.o.o.o.o.o.o.' },
      bassWave: 'triangle',
      arpWave: 'sine',
    },
    sector6: {
      bpm: 150,
      root: 42,
      scale: 'harmonicMinor',
      progression: [0, 5, 3, 4],
      bass: '0000000022224444',
      arp: [0, 2, 4, 7, 9, 7, 4, 2],
      arpRate: 1,
      arpOct: 2,
      pad: false,
      lead: [7, '-', 6, '-', 4, '-', 6, '-', 7, '-', 9, '-', 7, '-', '-', '-'],
      drums: { kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x.xx', hat: 'xxxxxxxxxxxxxxxx' },
      bassWave: 'sawtooth',
      arpWave: 'square',
    },
    boss: {
      bpm: 158,
      root: 38,
      scale: 'phrygian',
      progression: [0, 1, 0, 1, 5, 4, 1, 0],
      bass: '0.00.00.0.00.0.0',
      arp: [0, 3, 7, 3, 8, 7, 3, 1],
      arpRate: 1,
      arpOct: 2,
      pad: false,
      lead: [7, '-', 8, '-', 7, '-', 5, '-', 3, '-', 1, '-', 0, '-', '-', '-'],
      drums: { kick: 'x..xx..xx..xx..x', snare: '....x..x....x..x', hat: 'xxxxxxxxxxxxxxxx' },
      bassWave: 'sawtooth',
      arpWave: 'sawtooth',
    },
    victory: {
      bpm: 112,
      root: 48,
      scale: 'lydian',
      progression: [0, 4, 5, 3],
      bass: '0...0.0.0...4...',
      arp: [0, 2, 4, 7, 9, 7, 4, 2],
      arpRate: 1,
      arpOct: 2,
      pad: true,
      lead: [4, '-', 5, 4, 2, '-', 0, '-', 2, '-', 4, '-', 7, '-', '-', '-'],
      drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
      bassWave: 'triangle',
      arpWave: 'triangle',
    },
  };

  const M = (G.Music = {
    TRACKS,
    current: null,
    track: null,
    step: 0,
    bar: 0,
    nextTime: 0,
    timer: null,
    lookahead: 0.12,
    intensity: 1,

    play(name) {
      const A = G.Audio;
      if (!A.ctx || !A.enabled) {
        this.pending = name;
        return;
      }
      if (this.current === name) return;
      this.stop();
      const tr = TRACKS[name];
      if (!tr) return;
      this.current = name;
      this.track = tr;
      this.step = 0;
      this.bar = 0;
      this.nextTime = A.ctx.currentTime + 0.08;
      const self = this;
      this.timer = setInterval(function () {
        self.schedule();
      }, 25);
    },

    resumePending() {
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        this.play(p);
      }
    },

    stop() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.current = null;
      this.track = null;
    },

    setIntensity(v) {
      this.intensity = v;
    },

    schedule() {
      const A = G.Audio;
      if (!A.ctx || !this.track) return;
      if (A.ctx.state !== 'running') return;
      const stepDur = 60 / this.track.bpm / 4;
      // Если вкладка была в фоне — не пытаемся догонять пропущенные такты.
      if (this.nextTime < A.ctx.currentTime - 0.2) this.nextTime = A.ctx.currentTime + 0.05;
      while (this.nextTime < A.ctx.currentTime + this.lookahead) {
        this.playStep(this.step, this.nextTime, stepDur);
        this.nextTime += stepDur;
        this.step++;
        if (this.step >= 16) {
          this.step = 0;
          this.bar++;
        }
      }
    },

    degreeToMidi(tr, chordDeg, deg, octave) {
      const sc = SCALES[tr.scale];
      const total = chordDeg + deg;
      const oct = Math.floor(total / sc.length);
      const idx = ((total % sc.length) + sc.length) % sc.length;
      return tr.root + sc[idx] + 12 * (oct + octave);
    },

    playStep(step, t, stepDur) {
      const tr = this.track;
      const A = G.Audio;
      const chord = tr.progression[this.bar % tr.progression.length];
      const vol = G.Save.settings.music;
      if (vol <= 0 || A.muted) return;

      // Ударные
      if (tr.drums.kick[step] === 'x') this.kick(t, 1);
      else if (tr.drums.kick[step] === 'o') this.kick(t, 0.6);
      if (tr.drums.snare[step] === 'x') this.snare(t, 1);
      else if (tr.drums.snare[step] === 'o') this.snare(t, 0.5);
      if (this.intensity > 0.3) {
        if (tr.drums.hat[step] === 'x') this.hat(t, 1);
        else if (tr.drums.hat[step] === 'o') this.hat(t, 0.5);
      }

      // Бас
      const b = tr.bass[step];
      if (b !== '.' && b !== '-') {
        let len = 1;
        while (step + len < 16 && tr.bass[step + len] === '-') len++;
        const midi = this.degreeToMidi(tr, chord, parseInt(b, 10) * 2, 0);
        this.voice(tr.bassWave, midiToFreq(midi), t, stepDur * len * 0.95, 0.12, 700);
      }

      // Арпеджио
      if (this.intensity > 0.5 && step % tr.arpRate === 0) {
        const idx = (step / tr.arpRate + this.bar * 3) % tr.arp.length;
        const midi = this.degreeToMidi(tr, chord, tr.arp[Math.floor(idx)], tr.arpOct);
        this.voice(tr.arpWave, midiToFreq(midi), t, stepDur * 0.8, 0.035, 2600);
      }

      // Мелодия — только каждый второй цикл, чтобы не надоедала.
      if (tr.lead && this.intensity > 0.7 && Math.floor(this.bar / tr.progression.length) % 2 === 1) {
        const n = tr.lead[step];
        if (n !== '.' && n !== '-') {
          let len = 1;
          while (step + len < 16 && tr.lead[step + len] === '-') len++;
          const midi = this.degreeToMidi(tr, 0, n, 2) + 12;
          this.voice('square', midiToFreq(midi), t, stepDur * len * 0.9, 0.03, 3200, 6);
        }
      }

      // Пэд — длинный аккорд на первый шаг такта.
      if (tr.pad && step === 0) {
        for (const d of [0, 2, 4]) {
          const midi = this.degreeToMidi(tr, chord, d, 1);
          this.voice('sawtooth', midiToFreq(midi), t, stepDur * 15, 0.018, 900, 0, 0.4);
        }
      }
    },

    voice(type, freq, t, dur, vol, cutoff, vibrato, attack) {
      const ctx = G.Audio.ctx;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(cutoff, t);
      f.Q.value = 2;
      const g = ctx.createGain();
      const atk = attack || 0.006;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + atk);
      g.gain.setValueAtTime(vol, t + Math.max(atk, dur * 0.6));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(f);
      f.connect(g);
      g.connect(G.Audio.musicBus);
      if (vibrato) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = vibrato;
        lg.gain.value = freq * 0.01;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.05);
      }
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },

    kick(t, v) {
      const ctx = G.Audio.ctx;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.35 * v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(g);
      g.connect(G.Audio.musicBus);
      osc.start(t);
      osc.stop(t + 0.2);
    },

    snare(t, v) {
      const ctx = G.Audio.ctx;
      const src = ctx.createBufferSource();
      src.buffer = G.Audio.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16 * v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      src.connect(f);
      f.connect(g);
      g.connect(G.Audio.musicBus);
      src.start(t, Math.random(), 0.16);
      const osc = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
      g2.gain.setValueAtTime(0.1 * v, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(g2);
      g2.connect(G.Audio.musicBus);
      osc.start(t);
      osc.stop(t + 0.12);
    },

    hat(t, v) {
      const ctx = G.Audio.ctx;
      const src = ctx.createBufferSource();
      src.buffer = G.Audio.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05 * v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f);
      f.connect(g);
      g.connect(G.Audio.musicBus);
      src.start(t, Math.random(), 0.05);
    },
  });

  // При скрытии вкладки глушим всё, чтобы не играло в фоне.
  document.addEventListener('visibilitychange', function () {
    const A = G.Audio;
    if (!A.ctx) return;
    if (document.hidden) A.ctx.suspend();
    else A.ctx.resume();
  });

  M.SCALES = SCALES;
})();
