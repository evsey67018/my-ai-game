/* My AI Arcade — игровой интерфейс (HUD), рисуется прямо на холсте. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;
  const W = 540;
  const H = 960;
  const FONT = '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif';

  const HUD = (G.HUD = {
    displayScore: 0,
    banners: [],
    warning: null,
    bossIntro: null,
    hurtFlash: 0,
    comboPulse: 0,
    fps: 60,
    fpsAcc: 0,
    fpsFrames: 0,
    levelCard: null,
    bossBarShown: 0,
    miniBarShown: 0,
    lowHpPulse: 0,

    init() {
      G.Events.on('banner', (b) => this.banner(b.text, b.color, b.sub));
      G.Events.on('bossWarning', (w) => {
        this.warning = { t: 0, dur: 3, type: w.type };
      });
      G.Events.on('bossStart', (e) => {
        this.bossIntro = { t: 0, dur: 2.6, title: e.def.title || e.def.name, name: e.def.name };
      });
      G.Events.on('levelStart', (info) => {
        this.levelCard = { t: 0, dur: 3.4, name: info.name, subtitle: info.subtitle, intro: info.intro };
      });
      G.Events.on('levelClear', (info) => {
        this.banner('СЕКТОР ЗАЧИЩЕН', '#7dff5a', info.noHit ? 'Без повреждений! +' + U.formatNumber(info.bonus) : '');
      });
      G.Events.on('playerHurt', () => {
        this.hurtFlash = 0.35;
      });
      G.Events.on('combo', () => {
        this.comboPulse = 0.4;
      });
      G.Events.on('state', (s) => {
        if (s === 'playing' && G.Game.run && G.Game.run.time === 0) this.reset();
      });
    },

    reset() {
      this.displayScore = 0;
      this.banners.length = 0;
      this.warning = null;
      this.bossIntro = null;
      this.hurtFlash = 0;
      this.bossBarShown = 0;
      this.miniBarShown = 0;
    },

    banner(text, color, sub) {
      this.banners.push({ text, color: color || '#ffffff', sub: sub || '', t: 0, dur: 2.4 });
      if (this.banners.length > 3) this.banners.shift();
    },

    // Вызывается из главного цикла с реальным временем кадра.
    tick(realDt) {
      this.fpsAcc += realDt;
      this.fpsFrames++;
      if (this.fpsAcc >= 0.5) {
        this.fps = Math.round(this.fpsFrames / this.fpsAcc);
        this.fpsAcc = 0;
        this.fpsFrames = 0;
      }
      if (G.Game.state !== 'playing') return;
      const dt = realDt;
      const run = G.Game.run;
      if (run) {
        const diff = run.score - this.displayScore;
        this.displayScore += diff * Math.min(1, dt * 10);
        if (Math.abs(diff) < 1) this.displayScore = run.score;
      }
      for (const b of this.banners) b.t += dt;
      this.banners = this.banners.filter((b) => b.t < b.dur);
      if (this.warning) {
        this.warning.t += dt;
        if (this.warning.t >= this.warning.dur) this.warning = null;
      }
      if (this.bossIntro) {
        this.bossIntro.t += dt;
        if (this.bossIntro.t >= this.bossIntro.dur) this.bossIntro = null;
      }
      if (this.levelCard) {
        this.levelCard.t += dt;
        if (this.levelCard.t >= this.levelCard.dur) this.levelCard = null;
      }
      if (this.hurtFlash > 0) this.hurtFlash -= dt;
      if (this.comboPulse > 0) this.comboPulse -= dt;
      this.lowHpPulse += dt;
      this.bossBarShown = U.lerp(this.bossBarShown, G.Game.boss ? 1 : 0, Math.min(1, dt * 4));
      this.miniBarShown = U.lerp(this.miniBarShown, G.Game.miniBoss ? 1 : 0, Math.min(1, dt * 4));
    },

    // ---------- Отрисовка ----------
    draw(ctx) {
      const game = G.Game;
      const p = game.player;
      const run = game.run;
      if (!run) return;
      ctx.save();
      this.drawVignette(ctx, p);
      this.drawTopBar(ctx, run, game);
      if (p) {
        this.drawHealth(ctx, p);
        this.drawBottom(ctx, p);
      }
      this.drawBossBar(ctx, game);
      this.drawProgress(ctx, game);
      this.drawLevelCard(ctx);
      this.drawBanners(ctx);
      this.drawWarning(ctx);
      this.drawBossIntro(ctx);
      if (G.Save.settings.showFps) {
        ctx.font = '12px ' + FONT;
        ctx.textAlign = 'right';
        ctx.fillStyle = this.fps >= 55 ? '#7dff5a' : this.fps >= 40 ? '#ffe24f' : '#ff5d73';
        ctx.fillText(this.fps + ' FPS', W - 10, H - 70);
      }
      ctx.restore();
    },

    drawVignette(ctx, p) {
      if (this.hurtFlash > 0 && G.Save.settings.flashes) {
        const a = this.hurtFlash / 0.35;
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
        g.addColorStop(0, 'rgba(255,40,60,0)');
        g.addColorStop(1, 'rgba(255,40,60,' + (0.5 * a).toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      if (p && p.alive && p.hp === 1) {
        const a = 0.18 + 0.12 * Math.sin(this.lowHpPulse * 6);
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
        g.addColorStop(0, 'rgba(255,0,40,0)');
        g.addColorStop(1, 'rgba(255,0,40,' + a.toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    },

    panel(ctx, x, y, w, h, r) {
      ctx.fillStyle = 'rgba(8,12,30,0.55)';
      U.roundRect(ctx, x, y, w, h, r || 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,200,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    },

    drawTopBar(ctx, run, game) {
      // Очки
      this.panel(ctx, 8, 8, 206, 54);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#8fb7e8';
      ctx.font = '600 11px ' + FONT;
      ctx.fillText('ОЧКИ', 18, 25);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 24px ' + FONT;
      ctx.fillText(U.formatNumber(Math.round(this.displayScore)), 18, 52);

      // Рекорд
      const best = game.mode === 'endless' ? G.Save.data.highScoreEndless : G.Save.data.highScore;
      ctx.textAlign = 'right';
      ctx.fillStyle = run.score > best && best > 0 ? '#ffe24f' : '#6d86a8';
      ctx.font = '600 11px ' + FONT;
      ctx.fillText((run.score > best && best > 0 ? 'НОВЫЙ РЕКОРД' : 'РЕКОРД ' + U.formatNumber(best)), 206, 25);

      // Сектор / волна
      this.panel(ctx, W - 132, 8, 124, 54);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8fb7e8';
      ctx.font = '600 11px ' + FONT;
      ctx.fillText(game.mode === 'endless' ? 'ВОЛНА' : 'СЕКТОР', W - 18, 25);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 24px ' + FONT;
      ctx.fillText(game.mode === 'endless' ? String(Math.max(1, run.wave)) : run.level + ' / ' + G.Data.levels.length, W - 18, 52);

      // Кристаллы
      ctx.textAlign = 'left';
      ctx.font = '600 13px ' + FONT;
      ctx.fillStyle = '#5ef0ff';
      ctx.fillText('◆ ' + run.crystals, W - 126, 25);

      // Комбо
      if (game.combo >= 5) {
        const mult = game.comboMult();
        const k = Math.max(0, game.comboTimer / game.comboMax);
        const pulse = this.comboPulse > 0 ? 1 + this.comboPulse : 1;
        const cx = W / 2 + 14;
        ctx.save();
        ctx.translate(cx, 36);
        ctx.scale(pulse, pulse);
        ctx.textAlign = 'center';
        ctx.font = '800 22px ' + FONT;
        const hue = Math.min(60, game.combo / 4);
        ctx.fillStyle = 'hsl(' + (190 - hue * 3) + ',100%,65%)';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.fillText(game.combo + '×', 0, 0);
        ctx.shadowBlur = 0;
        ctx.font = '600 11px ' + FONT;
        ctx.fillStyle = '#d0e4ff';
        ctx.fillText('КОМБО  ×' + mult.toFixed(1), 0, 16);
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(cx - 50, 58, 100, 3);
        ctx.fillStyle = '#5ef0ff';
        ctx.fillRect(cx - 50, 58, 100 * k, 3);
      }
    },

    drawHealth(ctx, p) {
      const y = 76;
      const n = p.maxHp;
      const size = n > 10 ? 10 : 13;
      for (let i = 0; i < n; i++) {
        const x = 18 + i * (size * 1.7);
        const filled = i < p.hp;
        ctx.save();
        ctx.translate(x, y);
        this.heart(ctx, size, filled ? '#ff5d73' : 'rgba(255,93,115,0.18)', filled);
        ctx.restore();
      }
      if (p.shield > 0) {
        const x = 18 + n * (size * 1.7) + 4;
        ctx.fillStyle = '#5ef0ff';
        ctx.font = '700 14px ' + FONT;
        ctx.textAlign = 'left';
        ctx.fillText('⛨' + (p.shield > 1 ? '×' + p.shield : ''), x, y + 5);
      }
      if (p.revives > 0) {
        ctx.fillStyle = '#ffb02e';
        ctx.font = '600 12px ' + FONT;
        ctx.textAlign = 'left';
        ctx.fillText('✚ ' + p.revives, 18, y + 24);
      }
    },

    heart(ctx, s, color, glow) {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.45, -s * 0.85, 0, -s * 0.35);
      ctx.bezierCurveTo(s * 0.45, -s * 0.85, s * 0.9, -s * 0.2, 0, s * 0.35);
      ctx.closePath();
      ctx.fillStyle = color;
      if (glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    },

    drawBottom(ctx, p) {
      const y = H - 52;
      this.panel(ctx, 8, y, W - 16, 44, 12);

      // Оружие
      const wd = p.weaponDef;
      ctx.textAlign = 'left';
      ctx.fillStyle = wd.color;
      ctx.font = '700 20px ' + FONT;
      ctx.fillText(wd.icon, 20, y + 29);
      ctx.font = '700 13px ' + FONT;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(wd.short || wd.name, 44, y + 20);
      const maxL = G.Data.MAX_WEAPON_LEVEL;
      for (let i = 0; i < maxL; i++) {
        ctx.fillStyle = i < p.weaponLevel ? wd.color : 'rgba(255,255,255,0.15)';
        ctx.fillRect(44 + i * 14, y + 27, 11, 6);
      }

      // Бомбы
      const bx = 190;
      ctx.fillStyle = '#8fb7e8';
      ctx.font = '600 10px ' + FONT;
      ctx.fillText('БОМБЫ', bx, y + 15);
      for (let i = 0; i < p.maxBombs; i++) {
        ctx.beginPath();
        ctx.arc(bx + 6 + i * 15, y + 29, 5, 0, Math.PI * 2);
        ctx.fillStyle = i < p.bombs ? '#ff8a3d' : 'rgba(255,138,61,0.15)';
        ctx.fill();
      }

      // Рывок
      const dx = 300;
      ctx.fillStyle = '#8fb7e8';
      ctx.fillText('РЫВОК', dx, y + 15);
      const ready = p.dashCd <= 0;
      const k = ready ? 1 : 1 - p.dashCd / p.stats.dashCooldown;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(dx, y + 25, 70, 8);
      ctx.fillStyle = ready ? '#5ef0ff' : '#3a6d90';
      ctx.fillRect(dx, y + 25, 70 * U.clamp(k, 0, 1), 8);

      // Овердрайв / дроны
      const ox = 390;
      ctx.fillStyle = '#8fb7e8';
      ctx.fillText('ДРОНЫ', ox, y + 15);
      for (let i = 0; i < 4; i++) {
        U.polygon(ctx, ox + 6 + i * 15, y + 29, 5, 3, -Math.PI / 2);
        ctx.fillStyle = i < p.drones.length ? '#7dff5a' : 'rgba(125,255,90,0.15)';
        ctx.fill();
      }
      if (p.overdriveTimer > 0) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffe24f';
        ctx.font = '800 12px ' + FONT;
        ctx.fillText('ОВЕРДРАЙВ ' + p.overdriveTimer.toFixed(1), W - 18, y - 8);
      }
    },

    drawBossBar(ctx, game) {
      const drawBar = (e, y, h, shown, label, color) => {
        if (shown < 0.02 || !e) return;
        ctx.save();
        ctx.globalAlpha = shown;
        const x = 30;
        const w = W - 60;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
        const frac = U.clamp(e.displayHp !== undefined ? e.displayHp : e.hp / e.maxHp, 0, 1);
        const real = U.clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x, y, w * frac, h);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, color);
        g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w * real, h);
        // Отметки фаз
        if (e.def.phases) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          for (const ph of e.def.phases) {
            if (ph.until > 0 && ph.until < 1) ctx.fillRect(x + w * ph.until - 1, y, 2, h);
          }
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 12px ' + FONT;
        ctx.textAlign = 'left';
        ctx.fillText(label, x, y - 6);
        if (e.entering || e.transition > 0) {
          ctx.textAlign = 'right';
          ctx.fillStyle = '#9fb4d0';
          ctx.fillText('НЕУЯЗВИМ', x + w, y - 6);
        }
        ctx.restore();
      };
      const boss = game.boss;
      drawBar(boss, 112, 10, this.bossBarShown, boss ? (boss.def.title || boss.def.name).toUpperCase() : '', boss ? boss.color : '#ff5d73');
      const mini = game.miniBoss;
      drawBar(mini, boss ? 146 : 112, 6, this.miniBarShown, mini ? mini.def.name : '', '#ffb02e');
    },

    drawProgress(ctx, game) {
      if (game.mode !== 'campaign' || game.boss) return;
      const prog = U.clamp(G.Director.progress || 0, 0, 1);
      const x = W - 6;
      const y0 = 110;
      const y1 = H - 80;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x - 2, y0, 3, y1 - y0);
      const yy = y1 - (y1 - y0) * prog;
      ctx.fillStyle = '#5ef0ff';
      ctx.fillRect(x - 2, yy, 3, y1 - yy);
      // Иконка босса наверху
      ctx.fillStyle = '#ff5d73';
      U.polygon(ctx, x - 1, y0 - 6, 5, 4, 0);
      ctx.fill();
    },

    drawLevelCard(ctx) {
      const c = this.levelCard;
      if (!c) return;
      const t = c.t;
      const a = t < 0.4 ? t / 0.4 : t > c.dur - 0.6 ? Math.max(0, (c.dur - t) / 0.6) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(5,8,20,0.55)';
      ctx.fillRect(0, H * 0.36, W, 150);
      const slide = (1 - U.ease.outCubic(Math.min(1, t / 0.6))) * 60;
      ctx.fillStyle = '#5ef0ff';
      ctx.font = '600 14px ' + FONT;
      ctx.fillText((c.subtitle || '').toUpperCase(), W / 2 - slide, H * 0.36 + 34);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 30px ' + FONT;
      ctx.shadowColor = '#33e1ff';
      ctx.shadowBlur = 16;
      ctx.fillText(c.name, W / 2 + slide, H * 0.36 + 74);
      ctx.shadowBlur = 0;
      if (c.intro) {
        ctx.fillStyle = '#b8cbe8';
        ctx.font = '400 14px ' + FONT;
        this.wrapText(ctx, c.intro, W / 2, H * 0.36 + 104, W - 80, 19);
      }
      ctx.restore();
    },

    wrapText(ctx, text, x, y, maxW, lh) {
      const words = String(text).split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, x, y);
          line = w;
          y += lh;
        } else line = test;
      }
      if (line) ctx.fillText(line, x, y);
    },

    drawBanners(ctx) {
      let y = H * 0.3;
      for (const b of this.banners) {
        const t = b.t;
        const a = t < 0.2 ? t / 0.2 : t > b.dur - 0.5 ? Math.max(0, (b.dur - t) / 0.5) : 1;
        const s = t < 0.25 ? 1.4 - 0.4 * (t / 0.25) : 1;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(W / 2, y);
        ctx.scale(s, s);
        ctx.textAlign = 'center';
        ctx.font = '800 26px ' + FONT;
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 18;
        ctx.fillText(b.text, 0, 0);
        if (b.sub) {
          ctx.shadowBlur = 0;
          ctx.font = '600 14px ' + FONT;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(b.sub, 0, 24);
        }
        ctx.restore();
        y += 56;
      }
    },

    drawWarning(ctx) {
      const w = this.warning;
      if (!w) return;
      const t = w.t;
      const blink = Math.sin(t * 12) > -0.2;
      const a = t > w.dur - 0.4 ? Math.max(0, (w.dur - t) / 0.4) : Math.min(1, t * 4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(255,20,50,0.12)';
      ctx.fillRect(0, 0, W, H);
      // Полосы
      const y = H * 0.42;
      ctx.fillStyle = 'rgba(30,0,8,0.8)';
      ctx.fillRect(0, y - 50, W, 100);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y - 50, W, 8);
      ctx.rect(0, y + 42, W, 8);
      ctx.clip();
      ctx.fillStyle = '#ff2848';
      const off = (t * 120) % 40;
      for (let x = -40; x < W + 40; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x + off, y - 50);
        ctx.lineTo(x + off + 20, y - 50);
        ctx.lineTo(x + off, y + 50);
        ctx.lineTo(x + off - 20, y + 50);
        ctx.fill();
      }
      ctx.restore();
      if (blink) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4060';
        ctx.shadowColor = '#ff2848';
        ctx.shadowBlur = 20;
        ctx.font = '900 40px ' + FONT;
        ctx.fillText('ВНИМАНИЕ', W / 2, y + 6);
        ctx.shadowBlur = 0;
        ctx.font = '600 14px ' + FONT;
        ctx.fillStyle = '#ffd0d8';
        ctx.fillText('Приближается крупная цель', W / 2, y + 30);
      }
      ctx.restore();
    },

    drawBossIntro(ctx) {
      const b = this.bossIntro;
      if (!b) return;
      const t = b.t;
      const a = t < 0.3 ? t / 0.3 : t > b.dur - 0.5 ? Math.max(0, (b.dur - t) / 0.5) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px ' + FONT;
      ctx.fillText('БОСС', W / 2, H * 0.62);
      ctx.font = '900 30px ' + FONT;
      ctx.shadowColor = '#ff5d73';
      ctx.shadowBlur = 18;
      ctx.fillText(b.title.toUpperCase(), W / 2, H * 0.62 + 36);
      ctx.restore();
    },
  });

  HUD.FONT = FONT;
})();
