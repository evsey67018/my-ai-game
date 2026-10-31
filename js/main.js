/* My AI Arcade — точка входа: масштабирование холста и игровой цикл с фиксированным шагом. */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const W = 540;
  const H = 960;
  const STEP = 1 / 120;
  const MAX_FRAME = 0.1;

  const Main = (G.Main = {
    canvas: null,
    ctx: null,
    dpr: 1,
    last: 0,
    acc: 0,
    running: false,
    errors: 0,

    start() {
      const canvas = (this.canvas = document.getElementById('game'));
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));

      G.Input.init(canvas);
      G.Background.init();
      G.HUD.init();
      G.Toasts.init();
      G.Game.init();
      G.Menus.init();
      this.setupTouchControls();
      this.setupAudioUnlock();

      G.Events.on('settings', () => G.Audio.applyVolumes());
      G.Events.on('state', (s) => {
        document.body.classList.toggle('in-game', s === 'playing');
        document.body.classList.toggle('paused', s !== 'playing' && s !== 'menu');
      });

      this.running = true;
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    },

    // Холст рисуется в логическом разрешении 540×960 и масштабируется CSS-ом с учётом DPR.
    resize() {
      const stage = document.getElementById('stage');
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.min(vw / W, vh / H);
      const cssW = Math.floor(W * scale);
      const cssH = Math.floor(H * scale);
      stage.style.width = cssW + 'px';
      stage.style.height = cssH + 'px';
      stage.style.setProperty('--ui-scale', scale.toFixed(4));
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const q = G.Save.settings.particles === 'low' ? 1 : this.dpr;
      const pxW = Math.round(cssW * q);
      const pxH = Math.round(cssH * q);
      if (this.canvas.width !== pxW || this.canvas.height !== pxH) {
        this.canvas.width = pxW;
        this.canvas.height = pxH;
      }
      this.renderScale = pxW / W;
      if (G.Input.recalc) G.Input.recalc();
    },

    setupTouchControls() {
      const tc = document.getElementById('touch-controls');
      G.Input.bindButton(document.getElementById('btn-bomb'), 'bomb');
      G.Input.bindButton(document.getElementById('btn-dash'), 'dash');
      const pauseBtn = document.getElementById('btn-pause');
      const onPause = (e) => {
        e.preventDefault();
        e.stopPropagation();
        G.Game.togglePause();
      };
      pauseBtn.addEventListener('touchstart', onPause, { passive: false });
      pauseBtn.addEventListener('click', onPause);
      const show = () => tc.classList.remove('hidden');
      G.Events.on('touchUsed', () => {
        show();
        G.Menus.touchMode = true;
      });
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        show();
        G.Menus.touchMode = true;
      }
    },

    // Браузеры разрешают звук только после жеста пользователя.
    setupAudioUnlock() {
      const unlock = () => {
        if (G.Audio.init()) G.Music.resumePending();
      };
      ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
      G.Music.play('menu');
    },

    frame(now) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.frame(t));
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;
      if (dt < 0) dt = 0;
      G.HUD.tick(dt);
      this.acc += dt;
      try {
        let steps = 0;
        while (this.acc >= STEP && steps < 16) {
          G.Game.update(STEP);
          this.acc -= STEP;
          steps++;
        }
        if (steps >= 16) this.acc = 0;
        const ctx = this.ctx;
        ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
        G.Game.draw(ctx);
      } catch (err) {
        // Не роняем игру из-за одной ошибки, но сообщаем в консоль.
        this.errors++;
        if (this.errors < 5) console.error(err);
      }
    },
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Main.start());
  else Main.start();
})();
