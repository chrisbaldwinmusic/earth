-- Migration number: 0004 	 2026-07-03T00:00:00.000Z
-- Widen events.source CHECK constraint to allow 'skiddle' in addition to
-- 'seeded' | 'user' | 'ticketmaster'. SQLite can't ALTER a CHECK constraint
-- in place, so rebuild the table. Column order below matches the live
-- schema exactly (status was appended last via ALTER TABLE ADD COLUMN in
-- migration 0003, not inserted where its original CREATE TABLE text implied).

CREATE TABLE events_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  venue         TEXT NOT NULL,
  city          TEXT NOT NULL,
  country       TEXT NOT NULL,
  genre         TEXT NOT NULL,
  date          TEXT NOT NULL,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('seeded','user','ticketmaster','skiddle')),
  ticket_link   TEXT,
  website_link  TEXT,
  lineup        TEXT,
  external_id   TEXT,                          -- prefixed per-source ('ticketmaster' ids unprefixed for backcompat, 'skiddle:' prefix on new rows) to keep the shared UNIQUE index collision-free without a composite key
  edit_token    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status        TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved'))
);

INSERT INTO events_new
  (id, name, venue, city, country, genre, date, lat, lng, source,
   ticket_link, website_link, lineup, external_id, edit_token,
   created_at, updated_at, status)
SELECT
  id, name, venue, city, country, genre, date, lat, lng, source,
  ticket_link, website_link, lineup, external_id, edit_token,
  created_at, updated_at, status
FROM events;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

CREATE UNIQUE INDEX idx_events_external_id ON events(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_events_date   ON events(date);
CREATE INDEX idx_events_genre  ON events(genre);
CREATE INDEX idx_events_status ON events(status);
