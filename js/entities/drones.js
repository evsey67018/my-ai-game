/* My AI Arcade — боевые дроны игрока и особые эффекты (сингулярность, ударная волна бомбы). */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  // Слоты дронов относительно корабля.
  const SLOTS = [
    { x: -42, y: 18 },
    { x: 42, y: 18 },
    { x: -70, y: 40 },
    { x: 70, y: 40 },
  ];

  class Drone {
    constructor(owner, index) {
      this.owner = owner;
      this.index = index;
      this.x = owner.x;
      this.y = owner.y + 30;
      this.fireTimer = Math.random() * 0.3;
      this.t = Math.random() * 10;
      this.angle = -Math.PI / 2;
      this.alive = true;
    }

    update(dt) {
      this.t += dt;
      const slot = SLOTS[this.index % SLOTS.length];
      const bob = Math.sin(this.t * 3 + this.index) * 4;
      const tx = this.owner.x + slot.x;
      const ty = this.owner.y + slot.y + bob;
      // Дрон догоняет слот с инерцией — красиво «тянется» за кораблём.
      this.x = U.damp(this.x, tx, 9, dt);
      this.y = U.damp(this.y, ty, 9, dt);

      const target = G.Bullets.findTarget(this.x, this.y, 520);
      let want = -Math.PI / 2;
      if (target && target.y < this.y) {
        want = U.angleTo(this.x, this.y, target.x, target.y);
        // Ограничиваем конус, чтобы дроны не стреляли назад.
        const d = U.angleDiff(-Math.PI / 2, want);
        want = -Math.PI / 2 + U.clamp(d, -0.7, 0.7);
      }
      this.angle = U.rotateToward(this.angle, want, 6 * dt);

      if (!G.Game.canFire()) return;
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        const p = this.owner;
        this.fireTimer = 1 / (4.5 * p.stats.fireRate * (p.overdriveTimer > 0 ? 2 : 1));
        G.Bullets.firePlayer({
          x: this.x + Math.cos(this.angle) * 10,
          y: this.y + Math.sin(this.angle) * 10,
          vx: Math.cos(this.angle) * 900,
          vy: Math.sin(this.angle) * 900,
          r: 3,
          dmg: 5 * p.stats.damage,
          kind: 'pulse',
          color: '#7dff5a',
          pierce: 0,
          life: 1.2,
          len: 10,
          slow: p.stats.slow,
        });
      }
    }

    explode() {
      G.Particles.explosion(this.x, this.y, 10, ['#7dff5a', '#ffffff']);
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalCompositeOperation = 'lighter';
      U.drawGlow(ctx, 0, 0, '#7dff5a', 22, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(this.angle + Math.PI / 2);
      ctx.fillStyle = '#1c3a1a';
      ctx.strokeStyle = '#7dff5a';
      ctx.lineWidth = 1.5;
      U.polygon(ctx, 0, 0, 9, 6, this.t * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#eaffdf';
      ctx.fillRect(-1.5, -12, 3, 7);
      ctx.restore();
    }
  }

  // Чёрная дыра от перка «Карманная сингулярность».
  class Singularity {
    constructor(x, y, power) {
      this.x = x;
      this.y = y;
      this.life = 3.5;
      this.maxLife = 3.5;
      this.power = power;
      this.r = 0;
      this.dead = false;
      this.tick = 0;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) {
        this.dead = true;
        G.Particles.explosion(this.x, this.y, 40, ['#c46bff', '#ffffff', '#3a1a5a']);
        G.Bullets.splash(this.x, this.y, 160, 80 * this.power);
        G.Audio.play('explodeBig', { x: this.x });
        G.Game.shake(10, 0.4);
        return;
      }
      const k = 1 - this.life / this.maxLife;
      this.r = U.lerp(this.r, 90, 1 - Math.exp(-4 * dt));
      this.tick -= dt;
      const pull = 380;
      for (const e of G.Game.enemies) {
        if (!e.alive || e.isBoss) continue;
        const d = U.dist(this.x, this.y, e.x, e.y);
        if (d < 320 && d > 1) {
          const f = (pull * (1 - d / 320) * dt) / Math.max(1, e.mass || 1);
          e.x += ((this.x - e.x) / d) * f;
          e.y += ((this.y - e.y) / d) * f;
        }
      }
      if (this.tick <= 0) {
        this.tick = 0.2;
        G.Bullets.splash(this.x, this.y, this.r, 8 * this.power);
      }
      G.Bullets.cancelEnemyBullets(this.x, this.y, 140 + k * 60, false);
      if (Math.random() < 0.8) {
        const a = Math.random() * U.TAU;
        const rr = 120 + Math.random() * 80;
        const p = G.Particles.add(1);
        if (p) {
          p.x = this.x + Math.cos(a) * rr;
          p.y = this.y + Math.sin(a) * rr;
          p.vx = -Math.cos(a) * 300 + Math.cos(a + 1.5) * 120;
          p.vy = -Math.sin(a) * 300 + Math.sin(a + 1.5) * 120;
          p.life = p.maxLife = 0.4;
          p.size = 2;
          p.color = '#c46bff';
        }
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      U.drawGlow(ctx, this.x, this.y, '#8c6bff', this.r * 2.4, 0.9);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 0.45, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = '#e6d8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 0.45 + 2, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Ударная волна бомбы — расширяющееся кольцо, уничтожающее пули.
  class Shockwave {
    constructor(x, y, maxR, dmg, color) {
      this.x = x;
      this.y = y;
      this.r = 10;
      this.maxR = maxR;
      this.dmg = dmg;
      this.color = color || '#ffffff';
      this.hit = new Set();
      this.dead = false;
      this.t = 0;
    }
    update(dt) {
      this.t += dt;
      this.r += (this.maxR - this.r) * Math.min(1, dt * 4) + 600 * dt;
      if (this.r >= this.maxR) this.dead = true;
      G.Bullets.cancelEnemyBullets(this.x, this.y, this.r, true);
      for (const e of G.Game.enemies) {
        if (!e.alive || this.hit.has(e) || !e.targetable) continue;
        if (U.dist(this.x, this.y, e.x, e.y) < this.r + e.r) {
          this.hit.add(e);
          e.damage(e.isBoss ? this.dmg * 0.35 : this.dmg, { x: this.x, y: this.y, kind: 'bomb' });
        }
      }
    }
    draw(ctx) {
      const k = 1 - this.r / this.maxR;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(this.color, Math.max(0, k));
      ctx.lineWidth = 18 * k + 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, U.TAU);
      ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', Math.max(0, k));
      ctx.lineWidth = 4 * k + 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  G.Drone = Drone;
  G.Singularity = Singularity;
  G.Shockwave = Shockwave;
})();
