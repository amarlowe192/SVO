// Mobile menu, "which section am I in" highlight, and the looping carousels.

export function initMenu() {
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('nav');
  if (!btn || !nav) return;
  const set = (open) => {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); }
  });
}

export function initScrollSpy() {
  if (!('IntersectionObserver' in window)) return;
  const links = {};
  document.querySelectorAll('#nav a[href^="#"]').forEach((a) => { links[a.getAttribute('href').slice(1)] = a; });
  const ids = Object.keys(links).filter((id) => document.getElementById(id));
  if (!ids.length) return;
  const visible = {};
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { visible[en.target.id] = en.isIntersecting; });
    const current = ids.find((id) => visible[id]);
    ids.forEach((id) => {
      if (id === current) links[id].setAttribute('aria-current', 'true');
      else links[id].removeAttribute('aria-current');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ids.forEach((id) => io.observe(document.getElementById(id)));
}

/* Looping carousel. Each slide is placed by its circular distance from the active slide,
   so choosing any slide (dot, arrow, neighbor, swipe or key) glides straight to it. */
export function initCarousel(root) {
  const slides = [...root.querySelectorAll('.slide')];
  const n = slides.length;
  const controls = root.querySelector('.controls');
  const dotsBox = root.querySelector('[data-dots]');
  const count = root.querySelector('[data-count]');
  const status = root.querySelector('[data-status]');
  let active = 0;
  let moved = false;

  root.classList.add('is-ready');

  if (n > 1) {
    controls.hidden = false;
    if (n <= 8) {
      slides.forEach((s, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'dot';
        d.setAttribute('aria-label', `Show slide ${i + 1} of ${n}: ${s.dataset.title}`);
        d.addEventListener('click', () => go(i));
        dotsBox.appendChild(d);
      });
    } else {
      dotsBox.hidden = true;
    }
  }

  function layout() {
    slides.forEach((s, i) => {
      let o = (((i - active) % n) + n) % n;
      if (o > n / 2) o -= n;
      const a = Math.abs(o);
      const isActive = i === active;
      s.style.setProperty('--o', Math.max(-2, Math.min(2, o)));
      s.style.setProperty('--sc', a === 0 ? 1 : 0.9);
      s.style.setProperty('--op', a === 0 ? 1 : a === 1 ? 0.4 : 0);
      s.style.zIndex = 10 - a;
      s.classList.toggle('is-active', isActive);
      s.classList.toggle('is-far', a > 1);
      if (isActive) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      s.querySelectorAll('a, button').forEach((el) => {
        if (isActive) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', '-1');
      });
    });
    [...dotsBox.children].forEach((d, i) => {
      if (i === active) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
    if (count) count.textContent = `${active + 1} / ${n}`;
    if (status) status.textContent = `Slide ${active + 1} of ${n}: ${slides[active].dataset.title}`;
  }

  function go(i) {
    active = ((i % n) + n) % n;
    layout();
  }

  root.querySelector('[data-prev]').addEventListener('click', () => go(active - 1));
  root.querySelector('[data-next]').addEventListener('click', () => go(active + 1));

  // Tapping a neighboring card brings it to the center instead of following its links.
  slides.forEach((s, i) => {
    s.addEventListener('click', (e) => {
      if (moved) { e.preventDefault(); return; }
      if (i !== active) { e.preventDefault(); e.stopPropagation(); go(i); }
    }, true);
  });

  root.addEventListener('keydown', (e) => {
    if (n < 2 || e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
  });

  // Swipe (touch or mouse drag)
  const stage = root.querySelector('.stage');
  let startX = null;
  stage.addEventListener('pointerdown', (e) => { startX = e.clientX; moved = false; });
  stage.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50 && n > 1) {
      moved = true;
      go(active + (dx < 0 ? 1 : -1));
      setTimeout(() => { moved = false; }, 50);
    }
  });
  stage.addEventListener('pointercancel', () => { startX = null; });

  layout();
}
