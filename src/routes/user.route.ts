import { Router } from "express";
import { user_controller } from "../controller/user.controller.js";

export const user_route = Router();


user_route.post("/new", user_controller.createUser);
user_route.get("/:id", user_controller.getUserById);
user_route.patch("/:id", user_controller.updateUser);



/* 
    Admin routes : Todo 
    - Get all users
    - Delete user
    - update user role
*/
