import AppError from "../middlwares/ErrorMiddleware.js";
import logger from "../middlwares/logger.js";
import { db } from "../server.js";

export const connectDB = async () => {
    try {
        await db.$connect();
        logger.debug("Database connected....");
    } catch (error) {
        logger.error("Error while connecting to database ==> ", error);
        throw new AppError("Database connection failed", 500);
    }
};
