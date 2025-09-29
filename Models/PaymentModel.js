import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    paymentId: { type: String },
    signature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, enum: ["INR", "AED"] },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }, // optional link
  },
  { timestamps: true }

  
);



export default mongoose.model("Payment", paymentSchema);