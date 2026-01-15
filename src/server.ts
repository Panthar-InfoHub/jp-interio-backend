import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import morgan from "morgan"
import { errorHandler } from "./middlwares/ErrorMiddleware.js"
import logger from "./middlwares/logger.js"
import { ai_router } from "./routes/ai.routes.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./prisma/generated/prisma/client.js"
import { connectDB } from "./lib/db.js"
import { user_route } from "./routes/user.route.js"
import { auth_router } from "./routes/auth.routes.js"
import { plan_router } from "./routes/plan.routes.js"
import { webhook_router } from "./routes/webhook.routes.js"
import { payment_router } from "./routes/payment.routes.js"


//Configurations
const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const db = new PrismaClient({ adapter: pool })
const app = express()
dotenv.config()
//Setting up socket server



// Webhook route with raw body parser : above express.json() middleware
app.use("/api/v1/webhook", webhook_router);


//Middlewares
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.ENVIRONMENT === "dev") {
    app.use(morgan('combined')); //For logging
}


//Routes
app.use("/api/v1/ai", ai_router);
app.use("/api/v1/payment", payment_router);
app.use("/api/v1/user", user_route);
app.use("/api/v1/plan", plan_router);
app.use("/api/v1/auth", auth_router);

//Health check
app.get("/ping", (_req, res) => {
    res.status(200).send({ message: "server is running....." })
})


//Error middlware
app.use(errorHandler)


const PORT = process.env.PORT || 8080



const server = app.listen(PORT, async () => {
    logger.debug(`Backend server started on PORT ==> ${PORT}`);
    await connectDB()
});

// Graceful shutdown
const shutdown = (signal: any) => {
    logger.warn(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
        logger.info("HTTP server closed.");
        process.exit(0);
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);