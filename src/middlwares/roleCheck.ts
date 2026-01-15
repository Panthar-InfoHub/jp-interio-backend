import { NextFunction, Request, Response } from "express";
import { UserRole } from "../prisma/generated/prisma/enums.js";



const roleAuth = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

export const isAdmin = roleAuth([UserRole.admin]);