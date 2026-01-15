import { NextFunction, Request, Response } from "express";
import logger from "./logger.js";
import { user_service } from "../service/user.service.js";
import { entitlement_service } from "../service/entitlement.service.js";
import AppError from "./ErrorMiddleware.js";

declare global {
    namespace Express {
        interface Request {
            entitle_check?: {
                type: "free_trial" | "entitlement_unlimited" | "entitlement_limited";
                entitlement_id?: string;
            };
        }
    }
}

export const entitlement_check = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const auth_user = req.user; // Assuming user is attached to req object after authentication

        if (!auth_user) {
            logger.warn("Unauthorized access attempt without user context");
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const user = await user_service.findUserById(auth_user.id);

        if (!user) {
            logger.warn(`User not found: ${auth_user.id}`);
            throw new AppError("User not found, check user ID", 404);
        }
        /**
         * Check if user have free trial or entitlement
         * If user is on free trial, allow access
         * If user don't have free trial and no entitlement, block access
         * If user have entitlement and don't have free trial, allow access
         */

        if (user.free_trial > 0) {
            logger.debug(`User ${user.id} is on free trial with ${user.free_trial} tries left. Allowing access.`);
            req.entitle_check = { type: "free_trial" };
            next();
            return;
        }

        // Neither free trial nor entitlement
        if (!user.entitlement_id) {
            logger.warn(`User ${user.id} has no entitlement and no free trial. Blocking access.`);
            res.status(403).json({ success: false, message: "No entitlement or free trial available" });
            return;
        }

        const entitlement = await entitlement_service.getEntitlementById(user.entitlement_id);

        if (!entitlement) {
            logger.warn(`Entitlement not found for user ${user.id} with entitlement ID ${user.entitlement_id}`);
            throw new AppError("Entitlement not found, check entitlement ID", 404);
        }

        // Unlimited tries entitlement
        if (!entitlement.is_limited) {
            logger.debug(`User ${user.id} has unlimited entitlement. Allowing access.`);
            req.entitle_check = { type: "entitlement_unlimited" };
            next();
            return;
        }

        /**
         * IF every condition fails and we have here,  
         * solely mean : the entitlement is limited and we need to check usage count
         * Our tries count backend : eg from 10 -> 0
         */

        if (user.user_limit <= 0) {
            logger.warn(`User ${user.id} has exhausted their entitlement usage count. Blocking access.`);
            res.status(403).json({ success: false, message: "Entitlement usage limit exceeded" });
            return;
        }

        // User has valid entitlement with remaining usage count
        logger.debug(`User ${user.id} has valid entitlement with ${user.user_limit} uses left. Allowing access.`);
        req.entitle_check = { type: "entitlement_limited", entitlement_id: user.entitlement_id };
        next();
        return;

    } catch (error) {
        logger.error("Error in entitlement middleware:", error);
        next(error);
        return;
    }
}