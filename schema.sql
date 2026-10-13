CREATE TABLE IF NOT EXISTS price_cache (
    ticker text PRIMARY KEY,
    payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS favorites (
    owner uuid NOT NULL,
    ticker text NOT NULL,
    PRIMARY KEY (owner, ticker)
);
CREATE TABLE IF NOT EXISTS predictions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner uuid NOT NULL,
    ticker text NOT NULL,
    as_of date NOT NULL,
    model text NOT NULL,
    version text NOT NULL,
    source text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (owner, ticker, as_of, model, version, source)
);
CREATE INDEX IF NOT EXISTS predictions_owner_created ON predictions(owner, created_at DESC);
