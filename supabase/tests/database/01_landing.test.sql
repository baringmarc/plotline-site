begin;
select plan(11);

-- A sign-up from the landing page (what the register function sends as metadata).
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a1', 'owner@example.com',
  jsonb_build_object(
    'source', 'landing', 'first_name', 'Ana', 'last_name', 'Reyes', 'phone', '09171234567',
    'venue_name', 'Sample Pickle Park', 'location', 'Pasig', 'courts', 3,
    'facebook', '', 'open_play_addon', true, 'message', ''
  )
);
-- A user created some other way gets no sign-up row.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000b2', 'other@example.com', '{}'::jsonb);

select is(
  (select status from public.venue_signups where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'pending', 'landing sign-up creates a pending venue_signups row'
);
select is(
  (select facebook from public.venue_signups where user_id = '00000000-0000-0000-0000-0000000000a1'),
  null, 'empty optional fields are stored as null'
);
select is(
  (select count(*)::int from public.venue_signups where user_id = '00000000-0000-0000-0000-0000000000b2'),
  0, 'other users get no sign-up row'
);

-- Confirming the email starts the 7-day trial.
update auth.users set email_confirmed_at = '2026-10-24 10:00+08' where id = '00000000-0000-0000-0000-0000000000a1';
select results_eq(
  $$select status, trial_ends_at from public.venue_signups where user_id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values ('trial'::text, '2026-10-31 10:00+08'::timestamptz)$$,
  'confirming the email starts the trial'
);

-- Bad metadata fails the sign-up instead of storing junk.
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values (
    '00000000-0000-0000-0000-0000000000c3', 'bad@example.com',
    '{"source":"landing","first_name":"A","last_name":"B","phone":"0917","venue_name":"V","location":"L","courts":99}')$$,
  '23514', null, 'check constraints reject bad sign-up metadata'
);

-- Reviews: one approved, one waiting (seed rows removed first; the rollback restores them).
delete from public.reviews;
insert into public.reviews (name, quote, role, rating, approved, consented_at) values
  ('Ben', 'Booking took me one minute.', 'player', 5, true, now()),
  ('Cara', 'Waiting for approval here.', 'owner', 4, false, now());

-- Owners see only their own sign-up.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.venue_signups), 1, 'an owner sees their own sign-up');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from public.venue_signups), 0, 'another user sees no sign-ups');
select throws_ok(
  $$update public.venue_signups set status = 'active'$$, '42501', null, 'users cannot update sign-ups'
);

reset role;
set local role anon;
select is((select count(*)::int from public.reviews), 1, 'anon sees approved reviews only');
select throws_ok(
  $$insert into public.reviews (name, quote, role, rating, consented_at) values ('X', 'Ten chars at least', 'player', 5, now())$$,
  '42501', null, 'anon cannot insert reviews directly'
);
select is((select count(*)::int from public.venue_signups), 0, 'anon sees no sign-ups');

select * from finish();
rollback;
