import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";
dotenv.config({
    path: "./.env",
});

connectDB()
    .then(() => {
        app.on("error", (error) => {
            console.error("SERVER ERROR: ", error);
            throw error;
        });
        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server started on port ${process.env.PORT}`);
        });
    })
    .catch((error) => {
        console.error("DB connection failed !! ERROR: ", error);
    });

// (async () => {
//     try {
//         await mongoose.connect(`${process.env.MONGO_URI}\${DB_NAME}`);
//     } catch (error) {
//         console.error("ERROR: ", error);
//         throw error;
//     }
// })();
