// Turns site data into the HTML of the public page.
import { esc, rich, highlight, nowIn, eventEnd, fmtDay, fmtFull, monthAbbr, dayNum, timeRange } from './util.js';
import { fileUrl } from './data.js';

const PH = {
  hero: 'img/placeholder-hero.svg',
  event: 'img/placeholder-event.svg',
  newsletter: 'img/placeholder-newsletter.svg',
};

/* ---------- what is visible right now ---------- */

export function selectContent(db) {
  const now = nowIn(db.settings.timezone);
  const today = now.slice(0, 10);
  return {
    upcoming: db.events
      .filter((e) => e.published && eventEnd(e) >= now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    newsletters: db.newsletters.filter((n) => n.published).sort((a, b) => b.issued_on.localeCompare(a.issued_on)),
    announcements: db.announcements
      .filter((a) => a.published && (!a.expires_on || a.expires_on >= today))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.posted_on.localeCompare(a.posted_on)),
  };
}

/* ---------- building blocks ---------- */

const NAV = [
  ['#top', 'Home'],
  ['#announcements', 'Announcements'],
  ['#events', 'Events'],
  ['#newsletters', 'Newsletters'],
];

const ARROW = (dir) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;

const sectionHead = (id, kicker, title, sub) =>
  `<div class="section-head"><p class="eyebrow">${esc(kicker)}</p><h2 id="${id}-title">${esc(title)}</h2>${sub ? `<p class="section-sub">${esc(sub)}</p>` : ''}</div>`;

const empty = (msg) => `<p class="empty">${esc(msg)}</p>`;

const dateTile = (e) =>
  `<div class="datetile" aria-hidden="true"><span>${monthAbbr(e.starts_at)}</span><b>${dayNum(e.starts_at)}</b></div>`;

const calendarButton = (e) => `<button type="button" class="btn small ghost" data-ics="${esc(e.id)}">+ Add to calendar</button>`;

function carousel(label, slides) {
  return `<div class="carousel" data-carousel role="group" aria-roledescription="carousel" aria-label="${esc(label)}">
    <div class="stage"><div class="track">${slides.map((s) => `<article class="slide" data-title="${esc(s.title)}" aria-roledescription="slide">${s.html}</article>`).join('')}</div></div>
    <div class="controls" hidden>
      <button class="arrow" type="button" data-prev aria-label="Previous">${ARROW('prev')}</button>
      <div class="dots" data-dots></div>
      <p class="count" data-count aria-hidden="true"></p>
      <button class="arrow" type="button" data-next aria-label="Next">${ARROW('next')}</button>
    </div>
    <p class="sr" data-status aria-live="polite"></p>
  </div>`;
}

const announcementSlide = (a) => ({
  title: a.title,
  html: `<div class="slide-card ann">
    <div class="ann-top">${a.pinned ? '<span class="chip">Pinned</span>' : ''}<time>${esc(fmtFull(a.posted_on))}</time></div>
    <h3>${esc(a.title)}</h3>
    <div class="prose">${rich(a.body)}</div>
  </div>`,
});

const eventSlide = (e) => ({
  title: e.title,
  html: `<div class="slide-card evt">
    <div class="evt-media"><img src="${e.image ? esc(fileUrl(e.image)) : PH.event}" alt="" loading="lazy">${dateTile(e)}</div>
    <div class="evt-body">
      <h3>${esc(e.title)}</h3>
      <p class="meta">${esc(fmtDay(e.starts_at))} · ${esc(timeRange(e))}</p>
      ${e.location ? `<p class="meta">${esc(e.location)}</p>` : ''}
      ${e.description ? `<div class="prose">${rich(e.description)}</div>` : ''}
      <div class="actions">
        ${e.link ? `<a class="btn small primary" href="${esc(e.link)}" rel="noopener noreferrer">RSVP / more info</a>` : ''}
        ${calendarButton(e)}
      </div>
    </div>
  </div>`,
});

const newsHref = (n) => (n.file ? fileUrl(n.file) : n.url);

const slug = (t) => (String(t).replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'newsletter');

// "View" opens the PDF in a new tab, "Download" saves it. Issues linked online get "Read online".
function newsActions(n, small = false) {
  const size = small ? ' small' : '';
  if (n.file) {
    const name = `${slug(n.title)}.pdf`;
    return `<a class="btn primary${size}" href="${esc(fileUrl(n.file))}" target="_blank" rel="noopener noreferrer">View</a>
      <a class="btn ghost${size}" href="${esc(fileUrl(n.file, name))}" download="${esc(name)}">Download</a>`;
  }
  if (n.url) return `<a class="btn primary${size}" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">Read online</a>`;
  return `<span class="muted">Not available yet</span>`;
}

function featuredNewsletter(n) {
  return `<article class="card feature">
    <div class="cover"><img src="${n.cover ? esc(fileUrl(n.cover)) : PH.newsletter}" alt="" loading="lazy"></div>
    <div class="feature-body">
      <p class="eyebrow">Latest issue · ${esc(fmtFull(n.issued_on))}</p>
      <h3>${esc(n.title)}</h3>
      ${n.summary ? `<div class="prose">${rich(n.summary)}</div>` : ''}
      <div class="actions">${newsActions(n)}</div>
    </div>
  </article>`;
}

const issueRow = (n) =>
  `<li><div class="issue-row"><span class="issue-title"><strong>${esc(n.title)}</strong><small>${esc(fmtFull(n.issued_on))}</small></span><span class="issue-actions">${newsActions(n, true)}</span></div></li>`;

/* ---------- the page ---------- */

export function renderApp(db) {
  const s = db.settings;
  const d = selectContent(db);
  const next = d.upcoming[0];
  const latest = d.newsletters[0];
  const latestHref = latest ? newsHref(latest) : '';

  const logo = s.logo
    ? `<img class="logo-img" src="${esc(fileUrl(s.logo))}" alt="">`
    : `<span class="logo-badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg></span>`;

  const socials = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['discord', 'Discord']]
    .filter(([k]) => s[k])
    .map(([k, label]) => `<a href="${esc(s[k])}" rel="noopener noreferrer">${label}</a>`)
    .join('');

  const joinBtn = s.joinLink
    ? `<a class="btn light big" href="${esc(s.joinLink)}" rel="noopener noreferrer">Sign up</a>`
    : s.contactEmail
      ? `<a class="btn light big" href="mailto:${esc(s.contactEmail)}">Email us</a>`
      : '';

  const spotEvent = next
    ? `<article class="spot">
        ${dateTile(next)}
        <div class="spot-body">
          <p class="eyebrow">Next event</p>
          <h2>${esc(next.title)}</h2>
          <p class="meta">${esc(fmtDay(next.starts_at))} · ${esc(timeRange(next))}${next.location ? `<br>${esc(next.location)}` : ''}</p>
          <div class="actions">${calendarButton(next)}<a class="btn small link" href="#events">See all events</a></div>
        </div>
      </article>`
    : `<article class="spot"><div class="spot-body"><p class="eyebrow">Next event</p><h2>Nothing scheduled yet</h2><p class="meta">New events will show up here as soon as they are announced.</p></div></article>`;

  const spotNews = latest
    ? `<article class="spot alt">
        <div class="spot-body">
          <p class="eyebrow">Latest newsletter</p>
          <h2>${esc(latest.title)}</h2>
          <p class="meta">${esc(fmtFull(latest.issued_on))}</p>
          <div class="actions"><a class="btn small primary" href="${latestHref ? esc(latestHref) : '#newsletters'}"${latestHref ? ' target="_blank" rel="noopener noreferrer"' : ''}>Read the latest issue</a></div>
        </div>
      </article>`
    : `<article class="spot alt"><div class="spot-body"><p class="eyebrow">Latest newsletter</p><h2>Coming soon</h2><p class="meta">Our first issue is on its way.</p></div></article>`;

  return `
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="#top">${logo}<span class="brand-text"><strong>${esc(s.orgName)}</strong><small>${esc(s.fullName)}</small></span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav id="nav" aria-label="Main">
      ${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
      <a class="nav-cta" href="#join">Join us</a>
    </nav>
  </div>
</header>
<main id="main">
<section class="hero" id="top">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">${esc(s.tagline)}</p>
      <h1>${highlight(s.heroTitle)}</h1>
      <div class="lede prose">${rich(s.heroText)}</div>
      <div class="actions">
        <a class="btn primary big" href="#events">See upcoming events</a>
        <a class="btn ghost big" href="#join">Get involved</a>
      </div>
    </div>
    <figure class="hero-photo"><img src="${s.heroImage ? esc(fileUrl(s.heroImage)) : PH.hero}" alt=""></figure>
  </div>
</section>

<section class="spotlight" aria-label="Highlights">
  <div class="wrap spot-grid">${spotEvent}${spotNews}</div>
</section>

<section class="section" id="announcements" aria-labelledby="announcements-title">
  <div class="wrap">
    ${sectionHead('announcements', 'Stay in the loop', 'Announcements', 'News, reminders and deadlines from the SVO.')}
    ${d.announcements.length ? carousel('Announcements', d.announcements.slice(0, 12).map(announcementSlide)) : empty('No announcements right now. Check back soon.')}
  </div>
</section>

<section class="section dark" id="events" aria-labelledby="events-title">
  <div class="wrap">
    ${sectionHead('events', 'Mark your calendar', 'Upcoming events', 'Meetups, workshops and community events. Pick one from the dots or tap a neighboring card.')}
    ${d.upcoming.length ? carousel('Upcoming events', d.upcoming.slice(0, 12).map(eventSlide)) : empty('Nothing on the calendar yet. New events will appear here.')}
  </div>
</section>

<section class="section soft" id="newsletters" aria-labelledby="newsletters-title">
  <div class="wrap">
    ${sectionHead('newsletters', 'Catch up', 'Newsletters', 'Missed an issue? They are all here.')}
    ${latest
      ? `<div class="news-grid">${featuredNewsletter(latest)}<div class="issues"><h3>Earlier issues</h3>${d.newsletters.length > 1 ? `<ul>${d.newsletters.slice(1, 9).map(issueRow).join('')}</ul>` : '<p class="muted">Past issues will be listed here.</p>'}</div></div>`
      : empty('Our first issue is on its way.')}
  </div>
</section>

<section class="section join" id="join" aria-labelledby="join-title">
  <div class="wrap join-grid">
    <div>
      <p class="eyebrow">Get involved</p>
      <h2 id="join-title">Come hang out with us</h2>
      <p class="join-text">${esc(s.joinText)}</p>
      ${joinBtn}
    </div>
    <dl class="glance">
      ${s.meetingInfo ? `<dt>When &amp; where</dt><dd>${esc(s.meetingInfo)}</dd>` : ''}
      <dt>School</dt><dd>${esc(s.school)}</dd>
      ${s.contactEmail ? `<dt>Contact</dt><dd><a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a></dd>` : ''}
    </dl>
  </div>
</section>
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="crisis"><span class="crisis-label">Support is available</span><p>${esc(s.crisisText)}</p></div>
    <div class="foot-cols">
      <div><strong>${esc(s.orgName)}</strong><p>${esc(s.fullName)}<br>${esc(s.school)}</p>${s.contactEmail ? `<p><a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a></p>` : ''}</div>
      ${socials ? `<div class="socials"><strong>Follow us</strong>${socials}</div>` : ''}
      <div class="foot-links"><strong>On this page</strong>${NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}<a href="#join">Join us</a></div>
    </div>
    <p class="fine">${esc(s.footerNote)} · <a href="admin/">Officer login</a></p>
  </div>
</footer>`;
}

export const pageTitle = (s) => `${s.orgName} · ${s.fullName}`;
