import { NextFunction, Request, Response } from "express";
import logger from "./logger.js";
import { user_service } from "../service/user.service.js";
import { entitlement_service } from "../service/entitlement.service.js";

export const entitlement_check = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const auth_user = req.user; // Assuming user is attached to req object after authentication

        if (!auth_user) {
            logger.warn("Unauthorized access attempt without user context");
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const user = await user_service.findUserById(auth_user.id);
        /**
         * Check if user have free trial or entitlement
         * If user is on free trial, allow access
         * If user don't have free trial and no entitlement, block access
         * If user have entitlement and don't have free trial, allow access
         */

        if (user?.free_trial && !user.entitlement_id) {
            logger.info(`User ${auth_user.id} is on free trial`);
            next();
            return;
        }

        if (!user?.free_trial && !user?.entitlement_id) {
            logger.warn(`User ${auth_user.id} has no entitlement and free trial expired`);
            res.status(403).json({ success: false, message: "User completed their free trial. No entitlement found." });
            return;
        }

        // If user have entitlement : validate entitlement and check limits here
        if (!user.free_trial && user.entitlement_id) {
            const entitlement = await entitlement_service.getEntitlementById(user.entitlement_id);

            if (!entitlement) {
                logger.warn(`Entitlement not found for user ${auth_user.id}`);
                res.status(403).json({ success: false, message: "Entitlement not found or invalid." });
                return;
            }

            //for entitlement that have limits : compare with user entitlement
            if (entitlement.is_limited) {
                if (entitlement.plan_limit && user.user_limit) {

                    /**
                     * Here user limit 0 mean : limit is decreasing as per use, eg : initially limit set to 10 when payment done,
                     * then decrease limit as per usage, when limit reach to 0 block access
                     * 
                     * if user limit is greater than 0 allow access and decrease limit as per usage in respective service
                     */
                    if (user.user_limit === 0) {
                        logger.warn(`User ${auth_user.id} has exceeded their entitlement limit`);
                        res.status(403).json({ success: false, message: "Entitlement limit exceeded." });
                        return;
                    }

                    logger.debug(`User ${auth_user.id} is within their entitlement limit`);
                    await user_service.updateUser(user.id, { user_limit: user.user_limit - 1 });
                    next();
                    return;
                } else {
                    logger.warn(`Entitlement plan limit or user limit not set for user ${auth_user.id}`);
                    res.status(403).json({ success: false, message: "Entitlement limit information is incomplete." });
                    return;
                }
            }

            // Entitlement is_limited = false : no limit entitlement : user limit == 0 && entitlement limit == 0
            logger.debug(`User ${auth_user.id} has unlimited entitlement`);
            next();
            return;
        }

        logger.error(`Entitlement check failed for user ${auth_user.id} due to unknown reasons`);
        res.status(500).json({
            success: false,
            message: "Internal Server Error during entitlement check."
        });
        return;

    } catch (error) {
        logger.error("Error in entitlement middleware:", error);
        next(error);
        return;
    }
}