CREATE TABLE users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN','OWNER','VIEWER')),
  disabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE TABLE documents (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), name text NOT NULL,
  category text NOT NULL, storage_key text NOT NULL UNIQUE, mime_type text NOT NULL,
  size integer NOT NULL CHECK (size > 0), checksum text NOT NULL,
  deleted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_owner_idx ON documents(owner_id) WHERE NOT deleted;
CREATE TABLE document_permissions (
  document_id uuid NOT NULL REFERENCES documents(id), user_id uuid NOT NULL REFERENCES users(id),
  permission text NOT NULL CHECK (permission IN ('READ','EDIT')),
  granted_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(document_id,user_id)
);
CREATE INDEX permissions_user_idx ON document_permissions(user_id);
CREATE TABLE audit_events (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id uuid NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL, actor_id uuid, actor_role text, action text NOT NULL,
  document_id uuid, result text NOT NULL CHECK(result IN ('success','denied','failure')),
  metadata jsonb NOT NULL DEFAULT '{}', previous_hash text NOT NULL, current_hash text NOT NULL
);
-- Application database credentials must not own this table in production. Revoke
-- UPDATE, DELETE and TRUNCATE from the runtime role after applying migrations.
