import { NextFunction, Request, Response } from "express";
import logger from "../middlwares/logger.js";
import { user_service } from "../service/user.service.js";
import { generateJWT } from "../lib/jwt.js";
import AppError from "../middlwares/ErrorMiddleware.js";

class UserControllerClass {
    async createUser(req: Request, res: Response, next: NextFunction) {
        try {
            const user_data = req.body;
            const user = await user_service.createUser(user_data);
            logger.debug(`User created with ID: ${user.id}`);

            const jwtToken = generateJWT(user);

            res.status(201).json({
                success: true,
                message: "User created successfully",
                data: {
                    user,
                    token: jwtToken
                }
            });
            return;
        } catch (error) {
            logger.error("Error in createUser controller:", error);
            next(error);
            return
        }
    }

    async getUserById(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.params.id;

            if (!userId) {
                logger.warn("User ID parameter is missing");
                throw new AppError("User ID is required", 400);
            }

            const user = await user_service.findUserById(userId);

            if (!user) {
                logger.warn(`User not found with ID: ${userId}`);
                throw new AppError("User not found", 404);
            }

            res.status(200).json({
                success: true,
                message: "User fetched successfully",
                data: user
            });
            return;

        } catch (error) {
            logger.error("Error in getUserById controller:", error);
            next(error);
            return;
        }
    }

    async updateUser(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.params.id;
            const updateData = req.body;

            if (!userId) {
                logger.warn("User ID parameter is missing for update");
                throw new AppError("User ID is required", 400);
            }

            const user = await user_service.updateUser(userId, updateData);

            if (!user) {
                logger.warn(`User not found with ID: ${userId} for update`);
                throw new AppError("User not found", 404);
            }

            res.status(200).json({
                success: true,
                message: "User updated successfully",
                data: user
            });
            return;

        } catch (error) {
            logger.error("Error in updateUser controller:", error);
            next(error);
            return;
        }
    }
}

export const user_controller = new UserControllerClass();