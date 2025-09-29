import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to database.");
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1); // exit if DB fails
  }
};

export default connectDB;