/* My AI Arcade — всплывающие уведомления (достижения, подсказки, системные сообщения). */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  const Toasts = (G.Toasts = {
    el: null,
    queue: [],
    active: [],
    maxVisible: 3,

    init() {
      this.el = document.getElementById('toasts');
      G.Events.on('toast', (t) => {
        if (typeof t === 'string') t = { text: t };
        this.push(t);
      });
      G.Events.on('achievement', (a) => {
        this.push({ title: 'Достижение открыто!', text: a.name + ' · +◆' + a.reward, icon: a.icon, color: '#ffb02e', cls: 'achievement', dur: 3.6 });
      });
    },

    push(t) {
      // Не дублируем одинаковые сообщения подряд.
      const last = this.active[this.active.length - 1];
      if (last && last.data.text === t.text && !t.title) {
        last.count = (last.count || 1) + 1;
        const badge = last.node.querySelector('.toast-count');
        if (badge) badge.textContent = '×' + last.count;
        clearTimeout(last.timer);
        last.timer = setTimeout(() => this.dismiss(last), (t.dur || 2.2) * 1000);
        return;
      }
      if (this.active.length >= this.maxVisible) {
        this.queue.push(t);
        return;
      }
      this.show(t);
    },

    show(t) {
      const node = document.createElement('div');
      node.className = 'toast' + (t.cls ? ' ' + t.cls : '');
      if (t.color) node.style.setProperty('--c', t.color);
      const icon = document.createElement('span');
      icon.className = 'toast-icon';
      icon.textContent = t.icon || '✦';
      const body = document.createElement('div');
      body.className = 'toast-body';
      if (t.title) {
        const title = document.createElement('b');
        title.textContent = t.title;
        body.appendChild(title);
      }
      const text = document.createElement('span');
      text.textContent = t.text || '';
      body.appendChild(text);
      const count = document.createElement('span');
      count.className = 'toast-count';
      node.appendChild(icon);
      node.appendChild(body);
      node.appendChild(count);
      this.el.appendChild(node);
      requestAnimationFrame(() => node.classList.add('in'));
      const entry = { node, data: t };
      entry.timer = setTimeout(() => this.dismiss(entry), (t.dur || 2.2) * 1000);
      node.addEventListener('click', () => this.dismiss(entry));
      this.active.push(entry);
    },

    dismiss(entry) {
      const i = this.active.indexOf(entry);
      if (i < 0) return;
      this.active.splice(i, 1);
      clearTimeout(entry.timer);
      entry.node.classList.remove('in');
      entry.node.classList.add('out');
      setTimeout(() => {
        entry.node.remove();
        if (this.queue.length) this.show(this.queue.shift());
      }, 260);
    },
  });

  Toasts.clear = function () {
    for (const e of this.active.slice()) this.dismiss(e);
    this.queue.length = 0;
  };
})();
