-- Local demo data: a few approved reviews so the slider has something to show.
insert into public.reviews (name, venue, quote, role, rating, approved, consented_at) values
  ('Ben T.', 'Sample Pickle Park', 'I booked a court for Friday night in less than a minute. No more waiting for a reply.', 'player', 5, true, now()),
  ('Mara L.', 'Baseline Courts', 'Our open play sessions fill up on their own now. I just check the list before we open.', 'owner', 5, true, now()),
  ('Jojo P.', null, 'Seeing which slots are free before I message the group saves everyone time.', 'player', 4, true, now()),
  ('Rina S.', 'Rally Yard', 'Double bookings stopped the first week. My staff picked it up in a day.', 'owner', 5, true, now());
