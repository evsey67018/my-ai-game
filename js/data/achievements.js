/* My AI Arcade — достижения. Проверяются при игровых событиях. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.Data = G.Data || {};

  // check(s, r, ev): s — общая статистика, r — текущий забег, ev — событие.
  const ACH = [
    { id: 'first_blood', name: 'Первая кровь', icon: '🩸', desc: 'Уничтожьте первого врага.', reward: 10, check: (s) => s.kills >= 1 },
    { id: 'hundred', name: 'Сотня', icon: '💯', desc: 'Уничтожьте 100 врагов за всё время.', reward: 25, check: (s) => s.kills >= 100 },
    { id: 'thousand', name: 'Тысяча целей', icon: '🏭', desc: 'Уничтожьте 1000 врагов за всё время.', reward: 100, check: (s) => s.kills >= 1000 },
    { id: 'tenk', name: 'Машина войны', icon: '🤖', desc: 'Уничтожьте 10 000 врагов за всё время.', reward: 400, check: (s) => s.kills >= 10000 },
    { id: 'boss1', name: 'Стражу конец', icon: '👾', desc: 'Победите первого босса.', reward: 30, check: (s) => s.bossKills >= 1 },
    { id: 'boss_all', name: 'Охотник на титанов', icon: '🏆', desc: 'Победите 10 боссов за всё время.', reward: 150, check: (s) => s.bossKills >= 10 },
    { id: 'sector3', name: 'Глубокий космос', icon: '🌌', desc: 'Доберитесь до 3-го сектора.', reward: 40, check: (s, r) => r && r.level >= 3 },
    { id: 'sector5', name: 'Край карты', icon: '🗺️', desc: 'Доберитесь до 5-го сектора.', reward: 80, check: (s, r) => r && r.level >= 5 },
    { id: 'victory', name: 'Победа над Ядром', icon: '👑', desc: 'Пройдите кампанию до конца.', reward: 300, check: (s) => s.wins >= 1 },
    { id: 'combo50', name: 'Комбо-мастер', icon: '🔗', desc: 'Наберите комбо ×50.', reward: 40, check: (s, r) => r && r.maxCombo >= 50 },
    { id: 'combo150', name: 'Непрерывный поток', icon: '⛓️', desc: 'Наберите комбо ×150.', reward: 120, check: (s, r) => r && r.maxCombo >= 150 },
    { id: 'score50k', name: 'Пятьдесят тысяч', icon: '⭐', desc: 'Наберите 50 000 очков за забег.', reward: 40, check: (s, r) => r && r.score >= 50000 },
    { id: 'score250k', name: 'Четверть миллиона', icon: '🌟', desc: 'Наберите 250 000 очков за забег.', reward: 120, check: (s, r) => r && r.score >= 250000 },
    { id: 'score1m', name: 'Миллионер', icon: '💫', desc: 'Наберите 1 000 000 очков за забег.', reward: 300, check: (s, r) => r && r.score >= 1000000 },
    { id: 'maxweapon', name: 'Полная мощность', icon: '🔋', desc: 'Прокачайте оружие до 5 уровня.', reward: 30, check: (s, r) => r && r.weaponMaxed },
    { id: 'nohit', name: 'Неприкасаемый', icon: '👻', desc: 'Пройдите сектор, не получив урона.', reward: 80, check: (s, r, ev) => ev === 'levelClear' && r && r.levelDamage === 0 },
    { id: 'nobomb_boss', name: 'Честный бой', icon: '🤝', desc: 'Победите босса, не используя бомбы во время боя.', reward: 60, check: (s, r, ev) => ev === 'bossKill' && r && r.bossBombs === 0 },
    { id: 'graze100', name: 'По лезвию', icon: '🌀', desc: '100 касаний пуль за один забег.', reward: 50, check: (s, r) => r && r.grazes >= 100 },
    { id: 'perks10', name: 'Коллекционер', icon: '🃏', desc: 'Соберите 10 перков за один забег.', reward: 60, check: (s, r) => r && r.perks >= 10 },
    { id: 'drones3', name: 'Эскадрилья', icon: '🛰️', desc: 'Летайте одновременно с тремя дронами.', reward: 60, check: (s, r) => r && r.maxDrones >= 3 },
    { id: 'bomber', name: 'Подрывник', icon: '💣', desc: 'Используйте 50 бомб за всё время.', reward: 40, check: (s) => s.bombs >= 50 },
    { id: 'rich', name: 'Хранилище данных', icon: '💎', desc: 'Заработайте 2000 кристаллов за всё время.', reward: 100, check: (s) => s.crystalsEarned >= 2000 },
    { id: 'endless10', name: 'Бесконечность не предел', icon: '♾️', desc: 'Достигните 10-й волны в бесконечном режиме.', reward: 100, check: (s) => s.endlessBestWave >= 10 },
    { id: 'hangar', name: 'Инженер', icon: '🛠️', desc: 'Купите 15 уровней улучшений в ангаре.', reward: 50, check: () => Object.values(G.Save.data.upgrades).reduce((a, b) => a + b, 0) >= 15 },
    { id: 'fleet', name: 'Флотилия', icon: '🚢', desc: 'Откройте все корабли.', reward: 200, check: () => G.Data.ships.every((sh) => G.Save.hasShip(sh.id)) },
    { id: 'survivor', name: 'На последнем издыхании', icon: '❤️‍🩹', desc: 'Победите босса, имея 1 прочность.', reward: 70, check: (s, r, ev) => ev === 'bossKill' && G.Game.player && G.Game.player.hp === 1 },
  ];

  G.Data.achievements = ACH;

  G.Achievements = {
    check(ev) {
      const s = G.Save.data.stats;
      const r = G.Game && G.Game.run;
      for (const a of ACH) {
        if (G.Save.hasAchievement(a.id)) continue;
        let ok = false;
        try {
          ok = a.check(s, r, ev);
        } catch (e) {
          ok = false;
        }
        if (ok) {
          G.Save.unlockAchievement(a.id);
          G.Save.addCrystals(a.reward);
          G.Audio.play('achievement');
          G.Events.emit('achievement', a);
        }
      }
    },
    count() {
      return ACH.filter((a) => G.Save.hasAchievement(a.id)).length;
    },
  };
})();
