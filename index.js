const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Message = require("./models/message");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};
const userSocketMap = {};

function updateOnlineUsers() {
    io.emit("online-users", Object.values(users));
}

mongoose.connect("mongodb://127.0.0.1:27017/chatapp")
.then(()=>{
    console.log("MongoDb Connected");
})
.catch(err=>{
    console.log(err);
});
io.on("connection", async(socket) => {

    console.log("Connected:", socket.id);

     const globalMessages = await Message.find({
        room: "global"
    })
    .sort({createdAt:1})
    .limit(50);

    socket.emit("chat-history", globalMessages);

    socket.on("new-user", (username) => {
        if (!username) return;
        users[socket.id] = username;
        userSocketMap[username] = socket.id;

        io.emit("user-joined", `${username} joined the chat`);
        updateOnlineUsers();
    });

    socket.on("user-message", async(message) => {

        const username = users[socket.id];

        if (!username || !message.trim()) return;

        await Message.create({
            username,
            message,
            room:"global"
        })

        io.emit("message", {
            username,
            message
        });

    });

    socket.on("join-room", async(roomname) => {

        if (!roomname) return;


        if (socket.room) {
        socket.leave(socket.room);
        }
        socket.room = roomname;
        socket.join(roomname);

        socket.emit("joined-room", roomname);

        const roomMessages = await Message.find({
            room:roomname
        })
        .sort({createdAt:1})
        .limit(50);

        socket.emit("room-history",roomMessages);
    });

    socket.on("room-message", async({ room, message }) => {

        const username = users[socket.id];

        if (!username || !room || !message.trim()) return;

        await Message.create({
            username,
            message,
            room,
        })
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


// to connect the blog application and the chat thing inside the blog where both can get connect.

// ideas:
// 1.like counter
// 2.react
// so if you want to connect we can do chatting
// 