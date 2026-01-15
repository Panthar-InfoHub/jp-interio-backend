import { CreateSubscriptionRequest } from "cashfree-pg";
import { cashfree } from "../lib/cashfree.js";
import AppError from "../middlwares/ErrorMiddleware.js";
import logger from "../middlwares/logger.js";
import { db } from "../server.js";
import { createRandomId } from "../utilis/helper.js";

class PaymentServiceClass {
    async createSubscription(user_id: string, plan_id: string) {
        const plan = await db.plan.findUnique({ where: { id: plan_id } });
        if (!plan) throw new AppError("Plan not found for creating subscription", 404);

        const user = await db.user.findUnique({ where: { id: user_id } });
        if (!user) throw new AppError("User not found for creating subscription", 404);

        if (plan.plan_type !== 'SUBSCRIPTION') throw new AppError('Invalid plan type for subscription', 400);
        if (!plan.cashfree_plan_id) throw new AppError('This plan is not synced with Payment Gateway (Cashfree)', 400);

        // 2. Generate unique Subscription ID for this transaction
        const subscriptionId = createRandomId('SUB');

        try {
            const request: CreateSubscriptionRequest = {
                subscription_id: subscriptionId,
                plan_details: {
                    plan_name: plan.name,
                    plan_id: plan.cashfree_plan_id,
                    plan_type: 'PERIODIC',
                    plan_amount: plan.amount,
                    plan_max_amount: plan.max_amount ?? undefined,
                    plan_currency: 'INR',
                    plan_max_cycles: 60, // For next 5 years
                    plan_intervals: plan.intervals ?? undefined, // Number -> that tell after how many interval_type the amount will be charged
                    plan_interval_type: plan.interval_type ?? undefined, // 'MONTH' | 'YEAR' -->  This tell the type of interval
                },

                // Overall summary : Pay amount after X (plan_intervals) of type Y (plan_interval_type) from Z (plan_max_cycles -> Link to plan_interval type)

                customer_details: {
                    customer_email: user.email,
                    customer_phone: user.phone || '9026600000', // Phone is often mandatory for subscriptions
                    customer_name: user.name || 'User'
                },
                subscription_note: `Subscription for ${plan.name}`
            };

            const response = await cashfree.SubsCreateSubscription(request);

            const subscriptionData = response.data;
            const subscription_session_id = subscriptionData.subscription_session_id; // Subscription session id same like order

            // Store User session PENDING Record in DB
            await db.userSubscription.create({
                data: {
                    status: 'PENDING',
                    cashfree_subscription_id: response.data.cf_subscription_id,
                    user_id: user.id,
                    plan_id: plan.id,
                    amount_paid: plan.amount,
                    payment_status: 'PENDING'
                }
            });

            logger.debug(`Created Cashfree Subscription: ${subscriptionId} for User: ${user.id}`);

            return {
                subscription_id: subscriptionId,
                subscription_session_id,
                subscription_status: subscriptionData.subscription_status
            };

        } catch (error: any) {
            logger.error('Error creating subscription on Cashfree:', error?.response?.data || error);
            throw new AppError(error?.response?.data?.message || 'Failed to initiate subscription', 500);
        }
    }

}

export const payment_service = new PaymentServiceClass();