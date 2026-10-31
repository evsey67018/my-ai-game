/* My AI Arcade — режиссёр волн: сценарии кампании и генератор бесконечного режима. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const W = 540;
  const H = 960;

  // Типы врагов, доступные в бесконечном режиме, с «ценой» и волной появления.
  const ENDLESS_POOL = [
    { type: 'drone', cost: 1, from: 1, forms: ['line', 'v', 'column', 'arc'], n: [5, 8] },
    { type: 'dart', cost: 1.5, from: 1, forms: ['sides', 'random'], n: [3, 6] },
    { type: 'weaver', cost: 2, from: 2, forms: ['column', 'stair', 'line'], n: [4, 8] },
    { type: 'kamikaze', cost: 1.5, from: 2, forms: ['random', 'pincer'], n: [4, 8] },
    { type: 'gunner', cost: 4, from: 3, forms: ['line'], n: [2, 4] },
    { type: 'orb', cost: 3, from: 3, forms: ['random'], n: [2, 5] },
    { type: 'splitter', cost: 5, from: 4, forms: ['random', 'line'], n: [2, 4] },
    { type: 'swarm', cost: 0.5, from: 4, forms: ['circle', 'random'], n: [12, 24] },
    { type: 'tank', cost: 8, from: 5, forms: ['line'], n: [1, 2] },
    { type: 'turret', cost: 7, from: 6, forms: ['line', 'random'], n: [1, 3] },
    { type: 'sniper', cost: 6, from: 6, forms: ['line'], n: [1, 3] },
    { type: 'miner', cost: 5, from: 7, forms: ['sides'], n: [1, 2] },
    { type: 'shielder', cost: 7, from: 8, forms: ['line'], n: [1, 3] },
    { type: 'phaser', cost: 6, from: 9, forms: ['random'], n: [2, 4] },
    { type: 'carrier', cost: 12, from: 10, forms: ['line'], n: [1, 2] },
  ];
  const BOSS_ORDER = ['guardian', 'leviathan', 'colossus', 'queen', 'twins', 'core'];

  const D = (G.Director = {
    level: null,
    events: [],
    idx: 0,
    time: 0,
    waiting: false,
    queue: [],
    phase: 'idle', // waves | bossWarn | boss | done
    warnT: 0,
    msgs: [],
    endless: false,
    wave: 0,
    waveDelay: 0,
    progress: 0,

    reset() {
      this.events = [];
      this.idx = 0;
      this.time = 0;
      this.waiting = false;
      this.queue.length = 0;
      this.phase = 'idle';
      this.warnT = 0;
      this.msgs.length = 0;
      this.progress = 0;
    },

    startLevel(level) {
      this.reset();
      this.endless = false;
      this.level = level;
      this.events = level.events.slice().sort((a, b) => a.at - b.at);
      this.totalTime = this.events.length ? this.events[this.events.length - 1].at : 1;
      this.phase = 'waves';
    },

    startEndless() {
      this.reset();
      this.endless = true;
      this.wave = 0;
      this.level = null;
      this.phase = 'between';
      this.waveDelay = 1.5;
    },

    // ---------- Формации ----------
    spawnGroup(ev) {
      const n = ev.n || 1;
      const gap = ev.gap === undefined ? 0.25 : ev.gap;
      const cx = (ev.x === undefined ? 0.5 : ev.x) * W;
      const base = { path: ev.path, hp: ev.hp };
      const add = (delay, x, y, extra) => {
        this.queue.push({ delay, type: ev.type, x: U.clamp(x, 30, W - 30), y, opts: Object.assign({}, base, extra || {}) });
      };
      const mid = (n - 1) / 2;
      switch (ev.form) {
        case 'column':
          for (let i = 0; i < n; i++) add(i * gap, cx, -40, { idx: i });
          break;
        case 'v':
          for (let i = 0; i < n; i++) add(i * gap, cx + (i - mid) * 48, -40 - Math.abs(i - mid) * 36, { idx: i });
          break;
        case 'arc':
          for (let i = 0; i < n; i++) {
            const k = n === 1 ? 0.5 : i / (n - 1);
            add(i * gap, U.lerp(70, W - 70, k), -40 - Math.sin(k * Math.PI) * 70, { idx: i });
          }
          break;
        case 'random':
          for (let i = 0; i < n; i++) add(i * gap, U.rand(40, W - 40), -40 - U.rand(0, 40), { idx: i });
          break;
        case 'sides':
          for (let i = 0; i < n; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            add(i * gap, side < 0 ? 70 : W - 70, -40, { idx: i, side });
          }
          break;
        case 'pincer':
          for (let i = 0; i < n; i++) {
            const left = i % 2 === 0;
            add(Math.floor(i / 2) * gap, left ? W * 0.12 : W * 0.88, -40, { idx: i, path: ev.path || 'straight' });
          }
          break;
        case 'circle': {
          const rad = Math.min(140, 30 + n * 5);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * U.TAU;
            add(i * gap, cx + Math.cos(a) * rad, -rad - 40 + Math.sin(a) * rad, { idx: i });
          }
          break;
        }
        case 'wall':
          for (let i = 0; i < n; i++) add(0, U.lerp(50, W - 50, n === 1 ? 0.5 : i / (n - 1)), -40, { idx: i });
          break;
        case 'stair': {
          const dir = cx < W / 2 ? 1 : -1;
          for (let i = 0; i < n; i++) add(i * gap, cx + dir * i * 36, -40, { idx: i, path: ev.path });
          break;
        }
        case 'line':
        default: {
          const spacing = Math.min(80, (W - 80) / Math.max(1, n - 1));
          for (let i = 0; i < n; i++) add(i * gap, cx + (i - mid) * spacing, -40, { idx: i });
        }
      }
    },

    hostilesLeft() {
      if (this.queue.length) return true;
      for (const e of G.Game.enemies) if (e.alive && !e.isBoss) return true;
      return false;
    },

    showMessage(text, color) {
      G.Events.emit('banner', { text, color: color || '#ffffff' });
    },

    beginBoss(type) {
      this.phase = 'bossWarn';
      this.warnT = 3.2;
      this.bossType = type;
      G.Events.emit('bossWarning', { type });
      G.Audio.play('warning');
      G.Music.stop();
    },

    update(dt) {
      // Отложенные появления
      for (let i = this.queue.length - 1; i >= 0; i--) {
        const q = this.queue[i];
        q.delay -= dt;
        if (q.delay <= 0) {
          this.queue.splice(i, 1);
          G.Enemies.spawn(q.type, q.x, q.y, q.opts);
        }
      }

      switch (this.phase) {
        case 'waves':
          this.updateWaves(dt);
          break;
        case 'between':
          this.updateEndless(dt);
          break;
        case 'endlessWave':
          if (!this.hostilesLeft()) {
            this.phase = 'between';
            this.waveDelay = 1.2;
            G.Game.onWaveCleared(this.wave);
          }
          break;
        case 'bossWarn':
          this.warnT -= dt;
          if (this.warnT <= 0) {
            this.phase = 'boss';
            const boss = G.Enemies.spawn(this.bossType, W / 2, -100, {});
            if (this.endless && boss) {
              const mul = 1 + Math.floor(this.wave / 5) * 0.35;
              boss.maxHp *= mul;
              boss.hp = boss.maxHp;
            }
            G.Music.play('boss');
          }
          break;
        case 'boss':
          // Ждём, пока Game сообщит о победе над боссом.
          break;
      }
    },

    updateWaves(dt) {
      if (this.waiting) {
        if (!this.hostilesLeft() && !G.Game.miniBoss) this.waiting = false;
        else return;
      }
      this.time += dt;
      this.progress = U.clamp(this.time / this.totalTime, 0, 1);
      while (this.idx < this.events.length && this.events[this.idx].at <= this.time) {
        const ev = this.events[this.idx++];
        if (ev.msg) this.showMessage(ev.msg);
        else if (ev.clear) {
          this.waiting = true;
          break;
        } else if (ev.mini) {
          G.Enemies.spawn(ev.mini, W / 2, -80, {});
          this.showMessage('Мини-босс: ' + G.Enemies.DEFS[ev.mini].name, '#ffb02e');
          G.Audio.play('warning');
          this.waiting = true;
          break;
        } else this.spawnGroup(ev);
      }
      if (this.idx >= this.events.length && !this.waiting && !this.hostilesLeft()) {
        this.progress = 1;
        this.beginBoss(this.level.boss);
      }
    },

    // ---------- Бесконечный режим ----------
    updateEndless(dt) {
      this.waveDelay -= dt;
      if (this.waveDelay > 0) return;
      this.wave++;
      G.Game.onWaveStart(this.wave);
      if (this.wave % 5 === 0) {
        const type = BOSS_ORDER[(this.wave / 5 - 1) % BOSS_ORDER.length];
        this.beginBoss(type);
        return;
      }
      if (this.wave % 5 === 3 && this.wave >= 3) {
        const mini = this.wave % 10 === 3 ? 'warden' : 'prism';
        G.Enemies.spawn(mini, W / 2, -80, { hp: 1 + this.wave * 0.04 });
        this.showMessage('Волна ' + this.wave + ' — мини-босс!', '#ffb02e');
      } else {
        this.showMessage('Волна ' + this.wave);
      }
      for (const ev of this.generateWave(this.wave)) {
        const delay = ev.at;
        const before = this.queue.length;
        this.spawnGroup(ev);
        for (let i = before; i < this.queue.length; i++) this.queue[i].delay += delay;
      }
      this.phase = 'endlessWave';
    },

    generateWave(wave) {
      const budget = 8 + wave * 3.2;
      const available = ENDLESS_POOL.filter((p) => p.from <= wave);
      const out = [];
      let spent = 0;
      let at = 0.5;
      let guard = 0;
      while (spent < budget && guard++ < 30) {
        const entry = U.pick(available);
        const n = U.randInt(entry.n[0], entry.n[1]);
        const cost = entry.cost * n;
        if (spent + cost > budget * 1.25 && out.length) continue;
        spent += cost;
        out.push({
          at,
          type: entry.type,
          n,
          form: U.pick(entry.forms),
          x: U.rand(0.25, 0.75),
          gap: entry.type === 'swarm' ? 0.04 : U.rand(0.12, 0.35),
          path: U.pick(['straight', 'sine', 'zig', 'swoop']),
        });
        at += U.rand(1.5, 3.2) * Math.max(0.5, 1 - wave * 0.02);
      }
      return out;
    },

    onBossDefeated() {
      this.phase = this.endless ? 'between' : 'done';
      this.waveDelay = 3;
    },
  });

  D.ENDLESS_POOL = ENDLESS_POOL;
  D.BOSS_ORDER = BOSS_ORDER;
})();
