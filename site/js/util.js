// Small helpers shared by the public page and the dashboard.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Inline formatting on ALREADY-ESCAPED text: **bold** and auto-linked URLs.
function inline(escaped) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" rel="noopener noreferrer">$1</a>');
}

// Plain text typed in the dashboard -> safe HTML. A blank line starts a new paragraph.
export function rich(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${inline(esc(p)).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// Hero headline: *word* gets the highlighter treatment.
export const highlight = (text) => esc(text).replace(/\*(.+?)\*/g, '<mark>$1</mark>');

// '' = empty, null = invalid, otherwise a safe http(s)/mailto URL.
export function cleanUrl(u) {
  u = String(u ?? '').trim();
  if (!u) return '';
  if (/^(https?:\/\/|mailto:)/i.test(u)) {
    try { new URL(u); return u; } catch { return null; }
  }
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) return 'https://' + u;
  return null;
}

/* ---------- dates: events are stored as wall-clock strings (no timezone) ---------- */

export const pad = (n) => String(n).padStart(2, '0');

export function nowIn(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const g = (t) => parts.find((p) => p.type === t).value;
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

export function parseLocal(s) {
  const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
}

const fix = (s) => s.replace(/ /g, ' ');
export const fmtDay = (s) => { const d = parseLocal(s); return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''; };
export const fmtFull = (s) => { const d = parseLocal(s); return d ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''; };
export const fmtTime = (s) => { const d = parseLocal(s); return d ? fix(d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })) : ''; };
export const monthAbbr = (s) => { const d = parseLocal(s); return d ? d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : ''; };
export const dayNum = (s) => { const d = parseLocal(s); return d ? d.getDate() : ''; };

export function timeRange(ev) {
  const start = fmtTime(ev.starts_at);
  if (!ev.end_time) return start;
  return `${start} – ${fmtTime(ev.starts_at.slice(0, 10) + 'T' + ev.end_time)}`;
}

// An event stays "upcoming" until its end time (or the end of that day if none is given).
export const eventEnd = (ev) => ev.starts_at.slice(0, 10) + 'T' + (ev.end_time || '23:59');

export function shiftDate(tz, days, time) {
  const now = nowIn(tz);
  const d = new Date(+now.slice(0, 4), +now.slice(5, 7) - 1, +now.slice(8, 10) + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}${time ? 'T' + time : ''}`;
}

/* ---------- "Add to calendar" ---------- */

export function icsText(ev, settings) {
  const stamp = (s) => s.replace(/[-:]/g, '').slice(0, 13) + '00';
  let endStr = ev.end_time ? ev.starts_at.slice(0, 10) + 'T' + ev.end_time : null;
  if (!endStr || endStr <= ev.starts_at) {
    const e = new Date(parseLocal(ev.starts_at).getTime() + 60 * 60 * 1000);
    endStr = `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())}T${pad(e.getHours())}:${pad(e.getMinutes())}`;
  }
  const t = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${settings.orgName}//Website//EN`,
    'BEGIN:VEVENT', `UID:${ev.id}@${String(settings.orgName).toLowerCase().replace(/\W+/g, '')}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`,
    `DTSTART:${stamp(ev.starts_at)}`, `DTEND:${stamp(endStr)}`,
    `SUMMARY:${t(ev.title)}`, `LOCATION:${t(ev.location)}`, `DESCRIPTION:${t(ev.description)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(ev, settings) {
  const blob = new Blob([icsText(ev, settings)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (ev.title || 'event').replace(/[^\w]+/g, '-').toLowerCase() + '.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
