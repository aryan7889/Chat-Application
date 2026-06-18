const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "chatapp-dev-secret";

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error("Authentication required"));
    }

    try {
        socket.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        next(new Error("Invalid or expired token"));
    }
}

module.exports = {
    authMiddleware,
    socketAuthMiddleware,
    JWT_SECRET,
};
