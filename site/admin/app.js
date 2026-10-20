// Officer dashboard: a small single-page app (no build step).
import * as db from '../js/data.js';
import { esc, cleanUrl, nowIn } from '../js/util.js';
import { selectContent } from '../js/render.js';
import { COLLECTIONS, SETTINGS_GROUPS, MESSAGES, MAX_MB } from './fields.js';

const root = document.getElementById('root');
let user = null;
let settings = null;
let flash = '';

/* ================================================================ helpers */

const FILE_FIELD_TYPES = ['image', 'file'];

function errorList(errors) {
  return errors.length
    ? `<div class="flash err" role="alert"><strong>Almost there:</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`
    : '';
}

function fieldHtml(f, val) {
  const id = 'f_' + f.name;
  const req = f.required ? ' required' : '';
  const help = f.help ? `<p class="help" id="${id}_h">${esc(f.help)}</p>` : '';
  const desc = f.help ? ` aria-describedby="${id}_h"` : '';
  const label = `<label for="${id}">${esc(f.label)}${f.required ? ' <span class="req" title="Required">*</span>' : ''}</label>`;
  val = val ?? '';
  switch (f.type) {
    case 'textarea':
      return `<div class="field">${label}<textarea id="${id}" name="${f.name}" rows="${f.rows || 5}" maxlength="${f.max || 5000}"${req}${desc}>${esc(val)}</textarea>${help}</div>`;
    case 'checkbox':
      return `<div class="field check"><label><input type="checkbox" name="${f.name}" value="1"${val ? ' checked' : ''}${desc}> <span>${esc(f.label)}</span></label>${help}</div>`;
    case 'select':
      return `<div class="field">${label}<select id="${id}" name="${f.name}"${desc}>${f.options
        .map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)} (${esc(v)})</option>`)
        .join('')}</select>${help}</div>`;
    case 'image':
    case 'file': {
      const isImg = f.type === 'image';
      const url = val ? db.fileUrl(val) : '';
      const current = val
        ? isImg
          ? `<div class="current"><img src="${esc(url)}" alt="Current picture"><label class="inline"><input type="checkbox" name="${f.name}__remove" value="1"> Remove it</label></div>`
          : `<div class="current"><a href="${esc(url)}" target="_blank" rel="noopener">Current PDF ↗</a><label class="inline"><input type="checkbox" name="${f.name}__remove" value="1"> Remove it</label></div>`
        : '';
      return `<div class="field">${label}${current}<input type="file" id="${id}" name="${f.name}" accept="${isImg ? 'image/jpeg,image/png,image/gif,image/webp' : 'application/pdf'}"${isImg ? ' data-preview' : ''}${desc}>${isImg ? '<div class="preview" hidden></div>' : ''}${help}</div>`;
    }
    default: {
      const type = { datetime: 'datetime-local', date: 'date', time: 'time', email: 'email' }[f.type] || 'text';
      const extra = f.type === 'url' ? ' placeholder="https://" inputmode="url"' : '';
      return `<div class="field">${label}<input id="${id}" type="${type}" name="${f.name}" value="${esc(val)}"${f.max ? ` maxlength="${f.max}"` : ''}${req}${extra}${desc}>${help}</div>`;
    }
  }
}

// Reads the form into plain values and a list of files to upload.
function readForm(form, fields, existing) {
  const fd = new FormData(form);
  const out = {};
  const errors = [];
  const uploads = [];
  const removals = [];

  for (const f of fields) {
    if (f.type === 'checkbox') { out[f.name] = fd.get(f.name) === '1'; continue; }

    if (FILE_FIELD_TYPES.includes(f.type)) {
      const file = fd.get(f.name);
      const cur = existing[f.name] || '';
      out[f.name] = cur;
      if (file && file.size > 0) {
        const okTypes = f.type === 'image' ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] : ['application/pdf'];
        if (!okTypes.includes(file.type)) errors.push(`${f.label}: ${f.type === 'image' ? 'pictures must be JPG, PNG, GIF or WebP files.' : 'newsletter files must be PDFs.'}`);
        else uploads.push({ field: f, file });
      } else if (fd.get(f.name + '__remove') === '1' && cur) {
        out[f.name] = '';
        removals.push(cur);
      }
      continue;
    }

    let v = String(fd.get(f.name) ?? '').trim();
    if (f.required && !v) errors.push(`${f.label} is required.`);
    else if (v) {
      if (f.type === 'url') {
        const u = cleanUrl(v);
        if (u === null) errors.push(`${f.label} doesn't look like a web address.`);
        else v = u;
      } else if (f.type === 'date' && !/^\d{4}-\d\d-\d\d$/.test(v)) errors.push(`${f.label} needs a valid date.`);
      else if (f.type === 'datetime' && !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v)) errors.push(`${f.label} needs a valid date and time.`);
      else if (f.type === 'time' && !/^\d\d:\d\d$/.test(v)) errors.push(`${f.label} needs a valid time.`);
      else if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push(`${f.label} doesn't look like an email address.`);
      else if (f.type === 'select' && !f.options.some(([o]) => o === v)) errors.push(`${f.label} has an invalid choice.`);
    }
    v = v.slice(0, f.max || (f.type === 'textarea' ? 5000 : 300));
    out[f.name] = f.type === 'date' && !v ? null : v; // an empty optional date must be NULL in the database
  }
  return { out, errors, uploads, removals };
}

// Shrinks big phone photos before upload. Keeps PNGs as PNGs (logos need transparency).
async function prepareImage(file) {
  const MAX = 1800;
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
  if (file.type === 'image/gif') return { blob: file, ext };
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { return { blob: file, ext }; }
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size <= 2 * 1024 * 1024) return { blob: file, ext };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((res) => canvas.toBlob(res, type, 0.85));
  if (!blob || (scale === 1 && blob.size >= file.size)) return { blob: file, ext };
  return { blob, ext: type === 'image/png' ? 'png' : 'jpg' };
}

// Uploads the picked files. Returns paths that were added (so a failed save can clean up).
async function processUploads(uploads, out, removals) {
  const added = [];
  for (const { field, file } of uploads) {
    const prepared = field.type === 'image' ? await prepareImage(file) : { blob: file, ext: 'pdf' };
    if (prepared.blob.size > MAX_MB * 1024 * 1024) throw new Error(`${field.label}: that file is bigger than ${MAX_MB} MB.`);
    const path = await db.uploadFile(prepared.blob, prepared.ext);
    added.push(path);
    if (out[field.name]) removals.push(out[field.name]);
    out[field.name] = path;
  }
  return added;
}

/* ================================================================ layout */

function shell(active, body) {
  const links = [
    ['#/', 'Dashboard', 'home'],
    ...Object.entries(COLLECTIONS).map(([k, c]) => [`#/${k}`, c.plural, k]),
    ['#/settings', 'Site text & photos', 'settings'],
    ['#/account', 'My account', 'account'],
  ];
  const msg = flash;
  flash = '';
  return `<a class="skip" href="#main">Skip to content</a>
  <div class="layout">
    <aside class="side">
      <a class="side-brand" href="#/"><span class="dot">★</span> SVO Dashboard</a>
      <nav aria-label="Dashboard">
        ${links.map(([h, l, k]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}
        <a href="../" target="_blank" rel="noopener">View the site ↗</a>
      </nav>
      <div class="side-foot">
        <p>Signed in as<br><strong>${esc(user.email)}</strong></p>
        <button class="btn-link" type="button" data-logout>Log out</button>
      </div>
    </aside>
    <main id="main" class="content" tabindex="-1">
      ${db.isDemo ? `<p class="flash warn"><strong>Demo mode.</strong> Changes are saved only in this browser and nothing goes online. Add your Supabase details to <code>js/config.js</code> to go live (see the README). <button class="btn-link dark" type="button" data-reset-demo>Reset the demo</button></p>` : ''}
      ${msg ? `<p class="flash ok" role="status">${esc(msg)}</p>` : ''}
      ${body}
    </main>
  </div>`;
}

function show(active, body) {
  root.innerHTML = shell(active, body);
  window.scrollTo(0, 0);
}

function plainPage(body) {
  root.innerHTML = `<main class="login-card"><p class="dot big" aria-hidden="true">★</p>${body}<p class="back"><a href="../">← Back to the site</a></p></main>`;
  root.className = 'plain';
}

/* ================================================================ pages */

function showLogin(error = '') {
  const demo = db.isDemo;
  plainPage(`<h1>Officer login</h1><p class="sub">${demo ? 'This is a demo. No password needed.' : 'Welcome back. Let’s update some things.'}</p>
    ${error ? `<p class="flash err" role="alert">${esc(error)}</p>` : ''}
    <form data-form="login">
      ${demo ? '' : `<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required autofocus></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>`}
      <button class="btn" type="submit">${demo ? 'Enter the demo dashboard' : 'Log in'}</button>
    </form>`);
}

async function pageDashboard() {
  const data = { settings, announcements: await db.listRows('announcements'), events: await db.listRows('events'), newsletters: await db.listRows('newsletters') };
  const sel = selectContent(data);
  const samples = db.TABLES.reduce((n, k) => n + data[k].filter((i) => i.is_sample).length, 0);
  const stats = {
    announcements: `${sel.announcements.length} showing`,
    events: `${sel.upcoming.length} upcoming`,
    newsletters: `${sel.newsletters.length} published`,
  };
  const cards = Object.entries(COLLECTIONS).map(([k, c]) => `
    <section class="dash-card"><h2>${c.plural}</h2><p class="stat">${stats[k]}</p><p>${esc(c.blurb)}</p>
      <div class="row"><a class="btn" href="#/${k}/new">+ Add ${c.singular}</a><a class="btn ghost" href="#/${k}">Manage</a></div></section>`).join('');
  show('home', `<h1>Welcome back</h1>
    <p class="sub">What are we updating today? Anything you save here goes live on the website right away.</p>
    ${samples ? `<p class="flash warn">Your site is still showing <strong>${samples} sample item${samples === 1 ? '' : 's'}</strong>. Edit or delete them (they're marked <span class="badge">Sample</span>) so visitors only see your real content.</p>` : ''}
    <div class="dash-grid">${cards}</div>
    <section class="panel"><h2>Other things you can change</h2>
      <ul class="plain-list">
        <li><a href="#/settings">Site text &amp; photos</a>: the home page headline, main photo, about text, meeting times, contact info and social links.</li>
        <li><a href="#/account">My account</a>: change your password, and how to add or remove officers.</li>
      </ul></section>`);
}

async function pageList(key) {
  const c = COLLECTIONS[key];
  const rows = (await db.listRows(key)).sort(c.sort);
  const now = nowIn(settings.timezone);
  const items = rows.map((it) => {
    const d = c.describe(it, now);
    const badges = [...(it.published ? [] : ['Draft']), ...d.badges, ...(it.is_sample ? ['Sample'] : [])];
    return `<li><div class="grow"><strong>${esc(it.title)}</strong> ${badges.map((b) => `<span class="badge ${b === 'Draft' ? 'draft' : ''}">${esc(b)}</span>`).join(' ')}<br><span class="muted">${esc(d.meta)}</span></div>
      <div class="row"><a class="btn ghost small" href="#/${key}/${esc(it.id)}">Edit</a>
      <button class="btn danger small" type="button" data-delete="${esc(it.id)}" data-key="${key}" data-title="${esc(it.title)}">Delete</button></div></li>`;
  }).join('');
  show(key, `<div class="titlebar"><div><h1>${c.plural}</h1><p class="sub">${esc(c.blurb)}</p></div><a class="btn" href="#/${key}/new">+ Add ${c.singular}</a></div>
    ${rows.length ? `<ul class="rows panel">${items}</ul>` : `<p class="empty">Nothing here yet. Add your first ${c.singular}!</p>`}`);
}

function defaultsFor(key) {
  const today = nowIn(settings.timezone).slice(0, 10);
  const v = {};
  COLLECTIONS[key].fields.forEach((f) => { v[f.name] = f.today ? today : f.default ?? ''; });
  return v;
}

function formHtml(key, values, id, errors = []) {
  const c = COLLECTIONS[key];
  return `<p class="crumb"><a href="#/${key}">← ${c.plural}</a></p><h1>${id ? `Edit ${c.singular}` : `New ${c.singular}`}</h1>
    ${errorList(errors)}
    <form class="form" data-form="collection" data-key="${key}" data-id="${esc(id || '')}" novalidate>
      ${c.fields.map((f) => fieldHtml(f, values[f.name])).join('')}
      <div class="row sticky"><button class="btn" type="submit">${id ? 'Save changes' : `Publish ${c.singular}`}</button><a class="btn ghost" href="#/${key}">Cancel</a></div>
    </form>`;
}

async function pageForm(key, id) {
  let values = defaultsFor(key);
  if (id) {
    const row = await db.getRow(key, id);
    if (!row) { flash = "We couldn't find that item. It may have been deleted."; location.hash = `#/${key}`; return; }
    values = row;
  }
  show(key, formHtml(key, values, id));
}

function settingsHtml(values, errors = []) {
  const groups = SETTINGS_GROUPS.map((g) => `<fieldset><legend>${esc(g.title)}</legend>${g.fields.map((f) => fieldHtml(f, values[f.name])).join('')}</fieldset>`).join('');
  return `<h1>Site text &amp; photos</h1><p class="sub">The words and pictures that aren't announcements, events or newsletters.</p>
    ${errorList(errors)}
    <form class="form" data-form="settings" novalidate>${groups}
      <div class="row sticky"><button class="btn" type="submit">Save changes</button><a class="btn ghost" href="#/">Cancel</a></div></form>`;
}

function pageSettings() {
  show('settings', settingsHtml(settings));
}

function pageAccount(errors = []) {
  show('account', `<h1>My account</h1><p class="sub">Signed in as <strong>${esc(user.email)}</strong>.</p>
    ${errorList(errors)}
    <section class="panel"><h2>Change my password</h2>
      <form class="form narrow" data-form="password">
        <div class="field"><label for="np">New password</label><input id="np" name="password" type="password" minlength="10" autocomplete="new-password" required><p class="help">At least 10 characters. A few random words works well.</p></div>
        <button class="btn" type="submit">Change password</button></form></section>
    <section class="panel"><h2>Adding or removing officers</h2>
      <p>Officer logins are managed in Supabase by whoever owns the project:</p>
      <ol class="plain-list"><li>Open your project at supabase.com and choose <strong>Authentication</strong>, then <strong>Users</strong>.</li>
      <li>To add someone: <strong>Add user</strong>, then <strong>Create new user</strong>. Enter their email and a starting password, and tick <strong>Auto Confirm User</strong>.</li>
      <li>To remove someone who has graduated: open the three-dot menu on their row and choose <strong>Delete user</strong>.</li></ol>
      <p class="muted">Anyone with a login can edit the whole site, so only add officers you trust.</p></section>`);
}

/* ================================================================ actions */

function setBusy(form, busy, label) {
  const btn = form.querySelector('button[type=submit]');
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Saving…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

async function handleCollection(form) {
  const key = form.dataset.key;
  const id = form.dataset.id || null;
  const c = COLLECTIONS[key];
  const existing = id ? await db.getRow(key, id) || {} : {};
  const r = readForm(form, c.fields, existing);
  if (r.errors.length) { show(key, formHtml(key, { ...existing, ...r.out }, id, r.errors)); return; }
  setBusy(form, true, r.uploads.length ? 'Uploading…' : 'Saving…');
  let added = [];
  try {
    added = await processUploads(r.uploads, r.out, r.removals);
    await db.saveRow(key, id, r.out);
  } catch (err) {
    await db.removeFiles(added);
    setBusy(form, false);
    show(key, formHtml(key, { ...existing, ...r.out }, id, [db.explain(err)]));
    return;
  }
  await db.removeFiles(r.removals);
  flash = MESSAGES[id ? 'updated' : 'created'];
  location.hash = `#/${key}`;
}

async function handleSettings(form) {
  const fields = SETTINGS_GROUPS.flatMap((g) => g.fields);
  const r = readForm(form, fields, settings);
  if (r.errors.length) { show('settings', settingsHtml({ ...settings, ...r.out }, r.errors)); return; }
  setBusy(form, true, r.uploads.length ? 'Uploading…' : 'Saving…');
  let added = [];
  try {
    added = await processUploads(r.uploads, r.out, r.removals);
    await db.saveSettings(r.out);
  } catch (err) {
    await db.removeFiles(added);
    setBusy(form, false);
    show('settings', settingsHtml({ ...settings, ...r.out }, [db.explain(err)]));
    return;
  }
  await db.removeFiles(r.removals);
  settings = await db.loadSettings();
  flash = MESSAGES.settings;
  show('settings', settingsHtml(settings));
}

async function handleDelete(btn) {
  const { delete: id, key, title } = btn.dataset;
  if (!window.confirm(`Delete “${title}”? This can't be undone.`)) return;
  try {
    const row = await db.getRow(key, id);
    await db.deleteRow(key, id);
    if (row) await db.removeFiles(COLLECTIONS[key].fields.filter((f) => FILE_FIELD_TYPES.includes(f.type)).map((f) => row[f.name]));
    flash = MESSAGES.deleted;
    await pageList(key);
  } catch (err) {
    flash = '';
    window.alert(db.explain(err));
  }
}

/* ================================================================ wiring */

root.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const kind = form.dataset.form;
  try {
    if (kind === 'login') {
      const fd = new FormData(form);
      setBusy(form, true, 'Signing in…');
      try { await db.signIn(String(fd.get('email') || '').trim(), String(fd.get('password') || '')); }
      catch (err) { showLogin(db.explain(err)); return; }
      user = await db.currentUser();
      root.className = '';
      route();
    } else if (kind === 'collection') await handleCollection(form);
    else if (kind === 'settings') await handleSettings(form);
    else if (kind === 'password') {
      const pw = String(new FormData(form).get('password') || '');
      if (pw.length < 10) { pageAccount(['The new password needs at least 10 characters.']); return; }
      setBusy(form, true, 'Saving…');
      try { await db.changePassword(pw); flash = MESSAGES.password; pageAccount(); }
      catch (err) { pageAccount([db.explain(err)]); }
    }
  } catch (err) {
    console.error(err);
    setBusy(form, false);
    window.alert(db.explain(err));
  }
});

root.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-delete]');
  if (del) { handleDelete(del); return; }
  if (e.target.closest('[data-logout]')) {
    await db.signOut();
    user = null;
    settings = null;
    showLogin();
    return;
  }
  if (e.target.closest('[data-reset-demo]') && window.confirm('Reset the demo back to the original sample content?')) {
    db.resetDemo();
    settings = null;
    route();
  }
});

root.addEventListener('change', (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement) || !input.matches('input[type=file][data-preview]')) return;
  const box = input.parentElement.querySelector('.preview');
  if (!box) return;
  box.replaceChildren();
  const file = input.files && input.files[0];
  if (!file) { box.hidden = true; return; }
  const img = document.createElement('img');
  img.alt = 'Preview of the picture you picked';
  img.src = URL.createObjectURL(file);
  box.append('New picture:', img);
  box.hidden = false;
});

async function route() {
  if (!user) { showLogin(); return; }
  root.className = '';
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  try {
    if (!settings) settings = await db.loadSettings();
    if (!a) await pageDashboard();
    else if (COLLECTIONS[a]) await (b ? pageForm(a, b === 'new' ? null : b) : pageList(a));
    else if (a === 'settings') pageSettings();
    else if (a === 'account') pageAccount();
    else location.hash = '#/';
  } catch (err) {
    console.error(err);
    show('home', `<h1>Something went wrong</h1><p class="flash err" role="alert">${esc(db.explain(err))}</p><p><a class="btn ghost" href="#/">Back to the dashboard</a></p>`);
  }
}

(async function start() {
  try {
    db.connect({ admin: true });
    user = await db.currentUser();
  } catch (err) {
    plainPage(`<h1>Can't start</h1><p class="flash err">${esc(db.explain(err))}</p>`);
    return;
  }
  window.addEventListener('hashchange', route);
  route();
})();
