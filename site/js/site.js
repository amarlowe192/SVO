// Public page: load content, draw it, wire up menu, carousels and calendar buttons.
import { isDemo, connect, loadPublic, explain } from './data.js';
import { renderApp, pageTitle } from './render.js';
import { initMenu, initScrollSpy, initCarousel } from './carousel.js';
import { downloadIcs } from './util.js';

document.documentElement.classList.add('js');

const app = document.getElementById('app');
const CACHE_KEY = 'svo-public-cache-v1';
let current = null;

function draw(db) {
  current = db;
  app.innerHTML = renderApp(db) + (isDemo ? '<p class="demo-flag">Demo mode · sample content, not connected to Supabase</p>' : '');
  document.title = pageTitle(db.settings);
  initMenu();
  initScrollSpy();
  app.querySelectorAll('[data-carousel]').forEach(initCarousel);
  const want = location.hash.slice(1);
  if (want && document.getElementById(want)) document.getElementById(want).scrollIntoView();
}

// "Add to calendar" buttons (one listener for the whole page)
app.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ics]');
  if (!btn || !current) return;
  const ev = current.events.find((x) => x.id === btn.dataset.ics);
  if (ev) downloadIcs(ev, current.settings);
});

function showError(err) {
  const note = document.createElement('p');
  note.className = 'load-error';
  note.setAttribute('role', 'alert');
  note.textContent = `We couldn't load the latest updates. ${explain(err)}`;
  (app.querySelector('main') || app).prepend(note);
}

(async function start() {
  // Show the last-seen content instantly (if any), then refresh from the server.
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { /* ignore */ }
  try {
    connect(); // must happen before drawing: picture addresses need the connection
    if (cached && !isDemo) {
      try { draw(cached); } catch (e) { console.error(e); cached = null; localStorage.removeItem(CACHE_KEY); }
    }
    const fresh = await loadPublic();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch { /* storage full or blocked */ }
    draw(fresh);
  } catch (err) {
    console.error(err);
    if (cached) showError(err);
    else app.innerHTML = `<main class="wrap boot"><h1>We couldn't load the page</h1><p>${explain(err).replace(/</g, '&lt;')}</p><p><a href="">Try again</a></p></main>`;
  }
})();
