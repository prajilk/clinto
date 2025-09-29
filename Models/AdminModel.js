import mongoose from "mongoose";


const adminSchema = new mongoose.Schema(
    {
        email:{
        type: String,
        required: true,
        },
        password:{
            type: String,
            required: true,
        },
        role:{
            type: String,
            enum: ["admin", "superadmin"],
            default: "admin",
            required: true,
        }

    })

export default mongoose.model("Admin",adminSchema);