-- Migration number: 0003 	 2026-07-03T00:00:00.000Z

ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved'));

CREATE INDEX idx_events_status ON events(status);
