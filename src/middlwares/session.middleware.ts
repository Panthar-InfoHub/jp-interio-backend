import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { user_service } from "../service/user.service.js";
import AppError from "./ErrorMiddleware.js";
import { UserRole } from "../prisma/generated/prisma/enums.js";
import logger from "./logger.js";

interface resData {
    id: string,
    email: string,
    role: string
}

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email?: string;
                phone?: string;
                role: UserRole;
            };
        }
    }
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            logger.warn("No token provided")
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        let resData: resData = {
            id: "",
            email: "",
            role: ""
        }

        logger.debug("\n Decoded data ==> ", decoded)

        const user = await user_service.findUserById(decoded.id);

        if (!user) {
            throw new AppError('The user belonging to this token no longer exists.', 401);
        }

        resData.id = user.id.toString();
        resData.email = user.email;
        resData.role = user.role;

        logger.debug("User data from token ==> ", resData)

        req.user = {
            id: resData.id,
            email: resData.email,
            role: resData.role as UserRole
        };

        next();
    } catch (error: any) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Token has expired, please login again"
            });
        }

        logger.error("Error in authjs ==> ", error)
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};