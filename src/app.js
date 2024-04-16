import express, { json } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();
app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    })
); //for cors issue tackling . VImp
app.use(express.json({ limit: "16kb" })); //amount of json to be handled by the server
app.use(express.urlencoded({ extended: true, limit: "16kb" })); //amount of urlencoded data to be handled by the server
app.use(express.static("public")); //for serving static files
app.use(cookieParser()); //for parsing cookies
export default app;
