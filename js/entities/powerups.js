/* My AI Arcade — бонусы: оружие, ремонт, бомбы, щит, кристаллы и очки-«биты». */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const W = 540;
  const H = 960;

  const TYPES = {
    weapon: { r: 16, color: '#33e1ff', label: 'Оружие' },
    heal: { r: 14, color: '#7dff9a', label: 'Ремонт' },
    bomb: { r: 14, color: '#ff5d73', label: 'Бомба' },
    shield: { r: 14, color: '#5fd4ff', label: 'Щит' },
    overdrive: { r: 14, color: '#ffe24f', label: 'Овердрайв' },
    crystal: { r: 9, color: '#c46bff', label: 'Кристалл' },
    bit: { r: 5, color: '#9fd8ff', label: '' },
  };

  function makeItem() {
    return {
      type: 'bit', x: 0, y: 0, vx: 0, vy: 0, r: 5, t: 0, life: 12, value: 1,
      weaponId: null, dead: false, magnet: false, color: '#fff', spin: 0,
    };
  }

  const PU = (G.Powerups = {
    pool: new U.Pool(makeItem, 200),
    TYPES,

    get items() {
      return this.pool.items;
    },

    clear() {
      this.pool.clear();
    },

    spawn(type, x, y, opts) {
      opts = opts || {};
      const def = TYPES[type];
      const it = this.pool.get();
      it.type = type;
      it.x = x;
      it.y = y;
      it.vx = opts.vx !== undefined ? opts.vx : U.rand(-60, 60);
      it.vy = opts.vy !== undefined ? opts.vy : U.rand(-160, -80);
      it.r = def.r;
      it.t = 0;
      it.life = type === 'bit' ? 6 : type === 'crystal' ? 10 : 14;
      it.value = opts.value || 1;
      it.dead = false;
      it.magnet = !!opts.magnet;
      it.color = def.color;
      it.spin = U.rand(-3, 3);
      it.weaponId = null;
      if (type === 'weapon') {
        const p = G.Game.player;
        // Чаще выпадает текущее оружие — чтобы прокачка была ощутимой.
        if (opts.weaponId) it.weaponId = opts.weaponId;
        else if (p && Math.random() < 0.55) it.weaponId = p.weapon;
        else it.weaponId = U.pick(G.Data.weaponOrder);
        it.color = G.Data.weapons[it.weaponId].color;
      }
      return it;
    },

    spawnBit(x, y) {
      if (this.pool.count > 180) return;
      this.spawn('bit', x, y, { vx: U.rand(-40, 40), vy: U.rand(-60, 0), magnet: true });
    },

    spawnCrystals(x, y, n) {
      // Крупные кристаллы по 5, остаток — по 1.
      while (n > 0) {
        const v = n >= 5 ? 5 : 1;
        n -= v;
        const it = this.spawn('crystal', x + U.rand(-10, 10), y + U.rand(-10, 10), { value: v });
        if (v === 5) it.r = 12;
      }
    },

    // Решает, что выпадет из уничтоженного врага.
    dropFor(e) {
      if (e.noDrop) return;
      const p = G.Game.player;
      const luck = p ? p.stats.luck : 0;
      const big = e.maxHp >= 150 || e.isMini;
      // Кристаллы
      const cBase = e.isMini ? 25 : big ? 4 : Math.random() < 0.18 + luck * 0.05 ? 1 : 0;
      if (cBase > 0) this.spawnCrystals(e.x, e.y, Math.round(cBase * (p ? p.stats.crystalMul : 1)));
      if (e.isMini) return;
      // Бонусы
      const chance = (big ? 0.35 : 0.035) * (1 + luck * 0.25) * (G.Game.dropMul || 1);
      if (Math.random() < chance) {
        const weights = [
          { v: 'weapon', w: p && p.weaponLevel < G.Data.MAX_WEAPON_LEVEL ? 5 : 2.5 },
          { v: 'heal', w: p && p.hp < p.maxHp ? 2.2 : 0.4 },
          { v: 'bomb', w: p && p.bombs < p.maxBombs ? 1.6 : 0.3 },
          { v: 'shield', w: p && !p.shield ? 1.2 : 0.2 },
          { v: 'overdrive', w: 1 },
        ];
        this.spawn(U.weightedPick(weights, (o) => o.w).v, e.x, e.y);
      }
    },

    // Притянуть всё к игроку (после победы над боссом / конца сектора).
    collectAll() {
      for (const it of this.pool.items) if (!it.dead) it.magnet = true;
    },

    collect(it, p) {
      it.dead = true;
      const game = G.Game;
      switch (it.type) {
        case 'bit':
          game.addScore(10 * it.value, null, null, true);
          G.Audio.play('coin', { pitch: 1.6, vol: 0.4 });
          return;
        case 'crystal':
          game.addCrystals(it.value);
          G.Particles.text(it.x, it.y - 10, '+' + it.value + ' 💎', '#e0b8ff', 13, 0.6);
          G.Audio.play('coin', { pitch: it.value > 1 ? 0.8 : 1.1 });
          return;
      }
      game.run.powerups++;
      G.Save.addStat('powerups');
      G.Particles.ring(it.x, it.y, 40, it.color, 0.35, 3);
      game.addScore(500, it.x, it.y - 20);
      switch (it.type) {
        case 'weapon': {
          const wd = G.Data.weapons[it.weaponId];
          const same = p.weapon === it.weaponId;
          p.setWeapon(it.weaponId);
          G.Audio.play('weaponUp');
          G.Events.emit('toast', {
            text: same ? wd.short + ' — уровень ' + p.weaponLevel : 'Новое оружие: ' + wd.name,
            color: wd.color,
            icon: wd.icon,
          });
          break;
        }
        case 'heal':
          if (p.hp >= p.maxHp) game.addScore(1500, p.x, p.y - 40);
          p.heal(1);
          break;
        case 'bomb':
          if (p.bombs < p.maxBombs) {
            p.bombs++;
            G.Particles.text(p.x, p.y - 30, '+1 бомба', '#ff8a9a', 16);
          } else game.addScore(1500, p.x, p.y - 40);
          G.Audio.play('powerup');
          break;
        case 'shield':
          p.shield = true;
          G.Audio.play('shieldUp');
          G.Particles.text(p.x, p.y - 30, 'Щит!', '#9fe8ff', 16);
          break;
        case 'overdrive':
          p.overdriveTimer = Math.max(p.overdriveTimer, 7);
          G.Audio.play('powerup');
          G.Particles.text(p.x, p.y - 30, 'ОВЕРДРАЙВ!', '#ffe24f', 20);
          break;
      }
    },

    update(dt) {
      const p = G.Game.player;
      const alive = p && p.alive;
      const magR = alive ? 95 * p.stats.magnet : 0;
      for (const it of this.pool.items) {
        if (it.dead) continue;
        it.t += dt;
        it.life -= dt;
        if (it.life <= 0) {
          it.dead = true;
          continue;
        }
        let pulled = false;
        if (alive) {
          const d = U.dist(it.x, it.y, p.x, p.y);
          const r = it.type === 'bit' || it.type === 'crystal' ? magR : magR * 0.6;
          if (it.magnet || d < r) {
            pulled = true;
            const sp = 600 + it.t * 300;
            const a = U.angleTo(it.x, it.y, p.x, p.y);
            it.vx = U.damp(it.vx, Math.cos(a) * sp, 10, dt);
            it.vy = U.damp(it.vy, Math.sin(a) * sp, 10, dt);
          }
          if (d < it.r + 22) {
            this.collect(it, p);
            continue;
          }
        }
        if (!pulled) {
          // Медленное падение с затуханием начального импульса.
          it.vx = U.damp(it.vx, 0, 2, dt);
          it.vy = U.damp(it.vy, it.type === 'bit' ? 120 : 70, 2, dt);
          if (it.x < it.r || it.x > W - it.r) it.vx = -it.vx;
        }
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        if (it.y > H + 30) it.dead = true;
      }
      this.pool.sweep((it) => !it.dead);
    },

    draw(ctx) {
      ctx.save();
      for (const it of this.pool.items) {
        if (it.dead) continue;
        // Мигание перед исчезновением
        if (it.life < 2 && Math.floor(it.life * 10) % 2 === 0) continue;
        if (it.type === 'bit') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = it.color;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(it.x - 2.5, it.y - 2.5, 5, 5);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          continue;
        }
        ctx.save();
        ctx.translate(it.x, it.y);
        const bob = Math.sin(it.t * 4) * 2;
        ctx.translate(0, bob);
        ctx.globalCompositeOperation = 'lighter';
        U.drawGlow(ctx, 0, 0, it.color, it.r * 3.2, 0.6);
        ctx.globalCompositeOperation = 'source-over';
        if (it.type === 'crystal') {
          ctx.rotate(it.t * it.spin);
          ctx.fillStyle = '#e0b8ff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -it.r);
          ctx.lineTo(it.r * 0.65, 0);
          ctx.lineTo(0, it.r);
          ctx.lineTo(-it.r * 0.65, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = it.color;
          ctx.beginPath();
          ctx.moveTo(0, -it.r);
          ctx.lineTo(it.r * 0.65, 0);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          // Капсула-бонус с пиктограммой
          ctx.fillStyle = 'rgba(8,12,28,0.85)';
          ctx.strokeStyle = it.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, it.r, 0, U.TAU);
          ctx.fill();
          ctx.stroke();
          ctx.save();
          ctx.rotate(it.t * 1.5);
          ctx.strokeStyle = U.rgba(it.color, 0.5);
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.arc(0, 0, it.r + 5, 0, U.TAU);
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = it.color;
          ctx.font = 'bold ' + Math.round(it.r * 1.1) + 'px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let glyph = '?';
          if (it.type === 'weapon') glyph = G.Data.weapons[it.weaponId].icon;
          else if (it.type === 'heal') glyph = '✚';
          else if (it.type === 'bomb') glyph = 'Б';
          else if (it.type === 'shield') glyph = '◈';
          else if (it.type === 'overdrive') glyph = '⚡';
          ctx.fillText(glyph, 0, 1);
          if (it.type === 'weapon') {
            const p = G.Game.player;
            if (p && p.weapon === it.weaponId) {
              ctx.font = 'bold 10px system-ui, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.fillText('▲', 0, -it.r - 9);
            }
          }
        }
        ctx.restore();
      }
      ctx.restore();
    },
  });
})();
