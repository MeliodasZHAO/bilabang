-- Additive migration. Do not claim historic agreement acceptance for existing users.
CREATE TABLE account_consents (
 user_id TEXT NOT NULL REFERENCES users(id),
 policy_version TEXT NOT NULL,
 accepted_at TEXT NOT NULL,
 hk_storage_consent INTEGER NOT NULL CHECK(hk_storage_consent=1),
 PRIMARY KEY(user_id,policy_version)
);
CREATE TABLE account_controls (
 user_id TEXT PRIMARY KEY REFERENCES users(id),
 status TEXT NOT NULL CHECK(status IN ('active','muted')),
 reason TEXT NOT NULL,
 version INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 actor TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE account_control_events (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 actor TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL CHECK(status IN ('active','muted')),
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX account_control_events_user ON account_control_events(user_id,created_at);
CREATE INDEX reviews_user_created ON reviews(user_id,created DESC);
