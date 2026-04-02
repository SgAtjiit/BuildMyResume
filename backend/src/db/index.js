import mongoose from "mongoose";
import { env } from "../config/env.js";
import { DB_NAME } from "../constants/index.js";

export const connectDB = async () => {
  const connection = await mongoose.connect(`${env.MONGODB_URI}/${DB_NAME}`);
  return connection;
};
