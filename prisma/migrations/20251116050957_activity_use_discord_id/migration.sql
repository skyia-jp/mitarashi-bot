/*
  Warnings:

  - You are about to drop the column `userId` on the `ActivityRecord` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[guildId,discordUserId,date]` on the table `ActivityRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `discordUserId` to the `ActivityRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey (条件付き)
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ActivityRecord' 
    AND CONSTRAINT_NAME = 'ActivityRecord_userId_fkey');

SET @drop_fk = IF(@constraint_exists > 0, 
    'ALTER TABLE `ActivityRecord` DROP FOREIGN KEY `ActivityRecord_userId_fkey`', 
    'SELECT "FK does not exist, skipping"');

PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropForeignKey
ALTER TABLE `ActivityRecord` DROP FOREIGN KEY `ActivityRecord_guildId_fkey`;

-- DropIndex (条件付き)
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ActivityRecord' 
    AND INDEX_NAME = 'ActivityRecord_guildId_userId_date_key');

SET @drop_idx1 = IF(@index_exists > 0, 
    'DROP INDEX `ActivityRecord_guildId_userId_date_key` ON `ActivityRecord`', 
    'SELECT "Index does not exist, skipping"');

PREPARE stmt FROM @drop_idx1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropIndex (条件付き)
SET @index_exists2 = (SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ActivityRecord' 
    AND INDEX_NAME = 'ActivityRecord_userId_fkey');

SET @drop_idx2 = IF(@index_exists2 > 0, 
    'DROP INDEX `ActivityRecord_userId_fkey` ON `ActivityRecord`', 
    'SELECT "Index does not exist, skipping"');

PREPARE stmt FROM @drop_idx2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable (条件付きでカラム追加)
SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ActivityRecord' 
    AND COLUMN_NAME = 'userId');

SET @alter_table = IF(@column_exists > 0, 
    'ALTER TABLE `ActivityRecord` DROP COLUMN `userId`, ADD COLUMN `discordUserId` VARCHAR(191) NOT NULL', 
    'ALTER TABLE `ActivityRecord` ADD COLUMN IF NOT EXISTS `discordUserId` VARCHAR(191) NOT NULL');

PREPARE stmt FROM @alter_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CreateIndex
CREATE INDEX IF NOT EXISTS `ActivityRecord_guildId_date_idx` ON `ActivityRecord`(`guildId`, `date`);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS `ActivityRecord_guildId_discordUserId_date_key` ON `ActivityRecord`(`guildId`, `discordUserId`, `date`);

-- AddForeignKey
ALTER TABLE `ActivityRecord` ADD CONSTRAINT `ActivityRecord_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
