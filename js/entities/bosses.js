/* My AI Arcade — шесть многофазных боссов. Каждый — набор фаз с атаками. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const E = G.Enemies;
  const W = 540;
  const H = 960;
  const PI = Math.PI;
  const DOWN = PI / 2;
  const P = () => G.Patterns;

  // ========== Общий каркас босса ==========
  // def.phases: [{ until: доля HP, при которой фаза заканчивается, attacks: [...], move(e, dt) }]
  // атака: { name, dur, start(e), tick(e, dt, t) }
  function bossInit(e) {
    e.phase = 0;
    e.attackIdx = 0;
    e.attackT = 0;
    e.transition = 0;
    e.entering = true;
    e.mem = {};
    e.homeX = W / 2;
    e.homeY = e.def.homeY || 190;
    e.x = W / 2;
    e.y = -e.r - 40;
    e.displayHp = 1;
    e.bombsUsed = 0;
    e.introT = 0;
    G.Game.setBoss(e);
    G.Game.run.bossBombs = 0;
  }

  function currentPhase(e) {
    return e.def.phases[Math.min(e.phase, e.def.phases.length - 1)];
  }

  function startAttack(e) {
    const ph = currentPhase(e);
    const atk = ph.attacks[e.attackIdx % ph.attacks.length];
    e.attackT = 0;
    e.mem = {};
    e.fireT = 0;
    if (atk.start) atk.start(e);
  }

  function bossUpdate(e, dt) {
    e.displayHp = U.damp(e.displayHp, e.hp / e.maxHp, 6, dt);
    if (e.entering) {
      e.y = U.damp(e.y, e.homeY, 1.4, dt);
      e.introT += dt;
      e.targetable = false;
      if (e.introT > 2.4) {
        e.entering = false;
        e.targetable = true;
        startAttack(e);
      }
      if (e.def.idle) e.def.idle(e, dt);
      return;
    }
    if (e.transition > 0) {
      e.transition -= dt;
      e.x = U.damp(e.x, W / 2, 2, dt);
      e.y = U.damp(e.y, e.homeY, 2, dt);
      if (Math.random() < 0.5) G.Particles.spark(e.x + U.rand(-e.r, e.r), e.y + U.rand(-e.r, e.r), e.color, 3, 200, 0.4);
      if (e.transition <= 0) startAttack(e);
      if (e.def.idle) e.def.idle(e, dt);
      return;
    }
    const phases = e.def.phases;
    const ph = currentPhase(e);
    // Переход в следующую фазу
    if (e.phase < phases.length - 1 && e.hp / e.maxHp <= ph.until) {
      e.phase++;
      e.attackIdx = 0;
      e.transition = 1.6;
      G.Patterns.clearLasers();
      G.Bullets.cancelEnemyBullets(0, 0, Infinity, true);
      G.Game.shake(14, 0.6);
      G.Background.flash(e.color, 0.4);
      G.Particles.ring(e.x, e.y, 260, e.color, 0.8, 8);
      G.Particles.text(W / 2, H * 0.42, 'ФАЗА ' + (e.phase + 1), e.color, 34, 1.4);
      G.Audio.play('warning');
      G.Music.setIntensity(0.6 + e.phase * 0.2);
      if (e.def.onPhase) e.def.onPhase(e, e.phase);
      return;
    }
    if (ph.move) ph.move(e, dt);
    if (e.def.idle) e.def.idle(e, dt);
    const atk = ph.attacks[e.attackIdx % ph.attacks.length];
    e.attackT += dt;
    atk.tick(e, dt, e.attackT);
    if (e.attackT >= atk.dur) {
      e.attackIdx++;
      startAttack(e);
    }
  }

  function bossDamage(e, dmg) {
    if (e.entering || e.transition > 0) return 'immune';
    if (e.def.armor) return e.def.armor(e, dmg);
    return dmg;
  }

  function bossDeath(e) {
    G.Patterns.clearLasers();
    G.Bullets.cancelEnemyBullets(0, 0, Infinity, true);
    G.Game.onBossDefeated(e);
  }

  // Периодический таймер внутри атаки: true раз в interval секунд.
  function every(e, key, interval, dt) {
    e.mem[key] = (e.mem[key] === undefined ? 0 : e.mem[key]) - dt;
    if (e.mem[key] <= 0) {
      e.mem[key] += interval / (G.Game.fireMul || 1);
      return true;
    }
    return false;
  }

  function moveSine(ax, sx, ay, sy) {
    return function (e, dt) {
      const tx = W / 2 + Math.sin(e.t * sx) * ax;
      const ty = e.homeY + Math.sin(e.t * sy) * ay;
      e.x = U.damp(e.x, tx, 2, dt);
      e.y = U.damp(e.y, ty, 2, dt);
    };
  }

  function moveTrack(speed, yOff) {
    return function (e, dt) {
      const p = G.Game.player;
      const tx = p ? U.clamp(p.x, 90, W - 90) : W / 2;
      e.x = U.approach(e.x, tx, speed * dt);
      e.y = U.damp(e.y, e.homeY + (yOff || 0), 2, dt);
    };
  }

  function makeBoss(def) {
    def.isBoss = true;
    def.persistent = true;
    def.mass = 100;
    const userInit = def.init;
    def.init = function (e) {
      bossInit(e);
      if (userInit) userInit(e);
    };
    def.update = bossUpdate;
    def.onDamage = bossDamage;
    def.onDeath = function (e) {
      if (def.death) def.death(e);
      bossDeath(e);
    };
    return def;
  }

  function sfx(name, e, pitch) {
    G.Audio.play(name, { x: e.x, pitch: pitch || 1 });
  }

  // ===================================================================
  // 1. СТРАЖ — щитоносная турель с вращающимися пушками.
  // ===================================================================
  E.register(
    'guardian',
    makeBoss({
      name: 'Страж Периметра',
      title: 'СТРАЖ ПЕРИМЕТРА',
      hp: 2200,
      r: 56,
      score: 25000,
      color: '#33e1ff',
      homeY: 180,
      init(e) {
        e.gunAngle = 0;
      },
      idle(e, dt) {
        e.gunAngle += dt * (0.8 + e.phase * 0.5);
      },
      phases: [
        {
          until: 0.6,
          move: moveSine(150, 0.5, 20, 0.9),
          attacks: [
            {
              name: 'веер',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.7, dt)) {
                  P().fanAimed(e.x, e.y + 40, 5, 0.9, 230, { color: '#9ff0ff', r: 6 });
                  sfx('enemyShoot', e);
                }
              },
            },
            {
              name: 'вертушка',
              dur: 4.5,
              tick(e, dt) {
                if (every(e, 'f', 0.14, dt)) {
                  for (let i = 0; i < 4; i++) {
                    const a = e.gunAngle + (i / 4) * U.TAU;
                    P().fire(e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50, a, 170, { color: '#33e1ff', r: 5 });
                  }
                }
              },
            },
            {
              name: 'кольца',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.9, dt)) {
                  P().ringWithGap(e.x, e.y, 20, 160, 0.7, { color: '#ffffff', r: 5 });
                  sfx('enemyShoot', e, 0.7);
                }
              },
            },
          ],
        },
        {
          until: 0.25,
          move: moveSine(170, 0.7, 30, 1.1),
          attacks: [
            {
              name: 'двойная спираль',
              dur: 5,
              tick(e, dt) {
                if (every(e, 'f', 0.1, dt)) {
                  for (let i = 0; i < 2; i++) {
                    const a = e.gunAngle * (i ? -1 : 1) + i * PI;
                    P().fire(e.x, e.y, a, 180, { color: i ? '#ffb02e' : '#33e1ff', r: 5 });
                  }
                }
              },
            },
            {
              name: 'прицельные очереди',
              dur: 3.5,
              tick(e, dt) {
                if (every(e, 'f', 0.18, dt)) {
                  P().aimed(e.x - 40, e.y + 30, 320, { color: '#ff5d73', r: 5, shape: 'needle' });
                  P().aimed(e.x + 40, e.y + 30, 320, { color: '#ff5d73', r: 5, shape: 'needle' });
                  sfx('enemyShoot', e, 1.3);
                }
              },
            },
            {
              name: 'лазеры',
              dur: 3.5,
              start(e) {
                for (const off of [-0.5, 0, 0.5]) {
                  P().laser({ x: e.x, y: e.y, angle: DOWN + off, warn: 1, active: 1, width: 16, color: '#33e1ff', owner: e });
                }
                sfx('charge', e);
              },
              tick(e, dt) {
                if (e.attackT > 2.1 && every(e, 'f', 0.5, dt)) P().ring(e.x, e.y, 10, 140, e.t, { color: '#9ff0ff', r: 4 });
              },
            },
          ],
        },
        {
          until: 0,
          move: moveTrack(120, -20),
          attacks: [
            {
              name: 'ярость',
              dur: 6,
              tick(e, dt) {
                if (every(e, 'a', 0.08, dt)) {
                  P().fire(e.x, e.y, e.gunAngle * 1.7, 200, { color: '#33e1ff', r: 5 });
                  P().fire(e.x, e.y, -e.gunAngle * 1.7 + PI, 200, { color: '#ffb02e', r: 5 });
                }
                if (every(e, 'b', 1.1, dt)) P().fanAimed(e.x, e.y + 40, 7, 1.0, 260, { color: '#ffffff', r: 6, shape: 'star' });
              },
            },
            {
              name: 'стена',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 1.0, dt)) {
                  P().wall(e.y + 50, 18, U.randInt(3, 14), 1.6, 170, { color: '#33e1ff', r: 6, shape: 'square' });
                  sfx('enemyShoot', e, 0.6);
                }
              },
            },
          ],
        },
      ],
      draw(ctx, e) {
        E.glowCore(ctx, 0, 0, e.color, 150, 0.3);
        // Вращающиеся орудия
        for (let i = 0; i < 4; i++) {
          const a = e.gunAngle + (i / 4) * U.TAU;
          ctx.save();
          ctx.rotate(a);
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#0e3a4a';
          ctx.fillRect(38, -8, 26, 16);
          ctx.fillStyle = e.color;
          ctx.fillRect(58, -4, 8, 8);
          ctx.restore();
        }
        ctx.fillStyle = E.bodyFill(ctx, e, '#0a2a3a');
        U.polygon(ctx, 0, 0, 52, 8, PI / 8);
        ctx.fill();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = U.rgba(e.color, 0.5);
        ctx.lineWidth = 1.5;
        U.polygon(ctx, 0, 0, 36, 8, -e.t * 0.5);
        ctx.stroke();
        E.eye(ctx, 0, 0, 18, e.phase >= 2 ? '#ff3d6b' : e.color, e.t);
      },
    })
  );

  // ===================================================================
  // 2. ЛЕВИАФАН — космический змей из сегментов.
  // ===================================================================
  const SEGMENTS = 12;
  E.register(
    'leviathan',
    makeBoss({
      name: 'Левиафан',
      title: 'ЛЕВИАФАН',
      hp: 3200,
      r: 40,
      score: 40000,
      color: '#7dff5a',
      homeY: 200,
      init(e) {
        e.trail = [];
        for (let i = 0; i < SEGMENTS * 6; i++) e.trail.push({ x: e.x, y: e.y - i * 4 });
        e.head = DOWN;
      },
      idle(e) {
        e.trail.unshift({ x: e.x, y: e.y });
        if (e.trail.length > SEGMENTS * 6) e.trail.length = SEGMENTS * 6;
      },
      hitTest(e, x, y, r) {
        if (U.circleHit(x, y, r, e.x, e.y, e.r)) return true;
        for (let i = 1; i <= SEGMENTS; i++) {
          const s = e.trail[Math.min(e.trail.length - 1, i * 6)];
          if (s && U.circleHit(x, y, r, s.x, s.y, 22 - i)) return true;
        }
        return false;
      },
      phases: [
        {
          until: 0.55,
          move(e, dt) {
            // Восьмёрка по верхней половине экрана
            const tx = W / 2 + Math.sin(e.t * 0.9) * 190;
            const ty = 230 + Math.sin(e.t * 1.8) * 110;
            e.x = U.damp(e.x, tx, 2.5, dt);
            e.y = U.damp(e.y, ty, 2.5, dt);
          },
          attacks: [
            {
              name: 'плевки',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.45, dt)) {
                  P().fanAimed(e.x, e.y, 3, 0.4, 250, { color: '#b6ff9a', r: 6 });
                  sfx('enemyShoot', e, 0.9);
                }
              },
            },
            {
              name: 'чешуя',
              dur: 4.5,
              tick(e, dt) {
                if (every(e, 'f', 0.35, dt)) {
                  const i = U.randInt(2, SEGMENTS);
                  const s = e.trail[Math.min(e.trail.length - 1, i * 6)];
                  P().ring(s.x, s.y, 6, 120, Math.random(), { color: '#7dff5a', r: 4 });
                }
              },
            },
          ],
        },
        {
          until: 0.2,
          move(e, dt) {
            const p = G.Game.player;
            const tx = p ? p.x : W / 2;
            const ty = 200 + Math.sin(e.t * 1.2) * 140;
            e.x = U.damp(e.x, W / 2 + Math.sin(e.t * 1.3) * 200 + (tx - W / 2) * 0.2, 2.2, dt);
            e.y = U.damp(e.y, ty, 2.2, dt);
          },
          attacks: [
            {
              name: 'кислотный дождь',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.5, dt)) P().rain(5, 200, { color: '#d6ff5a', r: 5, shape: 'needle' });
                if (every(e, 'g', 0.9, dt)) P().aimed(e.x, e.y, 300, { color: '#ffffff', r: 7, shape: 'star' });
              },
            },
            {
              name: 'ядовитые споры',
              dur: 4.5,
              tick(e, dt) {
                if (every(e, 'f', 0.7, dt)) {
                  P().fanAimed(e.x, e.y, 3, 0.8, 160, { color: '#7dff5a', r: 8, split: 0.9, splitN: 8 });
                  sfx('enemyShoot', e, 0.6);
                }
              },
            },
            {
              name: 'хвостовой хлыст',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.12, dt)) {
                  const tail = e.trail[e.trail.length - 1];
                  P().fire(tail.x, tail.y, e.t * 3, 150, { color: '#b6ff9a', r: 4 });
                  P().fire(tail.x, tail.y, -e.t * 3, 150, { color: '#b6ff9a', r: 4 });
                }
              },
            },
          ],
        },
        {
          until: 0,
          move(e, dt) {
            const tx = W / 2 + Math.sin(e.t * 1.6) * 210;
            const ty = 300 + Math.sin(e.t * 2.4) * 180;
            e.x = U.damp(e.x, tx, 3, dt);
            e.y = U.damp(e.y, ty, 3, dt);
          },
          attacks: [
            {
              name: 'бешенство',
              dur: 7,
              tick(e, dt) {
                if (every(e, 'f', 0.22, dt)) {
                  P().ring(e.x, e.y, 9, 170, e.t * 2, { color: '#7dff5a', r: 5, curve: 0.4 });
                }
                if (every(e, 'g', 1.3, dt)) P().fanAimed(e.x, e.y, 5, 0.6, 280, { color: '#ffffff', r: 6, shape: 'needle' });
              },
            },
          ],
        },
      ],
      draw(ctx, e) {
        // Сегменты рисуем в мировых координатах, поэтому откатываем трансформацию.
        ctx.save();
        ctx.translate(-e.x, -e.y);
        for (let i = SEGMENTS; i >= 1; i--) {
          const s = e.trail[Math.min(e.trail.length - 1, i * 6)];
          const r = 22 - i;
          E.glowCore(ctx, s.x, s.y, e.color, r * 3, 0.15);
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : i % 2 ? '#1f5a14' : '#2a7a1a';
          ctx.beginPath();
          ctx.arc(s.x, s.y, r, 0, U.TAU);
          ctx.fill();
          ctx.strokeStyle = U.rgba(e.color, 0.7);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 3, 0, U.TAU);
          ctx.fill();
        }
        ctx.restore();
        const nxt = e.trail[4] || { x: e.x, y: e.y - 1 };
        const a = Math.atan2(e.y - nxt.y, e.x - nxt.x);
        ctx.rotate(a - DOWN);
        E.glowCore(ctx, 0, 0, e.color, 110, 0.3);
        E.hull(ctx, e, [0, 44, 22, 26, 38, -4, 26, -30, 0, -38, -26, -30, -38, -4, -22, 26], '#1a4a10', 1);
        const jaw = Math.sin(e.t * 6) * 4;
        ctx.fillStyle = '#0a1a06';
        ctx.beginPath();
        ctx.moveTo(-12, 22);
        ctx.lineTo(0, 40 + jaw);
        ctx.lineTo(12, 22);
        ctx.fill();
        E.eye(ctx, -16, 6, 8, e.phase >= 2 ? '#ff3d6b' : '#d6ff5a', e.t);
        E.eye(ctx, 16, 6, 8, e.phase >= 2 ? '#ff3d6b' : '#d6ff5a', e.t + 0.5);
      },
    })
  );

  // ===================================================================
  // 3. КОЛОСС — бронированная крепость с отделяемыми пушками.
  // ===================================================================
  E.register(
    'colossus',
    makeBoss({
      name: 'Колосс',
      title: 'КОЛОСС',
      hp: 4200,
      r: 70,
      score: 55000,
      color: '#ffb02e',
      homeY: 170,
      init(e) {
        e.cannons = [
          { x: -80, y: 20, a: DOWN },
          { x: 80, y: 20, a: DOWN },
        ];
      },
      armor(e, dmg) {
        // Броня закрыта, пока ядро не раскрыто — урон снижен.
        return e.mem && e.mem.open ? dmg * 1.5 : dmg * 0.6;
      },
      idle(e, dt) {
        const p = G.Game.player;
        for (const c of e.cannons) {
          const want = p ? U.angleTo(e.x + c.x, e.y + c.y, p.x, p.y) : DOWN;
          c.a = U.rotateToward(c.a, want, 1.6 * dt);
        }
      },
      hitTest(e, x, y, r) {
        return U.circleHit(x, y, r, e.x, e.y, e.r) || e.cannons.some((c) => U.circleHit(x, y, r, e.x + c.x, e.y + c.y, 24));
      },
      phases: [
        {
          until: 0.5,
          move: moveSine(80, 0.35, 10, 0.6),
          attacks: [
            {
              name: 'пушки',
              dur: 4.5,
              tick(e, dt) {
                if (every(e, 'f', 0.6, dt)) {
                  for (const c of e.cannons) {
                    P().fan(e.x + c.x + Math.cos(c.a) * 30, e.y + c.y + Math.sin(c.a) * 30, 3, 0.3, c.a, 260, { color: '#ffcf6b', r: 7 });
                  }
                  sfx('shootHeavy', e);
                }
              },
            },
            {
              name: 'раскрытие',
              dur: 4,
              start(e) {
                e.mem.open = true;
              },
              tick(e, dt) {
                e.mem.open = true;
                if (every(e, 'f', 0.25, dt)) P().ring(e.x, e.y + 10, 14, 150, e.attackT, { color: '#ff7a3d', r: 5 });
              },
            },
            {
              name: 'ракеты',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.55, dt)) {
                  P().fire(e.x - 50, e.y - 30, -PI / 2 - 0.5, 200, { color: '#ff3d3d', r: 7, shape: 'needle', homing: 1.4, accel: 60, maxSpeed: 260 });
                  P().fire(e.x + 50, e.y - 30, -PI / 2 + 0.5, 200, { color: '#ff3d3d', r: 7, shape: 'needle', homing: 1.4, accel: 60, maxSpeed: 260 });
                  sfx('missile', e, 0.8);
                }
              },
            },
          ],
        },
        {
          until: 0,
          move: moveTrack(70, 10),
          attacks: [
            {
              name: 'шквал',
              dur: 5,
              start(e) {
                e.mem.open = true;
              },
              tick(e, dt) {
                if (every(e, 'f', 0.2, dt)) {
                  for (const c of e.cannons) P().fire(e.x + c.x, e.y + c.y, c.a + U.rand(-0.2, 0.2), 290, { color: '#ffcf6b', r: 6 });
                }
                if (every(e, 'g', 1, dt)) P().flower(e.x, e.y, 12, 2, 130, { color: '#ff7a3d', r: 5 });
              },
            },
            {
              name: 'лазерная решётка',
              dur: 4.5,
              start(e) {
                for (let i = 0; i < 5; i++) {
                  P().laser({ x: 60 + i * 105, y: -10, angle: DOWN, warn: 1.1, active: 1.2, width: 22, color: '#ffb02e' });
                }
                sfx('charge', e);
              },
              tick(e, dt) {
                if (e.attackT > 2.4 && every(e, 'f', 0.3, dt)) P().aimed(e.x, e.y, 280, { color: '#ffffff', r: 6 });
              },
            },
            {
              name: 'давление',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.9, dt)) P().wall(e.y + 80, 16, U.randInt(2, 13), 1.6, 190, { color: '#ffb02e', r: 7, shape: 'square' });
                if (every(e, 'g', 0.6, dt)) P().fire(e.x, e.y, -PI / 2 + U.rand(-1, 1), 200, { color: '#ff3d3d', r: 7, shape: 'needle', homing: 1.2 });
              },
            },
          ],
        },
      ],
      draw(ctx, e) {
        E.glowCore(ctx, 0, 0, e.color, 180, 0.25);
        const open = e.mem && e.mem.open ? 1 : 0;
        e.openK = U.lerp(e.openK || 0, open, 0.1);
        // Корпус
        E.hull(ctx, e, [0, 70, 50, 56, 74, 20, 70, -40, 40, -66, -40, -66, -70, -40, -74, 20, -50, 56], '#4a3410', 1);
        // Бронеплиты расходятся, обнажая ядро
        const off = e.openK * 18;
        ctx.fillStyle = E.bodyFill(ctx, e, '#6a4a14');
        ctx.fillRect(-46 - off, -30, 40, 60);
        ctx.fillRect(6 + off, -30, 40, 60);
        ctx.strokeStyle = '#ffcf6b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-46 - off, -30, 40, 60);
        ctx.strokeRect(6 + off, -30, 40, 60);
        E.glowCore(ctx, 0, 0, '#ff7a3d', 40 + e.openK * 40, 0.4 + e.openK * 0.5);
        E.eye(ctx, 0, 0, 10 + e.openK * 6, '#ff7a3d', e.t);
        for (const c of e.cannons) {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.a - DOWN);
          ctx.fillStyle = E.bodyFill(ctx, e, '#3a2a0a');
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, U.TAU);
          ctx.fill();
          ctx.strokeStyle = e.color;
          ctx.stroke();
          ctx.fillRect(-6, 0, 12, 36);
          ctx.restore();
        }
      },
    })
  );

  // ===================================================================
  // 4. КОРОЛЕВА РОЯ — призывает нанодронов и стреляет «цветами».
  // ===================================================================
  E.register(
    'queen',
    makeBoss({
      name: 'Королева Роя',
      title: 'КОРОЛЕВА РОЯ',
      hp: 5000,
      r: 54,
      score: 70000,
      color: '#ff4fd8',
      homeY: 190,
      init(e) {
        e.wing = 0;
      },
      idle(e, dt) {
        e.wing += dt * 12;
      },
      phases: [
        {
          until: 0.6,
          move: moveSine(160, 0.45, 40, 0.9),
          attacks: [
            {
              name: 'выводок',
              dur: 4,
              start(e) {
                for (let i = 0; i < 6; i++) G.Enemies.spawn('swarm', e.x + U.rand(-40, 40), e.y + 30, { noDrop: true });
                sfx('spawn', e);
              },
              tick(e, dt) {
                if (every(e, 'f', 0.8, dt)) P().fanAimed(e.x, e.y + 40, 5, 0.7, 220, { color: '#ff8ae8', r: 5 });
              },
            },
            {
              name: 'цветок',
              dur: 4.5,
              tick(e, dt) {
                if (every(e, 'f', 0.8, dt)) {
                  P().flower(e.x, e.y, 12, 3, 110, { color: '#ff4fd8', r: 5 });
                  sfx('enemyShoot', e, 0.8);
                }
              },
            },
            {
              name: 'жала',
              dur: 3.5,
              tick(e, dt) {
                if (every(e, 'f', 0.15, dt)) {
                  P().fire(e.x + U.rand(-40, 40), e.y + 30, DOWN + U.rand(-0.6, 0.6), 240, { color: '#ffe24f', r: 4, shape: 'needle', wave: 30, waveFreq: 5 });
                }
              },
            },
          ],
        },
        {
          until: 0.25,
          move: moveSine(190, 0.6, 60, 1.1),
          attacks: [
            {
              name: 'гнёзда',
              dur: 5,
              start(e) {
                G.Enemies.spawn('carrier', U.rand(100, W - 100), -60, { noDrop: true, hp: 0.4 });
              },
              tick(e, dt) {
                if (every(e, 'f', 0.12, dt)) P().fire(e.x, e.y, e.t * 2.2, 160, { color: '#ff8ae8', r: 5, curve: 0.5 });
              },
            },
            {
              name: 'пыльца',
              dur: 4.5,
              tick(e, dt) {
                if (every(e, 'f', 0.6, dt)) P().burstRandom(e.x, e.y, 14, 80, 220, { color: '#ffe24f', r: 4, accel: -40, maxSpeed: 60, life: 6 });
                if (every(e, 'g', 1.2, dt)) P().aimed(e.x, e.y, 320, { color: '#ffffff', r: 7, shape: 'star' });
              },
            },
          ],
        },
        {
          until: 0,
          move: moveTrack(110, 0),
          attacks: [
            {
              name: 'бесконечный рой',
              dur: 6,
              tick(e, dt) {
                if (every(e, 's', 1.2, dt)) for (let i = 0; i < 3; i++) G.Enemies.spawn('swarm', e.x, e.y + 20, { noDrop: true });
                if (every(e, 'f', 0.5, dt)) P().flower(e.x, e.y, 8, 2, 160, { color: '#ff4fd8', r: 5 });
              },
            },
            {
              name: 'гнев',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.08, dt)) {
                  P().fire(e.x, e.y, e.t * 4, 220, { color: '#ffe24f', r: 4 });
                  P().fire(e.x, e.y, -e.t * 4, 220, { color: '#ff4fd8', r: 4 });
                }
              },
            },
          ],
        },
      ],
      draw(ctx, e) {
        E.glowCore(ctx, 0, 0, e.color, 150, 0.3);
        const flap = Math.sin(e.wing) * 0.25;
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.scale(s, 1);
          ctx.rotate(flap);
          ctx.fillStyle = U.rgba('#ffb8f0', 0.35);
          ctx.strokeStyle = U.rgba('#ffffff', 0.6);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(56, -18, 52, 22, -0.4, 0, U.TAU);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(46, 18, 36, 14, 0.4, 0, U.TAU);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        // Брюшко
        ctx.fillStyle = E.bodyFill(ctx, e, '#5a1a4f');
        ctx.beginPath();
        ctx.ellipse(0, -30, 24, 40, 0, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = '#ffe24f';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(0, -46 + i * 14, 22 - i * 2, 4, 0, 0, PI);
          ctx.stroke();
        }
        E.hull(ctx, e, [0, 44, 26, 24, 30, 0, 16, -12, -16, -12, -30, 0, -26, 24], '#8a2a7a', 1);
        // Корона
        ctx.fillStyle = '#ffe24f';
        U.star(ctx, 0, 6, 16, 7, 5, -PI / 2);
        ctx.fill();
        E.eye(ctx, -12, 20, 6, e.phase >= 2 ? '#ff3d3d' : e.color, e.t);
        E.eye(ctx, 12, 20, 6, e.phase >= 2 ? '#ff3d3d' : e.color, e.t);
      },
    })
  );

  // ===================================================================
  // 5. БЛИЗНЕЦЫ — два ядра, связанные лучом. Урон делится между ними.
  // ===================================================================
  E.register(
    'twins',
    makeBoss({
      name: 'Близнецы Альфа и Омега',
      title: 'БЛИЗНЕЦЫ',
      hp: 6000,
      r: 34,
      score: 85000,
      color: '#ff3d6b',
      homeY: 210,
      init(e) {
        e.sep = 120;
        e.spinA = 0;
        e.twins = [
          { x: 0, y: 0, color: '#ff3d6b' },
          { x: 0, y: 0, color: '#3fa9ff' },
        ];
        e.def.idle(e, 0);
      },
      idle(e, dt) {
        e.spinA += dt * (0.7 + e.phase * 0.35);
        const sep = U.lerp(e.sep, 120 + (e.phase === 2 ? Math.sin(e.t * 1.5) * 80 : 0), 0.1);
        e.sep = sep;
        e.twins[0].x = e.x + Math.cos(e.spinA) * sep;
        e.twins[0].y = e.y + Math.sin(e.spinA) * sep * 0.5;
        e.twins[1].x = e.x - Math.cos(e.spinA) * sep;
        e.twins[1].y = e.y - Math.sin(e.spinA) * sep * 0.5;
      },
      hitTest(e, x, y, r) {
        return e.twins.some((t) => U.circleHit(x, y, r, t.x, t.y, e.r));
      },
      phases: [
        {
          until: 0.65,
          move: moveSine(100, 0.4, 30, 0.8),
          attacks: [
            {
              name: 'зеркало',
              dur: 4.5,
              tick(e, dt) {
                if (every(e, 'f', 0.6, dt)) {
                  P().fanAimed(e.twins[0].x, e.twins[0].y, 5, 0.8, 230, { color: '#ff7a95', r: 5 });
                  P().ring(e.twins[1].x, e.twins[1].y, 12, 150, e.t, { color: '#7fc8ff', r: 5 });
                  sfx('enemyShoot', e);
                }
              },
            },
            {
              name: 'связь',
              dur: 4,
              start(e) {
                e.mem.beam = true;
              },
              tick(e, dt) {
                e.mem.beam = true;
                if (every(e, 'f', 0.12, dt)) {
                  const k = (e.attackT * 0.8) % 1;
                  const x = U.lerp(e.twins[0].x, e.twins[1].x, k);
                  const y = U.lerp(e.twins[0].y, e.twins[1].y, k);
                  P().fire(x, y, DOWN, 200, { color: '#ffffff', r: 5, shape: 'star' });
                }
              },
            },
          ],
        },
        {
          until: 0.3,
          move: moveSine(120, 0.55, 50, 1),
          attacks: [
            {
              name: 'перекрёстный огонь',
              dur: 5,
              tick(e, dt) {
                if (every(e, 'f', 0.1, dt)) {
                  P().fire(e.twins[0].x, e.twins[0].y, e.t * 3, 190, { color: '#ff3d6b', r: 5 });
                  P().fire(e.twins[1].x, e.twins[1].y, -e.t * 3 + PI, 190, { color: '#3fa9ff', r: 5 });
                }
              },
            },
            {
              name: 'лучи',
              dur: 4,
              start(e) {
                for (const tw of e.twins) {
                  const p = G.Game.player;
                  const a = p ? U.angleTo(tw.x, tw.y, p.x, p.y) : DOWN;
                  P().laser({ x: tw.x, y: tw.y, angle: a, warn: 0.9, active: 0.6, width: 14, color: tw.color });
                }
                sfx('charge', e);
              },
              tick(e, dt) {
                if (e.attackT > 1.8 && every(e, 'f', 0.7, dt)) for (const tw of e.twins) P().ring(tw.x, tw.y, 10, 160, e.t, { color: tw.color, r: 4 });
              },
            },
          ],
        },
        {
          until: 0,
          move: moveSine(80, 0.8, 40, 1.3),
          attacks: [
            {
              name: 'слияние',
              dur: 6,
              start(e) {
                e.mem.beam = true;
              },
              tick(e, dt) {
                e.mem.beam = true;
                if (every(e, 'f', 0.45, dt)) {
                  for (const tw of e.twins) P().fanAimed(tw.x, tw.y, 3, 0.5, 260, { color: tw.color, r: 5, shape: 'needle' });
                }
                if (every(e, 'g', 0.9, dt)) P().delayedRing(e.x, e.y, 16, 220, 0.03, { color: '#ffffff', r: 5 });
              },
            },
            {
              name: 'разлом',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.16, dt)) {
                  for (const tw of e.twins) P().fire(tw.x, tw.y, Math.random() * U.TAU, 170, { color: tw.color, r: 5, curve: tw === e.twins[0] ? 0.6 : -0.6 });
                }
              },
            },
          ],
        },
      ],
      draw(ctx, e) {
        ctx.save();
        ctx.translate(-e.x, -e.y);
        const [a, b] = e.twins;
        // Связующий луч
        const beam = e.mem && e.mem.beam;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgba('#ffffff', beam ? 0.8 : 0.25);
        ctx.lineWidth = beam ? 6 + Math.sin(e.t * 30) * 2 : 2;
        ctx.setLineDash(beam ? [] : [6, 8]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'source-over';
        for (const tw of e.twins) {
          E.glowCore(ctx, tw.x, tw.y, tw.color, 100, 0.4);
          ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : U.mixColor(tw.color, '#000000', 0.6);
          U.polygon(ctx, tw.x, tw.y, e.r, 6, e.t * (tw === a ? 1 : -1));
          ctx.fill();
          ctx.strokeStyle = tw.color;
          ctx.lineWidth = 3;
          ctx.stroke();
          E.eye(ctx, tw.x, tw.y, 12, tw.color, e.t);
        }
        ctx.restore();
        if (e.mem) e.mem.beam = false;
      },
    })
  );

  // ===================================================================
  // 6. ЯДРО — финальный босс, искусственный интеллект-изгой.
  // ===================================================================
  E.register(
    'core',
    makeBoss({
      name: 'Ядро «Омега»',
      title: 'ЯДРО «ОМЕГА»',
      hp: 9000,
      r: 60,
      score: 150000,
      color: '#ffffff',
      homeY: 220,
      init(e) {
        e.rings = [0, 0, 0];
        e.spiralA = { angle: 0 };
      },
      idle(e, dt) {
        e.rings[0] += dt * 0.8;
        e.rings[1] -= dt * 1.2;
        e.rings[2] += dt * 2;
      },
      onPhase(e, ph) {
        const names = ['', 'ПРОТОКОЛ «ГНЕВ»', 'ПРОТОКОЛ «ХАОС»', 'ПОСЛЕДНЯЯ ЛИНИЯ'];
        G.Particles.text(W / 2, H * 0.48, names[ph] || '', '#ff3d6b', 22, 1.6);
        if (ph === 2) for (let i = 0; i < 2; i++) G.Enemies.spawn('turret', 120 + i * 300, -40, { noDrop: true, hp: 0.6 });
      },
      phases: [
        {
          until: 0.75,
          move: moveSine(130, 0.4, 30, 0.7),
          attacks: [
            {
              name: 'синхронизация',
              dur: 4.5,
              tick(e, dt) {
                e.spiralA.angle += dt * 1.5;
                if (every(e, 'f', 0.1, dt)) P().spiral(e.spiralA, e.x, e.y, 5, 170, { color: '#9fd8ff', r: 5 });
              },
            },
            {
              name: 'диагностика',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.5, dt)) P().fanAimed(e.x, e.y, 9, 1.4, 240, { color: '#ffffff', r: 6, shape: 'star' });
              },
            },
          ],
        },
        {
          until: 0.5,
          move: moveTrack(100, 0),
          attacks: [
            {
              name: 'вентилятор',
              dur: 5,
              start(e) {
                for (let i = 0; i < 3; i++) {
                  P().laser({ x: e.x, y: e.y, angle: (i / 3) * U.TAU + DOWN, warn: 1.2, active: 3.2, width: 16, spin: 0.7, color: '#ff3d6b', owner: e });
                }
                sfx('charge', e, 0.7);
              },
              tick(e, dt) {
                if (e.attackT > 1.2 && every(e, 'f', 0.6, dt)) P().ring(e.x, e.y, 16, 130, e.t, { color: '#ff7a95', r: 4 });
              },
            },
            {
              name: 'шторм',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.35, dt)) P().rain(6, 230, { color: '#ffb02e', r: 5, shape: 'needle' });
                if (every(e, 'g', 1, dt)) P().ringWithGap(e.x, e.y, 30, 170, 0.6, { color: '#ffffff', r: 5 });
              },
            },
          ],
        },
        {
          until: 0.2,
          move: moveSine(180, 0.7, 70, 1.4),
          attacks: [
            {
              name: 'хаос',
              dur: 5,
              tick(e, dt) {
                if (every(e, 'f', 0.07, dt)) P().fire(e.x, e.y, Math.random() * U.TAU, U.rand(120, 240), { color: U.pick(['#ff3d6b', '#33e1ff', '#ffe24f', '#c46bff']), r: 4 });
              },
            },
            {
              name: 'делящиеся',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 0.6, dt)) P().ring(e.x, e.y, 6, 130, e.t, { color: '#c46bff', r: 8, split: 1.0, splitN: 6 });
              },
            },
            {
              name: 'стены',
              dur: 4,
              tick(e, dt) {
                if (every(e, 'f', 1.0, dt)) P().wall(e.y + 70, 18, U.randInt(3, 14), 1.7, 200, { color: '#33e1ff', r: 6, shape: 'square' });
              },
            },
          ],
        },
        {
          until: 0,
          move(e, dt) {
            e.x = U.damp(e.x, W / 2 + Math.sin(e.t * 2) * 60, 3, dt);
            e.y = U.damp(e.y, e.homeY + Math.sin(e.t * 3) * 20, 3, dt);
          },
          attacks: [
            {
              name: 'последний протокол',
              dur: 8,
              tick(e, dt) {
                e.spiralA.angle += dt * 2.2;
                if (every(e, 'f', 0.09, dt)) P().spiral(e.spiralA, e.x, e.y, 3, 190, { color: '#ff3d6b', r: 5 });
                if (every(e, 'g', 0.8, dt)) P().fanAimed(e.x, e.y, 5, 0.5, 300, { color: '#ffffff', r: 6, shape: 'needle' });
              },
            },
          ],
        },
      ],
      death(e) {
        G.Background.flash('#ffffff', 1.2);
      },
      draw(ctx, e) {
        const col = ['#33e1ff', '#ff3d6b', '#c46bff', '#ffffff'][Math.min(3, e.phase)];
        E.glowCore(ctx, 0, 0, col, 220, 0.35);
        const radii = [92, 76, 62];
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.rotate(e.rings[i]);
          ctx.strokeStyle = U.rgba(col, 0.7 - i * 0.15);
          ctx.lineWidth = 3;
          ctx.setLineDash([24 - i * 6, 10 + i * 4]);
          ctx.beginPath();
          ctx.arc(0, 0, radii[i], 0, U.TAU);
          ctx.stroke();
          ctx.restore();
        }
        ctx.setLineDash([]);
        const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, 56);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.4, e.hitFlash > 0 ? '#ffffff' : col);
        grd.addColorStop(1, '#05060f');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, 56, 0, U.TAU);
        ctx.fill();
        // Пиктограмма «My AI» — стилизованный нейрон в центре.
        ctx.strokeStyle = '#05060f';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * U.TAU + e.t;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 22, Math.sin(a) * 22, 3, 0, U.TAU);
          ctx.stroke();
        }
      },
    })
  );

  G.Bosses = { every, moveSine, moveTrack, currentPhase };
})();
