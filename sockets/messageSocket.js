// const { saveMessage, markMessagesAsSeen } = require("../controllers/message-controller");

// function messageSocket(io) {
//     io.on("connection", (socket) => {
//         socket.on("join", (userId) => {
//             socket.join(userId);
//         });

//         socket.on("sendMessage", async ({ from, to, message }) => {
//             const saved = await saveMessage({ from, to, message });
//             io.to(to).emit("receiveMessage", {
//                 _id: saved._id,
//                 from,
//                 to,
//                 message,
//                 createdAt: saved.createdAt,
//                 seen: false
//             });
//         });

//         socket.on("messageSeen", async ({ from, to }) => {
//             await markMessagesAsSeen({ from, to });
//             io.to(from).emit("messagesSeen", { by: to });
//         });

//         socket.on("call-user", ({ to, offer }, callback) => {
//             const receiverSockets = io.sockets.adapter.rooms.get(to);

//             if (receiverSockets && receiverSockets.size > 0) {
//                 io.to(to).emit("call-made", { from: socket.id, offer });

//                 if (callback) callback({ status: "ok" });
//             } else {
//                 if (callback) callback({ status: "not_connected" });
//             }
//         });


//         socket.on("make-answer", ({ to, answer }) => {
//             io.to(to).emit("answer-made", { from: socket.id, answer });
//         });

//         socket.on("ice-candidate", ({ to, candidate }) => {
//             io.to(to).emit("ice-candidate", { from: socket.id, candidate });
//         });

//         socket.on("end-call", ({ to }) => {
//             io.to(to).emit("call-ended");
//         });
//         socket.on("disconnect", () => {
//         });
//     });
// }

// module.exports = messageSocket;


const { saveMessage, markMessagesAsSeen } = require("../controllers/message-controller");

const onlineUsers = new Map(); // ✅ Map userId -> socketId

function messageSocket(io) {
    io.on("connection", (socket) => {
        console.log("🟢 New socket connected:", socket.id);

        socket.on("join", (userId) => {
            socket.join(userId); // Optional: to allow room-based messaging
            onlineUsers.set(userId, socket.id); // ✅ Track mapping
            console.log(`✅ User ${userId} joined. Socket: ${socket.id}`);
        });

        socket.on("sendMessage", async ({ from, to, message }) => {
            const saved = await saveMessage({ from, to, message });
            io.to(to).emit("receiveMessage", {
                _id: saved._id,
                from,
                to,
                message,
                createdAt: saved.createdAt,
                seen: false,
            });
        });

        socket.on("messageSeen", async ({ from, to }) => {
            await markMessagesAsSeen({ from, to });
            io.to(from).emit("messagesSeen", { by: to });
        });

        // ✅ FIXED: call-user logic using onlineUsers Map
        socket.on("call-user", ({ to, offer }, callback) => {
            const receiverSocketId = onlineUsers.get(to);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit("call-made", {
                    from: socket.id,
                    offer,
                });
                if (callback) callback({ status: "ok" });
            } else {
                console.warn("❌ Receiver not connected:", to);
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
            // Clean up disconnected user
            for (const [userId, sockId] of onlineUsers.entries()) {
                if (sockId === socket.id) {
                    onlineUsers.delete(userId);
                    console.log(`🔴 User ${userId} disconnected.`);
                    break;
                }
            }
        });
    });
}

module.exports = messageSocket;