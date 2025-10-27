-- 0001_make_snapshot_longtext.sql
-- Apply this SQL to convert PinnedMessage.snapshotContent to LONGTEXT.
-- Run on MySQL-compatible database. Make a backup before running in production.
-- Example (MySQL client):
-- mysql -h <host> -u <user> -p <database> < 0001_make_snapshot_longtext.sql

START TRANSACTION;

-- Optional: show current definition
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'PinnedMessage'
  AND COLUMN_NAME = 'snapshotContent';

-- Alter column to LONGTEXT (allows up to 4GB theoretically)
ALTER TABLE `PinnedMessage`
  MODIFY `snapshotContent` LONGTEXT NULL;

-- Verify change
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'PinnedMessage'
  AND COLUMN_NAME = 'snapshotContent';

COMMIT;
