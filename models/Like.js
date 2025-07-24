const mongoose = require("mongoose");

const like = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "post", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  likedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("like", like);
