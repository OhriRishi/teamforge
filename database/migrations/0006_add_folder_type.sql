-- Add folder_type column to differentiate sheet folders from note folders
-- Migration: 0006_add_folder_type.sql

-- Add folder_type column with default 'note' for backward compatibility
ALTER TABLE notebook_folders
ADD COLUMN IF NOT EXISTS folder_type TEXT NOT NULL DEFAULT 'note';

-- Add constraint to ensure valid folder types
ALTER TABLE notebook_folders
DROP CONSTRAINT IF EXISTS notebook_folders_folder_type_check;

ALTER TABLE notebook_folders
ADD CONSTRAINT notebook_folders_folder_type_check
CHECK (folder_type IN ('note', 'sheet'));

-- Create index for efficient filtering by folder_type
CREATE INDEX IF NOT EXISTS idx_notebook_folders_folder_type
ON notebook_folders(team_id, season_id, folder_type);

-- Update existing folders to be 'note' type (explicit, though default handles this)
UPDATE notebook_folders SET folder_type = 'note' WHERE folder_type IS NULL;

-- Comment for documentation
COMMENT ON COLUMN notebook_folders.folder_type IS 'Type of folder: note (default) or sheet - keeps folders separate between features';
