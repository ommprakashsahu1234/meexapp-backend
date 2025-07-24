const mongoose = require("mongoose");

const comment = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "post", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("comment", comment);
