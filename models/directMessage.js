const mongoose = require("mongoose");

const directMessageSchema = new mongoose.Schema({
    fromUser: {
        type: String,
        required: true,
    },
    toUser: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("DirectMessage", directMessageSchema);
