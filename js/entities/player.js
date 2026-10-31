/* My AI Arcade — корабль игрока. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const W = 540;
  const H = 960;

  class Player {
    constructor(shipId) {
      this.ship = G.Data.shipById(shipId);
      this.stats = G.Data.buildBaseStats(this.ship.id);
      this.x = W / 2;
      this.y = H - 140;
      this.vx = 0;
      this.vy = 0;
      this.maxHp = this.stats.maxHp;
      this.hp = this.maxHp;
      this.maxBombs = 6;
      this.bombs = Math.min(this.maxBombs, this.stats.bombs);
      this.weapon = this.ship.weapon;
      this.weaponLevel = this.stats.startWeaponLevel;
      this.fireTimer = 0;
      this.invuln = 2;
      this.alive = true;
      this.dashCd = 0;
      this.dashTime = 0;
      this.dashDirX = 0;
      this.dashDirY = -1;
      this.dashHit = new Set();
      this.shield = this.stats.shieldTime > 0;
      this.shieldTimer = 0;
      this.drones = [];
      this.perkStacks = {};
      this.killCounter = 0;
      this.killStreak = 0;
      this.streakTimer = 0;
      this.overdriveTimer = 0;
      this.regenTimer = 0;
      this.revives = this.stats.revives;
      this.singularity = false;
      this.tilt = 0;
      this.time = 0;
      this.afterimages = [];
      this.orbitAngle = 0;
      this.orbitHits = new Map();
      this.grazeCharge = 0;
      this.hurtFlash = 0;
      this.entering = 1.2;
      this.lowHpWarn = 0;
      for (let i = 0; i < this.stats.drones; i++) this.addDrone(true);
    }

    get weaponDef() {
      return G.Data.weapons[this.weapon];
    }

    hitRadius() {
      // Маленький хитбокс — классика жанра. В режиме точности ещё меньше.
      return G.Input.down('focus') ? 4 : 6;
    }

    rageMultiplier() {
      if (!this.stats.rage) return 1;
      const missing = 1 - this.hp / this.maxHp;
      return 1 + this.stats.rage * missing;
    }

    addDrone(silent) {
      if (this.drones.length >= 4) {
        this.stats.damage *= 1.05;
        return;
      }
      const d = new G.Drone(this, this.drones.length);
      this.drones.push(d);
      if (!silent) {
        G.Particles.ring(this.x, this.y, 50, '#7dff5a', 0.4, 3);
        G.Audio.play('shieldUp');
      }
      if (G.Game.run) G.Game.run.maxDrones = Math.max(G.Game.run.maxDrones, this.drones.length);
    }

    heal(n) {
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + n);
      if (this.hp > before) {
        G.Particles.text(this.x, this.y - 30, '+' + (this.hp - before) + ' ❤', '#7dff9a', 18);
        G.Particles.ring(this.x, this.y, 46, '#7dff9a', 0.5, 3);
        G.Audio.play('heal');
      }
    }

    upgradeWeapon(n) {
      const before = this.weaponLevel;
      this.weaponLevel = Math.min(G.Data.MAX_WEAPON_LEVEL, this.weaponLevel + n);
      if (this.weaponLevel >= G.Data.MAX_WEAPON_LEVEL && G.Game.run) G.Game.run.weaponMaxed = true;
      return this.weaponLevel > before;
    }

    setWeapon(id) {
      if (id === this.weapon) {
        if (!this.upgradeWeapon(1)) {
          // Уже максимум — даём очки и мощность.
          G.Game.addScore(2500, this.x, this.y - 30);
          this.stats.damage *= 1.02;
        }
        return;
      }
      this.weapon = id;
      // При смене оружия уровень сохраняется частично, чтобы смена не наказывала.
      this.weaponLevel = Math.max(1, this.weaponLevel);
    }

    // ---------- Действия ----------
    tryDash(dx, dy) {
      if (this.dashCd > 0 || this.dashTime > 0) return;
      if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
        dx = 0;
        dy = -1;
      }
      const n = U.normalize(dx, dy);
      this.dashDirX = n.x;
      this.dashDirY = n.y;
      this.dashTime = 0.16;
      this.dashCd = this.stats.dashCooldown;
      this.invuln = Math.max(this.invuln, this.stats.dashInvuln);
      this.dashHit.clear();
      G.Audio.play('dash', { x: this.x });
      G.Particles.ring(this.x, this.y, 30, this.ship.color, 0.25, 2);
      G.Save.addStat('dashes');
    }

    useBomb() {
      if (this.bombs <= 0 || !this.alive) {
        if (this.alive) G.Audio.play('uiError');
        return false;
      }
      this.bombs--;
      this.invuln = Math.max(this.invuln, 1.6);
      G.Save.addStat('bombs');
      G.Game.onBomb(this);
      return true;
    }

    // Возвращает true, если пуля «поглощена» (исчезает).
    takeHit(src) {
      if (!this.alive) return false;
      if (this.invuln > 0 || this.dashTime > 0) return false;
      const game = G.Game;
      if (this.shield) {
        this.shield = false;
        this.shieldTimer = this.stats.shieldTime;
        this.invuln = 1;
        G.Particles.ring(this.x, this.y, 60, '#5fd4ff', 0.4, 4);
        G.Particles.shards(this.x, this.y, '#5fd4ff', 12, 200);
        G.Audio.play('shieldHit');
        G.Bullets.cancelEnemyBullets(this.x, this.y, 90);
        return true;
      }
      this.hp--;
      this.invuln = 2;
      this.hurtFlash = 0.35;
      this.killStreak = 0;
      this.regenTimer = 0;
      game.onPlayerHurt(this);
      G.Audio.play('hurt', { x: this.x });
      G.Audio.vibrate(120);
      G.Particles.explosion(this.x, this.y, 22, ['#ff3d6b', '#ffb02e', '#ffffff']);
      game.shake(12, 0.4);
      G.Background.flash('#ff0033', 0.35);
      if (this.stats.timeWarp > 0) {
        game.slowMo(this.stats.timeWarp, 0.35);
        G.Bullets.cancelEnemyBullets(this.x, this.y, 180);
      } else {
        G.Bullets.cancelEnemyBullets(this.x, this.y, 70);
      }
      if (this.stats.thorns > 0) {
        for (let i = 0; i < this.stats.thorns; i++) {
          const a = (i / this.stats.thorns) * U.TAU;
          G.Bullets.firePlayer({
            x: this.x,
            y: this.y,
            vx: Math.cos(a) * 600,
            vy: Math.sin(a) * 600,
            r: 5,
            dmg: 20 * this.stats.damage,
            kind: 'spread',
            color: '#7dff5a',
            pierce: 2,
            life: 1,
          });
        }
      }
      if (this.hp <= 0) {
        if (this.revives > 0) {
          this.revives--;
          this.hp = Math.ceil(this.maxHp / 2);
          this.invuln = 3;
          G.Bullets.cancelEnemyBullets(0, 0, Infinity, true);
          G.Particles.ring(this.x, this.y, 200, '#7dff9a', 0.8, 6);
          G.Particles.text(this.x, this.y - 40, 'РЕЗЕРВНОЕ ЯДРО!', '#7dff9a', 22, 1.6);
          G.Audio.play('heal');
        } else {
          this.die();
        }
      }
      return true;
    }

    die() {
      this.alive = false;
      G.Particles.explosion(this.x, this.y, 50, [this.ship.color, '#ffffff', '#ff3d6b']);
      G.Particles.shards(this.x, this.y, this.ship.color, 30, 380);
      G.Audio.play('explodeBig');
      G.Game.shake(20, 0.8);
      for (const d of this.drones) d.explode();
      G.Game.onPlayerDeath();
    }

    onKill(enemy) {
      this.killCounter++;
      this.killStreak++;
      this.streakTimer = 2.5;
      if (this.stats.lifesteal && this.killCounter % this.stats.lifesteal === 0) this.heal(1);
      if (this.stats.overdrive && this.killStreak > 0 && this.killStreak % this.stats.overdrive === 0) {
        this.overdriveTimer = 6;
        G.Particles.text(this.x, this.y - 50, 'ОВЕРДРАЙВ!', '#ffe24f', 22, 1.2);
        G.Audio.play('weaponUp');
      }
      if (this.stats.killChain && Math.random() < this.stats.killChain) {
        G.Bullets.chainLightning(enemy.x, enemy.y, 3, 14 * this.stats.damage, 220, '#9fd8ff');
      }
    }

    // ---------- Обновление ----------
    update(dt) {
      this.time += dt;
      if (!this.alive) return;
      const I = G.Input;

      if (this.entering > 0) {
        this.entering -= dt;
        this.y = U.lerp(this.y, H - 160, 1 - Math.exp(-5 * dt));
        I.clearDrag();
      }

      // --- Движение ---
      const ax = I.axis();
      const focus = I.down('focus');
      let speed = this.stats.speed * (focus ? 0.5 : 1);
      if (this.dashTime > 0) {
        this.dashTime -= dt;
        const ds = 1500;
        this.x += this.dashDirX * ds * dt;
        this.y += this.dashDirY * ds * dt;
        this.afterimages.push({ x: this.x, y: this.y, life: 0.25 });
        if (this.stats.dashDamage > 0) {
          for (const e of G.Game.enemies) {
            if (!e.alive || this.dashHit.has(e) || !e.targetable) continue;
            if (U.circleHit(this.x, this.y, 26, e.x, e.y, e.r)) {
              this.dashHit.add(e);
              e.damage(this.stats.dashDamage * this.stats.damage, { x: this.x, y: this.y, kind: 'dash' });
              G.Particles.spark(e.x, e.y, this.ship.color, 8, 220, 0.3);
            }
          }
        }
      } else {
        const tx = ax.x * speed;
        const ty = ax.y * speed;
        this.vx = U.damp(this.vx, tx, 18, dt);
        this.vy = U.damp(this.vy, ty, 18, dt);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.entering <= 0) {
          const drag = I.consumeDrag();
          this.x += drag.x;
          this.y += drag.y;
          if (Math.abs(drag.x) > 0.01 && dt > 0) this.vx = U.lerp(this.vx, drag.x / dt, 0.3);
        }
      }
      this.x = U.clamp(this.x, 18, W - 18);
      this.y = U.clamp(this.y, 60, H - 30);
      this.tilt = U.damp(this.tilt, U.clamp(this.vx / 400, -1, 1), 10, dt);

      if (I.pressed('dash')) {
        let dx = ax.x;
        let dy = ax.y;
        if (!dx && !dy && Math.abs(this.vx) > 40) dx = Math.sign(this.vx);
        this.tryDash(dx, dy);
      }
      if (I.pressed('bomb')) this.useBomb();

      // --- Таймеры ---
      if (this.invuln > 0) this.invuln -= dt;
      if (this.dashCd > 0) this.dashCd -= dt;
      if (this.hurtFlash > 0) this.hurtFlash -= dt;
      if (this.overdriveTimer > 0) this.overdriveTimer -= dt;
      if (this.streakTimer > 0) {
        this.streakTimer -= dt;
        if (this.streakTimer <= 0) this.killStreak = 0;
      }
      if (!this.shield && this.stats.shieldTime > 0) {
        this.shieldTimer -= dt;
        if (this.shieldTimer <= 0) {
          this.shield = true;
          G.Audio.play('shieldUp');
          G.Particles.ring(this.x, this.y, 40, '#5fd4ff', 0.4, 3);
        }
      }
      if (this.stats.regenTime > 0 && this.hp < this.maxHp) {
        this.regenTimer += dt;
        if (this.regenTimer >= this.stats.regenTime) {
          this.regenTimer = 0;
          this.heal(1);
        }
      }
      if (this.hp === 1 && this.maxHp > 1) {
        this.lowHpWarn -= dt;
        if (this.lowHpWarn <= 0) {
          this.lowHpWarn = 2.5;
          G.Audio.play('lowHp');
        }
      }

      // --- Стрельба (автоматическая) ---
      if (this.entering <= 0 && G.Game.canFire()) {
        const wd = this.weaponDef;
        let rate = wd.rate[this.weaponLevel - 1] * this.stats.fireRate;
        if (this.overdriveTimer > 0) rate *= 2;
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
          this.fireTimer += 1 / rate;
          if (this.fireTimer < -0.1) this.fireTimer = 0;
          wd.fire(this, this.weaponLevel);
          G.Audio.play(wd.sound, { x: this.x, vol: 0.8 });
        }
      }

      // --- Орбитальные лезвия ---
      if (this.stats.orbitals > 0) this.updateOrbitals(dt);

      for (const d of this.drones) d.update(dt);

      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        this.afterimages[i].life -= dt;
        if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
      }

      // Пламя двигателя
      if (Math.random() < 0.7) {
        G.Particles.trail(
          this.x + U.rand(-4, 4),
          this.y + 20,
          this.overdriveTimer > 0 ? '#ffe24f' : this.ship.color,
          U.rand(2, 4),
          0.25,
          U.rand(-20, 20),
          U.rand(180, 260)
        );
      }
    }

    orbitalPositions() {
      const n = this.stats.orbitals;
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = this.orbitAngle + (i / n) * U.TAU;
        out.push({ x: this.x + Math.cos(a) * 58, y: this.y + Math.sin(a) * 58, a });
      }
      return out;
    }

    updateOrbitals(dt) {
      this.orbitAngle += dt * 4.2;
      const blades = this.orbitalPositions();
      const now = this.time;
      for (const bl of blades) {
        for (const e of G.Game.enemies) {
          if (!e.alive || !e.targetable) continue;
          if (!U.circleHit(bl.x, bl.y, 12, e.x, e.y, e.r)) continue;
          const last = this.orbitHits.get(e) || 0;
          if (now - last < 0.2) continue;
          this.orbitHits.set(e, now);
          e.damage(10 * this.stats.damage, { x: bl.x, y: bl.y, kind: 'orbital' });
          G.Particles.spark(bl.x, bl.y, '#c46bff', 3, 140, 0.2);
        }
        for (const b of G.Bullets.enemy) {
          if (!b.dead && b.delay <= 0 && U.circleHit(bl.x, bl.y, 12, b.x, b.y, b.r)) {
            b.dead = true;
            G.Particles.dots(b.x, b.y, b.color, 2, 60, 0.3, 2);
          }
        }
      }
      if (this.orbitHits.size > 200) this.orbitHits.clear();
    }

    // ---------- Отрисовка ----------
    draw(ctx) {
      if (!this.alive) return;
      const ship = this.ship;
      for (const d of this.drones) d.draw(ctx);

      // Послеобразы рывка
      for (const a of this.afterimages) {
        ctx.save();
        ctx.globalAlpha = (a.life / 0.25) * 0.4;
        ctx.translate(a.x, a.y);
        ctx.fillStyle = ship.color;
        U.shape(ctx, ship.shape, 1, 1);
        ctx.fill();
        ctx.restore();
      }

      const blink = this.invuln > 0 && this.dashTime <= 0 && Math.floor(this.time * 20) % 2 === 0;
      ctx.save();
      ctx.translate(this.x, this.y);

      // Пламя
      const flameLen = 14 + Math.sin(this.time * 40) * 4 + (G.Input.axis().y < 0 ? 8 : 0);
      ctx.globalCompositeOperation = 'lighter';
      const fc = this.overdriveTimer > 0 ? '#ffe24f' : ship.color;
      U.drawGlow(ctx, 0, 22, fc, 26, 0.8);
      ctx.fillStyle = fc;
      ctx.beginPath();
      ctx.moveTo(-6, 16);
      ctx.lineTo(0, 16 + flameLen);
      ctx.lineTo(6, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-3, 16);
      ctx.lineTo(0, 16 + flameLen * 0.6);
      ctx.lineTo(3, 16);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      if (!blink) {
        // Корпус с наклоном (сжатие по X имитирует крен).
        ctx.save();
        ctx.scale(1 - Math.abs(this.tilt) * 0.22, 1);
        const grd = ctx.createLinearGradient(-24, 0, 24, 0);
        grd.addColorStop(0, U.mixColor(ship.color, '#000000', 0.45 + this.tilt * 0.2));
        grd.addColorStop(0.5, ship.color);
        grd.addColorStop(1, U.mixColor(ship.color, '#000000', 0.45 - this.tilt * 0.2));
        ctx.fillStyle = this.hurtFlash > 0 ? '#ffffff' : grd;
        U.shape(ctx, ship.shape, 1, 1);
        ctx.fill();
        ctx.strokeStyle = ship.accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Кабина
        ctx.fillStyle = '#0a1830';
        ctx.beginPath();
        ctx.ellipse(0, -6, 4.5, 9, 0, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = U.rgba(ship.accent, 0.8);
        ctx.beginPath();
        ctx.ellipse(-1.2, -9, 1.6, 4, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }

      // Хитбокс (виден в режиме точности)
      if (G.Input.down('focus')) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ff3d6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.hitRadius() + 1, 0, U.TAU);
        ctx.fill();
        ctx.stroke();
      }

      // Щит
      if (this.shield) {
        const pulse = 0.5 + Math.sin(this.time * 5) * 0.15;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba('#5fd4ff', pulse);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, U.TAU);
        ctx.stroke();
        ctx.fillStyle = U.rgba('#5fd4ff', 0.08);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();

      // Орбитальные лезвия
      if (this.stats.orbitals > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const bl of this.orbitalPositions()) {
          U.drawGlow(ctx, bl.x, bl.y, '#c46bff', 26, 0.8);
          ctx.save();
          ctx.translate(bl.x, bl.y);
          ctx.rotate(bl.a * 3);
          ctx.fillStyle = '#f1d9ff';
          U.star(ctx, 0, 0, 10, 3, 3, 0);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    }
  }

  G.Player = Player;
})();
