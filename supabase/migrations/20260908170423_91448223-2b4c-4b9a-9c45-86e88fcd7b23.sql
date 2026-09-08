ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_style text NOT NULL DEFAULT 'moonlit';

ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_style_check CHECK (avatar_style IN ('moonlit', 'raven', 'fox', 'owl', 'wolf', 'serpent', 'stag', 'moth'));