import { Router } from "express";
import { ai_controller } from "../controller/ai.controller.js";
import { auth } from "../middlwares/session.middleware.js";
import { entitlement_check } from "../middlwares/entitlement.middleware.js";

export const ai_router = Router();

ai_router.post("/redesign-room",
    [auth, entitlement_check],
    ai_controller.reDesignRoomController
);