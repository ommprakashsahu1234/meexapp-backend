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

        socket.on("call-user", ({ to, offer }, callback) => {
            const receiverSockets = io.sockets.adapter.rooms.get(to);

            if (receiverSockets && receiverSockets.size > 0) {
                io.to(to).emit("call-made", { from: socket.id, offer });

                if (callback) callback({ status: "ok" });
            } else {
                if (callback) callback({ status: "not_connected" });
            }
        });


        socket.on("make-answer", ({ to, answer }) => {
            io.to(to).emit("answer-made", { from: socket.id, answer });
        });

        socket.on("ice-candidate", ({ to, candidate }) => {
            io.to(to).emit("ice-candidate", { from: socket.id, candidate });
        });

        socket.on("end-call", ({ to }) => {
            io.to(to).emit("call-ended");
        });
        socket.on("disconnect", () => {
        });
    });
}

module.exports = messageSocket;
