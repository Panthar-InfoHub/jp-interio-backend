import { Router } from "express";
import { plan_controller } from "../controller/plan.controller.js";
import { auth } from "../middlwares/session.middleware.js";
import { isAdmin } from "../middlwares/roleCheck.js";

export const plan_router = Router();

plan_router.post("/",
    [auth, isAdmin],
    plan_controller.createPlan
);


plan_router.get("/",
    [auth, isAdmin],
    plan_controller.getAllPlans
);