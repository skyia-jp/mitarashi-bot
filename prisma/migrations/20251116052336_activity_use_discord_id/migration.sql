/*
  Warnings:

  - You are about to drop the column `userId` on the `ActivityRecord` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[guildId,discordUserId,date]` on the table `ActivityRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `discordUserId` to the `ActivityRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey (存在する場合のみ削除)
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;

ALTER TABLE `ActivityRecord` DROP FOREIGN KEY IF EXISTS `ActivityRecord_userId_fkey`;
ALTER TABLE `ActivityRecord` DROP FOREIGN KEY IF EXISTS `ActivityRecord_guildId_fkey`;

SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;

-- DropIndex (存在する場合のみ削除)
DROP INDEX IF EXISTS `ActivityRecord_guildId_userId_date_key` ON `ActivityRecord`;

-- AlterTable (カラムが存在する場合のみ変更)
ALTER TABLE `ActivityRecord` 
  DROP COLUMN IF EXISTS `userId`,
  ADD COLUMN IF NOT EXISTS `discordUserId` VARCHAR(191) NOT NULL DEFAULT '';

-- CreateIndex (存在しない場合のみ作成)
CREATE INDEX IF NOT EXISTS `ActivityRecord_guildId_date_idx` ON `ActivityRecord`(`guildId`, `date`);

-- CreateIndex (存在しない場合のみ作成)
CREATE UNIQUE INDEX IF NOT EXISTS `ActivityRecord_guildId_discordUserId_date_key` ON `ActivityRecord`(`guildId`, `discordUserId`, `date`);

-- AddForeignKey (存在しない場合のみ追加)
ALTER TABLE `ActivityRecord` 
  ADD CONSTRAINT IF NOT EXISTS `ActivityRecord_guildId_fkey` 
  FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) 
  ON DELETE RESTRICT ON UPDATE CASCADE;
