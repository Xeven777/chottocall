CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    source_uri text NOT NULL,
    content_hash text NOT NULL UNIQUE,
    lang text NOT NULL DEFAULT 'bn',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
    id uuid PRIMARY KEY,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ordinal integer NOT NULL,
    content text NOT NULL,
    embedding vector(512) NOT NULL,
    search tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
    UNIQUE (document_id, ordinal)
);

CREATE INDEX IF NOT EXISTS ix_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS ix_chunks_search ON chunks USING gin (search);
CREATE INDEX IF NOT EXISTS ix_chunks_trgm ON chunks USING gin (content gin_trgm_ops);

CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    locale text NOT NULL DEFAULT 'bn'
);

CREATE TABLE IF NOT EXISTS messages (
    id bigserial PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role text NOT NULL,
    text text NOT NULL,
    sources jsonb,
    at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tools (
    name text PRIMARY KEY,
    enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);
