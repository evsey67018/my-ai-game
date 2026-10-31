/* My AI Arcade — перки забега (выбор 1 из 3 после каждого сектора и мини-босса). */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  G.Data = G.Data || {};

  const RARITY = {
    common: { name: 'Обычный', color: '#9fb4d0', weight: 60 },
    rare: { name: 'Редкий', color: '#3fa9ff', weight: 28 },
    epic: { name: 'Эпический', color: '#c46bff', weight: 10 },
    legendary: { name: 'Легендарный', color: '#ffb02e', weight: 3 },
  };

  const PERKS = [
    // ---------- Обычные ----------
    {
      id: 'overheat',
      name: 'Перегрев',
      icon: '🔥',
      rarity: 'common',
      max: 5,
      desc: '+12% скорострельности.',
      apply(p) {
        p.stats.fireRate *= 1.12;
      },
    },
    {
      id: 'caliber',
      name: 'Крупный калибр',
      icon: '🎯',
      rarity: 'common',
      max: 5,
      desc: '+12% урона.',
      apply(p) {
        p.stats.damage *= 1.12;
      },
    },
    {
      id: 'thrusters',
      name: 'Маневровые дюзы',
      icon: '💨',
      rarity: 'common',
      max: 3,
      desc: '+10% скорости корабля.',
      apply(p) {
        p.stats.speed *= 1.1;
      },
    },
    {
      id: 'magnetism',
      name: 'Магнетизм',
      icon: '🧲',
      rarity: 'common',
      max: 3,
      desc: '+50% радиуса сбора.',
      apply(p) {
        p.stats.magnet *= 1.5;
      },
    },
    {
      id: 'repair',
      name: 'Полевой ремонт',
      icon: '🔧',
      rarity: 'common',
      max: 99,
      desc: 'Мгновенно восстанавливает 2 прочности.',
      apply(p) {
        p.heal(2);
      },
    },
    {
      id: 'velocity',
      name: 'Ускорители снарядов',
      icon: '➹',
      rarity: 'common',
      max: 3,
      desc: '+20% скорости пуль и +5% урона.',
      apply(p) {
        p.stats.bulletSpeed *= 1.2;
        p.stats.damage *= 1.05;
      },
    },
    {
      id: 'stockpile',
      name: 'Запас бомб',
      icon: '💣',
      rarity: 'common',
      max: 5,
      desc: '+2 бомбы.',
      apply(p) {
        p.bombs = Math.min(p.maxBombs, p.bombs + 2);
      },
    },
    {
      id: 'greed',
      name: 'Жадность',
      icon: '💰',
      rarity: 'common',
      max: 3,
      desc: '+25% очков и +10% кристаллов.',
      apply(p) {
        p.stats.scoreMul *= 1.25;
        p.stats.crystalMul *= 1.1;
      },
    },
    {
      id: 'graze',
      name: 'Танец на грани',
      icon: '🌀',
      rarity: 'common',
      max: 3,
      desc: 'Пролёт рядом с вражескими пулями даёт вдвое больше очков и заряжает оружие.',
      apply(p) {
        p.stats.grazeBonus *= 2;
      },
    },
    {
      id: 'luck',
      name: 'Счастливая звезда',
      icon: '🍀',
      rarity: 'common',
      max: 3,
      desc: '+30% шанса выпадения бонусов.',
      apply(p) {
        p.stats.luck *= 1.3;
      },
    },
    // ---------- Редкие ----------
    {
      id: 'piercing',
      name: 'Бронебойные пули',
      icon: '🗡️',
      rarity: 'rare',
      max: 3,
      desc: 'Снаряды пробивают +1 врага.',
      apply(p) {
        p.stats.pierce += 1;
      },
    },
    {
      id: 'hull',
      name: 'Композитная броня',
      icon: '🛡️',
      rarity: 'rare',
      max: 4,
      desc: '+1 к максимальной прочности и полное лечение.',
      apply(p) {
        p.maxHp += 1;
        p.hp = p.maxHp;
      },
    },
    {
      id: 'crit',
      name: 'Критический анализ',
      icon: '💥',
      rarity: 'rare',
      max: 3,
      desc: '+10% шанса критического удара (×2.5 урона).',
      apply(p) {
        p.stats.crit += 0.1;
      },
    },
    {
      id: 'explosive',
      name: 'Разрывные заряды',
      icon: '🎆',
      rarity: 'rare',
      max: 3,
      desc: 'Снаряды взрываются при попадании, задевая соседей.',
      apply(p) {
        p.stats.splash += 22;
      },
    },
    {
      id: 'ricochet',
      name: 'Рикошет',
      icon: '↩️',
      rarity: 'rare',
      max: 2,
      desc: 'Снаряды отскакивают от краёв экрана.',
      apply(p) {
        p.stats.bounce += 1;
      },
    },
    {
      id: 'cryo',
      name: 'Криопатроны',
      icon: '❄️',
      rarity: 'rare',
      max: 2,
      desc: 'Попадания замедляют врагов.',
      apply(p) {
        p.stats.slow = Math.min(0.6, p.stats.slow + 0.3);
      },
    },
    {
      id: 'drone',
      name: 'Дрон-напарник',
      icon: '🛰️',
      rarity: 'rare',
      max: 3,
      desc: 'Добавляет боевого дрона, который стреляет вместе с вами.',
      apply(p) {
        p.addDrone();
      },
    },
    {
      id: 'phase',
      name: 'Фазовый клинок',
      icon: '⚔️',
      rarity: 'rare',
      max: 2,
      desc: 'Рывок наносит урон всем врагам на пути и дольше даёт неуязвимость.',
      apply(p) {
        p.stats.dashDamage += 40;
        p.stats.dashInvuln += 0.15;
      },
    },
    {
      id: 'vampire',
      name: 'Нейровампиризм',
      icon: '🩸',
      rarity: 'rare',
      max: 2,
      desc: 'Каждые 40 уничтоженных врагов восстанавливают 1 прочность.',
      apply(p) {
        p.stats.lifesteal = p.stats.lifesteal ? Math.max(20, p.stats.lifesteal - 15) : 40;
      },
    },
    {
      id: 'bombPower',
      name: 'Термоядерная бомба',
      icon: '☢️',
      rarity: 'rare',
      max: 2,
      desc: 'Бомбы на 60% мощнее, +1 бомба.',
      apply(p) {
        p.stats.bombPower *= 1.6;
        p.bombs = Math.min(p.maxBombs, p.bombs + 1);
      },
    },
    // ---------- Эпические ----------
    {
      id: 'multishot',
      name: 'Мультизалп',
      icon: '🔱',
      rarity: 'epic',
      max: 2,
      desc: '+1 снаряд в каждом залпе.',
      apply(p) {
        p.stats.projectiles += 1;
      },
    },
    {
      id: 'shield',
      name: 'Энергощит',
      icon: '🔰',
      rarity: 'epic',
      max: 2,
      desc: 'Щит поглощает одно попадание и перезаряжается за 18 с (12 с на 2 ур.).',
      apply(p) {
        p.stats.shieldTime = p.stats.shieldTime ? 12 : 18;
        p.shield = true;
      },
    },
    {
      id: 'storm',
      name: 'Грозовой разум',
      icon: '🌩️',
      rarity: 'epic',
      max: 2,
      desc: '20% шанс, что уничтоженный враг выпустит цепную молнию.',
      apply(p) {
        p.stats.killChain += 0.2;
      },
    },
    {
      id: 'rage',
      name: 'Протокол ярости',
      icon: '😡',
      rarity: 'epic',
      max: 1,
      desc: 'Чем меньше прочности, тем больше урона (до +80%).',
      apply(p) {
        p.stats.rage = 0.8;
      },
    },
    {
      id: 'orbitals',
      name: 'Орбитальные лезвия',
      icon: '🪐',
      rarity: 'epic',
      max: 3,
      desc: 'Вокруг корабля вращаются лезвия, которые режут врагов и сбивают пули.',
      apply(p) {
        p.stats.orbitals += 2;
      },
    },
    {
      id: 'armory',
      name: 'Оружейник',
      icon: '🧰',
      rarity: 'epic',
      max: 2,
      desc: 'Уровень текущего оружия +1 (сверх обычного предела не поднимается).',
      apply(p) {
        p.upgradeWeapon(1);
      },
    },
    // ---------- Легендарные ----------
    {
      id: 'chrono',
      name: 'Хронос',
      icon: '⏳',
      rarity: 'legendary',
      max: 1,
      desc: 'При получении урона время замедляется на 2 секунды, а вражеские пули рядом исчезают.',
      apply(p) {
        p.stats.timeWarp = 2;
      },
    },
    {
      id: 'overdrive',
      name: 'Овердрайв',
      icon: '⚡',
      rarity: 'legendary',
      max: 1,
      desc: 'Серия из 25 убийств включает овердрайв: ×2 скорострельность на 6 секунд.',
      apply(p) {
        p.stats.overdrive = 25;
      },
    },
    {
      id: 'thorns',
      name: 'Колючая обшивка',
      icon: '🌵',
      rarity: 'legendary',
      max: 1,
      desc: 'При получении урона корабль выпускает кольцо из 24 снарядов.',
      apply(p) {
        p.stats.thorns = 24;
      },
    },
    {
      id: 'singularity',
      name: 'Карманная сингулярность',
      icon: '🕳️',
      rarity: 'legendary',
      max: 1,
      desc: 'Бомба создаёт чёрную дыру, затягивающую врагов и пули.',
      apply(p) {
        p.singularity = true;
      },
    },
  ];

  G.Data.perks = PERKS;
  G.Data.rarity = RARITY;

  // Выбор трёх различных перков с учётом редкости и стаков.
  G.Data.rollPerks = function (player, n, luckBonus) {
    const available = PERKS.filter((pk) => (player.perkStacks[pk.id] || 0) < pk.max);
    const chosen = [];
    const pool = available.slice();
    const boost = luckBonus || 0;
    while (chosen.length < n && pool.length) {
      const pk = U.weightedPick(pool, (x) => {
        let w = RARITY[x.rarity].weight;
        if (x.rarity !== 'common') w *= 1 + boost;
        // Лечение чаще предлагается, когда прочность низкая.
        if (x.id === 'repair' && player.hp <= 2) w *= 3;
        if (x.id === 'repair' && player.hp >= player.maxHp) w *= 0.1;
        return w;
      });
      chosen.push(pk);
      pool.splice(pool.indexOf(pk), 1);
    }
    return chosen;
  };
})();
