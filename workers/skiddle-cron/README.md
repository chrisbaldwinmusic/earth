# earth-skiddle-cron

Standalone Cloudflare Worker that polls the Skiddle events API on a schedule and writes
new UK grassroots/local music events directly into the shared `earth-events` D1 database
(the same database the main app and `earth-ticketmaster-cron` both read from and write
to). Deduplicates against existing rows via `external_id`, prefixed `skiddle:` to keep
that namespace disjoint from Ticketmaster's unprefixed ids in the shared unique index.

**Status: scaffolded, not yet functional.** `src/index.ts`'s `transformEvent` is a
placeholder — Skiddle's actual response JSON shape isn't confirmed yet. Get a free API
key at https://www.skiddle.com/api/join.php (non-commercial use only per their terms —
worth a quick sanity email to dev@skiddle.com given this is a CIC's site), then do one
live test call to inspect a real response before finishing the field mapping:

```bash
curl "https://www.skiddle.com/api/v1/events/search/?api_key=YOUR_KEY&country=GB&eventcode=LIVE&limit=5"
```

## Local dev

Create `.dev.vars` (gitignored) with a real key:

```
SKIDDLE_API_KEY=your_skiddle_api_key
```

Run it:

```bash
npx wrangler dev
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+2,14+*+*+*"
```

## Deploy

```bash
npx wrangler secret put SKIDDLE_API_KEY
npx wrangler deploy
```

Runs independently of the main app's `npm run deploy` — deploy this worker separately
when its code changes. Migration `0004_add_skiddle_source.sql` (adding `'skiddle'` to
the `events.source` CHECK constraint) must be applied to the shared D1 database before
this worker's first production run, or every insert will fail the constraint.
