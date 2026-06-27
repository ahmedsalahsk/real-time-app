const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

conversationSchema.pre("validate", function () {
  if (this.participants?.length === 2) {
    const ids = this.participants.map((id) => id.toString()).sort();

    this.participants = ids;
    this.participantKey = ids.join(":");
  }
});

const Conversation = mongoose.model("Conversation", conversationSchema);
module.exports = Conversation;
