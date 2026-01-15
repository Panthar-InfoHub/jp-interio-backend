import { NextFunction, Request, Response } from "express";
import logger from "../middlwares/logger.js";
import { user_service } from "../service/user.service.js";
import { generateJWT } from "../lib/jwt.js";

class AuthControllerClass {
    async login(req: Request, res: Response, next: NextFunction) {
        try {

            const { email } = req.body;

            if (!email) {
                logger.warn("Email is missing in login request");
                res.status(400).json({
                    success: false,
                    message: "Email is required"
                });
                return;
            }

            const user = await user_service.findUserByEmail(email);

            if (!user) {
                logger.warn(`Login attempt with non-existing email: ${email}`);
                res.status(404).json({
                    success: false,
                    message: "User not found"
                });
                return;
            }
            // No password auth : Oauth implemented via frontend
            const token = generateJWT(user);

            // Destructure to exclude sensitive/internal fields
            const { createdAt, updatedAt, free_trial, user_limit, entitlement_id, ...safeUserData } = user;

            res.status(200).json({
                success: true,
                message: "Login successful!!",
                data: {
                    user: safeUserData,
                    token
                }
            });
            return;

        } catch (error) {
            logger.error("Error in login controller:", error);
            next(error);
            return;
        }
    }
}

export const auth_controller = new AuthControllerClass();