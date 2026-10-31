/* My AI Arcade — многослойный космический фон с параллаксом. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const W = 540;
  const H = 960;

  const DEFAULT_THEME = {
    top: '#05060f',
    bottom: '#0b1030',
    nebula: ['#3a1c71', '#1c3f71'],
    stars: '#cfe8ff',
    dust: '#4fd1ff',
    grid: null,
    planet: null,
  };

  // Предрендер мягкого облака туманности.
  function makeNebulaSprite(color, size, seed) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const rng = U.makeRng(seed);
    for (let i = 0; i < 14; i++) {
      const x = size * (0.2 + rng() * 0.6);
      const y = size * (0.2 + rng() * 0.6);
      const r = size * (0.12 + rng() * 0.3);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, U.rgba(color, 0.16));
      grd.addColorStop(1, U.rgba(color, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, size, size);
    }
    return c;
  }

  function makePlanetSprite(p) {
    const r = p.radius;
    const pad = p.ring ? r * 0.9 : 8;
    const size = Math.ceil((r + pad) * 2);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    // Атмосфера
    const atm = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.25);
    atm.addColorStop(0, U.rgba(p.color, 0.35));
    atm.addColorStop(1, U.rgba(p.color, 0));
    g.fillStyle = atm;
    g.beginPath();
    g.arc(cx, cy, r * 1.25, 0, U.TAU);
    g.fill();
    // Тело с освещением
    const body = g.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
    body.addColorStop(0, U.mixColor(p.color, '#ffffff', 0.35));
    body.addColorStop(0.6, p.color);
    body.addColorStop(1, U.mixColor(p.color, '#000000', 0.75));
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cy, r, 0, U.TAU);
    g.fill();
    // Полосы
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, U.TAU);
    g.clip();
    const rng = U.makeRng(p.seed || 7);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = U.rgba(i % 2 ? '#000000' : '#ffffff', 0.06 + rng() * 0.06);
      const y = cy - r + rng() * r * 2;
      g.fillRect(cx - r, y, r * 2, 3 + rng() * r * 0.15);
    }
    g.restore();
    // Кольцо
    if (p.ring) {
      g.save();
      g.translate(cx, cy);
      g.rotate(-0.35);
      g.scale(1, 0.28);
      g.strokeStyle = U.rgba(p.ring, 0.55);
      g.lineWidth = r * 0.12;
      g.beginPath();
      g.arc(0, 0, r * 1.55, 0, U.TAU);
      g.stroke();
      g.strokeStyle = U.rgba(p.ring, 0.25);
      g.lineWidth = r * 0.08;
      g.beginPath();
      g.arc(0, 0, r * 1.8, 0, U.TAU);
      g.stroke();
      g.restore();
    }
    return c;
  }

  const B = (G.Background = {
    theme: DEFAULT_THEME,
    layers: [],
    nebulae: [],
    dust: [],
    planet: null,
    gridOffset: 0,
    speed: 1,
    targetSpeed: 1,
    time: 0,
    gradient: null,
    flashColor: null,
    flashT: 0,

    init() {
      this.layers = [
        { count: 90, speed: 18, size: 1, alpha: 0.45, stars: [] },
        { count: 55, speed: 45, size: 1.5, alpha: 0.7, stars: [] },
        { count: 22, speed: 95, size: 2.2, alpha: 1, stars: [] },
      ];
      for (const layer of this.layers) {
        for (let i = 0; i < layer.count; i++) {
          layer.stars.push({ x: Math.random() * W, y: Math.random() * H, tw: Math.random() * U.TAU });
        }
      }
      this.dust = [];
      for (let i = 0; i < 26; i++) {
        this.dust.push({ x: Math.random() * W, y: Math.random() * H, len: 10 + Math.random() * 30, speed: 220 + Math.random() * 260 });
      }
      this.setTheme(DEFAULT_THEME);
    },

    setTheme(theme) {
      this.theme = Object.assign({}, DEFAULT_THEME, theme || {});
      const t = this.theme;
      this.nebulae = [];
      const cols = t.nebula || [];
      for (let i = 0; i < 4; i++) {
        const col = cols[i % Math.max(1, cols.length)] || '#222244';
        this.nebulae.push({
          sprite: makeNebulaSprite(col, 420, 100 + i * 37 + (t.seed || 0)),
          x: Math.random() * W - 210,
          y: -200 + i * 320 - Math.random() * 100,
          speed: 10 + i * 4,
        });
      }
      this.planet = null;
      if (t.planet) {
        this.planet = {
          sprite: makePlanetSprite(t.planet),
          x: t.planet.x === undefined ? W * 0.75 : t.planet.x,
          y: -t.planet.radius * 2,
          speed: t.planet.speed || 6,
        };
      }
      this.gradient = null;
    },

    warp(on) {
      this.targetSpeed = on ? 6 : 1;
    },

    flash(color, dur) {
      this.flashColor = color;
      this.flashT = dur || 0.3;
      this.flashMax = this.flashT;
    },

    update(dt) {
      this.time += dt;
      this.speed = U.damp(this.speed, this.targetSpeed, 2.5, dt);
      const sp = this.speed;
      for (const layer of this.layers) {
        for (const s of layer.stars) {
          s.y += layer.speed * sp * dt;
          if (s.y > H + 4) {
            s.y -= H + 8;
            s.x = Math.random() * W;
          }
        }
      }
      for (const n of this.nebulae) {
        n.y += n.speed * sp * dt;
        if (n.y > H + 50) {
          n.y = -470;
          n.x = Math.random() * W - 210;
        }
      }
      if (this.planet) {
        this.planet.y += this.planet.speed * sp * dt;
        if (this.planet.y > H + this.planet.sprite.height) this.planet.y = -this.planet.sprite.height * 1.5;
      }
      for (const d of this.dust) {
        d.y += d.speed * sp * dt;
        if (d.y > H + 40) {
          d.y = -40;
          d.x = Math.random() * W;
        }
      }
      this.gridOffset = (this.gridOffset + 60 * sp * dt) % 60;
      if (this.flashT > 0) this.flashT -= dt;
    },

    draw(ctx) {
      const t = this.theme;
      if (!this.gradient) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, t.top);
        g.addColorStop(1, t.bottom);
        this.gradient = g;
      }
      ctx.fillStyle = this.gradient;
      ctx.fillRect(0, 0, W, H);

      // Туманности
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const n of this.nebulae) ctx.drawImage(n.sprite, n.x, n.y);
      ctx.restore();

      if (this.planet) {
        const p = this.planet;
        ctx.drawImage(p.sprite, p.x - p.sprite.width / 2, p.y - p.sprite.height / 2);
      }

      // Синтвейв-сетка внизу
      if (t.grid) this.drawGrid(ctx, t.grid);

      // Звёзды
      const stretch = Math.max(0, this.speed - 1.2) * 6;
      ctx.fillStyle = t.stars;
      ctx.strokeStyle = t.stars;
      for (const layer of this.layers) {
        for (const s of layer.stars) {
          const tw = 0.65 + 0.35 * Math.sin(this.time * 3 + s.tw);
          ctx.globalAlpha = layer.alpha * tw;
          if (stretch > 0.5) {
            ctx.lineWidth = layer.size;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x, s.y - stretch * layer.size * 3);
            ctx.stroke();
          } else {
            ctx.fillRect(s.x, s.y, layer.size, layer.size);
          }
        }
      }
      ctx.globalAlpha = 1;

      // Космическая пыль — придаёт ощущение скорости.
      ctx.strokeStyle = U.rgba(t.dust, 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.dust) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y - d.len * this.speed);
      }
      ctx.stroke();

      if (this.flashT > 0 && this.flashColor && G.Save.settings.flashes) {
        ctx.fillStyle = U.rgba(this.flashColor, (this.flashT / this.flashMax) * 0.35);
        ctx.fillRect(0, 0, W, H);
      }
    },

    drawGrid(ctx, color) {
      const horizon = H * 0.62;
      ctx.save();
      ctx.strokeStyle = U.rgba(color, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Горизонтальные линии с перспективой
      for (let i = 0; i < 14; i++) {
        const k = (i + this.gridOffset / 60) / 14;
        const y = horizon + Math.pow(k, 2.2) * (H - horizon);
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      // Вертикальные лучи из точки схода
      for (let i = -10; i <= 10; i++) {
        ctx.moveTo(W / 2 + i * 8, horizon);
        ctx.lineTo(W / 2 + i * 90, H);
      }
      ctx.stroke();
      const fade = ctx.createLinearGradient(0, horizon - 10, 0, horizon + 120);
      fade.addColorStop(0, U.rgba(this.theme.bottom, 1));
      fade.addColorStop(1, U.rgba(this.theme.bottom, 0));
      ctx.fillStyle = fade;
      ctx.fillRect(0, horizon - 10, W, 130);
      ctx.restore();
    },
  });

  B.W = W;
  B.H = H;
})();
