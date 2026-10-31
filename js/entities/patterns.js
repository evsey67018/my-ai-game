/* My AI Arcade — библиотека узоров вражеской стрельбы и вражеские лазеры. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  function fire(x, y, a, s, o) {
    return G.Bullets.fireEnemy(x, y, a, s, o);
  }
  function playerAngle(x, y) {
    const p = G.Game.player;
    if (!p) return Math.PI / 2;
    return U.angleTo(x, y, p.x, p.y);
  }

  const P = (G.Patterns = {
    playerAngle,

    aimed(x, y, speed, o) {
      return fire(x, y, playerAngle(x, y), speed, o);
    },

    fanAimed(x, y, n, spread, speed, o) {
      const base = playerAngle(x, y);
      for (const a of U.fan(n, spread, base)) fire(x, y, a, speed, o);
    },

    fan(x, y, n, spread, base, speed, o) {
      for (const a of U.fan(n, spread, base)) fire(x, y, a, speed, o);
    },

    ring(x, y, n, speed, offset, o) {
      for (let i = 0; i < n; i++) fire(x, y, (offset || 0) + (i / n) * U.TAU, speed, o);
    },

    // Кольцо с «дыркой» в сторону игрока — проходимое.
    ringWithGap(x, y, n, speed, gapSize, o) {
      const pa = playerAngle(x, y);
      for (let i = 0; i < n; i++) {
        const a = pa + (i / n) * U.TAU;
        if (Math.abs(U.angleDiff(a, pa)) < gapSize / 2) continue;
        fire(x, y, a, speed, o);
      }
    },

    // Спираль: вызывается каждый тик, хранит угол в state.
    spiral(state, x, y, arms, speed, o) {
      for (let i = 0; i < arms; i++) fire(x, y, state.angle + (i / arms) * U.TAU, speed, o);
    },

    // Цветок: кольца с ускоряющимися пулями разных скоростей.
    flower(x, y, petals, layers, baseSpeed, o) {
      for (let l = 0; l < layers; l++) {
        const sp = baseSpeed * (1 + l * 0.22);
        const off = (l % 2) * (Math.PI / petals);
        for (let i = 0; i < petals; i++) fire(x, y, off + (i / petals) * U.TAU, sp, o);
      }
    },

    // Дождь сверху по всей ширине экрана.
    rain(n, speed, o) {
      for (let i = 0; i < n; i++) {
        const x = U.rand(10, 530);
        fire(x, -10, Math.PI / 2 + U.rand(-0.1, 0.1), speed * U.rand(0.8, 1.2), Object.assign({ delay: U.rand(0, 0.6) }, o || {}));
      }
    },

    // Стена из пуль с проходом.
    wall(y, count, gapIndex, gapWidth, speed, o) {
      const step = 540 / count;
      for (let i = 0; i < count; i++) {
        if (Math.abs(i - gapIndex) < gapWidth) continue;
        fire(step * (i + 0.5), y, Math.PI / 2, speed, o);
      }
    },

    burstRandom(x, y, n, speedMin, speedMax, o) {
      for (let i = 0; i < n; i++) fire(x, y, Math.random() * U.TAU, U.rand(speedMin, speedMax), o);
    },

    // Медленные пули, которые разгоняются после паузы.
    delayedRing(x, y, n, speed, delayStep, o) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * U.TAU;
        fire(x, y, a, 30, Object.assign({ accel: speed * 1.5, maxSpeed: speed, delay: i * delayStep }, o || {}));
      }
    },

    // ---------- Лазеры ----------
    lasers: [],

    // Лазер с предупреждением: warn сек мигающей линии, затем active сек урона.
    laser(o) {
      const L = {
        x: o.x,
        y: o.y,
        angle: o.angle,
        length: o.length || 1400,
        width: o.width || 18,
        warn: o.warn === undefined ? 0.8 : o.warn,
        active: o.active || 0.6,
        t: 0,
        color: o.color || '#ff3d6b',
        owner: o.owner || null,
        offX: o.offX || 0,
        offY: o.offY || 0,
        spin: o.spin || 0,
        dead: false,
        sounded: false,
      };
      if (L.owner) {
        L.x = L.owner.x + L.offX;
        L.y = L.owner.y + L.offY;
      }
      this.lasers.push(L);
      return L;
    },

    clearLasers() {
      this.lasers.length = 0;
    },

    updateLasers(dt) {
      const player = G.Game.player;
      for (const L of this.lasers) {
        L.t += dt;
        if (L.owner) {
          if (!L.owner.alive) {
            L.dead = true;
            continue;
          }
          L.x = L.owner.x + L.offX;
          L.y = L.owner.y + L.offY;
        }
        const firing = L.t >= L.warn;
        if (firing && !L.sounded) {
          L.sounded = true;
          G.Audio.play('enemyLaser', { x: L.x });
          G.Game.shake(4, 0.2);
        }
        if (firing) L.angle += L.spin * dt;
        if (L.t >= L.warn + L.active) {
          L.dead = true;
          continue;
        }
        if (firing && player && player.alive) {
          const ex = L.x + Math.cos(L.angle) * L.length;
          const ey = L.y + Math.sin(L.angle) * L.length;
          const d = U.distToSegment(player.x, player.y, L.x, L.y, ex, ey);
          if (d < L.width * 0.45 + player.hitRadius()) player.takeHit({ laser: true, x: player.x, y: player.y });
        }
      }
      U.compact(this.lasers, (l) => !l.dead);
    },

    drawLasers(ctx) {
      if (!this.lasers.length) return;
      ctx.save();
      for (const L of this.lasers) {
        const ex = L.x + Math.cos(L.angle) * L.length;
        const ey = L.y + Math.sin(L.angle) * L.length;
        if (L.t < L.warn) {
          const k = L.t / L.warn;
          const blink = Math.sin(L.t * 40) > 0 ? 0.7 : 0.3;
          ctx.globalAlpha = blink * (0.4 + k * 0.6);
          ctx.strokeStyle = L.color;
          ctx.lineWidth = 1 + k * 2;
          ctx.setLineDash([10, 8]);
          ctx.beginPath();
          ctx.moveTo(L.x, L.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const tt = (L.t - L.warn) / L.active;
          const w = L.width * (tt < 0.1 ? tt / 0.1 : tt > 0.85 ? (1 - tt) / 0.15 : 1);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = L.color;
          ctx.lineCap = 'round';
          ctx.lineWidth = w * 1.8;
          ctx.beginPath();
          ctx.moveTo(L.x, L.y);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.lineWidth = w;
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = w * 0.4;
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          U.drawGlow(ctx, L.x, L.y, L.color, w * 3, 0.9);
        }
      }
      ctx.restore();
    },
  });

  P.fire = fire;
})();
