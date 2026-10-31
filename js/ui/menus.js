/* My AI Arcade — DOM-меню: главное, ангар, достижения, рекорды, настройки, пауза, перки, итоги. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  // Мини-помощник для создания элементов.
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c === null || c === undefined || c === false) continue;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return el;
  }

  function fmt(n) {
    return U.formatNumber(Math.round(n));
  }

  function fmtTime(sec) {
    sec = Math.round(sec || 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function plural(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  const Menus = (G.Menus = {
    root: null,
    stack: [],
    current: null,
    h,
    plural,

    init() {
      this.root = document.getElementById('ui-root');
      G.Events.on('state', (s, prev) => this.onState(s, prev));
      G.Events.on('perkChoice', (data) => this.showPerks(data));
      G.Events.on('gameOver', (res) => this.showResults(res, false));
      G.Events.on('victory', (res) => this.showResults(res, true));
      G.Events.on('keydown', (code, e) => this.onKey(code, e));
      G.Events.on('crystals', () => this.refreshCrystals());
      this.showMain();
    },

    onState(s) {
      if (s === 'playing') this.close();
      else if (s === 'paused') this.showPause();
    },

    // ---------- Управление экранами ----------
    open(screen, opts) {
      opts = opts || {};
      if (!opts.replace && this.current) this.stack.push(this.current.name);
      if (opts.replace) this.stack.length = 0;
      this.root.innerHTML = '';
      const builder = this.screens[screen];
      const el = builder.call(this, opts.data);
      el.classList.add('screen', 'screen-' + screen);
      if (opts.overlay) el.classList.add('overlay');
      this.root.appendChild(el);
      this.root.classList.add('active');
      this.current = { name: screen, el, data: opts.data };
      requestAnimationFrame(() => {
        el.classList.add('shown');
        const first = el.querySelector('[autofocus]') || el.querySelector('.btn:not([disabled])');
        if (first && !this.touchMode) first.focus({ preventScroll: true });
      });
    },

    back() {
      const prev = this.stack.pop();
      G.Audio.play('uiBack');
      if (!prev) return;
      this.current = null;
      const inGame = G.Game.state === 'paused';
      this.open(prev, { overlay: inGame });
    },

    close() {
      this.root.innerHTML = '';
      this.root.classList.remove('active');
      this.current = null;
      this.stack.length = 0;
    },

    refreshCrystals() {
      const els = this.root.querySelectorAll('.crystal-count');
      els.forEach((el) => (el.textContent = fmt(G.Save.data.crystals)));
    },

    showMain() {
      this.stack.length = 0;
      this.current = null;
      this.open('main', { replace: true });
    },

    showPause() {
      this.stack.length = 0;
      this.current = null;
      this.open('pause', { replace: true, overlay: true });
    },

    showPerks(data) {
      this.stack.length = 0;
      this.current = null;
      this.open('perks', { replace: true, overlay: true, data });
    },

    showResults(res, won) {
      this.stack.length = 0;
      this.current = null;
      this.open('results', { replace: true, overlay: true, data: { res, won } });
    },

    // Клавиатурная навигация по кнопкам меню.
    onKey(code, e) {
      if (!this.current) return;
      const name = this.current.name;
      if (code === 'Escape' || code === 'Backspace') {
        if (name === 'pause') {
          // Escape обрабатывается как пауза в Input — ничего не делаем.
          return;
        }
        if (this.stack.length && name !== 'perks' && name !== 'results') {
          e.preventDefault();
          this.back();
        }
        return;
      }
      const dirs = { ArrowUp: -1, ArrowLeft: -1, KeyW: -1, KeyA: -1, ArrowDown: 1, ArrowRight: 1, KeyS: 1, KeyD: 1 };
      if (dirs[code] !== undefined) {
        const items = Array.from(this.current.el.querySelectorAll('.btn:not([disabled]), .perk-card, input, select'));
        if (!items.length) return;
        e.preventDefault();
        let i = items.indexOf(document.activeElement);
        if (document.activeElement && document.activeElement.type === 'range' && (code === 'ArrowLeft' || code === 'ArrowRight')) return;
        i = i < 0 ? 0 : (i + dirs[code] + items.length) % items.length;
        items[i].focus();
        G.Audio.play('uiMove');
      }
      if (name === 'perks' && /^Digit[1-3]$/.test(code)) {
        G.Game.choosePerk(Number(code.slice(5)) - 1);
      }
    },

    button(label, onClick, opts) {
      opts = opts || {};
      return h(
        'button',
        {
          class: 'btn' + (opts.cls ? ' ' + opts.cls : ''),
          disabled: opts.disabled,
          autofocus: opts.autofocus,
          onclick: (e) => {
            e.preventDefault();
            G.Audio.init();
            G.Music.resumePending();
            if (!opts.silent) G.Audio.play('uiSelect');
            onClick(e);
          },
        },
        [opts.icon ? h('span', { class: 'btn-icon', text: opts.icon }) : null, h('span', { class: 'btn-label', text: label }), opts.hint ? h('span', { class: 'btn-hint', text: opts.hint }) : null]
      );
    },

    header(title, sub) {
      return h('div', { class: 'screen-header' }, [
        h('button', { class: 'back-btn', 'aria-label': 'Назад', onclick: () => this.back(), text: '←' }),
        h('div', { class: 'screen-title' }, [h('h2', { text: title }), sub ? h('p', { text: sub }) : null]),
        h('div', { class: 'crystals-pill' }, [h('span', { class: 'gem', text: '◆' }), h('span', { class: 'crystal-count', text: fmt(G.Save.data.crystals) })]),
      ]);
    },

    confirm(text, yes, onYes) {
      const layer = h('div', { class: 'confirm-layer' });
      const box = h('div', { class: 'confirm-box' }, [
        h('p', { text }),
        h('div', { class: 'row' }, [
          this.button(yes, () => {
            layer.remove();
            onYes();
          }, { cls: 'danger' }),
          this.button('Отмена', () => layer.remove(), { cls: 'ghost' }),
        ]),
      ]);
      layer.appendChild(box);
      this.root.appendChild(layer);
      setTimeout(() => {
        const b = box.querySelector('.ghost');
        if (b) b.focus();
      }, 30);
    },

    screens: {},
  });

  const S = Menus.screens;

  // ---------- Главное меню ----------
  S.main = function () {
    const save = G.Save.data;
    const ship = G.Data.shipById(save.selectedShip);
    const newAch = G.Data.achievements.length - G.Achievements.count();
    return h('div', { class: 'main-menu' }, [
      h('div', { class: 'logo' }, [
        h('div', { class: 'logo-top', text: 'My AI Arcade' }),
        h('h1', { class: 'logo-title' }, [h('span', { text: 'НЕЙРОННЫЙ' }), h('span', { class: 'accent', text: 'РУБЕЖ' })]),
        h('div', { class: 'logo-sub', text: 'космический шутер-рогалик' }),
      ]),
      h('div', { class: 'main-stats' }, [
        h('div', { class: 'stat' }, [h('span', { class: 'k', text: 'Рекорд' }), h('span', { class: 'v', text: fmt(save.highScore) })]),
        h('div', { class: 'stat' }, [h('span', { class: 'k', text: 'Кристаллы' }), h('span', { class: 'v gem-text' }, [h('span', { text: '◆ ' }), h('span', { class: 'crystal-count', text: fmt(save.crystals) })])]),
        h('div', { class: 'stat' }, [h('span', { class: 'k', text: 'Корабль' }), h('span', { class: 'v', style: 'color:' + ship.color, text: ship.name })]),
      ]),
      h('div', { class: 'menu-list' }, [
        Menus.button('Играть', () => startGame('campaign'), { cls: 'primary big', icon: '▶', autofocus: true, hint: save.bestLevel ? 'Лучший сектор: ' + save.bestLevel : 'Кампания: 6 секторов' }),
        Menus.button('Бесконечный режим', () => startGame('endless'), { icon: '∞', hint: save.highScoreEndless ? 'Рекорд: ' + fmt(save.highScoreEndless) : 'Волны без конца' }),
        Menus.button('Ангар', () => Menus.open('hangar'), { icon: '🛠', hint: 'Корабли и улучшения' }),
        h('div', { class: 'row' }, [
          Menus.button('Достижения', () => Menus.open('achievements'), { icon: '🏆', cls: 'half', hint: G.Achievements.count() + ' / ' + G.Data.achievements.length }),
          Menus.button('Рекорды', () => Menus.open('records'), { icon: '📊', cls: 'half' }),
        ]),
        h('div', { class: 'row' }, [
          Menus.button('Настройки', () => Menus.open('settings'), { icon: '⚙', cls: 'half' }),
          Menus.button('Как играть', () => Menus.open('howto'), { icon: '?', cls: 'half' }),
        ]),
      ]),
      h('div', { class: 'footer-note', text: newAch > 0 ? 'Осталось открыть достижений: ' + newAch : 'Все достижения открыты — вы легенда!' }),
    ]);
  };

  function startGame(mode) {
    G.Audio.init();
    Menus.close();
    if (!G.Save.data.tutorialSeen) {
      G.Save.data.tutorialSeen = true;
      G.Save.save();
      Menus.open('howto', { replace: true, data: { startMode: mode } });
      return;
    }
    G.Game.newGame(mode);
  }
  Menus.startGame = startGame;

  // ---------- Ангар ----------
  S.hangar = function (data) {
    const tab = (data && data.tab) || Menus.hangarTab || 'ships';
    Menus.hangarTab = tab;
    const body = h('div', { class: 'scroll' });
    const rerender = () => {
      body.innerHTML = '';
      if (Menus.hangarTab === 'ships') renderShips(body, rerender);
      else renderUpgrades(body, rerender);
      Menus.refreshCrystals();
    };
    const tabs = h('div', { class: 'tabs' }, [
      h('button', { class: 'tab' + (tab === 'ships' ? ' active' : ''), text: 'Корабли', onclick: (e) => switchTab(e, 'ships') }),
      h('button', { class: 'tab' + (tab === 'upgrades' ? ' active' : ''), text: 'Улучшения', onclick: (e) => switchTab(e, 'upgrades') }),
    ]);
    function switchTab(e, t) {
      Menus.hangarTab = t;
      tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === e.currentTarget));
      G.Audio.play('uiMove');
      rerender();
    }
    rerender();
    return h('div', { class: 'panel-screen' }, [Menus.header('Ангар', 'Тратьте кристаллы на корабли и вечные улучшения'), tabs, body]);
  };

  function shipPreview(ship) {
    const c = h('canvas', { width: 96, height: 96, class: 'ship-preview' });
    const ctx = c.getContext('2d');
    ctx.translate(48, 52);
    ctx.scale(1.4, 1.4);
    ctx.shadowColor = ship.color;
    ctx.shadowBlur = 14;
    U.shape(ctx, ship.shape, 1, 1);
    ctx.fillStyle = ship.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ship.accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -6, 3, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = ship.accent;
    ctx.fill();
    return c;
  }

  function statBar(label, value, max) {
    const pct = U.clamp(value / max, 0, 1) * 100;
    return h('div', { class: 'stat-bar' }, [h('span', { text: label }), h('div', { class: 'bar' }, [h('i', { style: 'width:' + pct.toFixed(0) + '%' })])]);
  }

  function renderShips(body, rerender) {
    const save = G.Save;
    for (const ship of G.Data.ships) {
      const owned = save.hasShip(ship.id);
      const selected = save.data.selectedShip === ship.id;
      const st = ship.stats;
      const wpn = G.Data.weapons[ship.weapon];
      let action;
      if (selected) action = h('div', { class: 'badge ok', text: '✓ Выбран' });
      else if (owned)
        action = Menus.button('Выбрать', () => {
          save.selectShip(ship.id);
          rerender();
        }, { cls: 'small' });
      else
        action = Menus.button('◆ ' + fmt(ship.price), () => {
          if (save.spendCrystals(ship.price)) {
            save.unlockShip(ship.id);
            save.selectShip(ship.id);
            G.Audio.play('buy');
            G.Events.emit('toast', { text: 'Корабль «' + ship.name + '» в вашем ангаре!', color: ship.color, icon: '🚀' });
            G.Achievements.check('shop');
            rerender();
          } else {
            G.Audio.play('uiError');
            G.Events.emit('toast', { text: 'Не хватает кристаллов', color: '#ff5d73', icon: '◆' });
          }
        }, { cls: 'small buy', disabled: save.data.crystals < ship.price, silent: true });
      body.appendChild(
        h('div', { class: 'card ship-card' + (selected ? ' selected' : '') + (owned ? '' : ' locked'), style: '--c:' + ship.color }, [
          shipPreview(ship),
          h('div', { class: 'card-body' }, [
            h('h3', { text: ship.name }),
            h('p', { class: 'desc', text: ship.desc }),
            h('div', { class: 'weapon-tag', style: 'color:' + wpn.color, text: wpn.icon + ' ' + wpn.name }),
            statBar('Прочность', st.maxHp, 8),
            statBar('Скорость', st.speed - 200, 200),
            statBar('Урон', st.damage * st.fireRate, 1.3),
          ]),
          h('div', { class: 'card-action' }, [action]),
        ])
      );
    }
  }

  function renderUpgrades(body, rerender) {
    const save = G.Save;
    for (const up of G.Data.upgrades) {
      const lvl = save.upgradeLevel(up.id);
      const maxed = lvl >= up.max;
      const cost = maxed ? 0 : G.Data.upgradeCost(up, lvl);
      const pips = h('div', { class: 'pips' });
      for (let i = 0; i < up.max; i++) pips.appendChild(h('i', { class: i < lvl ? 'on' : '' }));
      const action = maxed
        ? h('div', { class: 'badge ok', text: 'МАКС' })
        : Menus.button('◆ ' + fmt(cost), () => {
            if (save.spendCrystals(cost)) {
              save.setUpgradeLevel(up.id, lvl + 1);
              G.Audio.play('buy');
              G.Achievements.check('shop');
              rerender();
            } else {
              G.Audio.play('uiError');
            }
          }, { cls: 'small buy', disabled: save.data.crystals < cost, silent: true });
      body.appendChild(
        h('div', { class: 'card upgrade-card' + (maxed ? ' maxed' : '') }, [
          h('div', { class: 'up-icon', text: up.icon }),
          h('div', { class: 'card-body' }, [h('h3', {}, [up.name, h('span', { class: 'lvl', text: ' ' + lvl + '/' + up.max })]), h('p', { class: 'desc', text: up.desc }), pips]),
          h('div', { class: 'card-action' }, [action]),
        ])
      );
    }
  }

  // ---------- Достижения ----------
  S.achievements = function () {
    const grid = h('div', { class: 'scroll ach-grid' });
    for (const a of G.Data.achievements) {
      const got = G.Save.hasAchievement(a.id);
      grid.appendChild(
        h('div', { class: 'card ach' + (got ? ' got' : '') }, [
          h('div', { class: 'ach-icon', text: got ? a.icon : '🔒' }),
          h('div', { class: 'card-body' }, [h('h3', { text: a.name }), h('p', { class: 'desc', text: a.desc })]),
          h('div', { class: 'ach-reward', text: (got ? '✓ ' : '') + '◆' + a.reward }),
        ])
      );
    }
    const n = G.Achievements.count();
    return h('div', { class: 'panel-screen' }, [Menus.header('Достижения', 'Открыто ' + n + ' из ' + G.Data.achievements.length), grid]);
  };

  // ---------- Рекорды и статистика ----------
  S.records = function () {
    const save = G.Save.data;
    const s = save.stats;
    const lb = save.leaderboard || [];
    const table = h('div', { class: 'lb' });
    if (!lb.length) table.appendChild(h('p', { class: 'empty', text: 'Пока пусто. Сыграйте первый забег!' }));
    lb.forEach((e, i) => {
      const ship = G.Data.shipById(e.ship);
      const d = new Date(e.date);
      table.appendChild(
        h('div', { class: 'lb-row' + (i === 0 ? ' top' : '') }, [
          h('span', { class: 'rank', text: '#' + (i + 1) }),
          h('span', { class: 'score', text: fmt(e.score) }),
          h('span', { class: 'meta', text: (e.mode === 'endless' ? '∞ волна ' : 'сектор ') + e.level }),
          h('span', { class: 'ship', style: 'color:' + ship.color, text: ship.name }),
          h('span', { class: 'date', text: d.toLocaleDateString('ru-RU') }),
        ])
      );
    });
    const rows = [
      ['Забегов', s.runs],
      ['Побед', s.wins],
      ['Врагов уничтожено', s.kills],
      ['Боссов повержено', s.bossKills],
      ['Лучшее комбо', s.maxCombo],
      ['Лучшая волна (∞)', s.endlessBestWave],
      ['Перков взято', s.perksTaken],
      ['Кристаллов добыто', s.crystalsEarned],
      ['Время в игре', fmtTime(s.playTime)],
    ];
    const stats = h('div', { class: 'stats-grid' }, rows.map((r) => h('div', { class: 'srow' }, [h('span', { text: r[0] }), h('b', { text: typeof r[1] === 'number' ? fmt(r[1] || 0) : r[1] })])));
    return h('div', { class: 'panel-screen' }, [
      Menus.header('Рекорды', 'Кампания: ' + fmt(save.highScore) + ' · Бесконечный: ' + fmt(save.highScoreEndless)),
      h('div', { class: 'scroll' }, [h('h4', { text: 'Таблица лидеров' }), table, h('h4', { text: 'Статистика' }), stats]),
    ]);
  };

  // ---------- Настройки ----------
  S.settings = function () {
    const st = G.Save.settings;
    const set = (k, v) => {
      G.Save.setSetting(k, v);
    };
    const slider = (label, key, min, max, step, fmtFn) => {
      const out = h('span', { class: 'val', text: fmtFn(st[key]) });
      const input = h('input', {
        type: 'range',
        min,
        max,
        step,
        value: st[key],
        oninput: (e) => {
          const v = Number(e.target.value);
          set(key, v);
          out.textContent = fmtFn(v);
        },
        onchange: () => G.Audio.play('uiMove'),
      });
      return h('label', { class: 'setting' }, [h('span', { class: 'lbl', text: label }), input, out]);
    };
    const toggle = (label, key, hint) => {
      const input = h('input', {
        type: 'checkbox',
        checked: st[key] ? 'checked' : undefined,
        onchange: (e) => {
          set(key, e.target.checked);
          G.Audio.play('uiMove');
        },
      });
      return h('label', { class: 'setting toggle' }, [h('span', { class: 'lbl' }, [label, hint ? h('small', { text: hint }) : null]), input, h('span', { class: 'switch' })]);
    };
    const quality = h(
      'select',
      {
        onchange: (e) => {
          set('particles', e.target.value);
          G.Audio.play('uiMove');
        },
      },
      [
        ['high', 'Высокое'],
        ['medium', 'Среднее'],
        ['low', 'Низкое'],
      ].map((o) => h('option', { value: o[0], selected: st.particles === o[0] ? 'selected' : undefined, text: o[1] }))
    );
    const pct = (v) => Math.round(v * 100) + '%';
    return h('div', { class: 'panel-screen' }, [
      Menus.header('Настройки'),
      h('div', { class: 'scroll settings' }, [
        h('h4', { text: 'Звук' }),
        slider('Эффекты', 'sfx', 0, 1, 0.05, pct),
        slider('Музыка', 'music', 0, 1, 0.05, pct),
        h('h4', { text: 'Изображение' }),
        h('label', { class: 'setting' }, [h('span', { class: 'lbl', text: 'Частицы' }), quality]),
        toggle('Тряска экрана', 'shake'),
        toggle('Вспышки', 'flashes', 'Отключите, если вспышки неприятны'),
        toggle('Показывать FPS', 'showFps'),
        h('h4', { text: 'Управление' }),
        slider('Чувствительность касаний', 'touchSensitivity', 0.6, 2, 0.1, (v) => '×' + Number(v).toFixed(1)),
        toggle('Вибрация', 'vibration', 'На поддерживаемых телефонах'),
        h('h4', { text: 'Данные' }),
        Menus.button('Сбросить прогресс', () => {
          Menus.confirm('Удалить все рекорды, кристаллы, корабли и улучшения? Это нельзя отменить.', 'Удалить', () => {
            G.Save.reset();
            G.Events.emit('toast', { text: 'Прогресс сброшен', color: '#ff5d73', icon: '🗑' });
            Menus.showMain();
          });
        }, { cls: 'danger small' }),
      ]),
    ]);
  };

  // ---------- Как играть ----------
  S.howto = function (data) {
    const rows = [
      ['Движение', 'Стрелки / WASD', 'Ведите пальцем в любом месте экрана'],
      ['Стрельба', 'Автоматически', 'Автоматически'],
      ['Бомба', 'Пробел / X', 'Кнопка 💣'],
      ['Рывок', 'Shift / C', 'Кнопка ⚡ или двойное касание'],
      ['Точный режим', 'Z (зажать)', '—'],
      ['Пауза', 'Esc / P', 'Кнопка ❚❚'],
      ['Звук вкл/выкл', 'M', 'В настройках'],
    ];
    const table = h('div', { class: 'controls-table' }, [
      h('div', { class: 'ct-row head' }, [h('span', { text: '' }), h('span', { text: '⌨ Клавиатура' }), h('span', { text: '📱 Касание' })]),
    ].concat(rows.map((r) => h('div', { class: 'ct-row' }, [h('b', { text: r[0] }), h('span', { text: r[1] }), h('span', { text: r[2] })]))));
    const tips = [
      'Хитбокс корабля — маленькая светящаяся точка в центре. Пули, пролетающие совсем рядом, дают очки «граза» и ускоряют перезарядку рывка.',
      'Рывок делает вас неуязвимым на долю секунды — им можно проскакивать сквозь пули.',
      'Бомба уничтожает пули на экране и бьёт по всем врагам. Боссы получают меньше урона.',
      'Подбирайте ⬆ чтобы усилить оружие, а цветные значки — чтобы сменить его. Максимальный уровень — 5.',
      'Комбо растёт с каждым убийством и увеличивает множитель очков. Получили урон — комбо сгорает.',
      'После каждого сектора и мини-босса выберите один из трёх перков. Перки складываются!',
      'Кристаллы ◆ сохраняются между забегами — тратьте их в Ангаре.',
    ];
    const children = [
      data && data.startMode ? h('div', { class: 'screen-header' }, [h('div', { class: 'screen-title' }, [h('h2', { text: 'Как играть' }), h('p', { text: 'Короткий инструктаж перед вылетом' })])]) : Menus.header('Как играть'),
      h('div', { class: 'scroll' }, [table, h('h4', { text: 'Советы пилоту' }), h('ul', { class: 'tips' }, tips.map((t) => h('li', { text: t })))]),
    ];
    if (data && data.startMode) {
      children.push(
        h('div', { class: 'bottom-actions' }, [
          Menus.button('Понятно, в бой!', () => {
            Menus.close();
            G.Game.newGame(data.startMode);
          }, { cls: 'primary', autofocus: true }),
        ])
      );
    }
    return h('div', { class: 'panel-screen' }, children);
  };

  // ---------- Пауза ----------
  S.pause = function () {
    const g = G.Game;
    const run = g.run;
    const p = g.player;
    const perkWrap = h('div', { class: 'perk-chips' });
    if (p) {
      for (const id in p.perkStacks) {
        const pk = G.Data.perks.find((x) => x.id === id);
        if (!pk) continue;
        const n = p.perkStacks[id];
        perkWrap.appendChild(h('span', { class: 'chip', style: '--c:' + G.Data.rarity[pk.rarity].color, title: pk.desc, text: pk.icon + ' ' + pk.name + (n > 1 ? ' ×' + n : '') }));
      }
    }
    if (!perkWrap.children.length) perkWrap.appendChild(h('span', { class: 'muted', text: 'Перков пока нет' }));
    return h('div', { class: 'pause-menu' }, [
      h('h2', { class: 'big-title', text: 'ПАУЗА' }),
      run
        ? h('div', { class: 'run-mini' }, [
            h('span', { text: 'Очки: ' + fmt(run.score) }),
            h('span', { text: g.mode === 'endless' ? 'Волна ' + Math.max(1, run.wave) : 'Сектор ' + run.level }),
            h('span', { text: 'Время ' + fmtTime(run.time) }),
          ])
        : null,
      h('div', { class: 'menu-list' }, [
        Menus.button('Продолжить', () => g.resume(), { cls: 'primary', icon: '▶', autofocus: true, silent: true }),
        Menus.button('Настройки', () => Menus.open('settings'), { icon: '⚙' }),
        Menus.button('Как играть', () => Menus.open('howto'), { icon: '?' }),
        Menus.button('Выйти в меню', () => {
          Menus.confirm('Выйти в меню? Очки забега будут записаны, кристаллы останутся у вас.', 'Выйти', () => {
            g.quitToMenu();
            Menus.showMain();
          });
        }, { icon: '⏏', cls: 'ghost' }),
      ]),
      h('h4', { text: 'Перки забега' }),
      perkWrap,
    ]);
  };

  // ---------- Выбор перка ----------
  S.perks = function (data) {
    const titles = {
      level: ['Сектор зачищен!', 'Выберите улучшение перед прыжком'],
      mini: ['Мини-босс повержен!', 'Заберите трофей'],
      wave: ['Волна отбита!', 'Выберите улучшение'],
      boss: ['Босс уничтожен!', 'Выберите мощное улучшение'],
    };
    const t = titles[data.context] || titles.wave;
    const p = G.Game.player;
    const cards = h('div', { class: 'perk-cards' });
    data.perks.forEach((pk, i) => {
      const r = G.Data.rarity[pk.rarity];
      const have = (p && p.perkStacks[pk.id]) || 0;
      const card = h(
        'button',
        {
          class: 'perk-card rarity-' + pk.rarity,
          style: '--c:' + r.color + ';animation-delay:' + i * 0.08 + 's',
          onclick: () => {
            G.Audio.init();
            G.Game.choosePerk(i);
          },
        },
        [
          h('span', { class: 'perk-key', text: String(i + 1) }),
          h('div', { class: 'perk-icon', text: pk.icon }),
          h('div', { class: 'perk-rarity', text: r.name }),
          h('h3', { text: pk.name }),
          h('p', { text: pk.desc }),
          h('div', { class: 'perk-stack', text: pk.max > 1 ? 'Уровень ' + (have + 1) + ' из ' + pk.max : 'Уникальный' }),
        ]
      );
      cards.appendChild(card);
    });
    const canReroll = G.Save.data.crystals >= data.rerollCost;
    return h('div', { class: 'perk-screen' }, [
      h('h2', { class: 'big-title', text: t[0] }),
      h('p', { class: 'subtitle', text: t[1] }),
      cards,
      h('div', { class: 'row' }, [
        Menus.button('Перебросить ◆' + data.rerollCost, () => G.Game.rerollPerks(), { cls: 'small ghost', disabled: !canReroll, silent: true }),
        Menus.button('Пропустить (+◆15)', () => G.Game.choosePerk(-1), { cls: 'small ghost' }),
      ]),
    ]);
  };

  // ---------- Итоги забега ----------
  S.results = function (data) {
    const res = data.res || { run: G.Game.run, isRecord: false };
    const run = res.run;
    const won = data.won;
    const g = G.Game;
    const acc = run.kills;
    const rows = [
      [g.mode === 'endless' ? 'Волна' : 'Сектор', g.mode === 'endless' ? Math.max(1, run.wave) : run.level + ' / ' + G.Data.levels.length],
      ['Врагов уничтожено', fmt(acc)],
      ['Боссов', run.bossKills],
      ['Лучшее комбо', run.maxCombo],
      ['Грейзы', fmt(run.grazes)],
      ['Перков', run.perks],
      ['Время', fmtTime(run.time)],
      ['Кристаллы', '◆ ' + fmt(run.crystals)],
    ];
    const ship = G.Data.shipById(run.ship);
    return h('div', { class: 'results ' + (won ? 'won' : 'lost') }, [
      h('div', { class: 'res-kicker', text: won ? 'Ядро уничтожено' : 'Корабль «' + ship.name + '» потерян' }),
      h('h2', { class: 'big-title', text: won ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА' }),
      h('div', { class: 'final-score' }, [h('span', { class: 'k', text: 'Итоговый счёт' }), h('span', { class: 'v count-up', 'data-target': run.score, text: '0' })]),
      res.isRecord ? h('div', { class: 'record-badge', text: '★ НОВЫЙ РЕКОРД ★' }) : h('div', { class: 'muted', text: 'Рекорд: ' + fmt(g.mode === 'endless' ? G.Save.data.highScoreEndless : G.Save.data.highScore) }),
      h('div', { class: 'stats-grid' }, rows.map((r) => h('div', { class: 'srow' }, [h('span', { text: r[0] }), h('b', { text: String(r[1]) })]))),
      h('div', { class: 'menu-list' }, [
        Menus.button('Ещё раз', () => {
          Menus.close();
          g.newGame(g.mode);
        }, { cls: 'primary', icon: '↻', autofocus: true }),
        Menus.button('Ангар', () => {
          g.quitToMenu();
          Menus.showMain();
          Menus.open('hangar');
        }, { icon: '🛠' }),
        Menus.button('Главное меню', () => {
          g.quitToMenu();
          Menus.showMain();
        }, { icon: '⏏', cls: 'ghost' }),
      ]),
    ]);
  };

  // Анимация «счётчика» итоговых очков.
  const obs = new MutationObserver(() => {
    const el = document.querySelector('.count-up:not(.counting)');
    if (!el) return;
    el.classList.add('counting');
    const target = Number(el.getAttribute('data-target')) || 0;
    const t0 = performance.now();
    const dur = 1200;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(target * U.ease.outCubic(k));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('ui-root');
    if (root) obs.observe(root, { childList: true, subtree: true });
  });
})();
