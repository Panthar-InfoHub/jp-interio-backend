import logger from "../middlwares/logger.js";
import { db } from "../server.js";

class WebhookServiceClass {
    /**
     * Handle One-time Order Payment Success (PAYMENT_SUCCESS_WEBHOOK)
     */
    async paymentSuccess(payment_data: any) {

        // 1. Extract Order ID from payload
        const cashfree_order_id = payment_data.order.order_id;
        const cf_payment_id = payment_data.payment.cf_payment_id;
        const payment_status = payment_data.payment.payment_status;

        logger.info(`Processing Payment Success for Order: ${cashfree_order_id}`);

        // 2. Find Pending Subscription
        const userSubscription = await db.userSubscription.findFirst({
            where: {
                cashfree_order_id: cashfree_order_id,
                status: 'PENDING' // Only process if still pending
            },
            include: {
                plan: true,
                user: true
            }
        });

        if (!userSubscription) {
            logger.warn(`Subscription not found for Order ID: ${cashfree_order_id}`);
            return;
        }

        if (userSubscription.status === 'ACTIVE') {
            logger.debug(`Order ${cashfree_order_id} already processed. Skipping.`);
            return;
        }

        await this._activateSubscriptionTransaction(userSubscription, cf_payment_id, payment_data.payment.payment_amount);
    }

    /**
     * Handle Recurring Subscription Payment Success (SUBSCRIPTION_PAYMENT_SUCCESS)
     */
    async subscriptionPaymentSuccess(data: any) {
        // Use 'subscription_id' (Merchant ID) effectively to find our record
        logger.info(`Processing Subscription Payload: ${data}`);
        const cf_subscription_id = data.cf_subscription_id;


        const userSubscription = await db.userSubscription.findFirst({
            where: {
                cashfree_subscription_id: cf_subscription_id
            },
            include: {
                plan: true,
                user: true
            }
        });

        if (!userSubscription) {
            logger.warn(`User Subscription not found for ID: ${cf_subscription_id}`);
            return;
        }

        // For subscriptions, we process every success event (renewals)
        // So we update the 'expires_at' and logs, even if already ACTIVE.

        await this._activateSubscriptionTransaction(
            userSubscription,
            data.cf_payment_id,
            data.payment_amount,
            true // isRecurring
        );
    }

    /**
     * Handle Subscription Payment Failed (SUBSCRIPTION_PAYMENT_FAILED)
     */
    async subscriptionPaymentFailed(data: any) {
        const subscriptionId = data.cf_subscription_id;

        logger.warn(`Processing Subscription Payment Failed for: ${subscriptionId}`);

        const userSubscription = await db.userSubscription.findFirst({
            where: { cashfree_subscription_id: subscriptionId },
            include: { user: true }
        });

        if (!userSubscription) return;

        try {
            await db.$transaction(async (tx) => {
                // 1. Update Subscription Status
                await tx.userSubscription.update({
                    where: { id: userSubscription.id },
                    data: {
                        status: 'FAILED',
                        payment_status: 'FAILED'
                    }
                });

                // 2. Revoke Access immediately
                await tx.user.update({
                    where: { id: userSubscription.user_id },
                    data: {
                        entitlement_id: null, // Detach entitlement
                        user_limit: { set: 0 }, // Reset limits
                        free_trial: 0
                    }
                });

                logger.info(`Access revoked for User ${userSubscription.user_id} due to payment failure.`);
            });
        } catch (error) {
            logger.error(`Error processing payment failure for ${subscriptionId}`, error);
        }
    }

    /**
     * Handle Subscription Status Changes (SUBSCRIPTION_STATUS_CHANGED)
     */
    async subscriptionStatusChange(data: any) {
        // This payload usually wraps details in subscription_details
        const details = data.subscription_details
        const subscriptionId = details.cf_subscription_id;
        const newStatus = details.subscription_status;

        logger.debug(`Subscription Status Change: ${subscriptionId} -> ${newStatus}`);

        const userSubscription = await db.userSubscription.findFirst({
            where: { cashfree_subscription_id: subscriptionId },
        });

        if (!userSubscription) return;

        // Map Cashfree status to our Enum
        let dbStatus: any = newStatus;

        if (newStatus === 'BANK_APPROVAL_PENDING') dbStatus = 'PENDING';
        if (newStatus === 'ON_HOLD') dbStatus = 'PAUSED';
        if (newStatus === 'CANCELLED') dbStatus = 'CANCELLED';
        if (newStatus === 'COMPLETED') dbStatus = 'EXPIRED'; // Or have a COMPLETED enum

        try {
            await db.$transaction(async (tx) => {
                await tx.userSubscription.update({
                    where: { id: userSubscription.id },
                    data: { status: dbStatus }
                });

                // If Not Active/Pending/Initialized -> Revoke access
                const activeStates = ['ACTIVE', 'PENDING', 'BANK_APPROVAL_PENDING', 'INITIALIZED'];
                if (!activeStates.includes(newStatus)) {
                    await tx.user.update({
                        where: { id: userSubscription.user_id },
                        data: {
                            entitlement_id: null,
                            user_limit: { set: 0 }
                        }
                    });
                    logger.info(`Access revoked for User ${userSubscription.user_id} due to status change: ${newStatus}`);
                }
            });
        } catch (error) {
            logger.error(`Error processing status change for ${subscriptionId}`, error);
        }
    }

    /**
     * Shared logic to Activate/Renew Subscription & Assign Entitlements
     */
    private async _activateSubscriptionTransaction(userSubscription: any, paymentId: string, amount: number, isRecurring: boolean = false) {

        try {
            await db.$transaction(async (tx) => {

                // 1. Calculate new expiry if recurring : Only for subscriptions
                let newExpiryDate: Date | null = null;
                if (isRecurring && userSubscription.plan.intervals && userSubscription.plan.interval_type) {
                    // Check if an expiry exists, add to it. If null (first time), add to NOW.
                    const baseDate = userSubscription.expires_at && userSubscription.expires_at > new Date()
                        ? userSubscription.expires_at
                        : new Date();

                    if (userSubscription.plan.interval_type === 'MONTH') {
                        newExpiryDate = new Date(baseDate);
                        newExpiryDate.setMonth(baseDate.getMonth() + userSubscription.plan.intervals);
                    } else if (userSubscription.plan.interval_type === 'YEAR') {
                        newExpiryDate = new Date(baseDate);
                        newExpiryDate.setFullYear(baseDate.getFullYear() + userSubscription.plan.intervals);
                    }
                }

                // 2. Update User Subscription Status & Expiry
                await tx.userSubscription.update({
                    where: { id: userSubscription.id },
                    data: {
                        status: 'ACTIVE',
                        payment_status: 'SUCCESS',
                        cashfree_payment_id: paymentId,
                        amount_paid: { increment: amount }, // Keep track of total paid over time
                        started_at: userSubscription.started_at || new Date(), // Set if not set
                        expires_at: newExpiryDate || undefined,
                        cycles_completed: { increment: 1 }
                    }
                });

                // 3. Create or Refresh Entitlement
                // For recurring, we might extend the existing entitlement OR reset the limits.
                // Assuming we reset limits for every cycle (e.g., 1000 credits per month).

                // If this is the FIRST activation
                let entitlementId = userSubscription.user.entitlement_id;

                if (userSubscription.plan.plan_type === 'SUBSCRIPTION') {
                    // It's a Subscription (Tier Change) -> Force Match Plan Details
                    if (entitlementId) {
                        await tx.entitlement.update({
                            where: { id: entitlementId },
                            data: {
                                name: userSubscription.plan.name,
                                price: userSubscription.plan.amount,
                                plan_id: userSubscription.plan.id,
                                is_limited: userSubscription.plan.is_limited,
                                plan_limit: userSubscription.plan.limit_number || 0,
                            }
                        });
                    } else {
                        // Create new if none exists
                        const newEntitlement = await tx.entitlement.create({
                            data: {
                                name: userSubscription.plan.name,
                                price: userSubscription.plan.amount,
                                plan_id: userSubscription.plan.id,
                                is_limited: userSubscription.plan.is_limited,
                                plan_limit: userSubscription.plan.limit_number || 0,
                            }
                        });
                        entitlementId = newEntitlement.id;
                    }
                } else {
                    // It's an Order (Top-up) -> Only create if user is blank
                    if (!entitlementId) {
                        const newEntitlement = await tx.entitlement.create({
                            data: {
                                name: userSubscription.plan.name,
                                price: userSubscription.plan.amount,
                                plan_id: userSubscription.plan.id,
                                is_limited: userSubscription.plan.is_limited,
                                plan_limit: userSubscription.plan.limit_number || 0,
                            }
                        });
                        entitlementId = newEntitlement.id;
                    }
                    // --> If entitlement exists, We just increment the user_limit below.
                }


                // 4. Update User Entitlement & Limits
                // For Subscriptions: usually RESET credits every cycle.
                // For Orders: usually ADD credits (which we handle by logic below).

                let limitUpdateValue = {};

                if (userSubscription.plan.plan_type === 'ORDER') {
                    // Top-up: ADD to existing
                    limitUpdateValue = { increment: userSubscription.plan.limit_number || 0 };
                } else {
                    // Subscription: RESET to plan limit
                    limitUpdateValue = { set: userSubscription.plan.limit_number || 0 };
                }

                await tx.user.update({
                    where: { id: userSubscription.user_id },
                    data: {
                        entitlement_id: entitlementId,
                        user_limit: limitUpdateValue,
                        free_trial: 0
                    }
                });

                logger.info(`Subscription ${userSubscription.id} Processed. User ${userSubscription.user_id} limits updated.`);
            });

        } catch (error) {
            logger.error("Transaction failed during Payment/Subscription Success processing", error);
            throw error;
        }
    }
}

export const webhook_service = new WebhookServiceClass();