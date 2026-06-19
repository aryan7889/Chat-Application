const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Message = require("./models/message");
const DirectMessage = require("./models/directMessage");
const authRoutes = require("./routes/auth");
const { socketAuthMiddleware } = require("./middleware/auth");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};
const userSocketMap = {};

function updateOnlineUsers() {
    io.emit("online-users", Object.values(users));
}

mongoose.connect("mongodb://127.0.0.1:27017/chatapp")
.then(() => {
    console.log("MongoDb Connected");
})
.catch(err => {
    console.log(err);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.use(socketAuthMiddleware);

io.on("connection", async (socket) => {
    console.log("Connected:", socket.id);

    const username = socket.user.username;
    users[socket.id] = username;
    userSocketMap[username] = socket.id;

    const globalMessages = await Message.find({
        room: "global",
    })
    .sort({ createdAt: 1 })
    .limit(50);

    socket.emit("chat-history", globalMessages);

    io.emit("user-joined", `${username} joined the chat`);
    updateOnlineUsers();

    socket.on("user-message", async (message) => {
        if (!message.trim()) return;

        await Message.create({
            username,
            message,
            room: "global",
        });

        io.emit("message", {
            username,
            message,
        });
    });

    socket.on("join-room", async (roomname) => {
        if (!roomname) return;

        if (socket.room) {
            socket.leave(socket.room);
        }

        socket.dmPartner = null;
        socket.room = roomname;
        socket.join(roomname);

        socket.emit("joined-room", roomname);

        const roomMessages = await Message.find({
            room: roomname,
        })
        .sort({ createdAt: 1 })
        .limit(50);

        socket.emit("room-history", roomMessages);
    });

    socket.on("room-message", async ({ room, message }) => {
        if (!room || !message.trim()) return;

        await Message.create({
            username,
            message,
            room,
        });

        io.to(room).emit("message", {
            username,
            message,
            room,
        });
    });

    socket.on("typing", () => {
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

    socket.on("private-message", async ({ toUser, message }) => {
        if (!toUser || !message.trim()) return;

        await DirectMessage.create({
            fromUser: username,
            toUser,
            message,
        });

        const payload = {
            fromUser: username,
            toUser,
            message,
        };

        const toSocketId = userSocketMap[toUser];

        if (toSocketId) {
            io.to(toSocketId).emit("private-message", payload);
        }

        socket.emit("private-message", payload);
    });

    socket.on("open-dm", async (toUser) => {
        if (!toUser || toUser === username) return;

        if (socket.room) {
            socket.leave(socket.room);
            socket.room = null;
        }

        // when ever the person is sending the dm the person automatically gets
        // out of the room.
        socket.dmPartner = toUser;

        const dmMessages = await DirectMessage.find({
            $or: [
                { fromUser: username, toUser },
                { fromUser: toUser, toUser: username },
            ],
        })
        .sort({ createdAt: 1 })
        .limit(50);

        socket.emit("dm-history", { toUser, messages: dmMessages });
    });

    socket.on("leave-room", async () => {
        if (socket.room) {
            socket.leave(socket.room);
            socket.room = null;
        }

        socket.dmPartner = null;

        const globalMessages = await Message.find({
            room: "global",
        })
        .sort({ createdAt: 1 })
        .limit(50);

        socket.emit("global-history", globalMessages);
        socket.emit("left-room");
    });

    socket.on("disconnect", () => {
        if (username) {
            io.emit("user-left", `${username} left the chat`);
            delete userSocketMap[username];
        }

        delete users[socket.id];
        updateOnlineUsers();
    });
});

server.listen(2000, () => {
    console.log("Server Started on port 2000");
});

// 