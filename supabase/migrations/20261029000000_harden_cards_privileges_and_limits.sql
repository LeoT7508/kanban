revoke all on table public.cards from anon;
revoke all on table public.cards from authenticated;
grant select, insert, update, delete on table public.cards to authenticated;
alter table public.cards force row level security;
alter table public.cards
  add constraint cards_title_len check (char_length(title) <= 200),
  add constraint cards_description_len check (char_length(description) <= 5000),
  add constraint cards_assignee_len check (char_length(assignee) <= 100);
