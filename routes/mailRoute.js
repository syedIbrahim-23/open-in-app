import express from "express";
import { responseToMail } from "../controllers/mail.js";

const mailRouter = express.Router();

mailRouter.get("/", responseToMail);

export default mailRouter;
