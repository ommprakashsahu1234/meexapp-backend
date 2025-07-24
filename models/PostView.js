const mongoose = require("mongoose");

const postView = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "post", required: true },
  viewedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("postview", postView);
