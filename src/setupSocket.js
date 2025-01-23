import { Server as socketIo } from "socket.io"
import { updateMessageStatusOnUserOnline } from "./controllers/message.controller.js";

let io;
const connectedUserObj = {}


const setupSocket = (server) => {
    io = new socketIo(server, {
        cors: {
            origin: process.env.CORS_ORIGIN,
            methods: ["GET", "POST"]
        }
    })

    io.on('connection', (socket) => {
        console.log('Client connected');
        // connect the user
        let userId;
        socket.on("setUserId", async (data) => {
            userId = data.userId
            // creates a map of userId and sockt id
            connectedUserObj[userId] = socket.id;
            // emits list of all connected users
            io.emit("connectionList", Object.keys(connectedUserObj));
            await updateMessageStatusOnUserOnline(userId);
        })
        socket.on('disconnect', async () => {
            console.log('Client disconnected');
            // removes user after disconnection
            if (userId) {
                delete connectedUserObj[userId];
            }
            // emits list of all connected users
            io.emit("connectionList", Object.keys(connectedUserObj));
        });
    })
}

function getIo() {
    return io;
}

function getConnectionObj() {
    return connectedUserObj;
}

export { setupSocket, getIo, getConnectionObj };