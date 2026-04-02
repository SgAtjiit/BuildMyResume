import dotenv from "dotenv";
dotenv.config({ path: "./.env" }); // 👈 SABSE UPAR

import connectDB from "./db/index.js";
import { app } from "./app.js";

const port = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running at port: ${port}`);
    });
  })
  .catch((error) => {
    console.log("Mongodb connection failed!!", error);
  });
