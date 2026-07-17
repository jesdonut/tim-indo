-- Phone Scripts feature removed (folded name-spelling + phone-reading into the
-- Extract page, deleted the Translate page). The call-script templates are no
-- longer used. This permanently deletes them.
drop table if exists public.phone_scripts;
