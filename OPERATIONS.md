# Production Operations

## Emergency copy

1. The source of truth is GitHub `main`. Every production change must be committed and pushed.
2. Keep a second clone outside the development machine:
   ```powershell
   git clone https://github.com/alphajallohcanwetalk-pixel/-can-we-talk-backend.git can-we-talk-emergency
   ```
3. For an emergency rollback, use a known-good commit in GitHub, then redeploy that commit through Render and GitHub Pages. Do not reset the production database to roll back application code.
4. Keep production secrets only in Render, Supabase, Stripe, and Resend. Never commit `.env` files.

## Database backup and restore

- Enable Supabase Point-in-Time Recovery/backups on the production project. The exact retention and restore controls depend on the Supabase plan.
- Before schema changes, export the database from Supabase or run a PostgreSQL dump from a trusted machine and store it in encrypted private storage. Do not store database dumps in this repository.
- Test a restore into a separate Supabase project at least once before launch and after major schema changes.
- Keep `backend/schema.sql` and every file in `backend/migrations/` in Git so the database structure can be rebuilt.

## Application logs

The backend writes one JSON request log per response and includes an `x-request-id` response header. In Render:

1. Open the backend service.
2. Use **Logs** to search by `request_id`, path, status, or `type:error`.
3. Configure a log drain or external log service if logs must be retained beyond the Render retention period.
4. Create an alert for repeated 5xx responses, webhook failures, and service restarts.

When reporting a failure, capture the URL, UTC time, HTTP status, and `x-request-id`. Never include access tokens, API keys, or full request bodies.

## Error monitoring

For stack traces and crash notifications, add a server-side monitoring provider such as Sentry to the backend. Configure its DSN only as a Render secret. Do not put a server DSN or service credentials in `frontend/app.html`.

This backend now sends uncaught request errors to Sentry when `SENTRY_DSN` is set. In Render, add `SENTRY_DSN` and redeploy, then configure Sentry alerts for unhandled exceptions and elevated 5xx rates.

## Recovery checklist

1. Check Render service status and logs using the request ID.
2. Check `/api/health`.
3. Check Supabase status and database errors.
4. Check Stripe webhook delivery attempts and response codes.
5. Roll back the application to the last known-good Git commit if the issue started after deployment.
6. Restore the database only when data corruption is confirmed, and use a separate project for investigation first.
