const mongoose = require("mongoose");

const activityLog = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, enum: ["comment", "like", "report_user", "report_post", "request", "post", "login", "register", "update_profile", "delete_post", "delete_account", "unlike", "update_post"], required: true },
  meta: { type: Object },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("activitylog", activityLog);
