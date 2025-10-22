-- Extend global announcement system with configuration options
-- Add fields to control announcement behavior across shares

ALTER TABLE setting ADD COLUMN global_announcement_override_share_announcement INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE setting ADD COLUMN global_announcement_auto_apply_new_share INTEGER DEFAULT 1 NOT NULL;

-- global_announcement_override_share_announcement: 
--   0 = Do not override (respect per-share settings)
--   1 = Override (global announcement takes precedence)

-- global_announcement_auto_apply_new_share:
--   0 = Do not auto-apply to new shares
--   1 = Auto-apply to new shares (default)

