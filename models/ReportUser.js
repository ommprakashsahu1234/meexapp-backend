const mongoose = require("mongoose");

const reportUser = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reportedId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  reportedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("reportUser", reportUser);
