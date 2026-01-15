import { NextFunction, Request, Response } from "express";
import logger from "../middlwares/logger.js";
import AppError from "../middlwares/ErrorMiddleware.js";
import { ai_service } from "../service/ai.service.js";
import { user_service } from "../service/user.service.js";

class AiControllerClass {
    async reDesignRoomController(req: Request, res: Response, next: NextFunction) {
        try {

            const { image_uri, stylePrompt } = req.body;
            const ent = req.entitle_check;
            const user_id = req.user?.id!;
            if (!image_uri) {
                logger.warn("Missing image_uri in reDesignRoomController");
                throw new AppError("Missing required parameters: image_uri and stylePrompt", 400);
            }

            const { description, image_uri: redesign_image_uri } = await ai_service.redesignRoomFromBucket(image_uri, stylePrompt)

            logger.debug("Description from AI Service:", description);
            logger.debug("Redesigned Image URI from AI Service:", redesign_image_uri);


            // Decreasing user limit if free_trial
            if (ent && ent.type === "free_trial") {
                await user_service.updateUser(user_id, { free_trial: { decrement: 1 } });
                logger.debug(`Decremented free trial count for user ${user_id}`);
            }

            // Decreasing user limit if entitlement_limited
            if (ent && ent.type === "entitlement_limited" && ent.entitlement_id) {
                await user_service.updateUser(user_id, { user_limit: { decrement: 1 } });
                logger.debug(`Decremented user limit for user ${user_id} under entitlement ${ent.entitlement_id}`);
            }

            res.status(200).json({
                success: true,
                message: "Room redesign successful",
                data: {
                    description,
                    image_uri: redesign_image_uri
                }
            });
            return;

        } catch (error) {
            logger.error("Error in reDesignRoomController:", error);
            next(error);
            return;
        }
    }
}

export const ai_controller = new AiControllerClass();