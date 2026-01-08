import jwt from "jsonwebtoken";
import { User } from "../prisma/generated/prisma/client.js";

export const generateJWT = (user: User): string => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

  return token;
};

export const verifyJWT = (token: string): any => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};