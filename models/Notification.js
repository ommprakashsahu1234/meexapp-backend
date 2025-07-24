const mongoose = require("mongoose");

const notification = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["like", "comment", "follow", "action", "admin"], required: true },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return ["like", "comment", "follow"].includes(this.type);
    },
  },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "post", default: null },
  message: { type: String, default: "" }, // 🔥 
  isRead: { type: Boolean, default: false },
  isGot: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("notification", notification);