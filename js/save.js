/* My AI Arcade — сохранение прогресса в localStorage. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const KEY = 'myai-arcade-save-v1';

  function defaults() {
    return {
      version: 1,
      highScore: 0,
      highScoreEndless: 0,
      bestLevel: 0,
      crystals: 0,
      upgrades: {},
      achievements: {},
      ships: { spark: true },
      selectedShip: 'spark',
      leaderboard: [],
      stats: {
        kills: 0,
        bossKills: 0,
        runs: 0,
        deaths: 0,
        wins: 0,
        playTime: 0,
        powerups: 0,
        bombs: 0,
        dashes: 0,
        maxCombo: 0,
        crystalsEarned: 0,
        shotsFired: 0,
        perksTaken: 0,
        endlessBestWave: 0,
      },
      settings: {
        sfx: 0.8,
        music: 0.55,
        shake: true,
        particles: 'high',
        showFps: false,
        vibration: true,
        touchSensitivity: 1.2,
        flashes: true,
      },
      tutorialSeen: false,
    };
  }

  // Рекурсивно дополняем загруженные данные недостающими полями по умолчанию.
  function merge(target, def) {
    for (const k in def) {
      if (!(k in target)) target[k] = def[k];
      else if (
        def[k] &&
        typeof def[k] === 'object' &&
        !Array.isArray(def[k]) &&
        target[k] &&
        typeof target[k] === 'object'
      ) {
        merge(target[k], def[k]);
      }
    }
    return target;
  }

  const Save = (G.Save = {
    data: defaults(),
    available: true,

    load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data = merge(parsed, defaults());
        }
      } catch (e) {
        this.available = false;
        console.warn('[save] localStorage недоступен, прогресс не сохранится', e);
        this.data = defaults();
      }
      return this.data;
    },

    save() {
      if (!this.available) return;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {
        this.available = false;
      }
    },

    reset() {
      this.data = defaults();
      this.save();
    },

    get settings() {
      return this.data.settings;
    },

    setSetting(key, value) {
      this.data.settings[key] = value;
      this.save();
      if (G.Events) G.Events.emit('settings', key, value);
    },

    // ---------- Валюта ----------
    addCrystals(n) {
      n = Math.max(0, Math.floor(n));
      this.data.crystals += n;
      this.data.stats.crystalsEarned += n;
      this.save();
      if (G.Events) G.Events.emit('crystals', this.data.crystals);
      return this.data.crystals;
    },
    spendCrystals(n) {
      if (this.data.crystals < n) return false;
      this.data.crystals -= n;
      this.save();
      if (G.Events) G.Events.emit('crystals', this.data.crystals);
      return true;
    },

    // ---------- Улучшения ----------
    upgradeLevel(id) {
      return this.data.upgrades[id] || 0;
    },
    setUpgradeLevel(id, lvl) {
      this.data.upgrades[id] = lvl;
      this.save();
    },

    // ---------- Корабли ----------
    hasShip(id) {
      return !!this.data.ships[id];
    },
    unlockShip(id) {
      this.data.ships[id] = true;
      this.save();
    },
    selectShip(id) {
      if (this.hasShip(id)) {
        this.data.selectedShip = id;
        this.save();
      }
    },

    // ---------- Достижения ----------
    hasAchievement(id) {
      return !!this.data.achievements[id];
    },
    unlockAchievement(id) {
      if (this.data.achievements[id]) return false;
      this.data.achievements[id] = Date.now();
      this.save();
      return true;
    },

    // ---------- Рекорды ----------
    submitScore(entry) {
      const lb = this.data.leaderboard;
      lb.push(entry);
      lb.sort((a, b) => b.score - a.score);
      lb.length = Math.min(lb.length, 10);
      let isRecord = false;
      if (entry.mode === 'endless') {
        if (entry.score > this.data.highScoreEndless) {
          this.data.highScoreEndless = entry.score;
          isRecord = true;
        }
      } else if (entry.score > this.data.highScore) {
        this.data.highScore = entry.score;
        isRecord = true;
      }
      this.save();
      return isRecord;
    },

    addStat(key, n) {
      this.data.stats[key] = (this.data.stats[key] || 0) + (n === undefined ? 1 : n);
    },
    maxStat(key, v) {
      if (v > (this.data.stats[key] || 0)) this.data.stats[key] = v;
    },
  });

  // Простейшая шина событий для связи модулей без прямых зависимостей.
  G.Events = {
    handlers: {},
    on(name, fn) {
      (this.handlers[name] = this.handlers[name] || []).push(fn);
    },
    off(name, fn) {
      const list = this.handlers[name];
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit(name) {
      const list = this.handlers[name];
      if (!list) return;
      const args = Array.prototype.slice.call(arguments, 1);
      for (const fn of list.slice()) fn.apply(null, args);
    },
  };

  Save.load();
})();
