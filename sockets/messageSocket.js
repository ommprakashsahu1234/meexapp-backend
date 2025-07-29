const { saveMessage, markMessagesAsSeen } = require("../controllers/message-controller");

function messageSocket(io) {
    io.on("connection", (socket) => {
        socket.on("join", (userId) => {
            socket.join(userId);
        });

        socket.on("sendMessage", async ({ from, to, message }) => {
            const saved = await saveMessage({ from, to, message });
            io.to(to).emit("receiveMessage", {
                _id: saved._id,
                from,
                to,
                message,
                createdAt: saved.createdAt,
                seen: false
            });
        });
        socket.on("messageSeen", async ({ from, to }) => {
            await markMessagesAsSeen({ from, to });
            io.to(from).emit("messagesSeen", { by: to });
        });

        socket.on("disconnect", () => {
        });
    });
}

module.exports = messageSocket;
