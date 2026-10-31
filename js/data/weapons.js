/* My AI Arcade — оружие игрока. Уровни 1–5, у каждого своя механика. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  G.Data = G.Data || {};

  // Вспомогательная функция: выпустить пулю с учётом модификаторов игрока.
  function shot(p, o) {
    const st = p.stats;
    const speed = (o.speed || 900) * st.bulletSpeed;
    const ang = o.angle === undefined ? -Math.PI / 2 : o.angle;
    let dmg = o.dmg * st.damage * p.rageMultiplier();
    let crit = false;
    if (st.crit > 0 && Math.random() < st.crit) {
      dmg *= 2.5;
      crit = true;
    }
    return G.Bullets.firePlayer({
      x: p.x + (o.dx || 0),
      y: p.y + (o.dy === undefined ? -22 : o.dy),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: o.r || 4,
      dmg,
      crit,
      kind: o.kind || 'pulse',
      color: crit ? '#ffffff' : o.color,
      pierce: (o.pierce || 0) + st.pierce,
      life: o.life || 1.4,
      homing: o.homing || 0,
      splash: (o.splash || 0) + st.splash,
      bounce: st.bounce,
      slow: st.slow,
      len: o.len || 0,
    });
  }

  // Распределяет n снарядов веером шириной spread вокруг угла base.
  function fan(n, spread, base) {
    const out = [];
    if (n === 1) return [base];
    for (let i = 0; i < n; i++) out.push(base - spread / 2 + (spread * i) / (n - 1));
    return out;
  }

  const WEAPONS = {
    pulse: {
      id: 'pulse',
      name: 'Импульсный бластер',
      short: 'Бластер',
      icon: '⦿',
      color: '#33e1ff',
      desc: 'Надёжные скорострельные залпы. С уровнем добавляются стволы.',
      rate: [9, 10, 11, 12, 13.5],
      sound: 'shoot',
      fire(p, lvl) {
        const c = this.color;
        const extra = p.stats.projectiles;
        const lanes = [1, 2, 3, 4, 5][lvl - 1] + extra;
        const spacing = 11;
        for (let i = 0; i < lanes; i++) {
          const dx = (i - (lanes - 1) / 2) * spacing;
          const tilt = (i - (lanes - 1) / 2) * 0.025;
          shot(p, { dx, dmg: 9, color: c, speed: 980, angle: -Math.PI / 2 + tilt, r: 4, len: 14 });
        }
      },
    },
    spread: {
      id: 'spread',
      name: 'Веерная пушка',
      short: 'Веер',
      icon: '✷',
      color: '#ffb02e',
      desc: 'Широкий веер снарядов накрывает пол-экрана. Идеальна против роя.',
      rate: [5.5, 6, 6.5, 7, 7.5],
      sound: 'spread',
      fire(p, lvl) {
        const n = [3, 5, 5, 7, 9][lvl - 1] + p.stats.projectiles * 2;
        const spread = [0.5, 0.75, 0.9, 1.05, 1.2][lvl - 1];
        for (const a of fan(n, spread, -Math.PI / 2)) {
          shot(p, { angle: a, dmg: 7.5, color: this.color, speed: 760, r: 5, kind: 'spread', life: 0.9 });
        }
      },
    },
    laser: {
      id: 'laser',
      name: 'Фотонный лазер',
      short: 'Лазер',
      icon: '│',
      color: '#ff3df2',
      desc: 'Сверхбыстрые пронзающие лучи. Пробивают несколько врагов подряд.',
      rate: [12, 13, 14, 15, 16],
      sound: 'laser',
      fire(p, lvl) {
        const beams = [1, 1, 2, 2, 3][lvl - 1] + p.stats.projectiles;
        const pierce = [2, 3, 3, 4, 5][lvl - 1];
        for (let i = 0; i < beams; i++) {
          const dx = (i - (beams - 1) / 2) * 14;
          shot(p, { dx, dmg: 6.5 + lvl * 0.6, color: this.color, speed: 1600, kind: 'laser', pierce, r: 3, len: 40, life: 0.8 });
        }
      },
    },
    missile: {
      id: 'missile',
      name: 'Рой ракет',
      short: 'Ракеты',
      icon: '➶',
      color: '#7dff5a',
      desc: 'Самонаводящиеся ракеты сами находят цель и взрываются по площади.',
      rate: [3.2, 3.6, 4, 4.4, 5],
      sound: 'missile',
      fire(p, lvl) {
        const n = [2, 2, 3, 4, 4][lvl - 1] + p.stats.projectiles;
        for (let i = 0; i < n; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          const a = -Math.PI / 2 + side * (0.6 + Math.floor(i / 2) * 0.35);
          shot(p, {
            dx: side * 14,
            dy: -6,
            angle: a,
            dmg: 16 + lvl * 2,
            color: this.color,
            speed: 420,
            kind: 'missile',
            homing: 7 + lvl,
            splash: 38 + lvl * 4,
            r: 5,
            life: 2.4,
          });
        }
        // Центральный бластер, чтобы не было «мёртвой зоны».
        shot(p, { dmg: 6, color: '#c9ffbc', speed: 950, r: 3, len: 10 });
      },
    },
    plasma: {
      id: 'plasma',
      name: 'Плазменная волна',
      short: 'Плазма',
      icon: '◉',
      color: '#8c6bff',
      desc: 'Медленные мощные сгустки плазмы. Проходят насквозь и взрываются.',
      rate: [2.4, 2.7, 3, 3.3, 3.6],
      sound: 'plasma',
      fire(p, lvl) {
        const n = [1, 1, 2, 3, 3][lvl - 1] + p.stats.projectiles;
        const r = [11, 13, 13, 14, 16][lvl - 1];
        for (const a of fan(n, n > 1 ? 0.35 : 0, -Math.PI / 2)) {
          shot(p, { angle: a, dmg: 30 + lvl * 6, color: this.color, speed: 430, kind: 'plasma', pierce: 4 + lvl, r, splash: 50, life: 2.2 });
        }
      },
    },
    lightning: {
      id: 'lightning',
      name: 'Цепная молния',
      short: 'Молния',
      icon: 'ϟ',
      color: '#fff36b',
      desc: 'Мгновенный разряд перескакивает между врагами. Не промахивается.',
      rate: [4.5, 5, 5.5, 6, 6.5],
      sound: 'lightning',
      fire(p, lvl) {
        const chains = [3, 4, 5, 6, 8][lvl - 1] + p.stats.projectiles + p.stats.pierce;
        const dmg = (12 + lvl * 2.5) * p.stats.damage * p.rageMultiplier();
        const range = 330 + lvl * 25;
        const hit = G.Bullets.chainLightning(p.x, p.y - 20, chains, dmg, range, this.color);
        if (!hit) {
          // Нет целей — пускаем молнию вверх как обычный выстрел.
          shot(p, { dmg: 8, color: this.color, speed: 1200, kind: 'spark', r: 4, len: 18 });
        }
      },
    },
  };

  G.Data.weapons = WEAPONS;
  G.Data.weaponOrder = ['pulse', 'spread', 'laser', 'missile', 'plasma', 'lightning'];
  G.Data.MAX_WEAPON_LEVEL = 5;
  G.Data.weaponShot = shot;
  G.Data.weaponFan = fan;
  U.fan = fan;
})();
