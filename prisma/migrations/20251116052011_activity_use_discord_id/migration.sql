/*
  Warnings:

  - You are about to drop the column `userId` on the `ActivityRecord` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[guildId,discordUserId,date]` on the table `ActivityRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `discordUserId` to the `ActivityRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey (条件付き - 存在する場合のみ)
-- ALTER TABLE `ActivityRecord` DROP FOREIGN KEY `ActivityRecord_guildId_fkey`;

-- DropForeignKey
ALTER TABLE `ActivityRecord` DROP FOREIGN KEY `ActivityRecord_userId_fkey`;

-- DropIndex
DROP INDEX `ActivityRecord_guildId_userId_date_key` ON `ActivityRecord`;

-- DropIndex
DROP INDEX `ActivityRecord_userId_fkey` ON `ActivityRecord`;

-- AlterTable
ALTER TABLE `ActivityRecord` DROP COLUMN `userId`,
    ADD COLUMN `discordUserId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `ActivityRecord_guildId_date_idx` ON `ActivityRecord`(`guildId`, `date`);

-- CreateIndex
CREATE UNIQUE INDEX `ActivityRecord_guildId_discordUserId_date_key` ON `ActivityRecord`(`guildId`, `discordUserId`, `date`);

-- AddForeignKey
ALTER TABLE `ActivityRecord` ADD CONSTRAINT `ActivityRecord_guildId_fkey` FOREIGN KEY (`guildId`) REFERENCES `Guild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
