const mongoose = require("mongoose");

const user = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  mobile: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  name: { type: String },
  bio: { type: String },
  profileImageURL: { type: String },
  website: { type: String },
  gender: { type: String },
  isVerified: { type: Boolean, default: false },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isbanned: {
    type: {
      banned: { type: Boolean, default: false },
      reason: { type: String, default: "" }
    },
    default: {
      banned: false,
      reason: ""
    },
    required: true
  },
  demo: { type: Boolean, required: true, default: false },
  interests: { type: [String], default: [] },
  location: { type: String, trim: true, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", user);
