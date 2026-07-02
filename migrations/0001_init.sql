-- Migration number: 0001 	 2026-07-02T23:01:05.614Z

CREATE TABLE events (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  venue         TEXT NOT NULL,
  city          TEXT NOT NULL,
  country       TEXT NOT NULL,
  genre         TEXT NOT NULL,
  date          TEXT NOT NULL,                 -- ISO 8601 UTC, matches MapEvent.date
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('seeded','user','ticketmaster')),
  ticket_link   TEXT,
  website_link  TEXT,
  lineup        TEXT,                          -- JSON.stringify(LineupEntry[]) or NULL
  external_id   TEXT,                          -- Ticketmaster event id; NULL for seeded/user
  edit_token    TEXT,                          -- ownership secret for 'user' rows; NULL otherwise
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX idx_events_external_id ON events(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_events_date  ON events(date);
CREATE INDEX idx_events_genre ON events(genre);
