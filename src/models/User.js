const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 20,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, maxlength: 100 },
    displayName: { type: String, minlength: 3, maxlength: 30, trim: true },
    avatar: { type: String, default: "" },
  },
  { timestamps: true },
);

userSchema.index({ username: "text", displayName: "text", email: "text" });

module.exports = mongoose.model("User", userSchema);
