import { app } from "./app.js";
import { createServer } from 'http';
import dotenv from "dotenv";
import { connectDb } from "./db/index.js";
import { setupSocket } from "./setupSocket.js";
import { userChangeStream } from "./controllers/user.controller.js";

dotenv.config({
    path: "./env",
});

const PORT = process.env.PORT
const HOST = "0.0.0.0"

const server = createServer(app)
// Disable console logs in production
console.log = () => { };
console.error = () => { };
console.warn = () => { };
console.info = () => { };

connectDb()
    .then(() => {
        setupSocket(server)
        userChangeStream()

        server.listen(PORT, HOST, () => {
            console.log("server is running at port ", PORT);
        });
    });