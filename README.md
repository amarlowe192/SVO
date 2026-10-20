# SVO website

A one-page site for the Student Veterans Organization, plus an officer dashboard so non-technical officers can update announcements, events and newsletters from any browser.

- **The site** is plain static files (the `site/` folder), so any static host works, including Porkbun Static Hosting.
- **The data** (announcements, events, newsletters, site text, photos and PDFs) lives in [Supabase](https://supabase.com), a hosted database with logins and file storage. The free plan is plenty for this.
- **The dashboard** is at `/admin/` on your site. Officers log in with an email and password and use simple forms.

Nothing here needs to be installed or built on a server. Hosting is "upload the files."

## Try it right now (demo mode)

Out of the box the site runs in **demo mode** with sample content, and the dashboard saves to your own browser only. To look around you need [Node.js](https://nodejs.org) 20 or newer:

```bash
npm install
npm run dev
```

Open http://localhost:3000 for the site and http://localhost:3000/admin/ for the dashboard (no password in demo mode).

## Going live (about 30 minutes, one time)

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Pick any name, a region near your school, and save the database password somewhere safe (you won't need it day to day).
2. Open **SQL Editor**, then **New query**. Paste in everything from [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the tables, the security rules and some starter content. It is safe to run again.

### 2. Lock down who can sign in

1. Go to **Authentication**, then **Sign In / Providers** (labels shift a little over time), open **Email**, and turn **off** "Allow new users to sign up". This is important: it means only people you add yourself can ever log in.
2. Go to **Authentication**, then **Users**, then **Add user**, then **Create new user**. Enter the first officer's email and a password, and tick **Auto Confirm User**. Repeat for each officer.

Anyone with a login can edit the whole site, so only add officers you trust. To remove someone who graduated, open the three-dot menu on their row in **Users** and choose **Delete user**.

### 3. Connect the site to Supabase

1. In Supabase open **Project Settings**, then **API Keys**. Copy the **Project URL** and the **publishable key** (older projects call it the **anon** key).
2. Paste both into [`site/js/config.js`](site/js/config.js). These two values are meant to be public. **Never** paste a `service_role` or `secret` key anywhere.

### 4. Put the site online

1. Zip the **contents** of the `site/` folder, so `index.html` is at the top level of the zip, not inside a folder.
2. In Porkbun, set up **Static Hosting** for your domain and upload the zip using its upload option. (FTP or the GitHub connection work too, if you prefer.)
3. Visit your domain, then `your-domain/admin/` and log in.

When you change anything in the `site/` folder later (like the colors), upload the files again. Day-to-day content changes never need this. They are made in the dashboard.

### 5. Replace the sample content

The dashboard marks starter items **Sample**. Edit or delete them, and fill in the real text under **Site text & photos**.

## Using the dashboard

| Section | What it controls |
| --- | --- |
| **Announcements** | Cards in the announcements carousel. Can be pinned, set to expire, or saved as drafts. |
| **Events** | Date, time, place, photo, RSVP link. Past events leave the page by themselves. Visitors get an "Add to calendar" button. |
| **Newsletters** | Upload a PDF or link to an online version, plus a cover picture. The newest issue is featured. |
| **Site text & photos** | Headline, about text, main photo, logo, meeting times, contact email, social links, the footer support message. |
| **My account** | Change your password. |

Big phone photos are shrunk automatically before upload. Changes appear on the live site as soon as you save (visitors may need to refresh).

## Good to know

- **Free plan pausing.** Supabase may pause free projects after a stretch with no activity (for example, a quiet summer). Visitors loading the site count as activity, but check Supabase's current rules. If it pauses, open the project in Supabase and click **Restore**. Your data is kept.
- **Forgotten passwords.** Resetting by email needs extra email setup in Supabase, so the simple way is for the project owner to set a new password under **Authentication**, then **Users**.
- **Search engines.** The page fills in with JavaScript. Google handles that fine, but other crawlers and link previews only see the basic title and description in `site/index.html`.
- **Backups.** In the Supabase dashboard you can export tables as CSV from **Table Editor**. Do this occasionally.

## Where things live

```
site/                  everything you upload to Porkbun
  index.html           the public page
  admin/               the dashboard
  js/config.js         your Supabase URL and key (the only file to edit)
  js/defaults.js       fallback site text
  css/                 styles; colors are at the top of site.css and admin.css
  img/                 placeholder pictures and favicon
supabase/schema.sql    database, security rules, starter content (run once in Supabase)
dev-server.js          tiny local preview server (`npm run dev`), not used in production
```

## How it is secured

- The public site can only **read published** rows. Drafts stay hidden.
- Only **signed-in officers** can add, change or delete anything, enforced by database rules in `schema.sql`, not by the browser.
- Uploads are limited to JPG, PNG, WebP, GIF and PDF files up to 10 MB, enforced by Supabase storage.
- Public sign-up must stay **off** (step 2), because any signed-in user counts as an officer.

## Colors

Ruby red `#A6192E` and charcoal `#2D2828` plus ocean blue `#006BA6` and gold `#FFBC42`. Charcoal and white carry most of the page, red is for actions, blue is used once (the Join band) and gold is a small highlight. They are defined at the top of `site/css/site.css` and `site/css/admin.css`.
