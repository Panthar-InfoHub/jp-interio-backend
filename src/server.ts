import cors from "cors"
import dotenv from "dotenv"
import express from "express"
import morgan from "morgan"
import { errorHandler } from "./middlwares/ErrorMiddleware.js"
import logger from "./middlwares/logger.js"
import { ai_router } from "./routes/ai.routes.js"


//Configurations
const app = express()
dotenv.config()
//Setting up socket server

//Middlewares
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.ENVIRONMENT === "dev") {
    app.use(morgan('combined')); //For logging
}


//Routes
app.use("/api/v1/ai", ai_router);
//test debug logs

//Health check
app.get("/ping", (_req, res) => {
    res.status(200).send({ message: "server is running....." })
})


//Error middlware
app.use(errorHandler)


const PORT = process.env.PORT || 8080



const server = app.listen(PORT, () => {
    logger.debug(`Backend server started on PORT ==> ${PORT}`);
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