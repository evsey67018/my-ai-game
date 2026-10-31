/* My AI Arcade — система частиц с пулом объектов. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  const T_DOT = 0;
  const T_SPARK = 1;
  const T_SMOKE = 2;
  const T_RING = 3;
  const T_DEBRIS = 4;
  const T_TEXT = 5;
  const T_FLASH = 6;
  const T_SHARD = 7;

  function makeParticle() {
    return {
      type: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      size2: 0,
      color: '#fff',
      rot: 0,
      vrot: 0,
      drag: 0,
      grav: 0,
      text: '',
      width: 2,
      additive: true,
    };
  }

  const P = (G.Particles = {
    pool: new U.Pool(makeParticle, 600),
    textPool: new U.Pool(makeParticle, 40),
    maxParticles: 2200,

    quality() {
      const q = G.Save.settings.particles;
      return q === 'low' ? 0.35 : q === 'medium' ? 0.65 : 1;
    },

    add(type) {
      if (this.pool.count >= this.maxParticles) return null;
      const p = this.pool.get();
      p.type = type;
      p.rot = 0;
      p.vrot = 0;
      p.drag = 0;
      p.grav = 0;
      p.size2 = 0;
      p.width = 2;
      p.additive = true;
      return p;
    },

    // Искры — короткие светящиеся штрихи, летящие от точки.
    spark(x, y, color, count, speed, life, dir, spread) {
      count = Math.max(1, Math.round(count * this.quality()));
      for (let i = 0; i < count; i++) {
        const p = this.add(T_SPARK);
        if (!p) return;
        const a = dir === undefined ? Math.random() * U.TAU : dir + (Math.random() - 0.5) * (spread || 1);
        const s = speed * (0.3 + Math.random() * 0.9);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s;
        p.life = p.maxLife = (life || 0.4) * (0.5 + Math.random() * 0.7);
        p.size = 1.5 + Math.random() * 2;
        p.color = color;
        p.drag = 3;
      }
    },

    dots(x, y, color, count, speed, life, size) {
      count = Math.max(1, Math.round(count * this.quality()));
      for (let i = 0; i < count; i++) {
        const p = this.add(T_DOT);
        if (!p) return;
        const a = Math.random() * U.TAU;
        const s = speed * Math.random();
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s;
        p.life = p.maxLife = (life || 0.6) * (0.6 + Math.random() * 0.6);
        p.size = (size || 3) * (0.5 + Math.random());
        p.color = color;
        p.drag = 2;
      }
    },

    smoke(x, y, count, size, color) {
      count = Math.max(1, Math.round(count * this.quality()));
      for (let i = 0; i < count; i++) {
        const p = this.add(T_SMOKE);
        if (!p) return;
        const a = Math.random() * U.TAU;
        const s = 20 + Math.random() * 50;
        p.x = x + (Math.random() - 0.5) * size;
        p.y = y + (Math.random() - 0.5) * size;
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s + 30;
        p.life = p.maxLife = 0.6 + Math.random() * 0.8;
        p.size = size * (0.4 + Math.random() * 0.5);
        p.size2 = p.size * 2.2;
        p.color = color || '#444a66';
        p.drag = 1.5;
        p.additive = false;
      }
    },

    ring(x, y, radius, color, life, width) {
      const p = this.add(T_RING);
      if (!p) return;
      p.x = x;
      p.y = y;
      p.vx = p.vy = 0;
      p.size = radius * 0.15;
      p.size2 = radius;
      p.life = p.maxLife = life || 0.4;
      p.color = color;
      p.width = width || 3;
    },

    flash(x, y, radius, color, life) {
      const p = this.add(T_FLASH);
      if (!p) return;
      p.x = x;
      p.y = y;
      p.vx = p.vy = 0;
      p.size = radius;
      p.life = p.maxLife = life || 0.15;
      p.color = color || '#ffffff';
    },

    debris(x, y, color, count, speed) {
      count = Math.max(1, Math.round(count * this.quality()));
      for (let i = 0; i < count; i++) {
        const p = this.add(T_DEBRIS);
        if (!p) return;
        const a = Math.random() * U.TAU;
        const s = (speed || 160) * (0.4 + Math.random());
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s;
        p.life = p.maxLife = 0.6 + Math.random() * 0.8;
        p.size = 2 + Math.random() * 5;
        p.color = color;
        p.rot = Math.random() * U.TAU;
        p.vrot = (Math.random() - 0.5) * 14;
        p.drag = 1.2;
        p.additive = false;
      }
    },

    shards(x, y, color, count, speed) {
      count = Math.max(1, Math.round(count * this.quality()));
      for (let i = 0; i < count; i++) {
        const p = this.add(T_SHARD);
        if (!p) return;
        const a = Math.random() * U.TAU;
        const s = (speed || 220) * (0.5 + Math.random());
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * s;
        p.vy = Math.sin(a) * s;
        p.life = p.maxLife = 0.4 + Math.random() * 0.5;
        p.size = 3 + Math.random() * 6;
        p.color = color;
        p.rot = a;
        p.vrot = (Math.random() - 0.5) * 6;
        p.drag = 2.5;
      }
    },

    trail(x, y, color, size, life, vx, vy) {
      if (Math.random() > this.quality()) return;
      const p = this.add(T_DOT);
      if (!p) return;
      p.x = x;
      p.y = y;
      p.vx = vx || 0;
      p.vy = vy || 0;
      p.life = p.maxLife = life || 0.3;
      p.size = size || 3;
      p.color = color;
      p.drag = 4;
    },

    text(x, y, str, color, size, life) {
      const p = this.textPool.get();
      p.type = T_TEXT;
      p.x = x;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -70;
      p.life = p.maxLife = life || 0.9;
      p.size = size || 16;
      p.color = color || '#ffffff';
      p.text = str;
      p.drag = 2.5;
      p.grav = 0;
      p.additive = false;
    },

    // Комплексный взрыв: вспышка, кольцо, искры, обломки, дым.
    explosion(x, y, size, palette) {
      palette = palette || ['#ffcc33', '#ff6622', '#ffffff'];
      const c0 = palette[0];
      const c1 = palette[1] || c0;
      const c2 = palette[2] || '#ffffff';
      this.flash(x, y, size * 2.2, c2, 0.12 + size * 0.002);
      this.ring(x, y, size * 2.4, c0, 0.35 + size * 0.004, Math.max(2, size * 0.12));
      this.spark(x, y, c0, 6 + size * 0.6, 160 + size * 6, 0.5);
      this.spark(x, y, c1, 4 + size * 0.4, 100 + size * 4, 0.6);
      this.dots(x, y, c1, 4 + size * 0.3, 60 + size * 2, 0.7, 3 + size * 0.08);
      this.debris(x, y, palette[3] || '#8a8fa8', 2 + size * 0.15, 80 + size * 3);
      if (size > 18) this.smoke(x, y, 2 + size * 0.1, size * 0.8);
    },

    clear() {
      this.pool.clear();
      this.textPool.clear();
    },

    update(dt) {
      const step = function (p) {
        p.life -= dt;
        if (p.life <= 0) return false;
        if (p.drag) {
          const k = Math.max(0, 1 - p.drag * dt);
          p.vx *= k;
          p.vy *= k;
        }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        return true;
      };
      this.pool.sweep(step);
      this.textPool.sweep(step);
    },

    draw(ctx) {
      const items = this.pool.items;
      // Сначала непрозрачные (дым, обломки), потом аддитивные.
      ctx.save();
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        if (p.additive) continue;
        const k = p.life / p.maxLife;
        if (p.type === T_SMOKE) {
          const r = U.lerp(p.size2, p.size, k);
          ctx.globalAlpha = k * 0.35;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, U.TAU);
          ctx.fill();
        } else if (p.type === T_DEBRIS) {
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        if (!p.additive) continue;
        const k = p.life / p.maxLife;
        switch (p.type) {
          case T_DOT: {
            ctx.globalAlpha = k;
            ctx.fillStyle = p.color;
            const r = p.size * (0.4 + k * 0.6);
            ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
            break;
          }
          case T_SPARK: {
            ctx.globalAlpha = k;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size * k + 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
            ctx.stroke();
            break;
          }
          case T_RING: {
            const t = 1 - k;
            const r = U.lerp(p.size, p.size2, U.ease.outCubic(t));
            ctx.globalAlpha = k;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.width * k + 0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, U.TAU);
            ctx.stroke();
            break;
          }
          case T_FLASH: {
            U.drawGlow(ctx, p.x, p.y, p.color, p.size, k);
            break;
          }
          case T_SHARD: {
            ctx.globalAlpha = k;
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.beginPath();
            ctx.moveTo(p.size, 0);
            ctx.lineTo(-p.size * 0.5, p.size * 0.3);
            ctx.lineTo(-p.size * 0.5, -p.size * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            break;
          }
        }
      }
      ctx.restore();

      // Текст поверх всего.
      const texts = this.textPool.items;
      if (texts.length) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
          const p = texts[i];
          const k = p.life / p.maxLife;
          const pop = k > 0.85 ? U.ease.outBack((1 - k) / 0.15) : 1;
          ctx.globalAlpha = Math.min(1, k * 2.5);
          ctx.font = 'bold ' + Math.round(p.size * pop) + 'px "Segoe UI", Roboto, sans-serif';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
        }
        ctx.restore();
      }
    },

    get count() {
      return this.pool.count + this.textPool.count;
    },
  });
})();
