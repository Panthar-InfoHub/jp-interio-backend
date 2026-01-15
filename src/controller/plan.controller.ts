import { NextFunction, Request, Response } from "express";
import logger from "../middlwares/logger.js";
import { plan_service } from "../service/plan.service.js";
class PlanControllerClass {
    async createPlan(req: Request, res: Response, next: NextFunction) {
        try {

            const plan_data = req.body;

            const plan = await plan_service.createPlan(plan_data);
            logger.debug(`Plan created with ID: ${plan.id}`);

            res.status(201).json({
                success: true,
                message: "Plan created successfully",
                data: plan
            });
            return;

        } catch (error: any) {
            logger.error("Error in createPlan controller:", error);
            next(error);
            return;
        }
    }

    async getAllPlans(req: Request, res: Response, next: NextFunction) {
        try {

            const plan_type = req.query.plan_type as "ORDER" | "SUBSCRIPTION" | undefined;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const plans =
                plan_type === "SUBSCRIPTION" ? await plan_service.getAllSubscriptionPlans({ page, limit })
                    : plan_type === "ORDER" ? await plan_service.getAllOrderPlans({ page, limit })
                        : await plan_service.getAllPlans({ page, limit })

            logger.debug(`Retrieved ${plans.plans.length} subscription plans`);

            res.status(200).json({
                success: true,
                message: "Plans retrieved successfully",
                data: plans
            });
            return;

        } catch (error: any) {
            logger.error("Error in getPlans controller:", error);
            next(error);
            return;
        }
    }
}

export const plan_controller = new PlanControllerClass();