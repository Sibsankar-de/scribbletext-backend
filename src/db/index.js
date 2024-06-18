import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDb = async () => {
    try {
        const dbInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(
            `\n Mongo server connected !! DB host ${dbInstance.connection.host}`
        );

        return dbInstance.connection
    } catch (err) {
        console.log("Mongo connection error: ", err);
        process.exit(1);
    }
};

export { connectDb }
