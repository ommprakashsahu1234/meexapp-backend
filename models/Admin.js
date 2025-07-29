const mongoose = require("mongoose");

const Admin = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    gender: { type: String },
    demo: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Admin", Admin);
