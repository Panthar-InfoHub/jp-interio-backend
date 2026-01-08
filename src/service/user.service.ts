import AppError from "../middlwares/ErrorMiddleware.js";
import logger from "../middlwares/logger.js";
import { Prisma } from "../prisma/generated/prisma/client.js";
import { db } from "../server.js";

class UserServiceClass {
    async createUser(data: Prisma.UserCreateInput) {

        if (data.email) {
            const existingEmail = await this.findUserByEmail(data.email);
            if (existingEmail) {
                logger.warn(`Attempt to create user with existing email: ${data.email}`);
                throw new AppError("User with this email already exists", 400);
            }
        }

        return await db.user.create({
            data
        });
    }

    async findUserById(id: string) {
        return await db.user.findUnique({
            where: { id }
        });
    }


    async findUserByEmail(email: string) {
        return await db.user.findUnique({
            where: { email }
        });
    }

    async updateUser(id: string, data: Prisma.UserUpdateInput) {
        return await db.user.update({
            where: { id },
            data
        });
    }
}

export const user_service = new UserServiceClass();