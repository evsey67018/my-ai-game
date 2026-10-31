/* My AI Arcade — ввод: клавиатура, касания (перетаскивание), геймпад. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  const BINDINGS = {
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    bomb: ['Space', 'KeyX', 'KeyB'],
    dash: ['ShiftLeft', 'ShiftRight', 'KeyC'],
    focus: ['KeyZ', 'ControlLeft'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter'],
    mute: ['KeyM'],
  };

  const I = (G.Input = {
    keys: {},
    prevKeys: {},
    actionsDown: {},
    actionsPressed: {},
    virtual: {},
    virtualPressed: {},
    canvas: null,
    touch: {
      active: false,
      id: null,
      lastX: 0,
      lastY: 0,
      dx: 0,
      dy: 0,
      startTime: 0,
      lastTap: 0,
    },
    mouse: { x: 0, y: 0, down: false },
    gamepad: { connected: false, axisX: 0, axisY: 0, buttons: {}, prevButtons: {} },
    usingTouch: false,
    lastDevice: 'keyboard',

    init(canvas) {
      this.canvas = canvas;
      const self = this;

      window.addEventListener('keydown', function (e) {
        if (e.repeat) {
          if (self.isGameKey(e.code)) e.preventDefault();
          return;
        }
        self.keys[e.code] = true;
        self.lastDevice = 'keyboard';
        if (self.isGameKey(e.code)) e.preventDefault();
        G.Events.emit('keydown', e.code, e);
      });
      window.addEventListener('keyup', function (e) {
        self.keys[e.code] = false;
      });
      window.addEventListener('blur', function () {
        self.keys = {};
        G.Events.emit('blur');
      });

      // Касания: игрок двигается относительно движения пальца (как в мобильных шутерах).
      const opts = { passive: false };
      canvas.addEventListener('touchstart', function (e) {
        self.usingTouch = true;
        self.lastDevice = 'touch';
        G.Events.emit('touchUsed');
        if (self.touch.id === null && e.changedTouches.length) {
          const t = e.changedTouches[0];
          const p = self.toLogical(t.clientX, t.clientY);
          self.touch.id = t.identifier;
          self.touch.active = true;
          self.touch.lastX = p.x;
          self.touch.lastY = p.y;
          const now = performance.now();
          // Двойное касание — рывок.
          if (now - self.touch.lastTap < 280) self.virtualPressed.dash = true;
          self.touch.lastTap = now;
          self.touch.startTime = now;
        }
        e.preventDefault();
      }, opts);
      canvas.addEventListener('touchmove', function (e) {
        for (const t of e.changedTouches) {
          if (t.identifier === self.touch.id) {
            const p = self.toLogical(t.clientX, t.clientY);
            self.touch.dx += p.x - self.touch.lastX;
            self.touch.dy += p.y - self.touch.lastY;
            self.touch.lastX = p.x;
            self.touch.lastY = p.y;
          }
        }
        e.preventDefault();
      }, opts);
      const endTouch = function (e) {
        for (const t of e.changedTouches) {
          if (t.identifier === self.touch.id) {
            self.touch.id = null;
            self.touch.active = false;
          }
        }
      };
      canvas.addEventListener('touchend', endTouch);
      canvas.addEventListener('touchcancel', endTouch);

      // Мышь: зажатая левая кнопка тоже позволяет «тащить» корабль.
      canvas.addEventListener('mousedown', function (e) {
        if (self.usingTouch) return;
        const p = self.toLogical(e.clientX, e.clientY);
        self.mouse.down = true;
        self.mouse.x = p.x;
        self.mouse.y = p.y;
        self.lastDevice = 'mouse';
      });
      window.addEventListener('mousemove', function (e) {
        if (!self.mouse.down) return;
        const p = self.toLogical(e.clientX, e.clientY);
        self.touch.dx += p.x - self.mouse.x;
        self.touch.dy += p.y - self.mouse.y;
        self.mouse.x = p.x;
        self.mouse.y = p.y;
      });
      window.addEventListener('mouseup', function () {
        self.mouse.down = false;
      });
      canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
      });

      window.addEventListener('gamepadconnected', function () {
        self.gamepad.connected = true;
        G.Events.emit('toast', '🎮 Геймпад подключён');
      });
      window.addEventListener('gamepaddisconnected', function () {
        self.gamepad.connected = false;
      });
    },

    // Привязка экранных кнопок (бомба, рывок, пауза) к действиям.
    bindButton(el, action) {
      const self = this;
      const press = function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.virtual[action] = true;
        self.virtualPressed[action] = true;
        el.classList.add('pressed');
      };
      const release = function (e) {
        e.preventDefault();
        self.virtual[action] = false;
        el.classList.remove('pressed');
      };
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      el.addEventListener('mousedown', press);
      el.addEventListener('mouseup', release);
      el.addEventListener('mouseleave', function () {
        self.virtual[action] = false;
        el.classList.remove('pressed');
      });
    },

    isGameKey(code) {
      for (const a in BINDINGS) if (BINDINGS[a].indexOf(code) >= 0) return true;
      return false;
    },

    toLogical(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: ((cx - r.left) / r.width) * 540,
        y: ((cy - r.top) / r.height) * 960,
      };
    },

    pollGamepad() {
      const gp = this.gamepad;
      if (!navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      let pad = null;
      for (const p of pads) if (p && p.connected) {
        pad = p;
        break;
      }
      gp.prevButtons = gp.buttons;
      gp.buttons = {};
      if (!pad) {
        gp.axisX = gp.axisY = 0;
        return;
      }
      const dz = 0.2;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      gp.axisX = Math.abs(ax) > dz ? ax : 0;
      gp.axisY = Math.abs(ay) > dz ? ay : 0;
      const b = pad.buttons;
      const pressed = (i) => !!(b[i] && b[i].pressed);
      gp.buttons.bomb = pressed(0) || pressed(3);
      gp.buttons.dash = pressed(1) || pressed(5);
      gp.buttons.focus = pressed(4) || pressed(6);
      gp.buttons.pause = pressed(9);
      gp.buttons.confirm = pressed(0);
      gp.buttons.up = pressed(12);
      gp.buttons.down = pressed(13);
      gp.buttons.left = pressed(14);
      gp.buttons.right = pressed(15);
      if (gp.axisX || gp.axisY || Object.values(gp.buttons).some(Boolean)) this.lastDevice = 'gamepad';
    },

    // Вызывается один раз в начале кадра.
    update() {
      this.pollGamepad();
      const gp = this.gamepad;
      for (const action in BINDINGS) {
        let down = false;
        for (const code of BINDINGS[action]) if (this.keys[code]) down = true;
        if (this.virtual[action]) down = true;
        if (gp.buttons[action]) down = true;
        const was = this.actionsDown[action];
        this.actionsDown[action] = down;
        this.actionsPressed[action] = (down && !was) || !!this.virtualPressed[action];
      }
      this.virtualPressed = {};
      if (this.actionsPressed.mute) {
        G.Audio.setMuted(!G.Audio.muted);
        G.Events.emit('toast', G.Audio.muted ? '🔇 Звук выключен' : '🔊 Звук включён');
      }
      if (this.actionsPressed.pause) G.Events.emit('pausePressed');
    },

    down(action) {
      return !!this.actionsDown[action];
    },
    pressed(action) {
      return !!this.actionsPressed[action];
    },

    axis() {
      let x = 0;
      let y = 0;
      if (this.down('left')) x -= 1;
      if (this.down('right')) x += 1;
      if (this.down('up')) y -= 1;
      if (this.down('down')) y += 1;
      x += this.gamepad.axisX;
      y += this.gamepad.axisY;
      const l = Math.sqrt(x * x + y * y);
      if (l > 1) {
        x /= l;
        y /= l;
      }
      return { x, y };
    },

    // Забирает накопленное смещение пальца/мыши.
    consumeDrag() {
      const s = G.Save.settings.touchSensitivity || 1;
      const d = { x: this.touch.dx * s, y: this.touch.dy * s };
      this.touch.dx = 0;
      this.touch.dy = 0;
      return d;
    },

    clearDrag() {
      this.touch.dx = 0;
      this.touch.dy = 0;
    },

    get dragging() {
      return this.touch.active || this.mouse.down;
    },

    clamp: U.clamp,
  });

  I.BINDINGS = BINDINGS;
})();
