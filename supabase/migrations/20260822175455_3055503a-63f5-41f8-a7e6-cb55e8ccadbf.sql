ALTER TABLE public.rate_limits RENAME COLUMN user_id TO key;
ALTER TABLE public.rate_limits ALTER COLUMN key TYPE text;
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON public.rate_limits(key, action, bucket);