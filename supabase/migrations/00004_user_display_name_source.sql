ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS display_name_source TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_display_name_source_check;

ALTER TABLE public.users
ADD CONSTRAINT users_display_name_source_check
CHECK (
  display_name_source IN (
    'legacy',
    'google',
    'apple_first_login',
    'generated',
    'user_edit'
  )
);

COMMENT ON COLUMN public.users.display_name_source IS
'Source of the current display name (legacy, provider import, generated fallback, or user edit)';
