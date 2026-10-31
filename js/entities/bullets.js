/* My AI Arcade — снаряды игрока и врагов, молнии, столкновения. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const W = 540;
  const H = 960;

  function makePB() {
    return {
      x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 1, crit: false, kind: 'pulse', color: '#fff',
      pierce: 0, life: 1, homing: 0, splash: 0, bounce: 0, slow: 0, len: 0, age: 0,
      hitSet: null, dead: false, target: null,
    };
  }
  function makeEB() {
    return {
      x: 0, y: 0, vx: 0, vy: 0, r: 5, color: '#f44', shape: 'orb', life: 8, accel: 0,
      maxSpeed: 0, curve: 0, delay: 0, grazed: false, rot: 0, age: 0, homing: 0,
      split: 0, splitN: 0, dead: false, dmg: 1, wave: 0, waveFreq: 0, baseVx: 0, baseVy: 0,
    };
  }

  const B = (G.Bullets = {
    pPool: new U.Pool(makePB, 300),
    ePool: new U.Pool(makeEB, 600),
    arcs: [],
    maxEnemyBullets: 1100,

    get player() {
      return this.pPool.items;
    },
    get enemy() {
      return this.ePool.items;
    },

    clear() {
      this.pPool.clear();
      this.ePool.clear();
      this.arcs.length = 0;
    },

    firePlayer(o) {
      const b = this.pPool.get();
      b.x = o.x;
      b.y = o.y;
      b.vx = o.vx;
      b.vy = o.vy;
      b.r = o.r;
      b.dmg = o.dmg;
      b.crit = !!o.crit;
      b.kind = o.kind;
      b.color = o.color;
      b.pierce = o.pierce || 0;
      b.life = o.life || 1.2;
      b.homing = o.homing || 0;
      b.splash = o.splash || 0;
      b.bounce = o.bounce || 0;
      b.slow = o.slow || 0;
      b.len = o.len || 0;
      b.age = 0;
      b.dead = false;
      b.target = null;
      b.hitSet = b.pierce > 0 ? new Set() : null;
      G.Game.run && G.Game.run.shots++;
      return b;
    },

    // Универсальный выстрел врага. Скорость — px/с, угол — радианы.
    fireEnemy(x, y, angle, speed, o) {
      if (this.ePool.count >= this.maxEnemyBullets) return null;
      o = o || {};
      const b = this.ePool.get();
      b.x = x;
      b.y = y;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      b.baseVx = b.vx;
      b.baseVy = b.vy;
      b.r = o.r || 5;
      b.color = o.color || '#ff4d6d';
      b.shape = o.shape || 'orb';
      b.life = o.life || 9;
      b.accel = o.accel || 0;
      b.maxSpeed = o.maxSpeed || 0;
      b.curve = o.curve || 0;
      b.delay = o.delay || 0;
      b.homing = o.homing || 0;
      b.split = o.split || 0;
      b.splitN = o.splitN || 0;
      b.wave = o.wave || 0;
      b.waveFreq = o.waveFreq || 6;
      b.grazed = false;
      b.rot = angle;
      b.age = 0;
      b.dead = false;
      b.dmg = 1;
      return b;
    },

    // Цепная молния: возвращает true, если хоть кого-то задела.
    chainLightning(x, y, chains, dmg, range, color) {
      const enemies = G.Game.enemies;
      const hit = new Set();
      let cx = x;
      let cy = y;
      const pts = [x, y];
      let any = false;
      for (let i = 0; i < chains; i++) {
        let best = null;
        let bestD = range * range;
        for (const e of enemies) {
          if (!e.alive || hit.has(e) || !e.targetable || e.y < -20) continue;
          const d = U.dist2(cx, cy, e.x, e.y);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        if (!best) break;
        hit.add(best);
        any = true;
        best.damage(dmg * (i === 0 ? 1 : 0.85), { x: cx, y: cy, kind: 'lightning' });
        cx = best.x;
        cy = best.y;
        pts.push(cx, cy);
        range = Math.max(160, range * 0.85);
      }
      if (any) {
        this.arcs.push({ pts, life: 0.14, maxLife: 0.14, color: color || '#fff36b', jitter: this.makeJitter(pts) });
        G.Particles.spark(cx, cy, color || '#fff36b', 4, 160, 0.2);
      }
      return any;
    },

    makeJitter(pts) {
      // Ломаная с изломами между узлами, чтобы молния выглядела живой.
      const out = [];
      for (let i = 0; i < pts.length - 2; i += 2) {
        const x1 = pts[i];
        const y1 = pts[i + 1];
        const x2 = pts[i + 2];
        const y2 = pts[i + 3];
        const segs = 6;
        for (let s = 0; s < segs; s++) {
          const t = s / segs;
          const jx = s === 0 ? 0 : (Math.random() - 0.5) * 22;
          const jy = s === 0 ? 0 : (Math.random() - 0.5) * 22;
          out.push(U.lerp(x1, x2, t) + jx, U.lerp(y1, y2, t) + jy);
        }
      }
      out.push(pts[pts.length - 2], pts[pts.length - 1]);
      return out;
    },

    // Урон по площади (взрывы ракет, плазмы, бомб).
    splash(x, y, radius, dmg, exclude) {
      for (const e of G.Game.enemies) {
        if (!e.alive || e === exclude || !e.targetable) continue;
        if (U.circleHit(x, y, radius, e.x, e.y, e.r)) e.damage(dmg, { x, y, kind: 'splash' });
      }
    },

    // Уничтожение вражеских пуль в радиусе — для бомб и щитов. Возвращает число.
    cancelEnemyBullets(x, y, radius, toScore) {
      let n = 0;
      const r2 = radius * radius;
      for (const b of this.ePool.items) {
        if (b.dead) continue;
        if (radius === Infinity || U.dist2(x, y, b.x, b.y) <= r2) {
          b.dead = true;
          n++;
          if (toScore && n % 2 === 0) G.Powerups.spawnBit(b.x, b.y);
          else if (Math.random() < 0.5) G.Particles.dots(b.x, b.y, b.color, 1, 40, 0.3, 2);
        }
      }
      return n;
    },

    findTarget(x, y, maxDist) {
      let best = null;
      let bestD = maxDist * maxDist;
      for (const e of G.Game.enemies) {
        if (!e.alive || !e.targetable || e.y < -10) continue;
        const d = U.dist2(x, y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    },

    update(dt) {
      const game = G.Game;
      const enemies = game.enemies;
      const player = game.player;

      // ---------- Пули игрока ----------
      for (const b of this.pPool.items) {
        if (b.dead) continue;
        b.age += dt;
        b.life -= dt;
        if (b.life <= 0) {
          b.dead = true;
          continue;
        }
        if (b.homing > 0) {
          if (!b.target || !b.target.alive) b.target = this.findTarget(b.x, b.y, 500);
          if (b.target) {
            const cur = Math.atan2(b.vy, b.vx);
            const want = U.angleTo(b.x, b.y, b.target.x, b.target.y);
            const na = U.rotateToward(cur, want, b.homing * dt);
            const sp = Math.min(900, U.len(b.vx, b.vy) + 700 * dt);
            b.vx = Math.cos(na) * sp;
            b.vy = Math.sin(na) * sp;
          } else {
            b.vy -= 600 * dt;
          }
          if (Math.random() < 0.6) G.Particles.trail(b.x, b.y, '#9aff7a', 2.5, 0.25);
        }
        if (b.kind === 'plasma' && Math.random() < 0.5) G.Particles.trail(b.x, b.y, b.color, b.r * 0.5, 0.25);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.bounce > 0 && (b.x < 4 || b.x > W - 4)) {
          b.vx = -b.vx;
          b.x = U.clamp(b.x, 4, W - 4);
          b.bounce--;
        }
        if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) {
          b.dead = true;
          continue;
        }
        // Попадание по врагам
        for (const e of enemies) {
          if (!e.alive || !e.targetable) continue;
          if (b.hitSet && b.hitSet.has(e)) continue;
          if (!e.hitTest(b.x, b.y, b.r)) continue;
          const absorbed = e.damage(b.dmg, b);
          if (b.crit) G.Particles.text(b.x, b.y - 10, 'КРИТ!', '#ffffff', 13, 0.5);
          if (b.slow > 0) e.applySlow(b.slow);
          if (b.splash > 0) {
            this.splash(b.x, b.y, b.splash, b.dmg * 0.5, e);
            G.Particles.ring(b.x, b.y, b.splash, b.color, 0.25, 2);
          }
          G.Particles.spark(b.x, b.y, b.color, b.kind === 'plasma' ? 6 : 2, 140, 0.2, Math.atan2(-b.vy, -b.vx), 1.4);
          if (b.pierce > 0 && !absorbed) {
            b.pierce--;
            b.hitSet.add(e);
          } else {
            b.dead = true;
            break;
          }
        }
      }
      this.pPool.sweep((b) => !b.dead);

      // ---------- Пули врагов ----------
      const pr = player && player.alive ? player.hitRadius() : 0;
      const grazeR = pr + 20;
      for (const b of this.ePool.items) {
        if (b.dead) continue;
        b.age += dt;
        if (b.delay > 0) {
          b.delay -= dt;
          continue;
        }
        b.life -= dt;
        if (b.life <= 0) {
          b.dead = true;
          continue;
        }
        const tScale = game.enemyTimeScale;
        const edt = dt * tScale;
        if (b.curve) {
          const ang = Math.atan2(b.vy, b.vx) + b.curve * edt;
          const sp = U.len(b.vx, b.vy);
          b.vx = Math.cos(ang) * sp;
          b.vy = Math.sin(ang) * sp;
        }
        if (b.accel) {
          const sp = U.len(b.vx, b.vy);
          let ns = sp + b.accel * edt;
          if (b.maxSpeed) ns = b.accel > 0 ? Math.min(ns, b.maxSpeed) : Math.max(ns, b.maxSpeed);
          ns = Math.max(ns, 10);
          const k = ns / (sp || 1);
          b.vx *= k;
          b.vy *= k;
        }
        if (b.homing && player && player.alive && b.age < 1.6) {
          const cur = Math.atan2(b.vy, b.vx);
          const want = U.angleTo(b.x, b.y, player.x, player.y);
          const na = U.rotateToward(cur, want, b.homing * edt);
          const sp = U.len(b.vx, b.vy);
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
        let ox = 0;
        if (b.wave) {
          const nx = -b.baseVy;
          const ny = b.baseVx;
          const l = U.len(nx, ny) || 1;
          const s = Math.cos(b.age * b.waveFreq) * b.wave * b.waveFreq;
          ox = (nx / l) * s;
          b.y += (ny / l) * s * edt;
        }
        b.x += (b.vx + ox) * edt;
        b.y += b.vy * edt;
        b.rot += edt * 6;
        if (b.split && b.age >= b.split) {
          b.dead = true;
          const baseA = Math.atan2(b.vy, b.vx);
          for (let i = 0; i < b.splitN; i++) {
            const a = baseA + (i / b.splitN) * U.TAU;
            this.fireEnemy(b.x, b.y, a, 140, { color: b.color, r: 4, shape: 'orb' });
          }
          G.Particles.ring(b.x, b.y, 24, b.color, 0.2, 2);
          continue;
        }
        if (b.x < -60 || b.x > W + 60 || b.y < -80 || b.y > H + 60) {
          b.dead = true;
          continue;
        }
        if (pr > 0) {
          const d2 = U.dist2(b.x, b.y, player.x, player.y);
          const hr = pr + b.r * 0.75;
          if (d2 < hr * hr) {
            if (player.takeHit(b)) b.dead = true;
            continue;
          }
          if (!b.grazed && d2 < (grazeR + b.r) * (grazeR + b.r)) {
            b.grazed = true;
            game.onGraze(b);
          }
        }
      }
      this.ePool.sweep((b) => !b.dead);

      for (let i = this.arcs.length - 1; i >= 0; i--) {
        this.arcs[i].life -= dt;
        if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
      }
    },

    // ---------- Отрисовка ----------
    drawPlayer(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.pPool.items) {
        switch (b.kind) {
          case 'laser': {
            const l = U.len(b.vx, b.vy) || 1;
            const nx = b.vx / l;
            const ny = b.vy / l;
            ctx.strokeStyle = b.color;
            ctx.lineWidth = 5;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - nx * b.len, b.y - ny * b.len);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1;
            ctx.stroke();
            break;
          }
          case 'missile': {
            const a = Math.atan2(b.vy, b.vx);
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(a);
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-6, 4);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-6, -4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            U.drawGlow(ctx, b.x, b.y, b.color, 16, 0.6);
            break;
          }
          case 'plasma': {
            U.drawGlow(ctx, b.x, b.y, b.color, b.r * 3.2, 0.9);
            ctx.fillStyle = '#e8e0ff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 0.55 + Math.sin(b.age * 30) * 1.5, 0, U.TAU);
            ctx.fill();
            break;
          }
          case 'spread': {
            U.drawGlow(ctx, b.x, b.y, b.color, 14, 0.7);
            ctx.fillStyle = '#fff3d6';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 0.7, 0, U.TAU);
            ctx.fill();
            break;
          }
          default: {
            const l = U.len(b.vx, b.vy) || 1;
            const len = b.len || 10;
            ctx.strokeStyle = b.color;
            ctx.lineWidth = b.r * 1.6;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - (b.vx / l) * len, b.y - (b.vy / l) * len);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = b.r * 0.7;
            ctx.stroke();
          }
        }
      }
      // Молнии
      for (const a of this.arcs) {
        const k = a.life / a.maxLife;
        const pts = a.jitter;
        ctx.globalAlpha = k;
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 6 * k;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * k;
        ctx.stroke();
      }
      ctx.restore();
    },

    drawEnemy(ctx) {
      const items = this.ePool.items;
      ctx.save();
      // Внешнее свечение
      ctx.globalCompositeOperation = 'lighter';
      for (const b of items) {
        const alpha = b.delay > 0 ? 0.3 : 0.75;
        U.drawGlow(ctx, b.x, b.y, b.color, b.r * 3.2, alpha);
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const b of items) {
        if (b.delay > 0) {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r + b.delay * 20, 0, U.TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        switch (b.shape) {
          case 'needle': {
            const a = Math.atan2(b.vy, b.vx);
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(a);
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.moveTo(b.r * 2.2, 0);
            ctx.lineTo(-b.r * 1.6, b.r * 0.7);
            ctx.lineTo(-b.r * 1.6, -b.r * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-b.r, -1, b.r * 2.4, 2);
            ctx.restore();
            break;
          }
          case 'star': {
            ctx.fillStyle = b.color;
            U.star(ctx, b.x, b.y, b.r * 1.5, b.r * 0.65, 4, b.rot);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 0.4, 0, U.TAU);
            ctx.fill();
            break;
          }
          case 'square': {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rot);
            ctx.fillStyle = b.color;
            ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-b.r * 0.4, -b.r * 0.4, b.r * 0.8, b.r * 0.8);
            ctx.restore();
            break;
          }
          default: {
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, U.TAU);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r * 0.55, 0, U.TAU);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    },
  });

  B.W = W;
  B.H = H;
})();
