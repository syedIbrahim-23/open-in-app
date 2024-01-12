import  express from "express";
import dotenv  from "dotenv";
import mailRouter from "./routes/mailRoute.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use("/api/mail", mailRouter);

app.get("/api", (req, res) => {
  res.json({ success: "Api is running" });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
