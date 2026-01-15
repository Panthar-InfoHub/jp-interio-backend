import { Router } from "express";
import { auth_controller } from "../controller/auth.controller.js";

export const auth_router = Router();

auth_router.post("/login", auth_controller.login);