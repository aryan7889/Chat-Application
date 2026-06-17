const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};
const userSocketMap = {};

function updateOnlineUsers() {
    io.emit("online-users", Object.values(users));
}

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    socket.on("new-user", (username) => {
        if (!username) return;
        users[socket.id] = username;
        userSocketMap[username] = socket.id;

        io.emit("user-joined", `${username} joined the chat`);
        updateOnlineUsers();
    });

    socket.on("user-message", (message) => {

        const username = users[socket.id];

        if (!username || !message.trim()) return;

        io.emit("message", {
            username,
            message
        });

    });

    socket.on("join-room", (roomname) => {

        if (!roomname) return;


        if (socket.room) {
        socket.leave(socket.room);
        }
        socket.room = roomname;
        socket.join(roomname);

        socket.emit("joined-room", roomname);

    });

    socket.on("room-message", ({ room, message }) => {

        const username = users[socket.id];

        if (!username || !room || !message.trim()) return;

        io.to(room).emit("message", {
            username,
            message,
            room
        });

    });

    socket.on("typing", () => {

        const username = users[socket.id];

          if (!username) return;

    if (socket.room) {

        socket.broadcast.to(socket.room).emit("typing", username);

    } else {

   
        socket.broadcast.emit("typing", username);

    }

    });

    socket.on("stop-typing", () => {

        
    if (socket.room) {

        socket.broadcast.to(socket.room).emit("stop-typing");

    } else {

        socket.broadcast.emit("stop-typing");

    }

    });

    socket.on("private-message", ({ toUser, message }) => {

        const fromUser = users[socket.id];
        const toSocketId = userSocketMap[toUser];

        if (!fromUser || !toSocketId || !message.trim()) return;

        io.to(toSocketId).emit("private-message", {
            fromUser,
            message
        });

        socket.emit("private-message", {
            fromUser,
            message
        });

    });

    socket.on("leave-room", () => {

    if (socket.room) {

        socket.leave(socket.room);

        socket.room = null;

        socket.emit("left-room");

    }

});

    socket.on("disconnect", () => {

        const username = users[socket.id];

        if (username) {

            io.emit("user-left", `${username} left the chat`);

            delete userSocketMap[username];

        }

        delete users[socket.id];

        updateOnlineUsers();

    });

});


// so the new goal is to connect to the mongo db for the time stamp and the hostory management and after that 
// adding login and the sign in thing in the application

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {

    res.sendFile(path.join(__dirname, "public", "index.html"));

});

server.listen(1000, () => {
    console.log("Server Started on port 1000");
});