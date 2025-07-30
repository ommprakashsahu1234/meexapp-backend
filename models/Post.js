const mongoose = require("mongoose");

const post = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  caption: { type: String },
  media: [
    {
      type: {
        type: String,
        enum: ["image", "video"]
      },
      url: { type: String },
      fileId: { type: String }
    }
  ],
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  location: { type: String },
  visibility: { type: String, enum: ["public", "private", "followers"], default: "public" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  suspended: { type: Boolean, default: false }
});

module.exports = mongoose.model("post", post);