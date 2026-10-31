/* My AI Arcade — ядро игры: состояния, забег, очки, комбо, столкновения, отрисовка мира. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const W = 540;
  const H = 960;

  function newRun(mode) {
    return {
      mode,
      score: 0,
      level: 1,
      wave: 0,
      kills: 0,
      bossKills: 0,
      maxCombo: 0,
      weaponMaxed: false,
      levelDamage: 0,
      damageTaken: 0,
      bossBombs: 0,
      grazes: 0,
      perks: 0,
      maxDrones: 0,
      shots: 0,
      crystals: 0,
      powerups: 0,
      time: 0,
      perkList: [],
      ship: G.Save.data.selectedShip,
    };
  }

  const Game = (G.Game = {
    state: 'menu', // menu | playing | paused | perk | gameover | victory
    mode: 'campaign',
    player: null,
    enemies: [],
    effects: [],
    run: null,
    level: 1,
    levelDef: null,
    hpMul: 1,
    fireMul: 1,
    dropMul: 1,
    enemyTimeScale: 1,
    boss: null,
    miniBoss: null,
    combo: 0,
    comboTimer: 0,
    comboMax: 3,
    shakeAmt: 0,
    shakeT: 0,
    shakeDur: 0,
    slowT: 0,
    slowScale: 1,
    hitStop: 0,
    time: 0,
    deathTimer: 0,
    noFire: false,
    sched: new U.Scheduler(),
    pendingPerks: null,
    perkContext: null,
    lastRecord: false,
    demo: false,

    init() {
      G.Events.on('pausePressed', () => {
        // На вложенных экранах паузы (настройки и т.п.) Esc работает как «назад».
        if (this.state === 'paused' && G.Menus.current && G.Menus.current.name !== 'pause') return;
        this.togglePause();
      });
      G.Events.on('blur', () => {
        if (this.state === 'playing') this.pause();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing') this.pause();
      });
      this.startDemo();
    },

    // Фоновая «заставка» под главным меню.
    startDemo() {
      this.demo = true;
      this.clearWorld();
      this.player = null;
      const lvl = G.Data.levels[U.randInt(0, G.Data.levels.length - 1)];
      G.Background.setTheme(lvl.theme);
      G.Background.warp(false);
    },

    clearWorld() {
      this.enemies.length = 0;
      this.effects.length = 0;
      G.Bullets.clear();
      G.Particles.clear();
      G.Powerups.clear();
      G.Patterns.clearLasers();
      this.sched.clear();
      this.boss = null;
      this.miniBoss = null;
      this.combo = 0;
      this.comboTimer = 0;
      this.slowT = 0;
      this.enemyTimeScale = 1;
      this.hitStop = 0;
      this.noFire = false;
    },

    // ---------- Запуск ----------
    newGame(mode) {
      this.demo = false;
      this.mode = mode || 'campaign';
      this.clearWorld();
      this.run = newRun(this.mode);
      this.player = new G.Player(G.Save.data.selectedShip);
      this.run.maxDrones = this.player.drones.length;
      this.deathTimer = 0;
      G.Save.addStat('runs');
      G.Save.save();
      this.setState('playing');
      if (this.mode === 'endless') {
        this.hpMul = 1;
        this.fireMul = 1;
        this.dropMul = 1.2;
        this.level = 1;
        G.Background.setTheme(G.Data.endlessThemes[0]);
        G.Music.play('sector1');
        G.Director.startEndless();
        G.Events.emit('levelStart', { name: 'Бесконечный режим', subtitle: 'Сколько продержитесь?', intro: 'Волны становятся всё сильнее. Каждая пятая — босс.' });
      } else {
        this.startLevel(1);
      }
    },

    startLevel(n) {
      const def = G.Data.levels[n - 1];
      this.level = n;
      this.levelDef = def;
      this.hpMul = def.hpMul;
      this.fireMul = 1 + (n - 1) * 0.12;
      this.dropMul = 1;
      this.run.level = n;
      this.run.levelDamage = 0;
      this.noFire = false;
      G.Patterns.clearLasers();
      G.Background.setTheme(def.theme);
      G.Background.warp(false);
      G.Music.play(def.music);
      G.Music.setIntensity(0.5);
      G.Director.startLevel(def);
      if (this.player) {
        this.player.entering = 1;
        this.player.invuln = Math.max(this.player.invuln, 1.5);
      }
      G.Achievements.check('levelStart');
      G.Events.emit('levelStart', { name: 'Сектор ' + n + ': ' + def.name, subtitle: def.subtitle, intro: def.intro });
    },

    setState(s) {
      const prev = this.state;
      this.state = s;
      G.Events.emit('state', s, prev);
    },

    pause() {
      if (this.state !== 'playing') return;
      this.setState('paused');
      G.Audio.play('uiBack');
    },
    resume() {
      if (this.state !== 'paused') return;
      this.setState('playing');
      G.Input.clearDrag();
      G.Audio.play('uiSelect');
    },
    togglePause() {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    },

    quitToMenu() {
      if (this.run && (this.state === 'paused' || this.state === 'playing')) this.finishRun(false, true);
      this.run = null;
      this.player = null;
      this.startDemo();
      this.setState('menu');
      G.Music.play('menu');
    },

    canFire() {
      return this.state === 'playing' && !this.noFire;
    },

    // ---------- Эффекты ----------
    shake(amount, dur) {
      if (!G.Save.settings.shake) return;
      if (amount >= this.shakeAmt * (this.shakeT / (this.shakeDur || 1))) {
        this.shakeAmt = amount;
        this.shakeT = dur;
        this.shakeDur = dur;
      }
    },

    slowMo(dur, scale) {
      this.slowT = Math.max(this.slowT, dur);
      this.slowScale = scale;
    },

    bigExplosion(x, y, r, palette) {
      G.Particles.explosion(x, y, r * 1.4, palette);
      G.Particles.shards(x, y, palette[0], 24, 420);
      G.Particles.ring(x, y, r * 4, palette[0], 0.7, 6);
      G.Particles.flash(x, y, r * 5, '#ffffff', 0.3);
      G.Audio.play('explodeBig', { x });
      this.shake(16, 0.6);
      this.hitStop = 0.08;
    },

    // ---------- Очки и ресурсы ----------
    comboMult() {
      return 1 + Math.min(40, Math.floor(this.combo / 10)) * 0.1;
    },

    addScore(n, x, y, silent) {
      if (!this.run) return;
      const mul = this.comboMult() * (this.player ? this.player.stats.scoreMul : 1);
      const v = Math.round(n * mul);
      this.run.score += v;
      if (!silent && x !== undefined && x !== null && v >= 200) {
        G.Particles.text(x, y, U.formatNumber(v), v >= 5000 ? '#ffe24f' : '#ffffff', v >= 5000 ? 20 : 14, 0.8);
      }
    },

    addCrystals(n) {
      if (!this.run) return;
      this.run.crystals += n;
      G.Save.addCrystals(n);
    },

    bumpCombo(n) {
      this.combo += n || 1;
      this.comboTimer = this.comboMax;
      if (this.combo > this.run.maxCombo) this.run.maxCombo = this.combo;
      if (this.combo > 0 && this.combo % 25 === 0) {
        G.Audio.play('combo', { pitch: 1 + Math.min(1, this.combo / 200) });
        G.Events.emit('combo', this.combo);
      }
    },

    // ---------- Обратные вызовы от сущностей ----------
    onEnemyDamaged(e, dmg) {
      if (this.boss === e) this.run.bossDamage = (this.run.bossDamage || 0) + dmg;
    },

    onEnemyKilled(e) {
      if (!this.run) return;
      this.run.kills++;
      G.Save.addStat('kills');
      this.bumpCombo(1);
      if (!e.isBoss) this.addScore(e.score, e.x, e.y - e.r);
      G.Powerups.dropFor(e);
      if (this.player && this.player.alive) this.player.onKill(e);
      if (this.run.kills % 25 === 0) G.Achievements.check('kill');
      if (e.isMini) {
        this.addScore(e.score, e.x, e.y);
        G.Bullets.cancelEnemyBullets(0, 0, Infinity, true);
        G.Powerups.collectAll();
        // В бесконечном режиме перки выдаются за волны, здесь — только в кампании.
        if (this.mode === 'campaign') this.sched.after(1.6, () => this.offerPerks('mini'));
        else this.addCrystals(10);
      }
    },

    onGraze(b) {
      if (!this.run || !this.player) return;
      this.run.grazes++;
      this.addScore(25 * this.player.stats.grazeBonus, null, null, true);
      this.comboTimer = this.comboMax;
      G.Audio.play('graze', { x: b.x, vol: 0.5 });
      G.Particles.spark(b.x, b.y, '#ffffff', 2, 120, 0.2);
      // Граза заряжает рывок
      if (this.player.dashCd > 0) this.player.dashCd -= 0.05 * this.player.stats.grazeBonus;
    },

    onPlayerHurt() {
      this.run.levelDamage++;
      this.run.damageTaken++;
      if (this.combo >= 10) G.Particles.text(this.player.x, this.player.y - 60, 'Комбо потеряно', '#ff8a9a', 15, 1);
      this.combo = 0;
      this.comboTimer = 0;
      G.Events.emit('playerHurt');
    },

    onPlayerDeath() {
      this.deathTimer = 2.4;
      this.noFire = true;
      G.Music.stop();
      G.Save.addStat('deaths');
      G.Audio.play('gameOver');
    },

    onBomb(p) {
      const dmg = 140 * p.stats.bombPower * p.stats.damage;
      this.effects.push(new G.Shockwave(p.x, p.y, 1100, dmg, '#ffb8c4'));
      if (p.singularity) {
        const tgt = G.Bullets.findTarget(p.x, p.y, 700);
        const sx = tgt ? tgt.x : p.x;
        const sy = tgt ? tgt.y : p.y - 300;
        this.effects.push(new G.Singularity(sx, sy, p.stats.damage * p.stats.bombPower));
      }
      if (this.boss) this.run.bossBombs++;
      G.Audio.play('bomb', { x: p.x });
      G.Background.flash('#ffffff', 0.4);
      G.Particles.flash(p.x, p.y, 400, '#ffffff', 0.35);
      this.shake(18, 0.7);
      G.Audio.vibrate([60, 40, 120]);
      G.Achievements.check('bomb');
    },

    setBoss(e) {
      this.boss = e;
      G.Events.emit('bossStart', e);
    },
    setMiniBoss(e) {
      this.miniBoss = e;
    },

    onBossDefeated(e) {
      this.boss = null;
      this.run.bossKills++;
      G.Save.addStat('bossKills');
      this.addScore(e.score, e.x, e.y);
      const crystals = Math.round((30 + this.level * 15) * (this.player ? this.player.stats.crystalMul : 1));
      G.Powerups.spawnCrystals(e.x, e.y, crystals);
      G.Powerups.spawn('heal', e.x, e.y);
      // Каскад взрывов
      for (let i = 0; i < 8; i++) {
        this.sched.after(i * 0.18, () => {
          const x = e.x + U.rand(-e.r * 1.5, e.r * 1.5);
          const y = e.y + U.rand(-e.r, e.r);
          G.Particles.explosion(x, y, 30, [e.color, '#ffffff', '#ffb02e']);
          G.Audio.play('explodeBig', { x, pitch: U.rand(0.7, 1.1) });
          this.shake(10, 0.3);
        });
      }
      this.sched.after(1.5, () => {
        this.bigExplosion(e.x, e.y, e.r * 2, [e.color, '#ffffff', '#ffe24f']);
        G.Audio.play('bossExplode');
        G.Powerups.collectAll();
      });
      this.slowMo(1.2, 0.3);
      G.Music.stop();
      G.Achievements.check('bossKill');
      G.Director.onBossDefeated(e);
      if (this.mode === 'endless') G.Director.waveDelay = 999;
      if (this.mode === 'campaign') {
        this.sched.after(4, () => this.levelComplete());
      } else {
        this.sched.after(3.5, () => {
          G.Music.play('sector' + (((Math.floor(G.Director.wave / 5) % 6) + 1)));
          this.offerPerks('boss');
        });
      }
    },

    levelComplete() {
      if (!this.player || !this.player.alive) return;
      G.Audio.play('levelClear');
      G.Achievements.check('levelClear');
      G.Save.maxStat('bestLevel', this.level);
      if (this.level > G.Save.data.bestLevel) G.Save.data.bestLevel = this.level;
      const bonus = this.run.levelDamage === 0 ? 10000 * this.level : 0;
      if (bonus) this.addScore(bonus, W / 2, H / 2);
      if (this.level >= G.Data.levels.length) {
        this.victory();
        return;
      }
      this.noFire = true;
      G.Background.warp(true);
      G.Events.emit('levelClear', { level: this.level, bonus, noHit: this.run.levelDamage === 0 });
      this.sched.after(1.2, () => this.offerPerks('level'));
    },

    // ---------- Бесконечный режим ----------
    onWaveStart(wave) {
      this.run.wave = wave;
      this.hpMul = 1 + wave * 0.09;
      this.fireMul = 1 + Math.min(1.2, wave * 0.035);
      G.Save.maxStat('endlessBestWave', wave);
      if (wave % 5 === 1 && wave > 1) {
        const themes = G.Data.endlessThemes;
        G.Background.setTheme(themes[Math.floor(wave / 5) % themes.length]);
      }
      G.Achievements.check('wave');
    },

    onWaveCleared(wave) {
      this.addScore(1000 * wave, W / 2, H * 0.4);
      if (wave % 3 === 0) {
        G.Director.waveDelay = 999;
        this.sched.after(1, () => this.offerPerks('wave'));
      }
    },

    // ---------- Перки ----------
    offerPerks(context) {
      if (!this.player || !this.player.alive) return;
      if (this.state !== 'playing') {
        this.sched.after(0.5, () => this.offerPerks(context));
        return;
      }
      const luckBonus = (this.player.stats.luck - 1) * 0.5 + (context === 'level' || context === 'boss' ? 0.5 : 0);
      this.pendingPerks = G.Data.rollPerks(this.player, 3, luckBonus);
      this.perkContext = context;
      this.rerollCost = 20 + this.run.perks * 5;
      this.setState('perk');
      G.Audio.play('perk');
      G.Events.emit('perkChoice', { perks: this.pendingPerks, context, rerollCost: this.rerollCost });
    },

    rerollPerks() {
      if (!G.Save.spendCrystals(this.rerollCost)) {
        G.Audio.play('uiError');
        return false;
      }
      this.pendingPerks = G.Data.rollPerks(this.player, 3, 0.5);
      this.rerollCost += 15;
      G.Audio.play('buy');
      G.Events.emit('perkChoice', { perks: this.pendingPerks, context: this.perkContext, rerollCost: this.rerollCost });
      return true;
    },

    choosePerk(index) {
      if (this.state !== 'perk') return;
      const p = this.player;
      if (index >= 0 && this.pendingPerks[index]) {
        const pk = this.pendingPerks[index];
        pk.apply(p);
        p.perkStacks[pk.id] = (p.perkStacks[pk.id] || 0) + 1;
        this.run.perks++;
        this.run.perkList.push(pk.id);
        G.Save.addStat('perksTaken');
        G.Particles.ring(p.x, p.y, 80, G.Data.rarity[pk.rarity].color, 0.6, 4);
        G.Audio.play('weaponUp');
      } else {
        // Пропуск — немного кристаллов.
        this.addCrystals(15);
      }
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      if (p.bombs > p.maxBombs) p.bombs = p.maxBombs;
      this.pendingPerks = null;
      G.Achievements.check('perk');
      this.setState('playing');
      G.Input.clearDrag();
      const ctx = this.perkContext;
      this.perkContext = null;
      if (ctx === 'level') {
        G.Background.warp(false);
        this.startLevel(this.level + 1);
      } else if (ctx === 'wave' || ctx === 'boss') {
        G.Director.waveDelay = 1;
      }
    },

    // ---------- Конец забега ----------
    finishRun(won, abandoned) {
      const run = this.run;
      if (!run || run.finished) return null;
      run.finished = true;
      G.Save.addStat('playTime', Math.round(run.time));
      G.Save.maxStat('maxCombo', run.maxCombo);
      G.Save.addStat('shotsFired', run.shots);
      if (won) G.Save.addStat('wins');
      const best = this.mode === 'endless' ? G.Save.data.highScoreEndless : G.Save.data.highScore;
      let isRecord = false;
      if (!abandoned || run.score > 0) {
        isRecord = G.Save.submitScore({
          score: run.score,
          level: this.mode === 'endless' ? run.wave : run.level,
          date: Date.now(),
          mode: this.mode,
          ship: run.ship,
        });
      }
      G.Achievements.check(won ? 'victory' : 'gameOver');
      G.Save.save();
      return { run, isRecord, prevBest: best };
    },

    gameOver() {
      const res = this.finishRun(false);
      this.setState('gameover');
      G.Events.emit('gameOver', res);
    },

    victory() {
      this.noFire = true;
      const p = this.player;
      // Бонус за оставшиеся жизни и бомбы
      this.addScore(p.hp * 20000 + p.bombs * 10000, W / 2, H / 2);
      const res = this.finishRun(true);
      G.Music.play('victory');
      G.Background.warp(true);
      this.sched.after(2, () => {
        this.setState('victory');
        G.Events.emit('victory', res);
      });
    },

    // ---------- Обновление ----------
    update(dt) {
      G.Input.update();
      if (this.state === 'menu' || this.demo) {
        G.Background.update(dt);
        this.updateDemo(dt);
        G.Particles.update(dt);
        return;
      }
      if (this.state !== 'playing') {
        // На паузе и в выборе перка мир заморожен, но фон слегка живёт.
        G.Background.update(dt * 0.15);
        return;
      }
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        return;
      }
      this.time += dt;
      this.run.time += dt;

      // Замедление времени
      if (this.slowT > 0) {
        this.slowT -= dt;
        this.enemyTimeScale = U.lerp(this.enemyTimeScale, this.slowScale, 0.2);
      } else {
        this.enemyTimeScale = U.lerp(this.enemyTimeScale, 1, 0.1);
      }

      if (this.shakeT > 0) this.shakeT -= dt;
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }

      this.sched.update(dt);
      G.Background.update(dt);
      G.Director.update(dt * this.enemyTimeScale);

      const p = this.player;
      if (p) p.update(dt);

      for (const e of this.enemies) if (e.alive) e.update(dt);
      this.checkContacts();
      U.compact(this.enemies, (e) => e.alive);

      G.Patterns.updateLasers(dt * this.enemyTimeScale);
      G.Bullets.update(dt);
      G.Powerups.update(dt);

      for (const fx of this.effects) fx.update(dt);
      U.compact(this.effects, (fx) => !fx.dead);

      G.Particles.update(dt);

      if (p && !p.alive && this.deathTimer > 0) {
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) this.gameOver();
      }
      G.Music.setIntensity(this.boss ? 1 : 0.5 + Math.min(0.5, this.enemies.length / 30));
    },

    checkContacts() {
      const p = this.player;
      if (!p || !p.alive) return;
      const pr = p.hitRadius() + 4;
      for (const e of this.enemies) {
        if (!e.alive || !e.targetable || !e.contact) continue;
        if (!e.hitTest(p.x, p.y, pr)) continue;
        if (p.dashTime > 0 && !e.isBoss && !e.isMini && p.stats.dashDamage > 0) continue;
        if (p.takeHit({ x: e.x, y: e.y, contact: true })) {
          if (!e.isBoss && !e.isMini) e.damage(60 * p.stats.damage, { x: p.x, y: p.y, kind: 'ram' });
        }
      }
    },

    // Простая заставка: враги летают, «призрачный» корабль стреляет.
    updateDemo(dt) {
      this.time += dt;
      this.demoT = (this.demoT || 0) - dt;
      if (this.demoT <= 0) {
        this.demoT = U.rand(0.5, 1.4);
        const x = U.rand(40, W - 40);
        const c = U.pick(['#ff5d73', '#33e1ff', '#ffb02e', '#c46bff', '#7dff5a']);
        G.Particles.trail(x, -10, c, 3, 3, 0, U.rand(200, 380));
      }
    },

    // ---------- Отрисовка ----------
    draw(ctx) {
      ctx.save();
      if (this.shakeT > 0 && this.shakeDur > 0) {
        const k = this.shakeT / this.shakeDur;
        const a = this.shakeAmt * k;
        ctx.translate(U.rand(-a, a), U.rand(-a, a));
      }
      G.Background.draw(ctx);
      if (this.state !== 'menu' && !this.demo) {
        for (const fx of this.effects) if (fx instanceof G.Singularity) fx.draw(ctx);
        G.Powerups.draw(ctx);
        for (const e of this.enemies) if (!e.isBoss) e.draw(ctx);
        for (const e of this.enemies) if (e.isBoss) e.draw(ctx);
        G.Bullets.drawPlayer(ctx);
        if (this.player) this.player.draw(ctx);
        G.Patterns.drawLasers(ctx);
        G.Bullets.drawEnemy(ctx);
        for (const fx of this.effects) if (!(fx instanceof G.Singularity)) fx.draw(ctx);
      }
      G.Particles.draw(ctx);
      ctx.restore();

      // Замедление времени — лёгкий синий оттенок
      if (this.enemyTimeScale < 0.9 && this.state === 'playing') {
        ctx.save();
        ctx.globalAlpha = (1 - this.enemyTimeScale) * 0.25;
        ctx.fillStyle = '#3fa9ff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      if (this.state !== 'menu' && !this.demo && G.HUD) G.HUD.draw(ctx);
    },
  });

  Game.newRun = newRun;
})();
