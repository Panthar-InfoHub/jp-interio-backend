import { Plan, Prisma } from "../prisma/generated/prisma/client.js";
import { db } from "../server.js";
import { cashfree } from "../lib/cashfree.js";
import AppError from "../middlwares/ErrorMiddleware.js";
import logger from "../middlwares/logger.js";

type PaginationOptions = {
    page?: number;
    limit?: number;
};


class PlanServiceClass {
    /**
     * Create a new plan.
     * If type is SUBSCRIPTION, it also creates the plan in Cashfree.
     * If type is ORDER, it stores it locally for reference/catalog.
     */
    async createPlan(data: Prisma.PlanCreateInput) {

        if (data.plan_type === 'SUBSCRIPTION') {
            if (!data.max_cycles || !data.intervals || !data.interval_type) {
                throw new AppError("Subscription plans require max_cycles, intervals, and interval_type", 400);
            }
        }

        try {

            if (!data.limit_number && data.plan_type === "ORDER") {
                logger.warn("For Order type plan limit number is required.");
                throw new AppError("Order type plans require limit_number to be set", 400);
            }

            // 1. Create Plan Locally
            const plan = await db.plan.create({
                data: data
            });

            logger.debug(`Plan created locally: ${plan.id} [${plan.plan_type}]`);

            // 2. Integrate with Cashfree only if it's a SUBSCRIPTION
            if (plan.plan_type === 'SUBSCRIPTION') {
                try {
                    const cashfree_plan = await this.createPlanOnCashfree(plan);

                    // 3. Update local plan with Cashfree details
                    const updatedPlan = await db.plan.update({
                        where: { id: plan.id },
                        data: {
                            cashfree_plan_id: cashfree_plan.plan_id,
                            cashfree_created: true,
                            status: 'ACTIVE'
                        }
                    });

                    logger.debug(`Plan synced to Cashfree successfully: ${updatedPlan.cashfree_plan_id}`);
                    return updatedPlan;

                } catch (cf_error: any) {
                    logger.error(`Cashfree Sync Failed for Plan ${plan.id}:`, cf_error);

                    // Rollback strategy: Delete the local plan to avoid data inconsistency states
                    await db.plan.delete({ where: { id: plan.id } });

                    // Extract meaningful error message if possible
                    const errorMessage = cf_error?.response?.data?.message || cf_error.message || "Unknown Cashfree error";
                    throw new AppError(`Failed to create plan on Cashfree: ${errorMessage}`, 502);
                }
            }

            // For ORDER type plans, return the local plan immediately
            return plan;

        } catch (error) {
            if (error instanceof AppError) throw error;
            logger.error("Error in createPlan service:", error);
            throw new AppError("Internal Server Error during plan creation", 500);
        }
    }


    async getAllSubscriptionPlans({ page = 1, limit = 10 }: PaginationOptions = {}) {

        const skip = (page - 1) * limit;

        const plans = await db.plan.findMany({
            where: {
                plan_type: 'SUBSCRIPTION'
            },
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc'
            }
        });

        return {
            plans,
            pagination: {
                total_plans: plans.length,
                current_page: page,
                limit: limit
            }
        };
    }

    async getAllOrderPlans({ page = 1, limit = 10 }: PaginationOptions = {}) {

        const skip = (page - 1) * limit;

        const plans = await db.plan.findMany({
            where: {
                plan_type: 'ORDER'
            },
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc'
            }
        });

        return {
            plans,
            pagination: {
                total_plans: plans.length,
                current_page: page,
                limit: limit
            }
        };
    }

    async getAllPlans({ page = 1, limit = 10 }: PaginationOptions = {}) {

        const skip = (page - 1) * limit;

        const plans = await db.plan.findMany({
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc'
            }
        });

        return {
            plans,
            pagination: {
                total_plans: plans.length,
                current_page: page,
                limit: limit
            }
        };
    }

    /**
     *  Cashfree API for Cashfree Integration
     *  Creates a subscription plan on Cashfree
     */
    async createPlanOnCashfree(plan: Plan) {
        // Validate required fields for Subscription
        if (!plan.max_cycles || !plan.intervals || !plan.interval_type) {
            throw new AppError("Subscription plans require max_cycles, intervals, and interval_type", 400);
        }

        // Map to Cashfree API Payload
        // Using plan.id (UUID) as the plan_id ensures uniqueness

        const response = await cashfree.SubsCreatePlan({
            plan_id: plan.id,
            plan_name: plan.name,
            plan_type: "PERIODIC", // Cashfree expects "PERIODIC" or "ON_DEMAND"
            plan_currency: plan.currency,
            plan_recurring_amount: plan.recurring_amount || plan.amount, // Default to base amount if not specified
            plan_max_amount: plan.amount,
            plan_max_cycles: plan.max_cycles,
            plan_interval_type: plan.interval_type, // 'MONTH' or 'YEAR' matches Cashfree enum
            plan_intervals: plan.intervals,
            plan_note: plan.description || plan.notes || `Subscription for ${plan.name}`,
        });

        return response.data;
    }

    /**
     * Create order and payment link for ORDER type plans
     * Flow:
     * - Create Order in Cashfree
     * - Create UserSubscription (PENDING)
     * - Return Payment Session ID
     */
    async createOrder(user_id: string, plan_id: string) {
        const plan = await db.plan.findUnique({ where: { id: plan_id } });
        if (!plan) throw new AppError("Plan not found for creating Order, Check planId", 404);

        const user = await db.user.findUnique({ where: { id: user_id } });
        if (!user) throw new AppError("User not found for creating Order", 404);

        try {

            //Check already existing PENDING or ACTIVE subscription for the same plan
            const existing_subscription = await db.userSubscription.findFirst({
                where: {
                    user_id: user_id,
                    plan_id: plan_id,
                    OR: [
                        { status: 'ACTIVE' },
                        { status: 'PENDING' }
                    ]
                }
            });

            if (existing_subscription) {
                throw new AppError("An active or pending subscription already exists for this plan", 400);
            }

            // 1. Create Order in Cashfree
            // Uniquely identify the order using a combination of plan, user, and timestamp
            const order_id = `ORDER_${plan.plan_type}_${user_id.substring(0, 5)}_${Date.now()}`;


            const cf_order = await cashfree.PGCreateOrder({
                order_amount: plan.amount,
                order_currency: plan.currency,
                customer_details: {
                    customer_id: user_id,
                    customer_email: user.email,
                    customer_phone: user.phone || "9026819208",
                    customer_name: user.name || "User"
                },
                order_meta: {
                    return_url: `https://pantharinfohub.com/status?order_id=${order_id}`,
                    // notify_url: `https://your-backend.com/api/webhook/cashfree`
                },
                order_id: order_id,
                order_note: `Purchase of ${plan.name}`
            });
            const payment_session_id = cf_order.data.payment_session_id;

            // 2. Create UserSubscription (PENDING)
            // Every ORDER must have usage count 
            // This tracks the attempt. We do not enable access yet -> wait for webhook for confirmation
            const subscription = await db.userSubscription.create({
                data: {
                    user_id: user_id,
                    plan_id: plan_id,
                    status: 'PENDING',
                    payment_status: 'PENDING',
                    cashfree_order_id: order_id,
                    usage_count: plan.is_limited ? plan.limit_number : 0,
                    amount_paid: plan.amount,
                    currency: plan.currency,
                    metadata: {
                        payment_session_id
                    }
                }
            });

            logger.info(`Order created: ${order_id}. Subscription: ${subscription.id}. Waiting for webhook to attach Entitlement.`);

            return {
                payment_session_id: payment_session_id,
                order_id: order_id,
                subscription_id: subscription.id
            };

        } catch (error: any) {
            logger.error("Error in createOrder:", error);
            const message = error?.response?.data?.message || error.message || "Payment initiation failed";
            throw new AppError(message, 500);
        }
    }
}

export const plan_service = new PlanServiceClass();