/* My AI Arcade — постоянные улучшения ангара и корабли. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.Data = G.Data || {};

  // Каждое улучшение: максимум уровней, базовая цена, рост цены, применение к статам.
  const UPGRADES = [
    {
      id: 'hull',
      name: 'Усиленный корпус',
      icon: '🛡️',
      desc: '+1 к максимальной прочности корабля.',
      max: 5,
      cost: 60,
      growth: 1.75,
      apply(s, lvl) {
        s.maxHp += lvl;
      },
    },
    {
      id: 'damage',
      name: 'Калибровка орудий',
      icon: '🎯',
      desc: '+8% урона всего оружия.',
      max: 10,
      cost: 40,
      growth: 1.45,
      apply(s, lvl) {
        s.damage *= 1 + 0.08 * lvl;
      },
    },
    {
      id: 'fireRate',
      name: 'Охлаждение стволов',
      icon: '🔥',
      desc: '+6% скорострельности.',
      max: 8,
      cost: 45,
      growth: 1.5,
      apply(s, lvl) {
        s.fireRate *= 1 + 0.06 * lvl;
      },
    },
    {
      id: 'speed',
      name: 'Форсаж двигателей',
      icon: '🚀',
      desc: '+5% скорости корабля.',
      max: 5,
      cost: 35,
      growth: 1.5,
      apply(s, lvl) {
        s.speed *= 1 + 0.05 * lvl;
      },
    },
    {
      id: 'magnet',
      name: 'Гравимагнит',
      icon: '🧲',
      desc: '+30% радиуса притяжения бонусов и кристаллов.',
      max: 5,
      cost: 30,
      growth: 1.45,
      apply(s, lvl) {
        s.magnet *= 1 + 0.3 * lvl;
      },
    },
    {
      id: 'bombs',
      name: 'Арсенал бомб',
      icon: '💣',
      desc: '+1 бомба в начале забега.',
      max: 3,
      cost: 90,
      growth: 1.9,
      apply(s, lvl) {
        s.bombs += lvl;
      },
    },
    {
      id: 'startWeapon',
      name: 'Заводской тюнинг',
      icon: '⚙️',
      desc: 'Начальный уровень оружия +1.',
      max: 2,
      cost: 150,
      growth: 2.2,
      apply(s, lvl) {
        s.startWeaponLevel += lvl;
      },
    },
    {
      id: 'dash',
      name: 'Фазовый рывок',
      icon: '⚡',
      desc: '−12% перезарядки рывка.',
      max: 5,
      cost: 40,
      growth: 1.5,
      apply(s, lvl) {
        s.dashCooldown *= Math.pow(0.88, lvl);
      },
    },
    {
      id: 'greed',
      name: 'Сборщик данных',
      icon: '💎',
      desc: '+12% кристаллов за забег.',
      max: 5,
      cost: 70,
      growth: 1.6,
      apply(s, lvl) {
        s.crystalMul *= 1 + 0.12 * lvl;
      },
    },
    {
      id: 'luck',
      name: 'Нейроудача',
      icon: '🍀',
      desc: '+10% шанса выпадения бонусов.',
      max: 5,
      cost: 55,
      growth: 1.55,
      apply(s, lvl) {
        s.luck *= 1 + 0.1 * lvl;
      },
    },
    {
      id: 'regen',
      name: 'Нанобот-ремонт',
      icon: '🔧',
      desc: 'Восстанавливает 1 прочность каждые N секунд без урона (60 → 35 с).',
      max: 3,
      cost: 120,
      growth: 1.8,
      apply(s, lvl) {
        if (lvl > 0) s.regenTime = [0, 60, 45, 35][lvl];
      },
    },
    {
      id: 'drone',
      name: 'Дрон сопровождения',
      icon: '🛰️',
      desc: 'Начинайте забег с боевым дроном (до 2).',
      max: 2,
      cost: 200,
      growth: 2,
      apply(s, lvl) {
        s.drones += lvl;
      },
    },
    {
      id: 'revive',
      name: 'Резервное ядро ИИ',
      icon: '♻️',
      desc: 'Один раз за забег воскрешает корабль с половиной прочности.',
      max: 1,
      cost: 400,
      growth: 1,
      apply(s, lvl) {
        s.revives += lvl;
      },
    },
  ];

  const SHIPS = [
    {
      id: 'spark',
      name: 'Искра',
      desc: 'Сбалансированный перехватчик. Хорош во всём.',
      price: 0,
      color: '#33e1ff',
      accent: '#ffffff',
      weapon: 'pulse',
      stats: { maxHp: 5, speed: 330, damage: 1, fireRate: 1, magnet: 1 },
      shape: [0, -26, 9, -8, 22, 10, 20, 18, 7, 14, 0, 20, -7, 14, -20, 18, -22, 10, -9, -8],
    },
    {
      id: 'hammer',
      name: 'Молот',
      desc: 'Тяжёлый штурмовик: больше брони и урона, но медленнее.',
      price: 300,
      color: '#ff9d2e',
      accent: '#ffe2b8',
      weapon: 'spread',
      stats: { maxHp: 7, speed: 285, damage: 1.15, fireRate: 0.92, magnet: 1 },
      shape: [0, -24, 12, -14, 26, 4, 26, 20, 10, 16, 0, 22, -10, 16, -26, 20, -26, 4, -12, -14],
    },
    {
      id: 'phantom',
      name: 'Призрак',
      desc: 'Сверхманёвренный охотник. Быстрый рывок, хрупкий корпус.',
      price: 450,
      color: '#c46bff',
      accent: '#f1d9ff',
      weapon: 'laser',
      stats: { maxHp: 4, speed: 380, damage: 1, fireRate: 1.1, magnet: 1.3, dashCooldown: 0.7 },
      shape: [0, -30, 6, -6, 24, 16, 8, 10, 0, 18, -8, 10, -24, 16, -6, -6],
    },
    {
      id: 'nova',
      name: 'Нова',
      desc: 'Экспериментальный корабль «My AI». Начинает с дроном и молнией.',
      price: 900,
      color: '#7dff5a',
      accent: '#eaffdf',
      weapon: 'lightning',
      stats: { maxHp: 5, speed: 340, damage: 1.05, fireRate: 1, magnet: 1.5, drones: 1 },
      shape: [0, -28, 10, -12, 16, -14, 24, 8, 12, 18, 0, 12, -12, 18, -24, 8, -16, -14, -10, -12],
    },
  ];

  G.Data.upgrades = UPGRADES;
  G.Data.ships = SHIPS;
  G.Data.upgradeCost = function (up, lvl) {
    return Math.round(up.cost * Math.pow(up.growth, lvl));
  };
  G.Data.shipById = function (id) {
    return SHIPS.find((s) => s.id === id) || SHIPS[0];
  };

  // Сборка итоговых характеристик корабля: корабль + ангар.
  G.Data.buildBaseStats = function (shipId) {
    const ship = G.Data.shipById(shipId);
    const s = {
      maxHp: 5,
      speed: 330,
      damage: 1,
      fireRate: 1,
      magnet: 1,
      bombs: 2,
      startWeaponLevel: 1,
      dashCooldown: 2.4,
      crystalMul: 1,
      scoreMul: 1,
      luck: 1,
      regenTime: 0,
      drones: 0,
      revives: 0,
      projectiles: 0,
      pierce: 0,
      bulletSpeed: 1,
      crit: 0,
      splash: 0,
      bounce: 0,
      slow: 0,
      lifesteal: 0,
      shieldTime: 0,
      dashDamage: 0,
      dashInvuln: 0.35,
      rage: 0,
      grazeBonus: 1,
      thorns: 0,
      bombPower: 1,
      killChain: 0,
      orbitals: 0,
      timeWarp: 0,
      overdrive: 0,
    };
    for (const k in ship.stats) {
      if (k === 'dashCooldown') s.dashCooldown *= ship.stats[k];
      else s[k] = ship.stats[k];
    }
    for (const up of UPGRADES) {
      const lvl = G.Save.upgradeLevel(up.id);
      if (lvl > 0) up.apply(s, lvl);
    }
    s.startWeaponLevel = Math.min(s.startWeaponLevel, 3);
    return s;
  };
})();
