const mongoose = require("mongoose");

const reportPost = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "post", required: true },
  message: { type: String, required: true },
  reportedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("reportPost", reportPost);
