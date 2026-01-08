/*
  Warnings:

  - A unique constraint covering the columns `[entitlement_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entitlement_id" TEXT,
ADD COLUMN     "free_trial" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "plan_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_plan_id_key" ON "Entitlement"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_entitlement_id_key" ON "User"("entitlement_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "Entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
