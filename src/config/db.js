import mongoose from "mongoose";

export async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("db connected successfully");
    } catch (error) {
        console.log("db connection error", error.message);
    }
}