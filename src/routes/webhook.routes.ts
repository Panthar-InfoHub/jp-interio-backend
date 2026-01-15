import express from "express"
import { Router } from "express";
import { webhook_controller } from "../controller/webhook.controller.js";

export const webhook_router = Router();

webhook_router.post("/cashfree",
    express.raw({ type: "application/json" }),
    webhook_controller.CashFreeWebhook
);