-- Shared fixed-window login throttling. Rows contain a digest of the peer address,
-- never a password or bearer token. Provision cleanup of expired rows separately.
CREATE TABLE login_throttles (
  peer_hash text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);
CREATE INDEX login_throttles_window_start_idx ON login_throttles(window_start);
