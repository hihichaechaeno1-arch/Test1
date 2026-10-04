-- Owner-requested additive migration for the verified public.videos contract.
-- Target production project: lxattufhisuyyhbtmmuf. Run only with project-admin access.
-- Adds no defaults/NOT NULL constraint, updates no rows, and changes no grants/RLS.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = to_regclass('public.videos') AND relkind IN ('r', 'p')
  ) THEN
    RAISE EXCEPTION 'Expected public.videos to be an existing table';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = to_regclass('public.videos') AND attname = 'description'
      AND NOT attisdropped AND atttypid <> 'pg_catalog.text'::regtype
  ) THEN
    RAISE EXCEPTION 'Existing public.videos.description is not text; review before changing it';
  END IF;
END;
$migration$;

ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS description text;
NOTIFY pgrst, 'reload schema';
COMMIT;
