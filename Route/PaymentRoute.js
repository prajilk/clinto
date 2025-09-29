import express from "express";
import { createOrder, verifyPayment, getPaymentStatus } from "../Controller/PaymentController.js";

const router = express.Router();


router.post("/orderPayment", createOrder);
router.post("/verifyPayment", verifyPayment);
router.get("/statusPayment/:orderId", getPaymentStatus);

export default router;
