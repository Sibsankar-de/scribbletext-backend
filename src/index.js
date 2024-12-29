import { app } from "./app.js";
import { createServer } from 'http';
import dotenv from "dotenv";
import { connectDb } from "./db/index.js";
import { setupSocket } from "./setupSocket.js";
import { messageChangeStream } from "./controllers/message.controller.js";
import { userChangeStream } from "./controllers/user.controller.js";

dotenv.config({
    path: "./env",
});

const PORT = process.env.PORT || 4000

const server = createServer(app)

connectDb()
    .then(() => {
        setupSocket(server)
        userChangeStream()
        messageChangeStream()

        server.listen(PORT, () => {
            console.log("server is running at port ", PORT);
        });
    });

