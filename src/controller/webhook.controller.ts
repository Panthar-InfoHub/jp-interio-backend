import { NextFunction, Request, Response } from "express";
import AppError from "../middlwares/ErrorMiddleware.js";
import logger from "../middlwares/logger.js";
import { cashfree } from "../lib/cashfree.js";
import { webhook_service } from "../service/webhook.service.js";

class WebhookController {
    CashFreeWebhook = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rawBody = req.body.toString("utf8");

            const signature = req.headers["x-webhook-signature"] as string;
            const timestamp = req.headers["x-webhook-timestamp"] as string;

            if (!signature || !timestamp) {
                logger.error("Missing webhook headers");
                throw new AppError("Missing webhook headers", 400);
            }

            // Verify webhook signature
            const isValid = this.verifyWebHookSignature(rawBody, timestamp, signature);


            if (!isValid) {
                logger.error("Invalid webhook signature");
                return res.status(400).json({ success: false, message: "Invalid signature" });
            }

            // Parse the payload
            const payload = JSON.parse(rawBody);
            const eventType = payload.type;
            const paymentData = payload.data;

            logger.debug

            // logger.debug("Payload Data Received in Webhook: ", payload);

            // Handle different events
            switch (eventType) {
                case "PAYMENT_SUCCESS_WEBHOOK":
                    await webhook_service.paymentSuccess(paymentData);
                    break;

                // Add the new subscription payment success event
                case "SUBSCRIPTION_PAYMENT_SUCCESS":
                    await webhook_service.subscriptionPaymentSuccess(paymentData);
                    break;

                case "SUBSCRIPTION_PAYMENT_FAILED":
                    await webhook_service.subscriptionPaymentFailed(paymentData);
                    break;

                case "SUBSCRIPTION_STATUS_CHANGED":
                    await webhook_service.subscriptionStatusChange(paymentData);
                    break;

                case "PAYMENT_FAILED_WEBHOOK":
                // case "PAYMENT_USER_DROPPED_WEBHOOK":
                //     await handlePaymentFailure(paymentData);
                //     break;

                default:
                    logger.warn(`Unhandled webhook event: ${eventType}`);
            }

            return res.status(200).json({ success: true, message: "Webhook processed" });
        } catch (error: any) {
            logger.error("Webhook processing error:", error);
            throw new AppError(`Webhook processing error: ${error.message}`, 500);
        }
    }


    verifyWebHookSignature = (body: string, timestamp: string, signature: string) => {
        logger.debug("Verifying Cashfree Webhook Signature");

        // logger.debug("Webhook Body: ", body);
        // logger.debug("Webhook Timestamp: ", timestamp);
        // logger.debug("Webhook Signature: ", signature);
        const response = cashfree.PGVerifyWebhookSignature(signature, body, timestamp);
        // logger.debug("Signature verification response: ", response.object)

        if (response.object) return true;
        return false;
    }
}

export const webhook_controller = new WebhookController();