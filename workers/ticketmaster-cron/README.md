# earth-ticketmaster-cron

Standalone Cloudflare Worker that polls the Ticketmaster Discovery API on a schedule and
writes new music events directly into the shared `earth-events` D1 database (the same
database the main app reads from). Deduplicates against existing rows via `external_id`.

## Local dev

Create `.dev.vars` (gitignored) with a real key:

```
TM_API_KEY=your_ticketmaster_api_key
```

Run it:

```bash
npx wrangler dev
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+*/6+*+*+*"
```

## Deploy

```bash
npx wrangler secret put TM_API_KEY
npx wrangler deploy
```

Runs independently of the main app's `npm run deploy` — deploy this worker separately
when its code changes.
