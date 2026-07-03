# earth-skiddle-cron

Standalone Cloudflare Worker that polls the Skiddle events API on a schedule and writes
new UK grassroots/local music events directly into the shared `earth-events` D1 database
(the same database the main app and `earth-ticketmaster-cron` both read from and write
to). Deduplicates against existing rows via `external_id`, prefixed `skiddle:` to keep
that namespace disjoint from Ticketmaster's unprefixed ids in the shared unique index.

Queries `eventcode=LIVE,CLUB,FEST` nationwide (`country=GB`, no lat/lng radius — matching
`earth-ticketmaster-cron`'s no-location-filter precedent). Note: Skiddle's search results
carry no structured genre field (only `EventCode`, a coarse event-type, plus free-text
`eventname`/`description`) — every Skiddle-sourced event lands with `genre: 'Other'` for
now. `genre-map.ts` is kept as a real function rather than deleted, in case a genre signal
turns up in a future response inspection.

## Local dev

Create `.dev.vars` (gitignored) with a real key:

```
SKIDDLE_API_KEY=your_skiddle_api_key
```

Run it:

```bash
npx wrangler dev
curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```

Local `wrangler dev` uses its own isolated local D1 state (per-directory, not shared with
the root app's or `earth-ticketmaster-cron`'s local D1) — apply all `migrations/*.sql`
files against it first via `wrangler d1 execute earth-events --local --file=...` in order,
or the scheduled handler will fail with `no such table: events`.

## Deploy

```bash
npx wrangler secret put SKIDDLE_API_KEY
npx wrangler deploy
```

Runs independently of the main app's `npm run deploy` — deploy this worker separately
when its code changes. Migration `0004_add_skiddle_source.sql` (adding `'skiddle'` to
the `events.source` CHECK constraint) must be applied to the shared D1 database before
this worker's first production run, or every insert will fail the constraint.
