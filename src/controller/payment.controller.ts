import { NextFunction, Request, Response } from "express";
import { plan_service } from "../service/plan.service.js";
import logger from "../middlwares/logger.js";
import { payment_service } from "../service/payment.service.js";

class PaymentControllerClass {
    async createCashFreeOrder(req: Request, res: Response, next: NextFunction) {
        try {

            const user_id = req?.user?.id!;
            const plan_id = req.body.plan_id;

            logger.debug(`Creating order for User ID: ${user_id} with Plan ID: ${plan_id}`);

            const order_data = await plan_service.createOrder(user_id, plan_id);

            logger.debug(`Order created with ID: ${order_data.order_id} for Plan ID: ${plan_id}`);

            res.status(201).json({
                success: true,
                message: "Order created successfully",
                data: order_data
            });
            return;

        } catch (error: any) {
            logger.error("Error in createPlan controller:", error);
            next(error);
            return;
        }
    }


    async createCashFreeSubscription(req: Request, res: Response, next: NextFunction) {
        try {

            const user_id = req?.user?.id!;
            const plan_id = req.body.plan_id;

            logger.debug(`Creating subscription for User ID: ${user_id} with Plan ID: ${plan_id}`);

            const subscription_data = await payment_service.createSubscription(user_id, plan_id);

            logger.debug(`Subscription created with ID: ${subscription_data.subscription_id} for Plan ID: ${plan_id}`);

            res.status(201).json({
                success: true,
                message: "Subscription created successfully",
                data: subscription_data
            });
            return;

        } catch (error) {
            logger.error("Error in createCashFreeSubscription controller:", error);
            next(error);
            return;
        }
    }

}

export const payment_controller = new PaymentControllerClass();