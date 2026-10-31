/* My AI Arcade — враги: базовый класс и каталог из 17 типов + 2 мини-босса. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const W = 540;
  const H = 960;
  const PI = Math.PI;
  const DOWN = PI / 2;

  // ========== Базовый класс ==========
  class Enemy {
    constructor(type, def, x, y, opts) {
      this.type = type;
      this.def = def;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.opts = opts || {};
      const hpMul = (this.opts.hp || 1) * (G.Game.hpMul || 1);
      this.maxHp = def.hp * hpMul;
      this.hp = this.maxHp;
      this.r = def.r;
      this.alive = true;
      this.removed = false;
      this.targetable = false;
      this.t = 0;
      this.hitFlash = 0;
      this.slowTimer = 0;
      this.slowAmount = 0;
      this.mass = def.mass || 1;
      this.score = def.score;
      this.color = def.color;
      this.isBoss = !!def.isBoss;
      this.isMini = !!def.isMini;
      this.state = 0;
      this.stateT = 0;
      this.fireT = U.rand(0.3, 1.2);
      this.angle = DOWN;
      this.contact = def.contact !== false;
      this.entered = false;
      this.shield = 0;
      this.maxShield = 0;
      this.noDrop = !!this.opts.noDrop;
      this.fireMul = G.Game.fireMul || 1;
      this.id = U.uid();
      if (def.init) def.init(this);
    }

    get dtMul() {
      return G.Game.enemyTimeScale * (1 - (this.slowTimer > 0 ? this.slowAmount : 0));
    }

    hitTest(x, y, r) {
      if (this.def.hitTest) return this.def.hitTest(this, x, y, r);
      return U.circleHit(x, y, r, this.x, this.y, this.r);
    }

    applySlow(amount) {
      if (this.isBoss) amount *= 0.4;
      this.slowAmount = Math.max(this.slowAmount, amount);
      this.slowTimer = 1.2;
    }

    // Возвращает true, если урон поглотил щит (пуля не пробивает дальше).
    damage(dmg, src) {
      if (!this.alive || !this.targetable) return false;
      if (this.def.onDamage) {
        const r = this.def.onDamage(this, dmg, src);
        if (r === 'immune') {
          G.Particles.spark(src.x, src.y, '#9fb4d0', 2, 100, 0.15);
          return true;
        }
        if (typeof r === 'number') dmg = r;
      }
      if (this.shield > 0) {
        this.shield -= dmg;
        this.shieldHitT = 0.15;
        G.Audio.play('shieldHit', { x: this.x });
        if (this.shield <= 0) {
          this.shield = 0;
          G.Particles.shards(this.x, this.y, '#5fd4ff', 10, 200);
          G.Particles.ring(this.x, this.y, this.r * 2, '#5fd4ff', 0.3, 3);
        }
        return true;
      }
      this.hp -= dmg;
      this.hitFlash = 0.08;
      G.Game.onEnemyDamaged(this, dmg);
      if (this.hp <= 0) this.kill(src);
      else G.Audio.play('hit', { x: this.x, pitch: this.isBoss ? 0.7 : 1 });
      return false;
    }

    kill(src) {
      if (!this.alive) return;
      this.alive = false;
      if (this.def.onDeath) this.def.onDeath(this, src);
      else this.defaultExplosion();
      G.Game.onEnemyKilled(this, src);
    }

    defaultExplosion() {
      const size = this.r;
      G.Particles.explosion(this.x, this.y, size, [this.color, '#ffffff', '#ffd28a', U.mixColor(this.color, '#222233', 0.6)]);
      G.Audio.play(size > 24 ? 'explodeBig' : 'explodeSmall', { x: this.x, pitch: U.rand(0.85, 1.15) });
      if (size > 24) G.Game.shake(size * 0.25, 0.3);
    }

    // Убрать без награды (улетел за экран).
    remove() {
      this.alive = false;
      this.removed = true;
    }

    update(dt) {
      const edt = dt * this.dtMul;
      this.t += edt;
      this.stateT += edt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.shieldHitT > 0) this.shieldHitT -= dt;
      if (this.slowTimer > 0) {
        this.slowTimer -= dt;
        if (this.slowTimer <= 0) this.slowAmount = 0;
      }
      this.def.update(this, edt);
      // Цель становится уязвимой, когда видна на экране.
      if (!this.targetable && this.y > -this.r * 0.5 && this.x > -this.r && this.x < W + this.r) {
        this.targetable = true;
        this.entered = true;
      }
      if (this.entered && !this.isBoss && !this.def.persistent) {
        const m = 90 + this.r;
        if (this.y > H + m || this.y < -m - 60 || this.x < -m || this.x > W + m) this.remove();
      }
    }

    // Время до следующего выстрела с учётом сложности.
    fireReady(interval, edt) {
      this.fireT -= edt;
      if (this.fireT <= 0 && this.y > 20 && this.y < H * 0.75) {
        this.fireT = interval / this.fireMul;
        return true;
      }
      return false;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      this.def.draw(ctx, this);
      ctx.restore();
      if (this.slowTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#9fe8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r + 4, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }
      if (this.shield > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const k = this.shield / this.maxShield;
        ctx.strokeStyle = U.rgba('#5fd4ff', 0.3 + k * 0.5 + (this.shieldHitT > 0 ? 0.3 : 0));
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r + 10, 0, U.TAU);
        ctx.stroke();
        ctx.fillStyle = U.rgba('#5fd4ff', 0.08 + (this.shieldHitT > 0 ? 0.15 : 0));
        ctx.fill();
        ctx.restore();
      }
      // Полоска здоровья у крепких врагов
      if (!this.isBoss && this.maxHp >= 80 && this.hp < this.maxHp) {
        const w = this.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - w / 2, this.y - this.r - 12, w, 4);
        ctx.fillStyle = this.isMini ? '#ffb02e' : '#ff3d6b';
        ctx.fillRect(this.x - w / 2, this.y - this.r - 12, w * (this.hp / this.maxHp), 4);
      }
    }
  }

  // ========== Общие помощники отрисовки ==========
  function bodyFill(ctx, e, base) {
    if (e.hitFlash > 0) return '#ffffff';
    return base;
  }
  function glowCore(ctx, x, y, color, r, a) {
    ctx.globalCompositeOperation = 'lighter';
    U.drawGlow(ctx, x, y, color, r, a === undefined ? 0.8 : a);
    ctx.globalCompositeOperation = 'source-over';
  }
  function eye(ctx, x, y, r, color, t) {
    ctx.fillStyle = '#05060f';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.5 + Math.sin(t * 6) * 0.1), 0, U.TAU);
    ctx.fill();
  }
  function hull(ctx, e, pts, color, scale) {
    ctx.fillStyle = bodyFill(ctx, e, color);
    U.shape(ctx, pts, scale, scale);
    ctx.fill();
    ctx.strokeStyle = U.mixColor(color, '#ffffff', 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Траектории движения для простых врагов.
  // Направление по горизонтали: явное или «к центру» от точки появления.
  function sideDir(e) {
    if (!e.dir) e.dir = (e.baseX !== undefined ? e.baseX : e.x) < W / 2 ? 1 : -1;
    return e.dir;
  }

  const PATHS = {
    straight(e, dt, sp) {
      e.y += sp * dt;
    },
    sine(e, dt, sp) {
      e.y += sp * dt;
      e.x = e.baseX + Math.sin(e.t * 2.6 + e.phase) * 70;
    },
    zig(e, dt, sp) {
      e.y += sp * dt;
      const k = (e.t * 0.9 + e.phase) % 2;
      e.x = e.baseX + (k < 1 ? k : 2 - k) * 140 - 70;
    },
    swoop(e, dt, sp) {
      // Влетает, делает петлю и уходит в сторону.
      if (e.t < 1.2) e.y += sp * 1.3 * dt;
      else {
        const a = (e.t - 1.2) * 2.4 * sideDir(e);
        e.x += Math.cos(a + DOWN) * sp * 1.4 * dt;
        e.y += Math.sin(a + DOWN) * sp * 1.4 * dt;
      }
    },
    cross(e, dt, sp) {
      e.x += sideDir(e) * sp * 1.2 * dt;
      e.y += sp * 0.55 * dt;
    },
  };

  // ========== Каталог врагов ==========
  const DEFS = {};

  // ---------- Дрон ----------
  DEFS.drone = {
    name: 'Дрон',
    hp: 14,
    r: 15,
    score: 100,
    color: '#ff5d73',
    init(e) {
      e.baseX = e.x;
      e.phase = e.opts.idx * 0.6 || 0;
      e.dir = e.x < W / 2 ? 1 : -1;
      e.path = e.opts.path || 'straight';
      e.speed = 150;
      e.willFire = Math.random() < 0.25 * G.Game.fireMul;
    },
    update(e, dt) {
      (PATHS[e.path] || PATHS.straight)(e, dt, e.speed);
      if (e.willFire && e.y > 180) {
        e.willFire = false;
        G.Patterns.aimed(e.x, e.y + 10, 230, { color: '#ff7a8a', r: 5 });
        G.Audio.play('enemyShoot', { x: e.x });
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 30, 0.4);
      ctx.rotate(Math.sin(e.t * 4) * 0.15);
      hull(ctx, e, [0, 16, 14, -2, 9, -14, 0, -8, -9, -14, -14, -2], '#8a1f33', 1);
      eye(ctx, 0, 0, 5, e.color, e.t);
    },
  };

  // ---------- Дротик ----------
  DEFS.dart = {
    name: 'Дротик',
    hp: 10,
    r: 13,
    score: 120,
    color: '#ffb02e',
    init(e) {
      e.state = 0;
      const p = G.Game.player;
      if (e.opts.side) {
        e.x = e.opts.side < 0 ? -20 : W + 20;
        e.y = U.rand(80, 280);
      }
      e.targetX = p ? p.x : W / 2;
      e.targetY = p ? p.y : H;
    },
    update(e, dt) {
      if (e.state === 0) {
        // Короткая пауза-прицеливание
        const tx = e.opts.side ? (e.opts.side < 0 ? 80 : W - 80) : e.x;
        e.x = U.damp(e.x, tx, 4, dt);
        e.y = U.damp(e.y, Math.max(e.y, 120), 4, dt);
        if (e.y < 120 && !e.opts.side) e.y += 260 * dt;
        if (e.stateT > 0.7) {
          const p = G.Game.player;
          const a = p ? U.angleTo(e.x, e.y, p.x, p.y) : DOWN;
          e.angle = a;
          e.vx = Math.cos(a) * 120;
          e.vy = Math.sin(a) * 120;
          e.state = 1;
          e.stateT = 0;
        } else {
          const p = G.Game.player;
          if (p) e.angle = U.angleTo(e.x, e.y, p.x, p.y);
        }
      } else {
        const sp = Math.min(620, 120 + e.stateT * 900);
        e.vx = Math.cos(e.angle) * sp;
        e.vy = Math.sin(e.angle) * sp;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (Math.random() < 0.5) G.Particles.trail(e.x - Math.cos(e.angle) * 12, e.y - Math.sin(e.angle) * 12, e.color, 3, 0.2);
      }
    },
    draw(ctx, e) {
      ctx.rotate(e.angle - DOWN);
      glowCore(ctx, 0, -10, e.color, 18, 0.6);
      hull(ctx, e, [0, 18, 7, -6, 3, -14, -3, -14, -7, -6], '#7a4a0a', 1);
      ctx.fillStyle = e.color;
      ctx.fillRect(-2, -4, 4, 10);
    },
  };

  // ---------- Ткач ----------
  DEFS.weaver = {
    name: 'Ткач',
    hp: 22,
    r: 16,
    score: 150,
    color: '#3fa9ff',
    init(e) {
      e.baseX = e.x;
      e.phase = (e.opts.idx || 0) * 0.8;
      e.path = e.opts.path || 'sine';
    },
    update(e, dt) {
      (PATHS[e.path] || PATHS.straight)(e, dt, 105);
      if (e.fireReady(1.8, dt)) {
        G.Patterns.aimed(e.x, e.y + 12, 210, { color: '#7fc8ff', r: 5 });
        G.Audio.play('enemyShoot', { x: e.x });
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 34, 0.35);
      const wing = Math.sin(e.t * 8) * 3;
      ctx.fillStyle = bodyFill(ctx, e, '#123a6a');
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(16 + wing, -4);
      ctx.lineTo(8, -12);
      ctx.lineTo(0, -6);
      ctx.lineTo(-8, -12);
      ctx.lineTo(-16 - wing, -4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      eye(ctx, 0, 0, 4.5, e.color, e.t);
    },
  };

  // ---------- Стрелок ----------
  DEFS.gunner = {
    name: 'Стрелок',
    hp: 60,
    r: 20,
    score: 300,
    color: '#ff4fd8',
    init(e) {
      e.stopY = e.opts.stopY || U.rand(110, 260);
      e.burst = 0;
    },
    update(e, dt) {
      if (e.state === 0) {
        e.y = U.damp(e.y, e.stopY, 2.5, dt);
        if (e.y < e.stopY - 120) e.y += 200 * dt;
        if (Math.abs(e.y - e.stopY) < 6) {
          e.state = 1;
          e.stateT = 0;
        }
      } else if (e.state === 1) {
        e.x += Math.sin(e.t * 1.3) * 30 * dt;
        if (e.fireReady(1.3, dt)) e.burst = 3;
        if (e.burst > 0 && e.stateT % 0.12 < dt) {
          e.burst--;
          G.Patterns.fanAimed(e.x, e.y + 16, 3, 0.35, 260, { color: '#ff8ae8', r: 5, shape: 'needle' });
          G.Audio.play('enemyShoot', { x: e.x, pitch: 1.2 });
        }
        if (e.stateT > 5.5) {
          e.state = 2;
          e.stateT = 0;
        }
      } else {
        e.y -= 160 * dt * Math.min(1, e.stateT);
        if (e.y < -60) e.remove();
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 40, 0.35);
      hull(ctx, e, [0, 20, 12, 12, 22, 14, 18, -6, 8, -16, -8, -16, -18, -6, -22, 14, -12, 12], '#5a1a4f', 1);
      ctx.fillStyle = '#2a0a26';
      ctx.fillRect(-4, 10, 8, 14);
      ctx.fillStyle = e.color;
      ctx.fillRect(-2, 18, 4, 6);
      eye(ctx, 0, -2, 6, e.color, e.t);
    },
  };

  // ---------- Камикадзе ----------
  DEFS.kamikaze = {
    name: 'Камикадзе',
    hp: 16,
    r: 14,
    score: 180,
    color: '#ff3d3d',
    init(e) {
      e.angle = DOWN;
      e.speed = 90;
    },
    update(e, dt) {
      const p = G.Game.player;
      if (p && p.alive && e.t < 4) {
        const want = U.angleTo(e.x, e.y, p.x, p.y);
        e.angle = U.rotateToward(e.angle, want, 2.4 * dt);
      }
      e.speed = Math.min(360, e.speed + 120 * dt);
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
      if (Math.random() < 0.6) G.Particles.trail(e.x, e.y, '#ff7a3d', 3, 0.25);
    },
    onDeath(e) {
      e.defaultExplosion();
      // Детонация — небольшое кольцо осколков.
      if (G.Game.level >= 2) G.Patterns.ring(e.x, e.y, 6, 150, e.t, { color: '#ff9a6b', r: 4 });
    },
    draw(ctx, e) {
      const blink = Math.sin(e.t * (8 + e.t * 6)) > 0;
      glowCore(ctx, 0, 0, blink ? '#ffffff' : e.color, 32, 0.6);
      ctx.rotate(e.angle - DOWN);
      hull(ctx, e, [0, 16, 10, 0, 6, -12, -6, -12, -10, 0], '#6a0a0a', 1);
      ctx.fillStyle = blink ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, U.TAU);
      ctx.fill();
    },
  };

  // ---------- Бронеход ----------
  DEFS.tank = {
    name: 'Бронеход',
    hp: 220,
    r: 32,
    score: 800,
    color: '#ffb02e',
    mass: 4,
    init(e) {
      e.turret = DOWN;
      e.stopY = U.rand(140, 220);
    },
    update(e, dt) {
      if (e.y < e.stopY) e.y += 70 * dt;
      else e.y += 14 * dt;
      e.x += Math.sin(e.t * 0.7) * 20 * dt;
      const p = G.Game.player;
      if (p) e.turret = U.rotateToward(e.turret, U.angleTo(e.x, e.y, p.x, p.y), 1.5 * dt);
      if (e.fireReady(2.1, dt)) {
        G.Patterns.fan(e.x + Math.cos(e.turret) * 26, e.y + Math.sin(e.turret) * 26, 5, 0.7, e.turret, 200, { color: '#ffcf6b', r: 6 });
        G.Audio.play('shootHeavy', { x: e.x });
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 60, 0.25);
      hull(ctx, e, [0, 30, 22, 24, 34, 6, 30, -22, 12, -32, -12, -32, -30, -22, -34, 6, -22, 24], '#4a3410', 1);
      ctx.strokeStyle = '#8a6420';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 10, -24);
        ctx.lineTo(i * 10, 20);
        ctx.stroke();
      }
      ctx.save();
      ctx.rotate(e.turret - DOWN);
      ctx.fillStyle = bodyFill(ctx, e, '#6a4a14');
      ctx.fillRect(-5, 0, 10, 30);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, U.TAU);
      ctx.fill();
      ctx.restore();
      eye(ctx, 0, 0, 6, e.color, e.t);
    },
  };

  // ---------- Делитель и осколки ----------
  DEFS.splitter = {
    name: 'Делитель',
    hp: 70,
    r: 24,
    score: 350,
    color: '#7dff5a',
    init(e) {
      e.baseX = e.x;
      e.phase = Math.random() * 6;
    },
    update(e, dt) {
      e.y += 70 * dt;
      e.x = e.baseX + Math.sin(e.t * 1.5 + e.phase) * 40;
      if (e.fireReady(2.4, dt)) {
        G.Patterns.ring(e.x, e.y, 8, 140, e.t, { color: '#b6ff9a', r: 5 });
        G.Audio.play('enemyShoot', { x: e.x, pitch: 0.8 });
      }
    },
    onDeath(e) {
      e.defaultExplosion();
      for (let i = 0; i < 3; i++) {
        const a = -PI / 2 + (i - 1) * 0.9 + PI;
        G.Enemies.spawn('shard', e.x, e.y, { angle: a + U.rand(-0.2, 0.2), noDrop: i > 0 });
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 46, 0.35);
      ctx.rotate(e.t * 0.8);
      ctx.fillStyle = bodyFill(ctx, e, '#1f5a14');
      U.polygon(ctx, 0, 0, 24, 3, 0);
      ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.rotate(PI);
      ctx.globalAlpha = 0.6;
      U.polygon(ctx, 0, 0, 16, 3, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
      eye(ctx, 0, 0, 6, e.color, e.t);
    },
  };

  DEFS.shard = {
    name: 'Осколок',
    hp: 10,
    r: 11,
    score: 60,
    color: '#b6ff9a',
    init(e) {
      e.angle = e.opts.angle === undefined ? DOWN : e.opts.angle;
      e.speed = 260;
      e.targetable = true;
      e.entered = true;
    },
    update(e, dt) {
      e.speed = Math.max(120, e.speed - 200 * dt);
      e.angle = U.rotateToward(e.angle, DOWN, 1.2 * dt);
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    },
    draw(ctx, e) {
      ctx.rotate(e.t * 4);
      ctx.fillStyle = bodyFill(ctx, e, '#3a8a2a');
      U.polygon(ctx, 0, 0, 11, 3, 0);
      ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    },
  };

  // ---------- Вертушка ----------
  DEFS.turret = {
    name: 'Вертушка',
    hp: 140,
    r: 26,
    score: 600,
    color: '#c46bff',
    mass: 3,
    init(e) {
      e.stopY = U.rand(150, 280);
      e.spin = { angle: 0 };
      e.spinDir = Math.random() < 0.5 ? 1 : -1;
    },
    update(e, dt) {
      if (e.state === 0) {
        e.y = U.damp(e.y, e.stopY, 2, dt);
        if (e.y < e.stopY - 150) e.y += 220 * dt;
        if (e.stateT > 1.6) {
          e.state = 1;
          e.stateT = 0;
        }
      } else if (e.state === 1) {
        e.spin.angle += 2.2 * e.spinDir * dt;
        if (e.fireReady(0.16, dt)) {
          G.Patterns.spiral(e.spin, e.x, e.y, 3, 150, { color: '#dcaaff', r: 5 });
        }
        if (e.stateT > 6) {
          e.state = 2;
          e.stateT = 0;
        }
      } else {
        e.y += 120 * dt * Math.min(1, e.stateT);
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 54, 0.35);
      ctx.save();
      ctx.rotate(e.spin.angle);
      ctx.fillStyle = bodyFill(ctx, e, '#3a1a5a');
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i / 3) * U.TAU);
        ctx.fillRect(-5, 8, 10, 22);
        ctx.restore();
      }
      ctx.restore();
      ctx.fillStyle = bodyFill(ctx, e, '#5a2a8a');
      U.polygon(ctx, 0, 0, 20, 8, e.t);
      ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      eye(ctx, 0, 0, 8, e.color, e.t);
    },
  };

  // ---------- Снайпер ----------
  DEFS.sniper = {
    name: 'Снайпер',
    hp: 50,
    r: 18,
    score: 400,
    color: '#ff3d6b',
    init(e) {
      e.stopY = U.rand(70, 160);
      e.shots = 0;
      e.aim = DOWN;
    },
    update(e, dt) {
      const p = G.Game.player;
      if (e.state === 0) {
        e.y = U.damp(e.y, e.stopY, 3, dt);
        if (e.y < e.stopY - 100) e.y += 200 * dt;
        if (e.stateT > 1) {
          e.state = 1;
          e.stateT = 0;
        }
      } else if (e.state === 1) {
        if (p) e.aim = U.angleTo(e.x, e.y, p.x, p.y);
        if (e.stateT > 0.6) {
          G.Patterns.laser({ x: e.x, y: e.y, angle: e.aim, width: 10, warn: 0.75, active: 0.22, color: '#ff3d6b', owner: e });
          G.Audio.play('charge', { x: e.x });
          e.state = 2;
          e.stateT = 0;
        }
      } else if (e.state === 2) {
        if (e.stateT > 1.5) {
          e.shots++;
          e.state = e.shots >= 3 ? 3 : 1;
          e.stateT = 0;
          if (e.state === 1) e.x = U.clamp(e.x + U.rand(-120, 120), 40, W - 40);
        }
      } else {
        e.y -= 180 * dt;
        if (e.y < -50) e.remove();
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 36, 0.35);
      ctx.save();
      ctx.rotate(e.aim - DOWN);
      ctx.fillStyle = '#3a0a16';
      ctx.fillRect(-2.5, 0, 5, 34);
      ctx.restore();
      hull(ctx, e, [0, 14, 18, 0, 10, -14, -10, -14, -18, 0], '#6a1426', 1);
      const charging = e.state === 2 && e.stateT < 0.75;
      eye(ctx, 0, 0, 6, charging ? '#ffffff' : e.color, e.t * 3);
    },
  };

  // ---------- Минёр и мины ----------
  DEFS.miner = {
    name: 'Минёр',
    hp: 80,
    r: 22,
    score: 450,
    color: '#ffe24f',
    init(e) {
      const side = e.opts.side || (e.x < W / 2 ? -1 : 1);
      e.dir = -side;
      e.x = side < 0 ? -30 : W + 30;
      e.y = U.rand(120, 320);
      e.targetable = false;
    },
    update(e, dt) {
      e.x += e.dir * 110 * dt;
      e.y += Math.sin(e.t * 2) * 20 * dt;
      if (e.fireReady(0.75, dt) && e.x > 20 && e.x < W - 20) {
        G.Enemies.spawn('mine', e.x, e.y + 10, { noDrop: true });
        G.Audio.play('spawn', { x: e.x });
      }
      if ((e.dir > 0 && e.x > W + 40) || (e.dir < 0 && e.x < -40)) e.remove();
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 40, 0.3);
      ctx.scale(e.dir, 1);
      hull(ctx, e, [24, 0, 10, 14, -20, 12, -24, 0, -20, -12, 10, -14], '#5a4a0a', 1);
      ctx.fillStyle = '#2a2206';
      ctx.fillRect(-8, 8, 16, 8);
      eye(ctx, 10, 0, 5, e.color, e.t);
    },
  };

  DEFS.mine = {
    name: 'Мина',
    hp: 8,
    r: 12,
    score: 50,
    color: '#ffe24f',
    contact: true,
    init(e) {
      e.fuse = 3.2;
      e.armed = false;
    },
    update(e, dt) {
      e.y += 30 * dt;
      const p = G.Game.player;
      if (!e.armed && (e.t > e.fuse || (p && U.dist(e.x, e.y, p.x, p.y) < 100))) {
        e.armed = true;
        e.stateT = 0;
      }
      if (e.armed && e.stateT > 0.6) {
        G.Patterns.ring(e.x, e.y, 10, 170, Math.random(), { color: '#fff08a', r: 5 });
        G.Particles.explosion(e.x, e.y, 14, ['#ffe24f', '#ffffff']);
        G.Audio.play('explodeSmall', { x: e.x });
        e.remove();
      }
    },
    draw(ctx, e) {
      const blink = e.armed ? Math.sin(e.stateT * 40) > 0 : Math.sin(e.t * 6) > 0.6;
      glowCore(ctx, 0, 0, blink ? '#ffffff' : e.color, 26, 0.5);
      ctx.fillStyle = bodyFill(ctx, e, '#4a3a06');
      U.star(ctx, 0, 0, 12, 7, 6, e.t);
      ctx.fill();
      ctx.fillStyle = blink ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, U.TAU);
      ctx.fill();
    },
  };

  // ---------- Щитоносец ----------
  DEFS.shielder = {
    name: 'Щитоносец',
    hp: 90,
    r: 24,
    score: 550,
    color: '#5fd4ff',
    init(e) {
      e.maxShield = 70 * (G.Game.hpMul || 1);
      e.shield = e.maxShield;
      e.stopY = U.rand(130, 230);
      e.regen = 0;
      e.lastShield = e.shield;
    },
    update(e, dt) {
      if (e.y < e.stopY) e.y += 120 * dt;
      else e.y += 10 * dt;
      e.x += Math.cos(e.t * 0.9) * 50 * dt;
      e.x = U.clamp(e.x, 40, W - 40);
      if (e.shield < e.lastShield) e.regen = 0;
      e.lastShield = e.shield;
      e.regen += dt;
      if (e.regen > 3.5 && e.shield < e.maxShield) {
        e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.5 * dt);
        e.lastShield = e.shield;
      }
      if (e.fireReady(2.6, dt)) {
        G.Patterns.ringWithGap(e.x, e.y, 14, 150, 0.0, { color: '#9fe8ff', r: 5 });
        G.Audio.play('enemyShoot', { x: e.x, pitch: 0.7 });
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 44, 0.3);
      hull(ctx, e, [0, 24, 20, 12, 24, -10, 10, -22, -10, -22, -24, -10, -20, 12], '#123a4a', 1);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, U.TAU);
      ctx.stroke();
      eye(ctx, 0, 0, 6, e.color, e.t);
    },
  };

  // ---------- Рой ----------
  DEFS.swarm = {
    name: 'Нанодрон',
    hp: 4,
    r: 8,
    score: 40,
    color: '#ffe24f',
    init(e) {
      e.phase = Math.random() * U.TAU;
      e.angle = DOWN;
      e.speed = 170 + Math.random() * 40;
      e.life = 7 + Math.random() * 2;
    },
    update(e, dt) {
      const p = G.Game.player;
      let want = DOWN;
      if (p && e.t < e.life) want = U.angleTo(e.x, e.y, p.x, p.y) + Math.sin(e.t * 5 + e.phase) * 0.9;
      e.angle = U.rotateToward(e.angle, want, 3 * dt);
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 16, 0.5);
      ctx.rotate(e.angle);
      ctx.fillStyle = bodyFill(ctx, e, '#8a7a0a');
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5, 0, 0, U.TAU);
      ctx.fill();
      const flap = Math.sin(e.t * 50) * 3;
      ctx.fillStyle = U.rgba('#ffffff', 0.6);
      ctx.beginPath();
      ctx.ellipse(-1, -5 - flap, 4, 2, 0, 0, U.TAU);
      ctx.ellipse(-1, 5 + flap, 4, 2, 0, 0, U.TAU);
      ctx.fill();
    },
  };

  // ---------- Фазер ----------
  DEFS.phaser = {
    name: 'Фазер',
    hp: 70,
    r: 20,
    score: 500,
    color: '#b56bff',
    init(e) {
      e.jumps = 0;
      e.alpha = 0;
      e.y = U.rand(80, 300);
      e.x = U.rand(60, W - 60);
      e.targetable = false;
    },
    update(e, dt) {
      // 0: проявление, 1: атака, 2: исчезновение
      if (e.state === 0) {
        e.alpha = Math.min(1, e.stateT / 0.5);
        e.targetable = e.alpha > 0.5;
        if (e.stateT > 0.6) {
          e.state = 1;
          e.stateT = 0;
          G.Patterns.ring(e.x, e.y, 12 + G.Game.level, 150, e.t, { color: '#dcaaff', r: 5 });
          G.Patterns.aimed(e.x, e.y, 260, { color: '#ffffff', r: 6, shape: 'star' });
          G.Audio.play('teleport', { x: e.x });
        }
      } else if (e.state === 1) {
        if (e.stateT > 1.4) {
          e.state = 2;
          e.stateT = 0;
        }
      } else {
        e.alpha = Math.max(0, 1 - e.stateT / 0.35);
        e.targetable = e.alpha > 0.5;
        if (e.stateT > 0.4) {
          e.jumps++;
          if (e.jumps >= 4) {
            e.remove();
            return;
          }
          G.Particles.spark(e.x, e.y, e.color, 8, 150, 0.3);
          e.x = U.rand(60, W - 60);
          e.y = U.rand(80, 380);
          e.state = 0;
          e.stateT = 0;
        }
      }
    },
    draw(ctx, e) {
      ctx.globalAlpha = e.alpha;
      glowCore(ctx, 0, 0, e.color, 48, 0.5);
      ctx.rotate(e.t * 2);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      U.polygon(ctx, 0, 0, 22, 4, 0);
      ctx.stroke();
      ctx.rotate(-e.t * 4);
      ctx.fillStyle = bodyFill(ctx, e, '#3a1a5a');
      U.polygon(ctx, 0, 0, 15, 4, PI / 4);
      ctx.fill();
      ctx.stroke();
      eye(ctx, 0, 0, 5, '#ffffff', e.t);
      ctx.globalAlpha = 1;
    },
  };

  // ---------- Носитель ----------
  DEFS.carrier = {
    name: 'Носитель',
    hp: 380,
    r: 42,
    score: 1500,
    color: '#ff9d2e',
    mass: 8,
    init(e) {
      e.stopY = 150;
      e.spawnT = 1;
    },
    update(e, dt) {
      if (e.y < e.stopY) e.y += 60 * dt;
      else e.y += 9 * dt;
      e.x += Math.sin(e.t * 0.5) * 25 * dt;
      e.spawnT -= dt;
      if (e.spawnT <= 0 && e.y > 40) {
        e.spawnT = 2.6 / G.Game.fireMul;
        const type = G.Game.level >= 4 ? 'swarm' : 'drone';
        const n = type === 'swarm' ? 4 : 2;
        for (let i = 0; i < n; i++) {
          G.Enemies.spawn(type, e.x + (i - (n - 1) / 2) * 24, e.y + 30, { noDrop: true, path: 'sine', idx: i });
        }
        G.Audio.play('spawn', { x: e.x });
      }
      if (e.fireReady(2.2, dt)) {
        G.Patterns.fan(e.x, e.y + 40, 7, 1.1, DOWN, 170, { color: '#ffc27a', r: 6 });
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 80, 0.25);
      hull(ctx, e, [0, 42, 28, 30, 44, 0, 36, -30, 14, -40, -14, -40, -36, -30, -44, 0, -28, 30], '#4a2a0a', 1);
      ctx.fillStyle = '#1a0e04';
      ctx.fillRect(-18, 18, 36, 18);
      const open = (Math.sin(e.t * 3) + 1) / 2;
      ctx.fillStyle = U.rgba(e.color, 0.4 + open * 0.6);
      ctx.fillRect(-14, 22, 28, 10);
      eye(ctx, -16, -12, 6, e.color, e.t);
      eye(ctx, 16, -12, 6, e.color, e.t + 1);
    },
  };

  // ---------- Сфера-попрыгунья ----------
  DEFS.orb = {
    name: 'Сфера',
    hp: 40,
    r: 18,
    score: 250,
    color: '#33e1ff',
    init(e) {
      const a = DOWN + U.rand(-0.7, 0.7);
      e.vx = Math.cos(a) * 190;
      e.vy = Math.sin(a) * 190;
      e.bounces = 0;
    },
    update(e, dt) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      let bounced = false;
      if (e.x < e.r && e.vx < 0) {
        e.vx = -e.vx;
        bounced = true;
      }
      if (e.x > W - e.r && e.vx > 0) {
        e.vx = -e.vx;
        bounced = true;
      }
      if (e.t < 8) {
        if (e.y > H * 0.7 && e.vy > 0) {
          e.vy = -e.vy;
          bounced = true;
        }
        if (e.y < 40 && e.vy < 0 && e.entered) {
          e.vy = -e.vy;
          bounced = true;
        }
      }
      if (bounced) {
        e.bounces++;
        G.Particles.ring(e.x, e.y, 26, e.color, 0.25, 2);
        if (e.y > 0) G.Patterns.fanAimed(e.x, e.y, 3, 0.4, 200, { color: '#9ff0ff', r: 4 });
      }
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 44, 0.5);
      const grd = ctx.createRadialGradient(-5, -5, 2, 0, 0, e.r);
      grd.addColorStop(0, e.hitFlash > 0 ? '#ffffff' : '#c8f8ff');
      grd.addColorStop(1, '#0a4a6a');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.r, e.r * 0.35, e.t * 2, 0, U.TAU);
      ctx.stroke();
    },
  };

  // ========== Мини-боссы ==========
  DEFS.warden = {
    name: 'Надзиратель',
    hp: 900,
    r: 46,
    score: 6000,
    color: '#ff3d6b',
    mass: 20,
    isMini: true,
    persistent: true,
    init(e) {
      e.stopY = 170;
      e.pattern = 0;
      e.spin = { angle: 0 };
      e.patternT = 0;
      G.Game.setMiniBoss(e);
    },
    update(e, dt) {
      if (e.state === 0) {
        e.y = U.damp(e.y, e.stopY, 1.8, dt);
        if (e.y < e.stopY - 200) e.y += 200 * dt;
        if (e.stateT > 2) {
          e.state = 1;
          e.stateT = 0;
        }
        return;
      }
      e.x = W / 2 + Math.sin(e.t * 0.6) * 150;
      e.patternT += dt;
      const hpK = e.hp / e.maxHp;
      switch (e.pattern) {
        case 0:
          if (e.fireReady(0.55, dt)) {
            G.Patterns.fanAimed(e.x, e.y + 30, hpK < 0.5 ? 7 : 5, 0.8, 240, { color: '#ff7a95', r: 6, shape: 'needle' });
            G.Audio.play('enemyShoot', { x: e.x });
          }
          break;
        case 1:
          e.spin.angle += 1.7 * dt;
          if (e.fireReady(0.12, dt)) G.Patterns.spiral(e.spin, e.x, e.y, 4, 160, { color: '#ffb02e', r: 5 });
          break;
        case 2:
          if (e.fireReady(1.0, dt)) {
            G.Patterns.ringWithGap(e.x, e.y, 26, 150, 0.6, { color: '#ff3d6b', r: 6 });
            G.Audio.play('enemyShoot', { x: e.x, pitch: 0.6 });
          }
          break;
      }
      if (e.patternT > 4.5) {
        e.patternT = 0;
        e.pattern = (e.pattern + 1) % 3;
        e.fireT = 0.6;
      }
    },
    onDeath(e) {
      G.Game.bigExplosion(e.x, e.y, e.r, [e.color, '#ffffff', '#ffb02e']);
      G.Game.setMiniBoss(null);
      G.Powerups.spawn('weapon', e.x - 30, e.y);
      G.Powerups.spawn('heal', e.x + 30, e.y);
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 110, 0.3);
      ctx.save();
      ctx.rotate(e.t * 0.5);
      ctx.strokeStyle = U.rgba(e.color, 0.5);
      ctx.lineWidth = 2;
      U.polygon(ctx, 0, 0, 58, 6, 0);
      ctx.stroke();
      ctx.restore();
      hull(ctx, e, [0, 46, 30, 34, 50, 6, 40, -26, 18, -40, -18, -40, -40, -26, -50, 6, -30, 34], '#5a0a1e', 1);
      ctx.fillStyle = '#2a0610';
      ctx.fillRect(-24, 22, 10, 20);
      ctx.fillRect(14, 22, 10, 20);
      eye(ctx, 0, 0, 14, e.color, e.t);
    },
  };

  DEFS.prism = {
    name: 'Призма',
    hp: 1100,
    r: 40,
    score: 8000,
    color: '#6bffe8',
    mass: 20,
    isMini: true,
    persistent: true,
    init(e) {
      e.stopY = 220;
      e.rot = 0;
      e.cycle = 0;
      G.Game.setMiniBoss(e);
    },
    update(e, dt) {
      if (e.state === 0) {
        e.y = U.damp(e.y, e.stopY, 1.8, dt);
        if (e.y < e.stopY - 200) e.y += 200 * dt;
        if (e.stateT > 2) {
          e.state = 1;
          e.stateT = 0;
        }
        return;
      }
      e.rot += dt * 0.6;
      e.x = W / 2 + Math.sin(e.t * 0.4) * 100;
      if (e.state === 1) {
        // Залп из вершин
        if (e.fireReady(0.35, dt)) {
          for (let i = 0; i < 4; i++) {
            const a = e.rot + (i / 4) * U.TAU;
            G.Patterns.fire(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, a, 180, { color: '#b6fff4', r: 5, shape: 'star' });
          }
        }
        if (e.stateT > 4) {
          e.state = 2;
          e.stateT = 0;
          for (let i = 0; i < 4; i++) {
            G.Patterns.laser({ x: e.x, y: e.y, angle: e.rot + (i / 4) * U.TAU + PI / 4, width: 16, warn: 1.1, active: 1.6, spin: 0.55, color: '#6bffe8', owner: e });
          }
          G.Audio.play('charge', { x: e.x });
        }
      } else if (e.state === 2) {
        if (e.stateT > 3) {
          e.state = 3;
          e.stateT = 0;
        }
      } else {
        if (e.fireReady(0.9, dt)) {
          G.Patterns.flower(e.x, e.y, 10, 2, 120, { color: '#6bffe8', r: 5 });
          G.Audio.play('enemyShoot', { x: e.x });
        }
        if (e.stateT > 3.5) {
          e.state = 1;
          e.stateT = 0;
        }
      }
    },
    onDeath(e) {
      G.Game.bigExplosion(e.x, e.y, e.r, [e.color, '#ffffff', '#c46bff']);
      G.Game.setMiniBoss(null);
      G.Powerups.spawn('weapon', e.x - 30, e.y);
      G.Powerups.spawn('bomb', e.x + 30, e.y);
    },
    draw(ctx, e) {
      glowCore(ctx, 0, 0, e.color, 100, 0.4);
      ctx.rotate(e.rot || 0);
      const grd = ctx.createLinearGradient(-40, -40, 40, 40);
      grd.addColorStop(0, e.hitFlash > 0 ? '#ffffff' : '#c8fff6');
      grd.addColorStop(0.5, '#1aa3a3');
      grd.addColorStop(1, '#0a3a4a');
      ctx.fillStyle = grd;
      U.polygon(ctx, 0, 0, 42, 4, 0);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', 0.4);
      ctx.beginPath();
      ctx.moveTo(-42, 0);
      ctx.lineTo(42, 0);
      ctx.moveTo(0, -42);
      ctx.lineTo(0, 42);
      ctx.stroke();
      eye(ctx, 0, 0, 10, '#ffffff', e.t);
    },
  };

  // ========== Фабрика ==========
  G.Enemies = {
    DEFS,
    PATHS,
    Enemy,
    hull,
    eye,
    glowCore,
    bodyFill,
    spawn(type, x, y, opts) {
      const def = DEFS[type];
      if (!def) {
        console.warn('[enemies] неизвестный тип', type);
        return null;
      }
      const e = new Enemy(type, def, x, y, opts);
      G.Game.enemies.push(e);
      return e;
    },
    register(type, def) {
      DEFS[type] = def;
    },
  };
})();
