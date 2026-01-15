import { Cashfree, CFEnvironment } from "cashfree-pg";


export const cashfree = new Cashfree(
    process.env.ENVIRONMENT === "dev" ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION,
    process.env.CASHFREE_APP_ID!,
    process.env.CASHFREE_SECRET_KEY!
);