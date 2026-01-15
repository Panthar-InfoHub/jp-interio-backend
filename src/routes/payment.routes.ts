import { Router } from "express";
import { payment_controller } from "../controller/payment.controller.js";
import { auth } from "../middlwares/session.middleware.js";

export const payment_router = Router();

payment_router.post("/create-order",
    [auth],
    payment_controller.createCashFreeOrder
);

payment_router.post("/create-subscription",
    [auth],
    payment_controller.createCashFreeSubscription
);