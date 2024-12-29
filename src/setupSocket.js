import { Server as socketIo } from "socket.io"
import { User } from "./models/user.model.js";

let io;


const setupSocket = (server) => {
    io = new socketIo(server, {
        cors: {
            origin: process.env.CORS_ORIGIN,
            methods: ["GET", "POST"]
        }
    })

    io.on('connection', (socket) => {
        console.log('Client connected');

        socket.on('disconnect', async () => {
            
            console.log('Client disconnected');
        });
    })
}

function getIo() {
    return io;
}

export { setupSocket, getIo }