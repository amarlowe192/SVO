// Everything that talks to the database, logins and file storage lives here.
// With Supabase configured it uses Supabase. Without, it uses a demo store in the browser.
import { CONFIG } from './config.js';
import { DEFAULT_SETTINGS } from './defaults.js';
import { shiftDate } from './util.js';

export const isDemo = !(CONFIG.supabaseUrl && CONFIG.supabaseKey);
export const TABLES = ['announcements', 'events', 'newsletters'];

/* ---------- friendly errors ---------- */

export function explain(err) {
  const m = (err && err.message) || String(err);
  if (err?.code === '42P01' || /does not exist|schema cache/i.test(m)) {
    return 'The database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor (see the README).';
  }
  if (err?.code === '42501' || /row-level security|permission denied/i.test(m)) {
    return "You aren't allowed to do that. Make sure you are signed in.";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Can't reach the server. Check your internet connection.";
  return m;
}

/* ---------- Supabase client ---------- */

let client = null;

export function connect({ admin = false } = {}) {
  if (isDemo || client) return;
  if (!window.supabase) throw new Error('The Supabase library failed to load.');
  client = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: { persistSession: admin, autoRefreshToken: admin, detectSessionInUrl: false },
  });
}

const ok = ({ data, error }) => {
  if (error) throw error;
  return data;
};

/* ---------- demo store (localStorage) ---------- */

const DEMO_KEY = 'svo-demo-v1';

function seedDemo() {
  const tz = DEFAULT_SETTINGS.timezone;
  const id = () => crypto.randomUUID();
  const base = { published: true, is_sample: true, created_at: new Date().toISOString() };
  const ev = (title, d, t, end, location, description) => ({ ...base, id: id(), title, starts_at: shiftDate(tz, d, t), end_time: end, location, description, link: '', image: '' });
  const nl = (title, d, summary) => ({ ...base, id: id(), title, issued_on: shiftDate(tz, d), summary, file: '', url: '', cover: '' });
  const an = (title, d, body, pinned = false) => ({ ...base, id: id(), title, body, posted_on: shiftDate(tz, d), pinned, expires_on: null });
  return {
    seeded: true, signedIn: false, settings: {}, files: {},
    events: [
      ev('Welcome Back Cookout', 6, '17:30', '19:30', 'Campus Green, by the big oak tree', 'Burgers, dogs, veggie options and lawn games. Bring your family, your roommate, or a friend who has been meaning to stop by.'),
      ev('GI Bill Office Hours', 13, '12:00', '13:30', 'Student Union, Room 204', 'Bring your questions and your paperwork. A certifying official will be on hand to help with enrollment forms and benefits.'),
      ev('Veterans Day Remembrance Walk', 24, '10:00', '11:30', 'Meet at the Library steps', 'A short, quiet walk across campus followed by hot chocolate. Open to everyone.'),
      ev('Career Night: Translating Your Service', 31, '18:00', '20:00', 'Business Building, Atrium', 'Meet veteran alumni and local employers, and get help turning military experience into a resume that lands interviews.'),
    ],
    newsletters: [
      nl('The Debrief: October Edition', -3, 'Cookout recap, new officer introductions, scholarship deadlines and what is coming up this month.'),
      nl('The Debrief: September Edition', -33, 'Meet the new semester: meeting times, who to call for what, and a handy map of campus resources.'),
      nl('The Debrief: Spring Wrap-Up', -150, 'A look back at the year, photos from our events and a thank-you to everyone who showed up.'),
    ],
    announcements: [
      an('This is sample content', 0, 'This placeholder content shows how the site looks. Log in to the officer dashboard to edit or delete these posts and add your own. No coding required.', true),
      an('Scholarship deadline approaching', -2, 'Applications close at the end of the month. Check with the financial aid office or stop by a meeting and we will help you find the form.'),
      an('New veterans lounge hours', -5, 'The lounge is now open weekdays from 8 a.m. to 6 p.m. Coffee, study space and a microwave are available to all members.'),
      an('Peer mentorship sign-ups are open', -8, 'Get paired with an upperclass student veteran who has been through your program. Email us to sign up.'),
    ],
  };
}

function demoLoad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { /* start fresh */ }
  if (!s || !s.seeded) { s = seedDemo(); demoSave(s); }
  return s;
}

function demoSave(s) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(s));
  } catch {
    throw new Error('The demo ran out of browser storage. Try a smaller picture.');
  }
}

export function resetDemo() {
  localStorage.removeItem(DEMO_KEY);
}

/* ---------- reading ---------- */

export async function loadSettings() {
  let rows;
  if (isDemo) rows = Object.entries(demoLoad().settings).map(([key, value]) => ({ key, value }));
  else rows = ok(await client.from('settings').select('key,value'));
  const out = { ...DEFAULT_SETTINGS };
  rows.forEach((r) => { if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value; });
  return out;
}

export async function listRows(table, { publishedOnly = false } = {}) {
  if (isDemo) return demoLoad()[table].filter((r) => !publishedOnly || r.published).map((r) => ({ ...r }));
  let q = client.from(table).select('*');
  if (publishedOnly) q = q.eq('published', true);
  return ok(await q);
}

export async function getRow(table, id) {
  if (isDemo) {
    const row = demoLoad()[table].find((r) => r.id === id);
    return row ? { ...row } : null;
  }
  return ok(await client.from(table).select('*').eq('id', id).maybeSingle());
}

export async function loadPublic() {
  const [settings, announcements, events, newsletters] = await Promise.all([
    loadSettings(),
    listRows('announcements', { publishedOnly: true }),
    listRows('events', { publishedOnly: true }),
    listRows('newsletters', { publishedOnly: true }),
  ]);
  return { settings, announcements, events, newsletters };
}

/* ---------- writing (officers only) ---------- */

export async function saveRow(table, id, values) {
  const row = { ...values, is_sample: false };
  if (isDemo) {
    const s = demoLoad();
    if (id) {
      const i = s[table].findIndex((r) => r.id === id);
      if (i < 0) throw new Error('That item no longer exists.');
      s[table][i] = { ...s[table][i], ...row };
    } else {
      s[table].push({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row });
    }
    demoSave(s);
    return;
  }
  if (id) ok(await client.from(table).update(row).eq('id', id));
  else ok(await client.from(table).insert(row));
}

export async function deleteRow(table, id) {
  if (isDemo) {
    const s = demoLoad();
    s[table] = s[table].filter((r) => r.id !== id);
    demoSave(s);
    return;
  }
  ok(await client.from(table).delete().eq('id', id));
}

export async function saveSettings(values) {
  if (isDemo) {
    const s = demoLoad();
    s.settings = { ...s.settings, ...values };
    demoSave(s);
    return;
  }
  ok(await client.from('settings').upsert(Object.entries(values).map(([key, value]) => ({ key, value })), { onConflict: 'key' }));
}

/* ---------- files ---------- */

// `download`: a file name makes the browser save the file instead of showing it.
export function fileUrl(path, download) {
  if (!path) return '';
  if (isDemo) return demoLoad().files[path] || '';
  if (!client) connect();
  return client.storage.from(CONFIG.bucket).getPublicUrl(path, download ? { download } : undefined).data.publicUrl;
}

export async function uploadFile(blob, ext) {
  const path = `${crypto.randomUUID().replace(/-/g, '')}.${ext}`;
  if (isDemo) {
    const url = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const s = demoLoad();
    s.files[path] = url;
    demoSave(s);
    return path;
  }
  ok(await client.storage.from(CONFIG.bucket).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }));
  return path;
}

export async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  if (isDemo) {
    const s = demoLoad();
    list.forEach((p) => delete s.files[p]);
    demoSave(s);
    return;
  }
  try { await client.storage.from(CONFIG.bucket).remove(list); } catch { /* an orphaned file is harmless */ }
}

/* ---------- officer login ---------- */

export async function currentUser() {
  if (isDemo) return demoLoad().signedIn ? { email: 'demo@example.test' } : null;
  const { data } = await client.auth.getSession();
  return data.session ? data.session.user : null;
}

export async function signIn(email, password) {
  if (isDemo) {
    const s = demoLoad();
    s.signedIn = true;
    demoSave(s);
    return;
  }
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login/i.test(error.message)) throw new Error("That email and password don't match.");
    throw error;
  }
}

export async function signOut() {
  if (isDemo) {
    const s = demoLoad();
    s.signedIn = false;
    demoSave(s);
    return;
  }
  await client.auth.signOut();
}

export async function changePassword(password) {
  if (isDemo) return;
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}
