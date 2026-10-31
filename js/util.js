/* My AI Arcade — утилиты: математика, случайность, пулы, цвета. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = (G.U = {});

  U.TAU = Math.PI * 2;
  U.DEG = Math.PI / 180;

  // ---------- Базовая математика ----------
  U.clamp = function (v, a, b) {
    return v < a ? a : v > b ? b : v;
  };
  U.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };
  U.invLerp = function (a, b, v) {
    if (a === b) return 0;
    return (v - a) / (b - a);
  };
  U.remap = function (v, a1, b1, a2, b2) {
    return U.lerp(a2, b2, U.invLerp(a1, b1, v));
  };
  U.approach = function (cur, target, step) {
    if (cur < target) return Math.min(cur + step, target);
    if (cur > target) return Math.max(cur - step, target);
    return target;
  };
  U.damp = function (cur, target, lambda, dt) {
    return U.lerp(cur, target, 1 - Math.exp(-lambda * dt));
  };
  U.sign = function (v) {
    return v < 0 ? -1 : v > 0 ? 1 : 0;
  };
  U.dist = function (ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  };
  U.dist2 = function (ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
  };
  U.angleTo = function (ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  };
  U.wrapAngle = function (a) {
    while (a > Math.PI) a -= U.TAU;
    while (a < -Math.PI) a += U.TAU;
    return a;
  };
  U.angleDiff = function (a, b) {
    return U.wrapAngle(b - a);
  };
  U.rotateToward = function (cur, target, maxStep) {
    const d = U.angleDiff(cur, target);
    if (Math.abs(d) <= maxStep) return target;
    return cur + Math.sign(d) * maxStep;
  };
  U.len = function (x, y) {
    return Math.sqrt(x * x + y * y);
  };
  U.normalize = function (x, y) {
    const l = Math.sqrt(x * x + y * y) || 1;
    return { x: x / l, y: y / l };
  };
  U.circleHit = function (ax, ay, ar, bx, by, br) {
    const r = ar + br;
    return U.dist2(ax, ay, bx, by) <= r * r;
  };
  U.pointInRect = function (px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  };
  // Расстояние от точки до отрезка — используется для лучей.
  U.distToSegment = function (px, py, x1, y1, x2, y2) {
    const vx = x2 - x1;
    const vy = y2 - y1;
    const wx = px - x1;
    const wy = py - y1;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.sqrt(wx * wx + wy * wy);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return U.dist(px, py, x2, y2);
    const t = c1 / c2;
    return U.dist(px, py, x1 + t * vx, y1 + t * vy);
  };

  // ---------- Сглаживание ----------
  U.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    outBounce: (t) => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
  };

  // ---------- Случайность ----------
  // mulberry32 — быстрый детерминированный ГПСЧ для сидов уровней.
  U.makeRng = function (seed) {
    let a = seed >>> 0;
    const rng = function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.int = (lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.chance = (p) => rng() < p;
    return rng;
  };
  U.rand = function (a, b) {
    if (b === undefined) {
      b = a;
      a = 0;
    }
    return a + Math.random() * (b - a);
  };
  U.randInt = function (a, b) {
    return Math.floor(a + Math.random() * (b - a + 1));
  };
  U.chance = function (p) {
    return Math.random() < p;
  };
  U.pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };
  U.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  };
  U.weightedPick = function (items, weightFn) {
    let total = 0;
    for (const it of items) total += weightFn(it);
    let r = Math.random() * total;
    for (const it of items) {
      r -= weightFn(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  };
  U.sampleWithoutReplacement = function (arr, n) {
    return U.shuffle(arr.slice()).slice(0, n);
  };

  // ---------- Цвета ----------
  U.hexToRgb = function (hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  U.rgbToHex = function (r, g, b) {
    const to = (v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + to(r) + to(g) + to(b);
  };
  U.mixColor = function (c1, c2, t) {
    const a = U.hexToRgb(c1);
    const b = U.hexToRgb(c2);
    return U.rgbToHex(U.lerp(a.r, b.r, t), U.lerp(a.g, b.g, t), U.lerp(a.b, b.b, t));
  };
  U.rgba = function (hex, alpha) {
    const c = U.hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  };
  U.hsl = function (h, s, l, a) {
    if (a === undefined) return 'hsl(' + h + ',' + s + '%,' + l + '%)';
    return 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')';
  };
  const rgbaCache = new Map();
  U.rgbaCached = function (hex, alpha) {
    const q = Math.round(alpha * 20) / 20;
    const key = hex + q;
    let v = rgbaCache.get(key);
    if (!v) {
      v = U.rgba(hex, q);
      if (rgbaCache.size > 4000) rgbaCache.clear();
      rgbaCache.set(key, v);
    }
    return v;
  };

  // ---------- Форматирование ----------
  U.formatNumber = function (n) {
    n = Math.floor(n);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  };
  U.formatTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };
  // Склонение русских слов по числу: plural(5, 'очко', 'очка', 'очков').
  U.plural = function (n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  };
  U.romanize = function (num) {
    const map = [
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I'],
    ];
    let out = '';
    for (const [v, s] of map) {
      while (num >= v) {
        out += s;
        num -= v;
      }
    }
    return out;
  };

  // ---------- Пул объектов ----------
  // Чтобы не создавать тысячи объектов каждую секунду (частицы, пули).
  U.Pool = class Pool {
    constructor(factory, size) {
      this.factory = factory;
      this.items = [];
      this.free = [];
      for (let i = 0; i < (size || 0); i++) this.free.push(factory());
    }
    get() {
      const it = this.free.length ? this.free.pop() : this.factory();
      this.items.push(it);
      return it;
    }
    // Удаляет «мёртвые» объекты; pred(it) === true значит «живой».
    sweep(pred) {
      const items = this.items;
      let w = 0;
      for (let r = 0; r < items.length; r++) {
        const it = items[r];
        if (pred(it)) items[w++] = it;
        else this.free.push(it);
      }
      items.length = w;
    }
    clear() {
      for (const it of this.items) this.free.push(it);
      this.items.length = 0;
    }
    get count() {
      return this.items.length;
    }
  };

  // Быстрое удаление мёртвых элементов из массива на месте.
  U.compact = function (arr, isAlive) {
    let w = 0;
    for (let r = 0; r < arr.length; r++) {
      if (isAlive(arr[r])) arr[w++] = arr[r];
    }
    arr.length = w;
    return arr;
  };

  // ---------- Таймеры и твины ----------
  U.Tweener = class Tweener {
    constructor() {
      this.list = [];
    }
    to(obj, props, duration, easing, onDone) {
      const from = {};
      for (const k in props) from[k] = obj[k];
      this.list.push({
        obj,
        from,
        to: props,
        t: 0,
        d: duration,
        e: easing || U.ease.outQuad,
        done: onDone,
      });
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const tw = this.list[i];
        tw.t += dt;
        const k = U.clamp(tw.t / tw.d, 0, 1);
        const e = tw.e(k);
        for (const p in tw.to) tw.obj[p] = U.lerp(tw.from[p], tw.to[p], e);
        if (k >= 1) {
          this.list.splice(i, 1);
          if (tw.done) tw.done();
        }
      }
    }
    clear() {
      this.list.length = 0;
    }
  };

  // Список отложенных вызовов, работающий в игровом времени (учитывает паузу).
  U.Scheduler = class Scheduler {
    constructor() {
      this.tasks = [];
      this.time = 0;
    }
    after(delay, fn) {
      this.tasks.push({ at: this.time + delay, fn });
    }
    every(interval, times, fn) {
      for (let i = 0; i < times; i++) this.after(interval * i, () => fn(i));
    }
    update(dt) {
      this.time += dt;
      for (let i = this.tasks.length - 1; i >= 0; i--) {
        const t = this.tasks[i];
        if (this.time >= t.at) {
          this.tasks.splice(i, 1);
          t.fn();
        }
      }
    }
    clear() {
      this.tasks.length = 0;
      this.time = 0;
    }
  };

  // ---------- Рисование ----------
  U.polygon = function (ctx, x, y, r, sides, rot) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * U.TAU;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  U.star = function (ctx, x, y, r1, r2, points, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const a = rot + (i / (points * 2)) * U.TAU;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  // Рисует путь по списку точек [x0,y0,x1,y1,...] относительно центра, с масштабом.
  U.shape = function (ctx, pts, sx, sy) {
    ctx.beginPath();
    ctx.moveTo(pts[0] * sx, pts[1] * sy);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * sx, pts[i + 1] * sy);
    ctx.closePath();
  };
  U.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  // Свечение: кэшируем радиальные градиенты как отдельные холсты.
  const glowCache = new Map();
  U.glowSprite = function (color, radius) {
    const key = color + '|' + radius;
    let c = glowCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    const size = radius * 2;
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grd.addColorStop(0, U.rgba(color, 1));
    grd.addColorStop(0.25, U.rgba(color, 0.55));
    grd.addColorStop(0.6, U.rgba(color, 0.15));
    grd.addColorStop(1, U.rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    glowCache.set(key, c);
    return c;
  };
  U.drawGlow = function (ctx, x, y, color, radius, alpha) {
    const spr = U.glowSprite(color, Math.max(4, Math.round(radius / 4) * 4));
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * (alpha === undefined ? 1 : alpha);
    ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
    ctx.globalAlpha = prev;
  };

  // ---------- Прочее ----------
  U.isTouchDevice = function () {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  };
  U.uid = (function () {
    let n = 0;
    return function () {
      return ++n;
    };
  })();
  U.deepClone = function (o) {
    return JSON.parse(JSON.stringify(o));
  };
  U.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  U.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
})();
