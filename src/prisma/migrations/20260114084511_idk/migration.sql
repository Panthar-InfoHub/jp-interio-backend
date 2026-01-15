-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('ORDER', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');

-- CreateEnum
CREATE TYPE "IntervalType" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "plan_type" "PlanType" NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "recurring_amount" DOUBLE PRECISION,
    "max_amount" DOUBLE PRECISION,
    "max_cycles" INTEGER,
    "intervals" INTEGER,
    "interval_type" "IntervalType",
    "is_limited" BOOLEAN NOT NULL DEFAULT false,
    "limit_number" INTEGER,
    "cashfree_plan_id" TEXT,
    "cashfree_created" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "cashfree_subscription_id" TEXT,
    "cashfree_order_id" TEXT,
    "cashfree_payment_id" TEXT,
    "started_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "next_billing_date" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "cycles_completed" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_cashfree_plan_id_key" ON "plans"("cashfree_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_cashfree_subscription_id_key" ON "user_subscriptions"("cashfree_subscription_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_user_id_idx" ON "user_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_plan_id_idx" ON "user_subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions"("status");

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
