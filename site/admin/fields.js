// What officers can edit, and how each form is laid out.
import { fmtDay, fmtFull, timeRange, eventEnd } from '../js/util.js';

export const MAX_MB = 10;
const TEXT_TIP = 'Tip: leave a blank line for a new paragraph. **Bold** works, and web addresses become links on their own.';

export const COLLECTIONS = {
  announcements: {
    singular: 'announcement', plural: 'Announcements',
    blurb: 'Short updates that appear in the announcements carousel on the home page.',
    fields: [
      { name: 'title', label: 'Headline', type: 'text', required: true, max: 120 },
      { name: 'body', label: 'Message', type: 'textarea', required: true, rows: 6, help: TEXT_TIP },
      { name: 'posted_on', label: 'Posted on', type: 'date', required: true, today: true },
      { name: 'pinned', label: 'Pin this to the front', type: 'checkbox', help: 'Pinned announcements always show first.' },
      { name: 'expires_on', label: 'Hide it after (optional)', type: 'date', help: 'Leave blank to keep it up until you remove it.' },
      { name: 'published', label: 'Show on the website', type: 'checkbox', default: true, help: 'Uncheck to save it as a draft.' },
    ],
    sort: (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.posted_on.localeCompare(a.posted_on),
    describe(it, now) {
      const badges = [];
      if (it.pinned) badges.push('Pinned');
      if (it.expires_on && it.expires_on < now.slice(0, 10)) badges.push('Expired');
      return { meta: fmtFull(it.posted_on), badges };
    },
  },
  events: {
    singular: 'event', plural: 'Events',
    blurb: 'Shown in the events carousel and the "Next event" highlight. Past events leave the page by themselves.',
    fields: [
      { name: 'title', label: 'Event name', type: 'text', required: true, max: 120 },
      { name: 'starts_at', label: 'Starts', type: 'datetime', required: true },
      { name: 'end_time', label: 'Ends at (optional)', type: 'time', help: 'Same day. The event stays listed until this time.' },
      { name: 'location', label: 'Where', type: 'text', max: 160, help: 'Building and room, address, or "Online".' },
      { name: 'description', label: 'Details', type: 'textarea', rows: 5, help: TEXT_TIP },
      { name: 'image', label: 'Photo (optional)', type: 'image', help: 'Leave empty to show the placeholder.' },
      { name: 'link', label: 'RSVP or info link (optional)', type: 'url', help: 'Adds an "RSVP / more info" button.' },
      { name: 'published', label: 'Show on the website', type: 'checkbox', default: true, help: 'Uncheck to save it as a draft.' },
    ],
    sort: (a, b) => b.starts_at.localeCompare(a.starts_at),
    describe(it, now) {
      return { meta: `${fmtDay(it.starts_at)} · ${timeRange(it)}`, badges: eventEnd(it) < now ? ['Past'] : [] };
    },
  },
  newsletters: {
    singular: 'newsletter', plural: 'Newsletters',
    blurb: 'Upload a PDF or link to an online version. The newest issue is featured at the top of the site.',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, max: 120 },
      { name: 'issued_on', label: 'Date', type: 'date', required: true, today: true },
      { name: 'summary', label: 'Short summary', type: 'textarea', rows: 4, help: TEXT_TIP },
      { name: 'file', label: 'Newsletter PDF', type: 'file', help: `PDF files up to ${MAX_MB} MB.` },
      { name: 'url', label: 'Or link to an online version', type: 'url', help: 'Used only when there is no PDF.' },
      { name: 'cover', label: 'Cover picture (optional)', type: 'image' },
      { name: 'published', label: 'Show on the website', type: 'checkbox', default: true, help: 'Uncheck to save it as a draft.' },
    ],
    sort: (a, b) => b.issued_on.localeCompare(a.issued_on),
    describe(it) {
      return { meta: fmtFull(it.issued_on), badges: !it.file && !it.url ? ['No PDF or link'] : [] };
    },
  },
};

export const TIMEZONES = [
  ['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'],
  ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'],
  ['Pacific/Honolulu', 'Hawaii'], ['Pacific/Guam', 'Guam'],
];

export const SETTINGS_GROUPS = [
  {
    title: 'Name & school',
    fields: [
      { name: 'orgName', label: 'Short name', type: 'text', required: true, max: 30, help: 'Shown in the top corner, e.g. SVO.' },
      { name: 'fullName', label: 'Full name', type: 'text', required: true, max: 80 },
      { name: 'school', label: 'School', type: 'text', required: true, max: 80 },
      { name: 'logo', label: 'Logo (optional)', type: 'image', help: 'A square or wide image on a transparent background works best. Leave empty to use the default star badge.' },
      { name: 'timezone', label: 'Time zone', type: 'select', options: TIMEZONES, help: 'Used to decide when an event counts as "past".' },
    ],
  },
  {
    title: 'Top of the home page',
    fields: [
      { name: 'tagline', label: 'Small line above the headline', type: 'text', max: 60 },
      { name: 'heroTitle', label: 'Headline', type: 'text', max: 100, help: 'Put *asterisks* around the words you want highlighted.' },
      { name: 'heroText', label: 'About the SVO', type: 'textarea', rows: 6, max: 700, help: 'A short introduction for new visitors. ' + TEXT_TIP },
      { name: 'heroImage', label: 'Main photo', type: 'image', help: 'A group photo works great. Landscape orientation is best.' },
    ],
  },
  {
    title: 'Joining & contact',
    fields: [
      { name: 'joinText', label: 'Invitation text', type: 'textarea', rows: 3, max: 400 },
      { name: 'meetingInfo', label: 'When & where you meet', type: 'text', max: 160 },
      { name: 'contactEmail', label: 'Contact email', type: 'email' },
      { name: 'joinLink', label: 'Sign-up form link (optional)', type: 'url', help: 'If empty, the button emails your contact address instead.' },
      { name: 'instagram', label: 'Instagram link', type: 'url' },
      { name: 'facebook', label: 'Facebook link', type: 'url' },
      { name: 'discord', label: 'Discord link', type: 'url' },
    ],
  },
  {
    title: 'Footer',
    fields: [
      { name: 'crisisText', label: 'Support line message', type: 'textarea', rows: 2, max: 300, help: 'Shown at the bottom of the page.' },
      { name: 'footerNote', label: 'Footer note', type: 'text', max: 120 },
    ],
  },
];

export const MESSAGES = {
  created: 'Saved. It is live on the site now unless you left it as a draft.',
  updated: 'Changes saved.',
  deleted: 'Deleted.',
  settings: 'Site settings saved.',
  password: 'Password changed.',
};
