@docs/BRAIN.md

# Notes for AI assistants

## Continuing on any computer (B&A Developers)
- If `AI_START_HERE.md` is in this folder (downloads from the B&A owner area include it), read it first: it says where this project lives, how it goes live and how to set it up.
- Start by reading the notes (README.md and docs/README.md) and running `git status` and `git log -15 --stat`, then continue from where the last session stopped.
- Before you finish: update the notes (what changed, decisions, what is left, where you stopped), then commit and push to GitHub. The B&A vault copies GitHub every night, so the next computer or AI continues from exactly here.
- Never commit secrets (.env files, keys, passwords).

## Project brain
- `docs/BRAIN.md` (imported above) links everything. Log every session at the top of `docs/LOG.md` and keep `docs/ROADMAP.md` current.

## Supabase: new tables need explicit grants (from 30 October 2026)
From 30 October 2026 Supabase stops opening new tables in the `public` schema to the API automatically
([changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)).
Existing tables keep working. Every migration that creates a table in `public` must, in the same file:
enable row level security, add its policies, and grant exactly what the app needs, for example:

```sql
grant select, insert, update, delete on public.my_table to service_role;   /* server code */
grant select on public.my_table to anon;   /* only if visitors read it */
grant select, insert, update, delete on public.my_table to authenticated;   /* only if signed in users use it; RLS decides the rows */
```

Never fix a "permission denied" by granting on all tables at once. Checked 23 October 2026: every existing table is reachable.
