-- DropIndex
DROP INDEX "Entitlement_plan_id_key";

-- AlterTable
ALTER TABLE "plans" ALTER COLUMN "limit_number" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "user_subscriptions" ALTER COLUMN "usage_count" DROP NOT NULL;
