/*
  Warnings:

  - The `free_trial` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "free_trial",
ADD COLUMN     "free_trial" INTEGER NOT NULL DEFAULT 2;
