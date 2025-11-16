/*
  Warnings:

  - You are about to drop the column `userId` on the `ActivityRecord` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[guildId,discordUserId,date]` on the table `ActivityRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `discordUserId` to the `ActivityRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey (userIdの外部キーを条件付きで削除)
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'ActivityRecord' 
  AND CONSTRAINT_NAME = 'ActivityRecord_userId_fkey'
);
SET @drop_fk_sql = IF(@fk_exists > 0, 
  'ALTER TABLE `ActivityRecord` DROP FOREIGN KEY `ActivityRecord_userId_fkey`', 
  'SELECT "FK ActivityRecord_userId_fkey does not exist"');
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropForeignKey (guildIdの外部キーを条件付きで削除)
SET @fk_exists2 = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'ActivityRecord' 
  AND CONSTRAINT_NAME = 'ActivityRecord_guildId_fkey'
);
SET @drop_fk_sql2 = IF(@fk_exists2 > 0, 
  'ALTER TABLE `ActivityRecord` DROP FOREIGN KEY `ActivityRecord_guildId_fkey`', 
  'SELECT "FK ActivityRecord_guildId_fkey does not exist"');
PREPARE stmt FROM @drop_fk_sql2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropIndex (条件付きで削除)
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'ActivityRecord' 
  AND INDEX_NAME = 'ActivityRecord_guildId_userId_date_key'
);
SET @drop_idx_sql = IF(@idx_exists > 0, 
  'DROP INDEX `ActivityRecord_guildId_userId_date_key` ON `ActivityRecord`', 
  'SELECT "Index does not exist"');
PREPARE stmt FROM @drop_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable (条件付きでカラム削除・追加)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'ActivityRecord' 
  AND COLUMN_NAME = 'userId'
);
SET @alter_sql = IF(@col_exists > 0, 
  'ALTER TABLE `ActivityRecord` DROP COLUMN `userId`', 
  'SELECT "Column userId does not exist"');
PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists2 = (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'ActivityRecord' 
  AND COLUMN_NAME = 'discordUserId'
);
SET @add_col_sql = IF(@col_exists2 = 0, 
  'ALTER TABLE `ActivityRecord` ADD COLUMN `discordUserId` VARCHAR(191) NOT NULL DEFAULT \'\'', 
  'SELECT "Column discordUserId already exists"');
PREPARE stmt FROM @add_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CreateIndex (条件付きで作成)
SET @idx_exists2 = (
  SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'ActivityRecord' 
  AND INDEX_NAME = 'ActivityRecord_guildId_date_idx'
);
SET @create_idx_sql = IF(@idx_exists2 = 0, 
  'CREATE INDEX `ActivityRecord_guildId_date_idx` ON `ActivityRecord`(`guildId`, `date`)', 
  'SELECT "Index already exists"');
PREPARE stmt FROM @create_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists3 = (
  SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'ActivityRecord' 
  AND INDEX_NAME = 'ActivityRecord_guildId_discordUserId_date_key'
);
SET @create_idx_sql2 = IF(@idx_exists3 = 0, 
  'CREATE UNIQUE INDEX `ActivityRecord_guildId_discordUserId_date_key` ON `ActivityRecord`(`guildId`, `discordUserId`, `date`)', 
  'SELECT "Unique index already exists"');
PREPARE stmt FROM @create_idx_sql2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AddForeignKey (条件付きで追加)
SET @fk_exists3 = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'ActivityRecord' 
  AND CONSTRAINT_NAME = 'ActivityRecord_guildId_fkey'
);
SET @add_fk_sql = IF(@fk_exists3 = 0, 
  'ALTER TABLE `ActivityRecord` ADD CONSTRAINT `ActivityRecord_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 
  'SELECT "FK already exists"');
PREPARE stmt FROM @add_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
