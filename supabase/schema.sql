-- SVO website: database, security rules and starter content.
--
-- HOW TO RUN: in your Supabase project open "SQL Editor", click "New query",
-- paste this whole file, and press "Run". It is safe to run more than once.
--
-- WHO CAN DO WHAT
--   Anyone (the public website):  read PUBLISHED announcements, events, newsletters, and site text.
--   Signed-in officers:           read everything and add / edit / delete.
-- Keep "Allow new users to sign up" turned OFF in Authentication settings, so the only
-- signed-in people are the officers you add yourself (see README).

-- ---------------------------------------------------------------- tables

create table if not exists public.settings (
  key   text primary key,
  value text not null default ''
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) <= 160),
  body       text not null default '' check (char_length(body) <= 6000),
  posted_on  date not null default current_date,
  pinned     boolean not null default false,
  expires_on date,
  published  boolean not null default true,
  is_sample  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) <= 160),
  -- Wall-clock time in your school's time zone, like 2026-10-22T17:30
  starts_at   text not null check (char_length(starts_at) = 16),
  end_time    text not null default '' check (char_length(end_time) in (0, 5)),
  location    text not null default '' check (char_length(location) <= 200),
  description text not null default '' check (char_length(description) <= 6000),
  link        text not null default '' check (char_length(link) <= 500),
  image       text not null default '',
  published   boolean not null default true,
  is_sample   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.newsletters (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) <= 160),
  issued_on  date not null default current_date,
  summary    text not null default '' check (char_length(summary) <= 6000),
  file       text not null default '',
  url        text not null default '' check (char_length(url) <= 500),
  cover      text not null default '',
  published  boolean not null default true,
  is_sample  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- security rules

alter table public.settings      enable row level security;
alter table public.announcements enable row level security;
alter table public.events        enable row level security;
alter table public.newsletters   enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.settings, public.announcements, public.events, public.newsletters to anon, authenticated;
grant insert, update, delete on public.settings, public.announcements, public.events, public.newsletters to authenticated;

-- settings: everyone reads, officers write
drop policy if exists "public read"   on public.settings;
drop policy if exists "officers write" on public.settings;
create policy "public read"    on public.settings for select to anon, authenticated using (true);
create policy "officers write" on public.settings for all    to authenticated using (true) with check (true);

-- content tables: everyone reads published rows, officers do everything
drop policy if exists "public read published" on public.announcements;
drop policy if exists "officers all"          on public.announcements;
create policy "public read published" on public.announcements for select to anon, authenticated using (published);
create policy "officers all"          on public.announcements for all    to authenticated using (true) with check (true);

drop policy if exists "public read published" on public.events;
drop policy if exists "officers all"          on public.events;
create policy "public read published" on public.events for select to anon, authenticated using (published);
create policy "officers all"          on public.events for all    to authenticated using (true) with check (true);

drop policy if exists "public read published" on public.newsletters;
drop policy if exists "officers all"          on public.newsletters;
create policy "public read published" on public.newsletters for select to anon, authenticated using (published);
create policy "officers all"          on public.newsletters for all    to authenticated using (true) with check (true);

-- ---------------------------------------------------------------- file storage (photos and PDFs)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

drop policy if exists "officers upload" on storage.objects;
drop policy if exists "officers change" on storage.objects;
drop policy if exists "officers remove" on storage.objects;
create policy "officers upload" on storage.objects for insert to authenticated with check (bucket_id = 'uploads');
create policy "officers change" on storage.objects for update to authenticated using (bucket_id = 'uploads');
create policy "officers remove" on storage.objects for delete to authenticated using (bucket_id = 'uploads');

-- ---------------------------------------------------------------- starter content
-- Placeholder items so the site looks complete on day one. They are labelled "Sample" in the
-- dashboard. Edit or delete them. Running this file again will NOT add duplicates (but it WILL bring
-- back sample items you deleted, so don't re-run this file after going live).

insert into public.announcements (id, title, body, pinned, posted_on, is_sample) values
  ('00000000-0000-4000-8000-0000000000a1', 'This is sample content', 'This placeholder content shows how the site looks. Log in to the officer dashboard to edit or delete these posts and add your own. No coding required.', true, current_date, true),
  ('00000000-0000-4000-8000-0000000000a2', 'Scholarship deadline approaching', 'Applications close at the end of the month. Check with the financial aid office or stop by a meeting and we will help you find the form.', false, current_date - 2, true),
  ('00000000-0000-4000-8000-0000000000a3', 'New veterans lounge hours', 'The lounge is now open weekdays from 8 a.m. to 6 p.m. Coffee, study space and a microwave are available to all members.', false, current_date - 5, true),
  ('00000000-0000-4000-8000-0000000000a4', 'Peer mentorship sign-ups are open', 'Get paired with an upperclass student veteran who has been through your program. Email us to sign up.', false, current_date - 8, true)
on conflict (id) do nothing;

insert into public.events (id, title, starts_at, end_time, location, description, is_sample) values
  ('00000000-0000-4000-8000-0000000000e1', 'Welcome Back Cookout', to_char(current_date + 6, 'YYYY-MM-DD') || 'T17:30', '19:30', 'Campus Green, by the big oak tree', 'Burgers, dogs, veggie options and lawn games. Bring your family, your roommate, or a friend who has been meaning to stop by.', true),
  ('00000000-0000-4000-8000-0000000000e2', 'GI Bill Office Hours', to_char(current_date + 13, 'YYYY-MM-DD') || 'T12:00', '13:30', 'Student Union, Room 204', 'Bring your questions and your paperwork. A certifying official will be on hand to help with enrollment forms and benefits.', true),
  ('00000000-0000-4000-8000-0000000000e3', 'Veterans Day Remembrance Walk', to_char(current_date + 24, 'YYYY-MM-DD') || 'T10:00', '11:30', 'Meet at the Library steps', 'A short, quiet walk across campus followed by hot chocolate. Open to everyone.', true),
  ('00000000-0000-4000-8000-0000000000e4', 'Career Night: Translating Your Service', to_char(current_date + 31, 'YYYY-MM-DD') || 'T18:00', '20:00', 'Business Building, Atrium', 'Meet veteran alumni and local employers, and get help turning military experience into a resume that lands interviews.', true)
on conflict (id) do nothing;

insert into public.newsletters (id, title, issued_on, summary, is_sample) values
  ('00000000-0000-4000-8000-0000000000b1', 'The Debrief: October Edition', current_date - 3, 'Cookout recap, new officer introductions, scholarship deadlines and what is coming up this month.', true),
  ('00000000-0000-4000-8000-0000000000b2', 'The Debrief: September Edition', current_date - 33, 'Meet the new semester: meeting times, who to call for what, and a handy map of campus resources.', true),
  ('00000000-0000-4000-8000-0000000000b3', 'The Debrief: Spring Wrap-Up', current_date - 150, 'A look back at the year, photos from our events and a thank-you to everyone who showed up.', true)
on conflict (id) do nothing;
