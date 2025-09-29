import Razorpay from "razorpay";
import crypto from "crypto";
import Payment from "../Models/PaymentModel.js";

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Create Order
export const createOrder = async (req, res) => {
  try {
    const { amount, currency = "INR", userId } = req.body;
    

    if (!amount || !currency) {
      return res.status(400).json({ message: "Amount and currency are required" });
    }

    const options = {
      amount: amount * 100, // convert to smallest unit
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    const payment = new Payment({
      orderId: order.id,
      amount,
      currency,
      userId: userId || null,
    });
    await payment.save();

    res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ message: "Failed to create order", error: error.message });
  }
};

// ✅ Verify Payment
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: "Missing orderId, paymentId or signature" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + "|" + paymentId)
      .digest("hex");

    const isAuthentic = expectedSignature === signature;

    if (isAuthentic) {
      await Payment.findOneAndUpdate(
        { orderId },
        { paymentId, signature, status: "paid" },
        { new: true }
      );

      res.status(200).json({ success: true, message: "Payment verified successfully" });
    } else {
      await Payment.findOneAndUpdate(
        { orderId },
        { paymentId, signature, status: "failed" },
        { new: true }
      );

      res.status(400).json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    res.status(500).json({ message: "Payment verification error", error: error.message });
  }
};

// ✅ Fetch Payment Status
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ message: "OrderId is required" });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ message: "Failed to fetch payment status", error: error.message });
  }
};
